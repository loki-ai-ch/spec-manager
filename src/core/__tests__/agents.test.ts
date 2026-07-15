import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProjectPaths } from '../paths.js';
import {
  detectAgentProviders,
  inspectManagedAgentAssets,
  installAgentPlatformSupport,
  installAgentSupport,
  listAgentPlatforms,
  listAgentProviders,
  mergeMissingDirectories,
  normalizeAgentPlatform,
  parseAgentProviders,
} from '../agents.js';
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
    expect(parseAgentProviders('claude-code,codex,open code,mimo-code,mimo code,mimo,code buddy,cursor,windsurf')).toEqual([
      'claude',
      'codex',
      'opencode',
      'mimocode',
      'mimocode',
      'mimocode',
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
      'mimocode',
      'codebuddy',
      'cursor',
      'windsurf',
    ]);
    expect(providers.find((p) => p.provider === 'codex')?.files).toContain('AGENTS.md');
    expect(providers.find((p) => p.provider === 'mimocode')?.files).toContain('AGENTS.md');
    expect(providers.find((p) => p.provider === 'mimocode')?.aliases).toContain('mimo-code');
    expect(providers.find((p) => p.provider === 'codebuddy')?.aliases).toContain('code buddy');
    expect(providers.find((p) => p.provider === 'cursor')?.files).toContain('.cursorrules');
    expect(providers.find((p) => p.provider === 'windsurf')?.files).toContain('.windsurfrules');
  });
});

