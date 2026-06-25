import os
import json
import asyncio
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

from services.summarizer import SummarizerService
from services.mcp_client import LearnMcpClient

load_dotenv()

logger = logging.getLogger("realtime_qa")
logging.basicConfig(level=logging.INFO)

# Debounce / batching knobs for summarization.
SUMMARY_IDLE_SECONDS = float(os.getenv("SUMMARY_IDLE_SECONDS", "15"))
SUMMARY_MAX_PENDING_LINES = int(os.getenv("SUMMARY_MAX_PENDING_LINES", "40"))
TRANSCRIPT_HISTORY_LIMIT = int(os.getenv("TRANSCRIPT_HISTORY_LIMIT", "500"))
MCP_SEARCH_LIMIT = int(os.getenv("MCP_SEARCH_LIMIT", "5"))


mcp_client = LearnMcpClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await mcp_client.start()
    except Exception:
        logger.exception(
            "Failed to start MS Learn MCP client; QA answers will be "
            "generated without doc grounding."
        )
    try:
        yield
    finally:
        await mcp_client.aclose()


app = FastAPI(title="RealtimeQA Backend", lifespan=lifespan)

_default_origins = "http://localhost:5173"
_allowed_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

summarizer = SummarizerService()


class SessionState:
    def __init__(self) -> None:
        self.transcript_lines: list[dict] = []
        self.summary: str = ""
        self.questions: list[str] = []
        # Map question text -> answer dict { "answer": str, "citations": [...] }
        # Keyed by text so re-extraction doesn't lose previously answered ones.
        self.answers: dict[str, dict] = {}
        self.token_count: int = 0
        # Index up to which transcript has been folded into `summary`.
        self.summary_cursor: int = 0
        # Index up to which transcript has been processed for question extraction.
        self.questions_cursor: int = 0
        # Lock to serialize summary calls per session.
        self.summary_lock: asyncio.Lock = asyncio.Lock()
        # Pending debounced summary task; None when not scheduled.
        self.pending_summary_task: asyncio.Task | None = None
        # Set of question texts currently being answered (to dedupe).
        self.in_flight_answers: set[str] = set()


sessions: dict[str, SessionState] = {}


async def _safe_send(websocket: WebSocket, payload: dict) -> None:
    try:
        await websocket.send_text(json.dumps(payload))
    except Exception:
        logger.exception("Failed to send message to client")


async def _send_error(websocket: WebSocket, message: str, where: str) -> None:
    await _safe_send(
        websocket,
        {"type": "error", "where": where, "message": message},
    )


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = SessionState()
    sessions[session_id] = session

    # Send initial snapshot so a reconnecting client can rebuild state.
    await _safe_send(websocket, {
        "type": "transcript_snapshot",
        "lines": session.transcript_lines,
    })

    try:
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await _send_error(websocket, "invalid JSON payload", "parse")
                continue

            msg_type = message.get("type")

            try:
                if msg_type == "transcript":
                    await _handle_transcript(websocket, session, message)

                elif msg_type == "request_summary":
                    # Force-flush: cancel pending debounce and run now.
                    _cancel_pending(session)
                    asyncio.create_task(_run_summary(websocket, session))

                elif msg_type == "request_questions":
                    asyncio.create_task(
                        _extract_questions(websocket, session)
                    )

                else:
                    await _send_error(
                        websocket,
                        f"unknown message type: {msg_type!r}",
                        "dispatch",
                    )

            except Exception as exc:  # noqa: BLE001
                logger.exception("Error handling message type %s", msg_type)
                await _send_error(websocket, str(exc), msg_type or "unknown")

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Unexpected WebSocket error")
    finally:
        _cancel_pending(session)
        sessions.pop(session_id, None)


async def _handle_transcript(websocket: WebSocket, session: SessionState,
                              message: dict) -> None:
    line = {
        "speaker": message.get("speaker", "自分"),
        "text": (message.get("text") or "").strip(),
    }
    if not line["text"]:
        return

    session.transcript_lines.append(line)

    # Trim history so memory stays bounded for long meetings. Bump the
    # cursor to stay valid.
    if len(session.transcript_lines) > TRANSCRIPT_HISTORY_LIMIT:
        drop = len(session.transcript_lines) - TRANSCRIPT_HISTORY_LIMIT
        session.transcript_lines = session.transcript_lines[drop:]
        session.summary_cursor = max(0, session.summary_cursor - drop)
        session.questions_cursor = max(0, session.questions_cursor - drop)

    # Send only the new line; client appends.
    await _safe_send(websocket, {
        "type": "transcript_append",
        "line": line,
    })

    _schedule_summary(websocket, session)


