export type UILocale = 'zh-CN' | 'ja-JP' | 'en-US';

export interface Messages {
  appTitle: string;
  appSubtitle: string;
  start: string;
  stop: string;
  export: string;
  extractQuestions: string;
  summary: string;
  qa: string;
  transcript: string;
  recording: string;
  idle: string;
  connected: string;
  disconnected: string;
  speechLang: string;
  uiLang: string;
  noSummary: string;
  noQuestions: string;
  tokens: string;
  showTranscript: string;
  hideTranscript: string;
  pending: string;
  citations: string;
}

const zh: Messages = {
  appTitle: 'RealtimeQA',
  appSubtitle: '实时会议 AI 助手',
  start: '开始',
  stop: '停止',
  export: '导出',
  extractQuestions: '提取问题',
  summary: '会议摘要',
  qa: '问答',
  transcript: '原始记录',
  recording: '录音中',
  idle: '待机',
  connected: '已连接',
  disconnected: '未连接',
  speechLang: '识别语言',
  uiLang: '界面语言',
  noSummary: '等待会议内容…',
  noQuestions: '点击「提取问题」获取 AI 生成的问题与解答',
  tokens: 'tokens',
  showTranscript: '展开原始记录',
  hideTranscript: '收起原始记录',
  pending: '生成中…',
  citations: '引用来源',
};

const ja: Messages = {
  appTitle: 'RealtimeQA',
  appSubtitle: 'リアルタイム会議AIアシスタント',
  start: '開始',
  stop: '停止',
  export: 'エクスポート',
  extractQuestions: '質問抽出',
  summary: '会議サマリー',
  qa: 'Q&A',
  transcript: '文字起こし',
  recording: '録音中',
  idle: '待機',
  connected: '接続済み',
  disconnected: '未接続',
  speechLang: '認識言語',
  uiLang: 'UI言語',
  noSummary: '会議の内容を待機中…',
  noQuestions: '「質問抽出」をクリックして AI 生成の Q&A を取得',
  tokens: 'トークン',
  showTranscript: '文字起こしを表示',
  hideTranscript: '文字起こしを非表示',
  pending: '生成中…',
  citations: '引用元',
};

const en: Messages = {
  appTitle: 'RealtimeQA',
  appSubtitle: 'Real-time Meeting AI Assistant',
  start: 'Start',
  stop: 'Stop',
  export: 'Export',
  extractQuestions: 'Extract Q&A',
  summary: 'Meeting Summary',
  qa: 'Q&A',
  transcript: 'Transcript',
  recording: 'Recording',
  idle: 'Idle',
  connected: 'Connected',
  disconnected: 'Disconnected',
  speechLang: 'Speech Language',
  uiLang: 'UI Language',
  noSummary: 'Waiting for meeting content…',
  noQuestions: 'Click "Extract Q&A" to get AI-generated questions & answers',
  tokens: 'tokens',
  showTranscript: 'Show Transcript',
  hideTranscript: 'Hide Transcript',
  pending: 'Generating…',
  citations: 'Sources',
};

const locales: Record<UILocale, Messages> = {
  'zh-CN': zh,
  'ja-JP': ja,
  'en-US': en,
};

export function getMessages(locale: UILocale): Messages {
  return locales[locale];
}
