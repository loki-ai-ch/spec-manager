/**
 * Decision Cards — 结构化 what/why/affectedCriteria
 * 存储位置：specs/<topic>/<L1-code>/decisions/<id>.md
 * 一决策一文件，frontmatter 索引元数据，正文可读详情。
 */

import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { readFrontmatter, writeFrontmatterAtomic } from './frontmatter.js';
import { siblingMetaDir, type ProjectPaths } from './paths.js';
import { findSpecByCode } from './spec-io.js';
import { DECISION_WHAT_MAX, DECISION_WHY_MAX, ID_PAD_WIDTH } from './constants.js';
import { listTopicMetaFiles } from './repository.js';

export type DecisionStatus = 'active' | 'superseded' | 'partial';

export interface DecisionRecord {
  id: string;
  fm: {
    id: string;
    docCode: string;
    topic: string;
    what: string;
    why?: string;
    status: DecisionStatus;
    supersededById: string | null;
    affectedCriteria?: string[];
    created: string;
    updated: string;
  };
  content: string;
  filePath: string;
}

const WHAT_MAX = DECISION_WHAT_MAX;
const WHY_MAX = DECISION_WHY_MAX;

export function isActiveDecision(decision: DecisionRecord): boolean {
  return decision.fm.status === 'active';
}

export function listDecisions(
  paths: ProjectPaths,
  opts?: { topic?: string; docCode?: string; includeAll?: boolean; criteria?: string | string[] },
): DecisionRecord[] {
  const out: DecisionRecord[] = [];
  const criteriaFilter = normalizeCriteriaFilter(opts?.criteria);
  const files = listTopicMetaFiles(paths, 'decisions', { topic: opts?.topic, extension: '.md' });
  for (const file of files) {
    const { data, content } = readFrontmatter(file.filePath);
    const fm = data as unknown as DecisionRecord['fm'];
    if (opts?.topic && fm.topic !== opts.topic) continue;
    if (opts?.docCode && fm.docCode !== opts.docCode) continue;
    if (!opts?.includeAll && fm.status !== 'active') continue;
    if (criteriaFilter && !decisionAffectsAny(fm.affectedCriteria, criteriaFilter)) continue;
    out.push({ id: fm.id, fm, content, filePath: file.filePath });
  }
  out.sort((a, b) => a.fm.created.localeCompare(b.fm.created));
  return out;
}

function normalizeCriteriaFilter(input: string | string[] | undefined): string[] | null {
  if (input === undefined) return null;
  const arr = Array.isArray(input) ? input : input.split(',');
  const trimmed = arr.map(s => s.trim()).filter(Boolean);
  return trimmed.length > 0 ? trimmed : null;
}

function decisionAffectsAny(affected: string[] | undefined, criteria: string[]): boolean {
  if (!affected || affected.length === 0) return false;
  const set = new Set(affected);
  return criteria.some(c => set.has(c));
}

export function findDecision(paths: ProjectPaths, id: string): DecisionRecord | null {
  for (const d of listDecisions(paths, { includeAll: true })) {
    if (d.id === id || d.fm.id === id) return d;
  }
  return null;
}

