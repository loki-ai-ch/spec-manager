/**
 * Spec 状态机：
 * - L1/L2 draft → confirmed: 用户批准
 * - L3 draft → frozen: 用户一次批准后可执行
 * - confirmed → frozen: 历史 L3 兼容或上游级联准备
 * - frozen → implemented: 仅由 task complete 触发（自动级联）
 * - * → archived: supersede 时
 *
 * 严禁：confirmed → draft（回退），除非显式 supersede
 */

export type SpecStatus = 'draft' | 'confirmed' | 'frozen' | 'implemented' | 'archived';

const TRANSITIONS: Record<SpecStatus, SpecStatus[]> = {
  draft:      ['confirmed', 'frozen', 'archived'],
  confirmed:  ['frozen', 'archived'],          // L1/L2 confirmed 后也可直接 archived（被取代）
  frozen:     ['implemented', 'confirmed', 'archived'],  // frozen → confirmed 允许用户重审
  implemented:['archived'],                    // implemented → archived（被新 spec 取代）
  archived:   [],                              // 终态
};

export function canTransition(from: SpecStatus, to: SpecStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: SpecStatus): SpecStatus[] {
  return TRANSITIONS[from] ?? [];
}

export const ALL_STATUSES: SpecStatus[] = ['draft', 'confirmed', 'frozen', 'implemented', 'archived'];

export function isActiveStatus(s: SpecStatus): boolean {
  return s !== 'archived';
}

export function isCompleteStatus(s: SpecStatus): boolean {
  return s === 'implemented' || s === 'archived';
}

export type TaskStatus = 'draft' | 'running' | 'waiting' | 'completed' | 'failed';

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ['running', 'failed'],
  running: ['waiting', 'completed', 'failed'],
  waiting: ['running', 'failed', 'completed'],
  completed: [],
  failed: [],
};

export const ALL_TASK_STATUSES: TaskStatus[] = ['draft', 'running', 'waiting', 'completed', 'failed'];

export function canTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextTaskStatuses(from: TaskStatus): TaskStatus[] {
  return TASK_TRANSITIONS[from] ?? [];
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTaskTransition(from, to)) {
    throw new Error(`Task 状态非法: ${from} → ${to}`);
  }
}

export function assertSpecTransition(from: SpecStatus, to: SpecStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`状态非法: ${from} → ${to}`);
  }
}
