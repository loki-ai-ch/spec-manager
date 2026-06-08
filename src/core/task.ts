/**
 * Agent Task 生命周期
 * - task 元数据：specs/<topic>/<L1>/<L2>/<L3>/tasks/<taskId>.json
 * - task 步骤：L3 spec frontmatter steps[]（与 spec 同文件，原子写）
 *
 * 状态机：draft → running → (waiting →) running → completed | failed
 * cascade: complete 时若 L3 已全 implemented → 把父 L2 也置 implemented（递归）
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { siblingMetaDir, type ProjectPaths } from './paths.js';
import { findSpecByCode, updateSpec, writeSpec, listAllSpecs, type StepFrontmatter } from './spec-io.js';
import { writeAtomic } from './frontmatter.js';
import { PlanJsonSchema, type StepStatusT, type StepTypeT } from '../schemas/spec.js';
import { validatePlanJson } from './validate.js';
import { ID_PAD_WIDTH, TASK_FILE_EXT, TASK_ID_PREFIX } from './constants.js';
import { recordAuditHit, type AuditSink } from './audit-events.js';
import { listTopicMetaFiles } from './repository.js';
import { assertTaskTransition, type TaskStatus } from './status.js';

export type { TaskStatus } from './status.js';

export interface TaskRecord {
  id: string;
  specCode: string;
  status: TaskStatus;
  steps?: StepFrontmatter[];
  verifications?: TaskVerificationRecord[];
  autoConfirm: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  created: string;
  waitReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface TaskVerificationRecord {
  id: string;
  command: string;
  exitCode: number;
  summary: string;
  artifacts: string[];
  coversAc: string[];
  created: string;
}

export { canTaskTransition } from './status.js';

/**
 * 平铺布局下,tasks/ 在 topic 目录下:
 *   specs/<topic>/tasks/<specCode>-<taskId>.json
 * 文件名加 specCode 前缀避免跨 L3 的 T-001 冲突。
 */
function tasksDirOfSpec(specFilePath: string): string {
  return siblingMetaDir(specFilePath, 'tasks');
}

function taskFilePath(specFilePath: string, specCode: string, taskId: string): string {
  return join(tasksDirOfSpec(specFilePath), `${specCode}-${taskId}${TASK_FILE_EXT}`);
}

/**
 * 从任务文件名反解 taskId: <specCode>-T-001.json → T-001
 */
function taskIdFromFilename(filename: string, specCode: string): string | null {
  const prefix = `${specCode}-`;
  if (!filename.startsWith(prefix) || !filename.endsWith(TASK_FILE_EXT)) return null;
  return filename.slice(prefix.length, -TASK_FILE_EXT.length);
}

export function generateTaskId(specFilePath: string, specCode: string): string {
  const tasksDir = tasksDirOfSpec(specFilePath);
  if (!existsSync(tasksDir)) return `${TASK_ID_PREFIX}${'1'.padStart(ID_PAD_WIDTH, '0')}`;
  const existing = readdirSync(tasksDir)
    .map(f => taskIdFromFilename(f, specCode))
    .filter((id): id is string => id !== null)
    .map(id => {
      const m = id.match(/^T-(\d+)$/);
      return m ? Number(m[1]) : 0;
    });
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `${TASK_ID_PREFIX}${String(max + 1).padStart(ID_PAD_WIDTH, '0')}`;
}

function writeTaskJSON(filePath: string, data: TaskRecord): void {
  writeAtomic(filePath, JSON.stringify(data, null, 2));
}

/**
 * 按 taskId 查找任务。
 * 传 specCode 时按文件名精确查找（避免跨 spec 的 T-001 冲突）；
 * 不传时回退到全局扫描（向后兼容）。
 */
