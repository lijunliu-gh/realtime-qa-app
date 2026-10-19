// Run with pptxgenjs installed, or set PPTX_TOOLS_ROOT to its node_modules directory.
const path = require('path');
const fs = require('fs');
const PptxGenJS = process.env.PPTX_TOOLS_ROOT
  ? require(path.join(process.env.PPTX_TOOLS_ROOT, 'pptxgenjs'))
  : require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Lijun Liu';
pptx.subject = 'RealtimeQA の構成・開発の軌跡と GitHub Copilot 活用';
pptx.title = 'アイデアを、動くアプリへ。 | RealtimeQA × GitHub Copilot';
pptx.company = 'RealtimeQA';
pptx.lang = 'ja-JP';
pptx.theme = {
  headFontFace: 'Yu Gothic',
  bodyFontFace: 'Meiryo',
  lang: 'ja-JP',
};

const C = {
  ink: '17211D', dark: '111816', paper: 'F4F6F1', white: 'FFFFFF',
  muted: '57665D', lime: 'BEF264', green: '356B46', soft: 'E7EFDF',
  purple: '7550B5', lilac: 'EFE9F8', border: 'DCE3D7', slate: '263B31',
  gray: 'B7C6BA', amber: '9B5B0E', warm: 'FFF0D9',
};
const W = 13.333333, H = 7.5;
const S = pptx.ShapeType;
const root = 'https://github.com/lijunliu-gh/realtime-qa-app';
const sources = {
  readme: `${root}/blob/4d22a09/README.ja.md`,
  main: `${root}/blob/4d22a09/backend/main.py`,
  mcp: `${root}/blob/4d22a09/backend/services/mcp_client.py`,
  llm: `${root}/blob/4d22a09/backend/services/summarizer.py`,
  speech: `${root}/blob/4d22a09/frontend/src/hooks/useSpeechRecognition.ts`,
  teams: `${root}/blob/4d22a09/frontend/src/hooks/useTeamsTranscript.ts`,
  desktop: `${root}/blob/4d22a09/docs/desktop-app-plan.md`,
  copilot: 'https://code.visualstudio.com/docs/agents/overview',
  permissions: 'https://code.visualstudio.com/docs/agents/run/approvals',
};
let count = 0;
const layoutErrors = [];

function check(x, y, w, h, label) {
  if ([x, y, w, h].some(n => !Number.isFinite(n)) ||
      x < -0.01 || y < -0.01 || w < 0 || h < 0 ||
      x + w > W + 0.015 || y + h > H + 0.015) {
    layoutErrors.push(`Slide ${count}: ${label} outside slide: ${[x, y, w, h]}`);
  }
}
function text(slide, value, x, y, w, h, size = 16, color = C.ink, extra = {}) {
  check(x, y, w, h, String(value).slice(0, 36));
  slide.addText(value, {
    x, y, w, h, fontFace: 'Meiryo', fontSize: size, color,
    margin: 0, breakLine: false, valign: 'mid', paraSpaceAfterPt: 5,
    ...extra,
  });
}
function box(slide, x, y, w, h, fill = C.white, border = fill, radius = true) {
  check(x, y, w, h, 'box');
  slide.addShape(radius ? S.roundRect : S.rect, {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: fill }, line: { color: border, width: 1 },
    radius: 0.12,
  });
}
function line(slide, x1, y1, x2, y2, color = C.green, arrows = true, dash = false) {
  slide.addShape(S.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color, width: 2, ...(arrows ? { endArrowType: 'triangle' } : {}),
      ...(dash ? { dashType: 'dash' } : {}) },
  });
}
function pill(slide, value, x, y, w, fill = C.soft, color = C.green) {
  box(slide, x, y, w, 0.35, fill);
  text(slide, value, x + 0.1, y, w - 0.2, 0.35, 10.5, color, { bold: true, align: 'center' });
}
function num(slide, value, x, y, color = C.green, fill = C.soft) {
  slide.addShape(S.ellipse, { x, y, w: 0.46, h: 0.46, fill: { color: fill }, line: { color: fill } });
  text(slide, value, x, y, 0.46, 0.46, 15, color, { bold: true, align: 'center' });
}
function card(slide, x, y, w, h, label, body, options = {}) {
  const compact = h < 1.5;
  box(slide, x, y, w, h, options.fill || C.white, options.border || options.fill || C.white);
  text(slide, label, x + 0.24, y + (compact ? 0.14 : 0.2), w - 0.48, compact ? 0.56 : 0.65, options.titleSize || 20, options.color || C.ink, { bold: true });
  text(slide, body, x + 0.24, y + (compact ? 0.87 : 1.0), w - 0.48, h - (compact ? 1.0 : 1.16), options.bodySize || 15.5,
    options.bodyColor || C.muted, { valign: 'top', ...options.bodyOptions });
}
function slide(section, title, subtitle, source, dark = false) {
  const s = pptx.addSlide();
  count += 1;
  s.background = { color: dark ? C.dark : C.paper };
  const foreground = dark ? C.white : C.ink;
  text(s, section, 0.6, 0.38, 11.7, 0.3, 10.5, dark ? C.lime : C.green, {
    bold: true, charSpacing: 1.5,
  });
  if (title) text(s, title, 0.6, 0.99, 12.1, 0.72, 32, foreground, { bold: true, fontFace: 'Yu Gothic' });
  if (subtitle) text(s, subtitle, 0.6, 1.79, 12.0, 0.45, 15, dark ? C.gray : C.muted);
  text(s, 'RealtimeQA  /  GitHub Copilot', 0.6, 7.04, 4.25, 0.22, 9.5, dark ? C.gray : C.muted);
  if (source) text(s, source, 4.9, 7.02, 7.05, 0.3, 9.3, dark ? C.gray : C.muted, { align: 'right' });
  text(s, String(count).padStart(2, '0'), 12.25, 7.0, 0.45, 0.3, 11, dark ? C.lime : C.green, { align: 'right', bold: true });
  return s;
}
function notes(s, script, references = []) {
  s.addNotes(`${script}\n\n【根拠・出典】\n${references.join('\n')}\n\n資料作成日：2026年10月16日。実装の根拠はコミット 4d22a09 と作成時のローカル画面。開発工数・削減率は計測していないため記載していません。`);
}

