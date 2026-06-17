import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COMPLETION_SHELLS,
  completionInstallPath,
  generateCompletionScript,
  installCompletion,
  uninstallCompletions,
} from '../completion.js';

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'spec-manager-completion-core-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('completionInstallPath', () => {
  it('uses standard user completion paths', () => {
    expect(completionInstallPath('zsh', home)).toBe(join(home, '.zsh', 'completions', '_spec-manager'));
    expect(completionInstallPath('bash', home)).toBe(join(home, '.local', 'share', 'bash-completion', 'completions', 'spec-manager'));
    expect(completionInstallPath('fish', home)).toBe(join(home, '.config', 'fish', 'completions', 'spec-manager.fish'));
  });
});

describe('generateCompletionScript', () => {
  it.each(COMPLETION_SHELLS)('generates %s commands and dynamic spec hook', (shell) => {
    const script = generateCompletionScript(shell);

    expect(script).toContain('spec-manager');
    expect(script).toContain('completion');
    expect(script).toContain('zsh');
    expect(script).toContain('bash');
    expect(script).toContain('fish');
    expect(script).toContain('spec-manager spec list');
    expect(script).toContain('install');
    expect(script).toContain('uninstall');
    expect(script).toContain('assist');
    expect(script).toContain('guide');
    expect(script).toContain('brief');
    expect(script).toContain('acceptance');
    expect(script).toContain('delivery');
  });
});

describe('installCompletion / uninstallCompletions', () => {
  it('installs and removes completion files under the injected home', () => {
    const installed = COMPLETION_SHELLS.map((shell) => installCompletion(shell, home));

    for (const file of installed) {
      expect(file.startsWith(home)).toBe(true);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8')).toContain('spec-manager');
    }

    const result = uninstallCompletions(home);
    expect(result.removed).toEqual(installed);
    expect(result.missing).toEqual([]);
    for (const file of installed) expect(existsSync(file)).toBe(false);
  });

  it('reports missing completion files', () => {
    const result = uninstallCompletions(home);

    expect(result.removed).toEqual([]);
    expect(result.missing).toHaveLength(3);
  });
});
