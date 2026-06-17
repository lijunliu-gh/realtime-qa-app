"""Thin async wrapper around the Microsoft Learn MCP server.

The MS Learn MCP endpoint (`https://learn.microsoft.com/api/mcp`) exposes
streamable-HTTP MCP and requires no auth. We keep a single long-lived
client session for the lifetime of the FastAPI app and expose a tiny
`search()` helper used by the answer pipeline.

The MCP server contributes (at minimum) these tools:
  * `microsoft_docs_search` — keyword search over Microsoft Learn docs;
    returns a list of snippets with title / url / content.
  * `microsoft_docs_fetch`  — fetch the full content of a doc by URL.

We only need the search tool for the MVP.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import AsyncExitStack
from dataclasses import dataclass
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


logger = logging.getLogger(__name__)


@dataclass
class DocSnippet:
    title: str
    url: str
    content: str

    def to_dict(self) -> dict[str, str]:
        return {"title": self.title, "url": self.url, "content": self.content}


class LearnMcpClient:
    """Long-lived MCP client connected to Microsoft Learn.

    Usage::

        client = LearnMcpClient()
        await client.start()
        snippets = await client.search("Azure OpenAI Foundry")
        ...
        await client.aclose()
    """

    SEARCH_TOOL_CANDIDATES = (
        "microsoft_docs_search",
        "mslearn_search",
        "search",
    )

    def __init__(self, url: str | None = None) -> None:
        self.url = url or os.getenv(
            "MCP_LEARN_URL", "https://learn.microsoft.com/api/mcp"
        )
        self._stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None
        self._search_tool: str | None = None
        # Serialize tool calls; the SDK's ClientSession isn't safe for
        # concurrent JSON-RPC calls on a single transport.
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        stack = AsyncExitStack()
        try:
            read, write, _ = await stack.enter_async_context(
                streamablehttp_client(self.url)
            )
            session = await stack.enter_async_context(
                ClientSession(read, write)
            )
            await session.initialize()
            tools = await session.list_tools()
            tool_names = [t.name for t in tools.tools]
            logger.info("MCP connected to %s, tools=%s", self.url, tool_names)

            for candidate in self.SEARCH_TOOL_CANDIDATES:
                if candidate in tool_names:
                    self._search_tool = candidate
                    break
            if not self._search_tool and tool_names:
                # Fall back to the first tool that looks like search.
                for name in tool_names:
                    if "search" in name.lower():
                        self._search_tool = name
                        break

            if not self._search_tool:
                logger.warning(
                    "MCP server has no search-like tool; available: %s",
                    tool_names,
                )

            self._session = session
            self._stack = stack
        except Exception:
            await stack.aclose()
            raise

    async def aclose(self) -> None:
        stack = self._stack
        self._stack = None
        self._session = None
        if stack is not None:
            try:
                await stack.aclose()
            except Exception:
                logger.exception("Error closing MCP client")

    async def search(self, query: str, limit: int = 5) -> list[DocSnippet]:
        if not self._session or not self._search_tool:
            return []
        query = (query or "").strip()
        if not query:
            return []

        async with self._lock:
            try:
                result = await self._session.call_tool(
                    self._search_tool, {"query": query}
                )
            except Exception:
                # Some implementations expose the param as `question`.
                try:
                    result = await self._session.call_tool(
                        self._search_tool, {"question": query}
                    )
                except Exception:
                    logger.exception("MCP search failed for %r", query)
                    return []

        snippets = _parse_search_result(result)
        return snippets[:limit]


def _parse_search_result(result: Any) -> list[DocSnippet]:
    """Best-effort parser for whatever the MCP search tool returns.

    The MS Learn MCP server returns content blocks whose `.text` is a JSON
    object shaped like ``{"results": [{"title", "contentUrl", "content"}]}``.
    We also tolerate top-level lists / single objects / plain text.
    """
    out: list[DocSnippet] = []

    # Prefer structuredContent when the server sets it (newer MCP feature).
    structured = getattr(result, "structuredContent", None)
    if structured:
        for item in _iter_search_items(structured):
            snippet = _snippet_from_obj(item)
            if snippet:
                out.append(snippet)
        if out:
            return out

    content = getattr(result, "content", None) or []
    for block in content:
        text = getattr(block, "text", None)
        if not text:
            continue
        parsed = _try_parse_json(text)

        if parsed is None:
            out.append(DocSnippet(title="", url="", content=text))
            continue

        for item in _iter_search_items(parsed):
            snippet = _snippet_from_obj(item)
            if snippet:
                out.append(snippet)

    return out


def _iter_search_items(parsed: Any):
    """Yield candidate result objects from the various shapes we've seen."""
    if isinstance(parsed, list):
        yield from parsed
    elif isinstance(parsed, dict):
        for key in ("results", "items", "documents", "data"):
            val = parsed.get(key)
            if isinstance(val, list):
                yield from val
                return
        # Single-doc object at the top level.
        yield parsed


def _try_parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def _snippet_from_obj(obj: Any) -> DocSnippet | None:
    if not isinstance(obj, dict):
        return None
    title = str(obj.get("title") or obj.get("name") or "").strip()
    url = str(
        obj.get("contentUrl")
        or obj.get("url")
        or obj.get("link")
        or ""
    ).strip()
    content = str(
        obj.get("content")
        or obj.get("snippet")
        or obj.get("text")
        or ""
    ).strip()
    if not (title or url or content):
        return None
    return DocSnippet(title=title, url=url, content=content)
