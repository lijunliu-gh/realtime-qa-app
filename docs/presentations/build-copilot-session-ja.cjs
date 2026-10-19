// Requires pptxgenjs. Set PPTX_TOOLS_ROOT to use an external node_modules directory.
const fs = require('fs');
const path = require('path');
const PptxGenJS = process.env.PPTX_TOOLS_ROOT
  ? require(path.join(process.env.PPTX_TOOLS_ROOT, 'pptxgenjs'))
  : require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Lijun Liu';
pptx.title = 'GitHub Copilot で、アイデアをアプリに。';
pptx.subject = '対話で始めるアプリ開発：使い方の理解、RealtimeQA の事例、最初の一歩';
pptx.company = 'RealtimeQA';
pptx.lang = 'ja-JP';
pptx.theme = { headFontFace: 'Yu Gothic', bodyFontFace: 'Meiryo', lang: 'ja-JP' };
const C = {
  ink: '20212A', dark: '101119', paper: 'F7F7FB', white: 'FFFFFF',
  purple: '7141C4', pale: 'EFE9FA', lilac: 'CDB9FF', lime: 'D4F58A',
  muted: '616275', dim: 'BCC0D1', border: 'DDDDE9', panel: '252533',
  green: '306549', mint: 'E6F2EA', warm: 'FFF0DF', amber: '895520',
};
const SH = pptx.ShapeType;
const repo = 'https://github.com/lijunliu-gh/realtime-qa-app';
const ref = file => `${repo}/blob/4d22a09/${file}`;
const src = {
  copilot: 'https://code.visualstudio.com/docs/agents/overview',
  setup: 'https://code.visualstudio.com/docs/setup/copilot',
  quickstart: 'https://code.visualstudio.com/docs/agents/quickstart',
  readme: ref('README.ja.md'), app: ref('frontend/src/App.tsx'),
  main: ref('backend/main.py'), llm: ref('backend/services/summarizer.py'),
  mcp: ref('backend/services/mcp_client.py'),
};
let n = 0;
const bounds = [];
const sections = [];
function check(x, y, w, h, label) {
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 ||
      w < 0 || h < 0 || x + w > 13.345 || y + h > 7.51) {
    bounds.push(`${n}: ${label}: ${[x, y, w, h]}`);
  }
}
function text(s, value, x, y, w, h, size = 18, color = C.ink, options = {}) {
  check(x, y, w, h, String(value).slice(0, 40));
  s.addText(value, { x, y, w, h, fontFace: 'Meiryo', fontSize: size, color,
    margin: 0, valign: 'mid', paraSpaceAfterPt: 0, ...options });
}
function box(s, x, y, w, h, fill = C.white, border = fill) {
  check(x, y, w, h, 'box');
  s.addShape(SH.roundRect, { x, y, w, h, radius: 0.13, rectRadius: 0.13,
    fill: { color: fill }, line: { color: border, width: 1 } });
}
function line(s, x1, y1, x2, y2, color = C.purple, head = true) {
  s.addShape(SH.line, { x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1,
    line: { color, width: 2, ...(head ? { endArrowType: 'triangle' } : {}) } });
}
function tag(s, value, x, y, w, fill = C.pale, color = C.purple) {
  box(s, x, y, w, 0.37, fill);
  text(s, value, x + 0.12, y, w - 0.24, 0.37, 11.5, color, { bold: true, align: 'center' });
}
function number(s, value, x, y, fill = C.pale, color = C.purple) {
  s.addShape(SH.ellipse, { x, y, w: 0.5, h: 0.5, fill: { color: fill }, line: { color: fill } });
  text(s, value, x, y, 0.5, 0.5, 16, color, { bold: true, align: 'center' });
}
function card(s, title, body, x, y, w, h, fill = C.white, size = 21, bodySize = 17) {
  box(s, x, y, w, h, fill);
  text(s, title, x + 0.25, y + 0.2, w - 0.5, 0.65, size, C.ink, { bold: true });
  text(s, body, x + 0.25, y + 1.05, w - 0.5, h - 1.23, bodySize, C.muted, { valign: 'top' });
}
function quote(s, label, value, x, y, w, h, dark = false, size = 22) {
  box(s, x, y, w, h, dark ? C.panel : C.pale);
  text(s, label, x + 0.3, y + 0.21, w - 0.6, 0.34, 11.5, dark ? C.lilac : C.purple, { bold: true });
  text(s, value, x + 0.3, y + 0.87, w - 0.6, h - 1.14, size, dark ? C.white : C.ink, { valign: 'top' });
}
function takeaway(s, value, dark = false) {
  box(s, 0.65, 6.15, 12.03, 0.56, dark ? C.panel : C.pale);
  text(s, value, 0.9, 6.22, 11.53, 0.4, 17, dark ? C.lime : C.purple, { bold: true });
}
function image(s, name, x, y, w, h) {
  const file = path.join(__dirname, 'assets', name);
  const png = fs.readFileSync(file);
  const ratio = png.readUInt32BE(16) / png.readUInt32BE(20);
  const iw = Math.min(w, h * ratio), ih = iw / ratio;
  const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
  check(ix, iy, iw, ih, name);
  s.addImage({ path: file, x: ix, y: iy, w: iw, h: ih,
    altText: 'RealtimeQA の実装画面。内容は説明用の合成データで、実際の AI 応答ではありません。' });
}
function slide(part, title = '', subtitle = '', dark = false) {
  const s = pptx.addSlide();
  n += 1;
  sections.push(part);
  s.background = { color: dark ? C.dark : C.paper };
  const stage = part === 1 ? 'PART 1  /  対話で始める開発' : part === 2 ? 'PART 2  /  実例でイメージする' : 'PART 3  /  まず一つ、試してみる';
  text(s, stage, 0.65, 0.4, 12.03, 0.31, 11, dark ? C.lilac : C.purple, { bold: true, charSpacing: 0.8 });
  if (title) text(s, title, 0.65, 1.05, 12.03, 0.76, 36, dark ? C.white : C.ink, { fontFace: 'Yu Gothic', bold: true });
  if (subtitle) text(s, subtitle, 0.65, 1.95, 12.03, 0.48, 16, dark ? C.dim : C.muted);
  text(s, 'GitHub Copilot  /  アイデアをアプリに', 0.65, 7.06, 9.8, 0.22, 9.5, dark ? C.dim : C.muted);
  text(s, String(n).padStart(2, '0'), 12.18, 7.0, 0.5, 0.3, 11, dark ? C.lilac : C.purple, { bold: true, align: 'right' });
  return s;
}
function notes(s, script, references = [], qualification = '') {
  s.addNotes(`${script}\n\n【根拠・出典】\n${references.join('\n')}\n\n【説明上の注意】\n${qualification || 'Copilot の利用可能な機能と承認操作は、契約・環境・組織ポリシーに依存します。生成された変更は人が確認します。'}\n\n資料作成日：2026年10月16日。工数削減率や開発時間など、未計測の数値効果は主張していません。`);
}
const example = '依頼文は実装内容をもとにした再構成で、実際の Copilot 対話ログの引用ではありません。機能の存在はコードや Git 記録で確認していますが、各機能を Copilot が作成したという独立した証明ではありません。';
const sample = '画面はローカルの実装 UI。表示内容は合成データで、実際のモデル応答や認識性能を実証するものではありません。未コミットの UI 変更を含みます。';