function findTaskById(paths: ProjectPaths, taskId: string, specCode?: string): TaskRecord {
  if (specCode) {
    const spec = findSpecByCode(paths, specCode);
    if (!spec) throw new Error(`Spec not found: ${specCode}`);
    const f = taskFilePath(spec.filePath, specCode, taskId);
    if (!existsSync(f)) throw new Error(`Task not found: ${taskId} (in ${specCode})`);
    return JSON.parse(readFileSync(f, 'utf8')) as TaskRecord;
  }
  const found = listTasks(paths).find(t => t.id === taskId);
  if (!found) throw new Error(`Task not found: ${taskId}`);
  return found;
}

export interface CreateTaskInput {
  paths: ProjectPaths;
  specCode: string;
  planJson: { coveredSpecs?: string[]; steps: Array<{ stepNo: number | string; stepType: StepTypeT; name: string }> };
  autoConfirm: boolean;
  auditSink?: AuditSink;
}

export function createTask(input: CreateTaskInput): { task: TaskRecord; taskFile: string } {
  const spec = findSpecByCode(input.paths, input.specCode);
  if (!spec) throw new Error(`Spec not found: ${input.specCode}`);
  if (spec.fm.level !== 'L3') throw new Error(`Agent Task 只能由 L3 spec 创建，${input.specCode} 是 ${spec.fm.level}`);
  if (spec.fm.status !== 'frozen') {
    recordAuditHit({ paths: input.paths, ruleId: 'R3', specCode: input.specCode }, input.auditSink);
    throw new Error(`R3: L3 必须 frozen 才能建 Task，当前 status=${spec.fm.status}`);
  }

  const parsedPlan = PlanJsonSchema.safeParse(input.planJson);
  if (!parsedPlan.success) {
    const message = parsedPlan.error.issues.map(i => i.message).join('; ');
    if (message.includes('R11')) {
      recordAuditHit({ paths: input.paths, ruleId: 'R11', specCode: input.specCode }, input.auditSink);
    }
    throw new Error(message);
  }
  const planWarnings = validatePlanJson(input.planJson);
  const r10 = planWarnings.find(w => w.rule === 'R10');
  if (r10) {
    recordAuditHit({ paths: input.paths, ruleId: 'R10', specCode: input.specCode }, input.auditSink);
    throw new Error(r10.message);
  }
  if (!input.planJson.coveredSpecs?.includes(input.specCode)) {
    recordAuditHit({ paths: input.paths, ruleId: 'R12', specCode: input.specCode }, input.auditSink);
    throw new Error(
      `R12: planJson.coveredSpecs 必须包含当前 L3 specCode (${input.specCode})，禁止凭记忆写 planJson\n` +
      `Example:\n` +
      `{\n` +
      `  "coveredSpecs": ["${input.specCode}"],\n` +
      `  "steps": [\n` +
      `    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 ${input.specCode} 并检查 templates/agent-plan.json"},\n` +
      `    {"stepNo": "N", "stepType": "mcp_tool", "name": "验证 npm test"}\n` +
      `  ]\n` +
      `}`,
    );
  }

  const taskId = generateTaskId(spec.filePath, input.specCode);
  const task: TaskRecord = {
    id: taskId,
    specCode: input.specCode,
    status: 'draft',
    steps: input.planJson.steps.map((ps) => ({
      stepNo: ps.stepNo,
      stepType: ps.stepType,
      name: ps.name,
      status: 'pending',
    })),
    autoConfirm: input.autoConfirm,
    startedAt: null,
    finishedAt: null,
    created: new Date().toISOString(),
    waitReason: null,
    errorCode: null,
    errorMessage: null,
  };
  const taskFile = taskFilePath(spec.filePath, input.specCode, taskId);
  writeTaskJSON(taskFile, task);

  // 兼容旧 workflow: spec frontmatter 保留计划快照;运行态 step report 写入 task.steps。
  spec.fm.steps = task.steps;
  spec.fm.updated = new Date().toISOString();
  writeSpec(spec);

  return { task, taskFile };
}

export function findTask(paths: ProjectPaths, specCode: string, taskId: string): TaskRecord | null {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) return null;
  const f = taskFilePath(spec.filePath, specCode, taskId);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8')) as TaskRecord;
}

