import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readFrontmatter } from './frontmatter.js';
import { getChangeDir, listChanges, parseDeltaSpec } from './delta.js';
import { listAllSpecs, readSpec, type SpecRecord } from './spec-io.js';
import { recordAuditHit, type AuditSink } from './audit-events.js';
import { assertSafeSpecCode, assertSafeTopic, type ProjectPaths } from './paths.js';
import { ProposalSchema, type ChangeEntry, type ChangeOpT } from '../schemas/change.js';
import { listTopicMetaFiles } from './repository.js';

export interface ArchivePlanEntry extends ChangeEntry {
  metadata?: ArchiveAddedMetadata;
}

export interface ArchiveAddedMetadata {
  topic: string;
  level: 'L0' | 'L1' | 'L2' | 'L3';
  title: string;
  parentCode: string | null;
  parentRecord?: SpecRecord | null;
}

export type ArchiveReferenceUpdate =
  | { kind: 'spec-parent'; filePath: string; specCode: string; oldCode: string; newCode: string }
  | { kind: 'spec-relation'; filePath: string; specCode: string; oldCode: string; newCode: string }
  | { kind: 'task-specCode'; filePath: string; oldCode: string; newCode: string; newFilePath: string }
  | { kind: 'decision-docCode'; filePath: string; oldCode: string; newCode: string }
  | { kind: 'incident-specCode'; filePath: string; oldCode: string; newCode: string }
  | { kind: 'change-proposal-specCode'; filePath: string; oldCode: string; newCode: string };

export interface ArchivePreflightIssue {
  op: ChangeOpT;
  code: string;
  reason: string;
}

export interface ArchivePlan {
  changeName: string;
  entries: ArchivePlanEntry[];
  referenceUpdates: ArchiveReferenceUpdate[];
  issues: ArchivePreflightIssue[];
}

export interface PlanArchiveChangeInput {
  paths: ProjectPaths;
  name: string;
  auditSink?: AuditSink;
}

const ARCHIVE_ORDER: ChangeOpT[] = ['RENAMED', 'REMOVED', 'MODIFIED', 'ADDED'];

export function planArchiveChange(input: PlanArchiveChangeInput): ArchivePlan {
  validateChangeProposal(input.paths, input.name, input.auditSink);
  const delta = parseDeltaSpec(input.paths, input.name);
  const entries = [...delta.changes]
    .sort((a, b) => ARCHIVE_ORDER.indexOf(a.op) - ARCHIVE_ORDER.indexOf(b.op))
    .map(entry => ({ ...entry }));
  validateUniqueModifiedEntries(input.name, entries);
  const referenceUpdates: ArchiveReferenceUpdate[] = [];
  preflightArchive(input.paths, input.name, entries, referenceUpdates);
  const finalRenames = buildFinalRenameMap(entries);
  validateRemovedReferences(input.paths, input.name, entries, finalRenames);
  normalizeReferenceUpdates(referenceUpdates, finalRenames);
  validateTaskReferenceTargets(referenceUpdates);
  return { changeName: input.name, entries, referenceUpdates, issues: [] };
}

function validateUniqueModifiedEntries(name: string, entries: ArchivePlanEntry[]): void {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.op !== 'MODIFIED') continue;
    counts.set(entry.code, (counts.get(entry.code) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code, count]) => `${code} (${count} entries)`);
  if (duplicates.length > 0) {
    throw new Error(`Change ${name} 包含重复 MODIFIED: ${duplicates.join(', ')}`);
  }
}