// 01
{
  const s = slide(1, '', '', true);
  tag(s, 'GitHub Copilot', 0.7, 1.0, 2.8, C.panel, C.lilac);
  text(s, 'GitHub Copilot で、\nアイデアをアプリに。', 0.7, 1.86, 11.9, 1.86, 46, C.white, { fontFace: 'Yu Gothic', bold: true });
  text(s, '対話から始める、もっと身近なソフトウェア開発', 0.75, 4.07, 11.85, 0.65, 23, C.dim);
  ['知る', '実例で見る', '試してみる'].forEach((v, i) => {
    const x = 0.75 + i * 4.13;
    box(s, x, 5.42, 3.75, 0.75, C.panel);
    number(s, String(i + 1), x + 0.16, 5.54, C.panel, C.lilac);
    text(s, v, x + 0.83, 5.53, 2.7, 0.5, 20, C.white, { bold: true });
  });
  notes(s, '今日は特定のアプリの技術講座ではありません。GitHub Copilot と対話しながら、やりたいことを動くものに近づける開発の始め方をご紹介します。前半で使い方の考え方を知り、後半では実際の RealtimeQA を題材にイメージを具体化します。最後は、皆さまが自分の仕事で試せる小さな一歩につなげます。配分は前半約45%、事例約40%、次の一歩約15%を目安に、持ち時間に合わせて調整してください。', [src.copilot]);
}