// 01
{
  const s = slide('CUSTOMER BRIEFING  /  JAPANESE EDITION', '', '', '', true);
  pill(s, 'RealtimeQA × GitHub Copilot', 0.65, 1.0, 3.8, C.slate, C.lime);
  text(s, 'アイデアを、\n動くアプリへ。', 0.65, 1.85, 8.4, 1.95, 48, C.white, { bold: true, fontFace: 'Yu Gothic' });
  text(s, '会議の文字起こし・要約・技術 Q&A を題材に\n「対話でつくり、動かして磨く」開発を知る', 0.7, 4.1, 7.8, 1.1, 21, C.gray);
  text(s, 'GitHub Copilot で、ソフトウェアづくりをもっと身近に。', 0.7, 6.05, 11.9, 0.5, 20, C.lime, { bold: true });
  box(s, 9.15, 1.35, 3.45, 4.32, C.slate);
  const levels = [0.25, 0.55, 0.85, 1.1, 0.7, 1.3, 0.85, 0.4, 0.72, 0.3];
  levels.forEach((h, i) => box(s, 9.7 + i * 0.23, 2.5 - h / 2, 0.105, h, C.lime, C.lime, false));
  text(s, '会話', 9.55, 3.45, 2.65, 0.4, 18, C.white, { bold: true });
  text(s, '要点を整理', 9.55, 4.1, 2.65, 0.4, 18, C.white, { bold: true });
  text(s, '根拠を確認', 9.55, 4.75, 2.65, 0.4, 18, C.lime, { bold: true });
  notes(s, '本日は RealtimeQA という実際のアプリを使い、どのような価値を生み、どのような構成で動くのかをお話しします。もう一つのテーマは、GitHub Copilot により、アイデアから実装を試すまでの入口が身近になったことです。専門知識が不要になるというお話ではありません。自然言語で方向を伝え、人が実際の動作と品質を確かめる開発の姿をご紹介します。想定説明時間は15〜20分、デモは任意です。', [sources.readme, sources.copilot]);
}

// 02
{
  const s = slide('01  /  BUSINESS VALUE', '会議中の「あとで調べる」を減らしたい', '議事録づくりと情報検索を、会話の流れに近づける。', '用途・期待価値の説明（定量効果は未測定）');
  pill(s, 'これまでの困りごと', 0.85, 2.5, 3.3, C.warm, C.amber);
  pill(s, 'RealtimeQA が支援すること', 7.0, 2.5, 4.0);
  const rows = [
    ['メモに追われ、会話に集中できない', '発言を文字として残す'],
    ['会議後に、要点や宿題を整理し直す', '要点・決定事項・アクションを整理'],
    ['技術的な疑問の調査が持ち帰りになる', '文書を参照した Q&A を確認'],
  ];
  rows.forEach(([a, b], i) => {
    const y = 3.15 + i * 1.02;
    box(s, 0.65, y, 5.45, 0.78);
    text(s, a, 0.9, y + 0.11, 4.95, 0.53, 17);
    line(s, 6.3, y + 0.39, 6.85, y + 0.39);
    box(s, 7.05, y, 5.6, 0.78, C.soft);
    text(s, b, 7.3, y + 0.11, 5.1, 0.53, 17, C.green, { bold: true });
  });
  text(s, '想定シーン：技術相談・商談・社内勉強会・多言語の打ち合わせ', 0.85, 6.45, 11.7, 0.35, 15, C.muted);
  notes(s, '出発点は、会議の最中にメモ、要約、技術調査を同時にこなす難しさです。このアプリは人の代わりに結論を決めるのではなく、会話の記録と整理、調べるための手がかりづくりを支援します。ここに示した業務効果は利用仮説であり、時間削減率や精度を実測した結果ではありません。', [sources.readme]);
}

