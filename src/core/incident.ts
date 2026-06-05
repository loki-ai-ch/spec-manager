/**
 * Incident 记录
 * 存储位置：.spec-manager/incidents/INC-YYYYMMDD-NNN.md
 * frontmatter：id, ruleId, severity, status, created, specCode?, taskCode?
 * 正文：触发场景、影响、临时修复、永久方案、关联 spec/task
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFrontmatter, writeFrontmatterAtomic } from './frontmatter.js';
import { RULE_ID_RE } from './audit.js';
import type { ProjectPaths } from './paths.js';
import { ID_PAD_WIDTH } from './constants.js';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'mitigated' | 'resolved' | 'closed';

export interface IncidentRecord {
  id: string;
  fm: {
    id: string;
    ruleId: string;
    severity: Severity;
    status: IncidentStatus;
    title: string;
    specCode?: string;
    taskCode?: string;
    relatedDecisions?: string[];
    created: string;
    updated: string;
  };
  content: string;
  filePath: string;
}

const VALID_SEVERITY: Severity[] = ['low', 'medium', 'high', 'critical'];

export function listIncidents(paths: ProjectPaths, opts?: { status?: IncidentStatus; relatedDecision?: string }): IncidentRecord[] {
  if (!existsSync(paths.incidentsDir)) return [];
  const out: IncidentRecord[] = [];
  for (const f of readdirSync(paths.incidentsDir)) {
    if (!f.endsWith('.md') || f.startsWith('.')) continue;
    const filePath = join(paths.incidentsDir, f);
    const { data, content } = readFrontmatter(filePath);
    const fm = data as unknown as IncidentRecord['fm'];
    if (opts?.status && fm.status !== opts.status) continue;
    if (opts?.relatedDecision && !(fm.relatedDecisions ?? []).includes(opts.relatedDecision)) continue;
    out.push({ id: fm.id, fm, content, filePath });
  }
  return out.sort((a, b) => b.fm.created.localeCompare(a.fm.created));
}

export function findIncident(paths: ProjectPaths, id: string): IncidentRecord | null {
  for (const i of listIncidents(paths)) {
    if (i.id === id || i.fm.id === id) return i;
  }
  return null;
}

export function nextIncidentId(paths: ProjectPaths): string {
  if (!existsSync(paths.incidentsDir)) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INC-${today}-001`;
  }
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INC-${today}-`;
  const existing = readdirSync(paths.incidentsDir)
    .map(f => f.match(/^INC-\d{8}-(\d+)\.md$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(m => Number(m[1]));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `${prefix}${String(max + 1).padStart(ID_PAD_WIDTH, '0')}`;
}

export interface CreateIncidentInput {
  paths: ProjectPaths;
  ruleId: string;
  severity: Severity;
  title: string;
  description?: string;
  specCode?: string;
  taskCode?: string;
  relatedDecisions?: string[];
}

export function createIncident(input: CreateIncidentInput): IncidentRecord {
  if (!RULE_ID_RE.test(input.ruleId)) {
    throw new Error(`ruleId 格式非法: ${input.ruleId}`);
  }
  if (!VALID_SEVERITY.includes(input.severity)) {
    throw new Error(`severity 非法: ${input.severity}（必须 ${VALID_SEVERITY.join('|')}）`);
  }
  if (!input.title.trim()) {
    throw new Error('title 必填');
  }
  const id = nextIncidentId(input.paths);
  const now = new Date().toISOString();
  const fm: IncidentRecord['fm'] = {
    id,
    ruleId: input.ruleId,
    severity: input.severity,
    status: 'open',
    title: input.title,
    specCode: input.specCode,
    taskCode: input.taskCode,
    relatedDecisions: input.relatedDecisions && input.relatedDecisions.length > 0
      ? input.relatedDecisions
      : undefined,
    created: now,
    updated: now,
  };
  const content = renderContent(fm, input.description ?? '');
  const filePath = join(input.paths.incidentsDir, `${id}.md`);
  writeFrontmatterAtomic(filePath, fm as unknown as Record<string, unknown>, content);
  return { id, fm, content, filePath };
}

export function updateIncidentStatus(paths: ProjectPaths, id: string, status: IncidentStatus, note?: string): IncidentRecord {
  const inc = findIncident(paths, id);
  if (!inc) throw new Error(`Incident not found: ${id}`);
  const updated: IncidentRecord = {
    ...inc,
    fm: { ...inc.fm, status, updated: new Date().toISOString() },
    content: inc.content + (note ? `\n\n## ${status} (${new Date().toISOString()})\n${note}\n` : ''),
  };
  writeFrontmatterAtomic(inc.filePath, updated.fm as unknown as Record<string, unknown>, updated.content);
  return updated;
}

function renderContent(fm: IncidentRecord['fm'], description: string): string {
  const lines: string[] = [];
  lines.push(`# ${fm.id} — ${fm.title}`);
  lines.push('');
  lines.push(`> 规则: **${fm.ruleId}**  |  严重度: **${fm.severity}**  |  状态: **${fm.status}**${fm.specCode ? `  |  spec: ${fm.specCode}` : ''}${fm.taskCode ? `  |  task: ${fm.taskCode}` : ''}`);
  lines.push('');
  lines.push(`> 创建: ${fm.created}`);
  lines.push('');
  lines.push('## 触发场景');
  lines.push(description || '（请补充）');
  lines.push('');
  lines.push('## 影响');
  lines.push('（请补充：影响范围 + 用户痛点）');
  lines.push('');
  lines.push('## 临时修复');
  lines.push('（请补充：紧急止血）');
  lines.push('');
  lines.push('## 永久方案');
  lines.push('（请补充：根因 + 长期修复）');
  lines.push('');
  lines.push('## 关联');
  lines.push('- spec: ' + (fm.specCode ?? '-'));
  lines.push('- task: ' + (fm.taskCode ?? '-'));
  lines.push('- 规则: ' + fm.ruleId);
  if (fm.relatedDecisions && fm.relatedDecisions.length > 0) {
    lines.push('- 决策: ' + fm.relatedDecisions.join(', '));
  }
  return lines.join('\n');
}
