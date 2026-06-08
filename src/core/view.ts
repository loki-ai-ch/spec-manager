import type { ProjectPaths } from './paths.js';
import { listAllSpecs } from './spec-io.js';
import { listTasks, type TaskRecord } from './task.js';
import { getFlowStatus } from './usability.js';
import type { SpecLevelT, SpecStatusT } from '../schemas/spec.js';
import type { TaskStatus } from './status.js';

export interface ViewSpecSummary {
  code: string;
  level: SpecLevelT;
  status: SpecStatusT;
  title: string;
  parentCode: string | null;
  aiSummary: string;
}

export interface ViewTaskSummary {
  id: string;
  specCode: string;
  status: TaskStatus;
  startedAt: string | null;
  finishedAt: string | null;
  totalSteps: number;
  succeededSteps: number;
}

export interface ViewTopicSummary {
  topic: string;
  specCount: number;
  taskCount: number;
  nextAction: string;
  specs: ViewSpecSummary[];
  tasks: ViewTaskSummary[];
}

export interface ViewModel {
  topics: ViewTopicSummary[];
}

export function buildViewModel(paths: ProjectPaths, opts?: { topic?: string }): ViewModel {
  const specs = listAllSpecs(paths).filter((spec) => !opts?.topic || spec.fm.topic === opts.topic);
  const tasks = listTasks(paths, { topic: opts?.topic });
  if (opts?.topic && specs.length === 0 && tasks.length === 0) {
    throw new Error(`TOPIC_NOT_FOUND: ${opts.topic}`);
  }

  const flows = getFlowStatus(paths, { topic: opts?.topic });
  const topics = flows
    .filter((flow) => !opts?.topic || flow.topic === opts.topic)
    .map((flow) => {
      const topicSpecs = specs
        .filter((spec) => spec.fm.topic === flow.topic)
        .sort((a, b) => a.fm.code.localeCompare(b.fm.code));
      const topicTasks = tasks
        .filter((task) => topicSpecs.some((spec) => spec.fm.code === task.specCode))
        .sort((a, b) => a.created.localeCompare(b.created));

      return {
        topic: flow.topic,
        specCount: topicSpecs.length,
        taskCount: topicTasks.length,
        nextAction: flow.nextAction,
        specs: topicSpecs.map((spec) => ({
          code: spec.fm.code,
          level: spec.fm.level,
          status: spec.fm.status,
          title: spec.fm.title,
          parentCode: spec.fm.parentCode,
          aiSummary: spec.fm.aiSummary ?? '',
        })),
        tasks: topicTasks.map(summarizeTask),
      };
    });

  return { topics };
}

function summarizeTask(task: TaskRecord): ViewTaskSummary {
  const steps = task.steps ?? [];
  return {
    id: task.id,
    specCode: task.specCode,
    status: task.status,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    totalSteps: steps.length,
    succeededSteps: steps.filter((step) => step.status === 'succeeded').length,
  };
}
