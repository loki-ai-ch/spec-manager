import type { TaskRecord, VerificationLayer } from './task.js';

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

export function assertTaskHasSuccessfulVerification(task: TaskRecord, opts?: { layer?: VerificationLayer }): void {
  const verifications = task.verifications ?? [];
  const filtered = opts?.layer
    ? verifications.filter(v => (v.layer ?? 'functional') === opts.layer)
    : verifications;
  if (!filtered.some(v => v.exitCode === 0)) {
    const layerHint = opts?.layer ? ` (layer: ${opts.layer})` : '';
    throw new Error(`VERIFICATION_REQUIRED: task ${task.id} requires at least one successful verification${layerHint}`);
  }
}
