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


def _lang_instruction(language: str) -> str:
    """Return a single-sentence language instruction for prompts."""
    if language.startswith("ja"):
        return "\n日本語で回答してください。"
    elif language.startswith("zh"):
        return "\n请用中文回答。"
    elif language.startswith("en"):
        return "\nAnswer in English."
    elif language.startswith("ko"):
        return "\n한국어로 답변해 주세요."
    elif language.startswith("fr"):
        return "\nRépondez en français."
    elif language.startswith("de"):
        return "\nAntworten Sie auf Deutsch."
    else:
        return f"\nAnswer in the language matching locale: {language}."


def _lang_name(language: str) -> str:
    """Return human-readable language name for translation prompts."""
    mapping = {
        "ja": "Japanese", "en": "English", "zh": "Chinese",
        "ko": "Korean", "fr": "French", "de": "German",
    }
    prefix = language.split("-")[0]
    return mapping.get(prefix, language)


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

    async def summarize(self, transcript: str, language: str = "ja-JP") -> tuple[str, int]:
        """Generate a structured summary from scratch."""
        return await self.update_summary(
            previous_summary="", new_transcript=transcript, language=language
        )

    async def update_summary(
        self, previous_summary: str, new_transcript: str, language: str = "ja-JP"
    ) -> tuple[str, int]:
        if not new_transcript.strip():
            return previous_summary, 0

        lang_instruction = _lang_instruction(language)

        system = (
            "あなたは会議の要約を継続的に更新するアシスタントです。" if language.startswith("ja") else
            "You are an assistant that continuously updates meeting summaries." if language.startswith("en") else
            "你是一个持续更新会议摘要的助手。" if language.startswith("zh") else
            "You are an assistant that continuously updates meeting summaries."
        )
        system += (
            "既存の要約と、その後に追加された会話内容を受け取り、"
            "両方を統合した最新の要約を返してください。"
            "出力は番号付きリスト形式で、重要なポイント、決定事項、"
            "アクションアイテムを含めてください。"
            "既存の要約に矛盾する新しい情報があれば、新しい方を優先してください。"
            "重複は統合し、要点を簡潔に保ってください。"
        ) if language.startswith("ja") else (
            "接收现有摘要和之后追加的对话内容，"
            "返回整合两者的最新摘要。"
            "输出使用编号列表格式，包含要点、决定事项和待办事项。"
            "如果新信息与现有摘要矛盾，以新信息为准。"
            "合并重复内容，保持简洁。"
        ) if language.startswith("zh") else (
            "Receive the existing summary and newly added conversation, "
            "return an updated summary integrating both. "
            "Output as a numbered list including key points, decisions, "
            "and action items. Prefer newer info over conflicts. "
            "Merge duplicates and keep it concise."
        )
        system += lang_instruction

        if previous_summary.strip():
            user = (
                f"既存の要約:\n{previous_summary}\n\n"
                f"追加された会話:\n{new_transcript}\n\n"
                "上記を踏まえた最新の要約を出力してください。"
            ) if language.startswith("ja") else (
                f"现有摘要:\n{previous_summary}\n\n"
                f"追加的对话:\n{new_transcript}\n\n"
                "请输出整合以上内容的最新摘要。"
            ) if language.startswith("zh") else (
                f"Existing summary:\n{previous_summary}\n\n"
                f"New conversation:\n{new_transcript}\n\n"
                "Output an updated summary integrating the above."
            )
        else:
            user = (
                f"会話内容:\n{new_transcript}" if language.startswith("ja") else
                f"对话内容:\n{new_transcript}" if language.startswith("zh") else
                f"Conversation:\n{new_transcript}"
            )

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

    async def translate(
        self, text: str, target_language: str
    ) -> tuple[str, int]:
        """Translate text into the target language."""
        if not text.strip():
            return "", 0

        lang_name = _lang_name(target_language)
        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a translator. Translate the following text into {lang_name}. "
                        "Preserve the original formatting (numbered lists, bullet points, etc.). "
                        "Do not add explanations or commentary — output only the translation."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=0.3,
            max_completion_tokens=1500,
        )
        translated = response.choices[0].message.content or ""
        return translated, _usage_tokens(response)

    async def extract_questions(
        self,
        transcript: str,
        existing_questions: list[str] | None = None,
        summary: str = "",
        language: str = "ja-JP",
    ) -> tuple[list[str], int]:
        existing = existing_questions or []
        lang_instruction = _lang_instruction(language)

        existing_block = ""
        if existing:
            existing_label = (
                "既に抽出済みの質問（重複しないこと）" if language.startswith("ja") else
                "已提取的问题（不要重复）" if language.startswith("zh") else
                "Already extracted questions (do not duplicate)"
            )
            existing_block = (
                f"\n{existing_label}:\n"
                + "\n".join(f"- {q}" for q in existing)
                + "\n"
            )
        summary_block = ""
        if summary:
            summary_label = (
                "会話の背景（要約）" if language.startswith("ja") else
                "对话背景（摘要）" if language.startswith("zh") else
                "Conversation context (summary)"
            )
            summary_block = f"\n{summary_label}:\n{summary}\n"

        system_content = (
            "あなたは会話から質問を抽出するアシスタントです。"
            "以下の新しい会話部分から、参加者が質問している内容を抽出してください。"
            "既に抽出済みの質問と重複するものは含めないでください。"
            "各質問を具体的な形にまとめてください。"
            "JSONオブジェクト形式で返してください。"
            '形式: {"questions": ["質問1", "質問2"]}'
            '新しい質問が無い場合は {"questions": []} を返してください。'
        ) if language.startswith("ja") else (
            "你是一个从对话中提取问题的助手。"
            "从以下新的对话部分中，提取参与者提出的问题。"
            "不要包含已经提取过的重复问题。"
            "将每个问题总结为具体的形式。"
            "以JSON对象格式返回。"
            '格式: {"questions": ["问题1", "问题2"]}'
            '如果没有新问题则返回 {"questions": []}。'
        ) if language.startswith("zh") else (
            "You are an assistant that extracts questions from conversations. "
            "Extract questions asked by participants from the new conversation below. "
            "Do not include duplicates of already-extracted questions. "
            "Summarize each question concisely. "
            "Return as a JSON object. "
            'Format: {"questions": ["question1", "question2"]} '
            'Return {"questions": []} if no new questions.'
        )
        system_content += lang_instruction

        new_conv_label = (
            "新しい会話部分" if language.startswith("ja") else
            "新的对话部分" if language.startswith("zh") else
            "New conversation"
        )

        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {
                    "role": "system",
                    "content": system_content,
                },
                {
                    "role": "user",
                    "content": (
                        f"{summary_block}{existing_block}"
                        f"\n{new_conv_label}:\n{transcript}"
                    ),
                },
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
        language: str = "ja-JP",
    ) -> tuple[str, list[dict], int]:
        """Generate an answer for `question` grounded in MCP doc snippets.

        Returns `(answer_text, citations, tokens)` where `citations` is a
        list of ``{"title", "url"}`` dicts that were actually referenced
        (we just echo back the snippets we sent, since the model is
        instructed to cite by [n]).
        """
        snippets = list(snippets)
        lang_instruction = _lang_instruction(language)

        no_sources_msg = (
            "（参考資料は見つかりませんでした）" if language.startswith("ja") else
            "（未找到参考资料）" if language.startswith("zh") else
            "(No reference materials found)"
        )

        if not snippets:
            sources_block = no_sources_msg
            citations: list[dict] = []
        else:
            lines = []
            for i, s in enumerate(snippets, 1):
                title = s.get("title") or s.get("url") or f"Source{i}"
                url = s.get("url") or ""
                content = (s.get("content") or "").strip()
                # Cap each snippet to keep prompt size bounded.
                if len(content) > 1500:
                    content = content[:1500] + "..."
                lines.append(
                    f"[{i}] {title}\nURL: {url}\n\n{content}\n"
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
        ) if language.startswith("ja") else (
            "你是一个基于 Microsoft Learn 文档回答技术问题的助手。"
            "请遵守以下规则:\n"
            "1) 必须用中文回答。\n"
            "2) 优先使用参考资料中的内容，尽量少推测。\n"
            "3) 在每个论述末尾加上 [1] [2] 等参考编号。\n"
            "4) 如果参考资料中没有答案，诚实地写'参考资料中未明确说明'。\n"
            "5) 回答简洁，必要时用列表形式。"
        ) if language.startswith("zh") else (
            "You are an assistant that answers technical questions grounded in "
            "Microsoft Learn documentation. Follow these rules:\n"
            "1) Answer in English.\n"
            "2) Prioritize content from reference materials; minimize speculation.\n"
            "3) Append reference numbers [1] [2] after each claim.\n"
            "4) If the answer is not in the references, honestly state so.\n"
            "5) Be concise; use bullet points if needed."
        )

        summary_label = (
            "会議のこれまでの要約" if language.startswith("ja") else
            "会议摘要" if language.startswith("zh") else
            "Meeting summary so far"
        )
        question_label = (
            "質問" if language.startswith("ja") else
            "问题" if language.startswith("zh") else
            "Question"
        )
        ref_label = (
            "参考資料" if language.startswith("ja") else
            "参考资料" if language.startswith("zh") else
            "References"
        )

        user_parts = []
        if conversation_summary.strip():
            user_parts.append(
                f"{summary_label}:\n{conversation_summary}\n"
            )
        user_parts.append(f"{question_label}:\n{question}\n")
        user_parts.append(f"{ref_label}:\n{sources_block}")
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
