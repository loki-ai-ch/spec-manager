import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { completionInstallPath } from '../../core/completion.js';
import { registerCompletionCommands } from '../completion.js';

let home: string;
let oldHome: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'spec-manager-completion-cli-'));
  oldHome = process.env.SPEC_MANAGER_COMPLETION_HOME;
  process.env.SPEC_MANAGER_COMPLETION_HOME = home;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit:${code}`);
  });
});

afterEach(() => {
  if (oldHome === undefined) delete process.env.SPEC_MANAGER_COMPLETION_HOME;
  else process.env.SPEC_MANAGER_COMPLETION_HOME = oldHome;
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  rmSync(home, { recursive: true, force: true });
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerCompletionCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function stderr(): string {
  return errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

describe('completion CLI', () => {
  it.each(['zsh', 'bash', 'fish'] as const)('installs %s completion', async (shell) => {
    await makeProgram().parseAsync(['completion', 'install', shell], { from: 'user' });

    expect(existsSync(completionInstallPath(shell, home))).toBe(true);
    expect(output()).toContain(`${shell} completion installed`);
  });

  it('uninstalls all installed completion files', async () => {
    await makeProgram().parseAsync(['completion', 'install', 'zsh'], { from: 'user' });
    await makeProgram().parseAsync(['completion', 'install', 'fish'], { from: 'user' });

    await makeProgram().parseAsync(['completion', 'uninstall'], { from: 'user' });

    expect(existsSync(completionInstallPath('zsh', home))).toBe(false);
    expect(existsSync(completionInstallPath('fish', home))).toBe(false);
    expect(output()).toContain('shell completion removed');
  });

  it('rejects an unsupported shell', async () => {
    await expect(makeProgram().parseAsync(['completion', 'install', 'powershell'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('UNSUPPORTED_SHELL');
  });

  it('rejects uninstall when nothing is installed', async () => {
    await expect(makeProgram().parseAsync(['completion', 'uninstall'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('COMPLETION_NOT_INSTALLED');
  });
});
