import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isActiveDecision, listDecisions } from './decision.js';
import { recordAuditHit, type AuditEvent, type AuditSink } from './audit-events.js';
import { assertTaskHasSuccessfulVerification } from './invariants.js';
import { cascadeImplementedHierarchy } from './lifecycle.js';
import { findSpecByCode, listAllSpecs, type StepFrontmatter } from './spec-io.js';
import { extractVerificationCommands } from './spec-sections.js';
import { assertTaskTransition } from './status.js';
import { TASK_FILE_EXT } from './constants.js';
import type { ProjectPaths } from './paths.js';
import { listTopicMetaFiles } from './repository.js';
import { withProjectTransaction } from './transaction.js';
import { executeVerifyRules, parseVerifyRules, runCommand } from './verify.js';
import { siblingMetaDir } from './paths.js';
import { writeAtomic } from './frontmatter.js';
import type { TaskRecord } from './task.js';

export type CompletionGateName =
  | 'bypass'
  | 'task-status'
  | 'steps'
  | 'verification-evidence'
  | 'verification-commands'
  | 'verify-rules'
  | 'lifecycle-cascade'
  | 'decision-r18';

export interface CompletionGateResult {
  gate: CompletionGateName;
  status: 'passed' | 'skipped';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface TaskCompletionInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  auditSink?: AuditSink;
  skipR18Check?: boolean;
  skipVerification?: boolean;
  skipVerify?: boolean;
  bypassReason?: string;
}

export interface TaskCompletionResult {
  task: TaskRecord;
  cascadedSpecs: Array<{ code: string; oldStatus: string; newStatus: string; level: 'L0' | 'L1' | 'L2' | 'L3' }>;
  cascadedL1Specs: string[];
  skippedSpecs: Array<{ code: string; status: string; reason: string }>;
  gateResults: CompletionGateResult[];
}

export function runTaskCompletion(input: TaskCompletionInput): TaskCompletionResult {
  try {
    return withProjectTransaction(input.paths, `complete task ${input.taskId}`, tx => {
      for (const spec of listAllSpecs(input.paths)) tx.snapshot(spec.filePath);
      for (const file of listTopicMetaFiles(input.paths, 'tasks', { extension: TASK_FILE_EXT })) tx.snapshot(file.filePath);
      return runTaskCompletionUnlocked(input);
    });
  } catch (err) {
    if (err instanceof CompletionGateError) {
      recordAuditHit(err.auditEvent, input.auditSink);
    }
    throw err;
  }
}

function runTaskCompletionUnlocked(input: TaskCompletionInput): TaskCompletionResult {
  const task = findTaskById(input.paths, input.taskId, input.specCode);
  const gateResults: CompletionGateResult[] = [];
  gateResults.push(...validateCompletionBypass(input));
  gateResults.push(runTaskStatusGate(task));

  const l3 = findSpecByCode(input.paths, task.specCode);
  if (l3) {
    gateResults.push(runL3StatusGate(input, task, l3.fm.status));
    gateResults.push(runStepCompletionGate(input, task, l3.fm.steps));
    gateResults.push(runVerificationEvidenceGate(task));
    gateResults.push(runVerificationCommandGate(input, l3.content));
    gateResults.push(runVerifyRuleGate(input, l3.content));
  } else {
    gateResults.push(runVerificationEvidenceGate(task));
  }

  const updated: TaskRecord = { ...task, status: 'completed', finishedAt: new Date().toISOString() };
  writeTaskJSON(taskFilePathOf(input.paths, task.specCode, task.id), updated);

  const cascade = cascadeImplementedHierarchy({
    paths: input.paths,
    startSpecCode: task.specCode,
    authority: 'task-complete',
    auditSink: input.auditSink,
  });
  const implemented = findSpecByCode(input.paths, task.specCode);
  if (implemented?.fm.status !== 'implemented') {
    throwCompletionGateError(
      { paths: input.paths, ruleId: 'R6', specCode: task.specCode, taskCode: task.id },
      `R6: task complete 后 ${task.specCode} 必须是 implemented，当前 status=${implemented?.fm.status ?? 'missing'}`,
    );
  }
  gateResults.push({
    gate: 'lifecycle-cascade',
    status: 'passed',
    message: `cascaded ${cascade.cascadedSpecs.length} spec(s)`,
    metadata: { skippedSpecs: cascade.skippedSpecs.length },
  });

  const cascadedL1Specs = cascade.cascadedSpecs
    .filter(c => c.level === 'L1' || c.level === 'L0')
    .map(c => c.code);
  gateResults.push(runDecisionGate(input, cascadedL1Specs));
  recordBypassAudit(input, task);

  return {
    task: updated,
    cascadedSpecs: cascade.cascadedSpecs,
    cascadedL1Specs,
    skippedSpecs: cascade.skippedSpecs,
    gateResults,
  };
}

