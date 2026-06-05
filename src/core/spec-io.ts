/**
 * Spec 文件的原子读写。
 *
 * 写策略：写临时文件 → rename，保证并发下不会读到半截内容。
 * 读策略：先解析 frontmatter，找不到时返回 null（由调用方决定 fallback）。
 */

import { statSync } from 'node:fs';
import { readFrontmatter, writeFrontmatter, writeAtomic } from './frontmatter.js';
import type { SpecLevel } from './validate.js';
import { listSpecFiles, specFilePath, type ProjectPaths } from './paths.js';
import { AI_SUMMARY_MAX, PLACEHOLDER_MARKER, PLACEHOLDER_CONTENT_MAX, todayYYYYMMDD } from './constants.js';
import { hit } from './audit.js';

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
}

export interface StepFrontmatter {
  stepNo: number | string;
  stepType: 'llm_call' | 'mcp_tool' | 'human_gate';
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
    return { fm: data as unknown as SpecFrontmatter, content, filePath };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
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
}): SpecRecord {
  let parentFilePath: string | null = null;
  if (args.parentCode) {
    const parent = args.parentRecord ?? findSpecByCode(args.paths, args.parentCode);
    if (!parent) {
      throw new Error(`parentCode 指向不存在的 spec: ${args.parentCode}`);
    }
    const expectedParentLevels: Record<SpecLevel, SpecLevel[]> = {
      L0: [],
      L1: [],
      L2: ['L0', 'L1'],
      L3: ['L2'],
    };
    if (!expectedParentLevels[args.level].includes(parent.fm.level)) {
      hit({ paths: args.paths, ruleId: 'R7', specCode: args.code });
      throw new Error(
        `R7: ${args.level} 的 parent 必须是 ${expectedParentLevels[args.level].join('/')}, ` +
        `实际是 ${parent.fm.level} (${args.parentCode})`,
      );
    }
    parentFilePath = parent.filePath;
  } else if (args.level === 'L2' || args.level === 'L3') {
    hit({ paths: args.paths, ruleId: 'R7', specCode: args.code });
    throw new Error(`R7: ${args.level} 必须有 parentCode`);
  }
  const date = todayYYYYMMDD();
  const filePath = specFilePath(args.paths, parentFilePath, args.code, args.topic, date);
  const now = new Date().toISOString();
  const fm: SpecFrontmatter = {
    code: args.code,
    level: args.level,
    title: args.title,
    topic: args.topic,
    parentCode: args.parentCode,
    status: 'draft',
    milestone: args.milestone,
    created: now,
    updated: now,
  };
  const rec: SpecRecord = { fm, content: `# ${args.title}\n\n${PLACEHOLDER_MARKER}\n`, filePath };
  writeSpec(rec);
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
  patch: {
    content?: string;
    aiSummary?: string;
    changeSummary?: string;
    status?: SpecFrontmatter['status'];
    appendStep?: StepFrontmatter;
    replaceStep?: { no: number | string; step: StepFrontmatter };
    addRelation?: { type: string; target: string };
  },
): UpdateResult {
  const warnings: string[] = [];
  const existing = findSpecByCode(paths, code);
  if (!existing) {
    throw new Error(`Spec not found: ${code}`);
  }
  const fm = { ...existing.fm };
  let content = existing.content;

  if (patch.content !== undefined) content = patch.content;
  if (patch.aiSummary !== undefined) {
    if (patch.aiSummary.length > AI_SUMMARY_MAX) {
      warnings.push(`aiSummary 超过 ${AI_SUMMARY_MAX} 字符，已自动截断（原长 ${patch.aiSummary.length}）`);
      fm.aiSummary = patch.aiSummary.slice(0, AI_SUMMARY_MAX);
    } else {
      fm.aiSummary = patch.aiSummary;
    }
  }
  if (patch.changeSummary !== undefined) fm.changeSummary = patch.changeSummary;
  if (patch.status !== undefined) fm.status = patch.status;
  if (patch.appendStep) {
    fm.steps = [...(fm.steps ?? []), patch.appendStep];
  }
  if (patch.replaceStep) {
    const steps = [...(fm.steps ?? [])];
    const idx = steps.findIndex(s => String(s.stepNo) === String(patch.replaceStep!.no));
    if (idx >= 0) steps[idx] = patch.replaceStep.step;
    else steps.push(patch.replaceStep.step);
    fm.steps = steps;
  }
  if (patch.addRelation) {
    fm.relations = [...(fm.relations ?? []), patch.addRelation];
  }
  fm.updated = new Date().toISOString();

  const rec: SpecRecord = { fm, content, filePath: existing.filePath };
  writeSpec(rec);
  return { record: rec, warnings };
}

/**
 * R22: contentTemplate 是不是只剩 createSpec 写出的占位?
 * 占位 = 文件里有 marker 行,且去掉 marker 后正文长度 < PLACEHOLDER_CONTENT_MAX。
 */
export function isPlaceholderContent(content: string): boolean {
  if (!content || !content.includes(PLACEHOLDER_MARKER)) return false;
  const stripped = content.replace(PLACEHOLDER_MARKER, '').trim();
  return stripped.length < PLACEHOLDER_CONTENT_MAX;
}