describe('agent platform registry', () => {
  it('normalizes platform aliases and resolves targets', () => {
    expect(normalizeAgentPlatform('claude-code')).toMatchObject({ platform: 'claude', target: 'claude' });
    expect(normalizeAgentPlatform('trae cn')).toMatchObject({ platform: 'trae-cn', target: 'codex' });
    expect(normalizeAgentPlatform('kimi')).toMatchObject({ platform: 'kimi', target: 'codex' });
    expect(normalizeAgentPlatform('agents')).toMatchObject({ platform: 'agents', target: 'all' });
    expect(normalizeAgentPlatform('skills')).toMatchObject({ platform: 'skills', target: 'all' });
  });

  it('lists graphify-style platform commands', () => {
    expect(listAgentPlatforms().map((platform) => platform.command)).toEqual([
      'claude',
      'codebuddy',
      'codex',
      'opencode',
      'kilo',
      'copilot',
      'vscode',
      'aider',
      'claw',
      'droid',
      'trae',
      'trae-cn',
      'cursor',
      'gemini',
      'hermes',
      'kimi',
      'amp',
      'agents',
      'skills',
      'kiro',
      'pi',
      'devin',
      'antigravity',
      'mimocode',
      'windsurf',
    ]);
  });

  it('installs fallback platforms through codex with fallback notes', () => {
    const report = installAgentPlatformSupport({
      paths,
      packageRoot,
      platform: 'kilo',
      dryRun: true,
    });

    expect(report.providers).toEqual(['codex']);
    expect(report.created).toContain('AGENTS.md');
    expect(report.notes).toContain('Kilo Code uses AGENTS-compatible fallback instructions.');
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('resolves agents and skills platforms to all providers', () => {
    expect(installAgentPlatformSupport({ paths, packageRoot, platform: 'agents', dryRun: true }).providers)
      .toEqual(['claude', 'codex', 'opencode', 'mimocode', 'codebuddy', 'cursor', 'windsurf']);
    expect(installAgentPlatformSupport({ paths, packageRoot, platform: 'skills', dryRun: true }).providers)
      .toEqual(['claude', 'codex', 'opencode', 'mimocode', 'codebuddy', 'cursor', 'windsurf']);
  });

  it('reports unsupported platforms with supported command names', () => {
    expect(() => normalizeAgentPlatform('unknown')).toThrow('unsupported AI platform: unknown');
    expect(() => normalizeAgentPlatform('unknown')).toThrow('trae-cn');
  });
});

describe('installAgentSupport', () => {
  it('installs all supported agent assets', () => {
    const report = installAgentSupport({
      paths,
      packageRoot,
      providers: parseAgentProviders('all'),
    });

    expect(report.providers).toEqual(['claude', 'codex', 'opencode', 'mimocode', 'codebuddy', 'cursor', 'windsurf']);
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
    expect(report.created).toContain('.claude/skills/spec-manager/SKILL.md');
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

  it('syncs managed directory files without deleting extra custom files', () => {
    installAgentSupport({ paths, packageRoot, providers: parseAgentProviders('claude') });
    writeFileSync(join(root, '.claude', 'skills', 'spec-manager', 'custom.md'), '# custom\n', 'utf8');
    writeFileSync(join(root, '.claude', 'skills', 'spec-manager', 'SKILL.md'), '# stale\n', 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), '# user instructions\n', 'utf8');

    const report = installAgentSupport({ paths, packageRoot, providers: parseAgentProviders('claude'), syncManaged: true });

    expect(report.overwritten).toContain('.claude/skills/spec-manager/SKILL.md');
    expect(readFileSync(join(root, '.claude', 'skills', 'spec-manager', 'custom.md'), 'utf8')).toBe('# custom\n');
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toBe('# user instructions\n');
  });
});

describe('inspectManagedAgentAssets', () => {
  it('reports missing and drifted managed files while ignoring custom extras', () => {
    installAgentSupport({ paths, packageRoot, providers: parseAgentProviders('claude') });
    writeFileSync(join(root, '.claude', 'skills', 'spec-manager', 'SKILL.md'), '# stale\n', 'utf8');
    rmSync(join(root, '.claude', 'skills', 'spec-manager', 'rules', 'flow-control.md'));
    writeFileSync(join(root, '.claude', 'skills', 'spec-manager', 'custom.md'), '# custom\n', 'utf8');

    const result = inspectManagedAgentAssets(paths, packageRoot, ['claude']);

    expect(result.drifted).toContain('.claude/skills/spec-manager/SKILL.md');
    expect(result.missing).toContain('.claude/skills/spec-manager/rules/flow-control.md');
    expect([...result.drifted, ...result.missing]).not.toContain('.claude/skills/spec-manager/custom.md');
  });
});

describe('mergeMissingDirectories', () => {
  it('creates only missing files and preserves existing files', () => {
    writePackageAsset('rules/quality-gate.md', '# Quality\n');
    mkdirSync(join(root, '.claude', 'skills', 'spec-manager', 'rules'), { recursive: true });
    writeFileSync(join(root, '.claude', 'skills', 'spec-manager', 'rules', 'flow-control.md'), '# custom\n', 'utf8');

    const report = mergeMissingDirectories({
      paths,
      packageRoot,
      directories: [{ source: 'rules', target: '.claude/skills/spec-manager/rules' }],
    });

    expect(report.skipped).toContain('.claude/skills/spec-manager/rules/flow-control.md');
    expect(readFileSync(join(root, '.claude', 'skills', 'spec-manager', 'rules', 'flow-control.md'), 'utf8')).toBe('# custom\n');
    expect(existsSync(join(root, '.claude', 'skills', 'spec-manager', 'rules', 'quality-gate.md'))).toBe(true);
  });

  it('dry-runs per-file creates without writing', () => {
    const report = mergeMissingDirectories({
      paths,
      packageRoot,
      directories: [{ source: 'templates', target: '.claude/skills/spec-manager/templates' }],
      dryRun: true,
    });
    expect(report.created).toContain('.claude/skills/spec-manager/templates/L1-prd.md');
    expect(existsSync(join(root, '.claude', 'skills', 'spec-manager', 'templates'))).toBe(false);
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

  it('detects AGENTS.md as codex opencode and mimocode', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# rules\n', 'utf8');

    const detected = detectAgentProviders(paths);

    expect(detected.providers).toEqual(['codex', 'opencode', 'mimocode']);
    expect(detected.reasons.codex).toContain('AGENTS.md');
    expect(detected.reasons.opencode).toContain('AGENTS.md');
    expect(detected.reasons.mimocode).toContain('AGENTS.md');
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

    expect(detected.providers).toEqual(['claude', 'codex', 'opencode', 'mimocode', 'windsurf']);
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