export function validateCompletionBypass(input: TaskCompletionInput): CompletionGateResult[] {
  const bypassedChecks = bypassedCompletionChecks(input);
  if (bypassedChecks.length > 0 && !input.bypassReason?.trim()) {
    throw new Error('BYPASS_REASON_REQUIRED: 跳过完成门禁时必须提供非空原因');
  }
  if (bypassedChecks.length === 0) {
    return [{ gate: 'bypass', status: 'passed', message: 'no completion gate bypassed' }];
  }
  return [{
    gate: 'bypass',
    status: 'passed',
    message: `bypassed: ${bypassedChecks.join(', ')}`,
    metadata: { bypassedChecks, reason: input.bypassReason!.trim() },
  }];
}

export function runTaskStatusGate(task: TaskRecord): CompletionGateResult {
  assertTaskTransition(task.status, 'completed');
  return { gate: 'task-status', status: 'passed', message: `${task.status} -> completed allowed` };
}

function runL3StatusGate(input: TaskCompletionInput, task: TaskRecord, status: string): CompletionGateResult {
  if (status !== 'frozen') {
    throwCompletionGateError(
      { paths: input.paths, ruleId: 'R6', specCode: task.specCode, taskCode: task.id },
      `R6: task complete 前 L3 必须仍是 frozen，当前 status=${status}`,
    );
  }
  return { gate: 'task-status', status: 'passed', message: `L3 ${task.specCode} is frozen` };
}

export function runStepCompletionGate(
  input: TaskCompletionInput,
  task: TaskRecord,
  fallback?: StepFrontmatter[],
): CompletionGateResult {
  const unfinished = taskSteps(task, fallback).filter(s => s.status !== 'succeeded');
  if (unfinished.length > 0) {
    throwCompletionGateError(
      { paths: input.paths, ruleId: 'R5', specCode: task.specCode },
      `R5: 仍有 ${unfinished.length} 个步骤未成功（pending/running/failed/skipped）:` +
      unfinished.map(s => `#${s.stepNo}`).join(', ') +
      ` — 请先逐个 reportStep 到 succeeded，失败或跳过步骤需修复后重新上报，禁止跳号`,
    );
  }
  return { gate: 'steps', status: 'passed', message: 'all planned steps succeeded' };
}

export function runVerificationEvidenceGate(task: TaskRecord): CompletionGateResult {
  assertTaskHasSuccessfulVerification(task);
  return { gate: 'verification-evidence', status: 'passed', message: 'task has successful verification evidence' };
}

export function runVerificationCommandGate(input: TaskCompletionInput, specContent: string): CompletionGateResult {
  if (input.skipVerification) {
    return { gate: 'verification-commands', status: 'skipped', message: 'verification commands skipped' };
  }
  const verifyCmds = extractVerificationCommands(specContent);
  const cmdResults: Array<{ cmd: string; exitCode: number; output: string }> = [];
  let anyCmdFailed = false;
  for (const cmd of verifyCmds) {
    const result = runCommand(cmd, input.paths.root);
    cmdResults.push({ cmd, exitCode: result.exitCode, output: result.output });
    if (result.exitCode !== 0) anyCmdFailed = true;
  }
  if (anyCmdFailed) {
    const errorLines: string[] = [];
    const passed = cmdResults.filter(r => r.exitCode === 0).length;
    errorLines.push(`验证命令失败 (${passed}/${cmdResults.length}):`);
    for (const r of cmdResults) {
      const icon = r.exitCode === 0 ? '✓' : '✗';
      errorLines.push(`  ${icon} ${r.cmd}${r.exitCode !== 0 ? ` (exit ${r.exitCode}): ${r.output}` : ''}`);
    }
    throw new Error(errorLines.join('\n'));
  }
  return {
    gate: 'verification-commands',
    status: 'passed',
    message: `${cmdResults.length} verification command(s) passed`,
  };
}

export function runVerifyRuleGate(input: TaskCompletionInput, specContent: string): CompletionGateResult {
  if (input.skipVerify) {
    return { gate: 'verify-rules', status: 'skipped', message: '@verify rules skipped' };
  }
  const verifyRules = parseVerifyRules(specContent, '验收标准');
  if (verifyRules.length === 0) {
    return { gate: 'verify-rules', status: 'passed', message: 'no @verify rules' };
  }
  const ruleResults = executeVerifyRules(verifyRules, input.paths.root);
  const anyRuleFailed = ruleResults.some(r => !r.passed);
  if (anyRuleFailed) {
    const errorLines: string[] = [];
    const passed = ruleResults.filter(r => r.passed).length;
    errorLines.push(`@verify 规则失败 (${passed}/${ruleResults.length}):`);
    for (const r of ruleResults) {
      errorLines.push(`  ${r.passed ? '✓' : '✗'} ${r.message}`);
    }
    throw new Error(errorLines.join('\n'));
  }
  return {
    gate: 'verify-rules',
    status: 'passed',
    message: `${ruleResults.length} @verify rule(s) passed`,
  };
}

