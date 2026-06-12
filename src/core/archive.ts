/**
 * Delta Archive — 把 changes/<name>/ 应用到主 specs/ 目录
 *
 * 应用顺序：RENAMED → REMOVED → MODIFIED → ADDED
 *   RENAMED:  spec 文件改名 + frontmatter code 字段改写
 *   REMOVED:  spec 文件移到 archive/（保留）
 *   MODIFIED: 把 delta 内容追加到主 spec（或用 delta 替换某个 ## 段）
 *   ADDED:    创建新 spec
 *
 * 应用后：
 *   - 把整个 changes/<name>/ 目录移到 archive/<name>/
 *   - 写入 audit：R24 命中
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, rmSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readFrontmatter, writeFrontmatter, writeAtomic } from './frontmatter.js';
import { findSpecByCode, writeSpec, createSpec, invalidateSpecCache, listAllSpecs, type SpecRecord } from './spec-io.js';
import { recordAuditHit, type AuditSink } from './audit-events.js';
import type { ProjectPaths } from './paths.js';
import type { ChangeOpT } from '../schemas/change.js';
import { withProjectTransaction } from './transaction.js';
import { listTopicMetaFiles } from './repository.js';
import {
  planArchiveChange,
  buildFinalRenameMap,
  renamedFilePath,
  renderArchiveError,
  type ArchivePlan,
  type ArchivePlanEntry,
  type ArchiveReferenceUpdate,
} from './archive-plan.js';

export interface ArchiveResult {
  changeName: string;
  applied: Array<{ op: ChangeOpT; code: string; from?: string; to?: string }>;
  skipped: Array<{ op: ChangeOpT; code: string; reason: string }>;
  archivedTo: string;
}

export function archiveChange(paths: ProjectPaths, name: string, opts?: { auditSink?: AuditSink }): ArchiveResult {
  try {
    return withProjectTransaction(paths, `archive change ${name}`, tx => {
      for (const spec of listAllSpecs(paths)) tx.snapshot(spec.filePath);
      for (const file of listTopicMetaFiles(paths, 'tasks', { extension: '.json' })) tx.snapshot(file.filePath);
      for (const file of listTopicMetaFiles(paths, 'decisions', { extension: '.md' })) tx.snapshot(file.filePath);
      return archiveChangeUnlocked(paths, name, opts);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('R24:')) {
      recordAuditHit({ paths, ruleId: 'R24' }, opts?.auditSink);
    }
    throw err;
  }
}

function archiveChangeUnlocked(paths: ProjectPaths, name: string, opts?: { auditSink?: AuditSink }): ArchiveResult {
  const plan = planArchiveChange({ paths, name });
  const applied: ArchiveResult['applied'] = [];
  const skipped: ArchiveResult['skipped'] = [];
  const tx = new ArchiveApplyTransaction();
  const archiveTarget = selectArchiveTarget(paths, name);
  const renamedCodes = buildFinalRenameMap(plan.entries);

  for (const [index, entry] of plan.entries.entries()) {
    try {
      applied.push(applyArchiveEntry(paths, plan, entry, tx, opts));
      if (entry.op === 'RENAMED' && plan.entries[index + 1]?.op !== 'RENAMED') {
        applyArchiveReferenceUpdates(paths, plan.referenceUpdates, renamedCodes, tx);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skipped.push({ op: entry.op, code: entry.code, reason });
      break;
    }
  }

  if (skipped.length > 0) {
    tx.rollback();
    throw new Error(renderArchiveError(name, skipped, 'Change 应用失败，已停止归档'));
  }

  let archivedTo: string | null = null;
  try {
    archivedTo = moveChangeToArchive(paths, name, archiveTarget);
    recordAuditHit({ paths, ruleId: 'R24' }, opts?.auditSink);
    return { changeName: name, applied, skipped, archivedTo };
  } catch (err) {
    try {
      restoreMovedChange(paths, name, archivedTo);
    } finally {
      tx.rollback();
    }
    throw err;
  }
}

function applyArchiveEntry(
  paths: ProjectPaths,
  plan: ArchivePlan,
  entry: ArchivePlanEntry,
  tx: ArchiveApplyTransaction,
  opts?: { auditSink?: AuditSink },
): ArchiveResult['applied'][number] {
  switch (entry.op) {
    case 'RENAMED': {
      if (!entry.newCode) throw new Error('RENAMED 缺 newCode');
      const spec = findSpecByCode(paths, entry.code);
      if (!spec) throw new Error(`Spec not found: ${entry.code}`);
      const newFilePath = renamedFilePath(spec, entry.newCode);
      tx.snapshot(spec.filePath);
      if (spec.filePath !== newFilePath) tx.trackCreated(newFilePath);
      const newSpec: SpecRecord = {
        ...spec,
        filePath: newFilePath,
        fm: { ...spec.fm, code: entry.newCode, updated: new Date().toISOString(), changeSummary: `delta RENAMED: ${entry.code} → ${entry.newCode}` },
      };
      writeSpec(newSpec);
      if (spec.filePath !== newFilePath && existsSync(spec.filePath)) {
        rmSync(spec.filePath, { force: true });
      }
      return { op: entry.op, code: entry.code, from: entry.code, to: entry.newCode };
    }
    case 'REMOVED': {
      const spec = findSpecByCode(paths, entry.code);
      if (!spec) throw new Error(`Spec not found: ${entry.code}`);
      tx.snapshot(spec.filePath);
      const relativePath = spec.filePath.replace(paths.root + '/', '');
      const targetPath = join(paths.changesDir, plan.changeName, relativePath);
      if (existsSync(targetPath)) throw new Error(`归档暂存目标已存在: ${targetPath}`);
      tx.ensureDirectory(dirname(targetPath));
      tx.trackCreated(targetPath);
      writeAtomic(targetPath, writeFrontmatter({ ...spec.fm, status: 'archived' } as unknown as Record<string, unknown>, spec.content));
      unlinkSync(spec.filePath);
      invalidateSpecCache(spec.filePath);
      return { op: entry.op, code: entry.code };
    }
    case 'MODIFIED': {
      const spec = findSpecByCode(paths, entry.code);
      if (!spec) throw new Error(`Spec not found: ${entry.code}`);
      if (!entry.content) throw new Error('MODIFIED 缺 content');
      tx.snapshot(spec.filePath);
      const marker = `## Delta (${plan.changeName})`;
      let newContent = spec.content;
      const re = new RegExp(`\n*${marker}[\\s\\S]*?(?=\n## |$)`, 'm');
      newContent = newContent.replace(re, '');
      newContent = newContent.trimEnd() + `\n\n${marker}\n\n${entry.content.trim()}\n`;
      const updated: SpecRecord = {
        ...spec,
        content: newContent,
        fm: { ...spec.fm, updated: new Date().toISOString(), changeSummary: entry.changeSummary ?? `delta MODIFIED` },
      };
      writeSpec(updated);
      return { op: entry.op, code: entry.code };
    }
    case 'ADDED': {
      if (findSpecByCode(paths, entry.code)) {
        throw new Error(`Spec ${entry.code} 已存在，无法 ADDED`);
      }
      const metadata = entry.metadata;
      if (!metadata) throw new Error(`ADDED 缺 metadata: ${entry.code}`);
      tx.ensureDirectory(join(paths.specsDir, metadata.topic));
      const newSpec = createSpec({
        paths,
        code: entry.code,
        level: metadata.level,
        title: metadata.title,
        topic: metadata.topic,
        parentCode: metadata.parentCode,
        parentRecord: metadata.parentRecord,
        auditSink: opts?.auditSink,
      });
      tx.trackCreated(newSpec.filePath);
      if (entry.content) {
        const updated: SpecRecord = {
          ...newSpec,
          content: entry.content,
          fm: { ...newSpec.fm, aiSummary: entry.content.slice(0, 200), changeSummary: entry.changeSummary ?? `delta ADDED` },
        };
        writeSpec(updated);
      }
      return { op: entry.op, code: entry.code };
    }
  }
}

function applyArchiveReferenceUpdates(
  paths: ProjectPaths,
  updates: ArchiveReferenceUpdate[],
  renamedCodes: Map<string, string>,
  tx: ArchiveApplyTransaction,
): void {
  for (const update of updates) {
    switch (update.kind) {
      case 'spec-parent':
      case 'spec-relation': {
        const spec = findSpecByCode(paths, updateSpecCode(update.specCode, renamedCodes));
        if (!spec) continue;
        tx.snapshot(spec.filePath);
        const fm = { ...spec.fm };
        if (update.kind === 'spec-parent' && fm.parentCode === update.oldCode) {
          fm.parentCode = update.newCode;
        }
        if (update.kind === 'spec-relation' && fm.relations?.some(relation => relation.target === update.oldCode)) {
          fm.relations = fm.relations.map(relation => relation.target === update.oldCode ? { ...relation, target: update.newCode } : relation);
        }
        writeSpec({ ...spec, fm });
        break;
      }
      case 'task-specCode': {
        const task = JSON.parse(readFileSync(update.filePath, 'utf8')) as { specCode?: string };
        if (task.specCode !== update.oldCode) continue;
        tx.snapshot(update.filePath);
        task.specCode = update.newCode;
        tx.trackCreated(update.newFilePath);
        writeAtomic(update.newFilePath, JSON.stringify(task, null, 2));
        if (update.newFilePath !== update.filePath) rmSync(update.filePath, { force: true });
        break;
      }
      case 'decision-docCode':
      case 'incident-specCode':
      case 'change-proposal-specCode': {
        const { data, content } = readFrontmatter(update.filePath);
        const field = update.kind === 'decision-docCode' ? 'docCode' : 'specCode';
        if (data[field] !== update.oldCode) continue;
        tx.snapshot(update.filePath);
        writeAtomic(update.filePath, writeFrontmatter({ ...data, [field]: update.newCode }, content));
        break;
      }
    }
  }
  invalidateSpecCache();
}

function updateSpecCode(specCode: string, renamedCodes: Map<string, string>): string {
  return renamedCodes.get(specCode) ?? specCode;
}

function selectArchiveTarget(paths: ProjectPaths, name: string): string {
  const archiveTarget = join(paths.archiveDir, name);
  if (!existsSync(archiveTarget)) return archiveTarget;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let candidate = join(paths.archiveDir, `${name}-${stamp}`);
  let suffix = 2;
  while (existsSync(candidate)) {
    candidate = join(paths.archiveDir, `${name}-${stamp}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function moveChangeToArchive(paths: ProjectPaths, name: string, archiveTarget: string): string {
  const changeRoot = join(paths.changesDir, name);
  mkdirSync(dirname(archiveTarget), { recursive: true });
  renameSync(changeRoot, archiveTarget);
  return archiveTarget;
}

function restoreMovedChange(paths: ProjectPaths, name: string, archivedTo: string | null): void {
  if (!archivedTo || !existsSync(archivedTo)) return;
  const changeRoot = join(paths.changesDir, name);
  if (existsSync(changeRoot)) return;
  mkdirSync(dirname(changeRoot), { recursive: true });
  renameSync(archivedTo, changeRoot);
}

class ArchiveApplyTransaction {
  private readonly snapshots = new Map<string, string>();
  private readonly created = new Set<string>();
  private readonly createdDirectories: string[] = [];

  snapshot(filePath: string): void {
    if (!this.snapshots.has(filePath) && existsSync(filePath)) {
      this.snapshots.set(filePath, readFileSync(filePath, 'utf8'));
    }
  }

  trackCreated(filePath: string): void {
    if (!this.snapshots.has(filePath)) {
      this.created.add(filePath);
    }
  }

  ensureDirectory(dirPath: string): void {
    const missing: string[] = [];
    let current = dirPath;
    while (!existsSync(current)) {
      missing.push(current);
      current = dirname(current);
    }
    mkdirSync(dirPath, { recursive: true });
    this.createdDirectories.push(...missing.reverse());
  }

  rollback(): void {
    for (const filePath of [...this.created].reverse()) {
      if (existsSync(filePath)) rmSync(filePath, { force: true });
    }
    for (const [filePath, content] of [...this.snapshots].reverse()) {
      writeAtomic(filePath, content);
    }
    for (const dirPath of [...this.createdDirectories].reverse()) {
      if (existsSync(dirPath)) rmdirSync(dirPath);
    }
    invalidateSpecCache();
  }
}
