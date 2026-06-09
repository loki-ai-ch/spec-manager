import type { TaskRecord } from './task.js';

const MUTABLE_TASK_STATUSES = new Set(['running']);
const ACTIVE_TASK_STATUSES = new Set(['draft', 'running', 'waiting']);

export function assertTaskMutable(task: TaskRecord, operation: string): void {
  if (!MUTABLE_TASK_STATUSES.has(task.status)) {
    throw new Error(`TASK_IMMUTABLE: cannot ${operation} task ${task.id} with status=${task.status}`);
  }
}

export function assertNoActiveTaskForSpec(tasks: TaskRecord[], specCode: string): void {
  const active = tasks.find(task => task.specCode === specCode && ACTIVE_TASK_STATUSES.has(task.status));
  if (active) {
    throw new Error(`TASK_ALREADY_ACTIVE: ${specCode} already has ${active.id} status=${active.status}`);
  }
}

export function assertTaskHasSuccessfulVerification(task: TaskRecord): void {
  if (!(task.verifications ?? []).some(verification => verification.exitCode === 0)) {
    throw new Error(`VERIFICATION_REQUIRED: task ${task.id} requires at least one successful verification`);
  }
}
