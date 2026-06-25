import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Resolve the WebSocket URL for this session.
 *
 * Precedence:
 *   1. `VITE_WS_URL` env (e.g. `wss://api.example.com/ws`) — session id appended.
 *   2. Same-origin `/ws/{id}` so it works behind reverse proxies and the
 *      Vite dev proxy in `vite.config.ts`.
 */
function resolveWsUrl(sessionId: string): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/${sessionId}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/${sessionId}`;
}

export interface Citation {
  title: string;
  url: string;
}

export interface ServerQuestion {
  text: string;
  answer?: string | null;
  citations?: Citation[];
}

interface WebSocketHookOptions {
  onTranscriptAppend: (line: { speaker: string; text: string }) => void;
  onTranscriptSnapshot: (lines: { speaker: string; text: string }[]) => void;
  onSummaryUpdate: (summary: string) => void;
  onQuestionsUpdate: (questions: ServerQuestion[]) => void;
  onAnswerUpdate: (payload: {
    index: number;
    question: string;
    answer: string;
    citations: Citation[];
  }) => void;
  onTokenCount: (count: number) => void;
  onError?: (where: string, message: string) => void;
}

export function useWebSocket(options: WebSocketHookOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const sessionIdRef = useRef(crypto.randomUUID());
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const wsUrl = resolveWsUrl(sessionIdRef.current);

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) setIsConnected(true);
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setIsConnected(false);
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, so reconnect is handled there
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'transcript_append':
            optionsRef.current.onTranscriptAppend(data.line);
            break;
          case 'transcript_snapshot':
            optionsRef.current.onTranscriptSnapshot(data.lines);
            break;
          case 'summary_update':
            optionsRef.current.onSummaryUpdate(data.summary);
            break;
          case 'questions_update':
            optionsRef.current.onQuestionsUpdate(data.questions);
            break;
          case 'answer_update':
            optionsRef.current.onAnswerUpdate({
              index: data.index,
              question: data.question,
              answer: data.answer,
              citations: data.citations || [],
            });
            break;
          case 'token_count':
            optionsRef.current.onTokenCount(data.count);
            break;
          case 'error':
            optionsRef.current.onError?.(data.where, data.message);
            break;
        }
      };
    }

    function scheduleReconnect() {
      if (reconnectTimer.current) return;
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        if (mountedRef.current) connect();
      }, 2000);
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
    };
  }, []);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { sendMessage, isConnected, sessionId: sessionIdRef.current };
}
