/**
 * task 子命令：
 *   create <spec> --plan <file> [--auto-confirm]
 *   start <task-id>
 *   step <task-id> --no <N> --status <s> [--type T] [--name S] [--tool T] [--output-json J] [--input-json J] [--latency L] [--error-code E] [--error-message M]
 *   complete <task-id>
 *   fail <task-id> [--code E] [--msg M]
 *   wait <task-id> [--reason R]
 *   show <task-id> [--full]
 *   list [--topic T] [--spec S] [--status running]
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { getPaths } from '../core/paths.js';
import {
  createTask,
  startTask,
  reportStep,
  completeTask,
  failTask,
  waitTask,
  showTask,
  listTasks,
  type TaskStatus,
} from '../core/task.js';
import { listDecisions } from '../core/decision.js';
import { findSpecByCode } from '../core/spec-io.js';
import { hit as auditHit } from '../core/audit.js';
import { StepStatusSchema } from '../schemas/spec.js';

const TASK_STATUSES: TaskStatus[] = ['draft', 'running', 'waiting', 'completed', 'failed'];

export function registerTaskCommands(program: Command): void {
  const task = program
    .command('task')
    .description('Agent Task 生命周期管理（创建/执行步骤/完成/失败）');

  task
    .command('create <specCode>')
    .description('为 frozen L3 spec 创建 Agent Task（R3）')
    .requiredOption('--plan <file>', 'planJson 文件路径（含 steps[]）')
    .option('--auto-confirm', 'human_gate 自动通过', false)
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { plan: string; autoConfirm: boolean; json: boolean }) => {
      const paths = getPaths();
      const planJson = JSON.parse(readFileSync(opts.plan, 'utf8'));
      const result = createTask({
        paths,
        specCode,
        planJson,
        autoConfirm: opts.autoConfirm,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`✓ Task ${result.task.id} created for ${specCode}`);
      console.log(`  file: ${result.taskFile}`);
      console.log(`  status: ${result.task.status}`);
      console.log(`  steps: ${planJson.steps.length}`);
    });

  task
    .command('start <taskId>')
    .description('把 Task 状态从 draft/running 推进到 running')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .action((taskId: string, opts: { spec?: string }) => {
      const paths = getPaths();
      const updated = startTask(paths, taskId, opts.spec);
      console.log(`✓ Task ${updated.id} → running`);
      console.log(`  startedAt: ${updated.startedAt}`);
    });

  task
    .command('step <taskId>')
    .description('上报一个 step 的执行结果（写入 task JSON steps[]）')
    .requiredOption('--no <stepNo>', '步骤编号', (v) => v)
    .requiredOption('--status <status>', '状态: pending|running|succeeded|failed|skipped')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--type <type>', '步骤类型（llm_call|mcp_tool|human_gate）')
    .option('--name <name>', '步骤名称')
    .option('--tool <toolName>', '工具名（如 Read/Write）')
    .option('--input-json <json>', '输入 JSON 字符串')
    .option('--output-json <json>', '输出 JSON 字符串（必含 summary，R15）')
    .option('--latency <ms>', '耗时（毫秒）', (v) => Number(v))
    .option('--error-code <code>', '错误代码')
    .option('--error-message <msg>', '错误信息')
    .action((taskId: string, opts: {
      no: string;
      status: string;
      spec?: string;
      type?: string;
      name?: string;
      tool?: string;
      inputJson?: string;
      outputJson?: string;
      latency?: number;
      errorCode?: string;
      errorMessage?: string;
    }) => {
      // Zod 校验 status
      const parsed = StepStatusSchema.safeParse(opts.status);
      if (!parsed.success) {
        console.error(`✗ --status 非法: ${opts.status}（必须 pending|running|succeeded|failed|skipped）`);
        process.exit(2);
      }
      const paths = getPaths();
      const result = reportStep({
        paths,
        taskId,
        specCode: opts.spec,
        stepNo: opts.no,
        status: parsed.data,
        toolName: opts.tool,
        inputJson: opts.inputJson,
        outputJson: opts.outputJson,
        latencyMs: opts.latency,
        errorCode: opts.errorCode,
        errorMessage: opts.errorMessage,
      });
      console.log(`✓ Step ${opts.no} reported for task ${taskId}`);
      for (const w of result.warnings) console.warn(`⚠ ${w}`);
    });

  task
    .command('complete <taskId>')
    .description('标记 Task 完成 → 触发 L3 spec cascade → implemented')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--json', '以 JSON 格式输出 cascade 结果', false)
    .action((taskId: string, opts: { spec?: string; json: boolean }) => {
      const paths = getPaths();
      const result = completeTask({ paths, taskId, specCode: opts.spec });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`✓ Task ${result.task.id} → completed`);
      console.log(`  finishedAt: ${result.task.finishedAt}`);
      if (result.cascadedSpecs.length > 0) {
        console.log('  cascaded:');
        for (const c of result.cascadedSpecs) {
          console.log(`    ${c.code} (${c.level}): ${c.oldStatus} → ${c.newStatus}`);
        }
      }
      if (result.skippedSpecs.length > 0) {
        console.log('  skipped:');
        for (const s of result.skippedSpecs) {
          console.log(`    ${s.code} (${s.reason})`);
        }
      }
      // R18 自检:对每个新 implemented 的 L1,检查是否已有决策卡片,自动 audit hit 落库
      if (result.cascadedL1Specs.length > 0) {
        console.log('');
        console.log('⚠ R18 (决策卡片):以下 L1 已 cascade 到 implemented');
        for (const code of result.cascadedL1Specs) {
          const existing = listDecisions(paths, { docCode: code, includeAll: true });
          const spec = findSpecByCode(paths, code);
          const topic = spec?.fm.topic ?? '?';
          // 自动 audit hit:无论是否已建,都记录"已检查"这一事实
          auditHit({ paths, ruleId: 'R18', specCode: code });
          if (existing.length === 0) {
            console.log(`  ✗ ${code} [${topic}] — 待建 (audit hit R18 已落库)`);
            console.log(`    spec-manager decision create ${code} \\`);
            console.log(`      --topic ${topic} --what "..." --why "..." --criteria AC-1,AC-2`);
          } else {
            const active = existing.filter(d => d.fm.status === 'active');
            console.log(`  ✓ ${code} [${topic}] — 已有 ${existing.length} 张 (active: ${active.length}, audit hit R18 已落库)`);
          }
        }
      }
    });

  task
    .command('fail <taskId>')
    .description('标记 Task 失败')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--code <code>', '错误代码', 'AGENT_TOOL')
    .option('--msg <message>', '错误信息', '未知错误')
    .action((taskId: string, opts: { spec?: string; code: string; msg: string }) => {
      const paths = getPaths();
      const updated = failTask({
        paths,
        taskId,
        specCode: opts.spec,
        errorCode: opts.code,
        errorMessage: opts.msg,
      });
      console.log(`✗ Task ${updated.id} → failed`);
      console.log(`  ${opts.code}: ${opts.msg}`);
    });

  task
    .command('wait <taskId>')
    .description('把 Task 标记为 waiting（等人工确认）')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--reason <reason>', '等待原因', '需要人工确认')
    .action((taskId: string, opts: { spec?: string; reason: string }) => {
      const paths = getPaths();
      const updated = waitTask({ paths, taskId, specCode: opts.spec, reason: opts.reason });
      console.log(`⏸ Task ${updated.id} → waiting`);
      console.log(`  reason: ${updated.waitReason}`);
    });

  task
    .command('show <taskId>')
    .description('查看 Task 详情（默认 last 5 steps + totalSteps）')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--full', '返回完整 steps 列表', false)
    .option('--json', '以 JSON 格式输出', false)
    .action((taskId: string, opts: { spec?: string; full: boolean; json: boolean }) => {
      const paths = getPaths();
      const result = showTask(paths, taskId, { full: opts.full, specCode: opts.spec });
      if (!result) {
        console.error(`✗ Task not found: ${taskId}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`Task ${result.task.id} — ${result.task.specCode}`);
      console.log(`  status: ${result.task.status}`);
      console.log(`  startedAt: ${result.task.startedAt ?? '-'}`);
      console.log(`  finishedAt: ${result.task.finishedAt ?? '-'}`);
      if (result.task.waitReason) console.log(`  waitReason: ${result.task.waitReason}`);
      if (result.task.errorCode) console.log(`  error: ${result.task.errorCode} — ${result.task.errorMessage}`);
      console.log(`  steps: ${result.steps.length} (totalSteps: ${result.steps.length}${result.truncated ? ', truncated' : ''})`);
      if (result.steps.length > 0) {
        for (const s of result.steps) {
          const lat = s.latencyMs != null ? ` (${s.latencyMs}ms)` : '';
          console.log(`    [${s.stepNo}] ${s.status.padEnd(10)} ${s.name}${lat}`);
        }
      }
    });

  task
    .command('list')
    .description('列出所有 Task（可按 topic / spec / status 过滤）')
    .option('--topic <topic>', '按 topic 过滤（连续性层：执行前查同主题历史任务）')
    .option('--spec <specCode>', '按 spec code 过滤')
    .option('--status <status>', '按 status 过滤（draft|running|waiting|completed|failed）')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; spec?: string; status?: string; json: boolean }) => {
      const paths = getPaths();
      if (opts.status && !TASK_STATUSES.includes(opts.status as TaskStatus)) {
        console.error(`✗ --status 非法: ${opts.status}（必须 ${TASK_STATUSES.join('|')}）`);
        process.exit(2);
      }
      const all = listTasks(paths, {
        topic: opts.topic,
        specCode: opts.spec,
        status: opts.status as TaskStatus | undefined,
      });
      if (opts.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('(no tasks)');
        return;
      }
      for (const t of all) {
        console.log(`${t.id}  ${t.status.padEnd(10)}  ${t.specCode}  created=${t.created}`);
      }
    });

  // ── batch: 一条命令完成 create → start → step×N → complete ──
  task
    .command('batch <specCode>')
    .description('一条命令完成 Agent Task 全生命周期（create + start + step×N + complete）')
    .requiredOption('--plan <file>', 'planJson 文件路径（含 steps[]）')
    .option('--auto-confirm', 'human_gate 自动通过', false)
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { plan: string; autoConfirm: boolean; json: boolean }) => {
      const paths = getPaths();
      const planJson = JSON.parse(readFileSync(opts.plan, 'utf8'));

      // 1. create
      const { task: created } = createTask({ paths, specCode, planJson, autoConfirm: opts.autoConfirm });
      console.log(`✓ Task ${created.id} created for ${specCode}`);
      console.log(`  steps: ${planJson.steps.length}`);

      // 2. start
      startTask(paths, created.id, specCode);
      console.log(`✓ Task ${created.id} → running`);

      // 3. step × N
      for (const step of planJson.steps) {
        const outputJson = JSON.stringify({ summary: `step ${step.stepNo}: ${step.name}` });
        reportStep({
          paths,
          taskId: created.id,
          specCode,
          stepNo: step.stepNo,
          status: 'succeeded',
          outputJson,
        });
        console.log(`  [${step.stepNo}/${planJson.steps.length}] ${step.name}... succeeded`);
      }

      // 4. complete
      const result = completeTask({ paths, taskId: created.id, specCode });
      console.log(`✓ Task ${result.task.id} → completed`);
      if (result.cascadedSpecs.length > 0) {
        console.log('  cascaded:');
        for (const c of result.cascadedSpecs) {
          console.log(`    ${c.code} (${c.level}): ${c.oldStatus} → ${c.newStatus}`);
        }
      }
      if (result.skippedSpecs.length > 0) {
        console.log('  skipped:');
        for (const s of result.skippedSpecs) {
          console.log(`    ${s.code} (${s.reason})`);
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      }
    });
}
