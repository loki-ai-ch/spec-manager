/**
 * 规则审计（本地版）
 *
 * 数据结构（.spec-manager/audit.json）：
 * {
 *   sessionId: string,
 *   startedAt: string (ISO),
 *   topic: string,
 *   rules: { R1: 0, R2: 0, ..., R24: 0 },
 *   pending: PendingEntry[],
 *   lastUpdated: string (ISO)
 * }
 *
 * PendingEntry 字段：{ ruleId, timestamp, specCode?, taskCode? }
 *
 * at-least-once 语义：
 * - hit() 永远 append pending 队列（即使已 session-bound）
 * - report() 把 pending 中 reported=false 的标记为 reported=true
 *   （本地版"report"=标记已审计，不发任何网络请求；如未来要接远程后端，
 *    在 report() 里加 POST 即可，pending 机制不变）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProjectPaths } from './paths.js';

export const RULE_ID_RE = /^R([1-9]|1[0-9]|2[0-4])$/;
export const ALL_RULE_IDS = Array.from({ length: 24 }, (_, i) => `R${i + 1}`);

export interface PendingEntry {
  ruleId: string;
  timestamp: string;
  specCode?: string;
  taskCode?: string;
  reported: boolean;
}

export interface AuditState {
  sessionId: string;
  startedAt: string;
  topic: string;
  rules: Record<string, number>;
  pending: PendingEntry[];
  lastUpdated: string;
}

function emptyRules(): Record<string, number> {
  const r: Record<string, number> = {};
  for (const id of ALL_RULE_IDS) r[id] = 0;
  return r;
}

export function readAudit(paths: ProjectPaths): AuditState {
  if (!existsSync(paths.auditFile)) {
    return {
      sessionId: '',
      startedAt: '',
      topic: '',
      rules: emptyRules(),
      pending: [],
      lastUpdated: '',
    };
  }
  const raw = JSON.parse(readFileSync(paths.auditFile, 'utf8'));
  // 兜底：缺失 rules 时填充完整 24 条
  for (const id of ALL_RULE_IDS) {
    if (typeof raw.rules?.[id] !== 'number') {
      raw.rules = raw.rules ?? {};
      raw.rules[id] = 0;
    }
  }
  raw.pending = raw.pending ?? [];
  return raw as AuditState;
}

export function writeAudit(paths: ProjectPaths, state: AuditState): void {
  const dir = dirname(paths.auditFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.audit-${Date.now()}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  // rename 替换原文件
  renameSync(tmp, paths.auditFile);
}

export interface HitInput {
  paths: ProjectPaths;
  ruleId: string;
  specCode?: string;
  taskCode?: string;
}

export function hit(input: HitInput): AuditState {
  if (!RULE_ID_RE.test(input.ruleId)) {
    throw new Error(`ruleId 格式非法: ${input.ruleId}（必须 /^R([1-9]|1[0-9]|2[0-4])$/）`);
  }
  const state = readAudit(input.paths);
  state.rules[input.ruleId] = (state.rules[input.ruleId] ?? 0) + 1;
  state.pending.push({
    ruleId: input.ruleId,
    timestamp: new Date().toISOString(),
    specCode: input.specCode,
    taskCode: input.taskCode,
    reported: false,
  });
  state.lastUpdated = new Date().toISOString();
  writeAudit(input.paths, state);
  return state;
}

export function startSession(paths: ProjectPaths, opts: { sessionId: string; topic?: string }): AuditState {
  const state: AuditState = {
    sessionId: opts.sessionId,
    startedAt: new Date().toISOString(),
    topic: opts.topic ?? '',
    rules: emptyRules(),
    pending: [],
    lastUpdated: new Date().toISOString(),
  };
  writeAudit(paths, state);
  return state;
}

export interface ReportResult {
  markedReported: number;
  remaining: number;
}

/**
 * 标记 pending 中 reported=false 的条目为 reported=true。
 * 本地版"report"语义 = 落库到 .spec-manager/audit-archive.json
 */
export function report(paths: ProjectPaths): ReportResult {
  const state = readAudit(paths);
  let marked = 0;
  for (const e of state.pending) {
    if (!e.reported) {
      e.reported = true;
      marked++;
    }
  }
  // 把已 reported 的条目移到 archive（本地存档）
  const archivePath = join(dirname(paths.auditFile), 'audit-archive.json');
  let archive: PendingEntry[] = [];
  if (existsSync(archivePath)) {
    archive = JSON.parse(readFileSync(archivePath, 'utf8'));
  }
  archive.push(...state.pending);
  state.pending = [];
  state.lastUpdated = new Date().toISOString();
  writeAudit(paths, state);
  writeFileSync(archivePath, JSON.stringify(archive, null, 2), 'utf8');
  return { markedReported: marked, remaining: 0 };
}

export function showSummary(paths: ProjectPaths, opts?: { ruleId?: string }): string {
  const state = readAudit(paths);
  const lines: string[] = [];
  lines.push(`session: ${state.sessionId || '(无)'}  topic: ${state.topic || '(无)'}  updated: ${state.lastUpdated}`);
  lines.push('');
  lines.push('rule hit counts:');
  for (const id of ALL_RULE_IDS) {
    const n = state.rules[id] ?? 0;
    if (opts?.ruleId && opts.ruleId !== id) continue;
    const sym = n > 0 ? '✓' : '·';
    lines.push(`  ${sym} ${id}: ${n}`);
  }
  lines.push('');
  const unreported = state.pending.filter(e => !e.reported);
  lines.push(`pending: ${state.pending.length}（未 report: ${unreported.length}）`);
  return lines.join('\n');
}
