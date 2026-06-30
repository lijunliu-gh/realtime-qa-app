"""Async wrappers around streamable-HTTP MCP servers used for Q&A grounding.

The Microsoft Learn MCP endpoint (`https://learn.microsoft.com/api/mcp`)
exposes streamable-HTTP MCP and requires no auth. Each `McpSearchProvider`
keeps a single long-lived client session for the lifetime of the FastAPI
app and exposes a tiny `search()` helper.

`SearchAggregator` fans a query out across several providers (e.g.
Microsoft Learn plus any servers listed in ``MCP_SERVERS``) and merges the
results, so answers can be grounded in multiple documentation sources.

An MCP server contributes (at minimum) a search-like tool such as
`microsoft_docs_search` — keyword search returning snippets with
title / url / content. We only need the search tool here.
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
    source: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "title": self.title,
            "url": self.url,
            "content": self.content,
            "source": self.source,
        }


class McpSearchProvider:
    """Long-lived MCP client for a single streamable-HTTP MCP server.

    Each provider connects to one MCP endpoint, picks a search-like tool,
    and exposes a tiny `search()` helper returning `DocSnippet`s tagged
    with this provider's `name` (used as the citation source).

    Usage::

        provider = McpSearchProvider("Microsoft Learn", "https://.../mcp")
        await provider.start()
        snippets = await provider.search("Azure OpenAI Foundry")
        ...
        await provider.aclose()
    """

    SEARCH_TOOL_CANDIDATES = (
        "microsoft_docs_search",
        "mslearn_search",
        "search",
    )

    def __init__(self, name: str, url: str) -> None:
        self.name = name
        self.url = url
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
            logger.info(
                "MCP[%s] connected to %s, tools=%s",
                self.name, self.url, tool_names,
            )

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
                    "MCP[%s] has no search-like tool; available: %s",
                    self.name, tool_names,
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
                logger.exception("Error closing MCP[%s] client", self.name)

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
                    logger.exception(
                        "MCP[%s] search failed for %r", self.name, query
                    )
                    return []

        snippets = _parse_search_result(result)
        for snippet in snippets:
            snippet.source = self.name
        return snippets[:limit]


class LearnMcpClient(McpSearchProvider):
    """Backward-compatible provider for the Microsoft Learn MCP server."""

    def __init__(self, url: str | None = None) -> None:
        super().__init__(
            "Microsoft Learn",
            url or os.getenv(
                "MCP_LEARN_URL", "https://learn.microsoft.com/api/mcp"
            ),
        )


class SearchAggregator:
    """Fan-out search across multiple MCP providers and merge results.

    Providers are queried in parallel; results are de-duplicated by URL
    and interleaved round-robin so every source is represented and no
    single source dominates the cited references. A provider that fails
    to start (or to answer a query) is skipped rather than failing the
    whole search.
    """

    def __init__(self, providers: list[McpSearchProvider]) -> None:
        self._providers = list(providers)

    @property
    def providers(self) -> list[McpSearchProvider]:
        return self._providers

    async def start(self) -> None:
        if not self._providers:
            logger.warning("SearchAggregator has no providers configured.")
            return
        results = await asyncio.gather(
            *(p.start() for p in self._providers),
            return_exceptions=True,
        )
        alive: list[McpSearchProvider] = []
        for provider, res in zip(self._providers, results):
            if isinstance(res, BaseException):
                logger.warning(
                    "Provider %s failed to start and will be skipped: %s",
                    provider.name, res,
                )
            else:
                alive.append(provider)
        self._providers = alive
        logger.info(
            "SearchAggregator ready with %d provider(s): %s",
            len(alive), [p.name for p in alive],
        )

    async def aclose(self) -> None:
        await asyncio.gather(
            *(p.aclose() for p in self._providers),
            return_exceptions=True,
        )

    async def search(self, query: str, limit: int = 5) -> list[DocSnippet]:
        if not self._providers:
            return []
        results = await asyncio.gather(
            *(p.search(query, limit) for p in self._providers),
            return_exceptions=True,
        )
        per_source: list[list[DocSnippet]] = []
        for provider, res in zip(self._providers, results):
            if isinstance(res, BaseException):
                logger.warning(
                    "Provider %s search failed: %s", provider.name, res
                )
            elif res:
                per_source.append(res)
        return _merge_round_robin(per_source, limit)


def build_providers_from_env() -> list[McpSearchProvider]:
    """Build the provider list from environment configuration.

    Always includes Microsoft Learn (``MCP_LEARN_URL``). Additional MCP
    servers come from ``MCP_SERVERS``: a comma-separated list of entries,
    each either ``url`` or ``Friendly Name|url``. Example::

        MCP_SERVERS=GitHub Docs|https://example.com/mcp, https://other/mcp
    """
    providers: list[McpSearchProvider] = [LearnMcpClient()]
    raw = os.getenv("MCP_SERVERS", "").strip()
    for entry in (e.strip() for e in raw.split(",")):
        if not entry:
            continue
        if "|" in entry:
            name, url = entry.split("|", 1)
            name, url = name.strip(), url.strip()
        else:
            url = entry
            name = url
        if url:
            providers.append(McpSearchProvider(name, url))
    return providers


def _merge_round_robin(
    lists: list[list[DocSnippet]], limit: int
) -> list[DocSnippet]:
    """Interleave per-source result lists, de-duplicating by URL."""
    out: list[DocSnippet] = []
    seen: set[str] = set()
    idx = 0
    while len(out) < limit and any(idx < len(lst) for lst in lists):
        for lst in lists:
            if idx >= len(lst):
                continue
            snippet = lst[idx]
            key = snippet.url.strip() or f"{snippet.title}|{snippet.content[:60]}"
            if key in seen:
                continue
            seen.add(key)
            out.append(snippet)
            if len(out) >= limit:
                break
        idx += 1
    return out


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
