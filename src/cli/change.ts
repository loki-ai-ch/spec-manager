/**
 * change 子命令（OpenSpec 风格 delta）：
 *   new <name> [--description D]
 *   list
 *   show <name>
 *   archive <name>
 */

import { Command } from 'commander';
import { getPaths } from '../core/paths.js';
import {
  createChange,
  createTaskLinkedChangeProposal,
  getChangeDir,
  listChanges,
  listTaskLinkedChangeProposals,
  parseDeltaSpec,
  readTaskLinkedChangeProposal,
  resolveTaskLinkedChangeProposal,
} from '../core/delta.js';
import { archiveChange } from '../core/archive.js';

export function registerChangeCommands(program: Command): void {
  const change = program
    .command('change')
    .description('Delta change 提案（OpenSpec 风格：proposal + ADDED/MODIFIED/REMOVED/RENAMED）');

  change
    .command('propose')
    .description('创建与 task/L3 关联的 change proposal')
    .requiredOption('--task <taskCode>', '关联 task code')
    .requiredOption('--spec <specCode>', '关联 L3 spec code')
    .requiredOption('--reason <reason>', '偏差原因')
    .requiredOption('--impact <impact>', '影响范围')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { task: string; spec: string; reason: string; impact: string; json: boolean }) => {
      const paths = getPaths();
      try {
        const result = createTaskLinkedChangeProposal({
          paths,
          taskCode: opts.task,
          specCode: opts.spec,
          reason: opts.reason,
          impact: opts.impact,
        });
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(`✓ Change proposal created: ${result.name}`);
        console.log(`  status: ${result.status}`);
        console.log(`  task: ${result.taskCode}`);
        console.log(`  spec: ${result.specCode}`);
        console.log(`  proposal: ${result.proposalFile}`);
        console.log('');
        console.log('Next:');
        console.log(`  spec-manager change show ${result.name}`);
        console.log(`  spec-manager change resolve ${result.name}`);
      } catch (err) {
        handleChangeError(err);
      }
    });

  change
    .command('new <name>')
    .description('创建 change 提案目录（changes/<name>/）')
    .option('--description <desc>', '一句话描述（写入 proposal.md）')
    .action((name: string, opts: { description?: string }) => {
      const paths = getPaths();
      const result = createChange({ paths, name, description: opts.description });
      console.log(`✓ Change created: ${result.name}`);
      console.log(`  root: ${result.root}`);
      console.log(`  proposal: ${result.proposalFile}`);
      console.log('');
      console.log('下一步：');
      console.log(`  1. 编辑 ${result.proposalFile} 填写 why/scope/risk`);
      console.log(`  2. 在 ${result.root}/deltas/ 创建 delta 文件（ADDED/MODIFIED/REMOVED/RENAMED 段）`);
      console.log(`  3. 在 ${result.root}/specs/<topic>/<code>/ 创建新 spec 占位（ADDED 用）`);
      console.log(`  4. spec-manager change archive ${result.name}`);
    });

  change
    .command('list')
    .description('列出活跃 change 提案')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      const all = listChanges(paths);
      if (opts.json) {
        const taskLinked = listTaskLinkedChangeProposals(paths);
        console.log(JSON.stringify(all.map(c => taskLinked.find(p => p.name === c.name) ?? c), null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('(no active changes)');
        return;
      }
      const taskLinkedByName = new Map(listTaskLinkedChangeProposals(paths).map(p => [p.name, p]));
      for (const c of all) {
        const taskLinked = taskLinkedByName.get(c.name);
        if (taskLinked) {
          console.log(`  ${c.name}  ${taskLinked.status}  task=${taskLinked.taskCode}  spec=${taskLinked.specCode}`);
        } else {
          console.log(`  ${c.name}  (created ${c.created || '?'})`);
        }
      }
    });

  change
    .command('show <name>')
    .description('查看 change 详情（含解析后的 delta entries）')
    .option('--json', '以 JSON 格式输出', false)
    .action((name: string, opts: { json: boolean }) => {
      const paths = getPaths();
      const dir = getChangeDir(paths, name);
      if (!dir) {
        console.error(`✗ Change not found: ${name}`);
        process.exit(1);
      }
      if (opts.json) {
        const taskLinked = readTaskLinkedChangeProposal(paths, name);
        if (taskLinked) {
          console.log(JSON.stringify({ name, changes: [], proposal: taskLinked }, null, 2));
          return;
        }
        const delta = parseDeltaSpec(paths, name);
        console.log(JSON.stringify({ ...delta, proposal: taskLinked }, null, 2));
        return;
      }
      const taskLinked = readTaskLinkedChangeProposal(paths, name);
      console.log(`Change: ${name}`);
      console.log(`  root: ${dir.root}`);
      console.log(`  proposal: ${dir.proposal}`);
      if (taskLinked) {
        console.log(`  type: task-linked`);
        console.log(`  status: ${taskLinked.status}`);
        console.log(`  task: ${taskLinked.taskCode}`);
        console.log(`  spec: ${taskLinked.specCode}`);
        console.log(`  reason: ${taskLinked.reason}`);
        console.log(`  impact: ${taskLinked.impact}`);
      }
      console.log(`  delta files: ${dir.deltaFiles.length}`);
      for (const f of dir.deltaFiles) console.log(`    - ${f}`);
      console.log(`  spec files: ${dir.specFiles.length}`);
      for (const f of dir.specFiles) console.log(`    - ${f}`);
    });

  change
    .command('resolve <name>')
    .description('将 task-linked change proposal 标记为 resolved')
    .option('--json', '以 JSON 格式输出', false)
    .action((name: string, opts: { json: boolean }) => {
      const paths = getPaths();
      try {
        const result = resolveTaskLinkedChangeProposal(paths, name);
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(`✓ Change proposal resolved: ${result.name}`);
        console.log(`  status: ${result.status}`);
      } catch (err) {
        handleChangeError(err);
      }
    });

  change
    .command('archive <name>')
    .description('应用 delta 到主 specs/，把 changes/<name>/ 移到 archive/')
    .option('--json', '以 JSON 格式输出', false)
    .action((name: string, opts: { json: boolean }) => {
      const paths = getPaths();
      const result = archiveChange(paths, name);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`✓ Change ${name} archived`);
      console.log(`  archived to: ${result.archivedTo}`);
      console.log(`  applied: ${result.applied.length}`);
      for (const a of result.applied) {
        const fromTo = a.from && a.to ? ` (${a.from} → ${a.to})` : '';
        console.log(`    [${a.op}] ${a.code}${fromTo}`);
      }
      if (result.skipped.length > 0) {
        console.log(`  skipped: ${result.skipped.length}`);
        for (const s of result.skipped) {
          console.log(`    [${s.op}] ${s.code}: ${s.reason}`);
        }
      }
    });
}

function handleChangeError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.startsWith('INVALID_CHANGE:') ||
    message.startsWith('SPEC_NOT_FOUND:') ||
    message.startsWith('SPEC_NOT_L3:') ||
    message.startsWith('TASK_NOT_FOUND:') ||
    message.startsWith('CHANGE_NOT_FOUND:')
  ) {
    console.error(`✗ ${message}`);
    process.exit(2);
  }
  throw err;
}