export function listTasks(paths: ProjectPaths, opts?: { specCode?: string; status?: TaskStatus; topic?: string }): TaskRecord[] {
  const out: TaskRecord[] = [];
  const specPrefix = opts?.specCode ? `${opts.specCode}-` : null;
  const topicSpecCodes = opts?.topic
    ? new Set(listAllSpecs(paths).filter(s => s.fm.topic === opts.topic).map(s => s.fm.code))
    : null;
  const taskFiles = listTopicMetaFiles(paths, 'tasks', {
    topic: opts?.topic,
    extension: TASK_FILE_EXT,
    filePrefix: specPrefix ?? undefined,
  });
  for (const file of taskFiles) {
    const t = JSON.parse(readFileSync(file.filePath, 'utf8')) as TaskRecord;
    if (topicSpecCodes && !topicSpecCodes.has(t.specCode)) continue;
    if (opts?.status && t.status !== opts.status) continue;
    out.push(t);
  }
  return out.sort((a, b) => a.created.localeCompare(b.created));
}

function specFilePathOf(paths: ProjectPaths, specCode: string): string {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`Spec not found: ${specCode}`);
  return spec.filePath;
}

export function startTask(paths: ProjectPaths, taskId: string, specCode?: string): TaskRecord {
  const t = findTaskById(paths, taskId, specCode);
  assertTaskTransition(t.status, 'running');
  const updated: TaskRecord = { ...t, status: 'running', startedAt: t.startedAt ?? new Date().toISOString() };
  writeTaskJSON(taskFilePath(specFilePathOf(paths, t.specCode), t.specCode, taskId), updated);
  return updated;
}

export interface StepInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  stepNo: number | string;
  status: StepStatusT;
  toolName?: string;
  inputJson?: string;
  outputJson?: string;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
}

export function reportStep(input: StepInput): { task: TaskRecord; spec: ReturnType<typeof findSpecByCode>; warnings: string[] } {
  const task = findTaskById(input.paths, input.taskId, input.specCode);

  // R15: outputJson 必含 summary（warning 而非 throw）
  const warnings: string[] = [];
  if (input.status === 'succeeded') {
    if (!input.outputJson) {
      warnings.push('R15: succeeded step 必须提供 outputJson.summary');
    } else {
      try {
        const parsed = JSON.parse(input.outputJson);
        if (typeof parsed.summary !== 'string' || parsed.summary.length === 0) {
          warnings.push('R15: outputJson 缺 summary 字段');
        }
      } catch {
        warnings.push('outputJson 不是合法 JSON');
      }
    }
  }

  const spec = findSpecByCode(input.paths, task.specCode);
  if (!spec) throw new Error(`Spec not found: ${task.specCode}`);
  const steps = [...taskSteps(task, spec.fm.steps)];
  const idx = steps.findIndex(s => String(s.stepNo) === String(input.stepNo));
  const step: StepFrontmatter = {
    stepNo: input.stepNo,
    stepType: (steps[idx]?.stepType ?? 'mcp_tool') as StepTypeT,
    name: steps[idx]?.name ?? '(unnamed)',
    status: input.status,
    toolName: input.toolName,
    inputJson: input.inputJson,
    outputJson: input.outputJson,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    latencyMs: input.latencyMs,
    reportedAt: new Date().toISOString(),
  };
  if (idx >= 0) steps[idx] = step;
  else steps.push(step);
  const updatedTask: TaskRecord = { ...task, steps };
  writeTaskJSON(taskFilePath(spec.filePath, task.specCode, task.id), updatedTask);

  return { task: updatedTask, spec, warnings };
}

export interface AddTaskVerificationInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  command: string;
  exitCode: number;
  summary: string;
  artifacts?: string[];
  coversAc?: string[];
}

