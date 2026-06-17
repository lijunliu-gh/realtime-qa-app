import os
import json
import asyncio
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from services.summarizer import SummarizerService
from services.mcp_client import LearnMcpClient

load_dotenv()

logger = logging.getLogger("realtime_qa")
logging.basicConfig(level=logging.INFO)

# Debounce / batching knobs for summarization.
SUMMARY_IDLE_SECONDS = float(os.getenv("SUMMARY_IDLE_SECONDS", "8"))
SUMMARY_MAX_PENDING_LINES = int(os.getenv("SUMMARY_MAX_PENDING_LINES", "8"))
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

    transcript_text = "\n".join(
        f"[{l['speaker']}] {l['text']}" for l in session.transcript_lines
    )

    try:
        questions, used = await summarizer.extract_questions(transcript_text)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Question extraction failed")
        await _send_error(websocket, str(exc), "extract_questions")
        return

    session.questions = questions
    # Build response payload including any answers we've already produced.
    questions_payload = [
        {
            "text": q,
            "answer": session.answers.get(q, {}).get("answer"),
            "citations": session.answers.get(q, {}).get("citations", []),
        }
        for q in questions
    ]
    await _safe_send(websocket, {
        "type": "questions_update",
        "questions": questions_payload,
    })
    await _broadcast_tokens(websocket, session, used)

    # Kick off answer pipeline for any new question we haven't answered yet.
    for idx, q in enumerate(questions):
        if q in session.answers or q in session.in_flight_answers:
            continue
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
