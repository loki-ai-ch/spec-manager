import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { registerSpec } from '../spec.js';
import { registerTaskCommands } from '../task.js';
import { registerKnowledgeCommands } from '../knowledge.js';
import { findSpecByCode } from '../../core/spec-io.js';
import { findTask } from '../../core/task.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-architecture-', { initialized: false });
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
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
  registerSpec(program);
  registerTaskCommands(program);
  registerKnowledgeCommands(program);
  return program;
}

async function run(args: string[]): Promise<void> {
  await makeProgram().parseAsync(args, { from: 'user' });
}

function writeFixture(name: string, content: string): string {
  const fixtureDir = join(project.root, 'fixtures');
  mkdirSync(fixtureDir, { recursive: true });
  const filePath = join(fixtureDir, name);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

describe('architecture CLI smoke', () => {
  it('runs spec, task, verification evidence, completion cascade, and doctor through real CLI commands', async () => {
    await run(['project', 'init', '--name', 'architecture-smoke']);

    await run([
      'spec', 'new', 'L1',
      '--topic', 'architecture-smoke',
      '--code', 'architecture-smoke-L1',
      '--title', 'Architecture smoke',
    ]);
    await run([
      'spec', 'update', 'architecture-smoke-L1',
      '--content', writeFixture('l1.md', '# Architecture smoke\n\n## Goal\nExercise CLI architecture flow.\n'),
      '--ai-summary', 'architecture smoke PRD',
      '--change-summary', 'smoke fixture',
    ]);
    await run(['knowledge', 'show', 'spec:architecture-smoke-L1', '--json']);
    await run([
      'knowledge', 'set', 'spec:architecture-smoke-L1',
      '--state', 'current',
      '--reason', 'Architecture smoke explicit review.',
    ]);
    await run(['spec', 'confirm', 'architecture-smoke-L1']);

    await run([
      'spec', 'new', 'L2',
      '--topic', 'architecture-smoke',
      '--code', 'architecture-smoke-L2.1',
      '--title', 'Architecture smoke design',
      '--parent', 'architecture-smoke-L1',
    ]);
    await run([
      'spec', 'update', 'architecture-smoke-L2.1',
      '--content', writeFixture('l2.md', '# Architecture smoke design\n\n## Design\nUse CLI commands against an isolated project root.\n'),
      '--ai-summary', 'architecture smoke design',
      '--change-summary', 'smoke fixture',
    ]);
    await run(['spec', 'confirm', 'architecture-smoke-L2.1']);

    await run([
      'spec', 'new', 'L3',
      '--topic', 'architecture-smoke',
      '--code', 'architecture-smoke-L3.1.1-flow',
      '--title', 'Architecture smoke flow',
      '--parent', 'architecture-smoke-L2.1',
    ]);
    await run([
      'spec', 'update', 'architecture-smoke-L3.1.1-flow',
      '--content', writeFixture('l3.md', '# Architecture smoke flow\n\n## Implementation\nRun the CLI lifecycle in a temp project.\n'),
      '--ai-summary', 'architecture smoke implementation',
      '--change-summary', 'smoke fixture',
    ]);
    await run(['spec', 'confirm', 'architecture-smoke-L3.1.1-flow']);
    expect(findSpecByCode(project.paths, 'architecture-smoke-L3.1.1-flow')?.fm.status).toBe('frozen');

    const planFile = writeFixture('plan.json', JSON.stringify({
      coveredSpecs: ['architecture-smoke-L3.1.1-flow'],
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'exercise architecture smoke lifecycle' },
        { stepNo: 2, stepType: 'tool_action', name: '验证 architecture smoke lifecycle' },
      ],
    }, null, 2));
    await run(['task', 'create', 'architecture-smoke-L3.1.1-flow', '--plan', planFile]);
    await run(['task', 'start', 'T-001', '--spec', 'architecture-smoke-L3.1.1-flow']);
    await run([
      'task', 'step', 'T-001',
      '--spec', 'architecture-smoke-L3.1.1-flow',
      '--no', '1',
      '--status', 'succeeded',
      '--output-json', '{"summary":"architecture smoke step complete"}',
    ]);
    await run([
      'task', 'step', 'T-001',
      '--spec', 'architecture-smoke-L3.1.1-flow',
      '--no', '2',
      '--status', 'succeeded',
      '--output-json', '{"summary":"architecture smoke verification step complete"}',
    ]);
    await run([
      'task', 'verify', 'T-001',
      '--spec', 'architecture-smoke-L3.1.1-flow',
      '--command', 'architecture smoke',
      '--exit-code', '0',
      '--summary', 'smoke verification recorded',
      '--covers-ac', 'AC-1',
      '--layer', 'smoke',
    ]);
    await run([
      'task', 'complete', 'T-001',
      '--spec', 'architecture-smoke-L3.1.1-flow',
      '--skip-r18',
      '--skip-verification',
      '--skip-verify',
      '--reason', 'architecture smoke isolates lifecycle without external decisions or command execution',
    ]);
    await run(['project', 'doctor']);

    expect(findTask(project.paths, 'architecture-smoke-L3.1.1-flow', 'T-001')?.status).toBe('completed');
    expect(findSpecByCode(project.paths, 'architecture-smoke-L3.1.1-flow')?.fm.status).toBe('implemented');
    expect(findSpecByCode(project.paths, 'architecture-smoke-L2.1')?.fm.status).toBe('implemented');
    expect(findSpecByCode(project.paths, 'architecture-smoke-L1')?.fm.status).toBe('implemented');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
