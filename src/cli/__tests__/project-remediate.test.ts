import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { REPOSITORY_REMEDIATION_V1 } from '../../core/remediation.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-remediation-');
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

describe('project remediate CLI', () => {
  it('requires an explicit migration id', async () => {
    await expect(program().parseAsync(['project', 'remediate'], { from: 'user' })).rejects.toThrow();
  });

  it('rejects unknown migration ids', async () => {
    await expect(program().parseAsync(['project', 'remediate', '--migration', 'unknown', '--dry-run'], { from: 'user' })).rejects.toThrow('UNKNOWN_MIGRATION');
  });

  it('prints a dry-run plan without applying it', async () => {
    await program().parseAsync(['project', 'remediate', '--migration', REPOSITORY_REMEDIATION_V1, '--dry-run'], { from: 'user' });
    expect(output()).toContain('Repository remediation planned');
    expect(output()).toContain('conflicts:');
  });
});

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerProject(command);
  return command;
}

function output(): string {
  return logSpy.mock.calls.map(call => String(call[0])).join('\n');
}
