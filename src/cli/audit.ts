/**
 * audit 子命令：
 *   session start [--session-id ID] [--topic T]
 *   hit <ruleId> [--spec S] [--task T]
 *   report
 *   show [--rule R1]
 */

import { Command } from 'commander';
import { randomBytes } from 'node:crypto';
import { getPaths } from '../core/paths.js';
import { hit, report, showSummary, startSession, RULE_ID_RE } from '../core/audit.js';

export function registerAuditCommands(program: Command): void {
  const audit = program
    .command('audit')
    .description('规则合规审计（at-least-once 语义，本地存档）');

  audit
    .command('session')
    .description('启动一个 audit session（不调也能 hit，sessionId 自动生成）')
    .option('--session-id <id>', '自定义 session ID', () => `sess-${randomBytes(4).toString('hex')}`)
    .option('--topic <topic>', '绑定 topic')
    .action((opts: { sessionId: string; topic?: string }) => {
      const paths = getPaths();
      const state = startSession(paths, { sessionId: opts.sessionId, topic: opts.topic });
      console.log(`✓ Audit session started: ${state.sessionId}`);
      if (state.topic) console.log(`  topic: ${state.topic}`);
      console.log(`  file: ${paths.auditFile}`);
    });

  audit
    .command('hit <ruleId>')
    .description('递增某条规则的命中计数（at-least-once: 总是写 pending）')
    .option('--spec <specCode>', '关联的 spec code')
    .option('--task <taskCode>', '关联的 task code')
    .action((ruleId: string, opts: { spec?: string; task?: string }) => {
      if (!RULE_ID_RE.test(ruleId)) {
        console.error(`✗ ruleId 格式非法: ${ruleId}（必须 /^R([1-9]|1[0-9]|2[0-4])$/）`);
        process.exit(2);
      }
      const paths = getPaths();
      const state = hit({ paths, ruleId, specCode: opts.spec, taskCode: opts.task });
      console.log(`✓ ${ruleId} hit (count: ${state.rules[ruleId]})`);
      console.log(`  pending: ${state.pending.filter(e => !e.reported).length} unreported`);
    });

  audit
    .command('report')
    .description('flush pending 队列 → 本地 archive')
    .action(() => {
      const paths = getPaths();
      const result = report(paths);
      console.log(`✓ Audit reported: ${result.markedReported} entries → archive`);
      console.log(`  remaining pending: ${result.remaining}`);
    });

  audit
    .command('show')
    .description('查看 audit 摘要（24 条规则 + pending 数量）')
    .option('--rule <ruleId>', '只看一条规则')
    .action((opts: { rule?: string }) => {
      const paths = getPaths();
      console.log(showSummary(paths, { ruleId: opts.rule }));
    });
}
