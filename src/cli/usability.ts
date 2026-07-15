import { Command } from 'commander';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { getPaths } from '../core/paths.js';
import { buildAgentBrief } from '../core/capability-brief.js';
import { createSpec, findSpecByCode, generateSpecCode, isPlaceholderContent, listAllSpecs, updateSpec } from '../core/spec-io.js';
import { canTransition, type SpecStatus } from '../core/status.js';
import { getFlowStatus, isBlockingDoctorCheck, renderRichGuide, renderTemplate, runProjectDoctor, suggestAfterSpecCommand } from '../core/usability.js';
import {
  buildWorkflowDashboardProjection,
  buildWorkflowNextProjection,
  type WorkflowDashboardProjection,
  type WorkflowNextProjection,
} from '../core/workflow-surface.js';
import type { SpecLevel } from '../core/validate.js';
import { renderBriefTextLines } from './brief-presenter.js';
import { createDefaultCliActionContext, fail, getWritePaths, requireInitialized } from './common.js';
import { runSetupCommand } from './setup-presenter.js';
import { printTaskRunResult, runTaskRunCommand } from './task-run.js';

export function registerUsabilityCommands(program: Command): void {
  program
    .command('setup [request...]')
    .description('核心短路径：输出初始化、write root、agent 入口和下一步建议')
    .option('--topic <topic>', '限定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((requestParts: string[], opts: { topic?: string; json: boolean }) => {
      runSetupCommand(requestParts, opts);
    });

  program
    .command('brief [request...]')
    .description('核心短路径：生成 Agent Brief 并附带当前 workflow 下一步')
    .option('--topic <topic>', '限定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((requestParts: string[], opts: { topic?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const writePaths = getWritePaths(paths);
      const request = requestParts.join(' ').trim();
      try {
        const brief = buildAgentBrief({ paths: writePaths, request, topic: opts.topic });
        const next = buildWorkflowNextProjection(paths, {
          request,
          topic: opts.topic ?? brief.topic ?? undefined,
        });
        if (opts.json) {
          console.log(JSON.stringify({ brief, next }, null, 2));
          return;
        }
        for (const line of renderBriefTextLines(brief)) console.log(line);
        console.log('Workflow Next:');
        console.log(`  Write Root: ${next.writeRoot}`);
        console.log(`  ${next.nextAction.replace(/\n/g, '\n  ')}`);
        if (next.blockingReason) console.log(`  Why: ${next.blockingReason}`);
        if (next.storeDiagnostics.length > 0) {
          console.log('  Store Diagnostics:');
          for (const diagnostic of next.storeDiagnostics) {
            console.log(`    - [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('AGENT_BRIEF_REQUEST_REQUIRED:')) {
          fail(`✗ ${message}`, 2);
        }
        throw err;
      }
    });

  program
    .command('next [request...]')
    .description('核心短路径：根据请求或 topic 输出当前最安全下一步')
    .option('--topic <topic>', '限定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((requestParts: string[], opts: { topic?: string; json: boolean }) => {
      const paths = getPaths();
      const projection = buildWorkflowNextProjection(paths, {
        request: requestParts.join(' '),
        topic: opts.topic,
      });
      if (opts.json) {
        console.log(JSON.stringify(projection, null, 2));
        return;
      }
      for (const line of renderNextProjection(projection)) console.log(line);
    });

  program
    .command('dashboard')
    .description('核心短路径：输出项目或 topic 的 workflow 摘要')
    .option('--topic <topic>', '限定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; json: boolean }) => {
      const paths = getPaths();
      const projection = buildWorkflowDashboardProjection(paths, { topic: opts.topic });
      if (opts.json) {
        console.log(JSON.stringify(projection, null, 2));
        return;
      }
      for (const line of renderDashboardProjection(projection)) console.log(line);
    });

  program
    .command('flow')
    .description('流程视图：按 topic 展示 L1/L2/L3/Task 当前状态与下一步')
    .command('status')
    .option('--topic <topic>', '只查看指定 topic')
    .action((opts: { topic?: string }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const writePaths = getWritePaths(paths);
      const flows = getFlowStatus(writePaths, { topic: opts.topic });
      if (flows.length === 0) {
        console.log('(no topics)');
        console.log('Next: spec-manager spec new L1 --topic <topic> --title "..."');
        return;
      }
      for (const flow of flows) {
        console.log(flow.topic);
        if (flow.specs.length === 0) {
          console.log('  (no specs)');
        } else {
          for (const spec of flow.specs) {
            console.log(`  ${spec.fm.code.padEnd(28)} ${spec.fm.level.padEnd(3)} ${spec.fm.status.padEnd(12)} ${spec.fm.title}`);
          }
        }
        const activeTasks = flow.tasks.filter((t) => t.status !== 'completed' && t.status !== 'failed');
        if (activeTasks.length > 0) {
          console.log('  tasks:');
          for (const task of activeTasks) console.log(`    ${task.id} ${task.status} ${task.specCode}`);
        }
        console.log(`  Next: ${flow.nextAction}`);
      }
    });

  program
    .command('guide [request...]')
    .description('新手向导：检查项目状态并给出下一步')
    .option('--format <format>', 'text | rich', 'text')
    .action((requestParts: string[], opts: { format: string }) => {
      const request = requestParts.join(' ').trim();
      const paths = getPaths();
      if (!paths.isInitialized) {
        console.log('Next: spec-manager project init --name <project-name>');
        return;
      }
      if (opts.format !== 'text' && opts.format !== 'rich') {
        fail('✗ guide --format 必须是 text 或 rich', 2);
      }
      if (opts.format === 'rich') {
        const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
        process.stdout.write(renderRichGuide(paths, packageRoot, request) + '\n');
        return;
      }
      const doctor = runProjectDoctor(paths);
      const blocking = doctor.find((c) => isBlockingDoctorCheck(c) && c.action);
      if (blocking?.action) {
        console.log(`Next: ${blocking.action}`);
        return;
      }
      const writePaths = getWritePaths(paths);
      const topic = inferTopic(request) ?? '<topic>';
      const flow = getFlowStatus(writePaths, { topic })[0];
      console.log(`Request: ${request || '(none)'}`);
      console.log(`Next: ${flow?.nextAction ?? `spec-manager spec new L1 --topic ${topic} --title "..."`}`);
      const advisory = doctor.filter((c) => c.status !== 'ok' && !isBlockingDoctorCheck(c));
      if (advisory.length > 0) {
        console.log('Advisory:');
        for (const check of advisory) {
          console.log(`  - ${check.label}: ${check.detail}`);
          if (check.action) console.log(`    Next: ${check.action}`);
        }
      }
    });

  program
    .command('new')
    .description('常用创建快捷入口')
    .command('feature')
    .argument('<title...>', '功能标题')
    .requiredOption('--topic <topic>', 'topic 名')
    .option('--allow-duplicate-topic', '允许同 topic 下创建额外 L1', false)
    .action((titleParts: string[], opts: { topic: string; allowDuplicateTopic: boolean }) => {
      const executionPaths = getPaths();
      requireInitialized(executionPaths);
      const paths = getWritePaths(executionPaths);
      const title = titleParts.join(' ');
      const existingL1 = listAllSpecs(paths)
        .filter(s => s.fm.level === 'L1' && s.fm.topic === opts.topic && s.fm.status !== 'archived');
      const code = existingL1.length > 0 && opts.allowDuplicateTopic
        ? nextDuplicateL1Code(paths, opts.topic, existingL1.length + 1)
        : generateSpecCode(opts.topic, 'L1');
      if (findSpecByCode(paths, code)) {
        fail(`✗ code 已存在: ${code}\nNext: spec-manager flow status --topic ${opts.topic}`, 2);
      }
      const rec = createSpec({
        paths,
        code,
        level: 'L1',
        title,
        topic: opts.topic,
        parentCode: null,
      });
      console.log(`✓ Created feature L1: ${rec.fm.code}`);
      console.log(`  file: ${rec.filePath}`);
      console.log(`Next: ${suggestAfterSpecCommand(rec, paths)}`);
    });

  program
    .command('approve <code>')
    .description('快捷批准当前 spec：L1/L2 draft→confirmed，L3 draft/confirmed→frozen')
    .action((code: string) => {
      const executionPaths = getPaths();
      requireInitialized(executionPaths);
      const paths = getWritePaths(executionPaths);
      const rec = findSpecByCode(paths, code);
      if (!rec) fail(`✗ 未找到: ${code}`, 1);
      const target: SpecStatus = rec.fm.level === 'L3' && (rec.fm.status === 'draft' || rec.fm.status === 'confirmed')
        ? 'frozen'
        : 'confirmed';
      if ((target === 'confirmed' || target === 'frozen') && isPlaceholderContent(rec.content)) {
        fail(
          `✗ R22: ${code} 的 contentTemplate 仍是占位（"<!-- 在此粘贴正文 -->"）\n` +
          `  请先: spec-manager spec update ${code} --content <file> --ai-summary "..." --change-summary "..."`,
          2,
        );
      }
      if (!canTransition(rec.fm.status, target)) {
        fail(`✗ 状态非法: ${rec.fm.status} → ${target}\nNext: spec-manager flow status --topic ${rec.fm.topic}`, 2);
      }
      const { record } = updateSpec(paths, code, { status: target, changeSummary: `${rec.fm.status} → ${target}` });
      console.log(`✓ ${code}: ${rec.fm.status} → ${target}`);
      console.log(`Next: ${suggestAfterSpecCommand(record, paths)}`);
    });

  program
    .command('run <specCode>')
    .description('快捷执行 frozen L3：create task + start')
    .requiredOption('--plan <file>', 'planJson 文件路径')
    .option('--auto-confirm', 'human_gate 自动通过', false)
    .action((specCode: string, opts: { plan: string; autoConfirm: boolean }) => {
      const executionPaths = getPaths();
      requireInitialized(executionPaths);
      const context = createDefaultCliActionContext(getWritePaths(executionPaths));
      const planJson = JSON.parse(readFileSync(opts.plan, 'utf8'));
      const result = runTaskRunCommand({
        context,
        specCode,
        planJson,
        autoConfirm: opts.autoConfirm,
      });
      printTaskRunResult(context, result);
    });

  program
    .command('template <level>')
    .description('输出 L0/L1/L2/L3 或 agent-plan 模板')
    .option('--title <title>', '替换模板标题', 'Untitled')
    .option('--output <file>', '写入文件；不传则输出到 stdout')
    .action((levelRaw: string, opts: { title: string; output?: string }) => {
      const level = normalizeTemplateLevel(levelRaw);
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
      const content = renderTemplate(packageRoot, level, opts.title);
      if (opts.output) {
        writeFileSync(opts.output, content, 'utf8');
        console.log(`✓ Template written: ${opts.output}`);
      } else {
        process.stdout.write(content);
      }
    });
}

function normalizeTemplateLevel(input: string): SpecLevel | 'agent-plan' {
  const normalized = input.toUpperCase();
  if (['L0', 'L1', 'L2', 'L3'].includes(normalized)) return normalized as SpecLevel;
  if (input === 'agent-plan' || input === 'plan') return 'agent-plan';
  fail('✗ template level 必须是 L0/L1/L2/L3/agent-plan', 2);
}

function inferTopic(input: string): string | null {
  const first = input.toLowerCase().match(/[a-z0-9][a-z0-9-]*/)?.[0];
  return first ?? null;
}

function nextDuplicateL1Code(paths: ReturnType<typeof getPaths>, topic: string, start: number): string {
  let index = Math.max(2, start);
  while (findSpecByCode(paths, generateSpecCode(topic, 'L1', undefined, undefined, String(index)))) {
    index += 1;
  }
  return generateSpecCode(topic, 'L1', undefined, undefined, String(index));
}

function renderNextProjection(projection: WorkflowNextProjection): string[] {
  const lines = [
    `Project: ${projection.projectRoot}`,
    `Write Root: ${projection.writeRoot}`,
    `Request: ${projection.request || '(none)'}`,
    `Topic: ${projection.topic ?? '(none)'}`,
    `Status: ${projection.status}`,
    'Next:',
    `  ${projection.nextAction.replace(/\n/g, '\n  ')}`,
  ];
  if (projection.blockingReason) {
    lines.push('Why:', `  ${projection.blockingReason}`);
  }
  if (projection.suggestedCommands.length > 0) {
    lines.push('Suggested:');
    for (const command of projection.suggestedCommands) lines.push(`  ${command}`);
  }
  if (projection.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of projection.warnings) lines.push(`  - ${warning}`);
  }
  if (projection.storeDiagnostics.length > 0) {
    lines.push('Store Diagnostics:');
    for (const diagnostic of projection.storeDiagnostics) {
      lines.push(`  - [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
      if (diagnostic.fix) lines.push(`    fix: ${diagnostic.fix}`);
    }
  }
  return lines;
}

function renderDashboardProjection(projection: WorkflowDashboardProjection): string[] {
  const lines = [
    `Project: ${projection.projectRoot}`,
    `Write Root: ${projection.writeRoot}`,
    `Initialized: ${projection.initialized}`,
    `Topics: ${projection.topics.length}`,
    `Active tasks: ${projection.activeTaskCount}`,
    `Draft specs: ${projection.draftSpecCount}`,
  ];
  if (projection.warningCount > 0) {
    lines.push(`Warnings: ${projection.warningCount}`);
    for (const warning of projection.warnings) lines.push(`  - ${warning}`);
  }
  if (projection.storeDiagnostics.length > 0) {
    lines.push('Store Diagnostics:');
    for (const diagnostic of projection.storeDiagnostics) {
      lines.push(`  - [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
      if (diagnostic.fix) lines.push(`    fix: ${diagnostic.fix}`);
    }
  }
  if (projection.topics.length > 0) {
    lines.push('Topic summary:');
    for (const topic of projection.topics) {
      lines.push(`  ${topic.topic}: ${topic.specCount} specs, ${topic.taskCount} tasks, ${topic.activeTaskCount} active tasks, ${topic.draftSpecCount} draft specs`);
      lines.push(`    Next: ${topic.nextAction.replace(/\n/g, '\n    ')}`);
    }
  }
  return lines;
}