function validateRemovedReferences(
  paths: ProjectPaths,
  name: string,
  entries: ArchivePlanEntry[],
  finalRenames: Map<string, string>,
): void {
  const removed = new Set(entries.filter(entry => entry.op === 'REMOVED').map(entry => entry.code));
  if (removed.size === 0) return;

  const finalActiveCodes = new Set(listAllSpecs(paths).map(spec => spec.fm.code));
  for (const entry of entries) {
    if (entry.op === 'RENAMED' && entry.newCode) {
      finalActiveCodes.delete(entry.code);
      finalActiveCodes.add(entry.newCode);
    } else if (entry.op === 'REMOVED') {
      finalActiveCodes.delete(entry.code);
    } else if (entry.op === 'ADDED') {
      finalActiveCodes.add(entry.code);
    }
  }
  const projectCode = (code: string): string => finalRenames.get(code) ?? code;
  const issues: string[] = [];
  const report = (target: string, sourceType: string, sourceId: string): void => {
    const finalTarget = projectCode(target);
    if (removed.has(finalTarget) && !finalActiveCodes.has(finalTarget)) {
      issues.push(`${finalTarget} <- ${sourceType} ${sourceId}`);
    }
  };

  for (const spec of listAllSpecs(paths)) {
    if (removed.has(projectCode(spec.fm.code))) continue;
    if (spec.fm.parentCode) report(spec.fm.parentCode, 'spec parentCode', spec.fm.code);
    for (const relation of spec.fm.relations ?? []) {
      report(relation.target, `spec relation ${relation.type}`, spec.fm.code);
    }
  }
  for (const file of listTopicMetaFiles(paths, 'tasks', { extension: '.json' })) {
    const task = JSON.parse(readFileSync(file.filePath, 'utf8')) as { id?: string; specCode?: string };
    if (task.specCode) report(task.specCode, 'task', task.id ?? file.fileName);
  }
  for (const file of listTopicMetaFiles(paths, 'decisions', { extension: '.md' })) {
    const { data } = readFrontmatter(file.filePath);
    if (typeof data.docCode === 'string') report(data.docCode, 'decision', String(data.id ?? file.fileName));
  }
  if (existsSync(paths.incidentsDir)) {
    for (const fileName of readdirSync(paths.incidentsDir).filter(file => file.endsWith('.md'))) {
      const { data } = readFrontmatter(join(paths.incidentsDir, fileName));
      if (typeof data.specCode === 'string') report(data.specCode, 'incident', String(data.id ?? fileName));
    }
  }
  for (const change of listChanges(paths)) {
    if (change.name === name) continue;
    const proposalPath = join(change.root, 'proposal.md');
    if (!existsSync(proposalPath)) continue;
    const { data } = readFrontmatter(proposalPath);
    if (typeof data.specCode === 'string') report(data.specCode, 'change proposal', change.name);
  }

  if (issues.length > 0) {
    throw new Error(`Change ${name} REMOVED 引用完整性检查失败:\n${issues.join('\n')}`);
  }
}

export function buildFinalRenameMap(entries: ArchivePlanEntry[]): Map<string, string> {
  const direct = new Map(
    entries
      .filter((entry): entry is ArchivePlanEntry & { newCode: string } => entry.op === 'RENAMED' && Boolean(entry.newCode))
      .map(entry => [entry.code, entry.newCode]),
  );
  const resolved = new Map<string, string>();
  for (const source of direct.keys()) {
    const visited = new Set<string>();
    let target = source;
    while (direct.has(target)) {
      if (visited.has(target)) throw new Error(`RENAMED 形成循环: ${[...visited, target].join(' -> ')}`);
      visited.add(target);
      target = direct.get(target)!;
    }
    resolved.set(source, target);
  }
  return resolved;
}

export function validateChangeProposal(paths: ProjectPaths, name: string, auditSink?: AuditSink): void {
  const dir = getChangeDir(paths, name);
  if (!dir) throw new Error(`Change not found: ${name}`);
  if (!existsSync(dir.proposal)) {
    if (auditSink) recordAuditHit({ paths, ruleId: 'R24' }, auditSink);
    throw new Error(`R24: delta change 必须包含 proposal.md`);
  }
  try {
    const { data } = readFrontmatter(dir.proposal);
    ProposalSchema.parse(data);
  } catch (err) {
    if (auditSink) recordAuditHit({ paths, ruleId: 'R24' }, auditSink);
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`R24: proposal.md 必须填写 why/scope 并通过 schema 校验: ${reason}`);
  }
}

