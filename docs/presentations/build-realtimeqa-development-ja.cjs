// Requires pptxgenjs. PPTX_TOOLS_ROOT can point to an external node_modules directory.
const path = require('path');
const fs = require('fs');
const PptxGenJS = process.env.PPTX_TOOLS_ROOT
  ? require(path.join(process.env.PPTX_TOOLS_ROOT, 'pptxgenjs'))
  : require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Lijun Liu';
pptx.company = 'RealtimeQA';
pptx.title = 'RealtimeQA は、こうつくる。 | 技術実装と GitHub Copilot 活用';
pptx.subject = '要件分解から音声・WebSocket・差分要約・MCP・デバッグまでの実装プロセス';
pptx.lang = 'ja-JP';
pptx.theme = { headFontFace: 'Yu Gothic', bodyFontFace: 'Meiryo', lang: 'ja-JP' };
const C = {
  ink: '17211D', dark: '111816', paper: 'F4F6F1', white: 'FFFFFF',
  muted: '57665D', lime: 'BEF264', green: '356B46', soft: 'E7EFDF',
  purple: '7550B5', lilac: 'EFE9F8', border: 'DCE3D7', slate: '263B31',
  gray: 'B7C6BA', amber: '9B5B0E', warm: 'FFF0D9',
};
const S = pptx.ShapeType;
const root = 'https://github.com/lijunliu-gh/realtime-qa-app';
const ref = name => `${root}/blob/4d22a09/${name}`;
const files = {
  main: ref('backend/main.py'), speech: ref('frontend/src/hooks/useSpeechRecognition.ts'),
  ws: ref('frontend/src/hooks/useWebSocket.ts'), llm: ref('backend/services/summarizer.py'),
  mcp: ref('backend/services/mcp_client.py'), app: ref('frontend/src/App.tsx'),
  teams: ref('frontend/src/hooks/useTeamsTranscript.ts'), vite: ref('frontend/vite.config.ts'),
  auth: ref('backend/services/auth.py'), readme: ref('README.ja.md'),
  copilot: 'https://code.visualstudio.com/docs/agents/overview',
};
let pageNumber = 0;
const bounds = [];
function check(x, y, w, h, label) {
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 ||
      w < 0 || h < 0 || x + w > 13.345 || y + h > 7.51) {
    bounds.push(`${pageNumber}: ${label} ${[x, y, w, h]}`);
  }
}
function text(s, value, x, y, w, h, size = 16, color = C.ink, options = {}) {
  check(x, y, w, h, String(value).slice(0, 45));
  s.addText(value, {
    x, y, w, h, fontFace: 'Meiryo', fontSize: size, color,
    margin: 0, valign: 'mid', paraSpaceAfterPt: 0, ...options,
  });
}
function box(s, x, y, w, h, fill = C.white, border = fill) {
  check(x, y, w, h, 'box');
  s.addShape(S.roundRect, { x, y, w, h, radius: 0.12, rectRadius: 0.12,
    fill: { color: fill }, line: { color: border, width: 1 } });
}
function arrow(s, x1, y1, x2, y2, color = C.green, head = true, dashed = false) {
  s.addShape(S.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color, width: 1.8, ...(head ? { endArrowType: 'triangle' } : {}),
      ...(dashed ? { dashType: 'dash' } : {}) },
  });
}
function tag(s, value, x, y, w, fill = C.soft, color = C.green) {
  box(s, x, y, w, 0.35, fill);
  text(s, value, x + 0.1, y, w - 0.2, 0.35, 10.5, color, { bold: true, align: 'center' });
}
function label(s, value, x, y, w, color = C.green) {
  text(s, value, x, y, w, 0.36, 14, color, { bold: true });
}
function code(s, title, value, x, y, w, h, size = 14) {
  const compact = h < 2.5;
  box(s, x, y, w, h, C.dark);
  text(s, title, x + 0.25, y + (compact ? 0.14 : 0.18), w - 0.5, 0.32, 11.5, C.gray);
  text(s, value, x + 0.25, y + (compact ? 0.58 : 0.76), w - 0.5, h - (compact ? 0.73 : 0.95), size, C.lime, {
    fontFace: 'Consolas', valign: 'top', breakLine: false,
  });
}
function mini(s, title, body, x, y, w, h, fill = C.white, titleSize = 20, bodySize = 15) {
  const short = h <= 1.15;
  box(s, x, y, w, h, fill);
  text(s, title, x + 0.22, y + (short ? 0.08 : 0.16), w - 0.44, short ? 0.34 : 0.5, titleSize, C.ink, { bold: true });
  text(s, body, x + 0.22, y + (short ? 0.55 : 0.84), w - 0.44, h - (short ? 0.65 : 1.0), bodySize, C.muted, { valign: 'top' });
}
function prompt(s, value) {
  box(s, 0.65, 6.12, 12.03, 0.66, C.lilac);
  text(s, 'Copilot への指示例（再現）', 0.86, 6.23, 2.85, 0.43, 12.5, C.purple, { bold: true });
  text(s, value, 3.9, 6.2, 8.53, 0.5, 13, C.ink);
}
function slide(stage, title, subtitle, source, dark = false) {
  const s = pptx.addSlide();
  pageNumber += 1;
  s.background = { color: dark ? C.dark : C.paper };
  text(s, stage, 0.6, 0.38, 12.0, 0.3, 10.5, dark ? C.lime : C.green, { bold: true, charSpacing: 1.3 });
  if (title) text(s, title, 0.6, 0.99, 12.1, 0.74, 32, dark ? C.white : C.ink, { bold: true, fontFace: 'Yu Gothic' });
  if (subtitle) text(s, subtitle, 0.6, 1.8, 12.0, 0.47, 14.5, dark ? C.gray : C.muted);
  text(s, 'RealtimeQA  /  TECHNICAL BUILD STORY', 0.6, 7.05, 4.9, 0.22, 9, dark ? C.gray : C.muted);
  text(s, source || '', 5.6, 7.02, 6.4, 0.28, 9, dark ? C.gray : C.muted, { align: 'right' });
  text(s, String(pageNumber).padStart(2, '0'), 12.25, 7.0, 0.45, 0.3, 11, dark ? C.lime : C.green, { bold: true, align: 'right' });
  return s;
}
function notes(s, script, references = []) {
  s.addNotes(`${script}\n\n【根拠・出典】\n${references.join('\n')}\n\n【説明上の区別】\n構成と処理はコミット 4d22a09 および作成時のローカルコードに基づきます。スライドの順番は実装を理解するための順序であり、開発当日の全操作を時系列に復元したものではありません。Copilot への指示例は再現例で、実際の会話ログの引用ではありません。コードは明記した範囲の抜粋または簡略表記です。工数削減率や精度の測定値は主張していません。\n資料作成日：2026年10月16日。`);
}

