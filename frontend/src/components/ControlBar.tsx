import './ControlBar.css';

interface ControlBarProps {
  isRunning: boolean;
  isConnected: boolean;
  tokenCount: number;
  onStart: () => void;
  onStop: () => void;
}

function ControlBar({
  isRunning,
  isConnected,
  tokenCount,
  onStart,
  onStop,
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
      </div>

      <div className="control-bar-center">
        <span className="control-info">🎤 マイク: Default</span>
        <span className="control-info">🔊 スピーカー: Default</span>
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