export function runDecisionGate(
  input: TaskCompletionInput,
  cascadedL1Specs: string[],
): CompletionGateResult {
  if (input.skipR18Check) {
    return { gate: 'decision-r18', status: 'skipped', message: 'R18 decision gate skipped' };
  }
  if (cascadedL1Specs.length > 0) {
    const missing: string[] = [];
    for (const code of cascadedL1Specs) {
      const decisions = listDecisions(input.paths, { docCode: code, includeAll: true });
      if (!decisions.some(isActiveDecision)) missing.push(code);
    }
    if (missing.length > 0) {
      throwCompletionGateError(
        { paths: input.paths, ruleId: 'R18', specCode: missing[0] },
        `R18: 以下 L1 已 cascade 到 implemented 但缺少 active 决策卡片: ${missing.join(', ')}\n` +
        `请先创建决策卡片:\n` +
        missing.map(code => `  spec-manager decision create ${code} --topic <topic> --what "..." --why "..."`).join('\n'),
      );
    }
  }
  for (const code of cascadedL1Specs) {
    recordAuditHit({ paths: input.paths, ruleId: 'R18', specCode: code }, input.auditSink);
  }
  return {
    gate: 'decision-r18',
    status: 'passed',
    message: `${cascadedL1Specs.length} cascaded L1/L0 spec(s) have active decisions`,
  };
}

function recordBypassAudit(input: TaskCompletionInput, task: TaskRecord): void {
  const bypassedChecks = bypassedCompletionChecks(input);
  if (bypassedChecks.length === 0) return;
  recordAuditHit({
    paths: input.paths,
    ruleId: input.skipR18Check ? 'R18' : 'R10',
    specCode: task.specCode,
    taskCode: task.id,
    metadata: {
      event: 'task-complete-bypass',
      bypassedChecks,
      reason: input.bypassReason!.trim(),
    },
    countRule: false,
  }, input.auditSink);
}

function bypassedCompletionChecks(input: TaskCompletionInput): string[] {
  return [
    input.skipR18Check ? 'r18' : null,
    input.skipVerification ? 'verification-commands' : null,
    input.skipVerify ? 'verify-rules' : null,
  ].filter((value): value is string => value !== null);
}

class CompletionGateError extends Error {
  constructor(message: string, readonly auditEvent: AuditEvent) {
    super(message);
    this.name = 'CompletionGateError';
  }
}

function throwCompletionGateError(auditEvent: AuditEvent, message: string): never {
  throw new CompletionGateError(message, auditEvent);
}

function taskSteps(task: TaskRecord, fallback?: StepFrontmatter[]): StepFrontmatter[] {
  return task.steps ?? fallback ?? [];
}

export function readTaskJSON(filePath: string): TaskRecord {
  return JSON.parse(readFileSync(filePath, 'utf8')) as TaskRecord;
}

export function taskFileExists(filePath: string): boolean {
  return existsSync(filePath);
}

export function topicTaskFilePath(topicDir: string, specCode: string, taskId: string): string {
  return join(topicDir, 'tasks', `${specCode}-${taskId}${TASK_FILE_EXT}`);
}

function findTaskById(paths: ProjectPaths, taskId: string, specCode?: string): TaskRecord {
  if (specCode) {
    const f = taskFilePathOf(paths, specCode, taskId);
    if (!existsSync(f)) throw new Error(`Task not found: ${taskId} (in ${specCode})`);
    return readTaskJSON(f);
  }
  const found = listTopicMetaFiles(paths, 'tasks', { extension: TASK_FILE_EXT })
    .map(file => readTaskJSON(file.filePath))
    .find(task => task.id === taskId);
  if (!found) throw new Error(`Task not found: ${taskId}`);
  return found;
}

function taskFilePathOf(paths: ProjectPaths, specCode: string, taskId: string): string {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`Spec not found: ${specCode}`);
  return join(siblingMetaDir(spec.filePath, 'tasks'), `${specCode}-${taskId}${TASK_FILE_EXT}`);
}

function writeTaskJSON(filePath: string, data: TaskRecord): void {
  writeAtomic(filePath, JSON.stringify(data, null, 2));
}
