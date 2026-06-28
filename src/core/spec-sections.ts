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

export interface AcceptanceCriterion {
  id: string;
  text: string;
}

export interface CriticalAcceptanceCriteriaValidation {
  acceptanceCriteria: AcceptanceCriterion[];
  criticalCriteria: AcceptanceCriterion[];
  unknown: string[];
}

export interface SectionAliasDiagnostic {
  alias: string;
  canonical: string;
  rule: 'section_alias';
  message: string;
  suggestion: string;
}

export const SECTION_HEADING_ALIASES: Record<string, string> = {
  '实施计划': '实施步骤',
  '执行计划': '实施步骤',
  '验证方式': '验证命令',
  '验证方法': '验证命令',
};

export function buildSectionAliasDiagnostics(content: string, requiredHeadings: string[]): SectionAliasDiagnostic[] {
  const headings = extractSecondLevelHeadings(content);
  const diagnostics: SectionAliasDiagnostic[] = [];
  for (const [alias, canonical] of Object.entries(SECTION_HEADING_ALIASES)) {
    if (!requiredHeadings.includes(canonical)) continue;
    if (!headings.has(alias) || headings.has(canonical)) continue;
    diagnostics.push({
      alias,
      canonical,
      rule: 'section_alias',
      message: `检测到 "## ${alias}"，规范段名应为 "## ${canonical}"。`,
      suggestion: `Rename "## ${alias}" to "## ${canonical}".`,
    });
  }
  return diagnostics;
}

export function extractAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const out: AcceptanceCriterion[] = [];
  const section = sectionBody(content, '验收标准');
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    if (!line || /@verify:/.test(line)) continue;
    const match = line.match(/^(?:[-*]|\d+\.)\s+(?:\*\*)?(AC-\d+)(?:\*\*)?\s*:?\s*(.*)$/);
    if (!match) continue;
    out.push({
      id: match[1],
      text: match[2]?.trim() ? `${match[1]}: ${match[2].trim()}` : match[1],
    });
  }
  return out;
}

export function extractCriticalAcceptanceCriteria(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const section = sectionBody(content, '关键验收标准');
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    const match = line.match(/^(?:[-*]|\d+\.)\s+(AC-\d+)\s*$/);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    out.push(match[1]);
  }
  return out;
}

export function validateCriticalAcceptanceCriteria(content: string): CriticalAcceptanceCriteriaValidation {
  const acceptanceCriteria = extractAcceptanceCriteria(content);
  const byId = new Map(acceptanceCriteria.map(item => [item.id, item]));
  const criticalIds = extractCriticalAcceptanceCriteria(content);
  const criticalCriteria: AcceptanceCriterion[] = [];
  const unknown: string[] = [];
  for (const id of criticalIds) {
    const ac = byId.get(id);
    if (ac) criticalCriteria.push(ac);
    else unknown.push(id);
  }
  return { acceptanceCriteria, criticalCriteria, unknown };
}

export function truncateWithEllipsis(value: string, maxLen: number): string {
  return value.length > maxLen ? value.slice(0, maxLen) + '...' : value;
}

function extractSecondLevelHeadings(content: string): Set<string> {
  const headings = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) headings.add(match[1].trim().replace(/[：:]+$/g, ''));
  }
  return headings;
}
