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

import { existsSync, mkdirSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { writeFrontmatter, writeAtomic } from './frontmatter.js';
import { parseDeltaSpec, getChangeDir } from './delta.js';
import { findSpecByCode, readSpec, writeSpec, createSpec, invalidateSpecCache, type SpecRecord } from './spec-io.js';
import { hit } from './audit.js';
import { todayYYYYMMDD } from './constants.js';
import type { ProjectPaths } from './paths.js';
import type { ChangeOpT } from '../schemas/change.js';

export interface ArchiveResult {
  changeName: string;
  applied: Array<{ op: ChangeOpT; code: string; from?: string; to?: string }>;
  skipped: Array<{ op: ChangeOpT; code: string; reason: string }>;
  archivedTo: string;
}

export function archiveChange(paths: ProjectPaths, name: string): ArchiveResult {
  // 1. 解析 delta
  const delta = parseDeltaSpec(paths, name);

  // 2. 按顺序应用
  const order: ChangeOpT[] = ['RENAMED', 'REMOVED', 'MODIFIED', 'ADDED'];
  const applied: ArchiveResult['applied'] = [];
  const skipped: ArchiveResult['skipped'] = [];

  const sortedEntries = [...delta.changes].sort((a, b) => {
    return order.indexOf(a.op) - order.indexOf(b.op);
  });

  for (const e of sortedEntries) {
    try {
      switch (e.op) {
        case 'RENAMED': {
          if (!e.newCode) throw new Error('RENAMED 缺 newCode');
          const spec = findSpecByCode(paths, e.code);
          if (!spec) throw new Error(`Spec not found: ${e.code}`);
          const specDir = dirname(spec.filePath);
          // 从旧文件名提取日期后缀，保持一致
          const oldFileName = spec.filePath.split('/').pop() ?? '';
          const dateMatch = oldFileName.match(/-(\d{8})\.md$/);
          const dateSuffix = dateMatch ? `-${dateMatch[1]}` : `-${todayYYYYMMDD()}`;          const newFilePath = join(specDir, `${e.newCode}${dateSuffix}.md`);
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
          // 移到 archive/<name>/<relative-path>
          const archivePath = join(paths.archiveDir, name);
          mkdirSync(archivePath, { recursive: true });
          const relativePath = spec.filePath.replace(paths.root + '/', '');
          const targetPath = join(archivePath, relativePath);
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
          });
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
    }
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
    hit({ paths, ruleId: 'R24' });
    return { changeName: name, applied, skipped, archivedTo: finalTarget };
  } else {
    mkdirSync(paths.archiveDir, { recursive: true });
    renameSync(changeRoot, archiveTarget);
    hit({ paths, ruleId: 'R24' });
    return { changeName: name, applied, skipped, archivedTo: archiveTarget };
  }
}