export function addTaskVerification(input: AddTaskVerificationInput): { task: TaskRecord; verification: TaskVerificationRecord } {
  const task = findTaskById(input.paths, input.taskId, input.specCode);
  const existing = task.verifications ?? [];
  const verification: TaskVerificationRecord = {
    id: nextVerificationId(existing),
    command: input.command,
    exitCode: input.exitCode,
    summary: input.summary,
    artifacts: input.artifacts ?? [],
    coversAc: input.coversAc ?? [],
    created: new Date().toISOString(),
  };
  const updated: TaskRecord = {
    ...task,
    verifications: [...existing, verification],
  };
  writeTaskJSON(taskFilePath(specFilePathOf(input.paths, task.specCode), task.specCode, task.id), updated);
  return { task: updated, verification };
}

export interface CompleteInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  auditSink?: AuditSink;
}

export interface CompleteResult {
  task: TaskRecord;
  cascadedSpecs: Array<{ code: string; oldStatus: string; newStatus: string; level: 'L0' | 'L1' | 'L2' | 'L3' }>;
  cascadedL1Specs: string[];
  skippedSpecs: Array<{ code: string; status: string; reason: string }>;
}

export function completeTask(input: CompleteInput): CompleteResult {
  const task = findTaskById(input.paths, input.taskId, input.specCode);
  assertTaskTransition(task.status, 'completed');

  // R5: 校验所有 plan 步骤都已上报(不能跳步)
  const l3 = findSpecByCode(input.paths, task.specCode);
  if (l3) {
    if (l3.fm.status !== 'frozen') {
      recordAuditHit({ paths: input.paths, ruleId: 'R6', specCode: task.specCode, taskCode: task.id }, input.auditSink);
      throw new Error(`R6: task complete 前 L3 必须仍是 frozen，当前 status=${l3.fm.status}`);
    }
    const unfinished = taskSteps(task, l3.fm.steps).filter(s => s.status !== 'succeeded');
    if (unfinished.length > 0) {
      recordAuditHit({ paths: input.paths, ruleId: 'R5', specCode: task.specCode }, input.auditSink);
      throw new Error(
        `R5: 仍有 ${unfinished.length} 个步骤未成功（pending/running/failed/skipped）:` +
        unfinished.map(s => `#${s.stepNo}`).join(', ') +
        ` — 请先逐个 reportStep 到 succeeded，失败或跳过步骤需修复后重新上报，禁止跳号`,
      );
    }
  }

  // 把 task 标记为 completed
  const updated: TaskRecord = { ...task, status: 'completed', finishedAt: new Date().toISOString() };
  writeTaskJSON(taskFilePath(specFilePathOf(input.paths, task.specCode), task.specCode, task.id), updated);

  // L3 spec → implemented (cascade)
  const cascaded: CompleteResult['cascadedSpecs'] = [];
  const skipped: CompleteResult['skippedSpecs'] = [];

  cascadeImplemented(input.paths, task.specCode, cascaded, skipped, input.auditSink);
  const implemented = findSpecByCode(input.paths, task.specCode);
  if (implemented?.fm.status !== 'implemented') {
    recordAuditHit({ paths: input.paths, ruleId: 'R6', specCode: task.specCode, taskCode: task.id }, input.auditSink);
    throw new Error(`R6: task complete 后 ${task.specCode} 必须是 implemented，当前 status=${implemented?.fm.status ?? 'missing'}`);
  }

  const cascadedL1Specs = cascaded
    .filter(c => c.level === 'L1' || c.level === 'L0')
    .map(c => c.code);

  return { task: updated, cascadedSpecs: cascaded, cascadedL1Specs, skippedSpecs: skipped };
}