// 01: Process, not product positioning.
{
  const s = slide('DEVELOPMENT RETROSPECTIVE  /  JAPANESE EDITION', '', '', '', true);
  tag(s, 'RealtimeQA × GitHub Copilot', 0.65, 1.0, 3.8, C.slate, C.lime);
  text(s, '会議 AI アプリは、\nこうつくる。', 0.65, 1.82, 8.7, 1.85, 46, C.white, { bold: true, fontFace: 'Yu Gothic' });
  text(s, '要件分解から、音声・WebSocket・要約・MCP まで。\n実際のコードを手がかりに、実装の手順をたどる。', 0.7, 4.0, 11.8, 0.96, 21, C.gray);
  text(s, '一つの接続を動かし、次へ進む。Copilot と進める開発の実践。', 0.7, 6.12, 11.8, 0.48, 19, C.lime, { bold: true });
  box(s, 9.7, 1.55, 2.95, 2.9, C.slate);
  ['要件 → 構成', '入力 → 通信', '検索 → 生成', '検証 → 改善'].forEach((v, i) => {
    text(s, v, 10.0, 1.92 + i * 0.54, 2.38, 0.36, 16, i === 3 ? C.lime : C.white, { bold: true });
  });
  notes(s, '今回はアプリの機能紹介ではなく、どのように実装を組み立てるかに焦点を当てます。実装の説明順は、要件、土台、責務分離、音声、通信、要約、質問抽出、検索、回答、画面、拡張、デバッグ、検証です。Copilot が実装の調査や変更を支援する場面を、それぞれのステップの指示例で示します。会話ログを確認できていないため、実際に入力したプロンプトだとは説明しません。', [files.readme, files.copilot]);
}

// 02
{
  const s = slide('BUILD 01  /  DEFINE THE CONTRACT', '最初に「入出力」と「最小ゴール」を決める', '大きなアプリを一度に頼まず、まず一つの会話が画面に届くところまで。', '根拠：App.tsx / main.py ／ 進め方は実装から構成');
  const rows = [
    ['入力', 'マイク音声 → 文字列 + 話者', 'transcript'],
    ['処理', '会話の蓄積 → 要約 → 質問と回答', 'summary / questions'],
    ['出力', '画面表示 + 参照リンク + Markdown', 'answer / citations'],
  ];
  rows.forEach(([title, body, type], i) => {
    const y = 2.57 + i * 0.98;
    box(s, 0.65, y, 7.35, 0.78);
    text(s, title, 0.9, y + 0.14, 0.95, 0.44, 18, C.green, { bold: true });
    text(s, body, 2.0, y + 0.08, 5.7, 0.35, 16);
    text(s, type, 2.0, y + 0.46, 5.7, 0.22, 11, C.muted, { fontFace: 'Consolas' });
  });
  box(s, 8.42, 2.57, 4.26, 2.98, C.soft);
  text(s, '最小ゴール', 8.7, 2.87, 3.7, 0.5, 23, C.green, { bold: true });
  text(s, '① 1 行の文字起こしが届く\n② 要約が更新される\n③ 1 問を検索して回答する', 8.7, 3.76, 3.7, 1.23, 17, C.ink, { valign: 'top' });
  prompt(s, '日本語の会話を要約し、出典付き Q&A を表示したい。\nまず最小構成と、機能を追加する順番を提案して。');
  notes(s, '最初に入力、処理、出力を言葉とデータに分けます。音声をいきなり AI に全部任せるのではなく、音声から文字列を得て、文字列をサーバーに送り、要約と Q&A を返す単位に分解します。最初の完了条件は、1行の文字起こしが画面に届くことです。その後、要約、1問の文書検索と回答へ広げると、問題が起きた接続点を特定しやすくなります。この順番は実装を説明するための推奨ルートです。', [files.app, files.main]);
}

