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
import {
  createTask,
  startTask,
  reportStep,
  failTask,
  waitTask,
  showTask,
  listTasks,
  type TaskStatus,
  VERIFICATION_LAYER_ORDER,
} from '../core/task.js';
import { runTaskCompletion } from '../core/task-completion.js';
import {
  buildHarnessTaskContext,
  renderHarnessTaskContextText,
} from '../core/harness.js';
import { buildTaskEvidence, type TaskEvidence } from '../core/task-evidence.js';
import { listDecisions } from '../core/decision.js';
import { StepStatusSchema } from '../schemas/spec.js';
import { createDefaultCliActionContext, getWritePaths, runCliAction } from './common.js';
import {
  printTaskReportResult,
  printTaskVerifyResult,
  runTaskReportCommand,
  runTaskVerifyCommand,
  TASK_REPORT_KNOWN_ERRORS,
  TASK_VERIFY_KNOWN_ERRORS,
} from './task-handlers.js';
import { printTaskRunResult, runTaskRunCommand } from './task-run.js';

const TASK_STATUSES: TaskStatus[] = ['draft', 'running', 'waiting', 'completed', 'failed'];

export function registerTaskCommands(program: Command): void {
  const task = program
    .command('task')
    .description('Agent Task 生命周期管理（创建/执行步骤/完成/失败）');

  task
    .command('run <specCode>')
    .description('确认/冻结 L3 后创建并启动 Agent Task')
    .requiredOption('--plan <file>', 'planJson 文件路径（含 steps[]）')
    .option('--auto-confirm', 'human_gate 自动通过', false)
    .option('--profile <profile>', 'workflow profile: standard | governed')
    .option('--profile-reason <reason>', '显式覆盖项目默认 Profile 的原因')
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { plan: string; autoConfirm: boolean; profile?: string; profileReason?: string; json: boolean }) => {
      const context = createDefaultCliActionContext();
      const planJson = JSON.parse(readFileSync(opts.plan, 'utf8'));
      try {
        const result = runTaskRunCommand({
          context,
          specCode,
          planJson,
          autoConfirm: opts.autoConfirm,
          profile: opts.profile,
          profileReason: opts.profileReason,
        });
        printTaskRunResult(context, result, { json: opts.json });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.startsWith('SPEC_CLI_EXIT_1:') ||
          message.startsWith('SPEC_CLI_EXIT_2:') ||
          message.startsWith('ADAPTIVE_WORKFLOW_DISABLED:') ||
          message.startsWith('INVALID_WORKFLOW_PROFILE:') ||
          message.startsWith('PROFILE_OVERRIDE_REASON_REQUIRED:') ||
          message.startsWith('GOVERNED_CRITICAL_AC_REQUIRED:') ||
          message.startsWith('UNKNOWN_CRITICAL_AC:') ||
          message.startsWith('PLAN_JSON_INVALID:') ||
          message.startsWith('R12:') ||
          message.startsWith('R10:') ||
          message.startsWith('TASK_RUN_SPEC_NOT_L3:') ||
          message.startsWith('TASK_RUN_SPEC_STATUS_INVALID:') ||
          message.startsWith('TASK_ALREADY_ACTIVE:')
        ) {
          console.error(`✗ ${message.replace(/^SPEC_CLI_EXIT_[12]:/, '')}`);
          process.exit(2);
        }
        throw err;
      }
    });

  task
    .command('create <specCode>')
    .description('为 frozen L3 spec 创建 Agent Task（R3）')
    .requiredOption('--plan <file>', 'planJson 文件路径（含 steps[]）')
    .option('--auto-confirm', 'human_gate 自动通过', false)
    .option('--profile <profile>', 'workflow profile: standard | governed')
    .option('--profile-reason <reason>', '显式覆盖项目默认 Profile 的原因')
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { plan: string; autoConfirm: boolean; profile?: string; profileReason?: string; json: boolean }) => {
      const paths = getWritePaths();
      const planJson = JSON.parse(readFileSync(opts.plan, 'utf8'));
      let result: ReturnType<typeof createTask>;
      try {
        result = createTask({
          paths,
          specCode,
          planJson,
          autoConfirm: opts.autoConfirm,
          profile: opts.profile,
          profileOverrideReason: opts.profileReason,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.startsWith('ADAPTIVE_WORKFLOW_DISABLED:') ||
          message.startsWith('INVALID_WORKFLOW_PROFILE:') ||
          message.startsWith('PROFILE_OVERRIDE_REASON_REQUIRED:') ||
          message.startsWith('GOVERNED_CRITICAL_AC_REQUIRED:') ||
          message.startsWith('UNKNOWN_CRITICAL_AC:') ||
          message.startsWith('PLAN_JSON_INVALID:')
        ) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`✓ Task ${result.task.id} created for ${specCode}`);
      console.log(`  file: ${result.taskFile}`);
      console.log(`  status: ${result.task.status}`);
      console.log(`  steps: ${planJson.steps.length}`);
      console.log(`  profile: ${result.task.profile ?? 'legacy'} (${result.task.profileSource ?? 'legacy'})`);
    });

  task
    .command('context <l3Code>')
    .description('从 frozen/implemented L3 生成 coding harness task context')
    .option('--format <format>', 'text | json', 'text')
    .action((l3Code: string, opts: { format: string }) => {
      if (opts.format !== 'text' && opts.format !== 'json') {
        console.error('✗ task context --format 必须是 text 或 json');
        process.exit(2);
      }
      const paths = getWritePaths();
      try {
        const context = buildHarnessTaskContext(paths, l3Code);
        if (opts.format === 'json') {
          console.log(JSON.stringify(context, null, 2));
          return;
        }
        process.stdout.write(renderHarnessTaskContextText(context));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.startsWith('SPEC_NOT_FOUND:') ||
          message.startsWith('SPEC_NOT_L3:') ||
          message.startsWith('L3_NOT_FROZEN:')
        ) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  task
    .command('report <taskId>')
    .description('用 coding harness report payload 回写 task step')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--step <stepNo>', '指定回写步骤')
    .option('--summary <summary>', 'report summary（flags 模式必填）')
    .option('--files <files>', '逗号分隔的变更文件列表')
    .option('--tests <tests>', '逗号分隔的测试/验证列表')
    .option('--risks <risks>', '逗号分隔的风险备注列表')
    .option('--input <file>', '从 JSON 文件读取 report payload')
    .option('--json', '以 JSON 格式输出', false)
    .action(async (taskId: string, opts: {
      spec?: string;
      step?: string;
      summary?: string;
      files?: string;
      tests?: string;
      risks?: string;
      input?: string;
      json: boolean;
    }) => {
      const context = createDefaultCliActionContext();
      await runCliAction({
        context,
        knownErrors: TASK_REPORT_KNOWN_ERRORS,
        action: () => {
          const result = runTaskReportCommand({ context, taskId, opts });
          printTaskReportResult(context, result, { json: opts.json });
        },
      });
    });

  task
    .command('verify <taskId>')
    .description('记录 task 的结构化 verification evidence')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--command <command>', '验证命令')
    .option('--exit-code <code>', '验证 exit code', (v) => Number(v))
    .option('--summary <summary>', '验证摘要')
    .option('--artifacts <paths>', '逗号分隔的 artifact 路径')
    .option('--covers-ac <items>', '逗号分隔的 AC 编号')
    .option('--layer <layer>', 'verification layer: compile, functional, smoke')
    .option('--input <file>', '从 JSON 文件读取 verification payload')
    .option('--json', '以 JSON 格式输出', false)
    .action(async (taskId: string, opts: {
      spec?: string;
      command?: string;
      exitCode?: number;
      summary?: string;
      artifacts?: string;
      coversAc?: string;
      layer?: string;
      input?: string;
      json: boolean;
    }) => {
      const context = createDefaultCliActionContext();
      await runCliAction({
        context,
        knownErrors: TASK_VERIFY_KNOWN_ERRORS,
        action: () => {
          const result = runTaskVerifyCommand({ context, taskId, opts });
          printTaskVerifyResult(context, result, { json: opts.json });
        },
      });
    });

  task
    .command('evidence <taskId>')
    .description('展示 Task 的动态验收证据投影')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--format <format>', 'text | json', 'text')
    .action((taskId: string, opts: { spec?: string; format: string }) => {
      if (opts.format !== 'text' && opts.format !== 'json') {
        console.error('✗ task evidence --format 必须是 text 或 json');
        process.exit(2);
      }
      const paths = getWritePaths();
      try {
        const evidence = buildTaskEvidence(paths, taskId, opts.spec);
        if (opts.format === 'json') {
          console.log(JSON.stringify(evidence, null, 2));
          return;
        }
        process.stdout.write(renderTaskEvidenceText(evidence));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.startsWith('TASK_NOT_FOUND:') ||
          message.startsWith('SPEC_NOT_FOUND:') ||
          message.startsWith('UNKNOWN_CRITICAL_AC:')
        ) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  task
    .command('start <taskId>')
    .description('把 Task 状态从 draft/running 推进到 running')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .action((taskId: string, opts: { spec?: string }) => {
      const paths = getWritePaths();
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
    .option('--type <type>', '步骤类型（llm_call|tool_action|human_gate）')
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
      const paths = getWritePaths();
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
    .command('step-batch <taskId>')
    .description('从 JSON 文件顺序上报多个 step（推荐用于多 step/并发场景）')
    .requiredOption('--input <file>', '包含 steps[] 的 JSON 文件')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--json', '以 JSON 格式输出', false)
    .action((taskId: string, opts: { input: string; spec?: string; json: boolean }) => {
      const paths = getWritePaths();
      const payload = parseStepBatchPayload(readFileSync(opts.input, 'utf8'));
      const results = payload.steps.map((step) => {
        const parsed = StepStatusSchema.safeParse(step.status);
        if (!parsed.success) {
          throw new Error(`STEP_BATCH_STATUS_INVALID: step ${step.stepNo} status=${step.status}`);
        }
        const result = reportStep({
          paths,
          taskId,
          specCode: opts.spec,
          stepNo: step.stepNo,
          status: parsed.data,
          toolName: step.toolName,
          inputJson: step.inputJson,
          outputJson: step.outputJson,
          latencyMs: step.latencyMs,
          errorCode: step.errorCode,
          errorMessage: step.errorMessage,
        });
        return { stepNo: step.stepNo, status: parsed.data, warnings: result.warnings };
      });
      if (opts.json) {
        console.log(JSON.stringify({ taskId, specCode: opts.spec, steps: results }, null, 2));
        return;
      }
      console.log(`✓ ${results.length} step(s) reported for task ${taskId}`);
      for (const result of results) {
        console.log(`  - Step ${result.stepNo}: ${result.status}`);
        for (const warning of result.warnings) console.warn(`⚠ step ${result.stepNo}: ${warning}`);
      }
    });

  task
    .command('complete <taskId>')
    .description('标记 Task 完成 → 触发 L3 spec cascade → implemented')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--force', '已废弃：请改用独立 skip 参数并提供 --reason', false)
    .option('--skip-r18', '跳过 R18 active 决策卡片检查（异常恢复）', false)
    .option('--skip-verification', '跳过 L3 验证命令执行（异常恢复）', false)
    .option('--skip-verify', '跳过 @verify 规则执行', false)
    .option('--reason <text>', '跳过任一完成门禁时必填的审计原因')
    .option('--json', '以 JSON 格式输出 cascade 结果', false)
    .action((taskId: string, opts: { spec?: string; force: boolean; skipR18: boolean; skipVerification: boolean; skipVerify: boolean; reason?: string; json: boolean }) => {
      if (opts.force) {
        throw new Error('DEPRECATED_FORCE: --force 已移除；请按需使用 --skip-r18、--skip-verification 或 --skip-verify，并提供 --reason');
      }
      const paths = getWritePaths();
      const result = runTaskCompletion({
        paths,
        taskId,
        specCode: opts.spec,
        skipR18Check: opts.skipR18,
        skipVerification: opts.skipVerification,
        skipVerify: opts.skipVerify,
        bypassReason: opts.reason,
      });
      const nextCommand = deliverySummaryCommand(result.task.id, result.task.specCode);
      if (opts.json) {
        const { gateResults: _gateResults, ...legacyResult } = result;
        console.log(JSON.stringify({ ...legacyResult, nextCommand }, null, 2));
        return;
      }
      console.log(`✓ Task ${result.task.id} → completed`);
      console.log(`  finishedAt: ${result.task.finishedAt}`);
      const verificationCommands = result.gateResults.find(gate => gate.gate === 'verification-commands');
      const verifyRules = result.gateResults.find(gate => gate.gate === 'verify-rules');
      if (verificationCommands?.status === 'passed') {
        console.log(`  ✓ 验证命令通过 (${verificationCommands.metadata?.passed ?? 0}/${verificationCommands.metadata?.total ?? 0})`);
      }
      if (verifyRules?.status === 'passed') {
        console.log(`  ✓ @verify 规则通过 (${verifyRules.metadata?.passed ?? 0}/${verifyRules.metadata?.total ?? 0})`);
      }
      const evidenceCoverage = result.gateResults.find(gate => gate.gate === 'evidence-coverage');
      if (evidenceCoverage?.status === 'passed') {
        const metadata = evidenceCoverage.metadata ?? {};
        const required = metadata.required ?? 0;
        const covered = metadata.covered ?? 0;
        if (metadata.warning) {
          console.warn(`  ⚠ evidence coverage warning (${covered}/${required}): ${(metadata.blockingCriteria as string[] | undefined)?.join(', ') ?? '-'}`);
        } else {
          console.log(`  ✓ evidence coverage (${covered}/${required})`);
        }
      }
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
      // R18: completeTask 已校验决策卡片存在性并落 audit hit,此处仅展示结果
      if (result.cascadedL1Specs.length > 0) {
        console.log('');
        console.log('R18 (决策卡片):');
        for (const code of result.cascadedL1Specs) {
          const existing = listDecisions(paths, { docCode: code, includeAll: true });
          const active = existing.filter(d => d.fm.status === 'active');
          console.log(`  ✓ ${code} — ${existing.length} 张 (active: ${active.length})`);
        }
      }
      console.log('');
      console.log('Next:');
      console.log(`  ${nextCommand}`);
    });

  task
    .command('fail <taskId>')
    .description('标记 Task 失败')
    .option('--spec <specCode>', '限定查找范围（避免跨 spec 的 T-001 冲突）')
    .option('--code <code>', '错误代码', 'AGENT_TOOL')
    .option('--msg <message>', '错误信息', '未知错误')
    .action((taskId: string, opts: { spec?: string; code: string; msg: string }) => {
      const paths = getWritePaths();
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
      const paths = getWritePaths();
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
      const paths = getWritePaths();
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
      const verifications = result.task.verifications ?? [];
      console.log(`  verifications: ${verifications.length}`);
      const layers = Object.keys(result.verificationsByLayer);
      if (layers.length > 0) {
        for (const layer of VERIFICATION_LAYER_ORDER) {
          const items = result.verificationsByLayer[layer];
          if (!items || items.length === 0) continue;
          console.log(`  [${layer}]`);
          for (const v of items) {
            console.log(`    ${v.id}: ${v.command} → exit ${v.exitCode} (${v.created.slice(0, 10)})`);
          }
        }
      } else if (verifications.length > 0) {
        const latestVerification = verifications[verifications.length - 1];
        console.log(`    latest: ${latestVerification.id} exitCode=${latestVerification.exitCode} — ${latestVerification.summary}`);
      }
      console.log('  steps:');
      console.log(`    shownSteps: ${result.shownSteps}`);
      console.log(`    totalSteps: ${result.totalSteps}`);
      console.log(`    truncated: ${result.truncated}`);
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
      const paths = getWritePaths();
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
    .description('已弃用：禁止自动伪造 Task 成功记录')
    .requiredOption('--plan <file>', 'planJson 文件路径（含 steps[]）')
    .option('--auto-confirm', 'human_gate 自动通过', false)
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { plan: string; autoConfirm: boolean; json: boolean }) => {
      void specCode;
      void opts;
      console.error('✗ TASK_BATCH_DEPRECATED: use task create, start, report/step, verify, then complete');
      process.exit(2);
    });
}

interface StepBatchPayload {
  steps: Array<{
    stepNo: number | string;
    status: string;
    toolName?: string;
    inputJson?: string;
    outputJson?: string;
    latencyMs?: number;
    errorCode?: string;
    errorMessage?: string;
  }>;
}

function parseStepBatchPayload(raw: string): StepBatchPayload {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { steps?: unknown }).steps)) {
    throw new Error('STEP_BATCH_INVALID: input must be an object with steps[]');
  }
  const steps = (parsed as StepBatchPayload).steps;
  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== 'object') throw new Error(`STEP_BATCH_INVALID: steps[${index}] must be an object`);
    if (step.stepNo === undefined || step.stepNo === null || step.stepNo === '') {
      throw new Error(`STEP_BATCH_INVALID: steps[${index}].stepNo is required`);
    }
    if (!step.status) throw new Error(`STEP_BATCH_INVALID: steps[${index}].status is required`);
  }
  return { steps };
}