function preflightArchive(
  paths: ProjectPaths,
  name: string,
  entries: ArchivePlanEntry[],
  referenceUpdates: ArchiveReferenceUpdate[],
): void {
  const specsByCode = new Map(listAllSpecs(paths).map(s => [s.fm.code, s]));
  const errors: ArchivePreflightIssue[] = [];

  for (const entry of entries) {
    try {
      switch (entry.op) {
        case 'RENAMED': {
          if (!entry.newCode) throw new Error('RENAMED 缺 newCode');
          assertSafeSpecCode(entry.newCode);
          const spec = specsByCode.get(entry.code);
          if (!spec) throw new Error(`Spec not found: ${entry.code}`);
          if (entry.newCode === entry.code) throw new Error('RENAMED 的 newCode 不能等于原 code');
          if (specsByCode.has(entry.newCode)) throw new Error(`目标 spec 已存在: ${entry.newCode}`);
          const newFilePath = renamedFilePath(spec, entry.newCode);
          if (existsSync(newFilePath) && newFilePath !== spec.filePath) {
            throw new Error(`目标文件已存在: ${newFilePath}`);
          }
          referenceUpdates.push(...planReferenceUpdates(paths, entry.code, entry.newCode));
          specsByCode.delete(entry.code);
          specsByCode.set(entry.newCode, { ...spec, fm: { ...spec.fm, code: entry.newCode }, filePath: newFilePath });
          break;
        }
        case 'REMOVED': {
          if (!specsByCode.has(entry.code)) throw new Error(`Spec not found: ${entry.code}`);
          specsByCode.delete(entry.code);
          break;
        }
        case 'MODIFIED': {
          if (!specsByCode.has(entry.code)) throw new Error(`Spec not found: ${entry.code}`);
          if (!entry.content) throw new Error('MODIFIED 缺 content');
          break;
        }
        case 'ADDED': {
          assertSafeSpecCode(entry.code);
          if (specsByCode.has(entry.code)) throw new Error(`Spec ${entry.code} 已存在，无法 ADDED`);
          const metadata = resolveAddedMetadata(paths, name, entry);
          assertSafeTopic(metadata.topic);
          validateParentForAdded(specsByCode, entry.code, metadata.level, metadata.parentCode);
          entry.metadata = {
            ...metadata,
            parentRecord: metadata.parentCode ? specsByCode.get(metadata.parentCode) ?? null : null,
          };
          specsByCode.set(entry.code, {
            fm: {
              code: entry.code,
              level: metadata.level,
              title: metadata.title,
              topic: metadata.topic,
              parentCode: metadata.parentCode,
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
      errors.push({ op: entry.op, code: entry.code, reason });
    }
  }

  if (errors.length > 0) {
    throw new Error(renderArchiveError(name, errors, 'Change 预检失败，未修改 specs 且未归档'));
  }
}

export function renamedFilePath(spec: SpecRecord, newCode: string): string {
  const specDir = dirname(spec.filePath);
  return join(specDir, `${newCode}.md`);
}

function resolveAddedMetadata(
  paths: ProjectPaths,
  name: string,
  entry: ChangeEntry,
): ArchiveAddedMetadata {
  const dir = getChangeDir(paths, name);
  const candidates = (dir?.specFiles ?? [])
    .filter(filePath => filePath.endsWith(`/${entry.code}.md`))
    .sort();
  if (candidates.length > 1) {
    throw new Error(`ADDED ${entry.code} 占位定义歧义: ${candidates.join(', ')}`);
  }
  const filePath = candidates[0];
  if (!filePath) {
    throw new Error(`无法推断 ${entry.code} 的 topic（请把占位文件放在 changes/${name}/specs/<topic>/${entry.code}/${entry.code}.md）`);
  }
  const topic = basename(dirname(dirname(filePath)));
  const placeholder = readSpec(filePath);
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

function planReferenceUpdates(paths: ProjectPaths, oldCode: string, newCode: string): ArchiveReferenceUpdate[] {
  const updates: ArchiveReferenceUpdate[] = [];
  for (const spec of listAllSpecs(paths)) {
    if (spec.fm.parentCode === oldCode) {
      updates.push({ kind: 'spec-parent', filePath: spec.filePath, specCode: spec.fm.code, oldCode, newCode });
    }
    if (spec.fm.relations?.some(relation => relation.target === oldCode)) {
      updates.push({ kind: 'spec-relation', filePath: spec.filePath, specCode: spec.fm.code, oldCode, newCode });
    }
  }
  for (const file of listTopicMetaFiles(paths, 'tasks', { extension: '.json' })) {
    const task = JSON.parse(readFileSync(file.filePath, 'utf8')) as { specCode?: string };
    if (task.specCode !== oldCode) continue;
    const newFilePath = join(dirname(file.filePath), file.fileName.replace(`${oldCode}-`, `${newCode}-`));
    updates.push({
      kind: 'task-specCode',
      filePath: file.filePath,
      oldCode,
      newCode,
      newFilePath,
    });
  }
  for (const file of listTopicMetaFiles(paths, 'decisions', { extension: '.md' })) {
    const { data } = readFrontmatter(file.filePath);
    if (data.docCode === oldCode) {
      updates.push({ kind: 'decision-docCode', filePath: file.filePath, oldCode, newCode });
    }
  }
  if (existsSync(paths.incidentsDir)) {
    for (const fileName of readdirSync(paths.incidentsDir).filter(file => file.endsWith('.md'))) {
      const filePath = join(paths.incidentsDir, fileName);
      const { data } = readFrontmatter(filePath);
      if (data.specCode === oldCode) {
        updates.push({ kind: 'incident-specCode', filePath, oldCode, newCode });
      }
    }
  }
  for (const change of listChanges(paths)) {
    const filePath = join(change.root, 'proposal.md');
    if (!existsSync(filePath)) continue;
    const { data } = readFrontmatter(filePath);
    if (data.specCode === oldCode) {
      updates.push({ kind: 'change-proposal-specCode', filePath, oldCode, newCode });
    }
  }
  return updates;
}

function normalizeReferenceUpdates(updates: ArchiveReferenceUpdate[], finalRenames: Map<string, string>): void {
  for (const update of updates) {
    const finalCode = finalRenames.get(update.oldCode) ?? finalRenames.get(update.newCode) ?? update.newCode;
    update.newCode = finalCode;
    if (update.kind === 'task-specCode') {
      update.newFilePath = join(dirname(update.filePath), basename(update.filePath).replace(`${update.oldCode}-`, `${finalCode}-`));
    }
  }
}

function validateTaskReferenceTargets(updates: ArchiveReferenceUpdate[]): void {
  const claimedTargets = new Map<string, string>();
  for (const update of updates) {
    if (update.kind !== 'task-specCode' || update.newFilePath === update.filePath) continue;
    const claimedBy = claimedTargets.get(update.newFilePath);
    if (claimedBy && claimedBy !== update.filePath) {
      throw new Error(`多个 task 文件将迁移到同一目标: ${update.newFilePath}`);
    }
    claimedTargets.set(update.newFilePath, update.filePath);
    if (existsSync(update.newFilePath) && !updates.some(candidate =>
      candidate.kind === 'task-specCode' && candidate.filePath === update.newFilePath
    )) {
      throw new Error(`目标 task 文件已存在: ${update.newFilePath}`);
    }
  }
}

export function renderArchiveError(name: string, skipped: ArchivePreflightIssue[], header: string): string {
  const lines = [`${header}: ${name}`];
  for (const issue of skipped) lines.push(`[${issue.op}] ${issue.code}: ${issue.reason}`);
  return lines.join('\n');
}