// 02
{
  const s = slide(1, '「つくりたい」はある。でも、始めにくい。', 'その最初のハードルを、対話で小さくしてみる。');
  [
    ['何から始める？', 'やりたいことはある。\nでも、進め方が見えない。'],
    ['知らない技術が多い', '全部を学んでからでないと、\n手を動かせない気がする。'],
    ['途中で止まりそう', 'エラーが出たら、\nどこを調べればよいのか。'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 4.13;
    card(s, title, body, x, 2.8, 3.77, 2.65, C.white, 23, 18);
    number(s, '?', x + 0.25, 5.61);
  });
  takeaway(s, '最初の一歩は、「どう書くか」より「何をしたいか」を伝えること。');
  notes(s, '最初に皆さまの身近な困りごとを思い浮かべていただきます。小さな管理画面や報告の整理など、作りたいものがあっても、進め方が分からず止まることがあります。Copilot は知識が不要になる魔法ではありません。ただ、相談する相手として使うことで、最初に調べることや最小の構成を整理しながら始められます。ここでは障壁への共感をつくり、次のページで支援の幅を紹介します。', [src.copilot]);
}

// 03
{
  const s = slide(1, 'Copilot は、コード補完だけではありません', '相談・実装・調査・確認を、いつもの開発環境でつなぐ。', true);
  const items = [
    ['相談する', 'やりたいことを整理する\n構成や進め方を一緒に考える'],
    ['形にする', '関連ファイルを変更する\n小さな機能を追加する'],
    ['調べる', '既存コードを理解する\nエラーの原因を絞り込む'],
    ['確かめる', 'ビルドやテストを支援する\n結果を見て修正を続ける'],
  ];
  items.forEach(([title, body], i) => {
    const x = 0.65 + (i % 2) * 6.17, y = 2.7 + Math.floor(i / 2) * 1.64;
    box(s, x, y, 5.86, 1.35, C.panel);
    text(s, title, x + 0.25, y + 0.22, 1.55, 0.6, 23, C.lilac, { bold: true });
    text(s, body, x + 2.0, y + 0.21, 3.6, 0.9, 16, C.white);
  });
  takeaway(s, '人が目的を決める。Copilot と、実装を前へ進める。', true);
  notes(s, 'Copilot を入力補完だけで捉えると、活用の幅を見落としがちです。VS Code のエージェントを使うと、関連コードを調べ、ファイルを変更し、コマンドやチェックを使いながら作業を進められます。すべてを任せるという意味ではなく、どこまで進めるか、何を採用するかは人が判断します。機能名の一覧ではなく、相談、形にする、調べる、確かめる、という仕事の場面で理解していただくページです。', [src.copilot, src.quickstart]);
}