def _cancel_pending(session: SessionState) -> None:
    task = session.pending_summary_task
    if task and not task.done():
        task.cancel()
    session.pending_summary_task = None


def _schedule_summary(websocket: WebSocket, session: SessionState) -> None:
    """Debounced summary trigger.

    Strategy:
      * If enough lines have piled up since the last summary, kick off a
        run immediately (subject to the in-flight lock).
      * Otherwise, (re)schedule a task that fires after IDLE_SECONDS of
        silence.
    """
    pending_lines = len(session.transcript_lines) - session.summary_cursor

    if pending_lines >= SUMMARY_MAX_PENDING_LINES:
        _cancel_pending(session)
        session.pending_summary_task = asyncio.create_task(
            _run_summary(websocket, session)
        )
        return

    # Reset the idle timer.
    _cancel_pending(session)
    session.pending_summary_task = asyncio.create_task(
        _delayed_summary(websocket, session, SUMMARY_IDLE_SECONDS)
    )


async def _delayed_summary(websocket: WebSocket, session: SessionState,
                            delay: float) -> None:
    try:
        await asyncio.sleep(delay)
    except asyncio.CancelledError:
        return
    await _run_summary(websocket, session)


async def _broadcast_tokens(websocket: WebSocket, session: SessionState,
                             delta: int) -> None:
    if delta <= 0:
        return
    session.token_count += delta
    await _safe_send(websocket, {
        "type": "token_count",
        "count": session.token_count,
    })