// 03
{
  const s = slide('BUILD 02  /  SCAFFOLD THE APP', 'React と FastAPI の土台をつくる', '画面と API を分け、開発時は Vite のプロキシで同じ URL から接続する。', '根拠：README.ja.md / frontend/vite.config.ts');
  code(s, '主要ファイル（抜粋）', [
    'frontend/', '  src/App.tsx', '  src/hooks/', '  vite.config.ts', '',
    'backend/', '  main.py', '  services/summarizer.py', '  services/mcp_client.py', '  services/auth.py',
  ].join('\n'), 0.65, 2.55, 5.25, 3.2, 13);
  label(s, '開発時の接続', 6.35, 2.6, 6.05);
  mini(s, 'Vite :5173', 'React の画面を表示', 6.35, 3.18, 2.64, 1.35, C.white, 19, 13);
  mini(s, 'FastAPI :8000', 'API と WebSocket', 10.04, 3.18, 2.64, 1.35, C.soft, 17, 13);
  arrow(s, 9.1, 3.85, 9.94, 3.85);
  text(s, '/ws   /api   /export', 6.35, 4.86, 6.05, 0.36, 17, C.green, { fontFace: 'Consolas', bold: true });
  text(s, '既存環境を設定後：.\\start-dev.ps1 で両方を起動', 6.35, 5.37, 6.05, 0.32, 12.5, C.muted);
  prompt(s, 'React + TypeScript と FastAPI を分離して構成して。\n/ws・/api・/export を Vite からバックエンドへ転送して。');
  notes(s, 'フロントエンドは React、TypeScript、Vite、バックエンドは Python の FastAPI です。Vite は画面を5173番で配信し、/ws、/api、/export をバックエンド8000番へ転送します。WebSocket のプロキシでは ws:true を設定しています。初回は README に沿って Python 仮想環境と依存関係、Node の依存関係、サービス接続設定を用意します。start-dev.ps1 はその後の同時起動を補助します。ブラウザーにクラウドの長期キーを埋め込む構成にはしません。', [files.readme, files.vite, ref('start-dev.ps1')]);
}

// 04
{
  const s = slide('BUILD 03  /  SEPARATE RESPONSIBILITIES', 'つなぐ前に、責務とデータ経路を分ける', '音声は Speech へ。文字起こし以降の処理は FastAPI で制御する。', '根拠：useSpeechRecognition.ts / main.py / services');
  mini(s, 'ブラウザー / React', 'マイク・表示・UI 状態\nSpeech SDK / WebSocket', 0.65, 2.67, 3.2, 1.65, C.white, 20, 14);
  mini(s, 'Azure Speech', '音声 → 文字列・話者', 9.05, 2.67, 3.63, 1.15, C.soft, 20, 13);
  arrow(s, 3.95, 3.22, 8.95, 3.22);
  text(s, '音声ストリーム', 4.8, 2.76, 3.35, 0.32, 13, C.green, { align: 'center' });
  text(s, '認識結果は SDK に返る', 4.52, 3.54, 3.9, 0.32, 12.5, C.muted, { align: 'center' });
  mini(s, 'FastAPI / main.py', 'セッション・要約・Q&A\n各サービスを呼び出す', 4.55, 4.65, 3.5, 1.67, C.soft, 20, 14);
  mini(s, 'Foundry / モデル', '要約・質問抽出・回答', 9.05, 4.12, 3.63, 1.15, C.lilac, 18, 12.5);
  mini(s, 'MCP / 文書検索', 'Learn + 追加の検索先', 9.05, 5.57, 3.63, 1.15, C.lilac, 18, 12.5);
  arrow(s, 2.25, 4.4, 2.25, 5.48, C.green, false);
  arrow(s, 2.25, 5.48, 4.43, 5.48);
  text(s, '文字列と制御メッセージ', 0.75, 5.88, 3.35, 0.36, 11.5, C.muted);
  text(s, 'WebSocket', 2.52, 5.04, 1.8, 0.3, 12.5, C.green);
  arrow(s, 8.17, 5.08, 8.58, 5.08, C.purple, false);
  arrow(s, 8.58, 5.08, 8.58, 4.7, C.purple, false);
  arrow(s, 8.58, 4.7, 8.95, 4.7, C.purple);
  arrow(s, 8.17, 5.87, 8.6, 5.87, C.purple, false);
  arrow(s, 8.6, 5.87, 8.6, 6.15, C.purple, false);
  arrow(s, 8.6, 6.15, 8.95, 6.15, C.purple);
  text(s, '矢印は主な送信・呼び出し方向。API 応答やトークン取得の経路は一部省略。', 0.85, 6.55, 7.6, 0.32, 11.5, C.muted);
  notes(s, 'この図では戻りの応答を省略し、主な送信方向を示しています。音声認識はブラウザーの SDK と Azure Speech が担います。認識結果のテキストと話者ラベルがブラウザーへ戻り、FastAPI へ WebSocket で送られます。FastAPI は会話を蓄積し、SummarizerService と SearchAggregator を呼び出します。Speech 用短時間トークンはバックエンドから取得しますが、図では省略しています。検索は MCP サーバーへの問い合わせであり、この構成に独自ベクトル DB は必須ではありません。', [files.speech, files.ws, files.main, files.mcp, files.llm]);
}