// 04
{
  const s = slide(1, '開発を、四つの小さなステップにする', '一度のお願いで完成させるより、動かしながら具体化していく。');
  [
    ['伝える', '目的と最初の範囲を\n言葉にする'],
    ['動かす', '提案を確認して\n小さく実装する'],
    ['確かめる', '実際に触って\n期待との違いを見る'],
    ['改善する', '気づいたことを\n次の依頼にする'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 3.1;
    box(s, x, 3.0, 2.73, 2.24, i % 2 ? C.white : C.pale);
    number(s, String(i + 1), x + 0.2, 2.62);
    text(s, title, x + 0.22, 3.25, 2.29, 0.55, 27, C.ink, { bold: true });
    text(s, body, x + 0.22, 4.18, 2.29, 0.75, 17, C.muted);
    if (i < 3) line(s, x + 2.81, 4.0, x + 3.02, 4.0);
  });
  line(s, 11.5, 5.47, 11.5, 5.8, C.purple, false);
  line(s, 11.5, 5.8, 1.85, 5.8, C.purple, false);
  line(s, 1.85, 5.8, 1.85, 5.47);
  takeaway(s, '伝える → 動かす → 確かめる → 改善する。この繰り返しで育てる。');
  notes(s, 'ここがセッション全体の中心となる考え方です。まず目的と範囲を伝え、提案を確かめて実装し、実際に触り、差分を次の依頼へ戻します。一度のプロンプトですべてを完璧に指定する必要はありません。後半の事例でも同じ四つの動きを繰り返して見ていただきます。生成されたコードと実行結果は確認する、という役割もこの流れの一部です。', [src.copilot]);
}

// 05
{
  const s = slide(1, '最初のお願いは、こんな言葉でいい', '目的・最小の範囲・相談したいこと。この三つから始める。');
  quote(s, '説明用プロンプト', '社内の依頼を一覧で管理する、\n小さな Web アプリをつくりたい。\n\nまずは「追加・一覧・完了」だけにしたい。\n実装する前に、構成と動かし方を相談したい。', 0.65, 2.65, 8.1, 3.13, false, 20);
  [
    ['目的', '何のためにつくるか'],
    ['最小の範囲', '最初にできればよいこと'],
    ['まず相談', 'いきなり全部つくらない'],
  ].forEach(([title, body], i) => {
    const y = 2.74 + i * 1.0;
    number(s, String(i + 1), 9.22, y);
    text(s, title, 9.94, y, 2.7, 0.45, 20, C.ink, { bold: true });
    text(s, body, 9.22, y + 0.56, 3.43, 0.34, 14, C.muted);
  });
  takeaway(s, '最初に必要なのは、完璧な仕様書より、具体的な「やりたいこと」。');
  notes(s, 'これは架空の小さな依頼管理アプリを題材にした説明用のプロンプトです。専門用語を並べるより、誰が何のために使うか、最初に必要な範囲、まず相談したいことを伝えます。Copilot の提案には環境や要件に応じた判断が必要ですが、相談から始められること自体が重要です。実際に何らかのアプリを生成した対話の引用や、同じ結果を保証するプロンプトではありません。', [src.copilot], 'プロンプトは説明用の例であり、実際の対話ログではありません。');
}

// 06
{
  const s = slide(1, '最初から、完成形を決めなくていい', '見た結果が、次の依頼になる。');
  const stages = [
    ['一覧で見たい', '依頼の一覧', false, false],
    ['絞り込みたい', '担当者で絞り込み', true, false],
    ['持ち出したい', '絞り込み + 出力', true, true],
  ];
  stages.forEach(([request, title, filter, output], i) => {
    const x = 0.65 + i * 4.13;
    tag(s, `「${request}」`, x, 2.66, 3.77);
    box(s, x, 3.25, 3.77, 2.38, C.white, C.border);
    text(s, title, x + 0.23, 3.48, 3.31, 0.4, 17, C.ink, { bold: true });
    if (filter) {
      box(s, x + 0.23, 4.08, 2.1, 0.33, C.pale);
      text(s, '担当者を選ぶ', x + 0.35, 4.08, 1.86, 0.33, 11, C.purple);
    }
    for (let j = 0; j < 3; j++) box(s, x + 0.23, 4.6 + j * 0.23, 3.05 - j * 0.25, 0.09, C.border);
    if (output) tag(s, '出力', x + 2.65, 4.04, 0.88, C.purple, C.white);
    if (i < 2) line(s, x + 3.85, 4.5, x + 4.05, 4.5);
  });
  text(s, '説明用の画面イメージ（実際の製品画面ではありません）', 0.85, 5.8, 11.7, 0.29, 12, C.muted);
  takeaway(s, '「これもできる？」を小さく重ねて、自分に合う形へ。');
  notes(s, 'ここは説明用の画面イメージです。まず一覧が見られるようにし、次に絞り込み、最後に出力、と使いながら具体化する進め方を示します。実際の製品のビフォー・アフターや、この場で Copilot が生成した実行結果ではありません。追加を頼むときは、今できていることを維持したい、どの操作でどう変わってほしいか、といった条件も伝えます。次は、途中でうまくいかなかった場合の相談方法に移ります。', [src.copilot], '図とプロンプトは説明用のイメージで、実際の生成履歴ではありません。');
}

