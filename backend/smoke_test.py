"""Smoke test: verify Foundry chat call and MS Learn MCP search both work.

Run from backend/ with the venv activated:
    python smoke_test.py
"""

import asyncio
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)

from services.summarizer import SummarizerService
from services.mcp_client import LearnMcpClient


async def main() -> None:
    print("--- Foundry chat ---")
    s = SummarizerService()
    summary, tokens = await s.summarize(
        "[自分] Azure OpenAI と Microsoft Foundry の違いは何ですか？"
    )
    print(f"summary ({tokens} tokens):\n{summary}\n")

    print("--- MCP search ---")
    client = LearnMcpClient()
    await client.start()
    try:
        snippets = await client.search(
            "Azure OpenAI vs Microsoft Foundry", limit=3
        )
        for i, sn in enumerate(snippets, 1):
            print(f"[{i}] {sn.title}")
            print(f"    {sn.url}")
            print(f"    {sn.content[:120]}...")
    finally:
        await client.aclose()

    print("\n--- Answer with context ---")
    ans, cites, tok = await s.answer_with_context(
        question="Azure OpenAI と Microsoft Foundry の違いは何ですか？",
        snippets=[sn.to_dict() for sn in snippets],
        conversation_summary=summary,
    )
    print(f"answer ({tok} tokens):\n{ans}\n")
    print(f"citations: {cites}")


if __name__ == "__main__":
    asyncio.run(main())
