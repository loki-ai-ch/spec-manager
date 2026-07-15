/**
 * decision 子命令：
 *   create <spec-code> --topic X --what W [--why Y] [--criteria AC-1,AC-2]
 *   list [--topic X] [--criteria AC-1,AC-2] [--include-all]
 *   supersede <id> --by <new-id>
 *   update <id> [--what W] [--why Y] [--criteria AC-1,AC-2]
 *   set-partial <id> --reason "..."
 *   show <id>
 *   delete <id>
 */

import { Command } from 'commander';
import { createDecision, listDecisions, findDecision, supersedeDecision, updateDecision, setDecisionPartial, deleteDecision } from '../core/decision.js';
import { DecisionInputSchema } from '../schemas/spec.js';
import { getWritePaths } from './common.js';

export function registerDecisionCommands(program: Command): void {
  const dec = program
    .command('decision')
    .description('Decision Cards — 为 confirmed/implemented L1 spec 记录"决定了什么 / 为什么"');

  dec
    .command('create <specCode>')
    .description('为 confirmed/implemented L1 spec 创建决策卡片（R18）')
    .requiredOption('--topic <topic>', '功能主题')
    .requiredOption('--what <what>', '决定了什么（≤500 字）')
    .option('--why <why>', '为什么（≤500 字）')
    .option('--criteria <list>', '影响的验收标准（逗号分隔，如 AC-1,AC-3）')
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { topic: string; what: string; why?: string; criteria?: string; json: boolean }) => {
      // Zod 校验输入
      const affectedCriteria = opts.criteria
        ? opts.criteria.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      const parsed = DecisionInputSchema.safeParse({
        topic: opts.topic,
        what: opts.what,
        why: opts.why,
        affectedCriteria,
      });
      if (!parsed.success) {
        console.error(`✗ 输入非法: ${parsed.error.message}`);
        process.exit(2);
      }
      const paths = getWritePaths();
      const record = createDecision({
        paths,
        docCode: specCode,
        topic: parsed.data.topic,
        what: parsed.data.what,
        why: parsed.data.why,
        affectedCriteria: parsed.data.affectedCriteria,
      });
      if (opts.json) {
        console.log(JSON.stringify(record, null, 2));
        return;
      }
      console.log(`✓ Decision ${record.id} created for ${specCode}`);
      console.log(`  file: ${record.filePath}`);
      console.log(`  what: ${record.fm.what.slice(0, 60)}${record.fm.what.length > 60 ? '...' : ''}`);
    });

  dec
    .command('list')
    .description('列出决策卡片（默认仅 active）')
    .option('--topic <topic>', '按 topic 过滤')
    .option('--doc-code <specCode>', '按关联 spec code 过滤（task complete R18 自检用）')
    .option('--criteria <list>', '按 affectedCriteria 过滤（逗号分隔，如 AC-1,AC-3）')
    .option('--include-all', '包含 superseded/partial 状态的', false)
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; docCode?: string; criteria?: string; includeAll: boolean; json: boolean }) => {
      const paths = getWritePaths();
      const all = listDecisions(paths, {
        topic: opts.topic,
        docCode: opts.docCode,
        criteria: opts.criteria,
        includeAll: opts.includeAll,
      });
      if (opts.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('(no decisions)');
        return;
      }
      for (const d of all) {
        const status = d.fm.status === 'active' ? '●' : (d.fm.status === 'superseded' ? '○' : '◐');
        const sup = d.fm.supersededById ? ` (→ ${d.fm.supersededById})` : '';
        const ac = d.fm.affectedCriteria && d.fm.affectedCriteria.length > 0
          ? ` {${d.fm.affectedCriteria.join(',')}}`
          : '';
        console.log(`${status} ${d.id}  [${d.fm.topic}]  ${d.fm.what.slice(0, 60)}${d.fm.what.length > 60 ? '...' : ''}${ac}${sup}`);
      }
    });

  dec
    .command('show <id>')
    .description('查看决策详情')
    .option('--json', '以 JSON 格式输出', false)
    .action((id: string, opts: { json: boolean }) => {
      const paths = getWritePaths();
      const d = findDecision(paths, id);
      if (!d) {
        console.error(`✗ Decision not found: ${id}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(JSON.stringify(d, null, 2));
        return;
      }
      console.log(`# ${d.id} — ${d.fm.what}`);
      console.log('');
      console.log(`关联 spec: ${d.fm.docCode}`);
      console.log(`状态: ${d.fm.status}${d.fm.supersededById ? `（被 ${d.fm.supersededById} 取代）` : ''}`);
      console.log(`创建: ${d.fm.created}`);
      console.log('');
      console.log('## 决定');
      console.log(d.fm.what);
      if (d.fm.why) {
        console.log('');
        console.log('## 为什么');
        console.log(d.fm.why);
      }
      if (d.fm.affectedCriteria && d.fm.affectedCriteria.length > 0) {
        console.log('');
        console.log('## 影响的验收标准');
        for (const c of d.fm.affectedCriteria) console.log(`- ${c}`);
      }
    });

  dec
    .command('supersede <oldId>')
    .description('把旧决策标记为 superseded（指向新决策）')
    .requiredOption('--by <newId>', '新决策的 ID')
    .action((oldId: string, opts: { by: string }) => {
      const paths = getWritePaths();
      supersedeDecision(paths, oldId, opts.by);
      console.log(`✓ Decision ${oldId} → superseded by ${opts.by}`);
    });

  dec
    .command('update <id>')
    .description('编辑 active 决策的 what/why/affectedCriteria（状态变更走 supersede/set-partial）')
    .option('--what <what>', '新的决定内容（≤500 字）')
    .option('--why <why>', '新的原因（≤500 字）')
    .option('--criteria <list>', '新的影响验收标准（逗号分隔,如 AC-1,AC-3）')
    .option('--json', '以 JSON 格式输出', false)
    .action((id: string, opts: { what?: string; why?: string; criteria?: string; json: boolean }) => {
      const affectedCriteria = opts.criteria
        ? opts.criteria.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      const paths = getWritePaths();
      const updated = updateDecision({
        paths,
        id,
        what: opts.what,
        why: opts.why,
        affectedCriteria,
      });
      if (opts.json) {
        console.log(JSON.stringify(updated, null, 2));
        return;
      }
      console.log(`✓ Decision ${updated.id} updated`);
      console.log(`  what: ${updated.fm.what.slice(0, 60)}${updated.fm.what.length > 60 ? '...' : ''}`);
    });

  dec
    .command('set-partial <id>')
    .description('把 active 决策标记为 partial(部分失效),需提供 --reason')
    .requiredOption('--reason <reason>', '为什么标 partial(哪些部分失效)')
    .option('--json', '以 JSON 格式输出', false)
    .action((id: string, opts: { reason: string; json: boolean }) => {
      const paths = getWritePaths();
      const updated = setDecisionPartial({ paths, id, reason: opts.reason });
      if (opts.json) {
        console.log(JSON.stringify(updated, null, 2));
        return;
      }
      console.log(`✓ Decision ${updated.id} → partial`);
      console.log(`  reason: ${opts.reason}`);
    });

  dec
    .command('delete <id>')
    .description('删除决策(active 状态;非 active 状态需先恢复或归档)')
    .action((id: string) => {
      const paths = getWritePaths();
      deleteDecision(paths, id);
      console.log(`✓ Decision ${id} deleted`);
    });
}
