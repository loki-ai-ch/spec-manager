import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildDocsConsistencyReport } from '../docs-consistency.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-docs-consistency-');
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('buildDocsConsistencyReport', () => {
  it('reports missing README as an error', () => {
    const report = buildDocsConsistencyReport(project.paths);

    expect(report.schemaVersion).toBe('docs-consistency.v1');
    expect(report.summary.errors).toBe(1);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'docs.readme.primary.missing', severity: 'error' }),
    ]));
  });

  it('reports missing english target when README links it', () => {
    writeFileSync(join(project.root, 'README.md'), '中文 | [English](readme_en.md)\n', 'utf8');

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary.errors).toBe(1);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'docs.readme.english-target.missing', severity: 'error', path: 'readme_en.md' }),
    ]));
  });

  it('reports package files warning for linked public docs', () => {
    writeFileSync(join(project.root, 'README.md'), '中文 | [English](readme_en.md)\n\n[Guide](docs/guide.md)\n', 'utf8');
    writeFileSync(join(project.root, 'readme_en.md'), '[中文说明](README.md)\n', 'utf8');
    mkdirSync(join(project.root, 'docs'), { recursive: true });
    writeFileSync(join(project.root, 'docs', 'guide.md'), '# Guide\n', 'utf8');
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(1);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'docs.package.files.missing-linked-doc',
        severity: 'warning',
        detail: expect.stringContaining('docs/guide.md'),
      }),
    ]));
  });

  it('reports skill and template guidance warnings with paths', () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, 'skill'), { recursive: true });
    writeFileSync(join(project.root, 'skill', 'SKILL.md'), '# spec-manager\nWorkflow only.\n', 'utf8');
    mkdirSync(join(project.root, 'templates', 'agents'), { recursive: true });
    writeFileSync(join(project.root, 'templates', 'agents', 'AGENTS.md'), '# spec-manager\nWorkflow only.\n', 'utf8');
    mkdirSync(join(project.root, 'templates', 'agents', 'codebuddy-skill'), { recursive: true });
    writeFileSync(join(project.root, 'templates', 'agents', 'codebuddy-skill', 'SKILL.md'), '# spec-manager\n', 'utf8');

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary.errors).toBe(0);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'docs.skill.guidance.missing', path: 'skill/SKILL.md' }),
      expect.objectContaining({
        id: 'docs.agent-template.guidance.missing',
        path: 'templates/agents/AGENTS.md',
      }),
      expect.objectContaining({
        id: 'docs.agent-template.guidance.missing',
        path: 'templates/agents/codebuddy-skill/SKILL.md',
      }),
    ]));
  });

  it('returns no findings for consistent docs and guidance', () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, 'skill'), { recursive: true });
    writeFileSync(join(project.root, 'skill', 'SKILL.md'), healthyGuidance(), 'utf8');
    mkdirSync(join(project.root, 'templates', 'agents'), { recursive: true });
    writeFileSync(join(project.root, 'templates', 'agents', 'AGENTS.md'), healthyGuidance(), 'utf8');
    writeFileSync(join(project.root, 'templates', 'agents', 'CLAUDE.md'), healthyGuidance(), 'utf8');
    mkdirSync(join(project.root, 'templates', 'agents', 'codebuddy-skill'), { recursive: true });
    writeFileSync(join(project.root, 'templates', 'agents', 'codebuddy-skill', 'SKILL.md'), healthyGuidance(), 'utf8');

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary).toEqual({ errors: 0, warnings: 0, infos: 0 });
    expect(report.findings).toEqual([]);
  });

  it('reports generated agent asset directories as info', () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, '.agents'), { recursive: true });

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary).toEqual({ errors: 0, warnings: 0, infos: 1 });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'docs.generated-assets.present',
        severity: 'info',
        path: '.agents',
        detail: expect.stringContaining('local Agent output'),
      }),
    ]));
  });

  it('reports generated agent assets included in package files as warning', () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({
      files: ['README.md', 'readme_en.md', '.agents/**'],
    }), 'utf8');
    mkdirSync(join(project.root, '.agents'), { recursive: true });

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary).toEqual({ errors: 0, warnings: 1, infos: 0 });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'docs.generated-assets.package-files-risk',
        severity: 'warning',
        path: 'package.json',
        suggestion: expect.stringContaining('Remove ".agents"'),
      }),
    ]));
  });

  it('reports risky inline gh release notes as info', () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, 'docs'), { recursive: true });
    writeFileSync(
      join(project.root, 'docs', 'release.md'),
      '```bash\ngh release create v1.0.0 --notes "Fix `spec-manager` docs"\n```\n',
      'utf8',
    );

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.summary).toEqual({ errors: 0, warnings: 0, infos: 1 });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'docs.release-notes.inline-risk',
        severity: 'info',
        path: 'docs/release.md',
        suggestion: expect.stringContaining('--notes-file'),
      }),
    ]));
  });

  it('does not report release inline risk for notes-file guidance', () => {
    writeHealthyReadmes();
    writeFileSync(join(project.root, 'package.json'), JSON.stringify({ files: ['README.md', 'readme_en.md'] }), 'utf8');
    mkdirSync(join(project.root, 'docs'), { recursive: true });
    writeFileSync(
      join(project.root, 'docs', 'release.md'),
      '```bash\ngh release create v1.0.0 --notes-file releases/v1.0.0-release.md\n```\n',
      'utf8',
    );

    const report = buildDocsConsistencyReport(project.paths);

    expect(report.findings.some(finding => finding.id === 'docs.release-notes.inline-risk')).toBe(false);
  });
});

function writeHealthyReadmes(): void {
  writeFileSync(join(project.root, 'README.md'), '中文 | [English](readme_en.md)\n', 'utf8');
  writeFileSync(join(project.root, 'readme_en.md'), '[中文说明](README.md)\n', 'utf8');
}

function healthyGuidance(): string {
  return [
    'Use spec-manager for L1 -> L2 -> L3 -> Agent Task.',
    'Before writes run spec-manager project context --json and confirm writeRoot.',
    'Before release run spec-manager project docs check.',
    'For UI work read specs/DESIGN.md in the resolved write root.',
    'Before handoff run spec-manager assist acceptance and spec-manager assist delivery.',
  ].join('\n');
}