// 03
{
  const s = slide('02  /  PRODUCT EXPERIENCE', 'ひとつの画面で、会話から確認まで', '要約・Q&A エリアの実画面。内容は説明用サンプルで、実際の AI 応答ではありません。', '画面：ローカル UI の主要エリア ／ サンプルデータ');
  const imagePath = path.join(__dirname, 'assets', 'app-ja-sample.png');
  const image = fs.readFileSync(imagePath);
  const imageHeight = 12.03 * image.readUInt32BE(20) / image.readUInt32BE(16);
  if (imageHeight > 3.6) throw new Error('Screenshot is too tall for the slide 3 layout.');
  box(s, 0.6, 2.5, 12.13, imageHeight + 0.1, C.white, C.border);
  s.addImage({ path: imagePath, x: 0.65, y: 2.55, w: 12.03, h: imageHeight,
    altText: '日本語の RealtimeQA 画面の要約と Q&A エリア。内容と参照先は説明用サンプル。' });
  [
    ['01', '会議サマリー', '要点と次の行動を整理'],
    ['02', '技術 Q&A', '回答と参照先を確認'],
    ['03', '引用リンク', '出典に戻って確認'],
  ].forEach(([n, title, body], i) => {
    const x = 0.75 + i * 4.25;
    num(s, n, x, 6.22);
    text(s, title, x + 0.65, 6.17, 2.7, 0.34, 17, C.ink, { bold: true });
    text(s, body, x + 0.65, 6.56, 2.7, 0.28, 12, C.muted);
  });
  notes(s, 'こちらは作成時点のローカルコードをブラウザーで表示した画面のうち、要約と Q&A の領域を抜き出して拡大したものです。既存の未コミット UI 変更を含みます。会議情報やお客様情報は使用せず、WebSocket の応答を説明用データで置き換えて撮影しました。音声認識、モデル応答、引用の正確性をこの画像で実証したものではありません。左で要約、右で Q&A と参照先を確認できます。', [sources.readme, 'ローカル frontend/src/App.tsx（作成時のワークツリー）']);
}

// 04
{
  const s = slide('03  /  CORE FUNCTIONS', '「聞く → 整理する → 調べる → 残す」', 'AI の機能を、会議の小さな一連の体験としてつなぐ。', '出典：README.ja.md ／ backend/main.py');
  const data = [
    ['01', '聞く', '音声を文字起こし\n話者ラベルを表示', 'Azure Speech SDK'],
    ['02', '整理する', '会話から要点を抽出\n要約を継続的に更新', 'Foundry のモデル'],
    ['03', '調べる', '操作で質問を抽出\n文書を参照して回答', 'MCP 検索 + モデル'],
    ['04', '残す', '要約・会話・Q&A を\nMarkdown に出力', 'ブラウザー / API'],
  ];
  data.forEach(([n, title, body, tech], i) => {
    const x = 0.65 + i * 3.1;
    box(s, x, 2.7, 2.75, 3.18);
    num(s, n, x + 0.23, 2.95);
    text(s, title, x + 0.23, 3.63, 2.29, 0.5, 25, C.ink, { bold: true });
    text(s, body, x + 0.23, 4.35, 2.29, 0.78, 16, C.muted);
    text(s, tech, x + 0.23, 5.32, 2.29, 0.3, 11.5, C.green, { bold: true });
    if (i < 3) line(s, x + 2.82, 4.23, x + 3.03, 4.23);
  });
  box(s, 0.65, 6.18, 12.02, 0.53, C.soft);
  text(s, '日本語を含む 6 言語を選択可能  ｜  要約のオンデマンド翻訳  ｜  ライト／ダーク表示', 0.9, 6.25, 11.5, 0.35, 14, C.green);
  notes(s, 'ブラウザー版では開始ボタンからマイク入力を使います。要約は継続的に更新され、質問抽出はユーザー操作をきっかけに実行するため、すべての会話に常時自動回答する説明はしません。対応する認識言語の選択肢は日本語、英語、中国語、韓国語、フランス語、ドイツ語です。認識精度と話者識別は音声条件によって変わります。Markdown エクスポートを実装していますが、PDF 議事録の出力を実装済みとは説明しません。', [sources.readme, sources.main, sources.speech]);
}

