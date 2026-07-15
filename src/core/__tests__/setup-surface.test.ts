import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildSetupSurface } from '../setup-surface.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-setup-surface-');
  writeFileSync(project.paths.configFile, 'project_name: setup-test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('buildSetupSurface', () => {
  it('builds a not-initialized projection without writing files', () => {
    const uninitialized = createTestProject('spec-mgr-setup-surface-uninit-', { initialized: false });
    try {
      const projection = buildSetupSurface(uninitialized.paths, { request: 'add auth' });

      expect(projection.schemaVersion).toBe('setup.v1');
      expect(projection.initialized).toBe(false);
      expect(projection.projectRoot).toBe(uninitialized.root);
      expect(projection.executionRoot).toBe(uninitialized.root);
      expect(projection.writeRoot).toBe(uninitialized.root);
      expect(projection.uxProfile).toBe('core');
      expect(projection.workflowProfile).toEqual({ enabled: false, defaultProfile: 'standard' });
      expect(projection.nextAction).toContain('project init');
      expect(projection.suggestedCommands).toContain('spec-manager project init --name <project-name>');
    } finally {
      uninitialized.cleanup();
    }
  });

  it('keeps local write root compatibility without specStore', () => {
    const projection = buildSetupSurface(project.paths);

    expect(projection.initialized).toBe(true);
    expect(projection.executionRoot).toBe(project.root);
    expect(projection.writeRoot).toBe(project.root);
    expect(projection.writeStore).toMatchObject({ id: 'local', mode: 'write', initialized: true });
    expect(projection.contextSources).toEqual([]);
    expect(projection.diagnostics).toEqual([]);
  });

  it('projects external write root and read-only context sources', () => {
    const writeStore = createInitializedStore('product-specs');
    const contextSource = createInitializedStore('platform-specs');
    writeFileSync(project.paths.configFile, [
      'project_name: app-repo',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      'contextSources:',
      '  - id: platform-specs',
      '    path: ../platform-specs',
      '',
    ].join('\n'), 'utf8');

    const projection = buildSetupSurface(project.paths);

    expect(projection.executionRoot).toBe(project.root);
    expect(projection.writeRoot).toBe(writeStore);
    expect(projection.writeStore.id).toBe('product-planning');
    expect(projection.contextSources).toEqual([
      expect.objectContaining({ id: 'platform-specs', path: contextSource, mode: 'read' }),
    ]);
  });

  it('returns blocking diagnostics for a broken write root', () => {
    writeFileSync(project.paths.configFile, [
      'project_name: app-repo',
      'specStore:',
      '  id: missing',
      '  path: ../missing-specs',
      '',
    ].join('\n'), 'utf8');

    const projection = buildSetupSurface(project.paths);

    expect(projection.writeRoot).toBe(join(project.root, '..', 'missing-specs'));
    expect(projection.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', code: 'store_path_missing' }),
    ]));
    expect(projection.blockingReason).toContain('store_path_missing');
    expect(projection.suggestedCommands).toContain('spec-manager project store doctor');
  });

  it('reports provider readiness with install suggestions but does not write files', () => {
    writeFileSync(join(project.root, 'AGENTS.md'), '# existing rules\n', 'utf8');

    const projection = buildSetupSurface(project.paths);
    const codex = projection.providers.find(provider => provider.provider === 'codex');
    const claude = projection.providers.find(provider => provider.provider === 'claude');

    expect(codex).toMatchObject({
      provider: 'codex',
      status: 'installed',
      files: ['AGENTS.md'],
      suggestedCommand: null,
    });
    expect(claude).toMatchObject({
      provider: 'claude',
      status: 'available',
      suggestedCommand: 'spec-manager project agents --provider claude',
    });
  });

  it('keeps uxProfile separate from task workflow profile', () => {
    writeFileSync(project.paths.configFile, [
      'project_name: setup-test',
      'uxProfile: advanced',
      '',
    ].join('\n'), 'utf8');
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'governed' });

    const projection = buildSetupSurface(project.paths);

    expect(projection.uxProfile).toBe('advanced');
    expect(projection.workflowProfile).toEqual({ enabled: true, defaultProfile: 'governed' });
    expect(projection.uxProfile).not.toBe(projection.workflowProfile.defaultProfile);
  });
});

function createInitializedStore(name: string): string {
  const root = join(project.root, '..', name);
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  return root;
}