// 05
{
  const s = slide('BUILD 04  /  CONNECT THE MICROPHONE', 'マイク入力を Speech SDK に接続する', '短時間トークンを取得し、確定した認識結果を共通コールバックへ渡す。', '根拠：useSpeechRecognition.ts / main.py');
  code(s, 'SDK 初期化の要点（実装を簡略表記）', [
    'const cfg =', '  SpeechSDK.SpeechConfig', '    .fromAuthorizationToken(token, region);',
    "cfg.speechRecognitionLanguage = 'ja-JP';", '',
    'const audio = SpeechSDK.AudioConfig', '  .fromDefaultMicrophoneInput();',
    'const transcriber =', '  new SpeechSDK.ConversationTranscriber(', '    cfg, audio);',
  ].join('\n'), 0.65, 2.55, 6.1, 3.2, 13);
  const items = [
    ['01', 'GET /api/speech-token', '{ token, region } を受け取る'],
    ['02', 'ConversationTranscriber', 'マイクから音声を送信する'],
    ['03', 'transcribed イベント', '確定テキストと speakerId を取得'],
  ];
  items.forEach(([n, title, body], i) => {
    const y = 2.6 + i * 0.87;
    tag(s, n, 7.15, y, 0.55);
    text(s, title, 7.92, y - 0.01, 4.4, 0.4, 16, C.ink, { bold: true });
    text(s, body, 7.92, y + 0.44, 4.45, 0.3, 12.5, C.muted);
  });
  text(s, '認証はサーバー側で Entra ID / API キーを選択。\nSpeech の長期キーではなく短時間トークンを返す。', 7.15, 5.26, 5.35, 0.52, 12.5, C.green);
  prompt(s, '認識結果を onResult(text, speaker) で返すフックにして。\nSpeech キーは埋め込まず、サーバーでトークンを発行して。');
  notes(s, 'useSpeechRecognition は GET /api/speech-token で token と region を取得します。SpeechConfig を作り、認識言語を設定し、マイク入力の ConversationTranscriber を初期化します。transcribed イベントのうち RecognizedSpeech でテキストが空でないものを onResult へ渡します。コード欄は説明のため変数名と書式を簡略化しています。Speech キー方式ではバックエンドで STS トークンに交換します。Entra ID 方式では aad#<resource-id>#<token> 形式を生成します。サービスごとの明示設定、全体設定、キー有無による自動判定の順に認証モードを解決します。マイク権限と話者識別の品質は実機で確認します。', [files.speech, files.main, files.auth]);
}

// 06
{
  const s = slide('BUILD 05  /  DEFINE THE WEBSOCKET PROTOCOL', '文字起こしを WebSocket で同期する', 'イベント名とデータ形式を先に決め、画面とバックエンドを同じ契約で実装する。', '根拠：useWebSocket.ts / main.py');
  code(s, 'Client → Server / メッセージ例', [
    '{', '  "type": "transcript",', '  "speaker": "Guest1",',
    '  "text": "日本語を認識できますか？"', '}', '',
    'ws://localhost:5173/ws/{session_id}',
  ].join('\n'), 0.65, 2.55, 5.75, 3.2, 14);
  label(s, 'Server → Client / type で振り分ける', 6.85, 2.58, 5.55);
  [
    ['transcript_append', '会話を 1 行追加'],
    ['summary_update', '要約を置き換え'],
    ['questions_update', '質問一覧を更新'],
    ['answer_update', '質問ごとの回答と引用'],
  ].forEach(([type, body], i) => {
    const y = 3.15 + i * 0.57;
    text(s, type, 6.85, y, 3.0, 0.31, 14, C.green, { fontFace: 'Consolas', bold: true });
    text(s, body, 10.0, y, 2.6, 0.32, 12.5, C.muted);
  });
  text(s, '接続時には set_language。切断後は同じ ID で再接続。', 6.85, 5.54, 5.7, 0.3, 11.8, C.muted);
  prompt(s, 'type で判別する JSON メッセージ契約をそろえて。\nuseWebSocket と FastAPI の送受信を同時に実装して。');
  notes(s, 'App の handleTranscript は transcript 型のメッセージを sendMessage に渡します。FastAPI の /ws/{session_id} がセッションを選び、文字列を蓄積して transcript_append を返します。クライアントの onmessage は data.type を見て、それぞれの更新コールバックを実行します。set_language は接続のたびに送ります。例の WebSocket URL は開発時の Vite を経由したもので、本番では HTTPS に合わせ wss を使うなど配置環境に応じて解決されます。通信エラーはログと各状態を確認して切り分けます。', [files.ws, files.main, files.app, files.vite]);
}

