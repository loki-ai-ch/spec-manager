import { readFileSync } from 'node:fs';
import { hit } from '../core/audit.js';
import { findSpecByCode, isPlaceholderContent, updateSpec, type SpecRecord } from '../core/spec-io.js';
import { canTransition, nextStatuses } from '../core/status.js';
import { suggestAfterSpecCommand } from '../core/usability.js';
import { validateSpecContent, type ValidationWarning } from '../core/validate.js';
import type { CliActionContext, CliKnownError } from './common.js';

const SPEC_CLI_EXIT_1 = 'SPEC_CLI_EXIT_1:';
const SPEC_CLI_EXIT_2 = 'SPEC_CLI_EXIT_2:';

export const SPEC_HANDLER_KNOWN_ERRORS: CliKnownError[] = [
  {
    prefix: SPEC_CLI_EXIT_1,
    exitCode: 1,
    prefixSymbol: false,
    formatMessage: message => message.slice(SPEC_CLI_EXIT_1.length),
  },
  {
    prefix: SPEC_CLI_EXIT_2,
    exitCode: 2,
    prefixSymbol: false,
    formatMessage: message => message.slice(SPEC_CLI_EXIT_2.length),
  },
];

export interface SpecUpdateOptions {
  content?: string;
  aiSummary?: string;
  changeSummary?: string;
}

export interface SpecUpdateCommandInput {
  context: CliActionContext;
  code: string;
  opts: SpecUpdateOptions;
  readStdin?: () => string;
}

export interface SpecUpdateCommandResult {
  record: SpecRecord;
  warnings: string[];
  validationWarnings: ValidationWarning[];
  next: string;
}

export type SpecTransitionCommand = 'confirm' | 'freeze' | 'implement';

export interface SpecTransitionCommandInput {
  context: CliActionContext;
  code: string;
  command: SpecTransitionCommand;
  force: boolean;
}

export interface SpecTransitionCommandResult {
  record: SpecRecord;
  oldStatus: SpecRecord['fm']['status'];
  newStatus: SpecRecord['fm']['status'];
  next: string;
}

export function runSpecUpdateCommand(input: SpecUpdateCommandInput): SpecUpdateCommandResult {
  const { context, code, opts } = input;
  if (!findSpecByCode(context.paths, code)) throw cliError(1, `✗ 未找到: ${code}`);
  const patch: Parameters<typeof updateSpec>[2] = {};
  if (opts.content) {
    patch.content = opts.content === '-'
      ? (input.readStdin ?? (() => readFileSync(0, 'utf8')))()
      : readFileSync(opts.content, 'utf8');
  }
  if (opts.aiSummary) patch.aiSummary = opts.aiSummary;
  if (opts.changeSummary) patch.changeSummary = opts.changeSummary;
  const result = updateSpec(context.paths, code, patch);
  return {
    ...result,
    validationWarnings: validateSpecContent(result.record.fm.level, result.record.content),
    next: suggestAfterSpecCommand(result.record, context.paths),
  };
}

export function runSpecTransitionCommand(input: SpecTransitionCommandInput): SpecTransitionCommandResult {
  const { context, code, command, force } = input;
  const rec = findSpecByCode(context.paths, code);
  if (!rec) throw cliError(1, `✗ 未找到: ${code}`);
  const target = command === 'confirm' ? 'confirmed' : command === 'freeze' ? 'frozen' : 'implemented';
  const actualTarget =
    command === 'confirm' && rec.fm.level === 'L3' && rec.fm.status === 'draft'
      ? 'frozen'
      : target;
  if (actualTarget === 'frozen' && rec.fm.status === 'draft' && rec.fm.level !== 'L3') {
    throw cliError(2, `✗ 状态非法: ${rec.fm.level} ${rec.fm.status} → ${actualTarget}\n  L1/L2 请先使用 spec-manager spec confirm ${code}`);
  }
  if ((actualTarget === 'confirmed' || actualTarget === 'frozen') && isPlaceholderContent(rec.content)) {
    throw cliError(
      2,
      `✗ R22: ${code} 的 contentTemplate 仍是占位（"<!-- 在此粘贴正文 -->"）\n` +
      `  请先: spec-manager spec update ${code} --content <file> --ai-summary "..." --change-summary "..."`,
    );
  }
  if (!canTransition(rec.fm.status, actualTarget)) {
    throw cliError(2, `✗ 状态非法: ${rec.fm.status} → ${actualTarget}\n  合法的下一态：${nextStatuses(rec.fm.status).join(', ')}`);
  }
  if (actualTarget === 'implemented' && rec.fm.level === 'L3' && rec.fm.status === 'frozen' && !force) {
    throw cliError(
      2,
      `⚠ R3: L3 spec ${code} 的 implemented 应由 task complete 自动 cascade\n` +
      `  如确需手动推进，请用: spec-manager spec implement ${code} --force`,
    );
  }
  hit({ paths: context.paths, ruleId: 'R2', specCode: code });
  hit({ paths: context.paths, ruleId: 'R9', specCode: code });
  const { record } = updateSpec(context.paths, code, {
    status: actualTarget,
    changeSummary: `${rec.fm.status} → ${actualTarget}`,
  });
  return {
    record,
    oldStatus: rec.fm.status,
    newStatus: actualTarget,
    next: suggestAfterSpecCommand(record, context.paths),
  };
}

export function printSpecUpdateResult(context: CliActionContext, result: SpecUpdateCommandResult): void {
  for (const warning of result.warnings) (context.warn ?? context.error)(`⚠ ${warning}`);
  for (const warning of result.validationWarnings) {
    const symbol = warning.level === 'warn' ? '⚠' : 'ℹ';
    context.log(`${symbol} [${warning.rule}] ${warning.message}`);
  }
  context.log(`✓ 已更新 ${result.record.fm.code}（status: ${result.record.fm.status}）`);
  context.log(`Next: ${result.next}`);
}

export function printSpecTransitionResult(context: CliActionContext, result: SpecTransitionCommandResult): void {
  context.log(`✓ ${result.record.fm.code}: ${result.oldStatus} → ${result.newStatus}`);
  context.log(`Next: ${result.next}`);
}

function cliError(exitCode: 1 | 2, message: string): Error {
  return new Error(`${exitCode === 1 ? SPEC_CLI_EXIT_1 : SPEC_CLI_EXIT_2}${message}`);
}
