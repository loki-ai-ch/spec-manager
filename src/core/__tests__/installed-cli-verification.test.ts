import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

let installedRoot: string;

beforeEach(() => {
  installedRoot = mkdtempSync(join(tmpdir(), 'spec-manager-installed-'));
  cpSync(resolve('dist'), join(installedRoot, 'dist'), { recursive: true });
});

afterEach(() => {
  rmSync(installedRoot, { recursive: true, force: true });
});

describe('verify-installed-cli', () => {
  it('passes only when the complete dist tree matches', () => {
    expect(runVerification()).toContain('matches current build');
  });

  it('fails for missing, extra, or changed dist files', () => {
    unlinkSync(join(installedRoot, 'dist', 'core', 'audit.js'));
    expect(() => runVerification()).toThrow(/INSTALLED_CLI_DRIFT/);

    cpSync(resolve('dist'), join(installedRoot, 'dist'), { recursive: true });
    writeFileSync(join(installedRoot, 'dist', 'extra.js'), 'extra\n', 'utf8');
    expect(() => runVerification()).toThrow(/INSTALLED_CLI_DRIFT/);

    rmSync(join(installedRoot, 'dist', 'extra.js'));
    writeFileSync(join(installedRoot, 'dist', 'core', 'audit.js'), 'changed\n', 'utf8');
    expect(() => runVerification()).toThrow(/INSTALLED_CLI_DRIFT/);
  });
});

function runVerification(): string {
  return execFileSync(process.execPath, [resolve('scripts/verify-installed-cli.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, SPEC_MANAGER_INSTALLED_ROOT: installedRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
