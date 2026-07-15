import {
  createTask,
  startTask,
  type TaskRecord,
} from '../core/task.js';
import { findSpecByCode, type SpecRecord } from '../core/spec-io.js';
import type { CliActionContext } from './common.js';
import { runSpecTransitionCommand, type SpecTransitionCommandResult } from './spec-handlers.js';

export interface TaskRunInput {
  context: CliActionContext;
  specCode: string;
  planJson: {
    coveredSpecs?: string[];
    steps: Array<{ stepNo: number | string; stepType: 'llm_call' | 'tool_action' | 'human_gate'; name: string }>;
  };
  autoConfirm: boolean;
  profile?: string;
  profileReason?: string;
}

export interface TaskRunSpecResult {
  code: string;
  oldStatus: SpecRecord['fm']['status'];
  newStatus: SpecRecord['fm']['status'];
  transitioned: boolean;
}

export interface TaskRunResult {
  spec: TaskRunSpecResult;
  task: TaskRecord;
  taskFile: string;
  nextCommand: string;
}

export function runTaskRunCommand(input: TaskRunInput): TaskRunResult {
  const before = findSpecByCode(input.context.paths, input.specCode);
  if (!before) throw new Error(`Spec not found: ${input.specCode}`);
  if (before.fm.level !== 'L3') throw new Error(`TASK_RUN_SPEC_NOT_L3: ${input.specCode} is ${before.fm.level}`);
  if (!['draft', 'confirmed', 'frozen'].includes(before.fm.status)) {
    throw new Error(`TASK_RUN_SPEC_STATUS_INVALID: ${input.specCode} status=${before.fm.status} (must be draft|confirmed|frozen)`);
  }

  const transition = transitionSpecIfNeeded(input.context, before);
  const created = createTask({
    paths: input.context.paths,
    specCode: input.specCode,
    planJson: input.planJson,
    autoConfirm: input.autoConfirm,
    profile: input.profile,
    profileOverrideReason: input.profileReason,
  });
  const started = startTask(input.context.paths, created.task.id, input.specCode);

  return {
    spec: transition,
    task: started,
    taskFile: created.taskFile,
    nextCommand: nextTaskStepCommand(started.id, input.specCode),
  };
}

function transitionSpecIfNeeded(context: CliActionContext, spec: SpecRecord): TaskRunSpecResult {
  if (spec.fm.status === 'frozen') {
    return {
      code: spec.fm.code,
      oldStatus: spec.fm.status,
      newStatus: spec.fm.status,
      transitioned: false,
    };
  }
  const command = spec.fm.status === 'draft' ? 'confirm' : 'freeze';
  const result: SpecTransitionCommandResult = runSpecTransitionCommand({
    context,
    code: spec.fm.code,
    command,
    force: false,
  });
  return {
    code: spec.fm.code,
    oldStatus: result.oldStatus,
    newStatus: result.newStatus,
    transitioned: true,
  };
}

function nextTaskStepCommand(taskId: string, specCode: string): string {
  return `spec-manager task step ${taskId} --spec ${specCode} --no 1 --status succeeded --output-json '{"summary":"..."}'`;
}

export function printTaskRunResult(context: CliActionContext, result: TaskRunResult, opts?: { json?: boolean }): void {
  if (opts?.json) {
    context.log(JSON.stringify({
      spec: result.spec,
      task: {
        id: result.task.id,
        status: result.task.status,
        file: result.taskFile,
        startedAt: result.task.startedAt,
        profile: result.task.profile,
        profileSource: result.task.profileSource,
      },
      nextCommand: result.nextCommand,
    }, null, 2));
    return;
  }
  if (result.spec.transitioned) {
    context.log(`✓ L3 ${result.spec.code}: ${result.spec.oldStatus} → ${result.spec.newStatus}`);
  } else {
    context.log(`✓ L3 ${result.spec.code}: already ${result.spec.newStatus}`);
  }
  context.log(`✓ Task ${result.task.id} created and started for ${result.task.specCode}`);
  context.log(`  file: ${result.taskFile}`);
  context.log(`  status: ${result.task.status}`);
  context.log(`  startedAt: ${result.task.startedAt}`);
  context.log(`  profile: ${result.task.profile ?? 'legacy'} (${result.task.profileSource ?? 'legacy'})`);
  context.log('');
  context.log('Next:');
  context.log(`  ${result.nextCommand}`);
}
