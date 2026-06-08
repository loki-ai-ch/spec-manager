/**
 * Delta Spec 解析器
 *
 * 一个 change 提案 = changes/<name>/
 *   ├── proposal.md          ← 为什么 + 范围
 *   ├── specs/<topic>/<code>/<code>.md  ← ADDED 时主 spec 的占位（带 frontmatter）
 *   └── deltas/<code>.md     ← ADDED/MODIFIED/REMOVED/RENAMED 列表
 *
 * 本文件：解析 deltas/<code>.md 或内联在 spec 文件 ## DELTA 段中的变更。
 *
 * 文件格式（每个 delta 文件）：
 *   ---
 *   code: 2026-06-04-a1b2c3
 *   ---
 *
 *   ## ADDED Requirements
 *   ### Requirement: Two-Factor Authentication
 *   The system **SHALL** ...（完整 SHALL/MUST 表述）
 *
 *   ## MODIFIED Requirements
 *   ### Requirement: ...
 *   **旧文**：...
 *   **新文**：...
 *
 *   ## REMOVED Requirements
 *   ### Requirement: ...
 *   说明删除原因
 *
 *   ## RENAMED Requirements
 *   - FROM: 2026-06-04-a1b2c3-old TO: 2026-06-04-a1b2c3-new
 *
 * Archive 时按 RENAMED→REMOVED→MODIFIED→ADDED 顺序应用：
 *   - RENAMED: spec 文件改名 + frontmatter code 改写
 *   - REMOVED: spec 文件移到 archive
 *   - MODIFIED: 替换 section 内容
 *   - ADDED: 创建新 spec
 */

import { existsSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFrontmatter, writeFrontmatter } from './frontmatter.js';
import { DeltaSpecSchema, type ChangeEntry, type ChangeOpT, type DeltaSpec } from '../schemas/change.js';
import type { ProjectPaths } from './paths.js';
import { findSpecByCode } from './spec-io.js';
import { findTask } from './task.js';

export interface ChangeDir {
  root: string;        // changes/<date>-<name>/
  proposal: string;    // proposal.md
  deltaFiles: string[]; // deltas/*.md
  specFiles: string[];  // specs/<topic>/*.md
}

export type TaskLinkedChangeStatus = 'unresolved' | 'resolved';

export interface TaskLinkedChangeProposal {
  name: string;
  root: string;
  proposalFile: string;
  taskCode: string;
  specCode: string;
  topic: string;
  reason: string;
  impact: string;
  status: TaskLinkedChangeStatus;
  created: string;
  updated: string;
}

interface ProposalFrontmatter {
  name?: string;
  why?: string;
  scope?: string;
  created?: string;
  updated?: string;
  proposalType?: 'task-linked';
  taskCode?: string;
  specCode?: string;
  topic?: string;
  reason?: string;
  impact?: string;
  status?: TaskLinkedChangeStatus;
}

export function changeDir(paths: ProjectPaths, name: string): string {
  return join(paths.changesDir, name);
}

export function getChangeDir(paths: ProjectPaths, name: string): ChangeDir | null {
  const root = changeDir(paths, name);
  if (!existsSync(root)) return null;
  const proposal = join(root, 'proposal.md');
  const deltasDir = join(root, 'deltas');
  const specsDir = join(root, 'specs');
  const deltaFiles = existsSync(deltasDir)
    ? readdirSync(deltasDir).filter(f => f.endsWith('.md')).map(f => join(deltasDir, f))
    : [];
  // 树形布局下,占位文件位置: changes/<name>/specs/<topic>/<code>/<code>.md
  // 扁平,不在 change 内部再嵌套父链 — placeholder 只用于携带 level/parentCode
  const specFiles: string[] = [];
  if (existsSync(specsDir)) {
    for (const topicEntry of readdirSync(specsDir, { withFileTypes: true })) {
      if (!topicEntry.isDirectory() || topicEntry.name.startsWith('.')) continue;
      const topicDir = join(specsDir, topicEntry.name);
      for (const specEntry of readdirSync(topicDir, { withFileTypes: true })) {
        if (!specEntry.isDirectory() || specEntry.name.startsWith('.') || specEntry.name.startsWith('_')) continue;
        const f = join(topicDir, specEntry.name, `${specEntry.name}.md`);
        if (existsSync(f)) specFiles.push(f);
      }
    }
  }
  return { root, proposal, deltaFiles, specFiles };
}