async def _run_summary(websocket: WebSocket, session: SessionState) -> None:
    """Rolling summary: feed `previous summary + new lines` to the LLM."""
    if session.summary_lock.locked():
        # Another summary call is already running; it will see the new
        # lines on its own when it finishes (or the next schedule will).
        return

    async with session.summary_lock:
        # Snapshot under the lock so concurrent appends don't shift indices.
        end = len(session.transcript_lines)
        start = session.summary_cursor
        if end <= start:
            return

        new_lines = session.transcript_lines[start:end]
        new_text = "\n".join(
            f"[{l['speaker']}] {l['text']}" for l in new_lines
        )

        try:
            summary, used = await summarizer.update_summary(
                previous_summary=session.summary,
                new_transcript=new_text,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Summarization failed")
            await _send_error(websocket, str(exc), "summarize")
            return

        session.summary = summary
        session.summary_cursor = end

        await _safe_send(websocket, {
            "type": "summary_update",
            "summary": summary,
        })
        await _broadcast_tokens(websocket, session, used)


async def _extract_questions(websocket: WebSocket,
                              session: SessionState) -> None:
    if not session.transcript_lines:
        return

    # Only process lines added since the last extraction.
    start = session.questions_cursor
    end = len(session.transcript_lines)
    if end <= start:
        # No new lines — just re-send existing questions (with answers).
        questions_payload = [
            {
                "text": q,
                "answer": session.answers.get(q, {}).get("answer"),
                "citations": session.answers.get(q, {}).get("citations", []),
            }
            for q in session.questions
        ]
        await _safe_send(websocket, {
            "type": "questions_update",
            "questions": questions_payload,
        })
        return

    new_lines = session.transcript_lines[start:end]
    new_text = "\n".join(
        f"[{l['speaker']}] {l['text']}" for l in new_lines
    )

    try:
        new_questions, used = await summarizer.extract_questions(
            new_text,
            existing_questions=session.questions,
            summary=session.summary,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Question extraction failed")
        await _send_error(websocket, str(exc), "extract_questions")
        return

    session.questions_cursor = end
    session.questions.extend(new_questions)

    # Build response payload including any answers we've already produced.
    questions_payload = [
        {
            "text": q,
            "answer": session.answers.get(q, {}).get("answer"),
            "citations": session.answers.get(q, {}).get("citations", []),
        }
        for q in session.questions
    ]
    await _safe_send(websocket, {
        "type": "questions_update",
        "questions": questions_payload,
    })
    await _broadcast_tokens(websocket, session, used)

    # Kick off answer pipeline for any new question we haven't answered yet.
    for q in new_questions:
        if q in session.answers or q in session.in_flight_answers:
            continue
        idx = session.questions.index(q)
        session.in_flight_answers.add(q)
        asyncio.create_task(_answer_question(websocket, session, idx, q))


async def _answer_question(
    websocket: WebSocket,
    session: SessionState,
    question_index: int,
    question: str,
) -> None:
    """For one extracted question: MCP search → LLM synthesis → push to client."""
    try:
        try:
            snippets = await mcp_client.search(question, limit=MCP_SEARCH_LIMIT)
        except Exception:
            logger.exception("MCP search failed for %r", question)
            snippets = []

        snippet_dicts = [s.to_dict() for s in snippets]

        try:
            answer_text, citations, used = await summarizer.answer_with_context(
                question=question,
                snippets=snippet_dicts,
                conversation_summary=session.summary,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Answer synthesis failed for %r", question)
            await _send_error(websocket, str(exc), "answer_question")
            return

        session.answers[question] = {
            "answer": answer_text,
            "citations": citations,
        }

        await _safe_send(websocket, {
            "type": "answer_update",
            "index": question_index,
            "question": question,
            "answer": answer_text,
            "citations": citations,
        })
        await _broadcast_tokens(websocket, session, used)
    finally:
        session.in_flight_answers.discard(question)


@app.get("/health")
async def health():
    return {"status": "ok", "sessions": len(sessions)}


@app.get("/api/speech-token")
async def speech_token():
    """Issue a short-lived Entra ID token for Azure Speech SDK (browser)."""
    region = os.getenv("AZURE_SPEECH_REGION", "eastus2")
    resource_id = os.getenv(
        "AZURE_SPEECH_RESOURCE_ID",
        "/subscriptions/b2c6bae2-ce72-40dc-a9da-977899a9febe/resourceGroups"
        "/RefreshSub/providers/Microsoft.CognitiveServices/accounts/MSFoundryLab",
    )
    try:
        from azure.identity import DefaultAzureCredential, InteractiveBrowserCredential, ChainedTokenCredential
        tenant_id = os.getenv("AZURE_TENANT_ID")
        interactive_kwargs = {"tenant_id": tenant_id} if tenant_id else {}
        credential = ChainedTokenCredential(
            DefaultAzureCredential(),
            InteractiveBrowserCredential(**interactive_kwargs),
        )
        token = await asyncio.to_thread(
            lambda: credential.get_token("https://cognitiveservices.azure.com/.default").token
        )
        # Speech SDK requires AAD tokens in format: aad#<ARM-resource-ID>#<token>
        aad_token = f"aad#{resource_id}#{token}"
        return JSONResponse({"token": aad_token, "region": region})
    except Exception as exc:
        logger.exception("Failed to get speech token")
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/export/{session_id}")
async def export_session(session_id: str):
    """Export session as Markdown meeting notes."""
    session = sessions.get(session_id)
    if session is None:
        return Response(
            content="Session not found", status_code=404,
            media_type="text/plain",
        )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = []
    lines.append(f"# 議事録 — {now}\n")

    # --- Summary ---
    lines.append("## 要約\n")
    if session.summary:
        lines.append(session.summary + "\n")
    else:
        lines.append("_（要約なし）_\n")

    # --- Transcript ---
    lines.append("## 文字起こし\n")
    if session.transcript_lines:
        for ln in session.transcript_lines:
            lines.append(f"- **{ln['speaker']}**: {ln['text']}")
        lines.append("")
    else:
        lines.append("_（文字起こしなし）_\n")

    # --- Q&A ---
    if session.questions:
        lines.append("## 質問 & 回答\n")
        for i, q in enumerate(session.questions, 1):
            lines.append(f"### Q{i}. {q}\n")
            ans = session.answers.get(q)
            if ans:
                lines.append(f"{ans['answer']}\n")
                if ans.get("citations"):
                    lines.append("**参考リンク:**\n")
                    for c in ans["citations"]:
                        title = c.get("title", c.get("url", "link"))
                        url = c.get("url", "")
                        lines.append(f"- [{title}]({url})")
                    lines.append("")
            else:
                lines.append("_（未回答）_\n")

    md_content = "\n".join(lines)

    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="meeting-notes-{session_id[:8]}.md"',
        },
    )