// 05
{
  const s = slide('04  /  ARCHITECTURE', '基本構成は、画面・制御・AI の組み合わせ', '複雑な一枚岩ではなく、役割を分けて接続する。', '出典：main.py ／ summarizer.py ／ mcp_client.py');
  pill(s, '入力', 0.65, 2.4, 3.05);
  pill(s, 'アプリケーション', 4.55, 2.4, 3.5);
  pill(s, '知識・生成', 9.1, 2.4, 3.55, C.lilac, C.purple);
  card(s, 0.65, 3.05, 3.05, 1.35, 'マイク + Azure Speech', '音声 → 文字列・話者ラベル', { titleSize: 16, bodySize: 12.5 });
  card(s, 0.65, 5.0, 3.05, 1.3, 'Teams キャプション', '別入力経路 / 環境検証が必要', { titleSize: 16, bodySize: 12.5, fill: C.warm });
  card(s, 4.55, 3.05, 3.5, 1.35, 'React + TypeScript', '表示・操作・音声 SDK', { titleSize: 19, bodySize: 13.5 });
  card(s, 4.55, 5.0, 3.5, 1.3, 'FastAPI / Python', 'セッション・要約・Q&A 制御', { titleSize: 19, bodySize: 13.5, fill: C.soft });
  card(s, 9.1, 3.05, 3.55, 1.35, 'Microsoft Foundry', 'モデルによる要約・質問抽出・回答', { titleSize: 19, bodySize: 12.5, fill: C.lilac });
  card(s, 9.1, 5.0, 3.55, 1.3, 'MCP 文書検索', 'Microsoft Learn + 設定済み検索先', { titleSize: 19, bodySize: 12.5, fill: C.lilac });
  line(s, 3.75, 3.72, 4.45, 3.72);
  line(s, 3.75, 5.62, 4.15, 5.62, C.amber, false, true);
  line(s, 4.15, 5.62, 4.15, 4.07, C.amber, false, true);
  line(s, 4.15, 4.07, 4.45, 4.07, C.amber, true, true);
  line(s, 6.3, 4.45, 6.3, 4.92);
  text(s, 'WebSocket', 6.55, 4.48, 1.4, 0.3, 10.5, C.green);
  line(s, 8.15, 5.36, 8.53, 5.36, C.purple, false);
  line(s, 8.53, 5.36, 8.53, 3.73, C.purple, false);
  line(s, 8.53, 3.73, 9.0, 3.73, C.purple);
  line(s, 8.15, 5.96, 9.0, 5.96, C.purple);
  text(s, '概念図：音声はブラウザーから Speech へ送信。FastAPI へ渡す主な会議データは文字列。', 0.85, 6.55, 11.9, 0.32, 12.2, C.muted);
  notes(s, '左は入力、中央は画面と制御、右は生成モデルと文書検索です。マイク音声はブラウザーの Speech SDK から Azure Speech に送ります。Speech 用短時間トークンはバックエンドから取得します。文字起こし結果を WebSocket で FastAPI に送り、要約と Q&A の結果を同じ接続で受け取ります。矢印は主な呼び出し方向で、戻りの応答は省略しています。Teams 経路はコードに存在しますが、キャプション API の利用可否やテナント設定を実環境で検証する必要があります。現状はサーバーのメモリーにセッションを保持し、永続 DB や独自ベクトル DB を必須とする構成ではありません。', [sources.main, sources.llm, sources.mcp, sources.teams]);
}

// 06
{
  const s = slide('05  /  GROUNDED Q&A', '回答だけでなく、「参照先」まで見せる', 'MCP を通じた文書検索で、生成 AI に根拠となる情報を渡す。', '出典：mcp_client.py ／ summarizer.py');
  const labels = ['会話の差分', '質問を抽出', '文書を検索', '回答を生成', '出典を表示'];
  labels.forEach((v, i) => {
    const x = 0.65 + i * 2.465;
    box(s, x, 2.75, 2.16, 1.15, i === 2 ? C.lilac : C.white);
    num(s, String(i + 1), x + 0.17, 2.94, i === 2 ? C.purple : C.green, i === 2 ? C.lilac : C.soft);
    text(s, v, x + 0.15, 3.48, 1.86, 0.3, 16, C.ink, { bold: true, align: 'center' });
    if (i < 4) line(s, x + 2.22, 3.3, x + 2.405, 3.3);
  });
  card(s, 0.65, 4.38, 5.8, 1.9, '検索を広げるしくみ', '複数 MCP 検索先へ並列に問い合わせ。\nURL の重複を除き、複数の検索先の結果を統合。', { titleSize: 21, bodySize: 15 });
  card(s, 6.8, 4.38, 5.85, 1.9, '出典があっても、確認は必要', '引用は確認の手がかりであり、正しさの保証ではない。\n検索結果がない場合、引用なしの回答になり得る。', { titleSize: 21, bodySize: 15, fill: C.warm, color: C.amber });
  text(s, 'ポイント：この実装は MCP 文書検索を利用。独自のベクトル DB 構築を前提にしていません。', 0.85, 6.52, 11.8, 0.32, 12.5, C.muted);
  notes(s, '質問抽出は前回処理した位置から後の会話を対象にします。質問ごとに検索し、そのスニペットと会議要約をモデルへ渡して回答します。検索先を増やす場合は設定により MCP サーバーを追加できますが、検索ツールと応答形式の互換性確認が必要です。検索結果は URL で重複を除き、検索先を交互に取り込む方法で統合します。現在の引用一覧は取得した資料の一覧をもとにしており、各主張と引用の一致を自動検証するものではありません。検索が失敗または空の場合でも引用なしで生成が続くことがあるため、業務利用では回答と原文の確認が重要です。', [sources.main, sources.mcp, sources.llm]);
}

