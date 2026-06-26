/**
 * Teams Meeting Side Panel entry point.
 *
 * Tries Teams live captions first (real speaker names). If the caption API
 * is unavailable in this Teams client version, falls back to Azure Speech
 * SDK (same as standalone mode — uses microphone from the Side Panel).
 */
import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTeamsTranscript } from '../hooks/useTeamsTranscript';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getMessages, type UILocale } from '../i18n';
import type { TranscriptLine, Question } from '../App';
import '../App.css';

const SPEECH_LANGUAGES = [
  { code: 'ja-JP', label: '日本語' },
  { code: 'en-US', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
];

const UI_LANGUAGES: { code: UILocale; label: string }[] = [
  { code: 'zh-CN', label: '🇨🇳' },
  { code: 'ja-JP', label: '🇯🇵' },
  { code: 'en-US', label: '🇺🇸' },
];

export default function TeamsSidePanel() {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [uiLocale, setUiLocale] = useState<UILocale>('ja-JP');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [translatedSummary, setTranslatedSummary] = useState('');
  const [translateTarget, setTranslateTarget] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [language, setLanguage] = useState('ja-JP');

  const t = getMessages(uiLocale);

  const { sendMessage, isConnected } = useWebSocket({
    onTranscriptAppend: (line) =>
      setTranscriptLines((prev) => [...prev, line]),
    onTranscriptSnapshot: (lines) => setTranscriptLines(lines),
    onSummaryUpdate: (s) => { setSummary(s); setTranslatedSummary(''); },
    onSummaryTranslated: (translation) => { setTranslatedSummary(translation); setIsTranslating(false); },
    onQuestionsUpdate: (qs) =>
      setQuestions(
        qs.map((q, i) => ({
          id: i + 1,
          text: q.text,
          answer: q.answer || undefined,
          citations: q.citations || [],
          pending: !q.answer,
        }))
      ),
    onAnswerUpdate: ({ question, answer, citations }) =>
      setQuestions((prev) =>
        prev.map((q) =>
          q.text === question
            ? { ...q, answer, citations, pending: false }
            : q
        )
      ),
    onTokenCount: (count) => setTokenCount(count),
    onError: (where, message) => {
      console.error(`[server:${where}] ${message}`);
    },
    onConnected: (send) => {
      send({ type: 'set_language', language });
    },
  });

  // Teams live captions → WebSocket pipeline
  const handleTranscript = useCallback(
    (text: string, speaker?: string) => {
      sendMessage({
        type: 'transcript',
        speaker: speaker || '自分',
        text,
      });
    },
    [sendMessage]
  );

  // Try Teams caption API first
  const { error: teamsError } = useTeamsTranscript({
    onResult: handleTranscript,
    enabled: true,
  });

  // Fallback: use Speech SDK when Teams captions unavailable
  const useFallback = !!teamsError;
  const { start, stop } = useSpeechRecognition({
    onResult: handleTranscript,
    language,
  });

  const handleStart = () => { setIsRunning(true); start(); };
  const handleStop = () => { setIsRunning(false); stop(); };

  const handleRequestQuestions = () => {
    sendMessage({ type: 'request_questions' });
  };

  const handleTranslate = () => {
    if (!translateTarget || !summary) return;
    setIsTranslating(true);
    sendMessage({ type: 'request_translate', target: translateTarget });
  };

  return (
    <div className="app teams-sidepanel">
      {/* Compact header for side panel */}
      <header className="top-bar teams-compact">
        <div className="top-bar-left">
          <span className="brand">RealtimeQA</span>
          <span className={`connection-dot ${isConnected ? 'on' : 'off'}`} />
        </div>
        <div className="top-bar-center">
          {useFallback ? (
            /* Speech SDK fallback controls */
            !isRunning ? (
              <button className="btn-neo active" onClick={handleStart}>▶ {t.start}</button>
            ) : (
              <button className="btn-neo danger" onClick={handleStop}>■ {t.stop}</button>
            )
          ) : (
            <span className="btn-neo active" style={{ cursor: 'default' }}>🎤 Captions Active</span>
          )}
          <button className="btn-neo" onClick={handleRequestQuestions}>
            🔍 {t.extractQuestions}
          </button>
        </div>
        <div className="top-bar-right">
          <select
            className="select-neo select-sm"
            value={language}
            onChange={(e) => { setLanguage(e.target.value); sendMessage({ type: 'set_language', language: e.target.value }); }}
          >
            {SPEECH_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {UI_LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`btn-neo btn-sm${uiLocale === l.code ? ' active' : ''}`}
              onClick={() => setUiLocale(l.code)}
              style={{ padding: '2px 6px', fontSize: '0.9rem' }}
            >
              {l.label}
            </button>
          ))}
          <span className="token-badge">{tokenCount} {t.tokens}</span>
        </div>
      </header>

      {/* Status indicators */}
      {useFallback && (
        <div className="teams-error">🎤 Teams字幕API未対応 — Speech SDK（マイク）モードで動作中</div>
      )}

      {/* Main Content — same as standalone */}
      <main className="main-content">
        {/* Summary Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.summary}</span>
            <div className="translate-controls">
              <select
                className="select-neo select-sm"
                value={translateTarget}
                onChange={(e) => { setTranslateTarget(e.target.value); setTranslatedSummary(''); }}
              >
                <option value="">🌐 {t.translateTo}</option>
                {SPEECH_LANGUAGES.filter(l => l.code !== language).map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <button
                className="btn-neo btn-sm"
                onClick={handleTranslate}
                disabled={!translateTarget || !summary || isTranslating}
              >
                {isTranslating ? '⏳' : '🔄'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {!summary && <p className="summary-empty">{t.noSummary}</p>}
            {summary && (
              <div className="summary-text">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
            {translatedSummary && (
              <div className="summary-translation">
                <div className="translation-divider">― {SPEECH_LANGUAGES.find(l => l.code === translateTarget)?.label || translateTarget} ―</div>
                <div className="summary-text">
                  <ReactMarkdown>{translatedSummary}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Q&A Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.qa}</span>
          </div>
          <div className="card-body">
            {questions.length === 0 && <p className="qa-empty">{t.noQuestions}</p>}
            {questions.map((q) => (
              <details key={q.id} className="qa-item" open={q.pending || !q.answer}>
                <summary className="qa-question">
                  <span className="qa-badge">Q{q.id}</span>
                  <span className="qa-q-text">{q.text}</span>
                </summary>
                {q.pending && <div className="qa-pending">{t.pending}</div>}
                {q.answer && (
                  <div className="qa-answer">
                    <ReactMarkdown>{q.answer}</ReactMarkdown>
                  </div>
                )}
                {q.citations && q.citations.length > 0 && (
                  <ul className="qa-citations">
                    {q.citations.map((c, i) => (
                      <li key={i}>
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          [{i + 1}] {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        </div>
      </main>

      {/* Transcript Drawer */}
      <div className="transcript-drawer">
        <button
          className="transcript-toggle"
          onClick={() => setShowTranscript(!showTranscript)}
        >
          <span>
            {showTranscript ? t.hideTranscript : t.showTranscript} ({transcriptLines.length})
          </span>
          <span>{showTranscript ? '▼' : '▲'}</span>
        </button>
        {showTranscript && (
          <div className="transcript-content">
            {transcriptLines.slice(-200).map((line, i) => (
              <div key={i} className="transcript-line">
                <span className="speaker-tag">[{line.speaker}]</span> {line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