export function listChanges(paths: ProjectPaths): Array<{ name: string; root: string; created: string }> {
  if (!existsSync(paths.changesDir)) return [];
  return readdirSync(paths.changesDir)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const root = join(paths.changesDir, f);
      const proposalPath = join(root, 'proposal.md');
      let created = '';
      if (existsSync(proposalPath)) {
        const { data } = readFrontmatter(proposalPath);
        created = (data as ProposalFrontmatter).created ?? '';
      }
      return { name: f, root, created };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface CreateTaskLinkedChangeProposalInput {
  paths: ProjectPaths;
  taskCode: string;
  specCode: string;
  reason: string;
  impact: string;
}

export function createTaskLinkedChangeProposal(input: CreateTaskLinkedChangeProposalInput): TaskLinkedChangeProposal {
  const reason = input.reason.trim();
  const impact = input.impact.trim();
  if (!reason) throw new Error('INVALID_CHANGE: reason is required');
  if (!impact) throw new Error('INVALID_CHANGE: impact is required');

  const spec = findSpecByCode(input.paths, input.specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${input.specCode}`);
  if (spec.fm.level !== 'L3') throw new Error(`SPEC_NOT_L3: ${input.specCode}`);
  const task = findTask(input.paths, input.specCode, input.taskCode);
  if (!task) throw new Error(`TASK_NOT_FOUND: ${input.taskCode} (in ${input.specCode})`);

  const name = nextTaskLinkedChangeName(input.paths, input.specCode, input.taskCode);
  const root = changeDir(input.paths, name);
  mkdirSync(join(root, 'deltas'), { recursive: true });
  mkdirSync(join(root, 'specs'), { recursive: true });
  const now = new Date().toISOString();
  const fm: Required<Pick<ProposalFrontmatter,
    'name' | 'proposalType' | 'taskCode' | 'specCode' | 'topic' | 'reason' | 'impact' | 'status' | 'created' | 'updated'
  >> & { why: string; scope: string } = {
    name,
    proposalType: 'task-linked',
    taskCode: input.taskCode,
    specCode: input.specCode,
    topic: spec.fm.topic,
    reason,
    impact,
    status: 'unresolved',
    why: reason,
    scope: impact,
    created: now,
    updated: now,
  };
  const proposalFile = join(root, 'proposal.md');
  writeFileSync(proposalFile, writeFrontmatter(fm, renderTaskLinkedProposalContent(fm)), 'utf8');
  writeFileSync(join(root, 'README.md'), `# Change: ${name}\n\nTask-linked proposal for ${input.specCode} / ${input.taskCode}\n`, 'utf8');

  return proposalFromFrontmatter(name, root, proposalFile, fm);
}

export function listTaskLinkedChangeProposals(
  paths: ProjectPaths,
  opts?: { status?: TaskLinkedChangeStatus; specCode?: string; taskCode?: string },
): TaskLinkedChangeProposal[] {
  return listChanges(paths)
    .map(c => readTaskLinkedChangeProposal(paths, c.name))
    .filter((p): p is TaskLinkedChangeProposal => p !== null)
    .filter(p => !opts?.status || p.status === opts.status)
    .filter(p => !opts?.specCode || p.specCode === opts.specCode)
    .filter(p => !opts?.taskCode || p.taskCode === opts.taskCode);
}

export function readTaskLinkedChangeProposal(paths: ProjectPaths, name: string): TaskLinkedChangeProposal | null {
  const dir = getChangeDir(paths, name);
  if (!dir || !existsSync(dir.proposal)) return null;
  const { data } = readFrontmatter(dir.proposal);
  const fm = data as ProposalFrontmatter;
  if (fm.proposalType !== 'task-linked') return null;
  if (!fm.taskCode || !fm.specCode || !fm.topic || !fm.reason || !fm.impact || !fm.status || !fm.created) return null;
  return proposalFromFrontmatter(name, dir.root, dir.proposal, fm);
}

export function resolveTaskLinkedChangeProposal(paths: ProjectPaths, name: string): TaskLinkedChangeProposal {
  const dir = getChangeDir(paths, name);
  if (!dir || !existsSync(dir.proposal)) throw new Error(`CHANGE_NOT_FOUND: ${name}`);
  const { data, content } = readFrontmatter(dir.proposal);
  const fm = data as ProposalFrontmatter;
  if (fm.proposalType !== 'task-linked') throw new Error(`CHANGE_NOT_FOUND: ${name} is not task-linked`);
  const updated: ProposalFrontmatter = {
    ...fm,
    status: 'resolved',
    updated: new Date().toISOString(),
  };
  writeFileSync(dir.proposal, writeFrontmatter(updated as Record<string, unknown>, content), 'utf8');
  const proposal = readTaskLinkedChangeProposal(paths, name);
  if (!proposal) throw new Error(`CHANGE_NOT_FOUND: ${name}`);
  return proposal;
}

/**
 * 解析一个 delta 文件为 ChangeEntry 列表。
 * 一个 delta 文件可以含多个 ## ADDED/MODIFIED/REMOVED/RENAMED 段。
 */
export function parseDeltaFile(filePath: string): { specCode: string; entries: ChangeEntry[] } {
  const { data, content } = readFrontmatter(filePath);
  const fm = data as { code?: string };
  if (!fm.code) throw new Error(`Delta 文件 ${filePath} 缺 frontmatter code 字段`);

  const entries: ChangeEntry[] = [];
  // 按 ## XXX 段切分
  const sections = content.split(/^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/m);
  // sections[0] = 前言；sections[1] = 第一个 op 名；sections[2] = 第一个 op 内容；...
  for (let i = 1; i < sections.length; i += 2) {
    const op = sections[i] as ChangeOpT;
    const body = sections[i + 1] ?? '';
    if (op === 'RENAMED') {
      // 形如: - FROM: <old> TO: <new>
      const matches = body.matchAll(/FROM:\s*(\S+)\s+TO:\s*(\S+)/g);
      for (const m of matches) {
        entries.push({ op, code: m[1], newCode: m[2] });
      }
    } else if (op === 'REMOVED') {
      // 形如: ### Requirement: <code>
      // 或 - <code>: <reason>
      const reqMatches = body.matchAll(/### Requirement:\s*(\S+)/g);
      for (const m of reqMatches) {
        entries.push({ op, code: m[1] });
      }
    } else if (op === 'ADDED' || op === 'MODIFIED') {
      // 形如: ### Requirement: <code>\n<content>\n
      // 用 indexOf 找每个 ### Requirement: 起点和下一个段头终点
      const reqRegex = /^### Requirement:\s*(\S+)$/gm;
      let m: RegExpExecArray | null;
      const reqStarts: Array<{ code: string; lineStart: number; bodyStart: number }> = [];
      while ((m = reqRegex.exec(body)) !== null) {
        const code = m[1];
        const bodyStart = m.index + m[0].length; // 跳过整行（含 \n）
        reqStarts.push({ code, lineStart: m.index, bodyStart });
      }
      for (let i = 0; i < reqStarts.length; i++) {
        const { code, bodyStart } = reqStarts[i];
        const nextStart = i + 1 < reqStarts.length ? reqStarts[i + 1].lineStart : body.length;
        const reqBody = body.slice(bodyStart, nextStart).trim();
        if (op === 'ADDED') {
          // ADDED 必须含 title + content
          const titleMatch = reqBody.match(/^#+\s+(.+?)$/m);
          entries.push({
            op,
            code,
            title: titleMatch?.[1]?.trim(),
            content: reqBody,
            changeSummary: 'delta ADDED',
          });
        } else {
          // MODIFIED: 必有 content（新文）
          entries.push({
            op,
            code,
            content: reqBody,
            changeSummary: 'delta MODIFIED',
          });
        }
      }
    }
  }
  return { specCode: fm.code, entries };
}

/**
 * 解析整个 change 目录，返回结构化 DeltaSpec。
 * 校验：每个 delta 文件的 specCode 必须和文件名一致；entry.code 必填。
 */
export function parseDeltaSpec(paths: ProjectPaths, name: string): DeltaSpec {
  const dir = getChangeDir(paths, name);
  if (!dir) throw new Error(`Change not found: ${name}`);

  const allEntries: ChangeEntry[] = [];
  for (const f of dir.deltaFiles) {
    const { entries } = parseDeltaFile(f);
    allEntries.push(...entries);
  }

  // 校验：entry.code 必填
  for (const e of allEntries) {
    if (!e.code) throw new Error(`Delta entry 缺 code 字段：op=${e.op}`);
  }

  const result: DeltaSpec = {
    name,
    changes: allEntries,
  };
  return DeltaSpecSchema.parse(result);
}

/**
 * 创建一个新 change 目录（scaffold）。
 * 包含 proposal.md 模板 + deltas/ + specs/ 空目录。
 */
export interface CreateChangeInput {
  paths: ProjectPaths;
  name: string;
  description?: string;
}

export function createChange(input: CreateChangeInput): { name: string; root: string; proposalFile: string } {
  if (!/^[a-z0-9-]+$/.test(input.name)) {
    throw new Error(`change name 非法: ${input.name}（必须 ^[a-z0-9-]+$）`);
  }
  const root = changeDir(input.paths, input.name);
  if (existsSync(root)) throw new Error(`Change 已存在: ${input.name}`);

  mkdirSync(join(root, 'deltas'), { recursive: true });
  mkdirSync(join(root, 'specs'), { recursive: true });

  const proposalFile = join(root, 'proposal.md');
  const now = new Date().toISOString();
  const fm = {
    name: input.name,
    why: '',
    scope: '',
    created: now,
  };
  const content = renderProposalTemplate(input.name, input.description ?? '');
  writeFileSync(proposalFile, writeFrontmatter(fm, content), 'utf8');

  // 写 README 占位
  const readme = join(root, 'README.md');
  writeFileSync(readme, `# Change: ${input.name}\n\n创建于 ${now}\n`, 'utf8');

  return { name: input.name, root, proposalFile };
}

function renderProposalTemplate(name: string, description: string): string {
  return `# ${name}

> ${description || '（请填写 change 描述）'}

## 为什么
<!-- 这次变更的动机？要解决的痛点？ -->

## 范围
<!-- 影响哪些 topic / L1 / L2 / L3？ -->

## 风险与回滚
<!-- 失败时如何回滚？影响哪些 AC？ -->

## 影响的需求
<!-- 列出 affectedCriteria -->
`;
}

function nextTaskLinkedChangeName(paths: ProjectPaths, specCode: string, taskCode: string): string {
  const base = `${slugPart(specCode)}-${slugPart(taskCode)}-proposal`;
  let name = base;
  let idx = 2;
  while (existsSync(changeDir(paths, name))) {
    name = `${base}-${idx}`;
    idx += 1;
  }
  return name;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderTaskLinkedProposalContent(fm: {
  name: string;
  taskCode: string;
  specCode: string;
  reason: string;
  impact: string;
  status: TaskLinkedChangeStatus;
}): string {
  return `# ${fm.name}

> Task-linked implementation change proposal. Status: **${fm.status}**.

## 关联

- task: ${fm.taskCode}
- spec: ${fm.specCode}

## Reason

${fm.reason}

## Impact

${fm.impact}

## Next Options

- Amend the L3 spec and freeze it again.
- Record a decision if the implementation direction is now intentional.
- Split follow-up work into a new task.
- Resolve this proposal once the scope decision is handled.
`;
}

function proposalFromFrontmatter(
  name: string,
  root: string,
  proposalFile: string,
  fm: ProposalFrontmatter,
): TaskLinkedChangeProposal {
  return {
    name,
    root,
    proposalFile,
    taskCode: fm.taskCode ?? '',
    specCode: fm.specCode ?? '',
    topic: fm.topic ?? '',
    reason: fm.reason ?? '',
    impact: fm.impact ?? '',
    status: fm.status ?? 'unresolved',
    created: fm.created ?? '',
    updated: fm.updated ?? fm.created ?? '',
  };
}

/**
 * 把 delta entry 渲染成可写的 delta 文件格式。
 * 用户可以直接 edit 这个文件，然后再 archive。
 */
export function renderDeltaFile(specCode: string, entries: ChangeEntry[]): string {
  const fm = { code: specCode };
  const body: string[] = [];
  const grouped: Record<ChangeOpT, ChangeEntry[]> = {
    ADDED: [], MODIFIED: [], REMOVED: [], RENAMED: [],
  };
  for (const e of entries) grouped[e.op].push(e);

  for (const op of ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'] as ChangeOpT[]) {
    if (grouped[op].length === 0) continue;
    body.push(`## ${op} Requirements`);
    body.push('');
    for (const e of grouped[op]) {
      if (op === 'RENAMED') {
        body.push(`- FROM: ${e.code} TO: ${e.newCode}`);
      } else if (op === 'REMOVED') {
        body.push(`### Requirement: ${e.code}`);
        if (e.changeSummary) body.push(e.changeSummary);
      } else {
        body.push(`### Requirement: ${e.code}`);
        body.push('');
        body.push(e.content ?? '（待填写）');
      }
      body.push('');
    }
  }
  return writeFrontmatter(fm, body.join('\n'));
}
