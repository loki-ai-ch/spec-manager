import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { registerUsabilityCommands } from '../usability.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';
import { findTask } from '../../core/task.js';

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

  it('creates a feature through shortcut in the configured external write root', async () => {
    const external = createInitializedProject('spec-mgr-cli-usability-write-');
    try {
      configureExternalWriteStore(external);

      await makeProgram().parseAsync(['new', 'feature', 'User auth', '--topic', 'auth'], { from: 'user' });

      expect(output()).toContain('Created feature L1');
      expect(existsSync(join(external.root, 'specs', 'auth', 'auth-L1.md'))).toBe(true);
      expect(existsSync(join(project.root, 'specs', 'auth', 'auth-L1.md'))).toBe(false);
    } finally {
      external.cleanup();
    }
  });

  it('creates an extra L1 through shortcut when duplicate topic is allowed', async () => {
    await makeProgram().parseAsync(['new', 'feature', 'User auth', '--topic', 'auth'], { from: 'user' });
    logSpy.mockClear();

    await makeProgram().parseAsync(['new', 'feature', 'Auth v2', '--topic', 'auth', '--allow-duplicate-topic'], { from: 'user' });

    expect(output()).toContain('Created feature L1');
    expect(existsSync(join(project.root, 'specs', 'auth', 'auth-L1-2.md'))).toBe(true);
  });

  it('keeps guide default text output', async () => {
    writeFileSync(join(project.root, 'AGENTS.md'), '# Agents\n', 'utf8');

    await makeProgram().parseAsync(['guide', 'auth'], { from: 'user' });

    expect(output()).toContain('Request: auth');
    expect(output()).toContain('Next: spec-manager spec new L1 --topic auth');
  });

  it('prints next text output for a request', async () => {
    await makeProgram().parseAsync(['next', 'add', 'auth'], { from: 'user' });

    expect(output()).toContain(`Project: ${project.root}`);
    expect(output()).toContain(`Write Root: ${project.root}`);
    expect(output()).toContain('Request: add auth');
    expect(output()).toContain('Topic: (none)');
    expect(output()).toContain('Status: needs_l1');
    expect(output()).toContain('Next:');
    expect(output()).toContain('spec-manager spec new L1 --topic add --title "..."');
  });

  it('prints next json as a single object', async () => {
    await makeProgram().parseAsync(['next', 'add', 'auth', '--topic', 'auth', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed).toMatchObject({
      projectRoot: project.root,
      executionRoot: project.root,
      writeRoot: project.root,
      writeStore: expect.objectContaining({ id: 'local', mode: 'write' }),
      initialized: true,
      request: 'add auth',
      topic: 'auth',
      status: 'needs_l1',
      nextAction: 'spec-manager spec new L1 --topic auth --title "..."',
    });
  });

  it('prints dashboard summary and respects topic scope', async () => {
    await makeProgram().parseAsync(['new', 'feature', 'User auth', '--topic', 'auth'], { from: 'user' });
    logSpy.mockClear();

    await makeProgram().parseAsync(['dashboard', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain(`Project: ${project.root}`);
    expect(output()).toContain(`Write Root: ${project.root}`);
    expect(output()).toContain('Initialized: true');
    expect(output()).toContain('Topics: 1');
    expect(output()).toContain('Draft specs: 1');
    expect(output()).toContain('auth: 1 specs, 0 tasks');
    expect(output()).toContain('Next: spec-manager spec update auth-L1');
  });

  it('prints dashboard json as a single object', async () => {
    await makeProgram().parseAsync(['new', 'feature', 'User auth', '--topic', 'auth'], { from: 'user' });
    logSpy.mockClear();

    await makeProgram().parseAsync(['dashboard', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.projectRoot).toBe(project.root);
    expect(parsed.writeRoot).toBe(project.root);
    expect(parsed.writeStore).toMatchObject({ id: 'local', mode: 'write' });
    expect(parsed.initialized).toBe(true);
    expect(parsed.draftSpecCount).toBe(1);
    expect(parsed.topics).toHaveLength(1);
    expect(parsed.topics[0]).toMatchObject({ topic: 'auth', specCount: 1, taskCount: 0 });
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it('prints top-level brief with workflow next action', async () => {
    await makeProgram().parseAsync(['brief', 'auth', 'login', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain('Agent Brief');
    expect(output()).toContain('Request: auth login');
    expect(output()).toContain('Topic: auth');
    expect(output()).toContain('Workflow Next:');
    expect(output()).toContain(`Write Root: ${project.root}`);
    expect(output()).toContain('spec-manager spec new L1 --topic auth --title "..."');
  });

  it('prints top-level brief from the configured external write root', async () => {
    const external = createInitializedProject('spec-mgr-cli-usability-write-');
    try {
      configureExternalWriteStore(external);
      createSpec({ paths: external.paths, code: 'auth-L1', level: 'L1', title: 'External Auth', topic: 'auth', parentCode: null });
      updateSpec(external.paths, 'auth-L1', { content: '# External Auth\n\n## 背景\nExternal spec.\n', aiSummary: 'external auth' });
      writeFileSync(
        join(external.root, 'specs', 'DESIGN.md'),
        [
          '---',
          'name: External Design',
          'colors:',
          '  primary: "#1A1C1E"',
          '---',
          '',
          '## Overview',
          '',
          'External design context.',
        ].join('\n'),
        'utf8',
      );

      await makeProgram().parseAsync(['brief', 'polish', 'UI', '--topic', 'auth'], { from: 'user' });

      expect(output()).toContain('External Auth');
      expect(output()).toContain('Design Context: External Design');
      expect(output()).toContain(`Write Root: ${external.root}`);
      expect(output()).toContain('spec-manager spec confirm auth-L1');
    } finally {
      external.cleanup();
    }
  });

  it('prints top-level brief json with next projection', async () => {
    await makeProgram().parseAsync(['brief', 'auth', 'login', '--topic', 'auth', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.brief.schemaVersion).toBe('agent-brief.v1');
    expect(parsed.brief.topic).toBe('auth');
    expect(parsed.next).toMatchObject({
      topic: 'auth',
      writeRoot: project.root,
      status: 'needs_l1',
      nextAction: 'spec-manager spec new L1 --topic auth --title "..."',
    });
  });

  it('keeps design context guidance in top-level brief for visual requests', async () => {
    writeFileSync(
      join(project.root, 'DESIGN.md'),
      [
        '---',
        'name: Heritage',
        'colors:',
        '  primary: "#1A1C1E"',
        '---',
        '',
        '## Overview',
        '',
        'Editorial design system.',
      ].join('\n'),
      'utf8',
    );

    await makeProgram().parseAsync(['brief', 'polish', 'UI', 'styling', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain('Design Context: Heritage');
    expect(output()).toContain('Design Guidance:');
    expect(output()).toContain('Read DESIGN.md prose');
    expect(output()).toContain('Workflow Next:');
  });

  it('runs top-level shortcut against the configured external write root', async () => {
    const external = createInitializedProject('spec-mgr-cli-usability-write-');
    try {
      configureExternalWriteStore(external);
      const specCode = createRunnableL3(external);
      const planFile = join(project.root, 'plan.json');
      writeFileSync(planFile, JSON.stringify({
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run shortcut parity test' }],
      }), 'utf8');

      await makeProgram().parseAsync(['run', specCode, '--plan', planFile], { from: 'user' });

      expect(findTask(external.paths, specCode, 'T-001')?.status).toBe('running');
      expect(findTask(project.paths, specCode, 'T-001')).toBeNull();
      expect(output()).toContain(`Task T-001 created and started for ${specCode}`);
    } finally {
      external.cleanup();
    }
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

function createInitializedProject(prefix: string): TestProject {
  const p = createTestProject(prefix);
  mkdirSync(p.paths.specsDir, { recursive: true });
  mkdirSync(p.paths.changesDir, { recursive: true });
  mkdirSync(p.paths.archiveDir, { recursive: true });
  writeFileSync(p.paths.configFile, 'project_name: external\n', 'utf8');
  writeFileSync(p.paths.auditFile, '{}', 'utf8');
  return p;
}

function configureExternalWriteStore(external: TestProject): void {
  writeFileSync(project.paths.configFile, [
    'project_name: execution',
    'specStore:',
    '  id: product-planning',
    `  path: ${JSON.stringify(external.root)}`,
    '  mode: write',
    '',
  ].join('\n'), 'utf8');
}

function createRunnableL3(target: TestProject): string {
  createSpec({ paths: target.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(target.paths, 'auth-L1', { status: 'confirmed', content: '# Auth\n\n## 背景\nAuth.\n', aiSummary: 'auth' });
  createSpec({ paths: target.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(target.paths, 'auth-L2.1', { status: 'confirmed', content: '# Auth design\n\n## 方案概述\nDesign.\n', aiSummary: 'auth design' });
  createSpec({ paths: target.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(target.paths, 'auth-L3.1.1', {
    status: 'frozen',
    content: '# Auth impl\n\n## 目标\nImplement auth.\n\n## 验证命令\nnpm test\n',
    aiSummary: 'auth impl',
  });
  return 'auth-L3.1.1';
}
