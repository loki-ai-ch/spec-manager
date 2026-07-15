import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { registerAgentInstallCommands } from '../agent-install.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let root: string;
let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-agents-', { initialized: false });
  root = project.root;
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerProject(program);
  registerAgentInstallCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

describe('project agents CLI', () => {
  it('prints supported providers without installing files', async () => {
    await makeProgram().parseAsync(['project', 'agents', '--provider', 'list'], { from: 'user' });

    expect(output()).toContain('Supported AI agent providers:');
    expect(output()).toContain('claude');
    expect(output()).toContain('codex');
    expect(output()).toContain('opencode');
    expect(output()).toContain('mimocode');
    expect(output()).toContain('codebuddy');
    expect(output()).toContain('cursor');
    expect(output()).toContain('windsurf');
    expect(output()).toContain('Supported AI platform install commands:');
    expect(output()).toContain('spec-manager kilo install');
    expect(output()).toContain('spec-manager trae-cn install');
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('dry-runs an install plan without writing files', async () => {
    await makeProgram().parseAsync(['project', 'agents', '--provider', 'codex', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: codex');
    expect(output()).toContain('would create:');
    expect(output()).toContain('AGENTS.md');
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('auto-detects AGENTS.md when provider is omitted', async () => {
    writeFileSync(join(root, 'AGENTS.md'), '# existing\n', 'utf8');

    await makeProgram().parseAsync(['project', 'agents', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: codex, opencode, mimocode');
    expect(output()).toContain('detected:');
    expect(output()).toContain('AGENTS.md -> codex');
    expect(output()).toContain('AGENTS.md -> opencode');
    expect(output()).toContain('AGENTS.md -> mimocode');
    expect(output()).toContain('skipped:');
    expect(existsSync(join(root, '.cursorrules'))).toBe(false);
  });

  it('auto-detects cursor and windsurf rules when provider is omitted', async () => {
    writeFileSync(join(root, '.cursorrules'), '# cursor\n', 'utf8');
    writeFileSync(join(root, '.windsurfrules'), '# windsurf\n', 'utf8');

    await makeProgram().parseAsync(['project', 'agents', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: cursor, windsurf');
    expect(output()).toContain('.cursorrules -> cursor');
    expect(output()).toContain('.windsurfrules -> windsurf');
  });

  it('keeps explicit all behavior separate from auto-detection', async () => {
    await makeProgram().parseAsync(['project', 'agents', '--provider', 'all', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: claude, codex, opencode, mimocode, codebuddy, cursor, windsurf');
    expect(output()).not.toContain('detected:');
    expect(output()).toContain('CLAUDE.md');
    expect(output()).toContain('.windsurfrules');
  });

  it('fails with a provider hint when no marker is detected', async () => {
    await expect(
      makeProgram().parseAsync(['project', 'agents', '--dry-run'], { from: 'user' }),
    ).rejects.toThrow('--provider all');
  });

  it('dry-runs a native platform install command', async () => {
    await makeProgram().parseAsync(['codex', 'install', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: codex');
    expect(output()).toContain('would create:');
    expect(output()).toContain('AGENTS.md');
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('dry-runs a fallback platform install command with notes', async () => {
    await makeProgram().parseAsync(['kilo', 'install', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: codex');
    expect(output()).toContain('AGENTS.md');
    expect(output()).toContain('Kilo Code uses AGENTS-compatible fallback instructions.');
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('dry-runs install --platform for kimi', async () => {
    await makeProgram().parseAsync(['install', '--platform', 'kimi', '--dry-run'], { from: 'user' });

    expect(output()).toContain('AI agent support planned: codex');
    expect(output()).toContain('Kimi Code uses AGENTS-compatible fallback instructions.');
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('dry-runs agents and skills cross-framework aliases', async () => {
    await makeProgram().parseAsync(['agents', 'install', '--dry-run'], { from: 'user' });
    expect(output()).toContain('AI agent support planned: claude, codex, opencode, mimocode, codebuddy, cursor, windsurf');
    logSpy.mockClear();

    await makeProgram().parseAsync(['skills', 'install', '--dry-run'], { from: 'user' });
    expect(output()).toContain('AI agent support planned: claude, codex, opencode, mimocode, codebuddy, cursor, windsurf');
  });

  it('fails unknown install --platform with supported platform hint', async () => {
    await expect(
      makeProgram().parseAsync(['install', '--platform', 'unknown', '--dry-run'], { from: 'user' }),
    ).rejects.toThrow('process.exit:2');

    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('unsupported AI platform: unknown');
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('trae-cn');
  });
});
