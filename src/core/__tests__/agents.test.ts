import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProjectPaths } from '../paths.js';
import { detectAgentProviders, installAgentSupport, listAgentProviders, parseAgentProviders } from '../agents.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let root: string;
let packageRoot: string;
let paths: ProjectPaths;
let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-agent-target-', { initialized: false });
  root = project.root;
  packageRoot = mkdtempSync(join(tmpdir(), 'spec-mgr-agent-package-'));
  paths = project.paths;
  writePackageAsset('templates/agents/AGENTS.md', '# AGENTS\n');
  writePackageAsset('templates/agents/CLAUDE.md', '# CLAUDE\n');
  writePackageAsset('templates/agents/CODEBUDDY.md', '# CODEBUDDY\n');
  writePackageAsset('templates/agents/CURSOR.md', '# CURSOR\n');
  writePackageAsset('templates/agents/WINDSURF.md', '# WINDSURF\n');
  writePackageAsset('templates/agents/codebuddy-skill/SKILL.md', '---\nname: spec-manager\n---\n');
  writePackageAsset('skill/SKILL.md', '# Skill\n');
  writePackageAsset('skill/subskills/prd.md', '# PRD\n');
  writePackageAsset('rules/flow-control.md', '# Rules\n');
  writePackageAsset('templates/L1-prd.md', '# L1\n');
});

afterEach(() => {
  project.cleanup();
  rmSync(packageRoot, { recursive: true, force: true });
});

function writePackageAsset(relPath: string, content: string): void {
  const filePath = join(packageRoot, ...relPath.split('/'));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

describe('parseAgentProviders', () => {
  it('normalizes provider aliases', () => {
    expect(parseAgentProviders('claude-code,codex,open code,code buddy,cursor,windsurf')).toEqual([
      'claude',
      'codex',
      'opencode',
      'codebuddy',
      'cursor',
      'windsurf',
    ]);
  });

  it('treats empty input as all', () => {
    expect(parseAgentProviders('')).toEqual(['all']);
  });
});

describe('listAgentProviders', () => {
  it('describes supported provider files and aliases', () => {
    const providers = listAgentProviders();
    expect(providers.map((p) => p.provider)).toEqual([
      'claude',
      'codex',
      'opencode',
      'codebuddy',
      'cursor',
      'windsurf',
    ]);
    expect(providers.find((p) => p.provider === 'codex')?.files).toContain('AGENTS.md');
    expect(providers.find((p) => p.provider === 'codebuddy')?.aliases).toContain('code buddy');
    expect(providers.find((p) => p.provider === 'cursor')?.files).toContain('.cursorrules');
    expect(providers.find((p) => p.provider === 'windsurf')?.files).toContain('.windsurfrules');
  });
});

describe('installAgentSupport', () => {
  it('installs all supported agent assets', () => {
    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('all'),
    });

    expect(report.providers).toEqual(['claude', 'codex', 'opencode', 'codebuddy', 'cursor', 'windsurf']);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(root, 'CODEBUDDY.md'))).toBe(true);
    expect(existsSync(join(root, '.cursorrules'))).toBe(true);
    expect(existsSync(join(root, '.windsurfrules'))).toBe(true);
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

  it('plans writes without touching the filesystem in dry-run mode', () => {
    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('claude,codex,cursor,windsurf'),
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.created).toContain('CLAUDE.md');
    expect(report.created).toContain('.claude/skills/spec-manager');
    expect(report.created).toContain('AGENTS.md');
    expect(report.created).toContain('.cursorrules');
    expect(report.created).toContain('.windsurfrules');
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(root, '.claude'))).toBe(false);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(root, '.cursorrules'))).toBe(false);
    expect(existsSync(join(root, '.windsurfrules'))).toBe(false);
  });

  it('reports dry-run overwrites without changing existing files', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# existing\n', 'utf8');

    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('codex'),
      force: true,
      dryRun: true,
    });

    expect(report.overwritten).toContain('AGENTS.md');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# existing\n');
  });
});

describe('detectAgentProviders', () => {
  it('returns no providers for an empty project', () => {
    const detected = detectAgentProviders(paths);

    expect(detected.providers).toEqual([]);
    expect(detected.reasons).toEqual({});
  });

  it('detects claude from the installed skill directory', () => {
    mkdirSync(join(root, '.claude', 'skills', 'spec-manager'), { recursive: true });

    const detected = detectAgentProviders(paths);

    expect(detected.providers).toEqual(['claude']);
    expect(detected.reasons.claude).toContain('.claude/skills/spec-manager');
  });

  it('detects AGENTS.md as codex and opencode', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# rules\n', 'utf8');

    const detected = detectAgentProviders(paths);

    expect(detected.providers).toEqual(['codex', 'opencode']);
    expect(detected.reasons.codex).toContain('AGENTS.md');
    expect(detected.reasons.opencode).toContain('AGENTS.md');
  });

  it('detects codebuddy cursor and windsurf markers', () => {
    writeFileSync(join(root, 'CODEBUDDY.md'), '# rules\n', 'utf8');
    writeFileSync(join(root, '.cursorrules'), '# rules\n', 'utf8');
    writeFileSync(join(root, '.windsurfrules'), '# rules\n', 'utf8');

    const detected = detectAgentProviders(paths);

    expect(detected.providers).toEqual(['codebuddy', 'cursor', 'windsurf']);
    expect(detected.reasons.codebuddy).toContain('CODEBUDDY.md');
    expect(detected.reasons.cursor).toContain('.cursorrules');
    expect(detected.reasons.windsurf).toContain('.windsurfrules');
  });

  it('keeps provider order and deduplicates multiple markers for one provider', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# rules\n', 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), '# rules\n', 'utf8');
    mkdirSync(join(root, '.claude', 'skills', 'spec-manager'), { recursive: true });
    writeFileSync(join(root, '.windsurfrules'), '# rules\n', 'utf8');

    const detected = detectAgentProviders(paths);

    expect(detected.providers).toEqual(['claude', 'codex', 'opencode', 'windsurf']);
    expect(detected.reasons.claude).toEqual(['CLAUDE.md', '.claude/skills/spec-manager']);
  });
});

describe('agent entry templates', () => {
  const templatePaths = [
    'templates/agents/AGENTS.md',
    'templates/agents/CLAUDE.md',
    'templates/agents/CODEBUDDY.md',
    'templates/agents/CURSOR.md',
    'templates/agents/WINDSURF.md',
    'templates/agents/codebuddy-skill/SKILL.md',
    'skill/SKILL.md',
  ];

  it.each(templatePaths)('%s includes unified workflow rules', (relPath) => {
    const content = readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf8');

    expect(content).toContain('coveredSpecs');
    expect(content).toContain('spec validate-plan --from-spec');
    expect(content).toContain('task step');
    expect(content).toContain('task complete');
    expect(content).toContain('frozen L3');
    expect(content).toContain('explicit user approval');
    expect(content).toContain('one explicit L3 approval');
    expect(content).not.toContain('confirmed -> frozen` require explicit user approval');
  });
});
