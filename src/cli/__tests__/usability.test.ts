import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { registerUsabilityCommands } from '../usability.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let writeSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

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
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit:${code}`);
  });
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  writeSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
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
  it('approves a draft L3 directly to frozen', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2' });
    updateSpec(project.paths, 'auth-L3', { content: '# Auth impl\n', aiSummary: 'auth impl' });

    await makeProgram().parseAsync(['approve', 'auth-L3'], { from: 'user' });

    expect(findSpecByCode(project.paths, 'auth-L3')?.fm.status).toBe('frozen');
    expect(output()).toContain('draft → frozen');
  });

  it('rejects approving a placeholder draft L3', async () => {
    createSpec({ paths: project.paths, code: 'placeholder-L1', level: 'L1', title: 'Placeholder', topic: 'placeholder', parentCode: null });
    updateSpec(project.paths, 'placeholder-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'placeholder-L2', level: 'L2', title: 'Placeholder design', topic: 'placeholder', parentCode: 'placeholder-L1' });
    updateSpec(project.paths, 'placeholder-L2', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'placeholder-L3', level: 'L3', title: 'Placeholder impl', topic: 'placeholder', parentCode: 'placeholder-L2' });

    await expect(makeProgram().parseAsync(['approve', 'placeholder-L3'], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('R22');
  });

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

  it('keeps guide default text output', async () => {
    writeFileSync(join(project.root, 'AGENTS.md'), '# Agents\n', 'utf8');

    await makeProgram().parseAsync(['guide', 'auth'], { from: 'user' });

    expect(output()).toContain('Request: auth');
    expect(output()).toContain('Next: spec-manager spec new L1 --topic auth');
  });

  it('keeps guide next action and prints advisory for non-blocking doctor warnings', async () => {
    mkdirSync(join(project.root, '.claude', 'skills', 'spec-manager'), { recursive: true });

    await makeProgram().parseAsync(['guide', 'auth'], { from: 'user' });

    expect(output()).toContain('Request: auth');
    expect(output()).toContain('Next: spec-manager spec new L1 --topic auth');
    expect(output()).toContain('Advisory:');
    expect(output()).toContain('Claude skill rules bundled');
  });

  it('prints rich guide output', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });

    await makeProgram().parseAsync(['guide', 'auth-L1', '--format', 'rich'], { from: 'user' });

    expect(output()).toContain('<task>');
    expect(output()).toContain('<next_command>');
  });

  it('rejects invalid guide format', async () => {
    await expect(makeProgram().parseAsync(['guide', 'auth', '--format', 'json'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('guide --format 必须是 text 或 rich');
  });
});
