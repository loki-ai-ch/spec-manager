/**
 * @verify 规则解析与执行。
 * 从 L3 spec 的 ## 验收标准 段中解析 @verify: 标记，自动执行校验。
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { buildDesignContextDiffReport, buildDesignContextReport, type DesignContextDiffSet } from './design-context.js';
import { getPaths } from './paths.js';

/** @verify 规则 — 从 L3 验收标准段解析，不持久化 */
export type VerifyRule =
  | { type: 'file-exists'; path: string }
  | { type: 'export-exists'; file: string; symbol: string }
  | { type: 'command'; cmd: string }
  | { type: 'design-lint'; path: string }
  | { type: 'design-diff'; beforePath: string; afterPath: string };

/** 单条规则执行结果 */
export interface VerifyResult {
  rule: VerifyRule;
  passed: boolean;
  message: string;
}

/** 匹配 @verify 行，支持有序列表(1. )和无序列表(- )前缀 */
export const VERIFY_RE = /^(?:\d+\.\s+|- )?@verify:\s*(\w[\w-]*)\((.+)\)\s*$/;
const COMMAND_TIMEOUT_MS = 30_000;

/** @verify 类型 → 参数数量 */
export const VERIFY_TYPE_ARITY: Record<string, number> = {
  'file-exists': 1,
  'export-exists': 2,
  'command': 1,
  'design-lint': 1,
  'design-diff': 2,
};

/**
 * 从 spec markdown 的指定段中解析 @verify 规则。
 * 仅解析 ## sectionName 段内的 @verify: 行。
 */
export function parseVerifyRules(content: string, sectionName: string): VerifyRule[] {
  const rules: VerifyRule[] = [];
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      inSection = trimmed.includes(sectionName);
      continue;
    }
    if (!inSection) continue;

    const m = VERIFY_RE.exec(trimmed);
    if (!m) continue;

    const [, type, argsStr] = m;
    const args = splitArgs(argsStr);

    if (type === 'file-exists' && args.length === 1) {
      rules.push({ type: 'file-exists', path: args[0] });
    } else if (type === 'export-exists' && args.length === 2) {
      rules.push({ type: 'export-exists', file: args[0], symbol: args[1] });
    } else if (type === 'command' && args.length === 1) {
      rules.push({ type: 'command', cmd: args[0] });
    } else if (type === 'design-lint' && args.length === 1) {
      rules.push({ type: 'design-lint', path: args[0] });
    } else if (type === 'design-diff' && args.length === 2) {
      rules.push({ type: 'design-diff', beforePath: args[0], afterPath: args[1] });
    }
  }
  return rules;
}

/**
 * 执行一组 @verify 规则，返回每条规则的结果。
 * projectRoot 用于解析相对路径。
 */
export function executeVerifyRules(rules: VerifyRule[], projectRoot: string): VerifyResult[] {
  return rules.map(rule => executeOne(rule, projectRoot));
}