// 07
{
  const s = slide('BUILD 06  /  INCREMENTAL SUMMARY', '要約を「差分 + 待ち合わせ」で更新する', '全文を毎回送り直さず、前回の要約に新しい会話を統合する。', '根拠：main.py / summarizer.py');
  tag(s, '処理済み', 0.65, 2.58, 2.4);
  tag(s, '未処理の会話', 3.3, 2.58, 2.85, C.lilac, C.purple);
  for (let i = 0; i < 11; i++) {
    box(s, 0.65 + i * 0.5, 3.15, 0.39, 0.6, i < 5 ? C.soft : C.lilac);
  }
  text(s, 'summary_cursor：次の未処理位置', 0.8, 3.98, 5.42, 0.35, 13.5, C.green, { bold: true });
  arrow(s, 3.15, 3.89, 3.15, 3.72);
  text(s, '既存要約 + 新しい会話\n→ update_summary()\n→ summary_update', 0.8, 4.61, 5.42, 0.95, 18, C.ink, { bold: true });
  code(s, '差分の切り出し（main.py 抜粋）', [
    'end = len(session.transcript_lines)', 'start = session.summary_cursor',
    'new_lines = session.transcript_lines[start:end]', '',
    'session.summary = summary', 'session.summary_cursor = end',
  ].join('\n'), 6.65, 2.55, 6.03, 2.15, 13);
  box(s, 6.65, 5.0, 6.03, 0.75, C.soft);
  text(s, '開始条件：無発言 15 秒 または 未処理 40 行\n同一セッションの要約呼び出しを Lock で直列化', 6.9, 5.1, 5.53, 0.53, 13.5, C.green);
  prompt(s, '既存要約と未処理の会話だけで要約を更新して。\n無発言 15 秒か 40 行で実行し、二重呼び出しを抑えて。');
  notes(s, 'main.py は summary_cursor から現在末尾までを差分として切り出します。SummarizerService.update_summary に previous_summary と new_transcript を渡し、結果が返ってから summary と cursor を更新します。コード欄は切り出しと更新の実装行を抜粋しており、その間のモデル呼び出しは省略しています。新しい行が届くたび待ちタイマーを再設定し、無発言15秒または未処理40行で実行します。セッションごとの asyncio.Lock で要約呼び出しを直列化します。これは性能保証ではなく初期設定であり、処理待ちやモデル応答時間が加わります。会話履歴は既定500行で切り詰め、カーソルも調整します。', [files.main, files.llm]);
}

// 08
{
  const s = slide('BUILD 07  /  EXTRACT QUESTIONS', '質問抽出も、未処理部分だけに絞る', '操作を起点に新しい会話を処理し、質問一覧の表示と回答処理を分ける。', '根拠：main.py / SummarizerService.extract_questions');
  const steps = [
    ['request_questions', '抽出ボタンから要求'],
    ['questions_cursor', '未処理の会話だけ取得'],
    ['questions_update', '質問を先に画面へ返す'],
  ];
  steps.forEach(([title, body], i) => {
    const x = 0.65 + i * 4.13;
    mini(s, title, body, x, 2.58, 3.76, 1.5, i === 1 ? C.soft : C.white, 16, 14);
    if (i < 2) arrow(s, x + 3.84, 3.29, x + 4.05, 3.29);
  });
  code(s, 'モデルからの抽出結果（形式例）', '{"questions":["質問の例"]}\nresponse_format={"type":"json_object"}', 0.65, 4.43, 6.0, 1.32, 12.5);
  text(s, '既存の質問と会議要約も入力に含める。\n回答済み / 処理中の質問は再実行を抑制。\n新しい質問ごとに非同期の回答処理を起動。', 7.1, 4.46, 5.4, 1.15, 15.5, C.ink);
  prompt(s, '前回の位置以降から質問を抽出し、JSON で返して。\n既存質問も渡し、質問一覧を先に表示してから回答を生成して。');
  notes(s, 'questions_cursor を要約とは別に持ち、質問抽出の未処理範囲を管理します。モデルには新しい会話、既存の質問、会議要約を渡し、JSON object 形式を指定します。質問を取得したら cursor と質問一覧を更新し、questions_update を画面へ送ります。その後、新しい質問ごとに asyncio.create_task で回答処理を起動します。回答済みまたは in_flight_answers に含まれる質問は再実行を抑えます。ただし意味的に同じ質問の完全な重複排除を保証する仕組みではなく、既存質問との重複を避ける部分にはモデルへの指示が含まれます。', [files.main, files.llm, files.app]);
}

// 09
{
  const s = slide('BUILD 08  /  RETRIEVE DOCUMENTS WITH MCP', 'MCP 検索を並列化して、回答の資料を集める', '検索先ごとの接続を隠し、SearchAggregator から一つの検索として呼び出す。', '根拠：mcp_client.py / SearchAggregator');
  mini(s, '質問', 'search(question)', 0.65, 3.35, 2.2, 1.4, C.white, 22, 13);
  mini(s, 'Microsoft Learn', '既定の MCP 検索先', 4.2, 2.62, 3.65, 1.37, C.lilac, 19, 13);
  mini(s, '追加 MCP 検索先', 'MCP_SERVERS 設定時', 4.2, 4.22, 3.65, 1.37, C.lilac, 19, 13);
  arrow(s, 2.95, 4.03, 3.6, 4.03, C.purple, false);
  arrow(s, 3.6, 4.03, 3.6, 3.29, C.purple, false);
  arrow(s, 3.6, 3.29, 4.1, 3.29, C.purple);
  arrow(s, 3.6, 4.03, 3.6, 4.89, C.purple, false);
  arrow(s, 3.6, 4.89, 4.1, 4.89, C.purple);
  mini(s, '結果を統合', 'URL で重複を排除\n検索先を交互に取り込む\n既定で最大 5 件を利用', 9.2, 2.92, 3.48, 2.62, C.soft, 21, 15);
  arrow(s, 7.95, 3.29, 8.55, 3.29, C.purple, false);
  arrow(s, 8.55, 3.29, 8.55, 4.23, C.purple, false);
  arrow(s, 7.95, 4.89, 8.55, 4.89, C.purple, false);
  arrow(s, 8.55, 4.89, 8.55, 4.23, C.purple, false);
  arrow(s, 8.55, 4.23, 9.1, 4.23, C.purple);
  text(s, 'asyncio.gather(...) で検索先を並列に呼び出す', 0.85, 5.69, 11.7, 0.28, 12, C.muted);
  prompt(s, '複数の MCP 検索先を並列に呼び、URL の重複を除いて。\n一つの検索先だけが引用候補を占めないように統合して。');
  notes(s, 'McpSearchProvider は streamable HTTP の MCP 接続を開き、公開されている検索ツールを選びます。接続は FastAPI の lifespan で開始し、アプリ終了時に閉じます。SearchAggregator は複数の provider を asyncio.gather で並列に検索し、_merge_round_robin で交互に結果を統合します。URL がある場合はそれを重複排除キーにし、URL がない場合はタイトルと内容の一部を使います。Microsoft Learn は既定で含み、MCP_SERVERS で追加できます。追加先には検索ツールと応答形式の互換性確認が必要です。接続または検索に失敗した provider はログに記録され、残りの結果が使われます。独自ベクトル DB を構築する説明ではありません。', [files.mcp, files.main]);
}

