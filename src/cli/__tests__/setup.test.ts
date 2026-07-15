import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { registerUsabilityCommands } from '../usability.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-setup-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: setup-test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
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
  registerUsabilityCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

describe('setup CLI', () => {
  it('prints top-level setup json as a single object', async () => {
    await makeProgram().parseAsync(['setup', 'add', 'auth', '--topic', 'auth', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed).toMatchObject({
      schemaVersion: 'setup.v1',
      projectRoot: project.root,
      executionRoot: project.root,
      writeRoot: project.root,
      initialized: true,
      uxProfile: 'core',
      workflowProfile: { enabled: false, defaultProfile: 'standard' },
      nextAction: 'spec-manager spec new L1 --topic auth --title "..."',
    });
    expect(Array.isArray(parsed.providers)).toBe(true);
    expect(Array.isArray(parsed.suggestedCommands)).toBe(true);
  });

  it('keeps project setup json aligned with top-level setup', async () => {
    await makeProgram().parseAsync(['setup', 'add', 'auth', '--topic', 'auth', '--json'], { from: 'user' });
    const topLevel = JSON.parse(output());
    logSpy.mockClear();

    await makeProgram().parseAsync(['project', 'setup', 'add', 'auth', '--topic', 'auth', '--json'], { from: 'user' });
    const projectAlias = JSON.parse(output());

    expect(projectAlias).toMatchObject({
      schemaVersion: topLevel.schemaVersion,
      projectRoot: topLevel.projectRoot,
      writeRoot: topLevel.writeRoot,
      uxProfile: topLevel.uxProfile,
      workflowProfile: topLevel.workflowProfile,
      nextAction: topLevel.nextAction,
    });
  });

  it('prints setup text with profiles and provider guidance', async () => {
    writeFileSync(join(project.root, 'AGENTS.md'), '# existing\n', 'utf8');

    await makeProgram().parseAsync(['setup', 'add', 'auth', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain('Setup: spec-manager');
    expect(output()).toContain(`Project Root: ${project.root}`);
    expect(output()).toContain(`Write Root: ${project.root}`);
    expect(output()).toContain('UX: core (presentation only; does not change task gates)');
    expect(output()).toContain('Workflow: standard (adaptive workflow disabled)');
    expect(output()).toContain('installed: codex');
    expect(output()).toContain('Next:');
    expect(output()).toContain('spec-manager spec new L1 --topic auth --title "..."');
  });

  it('prints setup for uninitialized projects without requiring initialization', async () => {
    const uninitialized = createTestProject('spec-mgr-cli-setup-uninit-', { initialized: false });
    process.env.SPEC_MANAGER_ROOT = uninitialized.root;
    try {
      await makeProgram().parseAsync(['setup', '--json'], { from: 'user' });
      const parsed = JSON.parse(output());
      expect(parsed.initialized).toBe(false);
      expect(parsed.nextAction).toContain('project init');
      expect(parsed.suggestedCommands).toContain('spec-manager project init --name <project-name>');
    } finally {
      process.env.SPEC_MANAGER_ROOT = project.root;
      uninitialized.cleanup();
    }
  });

  it('prints external write root in setup json', async () => {
    const storeRoot = createInitializedSibling('product-specs');
    writeFileSync(project.paths.configFile, [
      'project_name: setup-test',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      '',
    ].join('\n'), 'utf8');

    await makeProgram().parseAsync(['setup', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.executionRoot).toBe(project.root);
    expect(parsed.writeRoot).toBe(storeRoot);
    expect(parsed.writeStore.id).toBe('product-planning');
  });

  it('prints broken write root diagnostics without throwing', async () => {
    writeFileSync(project.paths.configFile, [
      'project_name: setup-test',
      'specStore:',
      '  id: missing',
      '  path: ../missing-specs',
      '',
    ].join('\n'), 'utf8');

    await makeProgram().parseAsync(['project', 'setup'], { from: 'user' });

    expect(output()).toContain('Diagnostics:');
    expect(output()).toContain('store_path_missing');
    expect(output()).toContain('Blocking: store_path_missing');
    expect(output()).toContain('spec-manager project store doctor');
    expect(existsSync(join(project.root, 'missing-specs'))).toBe(false);
  });
});

function createInitializedSibling(name: string): string {
  const root = resolve(project.root, '..', name);
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  return root;
}
