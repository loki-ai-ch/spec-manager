import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { registerUsabilityCommands } from '../usability.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let writeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-usability-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  writeSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerProject(program);
  registerUsabilityCommands(program);
  return program;
}

function output(): string {
  return [
    ...logSpy.mock.calls.map((call) => String(call[0])),
    ...writeSpy.mock.calls.map((call) => String(call[0])),
  ].join('\n');
}

describe('usability CLI', () => {
  it('runs project doctor', async () => {
    await makeProgram().parseAsync(['project', 'doctor'], { from: 'user' });
    expect(output()).toContain('Project doctor');
  });

  it('runs flow status for an empty topic', async () => {
    await makeProgram().parseAsync(['flow', 'status', '--topic', 'auth'], { from: 'user' });
    expect(output()).toContain('spec-manager spec new L1 --topic auth');
  });

  it('prints a template', async () => {
    await makeProgram().parseAsync(['template', 'L1', '--title', 'Auth'], { from: 'user' });
    expect(output()).toContain('# Auth');
  });

  it('creates a feature through shortcut', async () => {
    await makeProgram().parseAsync(['new', 'feature', 'User auth', '--topic', 'auth'], { from: 'user' });
    expect(output()).toContain('Created feature L1');
    expect(existsSync(join(project.root, 'specs', 'auth', 'auth-L1.md'))).toBe(true);
  });
});