// 07
{
  const s = slide(1, 'うまくいかない時も、会話を続けられる', 'エラーは終わりではなく、次に調べるための材料。');
  quote(s, '説明用プロンプト', '起動すると、画面が表示されません。\nこのエラーの意味と、確認すべき箇所を教えて。\n修正したら、動作を確かめる方法も示して。', 0.65, 2.68, 8.1, 2.92, false, 20);
  box(s, 9.2, 2.68, 3.48, 2.92, C.white);
  text(s, '一緒に渡す情報', 9.44, 2.94, 3.0, 0.5, 20, C.ink, { bold: true });
  text(s, '起きた現象\n実際のエラー\n期待する動作\n試したこと', 9.44, 3.84, 3.0, 1.35, 18, C.muted, { valign: 'top' });
  takeaway(s, '原因を相談し、変更を確認し、もう一度動かす。確認までが開発。');
  notes(s, '途中で止まった時は、現象と実際のエラー、期待する動作、試したことを添えて相談できます。エラー文の意味を聞く、関連箇所を調べてもらう、修正案を出してもらう、と段階的に依頼します。修正案は必ず採用できるとは限らないため、人が差分を確認し、期待する動作を試します。抽象的な便利さの説明はここまでです。次のページから実際のアプリを題材にして、同じ流れがどこで役立つかを見ていきます。', [src.copilot], '依頼文は説明用です。特定の実行ログや、修正成功の記録ではありません。');
}

// 08
{
  const s = slide(2, '実際のアプリで、使いどころを見てみる', 'RealtimeQA：会話を記録し、要点をまとめ、技術的な疑問を調べる。', true);
  box(s, 0.62, 2.66, 12.09, 3.53, C.white);
  image(s, 'app-ja-sample.png', 0.68, 2.72, 11.97, 3.41);
  tag(s, '実装画面 / 表示内容は説明用サンプル', 0.72, 6.42, 5.5, C.panel, C.lilac);
  text(s, '会議サマリー + Q&A・参照リンク', 6.55, 6.4, 5.95, 0.42, 17, C.white);
  notes(s, 'こちらが今回の題材である RealtimeQA の実装画面です。左に会議サマリー、右に Q&A と参照先が表示されます。画面を長く機能紹介するのではなく、このようなアプリを考える時、どんな依頼ができるかという視点で見ていただきます。ここからの三つの場面は、目的を伝える、見た結果から変える、追加や不具合を相談する、という前半の考え方に結び付けます。ライブデモを行う場合はここでアプリに切り替えますが、Azure 認証や音声入力は別途事前確認が必要です。スクリーンショットの内容は説明用サンプルであり、今回の資料作成で実環境の音声認識やモデル応答を検証したものではありません。', [src.readme, src.app], sample);
}

