import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-reconcile-');
  oldRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  if (oldRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
  else process.env.SPEC_MANAGER_ROOT = oldRoot;
  logSpy.mockRestore();
  project.cleanup();
});

describe('project reconcile CLI', () => {
  it('prints a dry-run plan and blocked fixed targets without writing', async () => {
    const program = new Command();
    program.exitOverride();
    registerProject(program);
    await program.parseAsync(['project', 'reconcile', '--dry-run'], { from: 'user' });
    const output = logSpy.mock.calls.map(call => String(call[0])).join('\n');
    expect(output).toContain('Lifecycle reconciliation planned');
    expect(output).toContain('blocked:');
  });
});