// 10
{
  const s = slide('BUILD 09  /  GENERATE ANSWERS WITH CONTEXT', '資料・質問・会議要約を、モデルへ渡す', '「検索」と「回答生成」を分離し、回答本文と引用リンクを別のデータとして返す。', '根拠：summarizer.py / main.py');
  [
    ['会議要約', '質問の背景を補う', C.white],
    ['質問', '答える対象を明示', C.white],
    ['検索資料', '番号・URL・本文', C.lilac],
  ].forEach(([title, body, fill], i) => mini(s, title, body, 0.65, 2.58 + i * 1.02, 3.0, 0.88, fill, 16, 12));
  text(s, '各資料の本文は 1,500 文字で制限', 0.78, 5.65, 3.0, 0.32, 10.8, C.muted);
  [3.02, 4.04, 5.06].forEach(y => arrow(s, 3.75, y, 3.96, y, C.purple, false));
  arrow(s, 3.96, 3.02, 3.96, 5.06, C.purple, false);
  arrow(s, 3.96, 4.03, 4.35, 4.03, C.purple);
  mini(s, 'answer_with_context()', '資料優先で回答を生成\n本文には [1] [2] で参照\n資料にない点は明記する指示', 4.45, 2.95, 3.4, 2.62, C.soft, 16.5, 16);
  arrow(s, 7.97, 4.03, 8.51, 4.03, C.purple);
  code(s, 'answer_update（項目を抜粋）', [
    '{', '  "type": "answer_update",', '  "question": "...",', '  "answer": "... [1]",',
    '  "citations": [', '    {', '      "title": "...",', '      "url": "..."', '    }', '  ]', '}',
  ].join('\n'), 8.61, 2.45, 4.07, 3.35, 13);
  prompt(s, '資料を優先して回答し、本文の参照番号と引用リンクを返して。\n検索結果がないケースと、資料に答えがないケースも扱って。');
  notes(s, '検索したスニペットは番号、URL、本文を含む文字列にまとめ、1件の本文を1500文字に制限します。会議要約と質問を追加して chat.completions に渡します。デプロイ名は設定で選ぶため、特定のモデル名に固定した構成とは説明しません。現在の実装では citations はモデルが実際に使った資料を後から解析するのではなく、渡したスニペットのうち URL がある資料一覧を返します。従って引用の正しさは自動保証されません。検索結果なしでも引用なしの生成が続くことがあり、結果表示と原文確認を別途検証します。コード欄の ... は省略記号・表示例です。', [files.llm, files.main]);
}

// 11
{
  const s = slide('BUILD 10  /  CONNECT STATE AND OUTPUT', '応答を UI 状態へ反映し、議事録として出力する', 'React の state 更新 → Markdown 表示 → バックアップとエクスポート。', '画面：ローカル UI ／ 表示内容は説明用サンプル');
  const imagePath = path.join(__dirname, 'assets', 'app-ja-sample.png');
  const png = fs.readFileSync(imagePath);
  const imageHeight = 9.0 * png.readUInt32BE(20) / png.readUInt32BE(16);
  if (imageHeight > 2.7) throw new Error('Slide 11 screenshot is too tall.');
  box(s, 0.65, 2.4, 9.0, 0.35, C.lilac);
  text(s, '実画面（表示内容は説明用サンプル）', 0.88, 2.42, 8.54, 0.3, 12.5, C.purple, { bold: true });
  box(s, 0.6, 2.8, 9.1, imageHeight + 0.1, C.white, C.border);
  s.addImage({ path: imagePath, x: 0.65, y: 2.85, w: 9.0, h: imageHeight,
    altText: '要約と Q&A の実装画面。文字列と参照先は説明用サンプル。' });
  label(s, '受信 → state 更新', 10.0, 2.58, 2.6);
  text(s, 'onSummaryUpdate\n→ setSummary\n\nonAnswerUpdate\n→ questions 更新\n\nReactMarkdown 表示', 10.0, 3.14, 2.6, 2.35, 13.5, C.ink, { valign: 'top' });
  [
    ['保全', 'localStorage にバックアップ'],
    ['手動出力', 'GET /export/{session_id}'],
    ['切断時出力', 'ブラウザーで Markdown 生成'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 4.13;
    text(s, `${title}：${body}`, x + 0.05, 5.7, 3.72, 0.27, 11, C.green, { bold: true });
  });
  prompt(s, '受信した更新を state に反映し、Markdown 表示にして。\n要約・会話・Q&A を出力し、切断や再読み込みにも備えて。');
  notes(s, 'useWebSocket がイベントを振り分け、App.tsx の setSummary や setQuestions を呼びます。Q&A は質問文字列をキーに回答と引用を更新し、本文は ReactMarkdown で表示します。ブラウザー内の localStorage バックアップは、ページ終了や切断に備える仕組みです。スタンドアロン版の手動エクスポートは /export/{session_id} でサーバーが Markdown を生成します。切断時の自動出力はクライアントの generateSessionMarkdown と downloadMarkdown を使います。Teams パネルの手動出力もクライアント生成です。スクリーンショットは前版で撮影したローカルの未コミット UI を含み、表示内容と WebSocket 応答を説明用サンプルに差し替えています。モデル性能や認識精度の実証画像ではありません。', [files.app, files.main, files.ws, ref('frontend/src/exportMd.ts')]);
}

