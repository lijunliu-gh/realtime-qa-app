import type { Question } from '../App';
import './QAPanel.css';

interface QAPanelProps {
  questions: Question[];
  onRequestQuestions: () => void;
}

function QAPanel({ questions, onRequestQuestions }: QAPanelProps) {
  return (
    <div className="panel qa-panel-container">
      <div className="panel-header">
        ③ 質問内容抽出 + Microsoft Learn 回答
        <button className="btn-extract" onClick={onRequestQuestions}>
          🔍 抽出
        </button>
      </div>
      <div className="panel-content">
        {questions.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>
            会話から質問を抽出し、Microsoft Learn を検索して回答案を表示します...
          </p>
        )}
        {questions.map((q) => (
          <div key={q.id} className="question-item">
            <div className="question-row">
              <span className="question-badge">Q{q.id}</span>
              <span className="question-text">{q.text}</span>
            </div>
            {q.pending && (
              <div className="answer-pending">
                💭 Microsoft Learn を検索して回答を生成中...
              </div>
            )}
            {q.answer && (
              <div className="answer-block">
                <div className="answer-text">{q.answer}</div>
                {q.citations && q.citations.length > 0 && (
                  <ul className="citation-list">
                    {q.citations.map((c, i) => (
                      <li key={i}>
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          [{i + 1}] {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default QAPanel;