function cascadeImplemented(
  paths: ProjectPaths,
  specCode: string,
  cascaded: CompleteResult['cascadedSpecs'],
  skipped: CompleteResult['skippedSpecs'],
  auditSink?: AuditSink,
): void {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) return;
  const oldStatus = spec.fm.status;
  if (oldStatus !== 'frozen') {
    skipped.push({ code: specCode, status: oldStatus, reason: `expected frozen, got ${oldStatus}` });
    return;
  }
  updateSpec(paths, specCode, { status: 'implemented', changeSummary: `cascade: task complete` }, { auditSink });
  cascaded.push({ code: specCode, oldStatus, newStatus: 'implemented', level: spec.fm.level });

  // 父级
  if (spec.fm.parentCode) {
    const allChildren = listAllSpecsByParent(paths, spec.fm.parentCode);
    const allImpl = allChildren.length > 0 && allChildren.every(s => s.fm.status === 'implemented');
    if (allChildren.length === 0) {
      skipped.push({ code: spec.fm.parentCode, status: '?', reason: 'no children' });
    } else if (allImpl) {
      cascadeImplemented(paths, spec.fm.parentCode, cascaded, skipped, auditSink);
    } else {
      skipped.push({
        code: spec.fm.parentCode,
        status: '?',
        reason: `${allChildren.filter(s => s.fm.status !== 'implemented').length}/${allChildren.length} children not implemented yet`,
      });
    }
  }
}

function listAllSpecsByParent(paths: ProjectPaths, parentCode: string) {
  return listAllSpecs(paths).filter(s => s.fm.parentCode === parentCode);
}

export interface FailInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  errorCode?: string;
  errorMessage?: string;
}

export function failTask(input: FailInput): TaskRecord {
  const task = findTaskById(input.paths, input.taskId, input.specCode);
  assertTaskTransition(task.status, 'failed');
  const updated: TaskRecord = {
    ...task,
    status: 'failed',
    errorCode: input.errorCode ?? 'AGENT_TOOL',
    errorMessage: input.errorMessage ?? '未知错误',
    finishedAt: new Date().toISOString(),
  };
  writeTaskJSON(taskFilePath(specFilePathOf(input.paths, task.specCode), task.specCode, task.id), updated);
  return updated;
}

export interface WaitInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  reason?: string;
}

export function waitTask(input: WaitInput): TaskRecord {
  const task = findTaskById(input.paths, input.taskId, input.specCode);
  assertTaskTransition(task.status, 'waiting');
  const updated: TaskRecord = {
    ...task,
    status: 'waiting',
    waitReason: input.reason ?? '需要人工确认',
  };
  writeTaskJSON(taskFilePath(specFilePathOf(input.paths, task.specCode), task.specCode, task.id), updated);
  return updated;
}

export function showTask(paths: ProjectPaths, taskId: string, opts?: { full?: boolean; specCode?: string }): {
  task: TaskRecord;
  steps: StepFrontmatter[];
  shownSteps: number;
  totalSteps: number;
  truncated: boolean;
} | null {
  let task: TaskRecord | undefined;
  if (opts?.specCode) {
    try {
      task = findTaskById(paths, taskId, opts.specCode);
    } catch {
      return null;
    }
  } else {
    task = listTasks(paths).find(t => t.id === taskId);
  }
  if (!task) return null;
  const spec = findSpecByCode(paths, task.specCode);
  const steps = taskSteps(task, spec?.fm.steps);
  const all = [...steps].sort((a, b) => Number(a.stepNo) - Number(b.stepNo));
  if (opts?.full || all.length <= 5) {
    return { task, steps: all, shownSteps: all.length, totalSteps: all.length, truncated: false };
  }
  const shown = all.slice(-5);
  return { task, steps: shown, shownSteps: shown.length, totalSteps: all.length, truncated: true };
}

function taskSteps(task: TaskRecord, fallback?: StepFrontmatter[]): StepFrontmatter[] {
  return task.steps ?? fallback ?? [];
}

function nextVerificationId(existing: TaskVerificationRecord[]): string {
  const max = existing
    .map(v => {
      const m = v.id.match(/^V-(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .reduce((acc, n) => Math.max(acc, n), 0);
  return `V-${String(max + 1).padStart(ID_PAD_WIDTH, '0')}`;
}
