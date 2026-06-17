"""Azure Foundry (Azure OpenAI v1) summarization + QA helpers.

The user's Foundry resource has API-key auth disabled, so we authenticate
via Entra ID (`DefaultAzureCredential` — run `az login` once). The legacy
`AsyncAzureOpenAI` SDK supports this through `azure_ad_token_provider`.

Endpoint handling: users may set either
    https://<resource>.openai.azure.com
or
    https://<resource>.openai.azure.com/openai/v1
We normalize to the bare resource form, which the SDK expects.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Iterable

from azure.identity import (
    ChainedTokenCredential,
    DefaultAzureCredential,
    InteractiveBrowserCredential,
    get_bearer_token_provider,
)
from openai import AsyncAzureOpenAI


logger = logging.getLogger(__name__)


_COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default"


def _normalize_endpoint(raw: str) -> str:
    raw = (raw or "").strip().rstrip("/")
    # Strip trailing /openai/v1 or /openai if present; SDK appends it.
    for suffix in ("/openai/v1", "/openai"):
        if raw.endswith(suffix):
            raw = raw[: -len(suffix)]
            break
    return raw


def _usage_tokens(response) -> int:
    usage = getattr(response, "usage", None)
    if not usage:
        return 0
    return getattr(usage, "total_tokens", 0) or 0


class SummarizerService:
    def __init__(self) -> None:
        endpoint = _normalize_endpoint(os.getenv("AZURE_OPENAI_ENDPOINT", ""))
        api_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
        api_version = os.getenv(
            "AZURE_OPENAI_API_VERSION", "2024-10-21"
        )

        kwargs: dict = {
            "azure_endpoint": endpoint,
            "api_version": api_version,
            "timeout": 30.0,
            "max_retries": 2,
        }

        if api_key:
            kwargs["api_key"] = api_key
            logger.info("Foundry client using API key auth")
        else:
            tenant_id = os.getenv("AZURE_TENANT_ID")
            interactive_kwargs = {}
            if tenant_id:
                interactive_kwargs["tenant_id"] = tenant_id
            credential = ChainedTokenCredential(
                DefaultAzureCredential(),
                InteractiveBrowserCredential(**interactive_kwargs),
            )
            sync_provider = get_bearer_token_provider(
                credential, _COGNITIVE_SCOPE
            )

            # openai SDK expects an *async* token provider; wrap the sync
            # azure.identity one in a thread so we don't block the loop
            # (token acquisition can do network / interactive auth on
            # the first call).
            async def _async_token_provider() -> str:
                return await asyncio.to_thread(sync_provider)

            kwargs["azure_ad_token_provider"] = _async_token_provider
            logger.info(
                "Foundry client using Entra ID auth "
                "(DefaultAzureCredential → InteractiveBrowserCredential)"
            )

        self.client = AsyncAzureOpenAI(**kwargs)
        self.deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

    async def summarize(self, transcript: str) -> tuple[str, int]:
        """Generate a structured summary from scratch."""
        return await self.update_summary(
            previous_summary="", new_transcript=transcript
        )

    async def update_summary(
        self, previous_summary: str, new_transcript: str
    ) -> tuple[str, int]:
        if not new_transcript.strip():
            return previous_summary, 0

        system = (
            "あなたは会議の要約を継続的に更新するアシスタントです。"
            "既存の要約と、その後に追加された会話内容を受け取り、"
            "両方を統合した最新の要約を返してください。"
            "出力は番号付きリスト形式で、重要なポイント、決定事項、"
            "アクションアイテムを含めてください。"
            "既存の要約に矛盾する新しい情報があれば、新しい方を優先してください。"
            "重複は統合し、要点を簡潔に保ってください。"
            "日本語で回答してください。"
        )

        if previous_summary.strip():
            user = (
                f"既存の要約:\n{previous_summary}\n\n"
                f"追加された会話:\n{new_transcript}\n\n"
                "上記を踏まえた最新の要約を出力してください。"
            )
        else:
            user = f"会話内容:\n{new_transcript}"

        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
            max_completion_tokens=1000,
        )
        text = response.choices[0].message.content or ""
        return text, _usage_tokens(response)

    async def extract_questions(self, transcript: str) -> tuple[list[str], int]:
        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "あなたは会話から質問を抽出するアシスタントです。"
                        "以下の会話から、参加者が質問している内容を抽出してください。"
                        "各質問を具体的な形にまとめてください。"
                        "JSONオブジェクト形式で返してください。"
                        "形式: {\"questions\": [\"質問1\", \"質問2\"]}"
                        "質問が無い場合は {\"questions\": []} を返してください。"
                        "日本語で回答してください。"
                    ),
                },
                {"role": "user", "content": f"会話内容:\n{transcript}"},
            ],
            temperature=0.3,
            max_completion_tokens=500,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        tokens = _usage_tokens(response)
        questions = _parse_questions(content)
        return questions, tokens

    async def answer_with_context(
        self,
        question: str,
        snippets: Iterable[dict],
        conversation_summary: str = "",
    ) -> tuple[str, list[dict], int]:
        """Generate an answer for `question` grounded in MCP doc snippets.

        Returns `(answer_text, citations, tokens)` where `citations` is a
        list of ``{"title", "url"}`` dicts that were actually referenced
        (we just echo back the snippets we sent, since the model is
        instructed to cite by [n]).
        """
        snippets = list(snippets)

        if not snippets:
            sources_block = "（参考資料は見つかりませんでした）"
            citations: list[dict] = []
        else:
            lines = []
            for i, s in enumerate(snippets, 1):
                title = s.get("title") or s.get("url") or f"資料{i}"
                url = s.get("url") or ""
                content = (s.get("content") or "").strip()
                # Cap each snippet to keep prompt size bounded.
                if len(content) > 1500:
                    content = content[:1500] + "..."
                lines.append(
                    f"[{i}] {title}\nURL: {url}\n本文:\n{content}\n"
                )
            sources_block = "\n".join(lines)
            citations = [
                {"title": s.get("title") or "", "url": s.get("url") or ""}
                for s in snippets
                if s.get("url")
            ]

        system = (
            "あなたは Microsoft Learn のドキュメントを根拠に技術的な質問に答える"
            "アシスタントです。以下のルールを守ってください:\n"
            "1) 必ず日本語で回答する。\n"
            "2) 参考資料に書かれている内容を優先し、推測は最小限にする。\n"
            "3) 各主張の末尾に [1] [2] のように参考番号を付ける。\n"
            "4) 参考資料に答えが無い場合は『参考資料には明示されていません』"
            "と正直に書く。\n"
            "5) 回答は簡潔に、必要なら箇条書きでまとめる。"
        )

        user_parts = []
        if conversation_summary.strip():
            user_parts.append(
                f"会議のこれまでの要約:\n{conversation_summary}\n"
            )
        user_parts.append(f"質問:\n{question}\n")
        user_parts.append(f"参考資料:\n{sources_block}")
        user = "\n".join(user_parts)

        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
            max_completion_tokens=800,
        )
        text = response.choices[0].message.content or ""
        return text, citations, _usage_tokens(response)


def _parse_questions(content: str) -> list[str]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("extract_questions: invalid JSON, returning empty list")
        return []

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("questions") or data.get("items") or []
    else:
        return []

    return [str(q).strip() for q in items if str(q).strip()]
