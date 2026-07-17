import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerKnowledgeCommands } from '../knowledge.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, writeSpec } from '../../core/spec-io.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-knowledge-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: knowledge-test\n', 'utf8');
  oldRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  const spec = findSpecByCode(project.paths, 'auth-L1');
  if (!spec) throw new Error('missing auth-L1 fixture');
  writeSpec({ ...spec, fm: { ...spec.fm, status: 'implemented' } });
});

afterEach(() => {
  if (oldRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
  else process.env.SPEC_MANAGER_ROOT = oldRoot;
  logSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerKnowledgeCommands(program);
  return program;
}

async function run(args: string[]): Promise<void> {
  await makeProgram().parseAsync(args, { from: 'user' });
}

function output(): string {
  return logSpy.mock.calls.map(call => String(call[0])).join('\n');
}

describe('knowledge CLI', () => {
  it('defaults implemented spec to unknown without writing', async () => {
    await run(['knowledge', 'show', 'spec:auth-L1', '--json']);
    expect(output()).toContain('"state": "unknown"');
    expect(output()).toContain('"basis": "default"');
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });

  it('sets and shows an explicit annotation', async () => {
    await run(['knowledge', 'set', 'spec:auth-L1', '--state', 'current', '--reason', 'Reviewed now.', '--json']);
    expect(output()).toContain('"basis": "explicit"');
    expect(readFileSync(project.paths.knowledgeFile, 'utf8')).toContain('Reviewed now.');

    logSpy.mockClear();
    await run(['knowledge', 'show', 'spec:auth-L1']);
    expect(output()).toContain('state:       current');
    expect(output()).toContain('reviewedBy:  human');
  });

  it('requires replacement for superseded state', async () => {
    await expect(run([
      'knowledge', 'set', 'spec:auth-L1',
      '--state', 'superseded',
      '--reason', 'Old.',
    ])).rejects.toThrow(/KNOWLEDGE_REPLACEMENT_REQUIRED/);
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });

  it('rejects replacement cycle', async () => {
    createSpec({ paths: project.paths, code: 'next-L1', level: 'L1', title: 'Next', topic: 'next', parentCode: null });
    await run([
      'knowledge', 'set', 'spec:auth-L1',
      '--state', 'superseded', '--reason', 'Use next.', '--replacement', 'spec:next-L1',
    ]);
    await expect(run([
      'knowledge', 'set', 'spec:next-L1',
      '--state', 'superseded', '--reason', 'Use auth.', '--replacement', 'spec:auth-L1',
    ])).rejects.toThrow(/KNOWLEDGE_REPLACEMENT_CYCLE/);
  });

  it('rejects invalid states and missing sources', async () => {
    await expect(run([
      'knowledge', 'set', 'spec:auth-L1', '--state', 'fresh', '--reason', 'No.',
    ])).rejects.toThrow(/KNOWLEDGE_STATE_INVALID/);
    await expect(run(['knowledge', 'show', 'spec:missing-L1'])).rejects.toThrow(/KNOWLEDGE_SOURCE_NOT_FOUND/);
  });
});