function deliverySummaryCommand(taskId: string, specCode: string): string {
  return `spec-manager assist delivery ${taskId} --spec ${specCode}`;
}

function renderTaskEvidenceText(evidence: TaskEvidence): string {
  const lines: string[] = [];
  lines.push(`Task Evidence: ${evidence.specCode} / ${evidence.taskId}`);
  lines.push(`Profile: ${evidence.profile} (${evidence.profileSource})`);
  lines.push(`Coverage: ${evidence.summary.covered}/${evidence.summary.required} critical AC covered`);
  lines.push('');
  lines.push('Critical Criteria:');
  if (evidence.criticalCriteria.length === 0) {
    lines.push('- none');
  } else {
    for (const item of evidence.criticalCriteria) {
      const icon = item.status === 'covered' ? '✓' : item.status === 'failed' ? '✗' : '!';
      const refs = item.verificationIds.length > 0 ? ` by ${item.verificationIds.join(', ')}` : '';
      lines.push(`${icon} ${item.id} ${item.status}${refs}`);
      lines.push(`  ${item.text}`);
    }
  }
  lines.push('');
  lines.push('Artifacts:');
  if (evidence.artifacts.length === 0) {
    lines.push('- none');
  } else {
    for (const artifact of evidence.artifacts) lines.push(`- ${artifact}`);
  }
  return `${lines.join('\n')}\n`;
}
