import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { todayYYYYMMDD } from './constants.js';

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
 * 布局：specs/<topic>/<code>-<YYYYMMDD>.md
 * 点分编号已编码层级关系，无需嵌套目录。
 *
 * @param parentFilePath 保留参数（向后兼容），平铺布局下忽略
 * @param code spec code（如 auth-L1、auth-L2.1、auth-L3.1.1）
 * @param topic topic 名
 * @param date 创建日期（YYYYMMDD 格式），默认当天
 */
export function specFilePath(
  paths: ProjectPaths,
  _parentFilePath: string | null,
  code: string,
  topic?: string,
  date?: string,
): string {
  const d = date ?? todayYYYYMMDD();
  const t = topic ?? extractTopicFromCode(code);
  return join(paths.specsDir, t, `${code}-${d}.md`);
}

function extractTopicFromCode(code: string): string {
  // spec-manager-ai-ux-L1 → spec-manager-ai-ux
  const match = code.match(/^(.+)-L\d/);
  if (match) return match[1];
  throw new Error(`specFilePath: 无法从 code 推断 topic，请传 topic 参数`);
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
      // 从文件名提取 code: <code>-<YYYYMMDD>.md → <code>
      const code = extractCodeFromFilename(file.name);
      if (!code) continue;
      out.push({ topic: topicEntry.name, code, filePath: join(topicDir, file.name) });
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * 从文件名提取 code。
 * 支持: <code>-<YYYYMMDD>.md → <code>
 * 旧格式: <code>.md → <code>
 */
function extractCodeFromFilename(filename: string): string | null {
  const md = filename.match(/^(.+)-\d{8}\.md$/);
  if (md) return md[1];
  // 旧格式回退
  const old = filename.match(/^(.+)\.md$/);
  if (old) return old[1];
  return null;
}