function executeOne(rule: VerifyRule, projectRoot: string): VerifyResult {
  switch (rule.type) {
    case 'file-exists': {
      const abs = path.resolve(projectRoot, rule.path);
      const exists = existsSync(abs);
      return {
        rule,
        passed: exists,
        message: exists ? `${rule.path} exists` : `${rule.path} not found`,
      };
    }
    case 'export-exists': {
      const abs = path.resolve(projectRoot, rule.file);
      if (!existsSync(abs)) {
        return { rule, passed: false, message: `${rule.file} not found` };
      }
      const content = readFileSync(abs, 'utf8');
      const re = new RegExp(
        `export\\s+(?:default\\s+)?(?:function|const|let|var|class|type|interface|enum)\\s+${escapeRegExp(rule.symbol)}\\b`,
      );
      const alsoNamed = new RegExp(
        `export\\s*\\{[^}]*\\b${escapeRegExp(rule.symbol)}\\b[^}]*\\}`,
      );
      const found = re.test(content) || alsoNamed.test(content);
      return {
        rule,
        passed: found,
        message: found
          ? `${rule.symbol} exported from ${rule.file}`
          : `${rule.symbol} not found in exports of ${rule.file}`,
      };
    }
    case 'command': {
      const result = runCommand(rule.cmd, projectRoot);
      return {
        rule,
        passed: result.exitCode === 0,
        message: result.exitCode === 0
          ? `${rule.cmd} → exit 0`
          : `${rule.cmd} → exit ${result.exitCode}${result.output ? ': ' + result.output : ''}`,
      };
    }
    case 'design-lint': {
      const design = buildDesignContextReport({ paths: getPaths(projectRoot), filePath: rule.path });
      const summary = `errors=${design.result.errors}, warnings=${design.result.warnings}, infos=${design.result.infos}`;
      if (!design.exists) {
        return {
          rule,
          passed: false,
          message: `${rule.path} not found (${summary})`,
        };
      }
      if (design.result.errors > 0) {
        const errors = design.findings.filter(finding => finding.severity === 'error').slice(0, 3);
        const errorDetails = errors.map(finding => {
          const location = finding.path ? `${finding.path}: ` : '';
          return `[${finding.severity}] ${location}${finding.message}`;
        }).join('; ');
        return {
          rule,
          passed: false,
          message: `${rule.path} lint failed (${summary})${errorDetails ? `: ${errorDetails}` : ''}`,
        };
      }
      return {
        rule,
        passed: true,
        message: `${rule.path} lint passed (${summary})`,
      };
    }
    case 'design-diff': {
      const diff = buildDesignContextDiffReport({
        paths: getPaths(projectRoot),
        beforePath: rule.beforePath,
        afterPath: rule.afterPath,
      });
      const summary = designDiffSummary(rule.beforePath, rule.afterPath, diff);
      const missingPath = !diff.before.exists ? rule.beforePath : !diff.after.exists ? rule.afterPath : null;
      if (missingPath) {
        return {
          rule,
          passed: false,
          message: `${missingPath} not found (${summary})`,
        };
      }
      return {
        rule,
        passed: !diff.regression,
        message: diff.regression ? `design diff regression (${summary})` : `design diff passed (${summary})`,
      };
    }
  }
}

type DesignDiffReport = ReturnType<typeof buildDesignContextDiffReport>;

function designDiffSummary(beforePath: string, afterPath: string, diff: DesignDiffReport): string {
  const delta = diff.findings.delta;
  const removedTokens = Object.entries(diff.tokens)
    .filter(([, value]) => value.removed.length > 0)
    .map(([group, value]) => `${group}: ${value.removed.join(', ')}`)
    .join('; ');
  return [
    `${beforePath} -> ${afterPath}`,
    `errorsΔ=${formatDelta(delta.errors)}`,
    `warningsΔ=${formatDelta(delta.warnings)}`,
    `removedTokens=${removedTokens || 'none'}`,
    `sections=${formatDiffSet(diff.sections)}`,
  ].join('; ');
}

function formatDiffSet(set: DesignContextDiffSet): string {
  return `added=${set.added.length ? set.added.join(', ') : 'none'}, removed=${set.removed.length ? set.removed.join(', ') : 'none'}, modified=${set.modified.length ? set.modified.join(', ') : 'none'}`;
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export interface RunCommandResult {
  exitCode: number;
  output: string;
}

export function runCommand(cmd: string, cwd: string): RunCommandResult {
  try {
    execSync(cmd, { cwd, timeout: COMMAND_TIMEOUT_MS, stdio: 'pipe', encoding: 'utf8' });
    return { exitCode: 0, output: '' };
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: string; stdout?: string };
    const exitCode = e.status ?? 1;
    const output = (e.stderr ?? e.stdout ?? '').toString().slice(0, 500);
    return { exitCode, output };
  }
}

/** 拆分括号内逗号分隔参数，处理嵌套括号 */
export function splitArgs(raw: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