// 07
{
  const s = slide('06  /  DEVELOPMENT HISTORY', '小さくつくり、使いながら進化させる', 'Git の記録から確認できる、実装と改善の軌跡。', '出典：Git log（コミット日であり、実作業時間ではない）');
  line(s, 1.23, 3.06, 12.0, 3.06, C.border, false);
  const data = [
    ['6/17', '議事録出力', 'エクスポートを\nREADME に記載', 'c4ab969'],
    ['6/25', '会話体験を強化', '差分抽出・話者識別\nSpeech SDK\nUI 改善', '8c557d0 / 46b53da'],
    ['6/26', '利用の場を拡大', 'Teams 経路・多言語\n再接続復元・要約翻訳', 'f6fb272 / f7b3079'],
    ['6/29', 'データを守る', 'バックアップ\n手動クリア・起動支援', '23a90e8 / 810733a'],
    ['6/30', '検索と認証', 'マルチソース検索\nEntra ID / API キー', 'a94d8c9 / 9785658'],
  ];
  data.forEach(([date, title, body, hash], i) => {
    const x = 0.65 + i * 2.465;
    text(s, date, x, 2.47, 2.16, 0.45, 26, C.green, { bold: true, align: 'center' });
    s.addShape(S.ellipse, { x: x + 0.96, y: 2.94, w: 0.24, h: 0.24, fill: { color: C.green }, line: { color: C.green } });
    box(s, x, 3.52, 2.16, 2.44);
    text(s, title, x + 0.15, 3.76, 1.86, 0.75, 17, C.ink, { bold: true });
    text(s, body, x + 0.15, 4.65, 1.86, 0.85, 12.5, C.muted);
    text(s, hash, x + 0.15, 5.58, 1.86, 0.25, 8.9, C.green, { fontFace: 'Consolas' });
  });
  text(s, '2026年の記録  ｜  機能追加だけでなく、接続・認証・データ保全も改善', 0.85, 6.42, 11.8, 0.42, 16, C.muted);
  notes(s, 'これは保存されている Git 記録のタイムラインです。6月17日のエクスポート記載、6月25日の Speech SDK や差分処理、6月26日の Teams 経路と多言語・復元、6月29日のバックアップ、6月30日の検索と認証の拡張が確認できます。6月17日の最初の可視コミットは README の更新であり、この日が開発開始日だとは言えません。また、コミット間隔は開発工数や Copilot の効率向上を示す計測ではありません。元の Copilot 会話を検証できていないため、個々のコミットを Copilot が作成したとも断定しません。', data.map(v => `${v[0]}: ${v[3]}`).concat([`${root}/commits/main/`]));
}

// 08
{
  const s = slide('07  /  WHY GITHUB COPILOT', '変わるのは、「つくり始める」までの距離', '自然言語で意図を伝え、コード・実行・修正を同じ開発環境でつなぐ。', '出典：VS Code 公式ドキュメント（2026/10/16 参照）', true);
  card(s, 0.65, 2.62, 3.65, 2.9, '意図を伝える', '「日本語の会議を要約したい」\n「出典付きで回答したい」\n\nやりたいことを言葉にする。', { fill: C.slate, color: C.white, bodyColor: C.gray, titleSize: 24, bodySize: 16 });
  card(s, 4.85, 2.62, 3.65, 2.9, 'Copilot が支援', '関連コードを調べる。\n複数ファイルの変更を進める。\n必要なコマンドや検証を扱う。', { fill: C.slate, color: C.lime, bodyColor: C.gray, titleSize: 24, bodySize: 16 });
  card(s, 9.05, 2.62, 3.65, 2.9, '人が確かめる', '設計と変更差分を確認する。\n動作・出典・例外系を試す。\n採用する変更を判断する。', { fill: C.slate, color: C.white, bodyColor: C.gray, titleSize: 24, bodySize: 16 });
  line(s, 4.4, 4.02, 4.75, 4.02, C.lime);
  line(s, 8.6, 4.02, 8.95, 4.02, C.lime);
  text(s, 'Copilot は「開発の相棒」。このアプリの実行時 AI は Speech / Foundry。', 0.85, 6.1, 11.8, 0.55, 19, C.lime, { bold: true });
  notes(s, 'GitHub Copilot は、このアプリに埋め込まれた会議処理 API ではなく、ソフトウェア開発を支援する側です。VS Code の公式資料には、エージェントがコードを調べ、ファイルを変更し、チェックを実行する開発体験が説明されています。利用可能な機能や承認の挙動は、契約、管理ポリシー、設定に依存します。このスライドは一般的な Copilot の活用方法であり、このリポジトリーの全工程を Copilot が完遂したという証明ではありません。人が設計と品質の責任を持つ点は変わりません。', [sources.copilot, sources.permissions, sources.main]);
}