// 09
{
  const s = slide(2, 'まずは、困りごとを一文にする', '場面 1：最初に伝えるのは、技術名ではなく実現したいこと。');
  quote(s, '依頼例（再構成）', '会議の内容を文字にして、\n要点と質問を整理したい。\n\nまずは最小の画面から考えたい。', 0.65, 2.7, 7.1, 2.95, false, 23);
  [
    ['発言を残す', '文字起こし'],
    ['要点をつかむ', '会議サマリー'],
    ['疑問を確認する', '質問抽出と Q&A'],
  ].forEach(([title, body], i) => {
    const y = 2.69 + i * 1.04;
    box(s, 8.24, y, 4.44, 0.88, i === 1 ? C.pale : C.white);
    text(s, title, 8.5, y + 0.08, 3.92, 0.36, 20, C.ink, { bold: true });
    text(s, body, 8.5, y + 0.52, 3.92, 0.27, 14, C.muted);
  });
  takeaway(s, '目的を伝えると、「何からつくるか」を相談できる。');
  notes(s, 'このアプリを考える出発点は、会議のメモと整理を楽にしたい、という身近な困りごとです。ここで最初から SDK、WebSocket、検索方式を列挙する必要はありません。まず目的を伝え、文字にする、要点をまとめる、疑問を確認する、という最小の体験へ分けて考えます。こうした要件の整理や構成の相談が Copilot の使いどころです。右側の機能は実装に存在しますが、この依頼文で一度に作られたと説明するものではありません。', [src.readme, src.main, src.copilot], example);
}

// 10
{
  const s = slide(2, '見てから、「ここを変えたい」と頼む', '場面 2：使う時に気づいたことを、次の具体的な依頼にする。');
  quote(s, '依頼例（再構成）', '回答を開閉できるようにしたい。', 0.65, 2.72, 5.62, 1.52, false, 20);
  quote(s, '依頼例（再構成）', '本文を読みやすく整えて。', 0.65, 4.54, 5.62, 1.52, false, 20);
  tag(s, '実装画面の一部 / 内容は説明用サンプル', 6.73, 2.72, 5.95);
  box(s, 6.7, 3.34, 6.01, 2.48, C.white, C.border);
  image(s, 'app-ja-qa-detail.png', 6.76, 3.4, 5.89, 2.36);
  takeaway(s, '完成形を一度に指定しなくても、見た結果から改善できる。');
  notes(s, 'この画面では Q&A を開閉でき、本文を Markdown として表示できます。Git の4951a4aには Markdown 表示と Q&A アコーディオンの変更が記録されています。ここで見ていただきたいのは UI の実装技術ではなく、使いながら気づいた要望をそのまま次の依頼へ変えられることです。左の依頼文は変更内容から再構成した例で、実際の Copilot の会話を引用したものではありません。画像は現在の UI の一部で、変更前後の比較画像ではありません。', [`${repo}/commit/4951a4a`, src.app, src.copilot], `${example}\n${sample}`);
}

// 11
{
  const s = slide(2, '「あと、これもできる？」から広げられる', '同じアプリに、小さな追加要望を重ねる。');
  const requests = [
    ['議事録を持ち帰りたい', 'Markdown エクスポート', '要約・会話・Q&A を\nまとめて出力する。', '出力イメージ：会議の要点・決定事項・次の行動'],
    ['別の言語でも共有したい', '要約の翻訳', '日本語の要約を、\n必要な言語へ翻訳する。', '表示イメージ：決定事項 → Decisions'],
  ];
  requests.forEach(([request, feature, body, sampleText], i) => {
    const x = 0.65 + i * 6.17;
    box(s, x, 2.73, 5.86, 3.23, C.white);
    tag(s, '依頼例（再構成）', x + 0.25, 2.95, 2.7);
    text(s, `「${request}」`, x + 0.25, 3.52, 5.36, 0.5, 22, C.ink, { bold: true });
    text(s, feature, x + 0.25, 4.21, 5.36, 0.4, 18, C.purple, { bold: true });
    text(s, body, x + 0.25, 4.72, 5.36, 0.61, 16, C.muted);
    text(s, sampleText, x + 0.25, 5.51, 5.36, 0.25, 11.5, C.muted);
  });
  takeaway(s, '新しい要望も、既存のアプリを出発点に相談できる。');
  notes(s, '実装には Markdown エクスポートと要約のオンデマンド翻訳があります。エクスポートは会議内容を持ち帰りたい、翻訳は別の言語でも共有したい、という業務の言葉で説明できます。お客様に覚えていただきたいのは、完成後の機能追加も Copilot に相談できるということです。機能を追加する際は、既存の動作を守る条件や、出力内容の確認も一緒に依頼します。カード下部は文字による説明用の出力イメージで、実際に今回生成した議事録や翻訳結果ではありません。', [src.readme, src.main, `${repo}/commit/9e7bd69`, src.copilot], example);
}

