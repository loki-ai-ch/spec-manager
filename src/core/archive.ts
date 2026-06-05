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

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { readFrontmatter, writeFrontmatter, writeAtomic } from './frontmatter.js';
import { parseDeltaSpec, getChangeDir } from './delta.js';
import { findSpecByCode, readSpec, writeSpec, createSpec, invalidateSpecCache, listAllSpecs, type SpecRecord } from './spec-io.js';
import { recordAuditHit, type AuditSink } from './audit-events.js';
import { assertSafeSpecCode, assertSafeTopic, type ProjectPaths } from './paths.js';
import { ProposalSchema, type ChangeEntry, type ChangeOpT } from '../schemas/change.js';

export interface ArchiveResult {
  changeName: string;
  applied: Array<{ op: ChangeOpT; code: string; from?: string; to?: string }>;
  skipped: Array<{ op: ChangeOpT; code: string; reason: string }>;
  archivedTo: string;
}

export function archiveChange(paths: ProjectPaths, name: string, opts?: { auditSink?: AuditSink }): ArchiveResult {
  validateChangeProposal(paths, name, opts?.auditSink);

  // 1. 解析 delta
  const delta = parseDeltaSpec(paths, name);

  // 2. 按顺序应用
  const order: ChangeOpT[] = ['RENAMED', 'REMOVED', 'MODIFIED', 'ADDED'];
  const applied: ArchiveResult['applied'] = [];
  const skipped: ArchiveResult['skipped'] = [];

  const sortedEntries = [...delta.changes].sort((a, b) => {
    return order.indexOf(a.op) - order.indexOf(b.op);
  });
  preflightArchive(paths, name, sortedEntries);
  const tx = new ArchiveApplyTransaction();

  for (const e of sortedEntries) {
    try {
      switch (e.op) {
        case 'RENAMED': {
          if (!e.newCode) throw new Error('RENAMED 缺 newCode');
          const spec = findSpecByCode(paths, e.code);
          if (!spec) throw new Error(`Spec not found: ${e.code}`);
          const newFilePath = renamedFilePath(spec, e.newCode);
          tx.snapshot(spec.filePath);
          if (spec.filePath !== newFilePath) tx.trackCreated(newFilePath);
          const newSpec: SpecRecord = {
            ...spec,
            filePath: newFilePath,
            fm: { ...spec.fm, code: e.newCode, updated: new Date().toISOString(), changeSummary: `delta RENAMED: ${e.code} → ${e.newCode}` },
          };
          writeSpec(newSpec);
          // 平铺布局下旧文件已被 writeSpec 覆盖（同 topic 目录），需显式删除旧文件
          if (spec.filePath !== newFilePath && existsSync(spec.filePath)) {
            rmSync(spec.filePath, { force: true });
          }
          applied.push({ op: e.op, code: e.code, from: e.code, to: e.newCode });
          break;
        }
        case 'REMOVED': {
          const spec = findSpecByCode(paths, e.code);
          if (!spec) throw new Error(`Spec not found: ${e.code}`);
          tx.snapshot(spec.filePath);
          // 移到 archive/<name>/<relative-path>
          const archivePath = join(paths.archiveDir, name);
          mkdirSync(archivePath, { recursive: true });
          const relativePath = spec.filePath.replace(paths.root + '/', '');
          const targetPath = join(archivePath, relativePath);
          tx.trackCreated(targetPath);
          writeAtomic(targetPath, writeFrontmatter({ ...spec.fm, status: 'archived' } as unknown as Record<string, unknown>, spec.content));
          // 删主 spec
          unlinkSync(spec.filePath);
          invalidateSpecCache(spec.filePath);
          applied.push({ op: e.op, code: e.code });
          break;
        }
        case 'MODIFIED': {
          const spec = findSpecByCode(paths, e.code);
          if (!spec) throw new Error(`Spec not found: ${e.code}`);
          if (!e.content) throw new Error('MODIFIED 缺 content');
          tx.snapshot(spec.filePath);
          // 简单策略：追加 delta 内容到主 spec 的正文末尾（带 ## Delta 段标识）
          const marker = `## Delta (${name})`;
          let newContent = spec.content;
          // 移除旧的 delta 段（如果存在）
          const re = new RegExp(`\n*${marker}[\\s\\S]*?(?=\n## |$)`, 'm');
          newContent = newContent.replace(re, '');
          newContent = newContent.trimEnd() + `\n\n${marker}\n\n${e.content.trim()}\n`;
          const updated: SpecRecord = {
            ...spec,
            content: newContent,
            fm: { ...spec.fm, updated: new Date().toISOString(), changeSummary: e.changeSummary ?? `delta MODIFIED` },
          };
          writeSpec(updated);
          applied.push({ op: e.op, code: e.code });
          break;
        }
        case 'ADDED': {
          if (findSpecByCode(paths, e.code)) {
            throw new Error(`Spec ${e.code} 已存在，无法 ADDED`);
          }
          const dir = getChangeDir(paths, name);
          let topic = '';
          let placeholder: SpecRecord | null = null;
          if (dir) {
            for (const f of dir.specFiles) {
              if (f.endsWith(`/${e.code}.md`)) {
                topic = basename(dirname(dirname(f)));
                const rec = readSpec(f);
                if (rec) placeholder = rec;
                break;
              }
            }
          }
          if (!topic) {
            throw new Error(`无法推断 ${e.code} 的 topic（请把占位文件放在 changes/${name}/specs/<topic>/${e.code}/${e.code}.md）`);
          }
          const finalLevel = (placeholder?.fm.level ?? e.level) as 'L0' | 'L1' | 'L2' | 'L3' | undefined;
          const finalTitle = placeholder?.fm.title ?? e.title;
          const finalParent = placeholder?.fm.parentCode ?? e.parentCode ?? null;
          if (!finalLevel) throw new Error(`ADDED 缺 level（占位文件 frontmatter 也未指定）`);
          if (!finalTitle) throw new Error(`ADDED 缺 title（占位文件 frontmatter 也未指定）`);
          let parentRecord: SpecRecord | null = null;
          if (finalParent) {
            parentRecord = findSpecByCode(paths, finalParent);
            if (!parentRecord) throw new Error(`parentCode 指向不存在的 spec: ${finalParent}`);
          }
          const newSpec = createSpec({
            paths,
            code: e.code,
            level: finalLevel,
            title: finalTitle,
            topic,
            parentCode: finalParent,
            parentRecord,
            auditSink: opts?.auditSink,
          });
          tx.trackCreated(newSpec.filePath);
          if (e.content) {
            const updated: SpecRecord = {
              ...newSpec,
              content: e.content,
              fm: { ...newSpec.fm, aiSummary: e.content.slice(0, 200), changeSummary: e.changeSummary ?? `delta ADDED` },
            };
            writeSpec(updated);
          }
          applied.push({ op: e.op, code: e.code });
          break;
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skipped.push({ op: e.op, code: e.code, reason });
      break;
    }
  }

  if (skipped.length > 0) {
    tx.rollback();
    throw new Error(renderArchiveError(name, skipped, 'Change 应用失败，已停止归档'));
  }

  // 3. 把 changes/<name>/ 整体移到 archive/<name>/
  const changeRoot = join(paths.changesDir, name);
  const archiveTarget = join(paths.archiveDir, name);
  if (existsSync(archiveTarget)) {
    // 已存在：加时间戳
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalTarget = join(paths.archiveDir, `${name}-${stamp}`);
    mkdirSync(dirname(finalTarget), { recursive: true });
    renameSync(changeRoot, finalTarget);
    recordAuditHit({ paths, ruleId: 'R24' }, opts?.auditSink);
    return { changeName: name, applied, skipped, archivedTo: finalTarget };
  } else {
    mkdirSync(paths.archiveDir, { recursive: true });
    renameSync(changeRoot, archiveTarget);
    recordAuditHit({ paths, ruleId: 'R24' }, opts?.auditSink);
    return { changeName: name, applied, skipped, archivedTo: archiveTarget };
  }
}

class ArchiveApplyTransaction {
  private readonly snapshots = new Map<string, string>();
  private readonly created = new Set<string>();

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

  rollback(): void {
    for (const filePath of [...this.created].reverse()) {
      if (existsSync(filePath)) rmSync(filePath, { force: true });
    }
    for (const [filePath, content] of [...this.snapshots].reverse()) {
      writeAtomic(filePath, content);
    }
    invalidateSpecCache();
  }
}

function validateChangeProposal(paths: ProjectPaths, name: string, auditSink?: AuditSink): void {
  const dir = getChangeDir(paths, name);
  if (!dir) throw new Error(`Change not found: ${name}`);
  if (!existsSync(dir.proposal)) {
    recordAuditHit({ paths, ruleId: 'R24' }, auditSink);
    throw new Error(`R24: delta change 必须包含 proposal.md`);
  }
  try {
    const { data } = readFrontmatter(dir.proposal);
    ProposalSchema.parse(data);
  } catch (err) {
    recordAuditHit({ paths, ruleId: 'R24' }, auditSink);
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`R24: proposal.md 必须填写 why/scope 并通过 schema 校验: ${reason}`);
  }
}

function preflightArchive(paths: ProjectPaths, name: string, entries: ChangeEntry[]): void {
  const specsByCode = new Map(listAllSpecs(paths).map(s => [s.fm.code, s]));
  const errors: ArchiveResult['skipped'] = [];

  for (const e of entries) {
    try {
      switch (e.op) {
        case 'RENAMED': {
          if (!e.newCode) throw new Error('RENAMED 缺 newCode');
          assertSafeSpecCode(e.newCode);
          const spec = specsByCode.get(e.code);
          if (!spec) throw new Error(`Spec not found: ${e.code}`);
          if (e.newCode === e.code) throw new Error('RENAMED 的 newCode 不能等于原 code');
          if (specsByCode.has(e.newCode)) throw new Error(`目标 spec 已存在: ${e.newCode}`);
          const newFilePath = renamedFilePath(spec, e.newCode);
          if (existsSync(newFilePath) && newFilePath !== spec.filePath) {
            throw new Error(`目标文件已存在: ${newFilePath}`);
          }
          specsByCode.delete(e.code);
          specsByCode.set(e.newCode, { ...spec, fm: { ...spec.fm, code: e.newCode }, filePath: newFilePath });
          break;
        }
        case 'REMOVED': {
          if (!specsByCode.has(e.code)) throw new Error(`Spec not found: ${e.code}`);
          specsByCode.delete(e.code);
          break;
        }
        case 'MODIFIED': {
          if (!specsByCode.has(e.code)) throw new Error(`Spec not found: ${e.code}`);
          if (!e.content) throw new Error('MODIFIED 缺 content');
          break;
        }
        case 'ADDED': {
          assertSafeSpecCode(e.code);
          if (specsByCode.has(e.code)) throw new Error(`Spec ${e.code} 已存在，无法 ADDED`);
          const meta = resolveAddedMetadata(paths, name, e);
          assertSafeTopic(meta.topic);
          validateParentForAdded(specsByCode, e.code, meta.level, meta.parentCode);
          specsByCode.set(e.code, {
            fm: {
              code: e.code,
              level: meta.level,
              title: meta.title,
              topic: meta.topic,
              parentCode: meta.parentCode,
              status: 'draft',
            },
            content: '',
            filePath: '',
          });
          break;
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({ op: e.op, code: e.code, reason });
    }
  }

  if (errors.length > 0) {
    throw new Error(renderArchiveError(name, errors, 'Change 预检失败，未修改 specs 且未归档'));
  }
}

function renamedFilePath(spec: SpecRecord, newCode: string): string {
  const specDir = dirname(spec.filePath);
  return join(specDir, `${newCode}.md`);
}

function resolveAddedMetadata(
  paths: ProjectPaths,
  name: string,
  entry: ChangeEntry,
): { topic: string; level: 'L0' | 'L1' | 'L2' | 'L3'; title: string; parentCode: string | null } {
  const dir = getChangeDir(paths, name);
  let topic = '';
  let placeholder: SpecRecord | null = null;
  if (dir) {
    for (const f of dir.specFiles) {
      if (f.endsWith(`/${entry.code}.md`)) {
        topic = basename(dirname(dirname(f)));
        const rec = readSpec(f);
        if (rec) placeholder = rec;
        break;
      }
    }
  }
  if (!topic) {
    throw new Error(`无法推断 ${entry.code} 的 topic（请把占位文件放在 changes/${name}/specs/<topic>/${entry.code}/${entry.code}.md）`);
  }
  const level = (placeholder?.fm.level ?? entry.level) as 'L0' | 'L1' | 'L2' | 'L3' | undefined;
  const title = placeholder?.fm.title ?? entry.title;
  const parentCode = placeholder?.fm.parentCode ?? entry.parentCode ?? null;
  if (!level) throw new Error('ADDED 缺 level（占位文件 frontmatter 也未指定）');
  if (!title) throw new Error('ADDED 缺 title（占位文件 frontmatter 也未指定）');
  return { topic, level, title, parentCode };
}

function validateParentForAdded(
  specsByCode: Map<string, SpecRecord>,
  code: string,
  level: 'L0' | 'L1' | 'L2' | 'L3',
  parentCode: string | null,
): void {
  const expectedParentLevels: Record<'L0' | 'L1' | 'L2' | 'L3', Array<'L0' | 'L1' | 'L2' | 'L3'>> = {
    L0: [],
    L1: [],
    L2: ['L0', 'L1'],
    L3: ['L2'],
  };
  if (!parentCode) {
    if (level === 'L2' || level === 'L3') throw new Error(`R7: ${level} 必须有 parentCode`);
    return;
  }
  const parent = specsByCode.get(parentCode);
  if (!parent) throw new Error(`parentCode 指向不存在的 spec: ${parentCode}`);
  if (!expectedParentLevels[level].includes(parent.fm.level)) {
    throw new Error(
      `R7: ${level} 的 parent 必须是 ${expectedParentLevels[level].join('/')}, ` +
      `实际是 ${parent.fm.level} (${parentCode})`,
    );
  }
  if (code === parentCode) throw new Error('ADDED 的 parentCode 不能等于自身 code');
}

function renderArchiveError(name: string, skipped: ArchiveResult['skipped'], header: string): string {
  const lines = [`${header}: ${name}`];
  for (const s of skipped) lines.push(`[${s.op}] ${s.code}: ${s.reason}`);
  return lines.join('\n');
}