// 09
{
  const s = slide('08  /  COPILOT WORKFLOW', '大きなお願いを、小さな成功に分ける', 'おすすめの進め方：一度に全部ではなく、動く単位で反復する。', '活用提案：実際の開発対話ログの引用ではありません');
  const steps = [
    ['要件', '何を実現するか', '人', C.soft],
    ['設計', '構成と制約を相談', '人 + Copilot', C.lilac],
    ['実装', '小さな単位で変更', 'Copilot が支援', C.lilac],
    ['検証', '動作と差分を確認', '人 + ツール', C.soft],
    ['改善', '結果を次の指示へ', '人 + Copilot', C.soft],
  ];
  steps.forEach(([title, body, role, fill], i) => {
    const x = 0.65 + i * 2.465;
    box(s, x, 2.7, 2.16, 2.72, fill);
    text(s, String(i + 1).padStart(2, '0'), x + 0.2, 2.91, 1.84, 0.5, 29, C.green, { bold: true });
    text(s, title, x + 0.2, 3.57, 1.84, 0.5, 25, C.ink, { bold: true });
    text(s, body, x + 0.2, 4.22, 1.84, 0.47, 13.5, C.muted);
    text(s, role, x + 0.2, 4.87, 1.84, 0.32, 11.5, C.purple, { bold: true });
    if (i < 4) line(s, x + 2.22, 4.03, x + 2.405, 4.03);
  });
  box(s, 0.65, 5.88, 12.02, 0.82, C.white);
  text(s, '指示のコツ', 0.9, 6.07, 1.85, 0.38, 17, C.green, { bold: true });
  text(s, '目的 + 対象 + 制約 + 完了条件 を伝える', 3.05, 6.04, 9.15, 0.45, 21, C.ink, { bold: true });
  notes(s, 'まず要件を決め、Copilot と構成を相談し、次に一つの機能を実装して確認します。検証で得られた事実をそのまま次の指示へ戻すのが重要です。例えば、全文を毎回送るのではなく、新しい会話だけを処理するという具体的な制約にすると、実装も確認もしやすくなります。ここはこのケースから提案するワークフローで、保存されていない実際の会話を再現したと主張するものではありません。', [sources.copilot]);
}

// 10
{
  const s = slide('09  /  PROMPT EXAMPLE', 'たとえば、こんな対話で一歩ずつ進める', '再現例：実装内容をもとに構成した説明用プロンプト。実際の会話ログではありません。', '再現例 ／ 完了条件を先に言葉にする');
  box(s, 0.65, 2.58, 7.52, 3.98, C.dark);
  pill(s, 'あなた → GitHub Copilot', 0.95, 2.88, 3.7, C.slate, C.lime);
  text(s, '日本語の会議を文字起こしし、\n要点と出典付き Q&A を表示したい。', 0.98, 3.55, 6.87, 0.95, 23, C.white, { bold: true });
  text(s, 'まず React と FastAPI の最小構成を提案して。\n次に、要約更新までを実装して。\n既存の表示を保ち、起動手順と確認方法も示して。', 0.98, 4.88, 6.85, 1.16, 16, C.gray);
  [
    ['01', '目的', '何のためのアプリか'],
    ['02', '段階', 'まず設計、次に一機能'],
    ['03', '制約', '既存の表示を保つ'],
    ['04', '完了条件', '動かし方と確認方法'],
  ].forEach(([n, title, body], i) => {
    const y = 2.72 + i * 0.95;
    num(s, n, 8.7, y);
    text(s, title, 9.35, y, 3.0, 0.42, 19, C.ink, { bold: true });
    text(s, body, 9.35, y + 0.45, 3.1, 0.34, 14, C.muted);
  });
  notes(s, 'このプロンプトは説明用の再現例です。目的を伝えるだけでなく、まず設計を確認し、その次に一つの機能へ進むようにしています。既存表示を壊さないこと、起動と確認の方法を示すことも完了条件に含めます。いきなり完成版を一度で求めるより、人が判断できる単位で進めることが、手戻りと見落としを減らすための実践になります。Copilot の返答は毎回同一ではなく、環境による確認が必要です。', [sources.copilot, sources.readme]);
}

