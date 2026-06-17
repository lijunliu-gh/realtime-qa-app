import { useEffect, useMemo, useRef } from 'react';
import type { TranscriptLine } from '../App';

interface TranscriptionPanelProps {
  lines: TranscriptLine[];
}

// Cap the number of DOM nodes for very long meetings.
const MAX_VISIBLE_LINES = 200;

function TranscriptionPanel({ lines }: TranscriptionPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { visible, hiddenCount } = useMemo(() => {
    if (lines.length <= MAX_VISIBLE_LINES) {
      return { visible: lines, hiddenCount: 0 };
    }
    return {
      visible: lines.slice(-MAX_VISIBLE_LINES),
      hiddenCount: lines.length - MAX_VISIBLE_LINES,
    };
  }, [lines]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible.length]);

  return (
    <div className="panel">
      <div className="panel-header">① 文字起こし</div>
      <div className="panel-content">
        {lines.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>
            「開始」を押すと文字起こしが始まります...
          </p>
        )}
        {hiddenCount > 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>
            ... 早期 {hiddenCount} 行を省略
          </p>
        )}
        {visible.map((line, i) => (
          <div key={hiddenCount + i} className="transcript-line">
            <span className="speaker-tag">[{line.speaker}]</span>{' '}
            <span>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default TranscriptionPanel;
