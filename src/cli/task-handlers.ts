import { readFileSync } from 'node:fs';
import {
  normalizeHarnessTaskReportPayload,
  normalizeHarnessTaskVerificationPayload,
  recordHarnessTaskVerification,
  reportHarnessTaskStep,
  type HarnessTaskReportResult,
  type HarnessTaskVerificationResult,
} from '../core/harness.js';
import { VERIFICATION_LAYER_ORDER } from '../core/task.js';
import {
  printPresentedResult,
  splitCsv,
  type CliActionContext,
  type CliTextPresenter,
} from './common.js';

export interface TaskReportOptions {
  spec?: string;
  step?: string;
  summary?: string;
  files?: string;
  tests?: string;
  risks?: string;
  input?: string;
  json: boolean;
}

export interface TaskVerifyOptions {
  spec?: string;
  command?: string;
  exitCode?: number;
  summary?: string;
  artifacts?: string;
  coversAc?: string;
  layer?: string;
  input?: string;
  json: boolean;
}

export interface TaskReportCommandInput {
  context: CliActionContext;
  taskId: string;
  opts: TaskReportOptions;
}

export interface TaskVerifyCommandInput {
  context: CliActionContext;
  taskId: string;
  opts: TaskVerifyOptions;
}

export const TASK_REPORT_KNOWN_ERRORS = [
  {
    prefix: 'INVALID_REPORT: task report --input ',
    exitCode: 2,
    formatMessage: (message: string) => message.slice('INVALID_REPORT: '.length),
  },
  { prefix: 'INVALID_REPORT:', exitCode: 2 },
  { prefix: 'NO_REPORTABLE_STEP:', exitCode: 2 },
  { prefix: 'TASK_NOT_FOUND:', exitCode: 2 },
  { prefix: 'Task not found:', exitCode: 2 },
];

export const TASK_VERIFY_KNOWN_ERRORS = [
  {
    prefix: 'INVALID_VERIFICATION: --layer ',
    exitCode: 2,
    formatMessage: (message: string) => message.slice('INVALID_VERIFICATION: '.length),
  },
  {
    prefix: 'INVALID_VERIFICATION: task verify --input ',
    exitCode: 2,
    formatMessage: (message: string) => message.slice('INVALID_VERIFICATION: '.length),
  },
  { prefix: 'INVALID_VERIFICATION:', exitCode: 2 },
  { prefix: 'TASK_NOT_FOUND:', exitCode: 2 },
  { prefix: 'Task not found:', exitCode: 2 },
];

export function runTaskReportCommand(input: TaskReportCommandInput): HarnessTaskReportResult {
  const { context, taskId, opts } = input;
  const hasFlags = opts.step !== undefined || opts.summary !== undefined || opts.files !== undefined || opts.tests !== undefined || opts.risks !== undefined;
  if (opts.input && hasFlags) {
    throw new Error('INVALID_REPORT: task report --input 不能与 --summary/--files/--tests/--risks/--step 混用');
  }
  const raw = opts.input
    ? JSON.parse(readFileSync(opts.input, 'utf8')) as unknown
    : {
        summary: opts.summary,
        stepNo: opts.step,
        files: splitCsv(opts.files),
        tests: splitCsv(opts.tests),
        risks: splitCsv(opts.risks),
      };
  const payload = normalizeHarnessTaskReportPayload(raw);
  return reportHarnessTaskStep({ paths: context.paths, taskId, specCode: opts.spec, payload });
}

export function runTaskVerifyCommand(input: TaskVerifyCommandInput): HarnessTaskVerificationResult {
  const { context, taskId, opts } = input;
  if (opts.layer && !VERIFICATION_LAYER_ORDER.includes(opts.layer as 'compile' | 'functional' | 'smoke')) {
    throw new Error(`INVALID_VERIFICATION: --layer 非法: ${opts.layer}（必须 compile|functional|smoke）`);
  }
  const hasFlags = opts.command !== undefined || opts.exitCode !== undefined || opts.summary !== undefined || opts.artifacts !== undefined || opts.coversAc !== undefined;
  if (opts.input && hasFlags) {
    throw new Error('INVALID_VERIFICATION: task verify --input 不能与 --command/--exit-code/--summary/--artifacts/--covers-ac 混用');
  }
  const raw = opts.input
    ? JSON.parse(readFileSync(opts.input, 'utf8')) as unknown
    : {
        command: opts.command,
        exitCode: opts.exitCode,
        summary: opts.summary,
        artifacts: splitCsv(opts.artifacts),
        coversAc: splitCsv(opts.coversAc),
        layer: opts.layer,
      };
  const payload = normalizeHarnessTaskVerificationPayload(raw);
  return recordHarnessTaskVerification({ paths: context.paths, taskId, specCode: opts.spec, payload });
}

export const taskReportPresenter: CliTextPresenter<HarnessTaskReportResult> = {
  renderText: result => [
    `✓ Task ${result.task.id} report written`,
    `  step: ${result.stepNo}`,
  ],
  renderJson: result => result,
};

export const taskVerifyPresenter: CliTextPresenter<HarnessTaskVerificationResult> = {
  renderText: result => [
    `✓ Task ${result.task.id} verification ${result.verification.id} recorded`,
    `  exitCode: ${result.verification.exitCode}`,
    `  taskStatus: ${result.task.status}`,
  ],
  renderJson: result => result,
};

export function printTaskReportResult(context: CliActionContext, result: HarnessTaskReportResult, opts: { json: boolean }): void {
  printPresentedResult({
    context,
    presenter: taskReportPresenter,
    value: result,
    json: opts.json,
    warnings: result.warnings,
  });
}

export function printTaskVerifyResult(context: CliActionContext, result: HarnessTaskVerificationResult, opts: { json: boolean }): void {
  printPresentedResult({
    context,
    presenter: taskVerifyPresenter,
    value: result,
    json: opts.json,
  });
}
