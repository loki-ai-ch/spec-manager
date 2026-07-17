/**
 * Spec 文件的原子读写。
 *
 * 写策略：写临时文件 → rename，保证并发下不会读到半截内容。
 * 读策略：先解析 frontmatter，找不到时返回 null（由调用方决定 fallback）。
 */

import { existsSync, renameSync, statSync } from 'node:fs';
import { readFrontmatter, writeFrontmatter, writeAtomic } from './frontmatter.js';
import type { SpecLevel } from './validate.js';
import {
  assertSafeSpecCode,
  assertSafeTopic,
  listSpecFiles,
  listSpecPathMigrations,
  type ProjectPaths,
  type SpecFileEntry,
} from './paths.js';
import type { AuditSink } from './audit-events.js';
import { SpecFrontmatterSchema } from '../schemas/spec.js';
import type { ImplementationAuthority } from './status.js';
import type { HistoryReviewT, ScopePlanT } from '../schemas/spec.js';
import {
  applySpecUpdatePolicy,
  buildInitialSpecRecord,
  recordCreateSpecAudit,
  recordUpdatedSpecAudit,
  validateSpecParentPolicy,
  type SpecUpdatePatch,
} from './spec-policy.js';
export { isPlaceholderContent } from './placeholder.js';

export interface SpecFrontmatter {
  id?: string;
  code: string;
  level: SpecLevel;
  title: string;
  topic: string;
  parentCode: string | null;
  status: 'draft' | 'confirmed' | 'frozen' | 'implemented' | 'archived';
  milestone?: string;
  aiSummary?: string;
  coveredTasks?: string[];
  steps?: StepFrontmatter[];
  relations?: Array<{ type: string; target: string }>;
  created?: string;
  updated?: string;
  changeSummary?: string;
  historyReview?: HistoryReviewT;
  scopePlan?: ScopePlanT;
  deliveryLearning?: boolean;
  deliveryLearningReason?: string;
}

export interface StepFrontmatter {
  stepNo: number | string;
  stepType: 'llm_call' | 'tool_action' | 'human_gate';
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  toolName?: string;
  inputJson?: string;
  outputJson?: string;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
  reportedAt?: string;
}

export interface SpecRecord {
  fm: SpecFrontmatter;
  content: string;
  filePath: string;
}

export const DESC_MAX_LEN = 15;

/**
 * 生成 spec code: 点分编号，层级自文档化。
 * - L1: <topic>-L1
 * - L2: <topic>-L2.1（第 1 个 L2 子 spec）
 * - L3: <topic>-L3.1.1[-desc]（可选描述后缀，≤15 字符）
 *
 * parentCode 为空时生成 <topic>-<level>；
 * 非空时生成 <topic>-<level>.<N>[.M...][-desc]。
 */
export function generateSpecCode(
  topic: string,
  level: SpecLevel,
  parentCode?: string,
  siblingCount?: number,
  desc?: string,
): string {
  if (!parentCode) {
    return desc ? `${topic}-${level}-${desc}` : `${topic}-${level}`;
  }
  const idx = (siblingCount ?? 0) + 1;
  const match = parentCode.match(/^(.+)-L\d+(.*)$/);
  const base = match
    ? `${match[1]}-${level}${match[2]}.${idx}`
    : `${topic}-${level}.${idx}`;
  return desc ? `${base}-${desc}` : base;
}