// 11
{
  const s = slide('10  /  ITERATIVE IMPROVEMENT', '「切れたらどうなる？」も、改善の入口に', '実際の変更記録を、改善のための対話に落とし込む。', '実装：f7b3079 / 23a90e8 ／ 指示文は再現例');
  card(s, 0.65, 2.62, 5.55, 2.0, '着目する困りごと', 'ネットワーク切断やページ更新の後も、\n会議内容を確認できるようにしたい。', { titleSize: 22, bodySize: 18 });
  card(s, 6.65, 2.62, 6.0, 2.0, '実装された対策', '同じセッションへの再接続時に状態を復元。\nブラウザー内バックアップと切断時の出力を追加。', { titleSize: 22, bodySize: 17, fill: C.soft });
  box(s, 0.65, 5.0, 12.0, 1.0, C.lilac);
  text(s, '改善指示の再現例', 0.9, 5.17, 2.8, 0.35, 16, C.purple, { bold: true });
  text(s, '「切断後も内容を復元して。復元できる条件と限界も説明して。」', 3.65, 5.15, 8.65, 0.5, 17.5, C.ink);
  text(s, '限界：サーバーはメモリー保持。切断後の保持は既定 300 秒で、再起動をまたぐ永続保存ではない。', 0.85, 6.32, 11.8, 0.45, 13.2, C.muted);
  notes(s, '6月26日に再接続時の状態復元、6月29日にローカル保存と切断時の Markdown 出力が加わっています。サーバー側では同じセッション ID へ再接続すると、保持している文字起こしや要約を送り直します。ただし、メモリー保持のためサーバー再起動では失われます。切断後は既定300秒でクリーンアップされます。ブラウザーの localStorage は別の保全策ですが、保存容量やブラウザーの設定に依存するため絶対的なデータ保全とは言えません。改善例と限界をセットで示すことで、Copilot に任せきりにしない開発を説明します。', [sources.main, `${root}/commit/f7b3079`, `${root}/commit/23a90e8`]);
}

// 12
{
  const s = slide('11  /  QUALITY GATES', '簡単になるのは入口。品質は、確かめて育てる', '「生成できた」ではなく、「期待どおり動く」を確認する。', '数値は実装の既定設定。性能・精度の保証値ではありません');
  const cards = [
    ['会話を正しく拾う', '日本語と話者を確認する。\n固有名詞や長時間利用も試す。', 'Speech トークン更新：8 分'],
    ['更新と復元を確かめる', '要約の更新タイミングを確認。\n切断・再接続・クリアを試す。', '要約：無発言 15 秒 / 未処理 40 行'],
    ['回答の根拠を確かめる', '引用先と回答の対応を確認。\n検索できないケースも試す。', '引用があっても原文を確認'],
  ];
  cards.forEach(([title, body, tag], i) => {
    const x = 0.65 + i * 4.1;
    card(s, x, 2.72, 3.82, 2.6, title, body, { titleSize: 20, bodySize: 16 });
    box(s, x, 5.55, 3.82, 0.75, i === 2 ? C.warm : C.soft);
    text(s, tag, x + 0.18, 5.68, 3.46, 0.47, 12.8, i === 2 ? C.amber : C.green, { bold: true });
  });
  text(s, '開発時の支援：起動・ビルド・疎通確認・変更差分のレビューを、Copilot との作業に組み込む。', 0.85, 6.55, 11.8, 0.3, 12.5, C.muted);
  notes(s, 'ここは検証すべき観点で、すべての項目を今回実施したという報告ではありません。実装上は Speech 用トークンを8分ごとに更新し、要約は会話が15秒止まるか、未処理が40行に達したときに実行します。これは固定の処理遅延や性能保証ではなく、変更可能な初期設定です。現状のリポジトリーには frontend のビルドと backend の smoke スクリプトがありますが、包括的な自動テストや本番運用実績を保証するものではありません。品質の判断は人が行います。', [sources.main, sources.speech, 'frontend/package.json: build', 'backend/smoke_test.py / smoke_mcp.py / smoke_auth.py']);
}

// 13
{
  const s = slide('12  /  ENTERPRISE READINESS', '業務導入では、「動く」の次を設計する', '試作の価値を活かしながら、本番利用の条件を明確にする。', '実装状況：コード・README ／ 将来構想は未実装として区別');
  const rows = [
    ['文字起こし・要約・文書 Q&A', '実装あり', C.soft, C.green],
    ['サービス接続：Entra ID / API キー', '実装あり', C.soft, C.green],
    ['Teams サイドパネル・字幕入力', 'コードあり / 環境検証', C.warm, C.amber],
    ['Tauri デスクトップアプリ', '計画段階', C.lilac, C.purple],
  ];
  rows.forEach(([a, b, fill, color], i) => {
    const y = 2.65 + i * 0.87;
    box(s, 0.65, y, 7.15, 0.68);
    text(s, a, 0.9, y + 0.08, 4.7, 0.49, 14.5, C.ink);
    pill(s, b, 5.72, y + 0.16, 1.86, fill, color);
  });
  box(s, 8.2, 2.65, 4.45, 3.85, C.dark);
  text(s, '導入前に決めること', 8.5, 2.97, 3.85, 0.55, 22, C.lime, { bold: true });
  text(s, '利用者の認証・アクセス制御\n会議参加者への説明と同意\nデータの保存先・保持・削除\nログ・監視・費用・運用担当\n自社文書の接続可否と権限', 8.5, 3.93, 3.85, 2.1, 16, C.white, { valign: 'top', paraSpaceAfterPt: 13 });
  text(s, 'サービス認証の実装 ≠ 利用者認証や本番運用の完成。小さな PoC で条件を検証します。', 0.85, 6.58, 11.8, 0.3, 12.5, C.muted);
  notes(s, '実装済みと今後の計画は分けて説明します。Entra ID と API キーの切替は、主として Speech と Foundry へ接続するためのサービス認証です。これを利用者認証やすべてのアクセス制御が完成したことと混同してはいけません。Teams のコードにはキャプション API を動的に探し、ない場合にはエラーを出す処理があるため、テナント、クライアント、SDK の条件を実環境で検証する必要があります。Tauri は計画文書の段階であり、この資料ではデスクトップ製品を提供済みとは説明しません。右の項目は導入時の検討事項で、セキュリティ監査の実施結果ではありません。', [sources.readme, sources.main, sources.teams, sources.desktop]);
}

