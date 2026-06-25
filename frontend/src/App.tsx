import { useState, useCallback } from 'react';
import ControlBar from './components/ControlBar';
import TranscriptionPanel from './components/TranscriptionPanel';
import SummaryPanel from './components/SummaryPanel';
import QAPanel from './components/QAPanel';
import { useWebSocket, type Citation } from './hooks/useWebSocket';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import './App.css';

export interface TranscriptLine {
  speaker: string;
  text: string;
}

export interface Question {
  id: number;
  text: string;
  answer?: string;
  citations?: Citation[];
  pending?: boolean;
}

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [language, setLanguage] = useState('ja-JP');

  const { sendMessage, isConnected, sessionId } = useWebSocket({
    onTranscriptAppend: (line) =>
      setTranscriptLines((prev) => [...prev, line]),
    onTranscriptSnapshot: (lines) => setTranscriptLines(lines),
    onSummaryUpdate: (s) => setSummary(s),
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
  });

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

  const { start, stop } = useSpeechRecognition({ onResult: handleTranscript, language });

  const handleStart = () => {
    setIsRunning(true);
    start();
  };

  const handleStop = () => {
    setIsRunning(false);
    stop();
  };

  const handleRequestQuestions = () => {
    sendMessage({ type: 'request_questions' });
  };

  const handleExport = () => {
    window.open(`/export/${sessionId}`, '_blank');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 業務効率化のためのアプリ開発</h1>
        <p className="subtitle">（例）リアルタイム技術 QA + 議事録作成 Web アプリ</p>
      </header>

      <ControlBar
        isRunning={isRunning}
        isConnected={isConnected}
        tokenCount={tokenCount}
        language={language}
        onLanguageChange={setLanguage}
        onStart={handleStart}
        onStop={handleStop}
        onExport={handleExport}
      />

      <main className="panels">
        <TranscriptionPanel lines={transcriptLines} />
        <SummaryPanel summary={summary} />
        <QAPanel
          questions={questions}
          onRequestQuestions={handleRequestQuestions}
        />
      </main>
    </div>
  );
}

export default App;