// 12
{
  const s = slide(2, '問題が出ても、調査と修正を相談できる', '場面 3：不具合や利用中の気づきも、改善の入口になる。');
  quote(s, '依頼例（再構成）', '接続が切れた後も、\n会議内容を見直せるようにしたい。\n\n原因と修正案を整理して。', 0.65, 2.72, 6.7, 2.98, false, 22);
  [
    ['現象を共有する', 'いつ、何が起きたか'],
    ['関連箇所を調べる', '原因と対応案を整理'],
    ['変更を確認する', '必要な修正を採用'],
    ['実際に試す', '再接続後の会議内容を確認'],
  ].forEach(([title, body], i) => {
    const y = 2.65 + i * 0.79;
    number(s, String(i + 1), 7.93, y);
    text(s, title, 8.66, y, 3.75, 0.4, 18, C.ink, { bold: true });
    text(s, body, 8.66, y + 0.43, 3.75, 0.28, 13, C.muted);
  });
  takeaway(s, 'コードの生成だけでなく、困った時の調査と改善にも使える。');
  notes(s, 'Git の f7b3079 には再接続時の状態復元、23a90e8 にはローカルバックアップと切断時出力が記録されています。ここは接続方式やメモリー管理の詳細を説明する場面ではなく、実際の改善を題材に、Copilot が調査や修正を支援する場面をイメージしていただくページです。実装の保全には限界があり、サーバー再起動をまたぐ永続 DB 保存ではありません。改善があることと全条件での復元保証は分けてください。現象や元の対話を今回再現検証したわけではありません。', [`${repo}/commit/f7b3079`, `${repo}/commit/23a90e8`, src.main, src.copilot], example);
}

// 13
{
  const s = slide(2, '技術も、役割を分けて考えればいい', 'すべてを暗記してから始めるのではなく、つなぎ方を相談しながら確かめる。');
  [
    ['画面', '会話・要約・回答を表示', 'React'],
    ['アプリの処理', '流れと状態を管理', 'FastAPI'],
    ['AI・知識', '音声認識・生成・文書検索', 'Speech / Foundry / MCP'],
  ].forEach(([title, body, tech], i) => {
    const x = 0.65 + i * 4.13;
    box(s, x, 2.82, 3.77, 2.48, i === 2 ? C.pale : C.white);
    number(s, String(i + 1), x + 0.24, 3.07, C.purple, C.white);
    text(s, title, x + 0.24, 3.8, 3.29, 0.5, 25, C.ink, { bold: true });
    text(s, body, x + 0.24, 4.53, 3.29, 0.37, 16, C.muted);
    text(s, tech, x + 0.24, 5.0, 3.29, 0.23, 11, C.purple, { bold: true });
    if (i < 2) text(s, '+', x + 3.83, 3.85, 0.25, 0.5, 25, C.purple, { bold: true });
  });
  text(s, '役割を示す概念図。音声ストリームなど、個々の通信経路は省略。', 0.85, 5.62, 11.6, 0.3, 11.5, C.muted);
  takeaway(s, 'Copilot は、この仕組みをつくる「開発」を支援する。');
  notes(s, '架構の説明はこの一枚にとどめます。画面、処理の窓口、AI と知識という役割を分け、組み合わせとして理解します。これは通信経路を正確に描いたネットワーク図ではありません。実装では音声はブラウザーの Speech SDK から Azure Speech へ送られ、認識結果以降を FastAPI が制御します。実行時の音声認識や回答生成は Speech、Foundry、MCP の検索先が担い、Copilot はそれを開発する側を支援します。技術が見えない魔法だから簡単というのではなく、分けて考え、調べながら進められることがポイントです。ここまでを短く振り返り、最後に参加者自身の最初の一歩へ移ります。', [src.readme, src.main, src.mcp, src.llm, src.copilot]);
}

