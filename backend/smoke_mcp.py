"""MCP-only smoke test (no Azure auth needed)."""

import asyncio
import logging

logging.basicConfig(level=logging.INFO)

from services.mcp_client import LearnMcpClient


async def main() -> None:
    client = LearnMcpClient()
    await client.start()
    try:
        snippets = await client.search(
            "Azure OpenAI Foundry endpoint v1", limit=3
        )
        print(f"Got {len(snippets)} snippets")
        for i, sn in enumerate(snippets, 1):
            print(f"[{i}] {sn.title}")
            print(f"    {sn.url}")
            print(f"    {sn.content[:160].strip()}...")
            print()
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
