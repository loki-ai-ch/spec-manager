import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { installAgentSupport, parseAgentProviders } from '../agents.js';

let root: string;
let packageRoot: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-agent-target-'));
  packageRoot = mkdtempSync(join(tmpdir(), 'spec-mgr-agent-package-'));
  paths = getPaths(root);
  writePackageAsset('templates/agents/AGENTS.md', '# AGENTS\n');
  writePackageAsset('templates/agents/CLAUDE.md', '# CLAUDE\n');
  writePackageAsset('templates/agents/CODEBUDDY.md', '# CODEBUDDY\n');
  writePackageAsset('templates/agents/codebuddy-skill/SKILL.md', '---\nname: spec-manager\n---\n');
  writePackageAsset('skill/SKILL.md', '# Skill\n');
  writePackageAsset('skill/subskills/prd.md', '# PRD\n');
  writePackageAsset('rules/flow-control.md', '# Rules\n');
  writePackageAsset('templates/L1-prd.md', '# L1\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(packageRoot, { recursive: true, force: true });
});

function writePackageAsset(relPath: string, content: string): void {
  const filePath = join(packageRoot, ...relPath.split('/'));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

describe('parseAgentProviders', () => {
  it('normalizes provider aliases', () => {
    expect(parseAgentProviders('claude-code,codex,open code,code buddy')).toEqual([
      'claude',
      'codex',
      'opencode',
      'codebuddy',
    ]);
  });

  it('treats empty input as all', () => {
    expect(parseAgentProviders('')).toEqual(['all']);
  });
});

describe('installAgentSupport', () => {
  it('installs all supported agent assets', () => {
    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('all'),
    });

    expect(report.providers).toEqual(['claude', 'codex', 'opencode', 'codebuddy']);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(root, 'CODEBUDDY.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', 'spec-manager', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', 'spec-manager', 'rules', 'flow-control.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', 'spec-manager', 'templates', 'L1-prd.md'))).toBe(true);
    expect(existsSync(join(root, '.codebuddy', 'skills', 'spec-manager', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.codebuddy', 'skills', 'spec-manager', 'subskills', 'prd.md'))).toBe(true);
    expect(existsSync(join(root, '.codebuddy', 'skills', 'spec-manager', 'rules', 'flow-control.md'))).toBe(true);
    expect(report.created.filter((p) => p === 'AGENTS.md')).toHaveLength(1);
  });

  it('skips existing files unless force is set', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# existing\n', 'utf8');

    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('codex'),
    });

    expect(report.skipped).toContain('AGENTS.md');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# existing\n');
  });

  it('overwrites existing files when force is set', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# existing\n', 'utf8');

    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('codex'),
      force: true,
    });

    expect(report.overwritten).toContain('AGENTS.md');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# AGENTS\n');
  });
});
