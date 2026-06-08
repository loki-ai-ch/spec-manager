import { Command } from 'commander';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { getPaths } from '../core/paths.js';
import { createSpec, findSpecByCode, generateSpecCode, isPlaceholderContent, updateSpec } from '../core/spec-io.js';
import { canTransition, type SpecStatus } from '../core/status.js';
import { createTask, startTask } from '../core/task.js';
import { getFlowStatus, isBlockingDoctorCheck, renderRichGuide, renderTemplate, runProjectDoctor, suggestAfterSpecCommand } from '../core/usability.js';
import type { SpecLevel } from '../core/validate.js';
import { fail, requireInitialized } from './common.js';

export function registerUsabilityCommands(program: Command): void {
  program
    .command('flow')
    .description('流程视图：按 topic 展示 L1/L2/L3/Task 当前状态与下一步')
    .command('status')
    .option('--topic <topic>', '只查看指定 topic')
    .action((opts: { topic?: string }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const flows = getFlowStatus(paths, { topic: opts.topic });
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
      const topic = inferTopic(request) ?? '<topic>';
      const flow = getFlowStatus(paths, { topic })[0];
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
      const paths = getPaths();
      requireInitialized(paths);
      const title = titleParts.join(' ');
      const code = generateSpecCode(opts.topic, 'L1');
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
      const paths = getPaths();
      requireInitialized(paths);
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
      const paths = getPaths();
      requireInitialized(paths);
      const planJson = JSON.parse(readFileSync(opts.plan, 'utf8'));
      const { task } = createTask({ paths, specCode, planJson, autoConfirm: opts.autoConfirm });
      const started = startTask(paths, task.id, specCode);
      console.log(`✓ Task ${started.id} created and started for ${specCode}`);
      console.log(`Next: spec-manager task step ${started.id} --spec ${specCode} --no <N> --status succeeded --output-json '{"summary":"..."}'`);
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
