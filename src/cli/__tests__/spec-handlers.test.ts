import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAudit } from '../../core/audit.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';
import type { CliActionContext } from '../common.js';
import {
  printSpecTransitionResult,
  printSpecUpdateResult,
  runSpecTransitionCommand,
  runSpecUpdateCommand,
} from '../spec-handlers.js';

let project: TestProject;
let context: CliActionContext & { logs: string[]; warnings: string[]; errors: string[] };

beforeEach(() => {
  project = createTestProject('spec-mgr-spec-handlers-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  context = createContext();
});

afterEach(() => {
  project.cleanup();
});

function createContext(): CliActionContext & { logs: string[]; warnings: string[]; errors: string[] } {
  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  return {
    paths: project.paths,
    stdout: { write: () => true },
    log: message => logs.push(message),
    warn: message => warnings.push(message),
    error: message => errors.push(message),
    exit: (code: number): never => {
      throw new Error(`exit:${code}`);
    },
    logs,
    warnings,
    errors,
  };
}

function createCompleteL1(code = 'auth-L1'): void {
  createSpec({ paths: project.paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, code, { content: '# Auth\n', aiSummary: 'auth' });
}

function createCompleteL3(): string {
  createCompleteL1();
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed', content: '# Design\n', aiSummary: 'design' });
  const code = 'auth-L3.1.1-login';
  createSpec({ paths: project.paths, code, level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, code, { content: '# Login\n', aiSummary: 'login' });
  return code;
}

describe('spec CLI handlers', () => {
  it('updates spec content from a file and presents validation output', () => {
    createCompleteL1();
    const contentFile = join(project.root, 'content.md');
    writeFileSync(contentFile, '# Updated Auth\n', 'utf8');

    const result = runSpecUpdateCommand({
      context,
      code: 'auth-L1',
      opts: { content: contentFile, aiSummary: 'updated', changeSummary: 'refresh' },
    });
    printSpecUpdateResult(context, result);

    expect(findSpecByCode(project.paths, 'auth-L1')?.content).toBe('# Updated Auth\n');
    expect(context.logs).toContain('✓ 已更新 auth-L1（status: draft）');
    expect(context.logs.some(line => line.startsWith('Next: '))).toBe(true);
  });

  it('updates spec content from stdin reader', () => {
    createCompleteL1();

    runSpecUpdateCommand({
      context,
      code: 'auth-L1',
      opts: { content: '-', aiSummary: 'stdin' },
      readStdin: () => '# From stdin\n',
    });

    expect(findSpecByCode(project.paths, 'auth-L1')?.content).toBe('# From stdin\n');
  });

  it('transitions a draft L3 confirm directly to frozen and records audit', () => {
    const code = createCompleteL3();

    const result = runSpecTransitionCommand({ context, code, command: 'confirm', force: false });
    printSpecTransitionResult(context, result);

    expect(result.newStatus).toBe('frozen');
    expect(findSpecByCode(project.paths, code)?.fm.status).toBe('frozen');
    expect(context.logs[0]).toContain('draft → frozen');
    expect(readAudit(project.paths).rules.R2).toBe(1);
    expect(readAudit(project.paths).rules.R9).toBe(1);
  });

  it('rejects freezing a draft L1 with the original user-visible error', () => {
    createCompleteL1();

    expect(() => runSpecTransitionCommand({
      context,
      code: 'auth-L1',
      command: 'freeze',
      force: false,
    })).toThrow(/SPEC_CLI_EXIT_2:✗ 状态非法: L1 draft → frozen/);
  });

  it('rejects manual L3 implementation without force with the original warning text', () => {
    const code = createCompleteL3();
    updateSpec(project.paths, code, { status: 'frozen' });

    expect(() => runSpecTransitionCommand({
      context,
      code,
      command: 'implement',
      force: false,
    })).toThrow(/SPEC_CLI_EXIT_2:⚠ R3:/);
  });
});