// 12
{
  const s = slide('BUILD 11  /  EXTEND THROUGH SHARED CONTRACTS', '入力経路を差し替え、共通処理を再利用する', '音声と Teams を同じ契約へ接続。破線は Teams 環境での検証が必要な経路。', '根拠：各フック / TeamsSidePanel.tsx / main.py');
  mini(s, 'スタンドアロン', 'useSpeechRecognition\nマイク → Speech SDK', 0.65, 2.58, 3.8, 1.5, C.white, 22, 14);
  mini(s, 'Teams パネル', 'useTeamsTranscript\nキャプション API の可用性確認', 0.65, 4.38, 3.8, 1.45, C.warm, 21, 12.5);
  arrow(s, 4.56, 3.4, 5.2, 3.4, C.green, false);
  arrow(s, 5.2, 3.4, 5.2, 4.22, C.green, false);
  arrow(s, 4.56, 5.14, 5.2, 5.14, C.amber, false, true);
  arrow(s, 5.2, 5.14, 5.2, 4.22, C.amber, false, true);
  arrow(s, 5.2, 4.22, 5.83, 4.22);
  mini(s, '共通 onResult', 'text / speaker\n→ transcript\n→ WebSocket', 5.93, 3.24, 3.05, 2.35, C.soft, 20, 16);
  arrow(s, 9.1, 4.22, 9.6, 4.22);
  mini(s, '同じ AI 処理へ', 'FastAPI\n要約・検索・回答', 9.7, 3.24, 2.98, 2.35, C.lilac, 19, 16);
  text(s, '言語設定：set_language   ／   要約翻訳：request_translate', 5.93, 2.58, 6.75, 0.32, 12, C.muted);
  prompt(s, 'Teams 入力を共通 onResult へつなぎ、後段を再利用して。\n字幕 API が利用できない場合は明示し、Speech 入力を用意して。');
  notes(s, '両方の入力フックは onResult(text, speaker) へ結果を渡し、handleTranscript から共通の transcript メッセージを送ります。Teams パネルにも同じ useWebSocket のコールバック構造があります。作成時のローカル Teams パネルには、Teams の初期化や字幕ハンドラー登録でエラーになったときに Speech 入力を利用できるフォールバックがあります。字幕 API の利用可否は SDK、Teams クライアント、テナント設定によるため、コードがあることと動作検証済みであることは分けます。言語は set_language でサーバーの session.language へ伝え、翻訳要求は request_translate で別処理にします。六つの言語選択肢があることを、全言語におけるすべての応答品質の保証と混同しません。', [files.teams, files.speech, files.main, '作成時のローカル frontend/src/teams/TeamsSidePanel.tsx']);
}

// 13
{
  const s = slide('DEBUG  /  TRACE REAL FIXES', '不具合を「現象 → 原因 → 修正」でたどる', 'Git に残る修正を、接続・認証・継続利用の観点で読み解く。', '根拠：下記コミット ／ 現象は変更内容から要約');
  const columns = [0.85, 4.23, 7.7];
  ['確認する現象', '着目した原因・条件', '追加・変更した処理'].forEach((v, i) => label(s, v, columns[i], 2.5, i === 2 ? 4.7 : 3.1));
  const rows = [
    ['Speech トークンが取得できない', '/api のプロキシが未設定', '/api → バックエンド転送を追加', '175efd9'],
    ['Speech の Entra 認証形式', '通常の bearer token だけでは不足', 'aad#<resource-id>#<token> に整形', '512a9b0'],
    ['長時間利用時の認識継続', '短時間トークンの更新が必要', '8 分ごとの更新と復帰処理を追加', '06f9a79'],
    ['切断後に会議内容を復元したい', '接続終了時の状態破棄', '同じ ID で復元 / 300 秒保持', 'f7b3079'],
  ];
  rows.forEach(([a, b, c, commit], i) => {
    const y = 3.08 + i * 0.7;
    box(s, 0.65, y, 12.03, 0.6, i % 2 ? C.white : C.soft);
    text(s, a, columns[0], y + 0.05, 3.18, 0.42, 12.5);
    text(s, b, columns[1], y + 0.05, 3.19, 0.42, 12, C.muted);
    text(s, c, columns[2], y + 0.05, 4.65, 0.25, 12, C.ink, { bold: true });
    text(s, commit, columns[2], y + 0.37, 4.65, 0.18, 10.5, C.green, { fontFace: 'Consolas' });
  });
  prompt(s, 'エラーと再現手順から原因を絞り、必要な箇所だけ修正して。\n修正後に確認する操作と、まだ残る制約も示して。');
  notes(s, 'ここは一般論ではなく、Git の変更から確認できる具体例です。175efd9 は Vite に /api プロキシを追加しました。512a9b0 は Speech SDK の Entra トークンに ARM resource ID を含む形式を使うよう変更しました。06f9a79 は8分ごとのトークン更新とエラー時復帰処理を追加していますが、すべての長時間利用条件で解消したと保証するものではありません。f7b3079 は同一セッションへの再接続復元と既定300秒の切断後保持を追加しました。状態はサーバーのメモリーにあり、再起動をまたぐ DB 永続保存ではありません。元の実行エラーログを保存していないため、現象欄は変更内容を要約したもので、架空のログやエラーメッセージは掲載していません。', rows.map(r => `${root}/commit/${r[3]}`));
}

