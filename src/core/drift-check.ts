import { execFileSync } from 'node:child_process';
import { findSpecByCode } from './spec-io.js';
import { findTask } from './task.js';
import type { ProjectPaths } from './paths.js';
import type { AssistFinding, AssistSourceRef, DriftCheckReport, DriftFile } from './capability-types.js';

export interface DriftCheckOptions {
  gitReader?: GitChangedFilesReader;
}

export type GitChangedFilesReader = (paths: ProjectPaths) => DriftFile[];

const PATH_RE = /(?:^|[`'"\s(])((?:src|test|tests|templates|skill|rules|docs|specs|scripts|README|readme_zh|package|tsconfig|vitest)[A-Za-z0-9_./-]*(?:\.[A-Za-z0-9]+)?)(?=$|[`'"\s),])/g;

export function buildDriftCheckReport(
  paths: ProjectPaths,
  taskId: string,
  specCode: string,
  opts: DriftCheckOptions = {},
): DriftCheckReport {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  const task = findTask(paths, specCode, taskId);
  if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId} (in ${specCode})`);

  const declaredFiles = [...new Set([
    ...extractDeclaredFiles(spec.content),
    ...extractTaskDeclaredFiles(task),
  ])].sort();
  const changedFiles = safeChangedFiles(paths, opts.gitReader ?? defaultGitChangedFilesReader);
  const undeclaredFiles = declaredFiles.length === 0
    ? []
    : changedFiles
      .map(file => file.path)
      .filter(file => !isDeclared(file, declaredFiles))
      .sort();
  const sourceRefs = driftSourceRefs(specCode, taskId, spec.filePath);

  return {
    schemaVersion: 'drift-check.v1',
    taskId,
    specCode,
    changedFiles,
    declaredFiles,
    undeclaredFiles,
    findings: buildFindings(declaredFiles, changedFiles, undeclaredFiles, sourceRefs),
  };
}

export function extractDeclaredFiles(content: string): string[] {
  const sections = extractRelevantSections(content);
  const values = new Set<string>();
  for (const section of sections) {
    for (const path of extractPaths(section)) values.add(path);
  }
  return [...values].sort();
}

function extractTaskDeclaredFiles(task: { steps?: Array<{ name: string; inputJson?: string; outputJson?: string }> }): string[] {
  const values = new Set<string>();
  for (const step of task.steps ?? []) {
    for (const path of extractPaths(step.name)) values.add(path);
    for (const raw of [step.inputJson, step.outputJson]) {
      if (!raw) continue;
      try {
        collectPathsFromJson(JSON.parse(raw), values);
      } catch {
        for (const path of extractPaths(raw)) values.add(path);
      }
    }
  }
  return [...values].sort();
}

function extractRelevantSections(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const sections: string[] = [];
  let active = false;
  let body: string[] = [];
  const flush = () => {
    if (active) sections.push(body.join('\n'));
  };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      flush();
      const heading = match[1].toLowerCase();
      active = /文件级改动|影响文件|实施步骤|implementation plan|affected files|file/.test(heading);
      body = [];
      continue;
    }
    if (active) body.push(line);
  }
  flush();
  return sections;
}

function extractPaths(input: string): string[] {
  const values = new Set<string>();
  for (const match of input.matchAll(PATH_RE)) {
    const value = match[1].replace(/[.,;:]+$/g, '');
    if (value && !value.includes('://') && (value.includes('/') || value.includes('.'))) values.add(value);
  }
  return [...values];
}

function collectPathsFromJson(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    for (const path of extractPaths(value)) out.add(path);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPathsFromJson(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key.toLowerCase().includes('file') || key.toLowerCase().includes('path')) collectPathsFromJson(nested, out);
    }
  }
}

function safeChangedFiles(paths: ProjectPaths, reader: GitChangedFilesReader): DriftFile[] {
  try {
    return reader(paths);
  } catch {
    return [];
  }
}

export function defaultGitChangedFilesReader(paths: ProjectPaths): DriftFile[] {
  const output = execFileSync('git', ['status', '--porcelain'], {
    cwd: paths.root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => {
      const status = line.slice(0, 2).trim() || '??';
      const rawPath = line.slice(3).trim();
      const renamed = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) ?? rawPath : rawPath;
      return { path: renamed, status };
    });
}

function isDeclared(file: string, declaredFiles: string[]): boolean {
  return declaredFiles.some(declared => file === declared || file.startsWith(`${declared}/`) || declared.startsWith(`${file}/`));
}

function buildFindings(
  declaredFiles: string[],
  changedFiles: DriftFile[],
  undeclaredFiles: string[],
  sourceRefs: AssistSourceRef[],
): AssistFinding[] {
  const findings: AssistFinding[] = [];
  if (declaredFiles.length === 0) {
    findings.push({
      id: 'drift.scope.unavailable',
      severity: 'advisory',
      title: 'Declared scope unavailable',
      detail: 'No file paths were found in the L3 declared scope or task plan, so drift cannot be judged.',
      sourceRefs,
    });
  }
  if (changedFiles.length === 0) {
    findings.push({
      id: 'drift.changed.none',
      severity: 'advisory',
      title: 'No changed files detected',
      detail: 'Git did not report changed files for this worktree.',
      sourceRefs,
    });
  }
  if (undeclaredFiles.length > 0) {
    findings.push({
      id: 'drift.undeclared-files',
      severity: 'warning',
      title: 'Changed files outside declared scope',
      detail: `Undeclared files: ${undeclaredFiles.join(', ')}`,
      sourceRefs,
    });
  }
  return findings;
}

function driftSourceRefs(specCode: string, taskId: string, specPath: string): AssistSourceRef[] {
  return [
    { kind: 'spec', id: specCode, path: specPath },
    { kind: 'task', id: `${specCode}:${taskId}` },
    { kind: 'git', id: 'worktree' },
  ];
}
