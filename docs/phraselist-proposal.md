# 方案 A：种子词表 + PhraseList 接入（细节提案）

> 目标：用 Azure Speech SDK 的 `PhraseListGrammar` 给标准浏览器模式的语音识别加一份领域术语表，提升专有名词（Azure / Foundry / Kubernetes 等）的转写准确率。
> 范围：仅前端，**不碰后端、不碰 WS 协议、不影响 Teams 字幕路径**。

---

## 1. 背景与动机

当前标准浏览器模式（[frontend/src/hooks/useSpeechRecognition.ts](../frontend/src/hooks/useSpeechRecognition.ts)）用 `ConversationTranscriber` 做转写，没有任何领域词表。技术会议里的专有名词（产品名、缩写、英文术语）经常被识别成同音词，进而污染下游的摘要、抽问、搜索。

`PhraseListGrammar` 是 Speech SDK 提供的轻量「识别偏置」机制：把一组短语喂给识别器，识别时会**优先倾向**这些词，对专有名词效果明显，且**无需训练、即时生效**。

> 注意：PhraseList 只对 **Azure Speech SDK 路径**有效。Teams 走的是 Teams 自带 Live Captions（[useTeamsTranscript.ts](../frontend/src/hooks/useTeamsTranscript.ts)），不受本方案影响，无法通过此方式优化。

---

## 2. 改动概览

```
frontend/src/
  speech/                      ← 新增目录
    phraseList.ts              ← 新增：按语言分组的种子词表 + 取词函数
  hooks/
    useSpeechRecognition.ts    ← 修改：创建 transcriber 后挂 PhraseListGrammar
```

| 文件 | 类型 | 改动 |
|---|---|---|
| `frontend/src/speech/phraseList.ts` | 新增 | 种子词表数据 + `getPhrases(language)` |
| `frontend/src/hooks/useSpeechRecognition.ts` | 修改 | import 词表，`start()` 里挂载 PhraseList |

后端、`main.py`、WS 消息、其它组件**零改动**。

---

## 3. 新增文件：`frontend/src/speech/phraseList.ts`

按语言分组（`common` 始终生效，技术英文术语放这里；各语言段放该语言特有的词）。结构示意：

```ts
// frontend/src/speech/phraseList.ts

/** 各语言都适用的术语（产品名、英文缩写等，不随 UI 语言变化）。 */
const COMMON: string[] = [
  'Azure', 'Foundry', 'Entra ID', 'Kubernetes', 'MCP',
  'FastAPI', 'WebSocket', 'Vite', 'devtunnel', 'Cosmos DB',
  'OpenAI', 'GPT', 'React', 'TypeScript',
  // …随用随加你最常被听错的词
];

/** 语言特有补充（可选）。key 用语言前缀。 */
const BY_LANG: Record<string, string[]> = {
  ja: [/* 日文场景特有术语 */],
  zh: [/* 中文场景特有术语 */],
  en: [/* 英文场景特有术语 */],
};

/**
 * 返回当前语言应加载的短语列表（common + 该语言特有，去重）。
 * @param language 形如 "ja-JP" / "zh-CN" / "en-US"
 */
export function getPhrases(language: string): string[] {
  const prefix = (language || '').split('-')[0];
  const extra = BY_LANG[prefix] ?? [];
  return Array.from(new Set([...COMMON, ...extra]));
}
```

设计要点：
- **`COMMON` 放英文技术术语**——它们在中日英会议里都会被说到，且最常被听错。
- **`BY_LANG` 留扩展位**，第一版可以全空，只填 `COMMON` 就有效果。
- **去重**，避免重复 addPhrase。
- 控制总量在**几十到一两百条**以内（PhraseList 有软上限，堆太多反而稀释偏置效果）。

---

## 4. 修改文件：`frontend/src/hooks/useSpeechRecognition.ts`

### 4.1 顶部加 import
```ts
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { getPhrases } from '../speech/phraseList';   // ← 新增
```

### 4.2 在 `start()` 里、创建 transcriber 之后挂上去
现有代码片段（定位锚点）：
```ts
const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
const transcriber = new SpeechSDK.ConversationTranscriber(speechConfig, audioConfig);

// ↓↓↓ 新增：挂载领域词表 ↓↓↓
try {
  const phraseList = SpeechSDK.PhraseListGrammar.fromRecognizer(transcriber);
  for (const phrase of getPhrases(languageRef.current)) {
    phraseList.addPhrase(phrase);
  }
} catch (err) {
  console.warn('Failed to apply phrase list (continuing without it):', err);
}
// ↑↑↑ 新增结束 ↑↑↑

transcriber.transcribed = (_sender, event) => {
  // …现有逻辑不变
};
```

设计要点：
- 用 `languageRef.current` 取当前语言对应的词表，和现有 `speechRecognitionLanguage` 保持一致。
- **try/catch 包裹**：万一 SDK 版本差异导致 API 不可用，识别照常进行，只是没有词表加成——**绝不让词表问题影响主转写功能**。
- `PhraseListGrammar.fromRecognizer(transcriber)` 对 `ConversationTranscriber` 同样适用（它也是 Recognizer 的子类）。

---

## 5. 行为与边界

| 场景 | 行为 |
|---|---|
| 切换 UI 语言后重新开始转写 | `start()` 重新执行，按新语言取词表（现有逻辑：改语言需 stop/start） |
| 运行中途改语言 | 与现状一致——需重启转写才生效（本方案不改变这一点） |
| Teams 模式 | 完全不受影响，词表不参与 |
| SDK 不支持 PhraseList | catch 兜底，转写正常、无加成 |
| 自动恢复（`canceled` 重启） | 当前恢复逻辑复用同一个 `transcriber` 实例，词表已挂在其上，**无需重新添加** |

---

## 6. 验证方法

1. 准备一句含多个易错术语的话，例如：「用 Foundry 部署 GPT，再通过 MCP 接 Entra ID 认证」。
2. 改动前后各念一遍，对比转写文本里术语的正确率。
3. 重点看 `Foundry / MCP / Entra ID` 这类专有名词是否还被转成同音词。

---

## 7. 后续可选扩展（本方案不含，仅记录）

- **方案 C：用户自填词表** — 加设置 UI + localStorage，让用户补充本场会议的黑话（项目名、人名）。结构上新增 `speech/usePhraseList.ts` 和 `components/PhraseListSettings.tsx`。
- **方案 B：自动攒词** — 从 MCP 文档标题 / 摘要里抽术语回灌 PhraseList，越用越准。需动一点数据流，建议基础版验证有效后再做。

---

## 8. 小结

新增 1 个文件（`speech/phraseList.ts`）+ 改 1 处（`useSpeechRecognition.ts` 的 `start()`），即可给标准浏览器转写加上领域术语偏置。改动隔离、有兜底、可随时回退，是提升转写准确率性价比最高的一步。第一版只需填好 `COMMON` 数组即可见效。