export function nextDecisionId(paths: ProjectPaths, topic: string): string {
  let max = 0;
  for (const file of listTopicMetaFiles(paths, 'decisions', { topic, extension: '.md' })) {
    const m = file.fileName.match(/^DC-(\d+)\.md$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `DC-${String(max + 1).padStart(ID_PAD_WIDTH, '0')}`;
}

export interface CreateDecisionInput {
  paths: ProjectPaths;
  docCode: string;
  topic: string;
  what: string;
  why?: string;
  affectedCriteria?: string[];
}

export function createDecision(input: CreateDecisionInput): DecisionRecord {
  // R18: confirmed L1 可在最后一个 Task 完成前预建决策；implemented L1 可继续补充。
  const spec = findSpecByCode(input.paths, input.docCode);
  if (!spec) {
    throw new Error(`Spec not found: ${input.docCode}`);
  }
  if (spec.fm.level !== 'L1') {
    throw new Error(`Decision card 只能关联 L1 spec，${input.docCode} 是 ${spec.fm.level}`);
  }
  if (spec.fm.status !== 'confirmed' && spec.fm.status !== 'implemented') {
    throw new Error(`R18: L1 必须 confirmed 或 implemented 才能建决策卡片，当前 status=${spec.fm.status}`);
  }
  if (input.what.length > WHAT_MAX) {
    throw new Error(`what 长度 ${input.what.length} > ${WHAT_MAX}`);
  }
  if (input.why && input.why.length > WHY_MAX) {
    throw new Error(`why 长度 ${input.why.length} > ${WHY_MAX}`);
  }
  const id = nextDecisionId(input.paths, input.topic);
  const now = new Date().toISOString();
  const fm: DecisionRecord['fm'] = {
    id,
    docCode: input.docCode,
    topic: input.topic,
    what: input.what,
    why: input.why,
    status: 'active',
    supersededById: null,
    affectedCriteria: input.affectedCriteria,
    created: now,
    updated: now,
  };
  const content = renderContent(fm);
  const filePath = join(siblingMetaDir(spec.filePath, 'decisions'), `${id}.md`);
  writeFrontmatterAtomic(filePath, fm as unknown as Record<string, unknown>, content);
  return { id, fm, content, filePath };
}

export function supersedeDecision(paths: ProjectPaths, oldId: string, newId: string): void {
  const old = findDecision(paths, oldId);
  if (!old) throw new Error(`Decision not found: ${oldId}`);
  const newDec = findDecision(paths, newId);
  if (!newDec) throw new Error(`New decision not found: ${newId}`);
  const updated: DecisionRecord = {
    ...old,
    fm: {
      ...old.fm,
      status: 'superseded',
      supersededById: newId,
      updated: new Date().toISOString(),
    },
  };
  updated.content = renderContent(updated.fm);
  writeFrontmatterAtomic(old.filePath, updated.fm as unknown as Record<string, unknown>, updated.content);
}

function renderContent(fm: DecisionRecord['fm']): string {
  const lines: string[] = [];
  lines.push(`# ${fm.id} — ${fm.what}`);
  lines.push('');
  lines.push(`> 关联 spec: **${fm.docCode}**  |  状态: **${fm.status}**${fm.supersededById ? `  |  被 ${fm.supersededById} 取代` : ''}`);
  lines.push('');
  lines.push('## 决定');
  lines.push(fm.what);
  lines.push('');
  if (fm.why) {
    lines.push('## 为什么');
    lines.push(fm.why);
    lines.push('');
  }
  if (fm.affectedCriteria && fm.affectedCriteria.length > 0) {
    lines.push('## 影响的验收标准');
    for (const c of fm.affectedCriteria) lines.push(`- ${c}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 删除决策。仅 active 状态可删;superseded/partial 状态需先恢复或归档(避免丢失审计轨迹)。
 */
export function deleteDecision(paths: ProjectPaths, id: string): void {
  const d = findDecision(paths, id);
  if (!d) throw new Error(`Decision not found: ${id}`);
  if (d.fm.status !== 'active') {
    throw new Error(
      `Decision ${id} 是 ${d.fm.status} 状态,不能直接删除;` +
      `如确需删除,先用 set-partial 标记或 supersede 取代`,
    );
  }
  unlinkSync(d.filePath);
}

export interface UpdateDecisionInput {
  paths: ProjectPaths;
  id: string;
  what?: string;
  why?: string;
  affectedCriteria?: string[];
}

/**
 * 编辑决策的 what/why/affectedCriteria。状态变更走 supersede / set-partial。
 * superseded 状态的决策不可编辑（避免改历史）。
 */
export function updateDecision(input: UpdateDecisionInput): DecisionRecord {
  const existing = findDecision(input.paths, input.id);
  if (!existing) throw new Error(`Decision not found: ${input.id}`);
  if (existing.fm.status !== 'active') {
    throw new Error(`不能编辑 ${existing.fm.status} 状态的决策(只能编辑 active);用 supersede / set-partial 推进`);
  }
  if (input.what === undefined && input.why === undefined && input.affectedCriteria === undefined) {
    throw new Error('未提供任何可更新字段(what/why/affectedCriteria)');
  }
  if (input.what !== undefined && input.what.length > WHAT_MAX) {
    throw new Error(`what 长度 ${input.what.length} > ${WHAT_MAX}`);
  }
  if (input.why !== undefined && input.why.length > WHY_MAX) {
    throw new Error(`why 长度 ${input.why.length} > ${WHY_MAX}`);
  }
  const fm: DecisionRecord['fm'] = {
    ...existing.fm,
    what: input.what ?? existing.fm.what,
    why: input.why ?? existing.fm.why,
    affectedCriteria: input.affectedCriteria ?? existing.fm.affectedCriteria,
    updated: new Date().toISOString(),
  };
  const content = renderContent(fm);
  writeFrontmatterAtomic(existing.filePath, fm as unknown as Record<string, unknown>, content);
  return { id: existing.id, fm, content, filePath: existing.filePath };
}

export interface SetPartialInput {
  paths: ProjectPaths;
  id: string;
  reason: string;
}

/**
 * 把决策标记为 partial(部分被取代/部分作废),需 --reason 解释。
 * 区别于 supersede:partial 不指向新决策 ID,只标记"局部失效"。
 */
export function setDecisionPartial(input: SetPartialInput): DecisionRecord {
  const existing = findDecision(input.paths, input.id);
  if (!existing) throw new Error(`Decision not found: ${input.id}`);
  if (existing.fm.status !== 'active') {
    throw new Error(`Decision ${input.id} 已经是 ${existing.fm.status},无需重复标记`);
  }
  if (!input.reason.trim()) {
    throw new Error('partial 必须提供 reason(说明哪些部分失效 / 为什么)');
  }
  const fm: DecisionRecord['fm'] = {
    ...existing.fm,
    status: 'partial',
    supersededById: null,
    updated: new Date().toISOString(),
  };
  const content = renderContent(fm) + `\n## Partial 标记\n\n${input.reason}\n`;
  writeFrontmatterAtomic(existing.filePath, fm as unknown as Record<string, unknown>, content);
  return { id: existing.id, fm, content, filePath: existing.filePath };
}
