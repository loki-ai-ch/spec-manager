import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { SPEC_CODE_RE, TOPIC_RE } from './constants.js';

/**
 * 解析项目根目录。
 * 策略：优先用 SPEC_MANAGER_ROOT 环境变量，否则从 cwd 向上找 .spec-manager/，
 * 找到为止；找不到就用 cwd（让首次 init 有合理默认值）。
 */
export function resolveProjectRoot(cwd: string = process.cwd()): string {
  const envRoot = process.env.SPEC_MANAGER_ROOT;
  if (envRoot) return resolve(envRoot);

  let dir = resolve(cwd);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, '.spec-manager'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(cwd);
}

export interface ProjectPaths {
  root: string;
  configDir: string;       // .spec-manager/
  configFile: string;      // .spec-manager/config.yaml
  auditFile: string;       // .spec-manager/audit.json
  integrityExemptionsFile: string; // .spec-manager/integrity-exemptions.json
  incidentsDir: string;    // .spec-manager/incidents/
  dictFile: string;        // .spec-manager/dict.yaml
  specsDir: string;        // specs/
  changesDir: string;      // changes/
  archiveDir: string;      // archive/
  isInitialized: boolean;
}

export function getPaths(root: string = resolveProjectRoot()): ProjectPaths {
  const configDir = join(root, '.spec-manager');
  const isInitialized = statSafe(configDir)?.isDirectory() ?? false;
  return {
    root,
    configDir,
    configFile: join(configDir, 'config.yaml'),
    auditFile: join(configDir, 'audit.json'),
    integrityExemptionsFile: join(configDir, 'integrity-exemptions.json'),
    incidentsDir: join(configDir, 'incidents'),
    dictFile: join(configDir, 'dict.yaml'),
    specsDir: join(root, 'specs'),
    changesDir: join(root, 'changes'),
    archiveDir: join(root, 'archive'),
    isInitialized,
  };
}

function statSafe(p: string) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

/**
 * 平铺布局下的 spec 文件路径。
 *
 * 布局：specs/<topic>/<code>.md
 * 点分编号已编码层级关系，无需嵌套目录。
 *
 * @param parentFilePath 保留参数（向后兼容），平铺布局下忽略
 * @param code spec code（如 auth-L1、auth-L2.1、auth-L3.1.1）
 * @param topic topic 名
 * @param date 保留参数（向后兼容），canonical 路径下忽略
 */
export function specFilePath(
  paths: ProjectPaths,
  _parentFilePath: string | null,
  code: string,
  topic?: string,
  _date?: string,
): string {
  assertSafeSpecCode(code);
  const t = topic ?? extractTopicFromCode(code);
  assertSafeTopic(t);
  return join(paths.specsDir, t, `${code}.md`);
}

function extractTopicFromCode(code: string): string {
  // spec-manager-ai-ux-L1 → spec-manager-ai-ux
  const match = code.match(/^(.+)-L\d/);
  if (match) return match[1];
  throw new Error(`specFilePath: 无法从 code 推断 topic，请传 topic 参数`);
}

export function assertSafeTopic(topic: string): void {
  if (!TOPIC_RE.test(topic)) {
    throw new Error(`topic 非法: ${topic}（必须匹配 ${TOPIC_RE.source}，且不能包含路径分隔符）`);
  }
}

export function assertSafeSpecCode(code: string): void {
  if (!SPEC_CODE_RE.test(code)) {
    throw new Error(`spec code 非法: ${code}（必须匹配 ${SPEC_CODE_RE.source}，且不能包含路径分隔符）`);
  }
}

export function assertSafeChangeName(name: string): void {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`PATH_OUTSIDE_PROJECT: change name 非法: ${name}`);
  }
}

export function resolveWithin(baseDir: string, ...segments: string[]): string {
  if (segments.some(segment => isAbsolute(segment))) {
    throw new Error(`PATH_OUTSIDE_PROJECT: absolute path is not allowed`);
  }
  const base = resolve(baseDir);
  const target = resolve(base, ...segments);
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error(`PATH_OUTSIDE_PROJECT: ${target} is outside ${base}`);
  }
  return target;
}

/**
 * 平铺布局下,元数据目录在 topic 级别:
 *   specs/<topic>/decisions/、specs/<topic>/tasks/
 */
export function siblingMetaDir(specFilePath: string, name: 'decisions' | 'tasks'): string {
  return join(dirname(specFilePath), name);
}

export interface SpecFileEntry {
  topic: string;
  code: string;
  filePath: string;
}

export interface ParsedSpecFilename {
  code: string;
  format: 'canonical' | 'legacy-date';
  legacyDate?: string;
}

export interface SpecPathMigration {
  topic: string;
  code: string;
  from: string;
  to: string;
  legacyDate: string;
}

/**
 * 平铺布局：直接扫描 specs/<topic>/ 下的 .md 文件。
 * 跳过元数据目录（decisions/ tasks/ 等）。
 */
export function listSpecFiles(paths: ProjectPaths): SpecFileEntry[] {
  const out: SpecFileEntry[] = [];
  if (!existsSync(paths.specsDir)) return out;
  for (const topicEntry of readdirSync(paths.specsDir, { withFileTypes: true })) {
    if (!topicEntry.isDirectory() || topicEntry.name.startsWith('.')) continue;
    const topicDir = join(paths.specsDir, topicEntry.name);
    for (const file of readdirSync(topicDir, { withFileTypes: true })) {
      if (file.isDirectory()) continue;
      if (!file.name.endsWith('.md')) continue;
      if (file.name.startsWith('.')) continue;
      const parsed = parseSpecFilename(file.name);
      if (!parsed) continue;
      const filePath = join(topicDir, file.name);
      const dup = out.find(e => e.topic === topicEntry.name && e.code === parsed.code);
      if (dup) {
        throw new Error(`重复 spec code: ${parsed.code} (${dup.filePath}, ${filePath})`);
      }
      out.push({ topic: topicEntry.name, code: parsed.code, filePath });
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export function listSpecPathMigrations(paths: ProjectPaths): SpecPathMigration[] {
  const out: SpecPathMigration[] = [];
  if (!existsSync(paths.specsDir)) return out;
  for (const topicEntry of readdirSync(paths.specsDir, { withFileTypes: true })) {
    if (!topicEntry.isDirectory() || topicEntry.name.startsWith('.')) continue;
    const topicDir = join(paths.specsDir, topicEntry.name);
    for (const file of readdirSync(topicDir, { withFileTypes: true })) {
      if (file.isDirectory() || file.name.startsWith('.') || !file.name.endsWith('.md')) continue;
      const parsed = parseSpecFilename(file.name);
      if (!parsed || parsed.format !== 'legacy-date' || !parsed.legacyDate) continue;
      out.push({
        topic: topicEntry.name,
        code: parsed.code,
        from: join(topicDir, file.name),
        to: join(topicDir, `${parsed.code}.md`),
        legacyDate: parsed.legacyDate,
      });
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * 从文件名提取 code。
 * canonical: <code>.md
 * legacy:    <code>-<YYYYMMDD>.md
 */
export function parseSpecFilename(filename: string): ParsedSpecFilename | null {
  const legacy = filename.match(/^(.+)-(\d{8})\.md$/);
  if (legacy && SPEC_CODE_RE.test(legacy[1])) {
    return { code: legacy[1], format: 'legacy-date', legacyDate: legacy[2] };
  }
  const old = filename.match(/^(.+)\.md$/);
  if (old && SPEC_CODE_RE.test(old[1])) {
    return { code: old[1], format: 'canonical' };
  }
  return null;
}
