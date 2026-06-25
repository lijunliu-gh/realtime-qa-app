import './ControlBar.css';

const LANGUAGES = [
  { code: 'ja-JP', label: '日本語' },
  { code: 'en-US', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
];

interface ControlBarProps {
  isRunning: boolean;
  isConnected: boolean;
  tokenCount: number;
  language: string;
  onLanguageChange: (lang: string) => void;
  onStart: () => void;
  onStop: () => void;
  onExport: () => void;
}

function ControlBar({
  isRunning,
  isConnected,
  tokenCount,
  language,
  onLanguageChange,
  onStart,
  onStop,
  onExport,
}: ControlBarProps) {
  return (
    <div className="control-bar">
      <div className="control-bar-left">
        <span className="app-label">RealtimeQA</span>

        {!isRunning ? (
          <button className="btn btn-start" onClick={onStart}>
            ▶ 開始
          </button>
        ) : (
          <button className="btn btn-stop" onClick={onStop}>
            ■ 停止
          </button>
        )}

        <button className="btn btn-export" onClick={onExport}>
          📄 エクスポート
        </button>
      </div>

      <div className="control-bar-center">
        <label className="control-info">
          🌐 言語:
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={isRunning}
            className="language-select"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="control-bar-right">
        <span className="token-count">トークン: {tokenCount}</span>
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">
          {isConnected ? '接続済' : '未接続'}
        </span>
      </div>
    </div>
  );
}

export default ControlBar;
