import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let root: string;
let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-agents-', { initialized: false });
  root = project.root;
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerProject(program);
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
    expect(output()).toContain('codebuddy');
    expect(output()).toContain('cursor');
    expect(output()).toContain('windsurf');
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

    expect(output()).toContain('AI agent support planned: codex, opencode');
    expect(output()).toContain('detected:');
    expect(output()).toContain('AGENTS.md -> codex');
    expect(output()).toContain('AGENTS.md -> opencode');
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

    expect(output()).toContain('AI agent support planned: claude, codex, opencode, codebuddy, cursor, windsurf');
    expect(output()).not.toContain('detected:');
    expect(output()).toContain('CLAUDE.md');
    expect(output()).toContain('.windsurfrules');
  });

  it('fails with a provider hint when no marker is detected', async () => {
    await expect(
      makeProgram().parseAsync(['project', 'agents', '--dry-run'], { from: 'user' }),
    ).rejects.toThrow('--provider all');
  });
});