// 14
{
  const s = slide('13  /  DEMO STORY', 'デモは、「話す → 調べる → 残す」の順で', '進行例：3〜5分を目安に、スタンドアロン版で体験する。', 'デモ計画の提案 ／ Azure 接続・マイク・出典の事前確認が必要');
  const steps = [
    ['開始', '日本語を選び、\nマイクを許可する'],
    ['話す', '短い議題と\n技術的な質問を話す'],
    ['見る', '文字起こしと\n要約の更新を確認'],
    ['調べる', '質問抽出を押し、\n回答と引用先を見る'],
    ['残す', 'Markdown 出力\n内容を見返す'],
  ];
  steps.forEach(([title, body], i) => {
    const x = 0.65 + i * 2.465;
    num(s, String(i + 1), x + 0.1, 2.72);
    text(s, title, x + 0.1, 3.42, 2.04, 0.5, 26, C.ink, { bold: true });
    text(s, body, x + 0.1, 4.18, 2.04, 0.92, 15, C.muted);
    if (i < 4) line(s, x + 2.22, 3.67, x + 2.405, 3.67);
  });
  box(s, 0.65, 5.6, 12.02, 1.13, C.soft);
  text(s, '発話の例', 0.9, 5.84, 1.85, 0.42, 17, C.green, { bold: true });
  text(s, '「次回までに構成案を整理します。\nAzure Speech で日本語を文字起こしするには、何が必要ですか？」', 3.0, 5.75, 9.1, 0.78, 17, C.ink);
  notes(s, 'デモではブラウザー版を推奨します。日本語を選んで開始し、議題、決定事項、技術的な疑問を短く話します。40行に達していない場合、話し終えて約15秒の無発言で要約が実行されます。その後、質問抽出ボタンを押して Q&A と引用先を確認し、Markdown を出力します。3〜5分は進行上の目安であり、ネットワークやモデル処理時間の保証ではありません。認証、マイク権限、モデルと MCP の接続を事前に確認し、ライブデモができない場合は3ページ目の説明用サンプルを使います。', [sources.readme, sources.main]);
}

// 15
{
  const s = slide('14  /  NEXT STEP', '', '', '', true);
  text(s, '「つくれそう」を、\n「動いた」に変える。', 0.65, 1.25, 11.9, 1.75, 43, C.white, { bold: true, fontFace: 'Yu Gothic' });
  text(s, 'GitHub Copilot で、実装への入口はもっと身近に。\n価値を決め、品質を確かめるのは、人。', 0.7, 3.43, 11.8, 1.0, 24, C.gray);
  [
    ['業務をひとつ選ぶ', '試したい会議や相談を決める'],
    ['小さく試作する', 'Copilot と動く単位で進める'],
    ['評価して広げる', '精度・根拠・運用条件を確かめる'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 4.1;
    box(s, x, 5.1, 3.82, 1.27, C.slate);
    text(s, title, x + 0.23, 5.31, 3.36, 0.42, 19, C.lime, { bold: true });
    text(s, body, x + 0.23, 5.92, 3.36, 0.27, 12.5, C.white);
  });
  notes(s, '本日のポイントは三つです。会議の困りごとを小さなアプリに落とし込めること、画面・バックエンド・AI・文書検索を役割ごとに組み合わせられること、そして GitHub Copilot と対話しながら実装と改善を進められることです。ただし、速さや工数削減を測定していないため数値効果は主張しません。次の一歩として、対象業務と評価条件を一つずつ決め、小さな PoC で手応えを確認する進め方をご提案します。', [sources.readme, sources.copilot]);
}

if (count !== 15) throw new Error(`Expected 15 slides, got ${count}`);
if (layoutErrors.length) throw new Error(layoutErrors.join('\n'));
pptx.writeFile({ fileName: path.join(__dirname, 'RealtimeQA_GitHub_Copilot_JA.pptx') })
  .then(() => console.log(`Created ${count} Japanese slides with speaker notes and source references.`))
  .catch(error => { console.error(error); process.exitCode = 1; });