export function readSpec(filePath: string): SpecRecord | null {
  try {
    const { data, content } = readFrontmatter(filePath);
    const normalized = {
      ...data,
      created: normalizeDateValue(data.created),
      updated: normalizeDateValue(data.updated),
    };
    const parsed = SpecFrontmatterSchema.parse(normalized);
    return { fm: parsed as SpecFrontmatter, content, filePath };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function normalizeDateValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

export function findSpecByCode(paths: ProjectPaths, code: string): SpecRecord | null {
  const all = listAllSpecs(paths);
  return all.find(s => s.fm.code === code) ?? null;
}

interface CachedEntry {
  mtimeMs: number;
  record: SpecRecord;
}

const specCache = new Map<string, CachedEntry>();

/**
 * 带 mtime 失效的 listAllSpecs。文件未变时复用内存里的解析结果,
 * 避免每次 decision/task/archive/delta 全扫都重新 parse frontmatter。
 *
 * 注意:单进程内有效;多进程或显式调 invalidateSpecCache() 失效。
 */
export function listAllSpecs(paths: ProjectPaths): SpecRecord[] {
  const files = listSpecFiles(paths);
  const out: SpecRecord[] = [];
  for (const f of files) {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(f.filePath).mtimeMs;
    } catch {
      // file gone — drop from cache, skip
      specCache.delete(f.filePath);
      continue;
    }
    const cached = specCache.get(f.filePath);
    if (cached && cached.mtimeMs === mtimeMs) {
      out.push(cached.record);
      continue;
    }
    const rec = readSpec(f.filePath);
    if (rec) {
      validateSpecFileIdentity(f, rec);
      specCache.set(f.filePath, { mtimeMs, record: rec });
      out.push(rec);
    }
  }
  return out;
}

export function invalidateSpecCache(filePath?: string): void {
  if (filePath) {
    specCache.delete(filePath);
  } else {
    specCache.clear();
  }
}

/**
 * 原子写：先写临时文件，再 rename。
 */
export function writeSpec(record: SpecRecord): void {
  const out = writeFrontmatter(record.fm as unknown as Record<string, unknown>, record.content);
  writeAtomic(record.filePath, out);
  invalidateSpecCache(record.filePath);
}

export function createSpec(args: {
  paths: ProjectPaths;
  code: string;
  level: SpecLevel;
  title: string;
  topic: string;
  parentCode: string | null;
  parentRecord?: SpecRecord | null;
  milestone?: string;
  auditSink?: AuditSink;
}): SpecRecord {
  const policyInput = { ...args, findSpecByCode };
  const parentPolicy = validateSpecParentPolicy(policyInput);
  const { record: rec } = buildInitialSpecRecord(policyInput, parentPolicy);
  writeSpec(rec);
  recordCreateSpecAudit(policyInput);
  return rec;
}

/**
 * 更新 spec：传 partial 覆盖 frontmatter，更新 content，更新 updated 时间戳。
 * 自动截断 aiSummary 到 300 字符（带 warning）。
 */
export interface UpdateResult {
  record: SpecRecord;
  warnings: string[];
}

export function updateSpec(
  paths: ProjectPaths,
  code: string,
  patch: SpecUpdatePatch,
  opts?: { auditSink?: AuditSink; transitionAuthority?: ImplementationAuthority },
): UpdateResult {
  const existing = findSpecByCode(paths, code);
  if (!existing) {
    throw new Error(`Spec not found: ${code}`);
  }

  const policyInput = {
    paths,
    code,
    existing,
    patch,
    auditSink: opts?.auditSink,
    transitionAuthority: opts?.transitionAuthority,
    findSpecByCode,
  };
  const result = applySpecUpdatePolicy(policyInput);
  writeSpec(result.record);
  recordUpdatedSpecAudit(policyInput);
  return result;
}

function validateSpecFileIdentity(entry: SpecFileEntry, record: SpecRecord): void {
  assertSafeTopic(entry.topic);
  assertSafeSpecCode(entry.code);
  if (record.fm.code !== entry.code) {
    throw new Error(`Spec 文件名和 frontmatter code 不一致: ${entry.filePath} (filename=${entry.code}, fm=${record.fm.code})`);
  }
  if (record.fm.topic !== entry.topic) {
    throw new Error(`Spec 目录和 frontmatter topic 不一致: ${entry.filePath} (dir=${entry.topic}, fm=${record.fm.topic})`);
  }
}

export interface SpecPathMigrationResult {
  dryRun: boolean;
  migrated: Array<{ code: string; from: string; to: string }>;
}

export function migrateSpecPaths(paths: ProjectPaths, opts?: { dryRun?: boolean }): SpecPathMigrationResult {
  const migrations = listSpecPathMigrations(paths);
  const errors: string[] = [];
  for (const m of migrations) {
    try {
      assertSafeTopic(m.topic);
      assertSafeSpecCode(m.code);
      const rec = readSpec(m.from);
      if (!rec) throw new Error('无法读取 spec');
      validateSpecFileIdentity({ topic: m.topic, code: m.code, filePath: m.from }, rec);
      if (existsSync(m.to)) throw new Error(`目标文件已存在: ${m.to}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${m.from}: ${reason}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`spec path migration 预检失败:\n${errors.join('\n')}`);
  }
  if (!opts?.dryRun) {
    for (const m of migrations) {
      renameSync(m.from, m.to);
      invalidateSpecCache(m.from);
      invalidateSpecCache(m.to);
    }
  }
  return {
    dryRun: opts?.dryRun ?? false,
    migrated: migrations.map(m => ({ code: m.code, from: m.from, to: m.to })),
  };
}