// 14
{
  const s = slide('VERIFY  /  CLOSE THE DEVELOPMENT LOOP', '生成したら、ビルド・疎通・動作で確かめる', 'Copilot に「実装」だけでなく「確認方法と修正」まで具体的に依頼する。', '手順の説明例（アプリ動作試験の結果ではありません）');
  [
    ['01  変更を確認', '意図・差分・設定を読む'],
    ['02  ビルド', '型とフロントの生成を確認'],
    ['03  接続を確認', 'API・MCP・モデルを分ける'],
    ['04  実機で確認', '会話・引用・切断を試す'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 3.1;
    mini(s, title, body, x, 2.57, 2.73, 1.42, i % 2 ? C.soft : C.white, 16, 12.5);
    if (i < 3) arrow(s, x + 2.81, 3.28, x + 3.02, 3.28);
  });
  code(s, '既存コマンド（それぞれのディレクトリーで実行）', [
    'frontend> npm run build', 'backend>  python smoke_mcp.py', 'backend>  python smoke_test.py',
  ].join('\n'), 0.65, 4.33, 6.35, 1.44, 13);
  text(s, '手動の確認例\n日本語の認識 → 要約 → 質問抽出 → 引用先\n再接続 → 復元 → クリア → Markdown 出力', 7.45, 4.4, 5.05, 1.14, 14, C.ink);
  prompt(s, '変更後は既存のビルドと疎通確認を使って検証して。\n失敗したら実際の出力を根拠に修正し、未確認項目を残して。');
  notes(s, 'このページは実装時に行う確認メニューで、今回の資料作成でアプリの Azure 接続試験を行ったという報告ではありません。npm run build は TypeScript の確認と Vite ビルドです。smoke_mcp.py は外部 MCP 接続が必要ですが Azure 認証は不要です。smoke_test.py はモデルと MCP の疎通に使い、Azure 設定と認証が必要です。いずれも包括的な自動テストではありません。コマンド欄の frontend> と backend> は実行ディレクトリーを示すラベルで、コマンドの一部ではありません。ブラウザーでは実際の会話と例外操作を行い、表示が出ただけでなく期待するデータが復元・出力されるか確認します。Copilot は確認を支援できますが、採用と業務利用の判断は人が担います。', [ref('frontend/package.json'), ref('backend/smoke_mcp.py'), ref('backend/smoke_test.py'), files.copilot]);
}

// 15
{
  const s = slide('RECAP  /  BUILD ONE CONNECTION AT A TIME', '', '', '', true);
  text(s, '「何をつくるか」を伝え、\n接続を一つずつ、動かす。', 0.65, 1.15, 12.0, 1.75, 39, C.white, { bold: true, fontFace: 'Yu Gothic' });
  text(s, '要件 → 土台 → 音声 → 通信 → 要約 → 検索・回答 → 検証', 0.72, 3.37, 11.9, 0.6, 21, C.lime, { bold: true });
  text(s, 'Copilot の価値は、コードの補完だけではない。\n構成の相談から変更・調査・修正まで、対話で実装を進められる。', 0.72, 4.35, 11.8, 0.93, 20, C.gray);
  [
    ['人が決める', '目的・制約・完了条件'],
    ['Copilot と進める', '小さな実装・調査・修正'],
    ['実際に確かめる', '動作・根拠・運用上の限界'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 4.12;
    box(s, x, 5.72, 3.78, 1.0, C.slate);
    text(s, title, x + 0.22, 5.91, 3.34, 0.35, 18, C.lime, { bold: true });
    text(s, body, x + 0.22, 6.39, 3.34, 0.22, 12.5, C.white);
  });
  notes(s, 'このアプリは、既存の技術を役割ごとに接続して構成しています。マイクから文字列、文字列から WebSocket、セッションから差分要約、質問から検索、資料から回答という順に、動作する接続を増やしていく考え方が重要です。Copilot は一行の補完にとどまらず、構成の相談、複数ファイルの変更、コマンド実行や検証の支援にも使えます。ただし、これは実際の会話ログをすべて検証した開発証明ではありません。人が目的と完了条件を明確にし、小さな変更を確認しながら進めることで、実装への入口を身近にできる、というメッセージで締めます。', [files.readme, files.copilot]);
}

if (pageNumber !== 15) throw new Error(`Expected 15 slides, got ${pageNumber}`);
if (bounds.length) throw new Error(bounds.join('\n'));
pptx.writeFile({ fileName: path.join(__dirname, 'RealtimeQA_Copilot_Development_JA.pptx') })
  .then(() => console.log(`Created ${pageNumber} technical development-process slides with Japanese speaker notes.`))
  .catch(error => { console.error(error); process.exitCode = 1; });