// 14
{
  const s = slide(3, '明日、どの小さな困りごとから始めますか', '大きなシステムではなく、自分の仕事の一部分を題材にする。');
  [
    ['報告をまとめる', '繰り返しの作業報告を\n整理する小さな画面'],
    ['依頼を管理する', '追加・一覧・完了だけの\nシンプルな管理画面'],
    ['情報を探す', '必要な情報を見つける\n検索画面の試作'],
  ].forEach(([title, body], i) => {
    const x = 0.65 + i * 4.13;
    card(s, title, body, x, 2.73, 3.77, 2.23, C.white, 23, 17);
  });
  box(s, 0.65, 5.35, 12.03, 1.25, C.pale);
  text(s, '始める準備', 0.93, 5.59, 2.0, 0.46, 20, C.purple, { bold: true });
  text(s, 'VS Code で Copilot にサインインし、利用設定を確認。\n最初は機密情報を含まない題材と、練習用フォルダーで。', 3.22, 5.56, 8.65, 0.7, 16, C.ink);
  text(s, '公式ガイド：code.visualstudio.com/docs/setup/copilot', 3.22, 6.29, 8.65, 0.23, 11, C.purple, {
    underline: { color: C.purple }, hyperlink: { url: src.setup },
  });
  notes(s, '最後はご自身の仕事へ戻していただきます。報告、依頼管理、検索画面など、一つだけ題材を選びます。VS Code で組織から提供された GitHub アカウントや利用ルールに沿って Copilot にサインインし、練習用フォルダーを開きます。最初は機密情報を含まないデータを使い、利用上限や権限、データの扱いは組織の方針を確認してください。公式セットアップガイドへのリンクをスライドに付けています。契約による利用条件をここで細かく説明するのではなく、参加者が自分で一歩進める導線を提供します。', [src.setup, src.quickstart]);
}

// 15
{
  const s = slide(3, '', '', true);
  text(s, 'まずはひとつ、\nCopilot に相談してみましょう。', 0.7, 1.05, 11.9, 1.52, 38, C.white, { fontFace: 'Yu Gothic', bold: true });
  quote(s, 'そのまま使える相談テンプレート', '私は［業務］で、［困りごと］を解決したいです。\n小さなアプリにする案を一緒に考えてください。\nまずは最小構成と、確認する手順から提案してください。', 0.7, 3.0, 11.93, 2.28, true, 21);
  text(s, '伝える → 動かす → 確かめる → 改善する', 0.78, 5.77, 11.77, 0.5, 23, C.lime, { bold: true });
  text(s, '「自分にもできそう」を、最初の一回へ。', 0.78, 6.4, 11.77, 0.36, 17, C.dim);
  notes(s, '今日のゴールは、特定のフレームワークやこのアプリのコードを覚えることではありません。自分の小さな困りごとを一つ選び、Copilot に相談してみようと思っていただくことです。テンプレートの角括弧は意図的な記入欄です。業務と困りごとを書き換え、まず小さな案と確認手順を相談してください。必要なのは、一度で完璧にお願いすることより、伝える、動かす、確かめる、改善する、という繰り返しです。人が目的と判断を持ち、Copilot を開発の相棒として使う、というメッセージで締めます。', [src.copilot, src.setup], '角括弧の語句は参加者が書き換えるための意図的なテンプレート欄です。');
}

if (n !== 15) throw new Error(`Expected 15 slides, got ${n}`);
if (sections.filter(p => p === 1).length !== 7 ||
    sections.filter(p => p === 2).length !== 6 ||
    sections.filter(p => p === 3).length !== 2) throw new Error('Unexpected narrative allocation.');
if (bounds.length) throw new Error(bounds.join('\n'));
pptx.writeFile({ fileName: path.join(__dirname, 'GitHub_Copilot_Idea_to_App_JA.pptx') })
  .then(() => console.log('Created 15 Copilot-led slides: 7 introduction, 6 project examples, 2 next actions.'))
  .catch(error => { console.error(error); process.exitCode = 1; });
