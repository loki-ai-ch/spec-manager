/**
 * 共享的 spec markdown 段解析工具。
 * 从 task.ts 和 harness.ts 中提取，消除循环依赖和代码重复。
 */

export const LAST_FAILED_OUTPUT_MAX_LEN = 300;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sectionBody(content: string, heading: string): string {
  const lines = content.split('\n');
  const start = lines.findIndex(line => new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`).test(line.trim()));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

export function extractVerificationCommands(content: string): string[] {
  const section = sectionBody(content, '验证命令');
  if (!section) return [];
  const commands: string[] = [];
  const fenceRe = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(section)) !== null) {
    for (const raw of match[1].split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      commands.push(line);
    }
  }
  return commands;
}

export function truncateWithEllipsis(value: string, maxLen: number): string {
  return value.length > maxLen ? value.slice(0, maxLen) + '...' : value;
}
