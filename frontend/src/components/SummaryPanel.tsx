interface SummaryPanelProps {
  summary: string;
}

function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">② 会話の要約</div>
      <div className="panel-content">
        {!summary && (
          <p style={{ color: 'var(--text-secondary)' }}>
            会話が進むと自動で要約が生成されます...
          </p>
        )}
        {summary && (
          <div className="summary-content">
            {summary.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SummaryPanel;
