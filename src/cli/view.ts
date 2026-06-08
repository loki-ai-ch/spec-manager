import { select } from '@inquirer/prompts';
import { Command } from 'commander';
import { buildViewModel, type ViewTaskSummary, type ViewTopicSummary } from '../core/view.js';
import { getPaths } from '../core/paths.js';
import { findSpecByCode } from '../core/spec-io.js';
import { showTask } from '../core/task.js';
import { suggestAfterSpecCommand } from '../core/usability.js';

type ViewMode = 'summary' | 'specs' | 'tasks';

export function registerViewCommands(program: Command): void {
  program
    .command('view')
    .description('交互式浏览 topic/spec/task 状态与下一步建议')
    .option('--topic <topic>', '限定 topic')
    .action(async (opts) => {
      const paths = getPaths();
      const model = buildViewModel(paths, { topic: opts.topic });
      try {
        const topicName = opts.topic ?? await chooseTopic(model.topics);
        const topic = model.topics.find((t) => t.topic === topicName);
        if (!topic) throw new Error('TOPIC_NOT_FOUND');

        const mode = await chooseMode(topic);
        if (mode === 'summary') {
          printTopicSummary(topic);
        } else if (mode === 'specs') {
          await showSpec(paths, topic);
        } else {
          await showTaskDetail(paths, topic);
        }
      } catch (err) {
        printFallback(opts.topic, err);
      }
    });
}

async function chooseTopic(topics: ViewTopicSummary[]): Promise<string> {
  return select({
    message: 'Select topic',
    choices: topics.map((topic) => ({
      name: `${topic.topic} (${topic.specCount} specs, ${topic.taskCount} tasks)`,
      value: topic.topic,
    })),
  });
}

async function chooseMode(topic: ViewTopicSummary): Promise<ViewMode> {
  const choices: Array<{ name: string; value: ViewMode; disabled?: string }> = [
    { name: 'Topic summary', value: 'summary' },
    { name: 'Specs', value: 'specs', disabled: topic.specs.length === 0 ? 'No specs' : undefined },
    { name: 'Tasks', value: 'tasks', disabled: topic.tasks.length === 0 ? 'No tasks' : undefined },
  ];
  return select({ message: `View ${topic.topic}`, choices });
}

async function showSpec(paths: ReturnType<typeof getPaths>, topic: ViewTopicSummary): Promise<void> {
  const code = await select({
    message: 'Select spec',
    choices: topic.specs.map((spec) => ({
      name: `${spec.code} [${spec.status}] ${spec.title}`,
      value: spec.code,
    })),
  });
  const spec = findSpecByCode(paths, code);
  if (!spec) throw new Error(`Spec not found: ${code}`);

  console.log(`Spec: ${spec.fm.code}`);
  console.log(`  title: ${spec.fm.title}`);
  console.log(`  level: ${spec.fm.level}`);
  console.log(`  status: ${spec.fm.status}`);
  console.log(`  parent: ${spec.fm.parentCode ?? '(none)'}`);
  console.log(`  aiSummary: ${spec.fm.aiSummary || '(empty)'}`);
  console.log('Next:');
  console.log(`  ${suggestAfterSpecCommand(spec, paths).replace(/\n/g, '\n  ')}`);
}

async function showTaskDetail(paths: ReturnType<typeof getPaths>, topic: ViewTopicSummary): Promise<void> {
  const selected = await select({
    message: 'Select task',
    choices: topic.tasks.map((task) => ({
      name: `${task.id} ${task.specCode} [${task.status}]`,
      value: `${task.specCode}\t${task.id}`,
    })),
  });
  const [specCode, taskId] = selected.split('\t') as [string, string];
  const shown = showTask(paths, taskId, { specCode });
  const task = topic.tasks.find((candidate) => candidate.id === taskId && candidate.specCode === specCode);
  if (!shown || !task) throw new Error(`Task not found: ${taskId}`);

  printTaskSummary(task);
  console.log('  recentSteps:');
  for (const step of shown.steps) {
    console.log(`    [${step.stepNo}] ${step.status} ${step.name}`);
  }
  console.log(`  shownSteps: ${shown.shownSteps}`);
  console.log(`  totalSteps: ${shown.totalSteps}`);
  console.log(`  truncated: ${shown.truncated}`);
}

function printTopicSummary(topic: ViewTopicSummary): void {
  console.log(`Topic: ${topic.topic}`);
  console.log(`  specs: ${topic.specCount}`);
  console.log(`  tasks: ${topic.taskCount}`);
  console.log('Next:');
  console.log(`  ${topic.nextAction.replace(/\n/g, '\n  ')}`);
}

function printTaskSummary(task: ViewTaskSummary): void {
  console.log(`Task: ${task.id}`);
  console.log(`  specCode: ${task.specCode}`);
  console.log(`  status: ${task.status}`);
  console.log(`  startedAt: ${task.startedAt ?? '(not started)'}`);
  console.log(`  finishedAt: ${task.finishedAt ?? '(not finished)'}`);
  console.log(`  succeededSteps: ${task.succeededSteps}`);
  console.log(`  totalSteps: ${task.totalSteps}`);
}

function printFallback(topic: string | undefined, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`View unavailable: ${message}`);
  console.log('Fallback:');
  if (topic) {
    console.log(`  spec-manager flow status --topic ${topic}`);
  } else {
    console.log('  spec-manager project status');
  }
}
