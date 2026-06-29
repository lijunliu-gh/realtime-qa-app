import type { TranscriptLine, Question } from './App';

/**
 * Generate Markdown meeting notes from current session state.
 */
export function generateSessionMarkdown(
  transcript: TranscriptLine[],
  summary: string,
  questions: Question[],
): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const lines: string[] = [];

  lines.push(`# Meeting Notes — ${now}\n`);

  // Summary
  lines.push('## Summary\n');
  lines.push(summary ? summary + '\n' : '_（No summary）_\n');

  // Transcript
  lines.push('## Transcript\n');
  if (transcript.length > 0) {
    for (const ln of transcript) {
      lines.push(`- **${ln.speaker}**: ${ln.text}`);
    }
    lines.push('');
  } else {
    lines.push('_（No transcript）_\n');
  }

  // Q&A
  if (questions.length > 0) {
    lines.push('## Q&A\n');
    for (const q of questions) {
      lines.push(`### Q${q.id}. ${q.text}\n`);
      if (q.answer) {
        lines.push(q.answer + '\n');
        if (q.citations && q.citations.length > 0) {
          lines.push('**References:**\n');
          for (const c of q.citations) {
            lines.push(`- [${c.title}](${c.url})`);
          }
          lines.push('');
        }
      } else {
        lines.push('_（Pending）_\n');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Trigger a file download in the browser from a string content.
 */
export function downloadMarkdown(content: string, filename?: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `meeting-notes-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
