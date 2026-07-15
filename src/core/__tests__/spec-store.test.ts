import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPaths } from '../paths.js';
import { resolveSpecStore } from '../spec-store.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-store-');
  writeConfig(project, 'project_name: app\n');
});

afterEach(() => {
  project.cleanup();
});

describe('resolveSpecStore', () => {
  it('uses the current project root when specStore is not configured', () => {
    const resolution = resolveSpecStore(project.paths);

    expect(resolution.executionRoot).toBe(project.root);
    expect(resolution.writeRoot).toBe(project.root);
    expect(resolution.writeStore).toMatchObject({
      id: 'local',
      path: project.root,
      mode: 'write',
      exists: true,
      initialized: true,
    });
    expect(resolution.contextSources).toEqual([]);
    expect(resolution.diagnostics).toEqual([]);
  });

  it('resolves an external write store and read-only context sources', () => {
    const writeStore = createInitializedDir('product-specs');
    const contextSource = createInitializedDir('platform-specs');
    writeConfig(project, [
      'project_name: app',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      'contextSources:',
      '  - id: platform-specs',
      '    path: ../platform-specs',
      '',
    ].join('\n'));

    const resolution = resolveSpecStore(project.paths);

    expect(resolution.writeRoot).toBe(writeStore);
    expect(resolution.writeStore).toMatchObject({
      id: 'product-planning',
      path: writeStore,
      mode: 'write',
      exists: true,
      initialized: true,
    });
    expect(resolution.contextSources).toEqual([
      expect.objectContaining({
        id: 'platform-specs',
        path: contextSource,
        mode: 'read',
        exists: true,
        initialized: true,
      }),
    ]);
    expect(resolution.diagnostics).toEqual([]);
  });

  it('reports missing and uninitialized store paths without throwing', () => {
    const uninitialized = join(project.root, '..', 'uninitialized-specs');
    mkdirSync(uninitialized, { recursive: true });
    writeConfig(project, [
      'project_name: app',
      'specStore:',
      '  id: missing-store',
      '  path: ../missing-specs',
      'contextSources:',
      '  - id: uninitialized',
      '    path: ../uninitialized-specs',
      '',
    ].join('\n'));

    const resolution = resolveSpecStore(project.paths);

    expect(resolution.writeStore.exists).toBe(false);
    expect(resolution.contextSources[0]).toMatchObject({
      id: 'uninitialized',
      exists: true,
      initialized: false,
    });
    expect(resolution.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'store_path_missing',
      'store_not_initialized',
    ]);
  });

  it('reports duplicate ids and invalid modes', () => {
    const store = createInitializedDir('shared-specs');
    writeConfig(project, [
      'project_name: app',
      'specStore:',
      '  id: shared',
      '  path: ../shared-specs',
      '  mode: write',
      'contextSources:',
      '  - id: shared',
      '    path: ../shared-specs',
      '    mode: read',
      '  - id: invalid',
      '    path: ../shared-specs',
      '    mode: execute',
      '',
    ].join('\n'));

    const resolution = resolveSpecStore(project.paths);

    expect(resolution.writeRoot).toBe(store);
    expect(resolution.contextSources).toHaveLength(1);
    expect(resolution.diagnostics.map((diagnostic) => diagnostic.code)).toContain('store_mode_invalid');
    expect(resolution.diagnostics.map((diagnostic) => diagnostic.code)).toContain('store_id_duplicate');
  });

  it('reports YAML parse errors and falls back to local write root', () => {
    writeConfig(project, 'project_name: app\nspecStore: [');

    const resolution = resolveSpecStore(project.paths);

    expect(resolution.writeRoot).toBe(project.root);
    expect(resolution.writeStore.id).toBe('local');
    expect(resolution.diagnostics[0]).toMatchObject({ code: 'config_yaml_invalid', severity: 'error' });
  });

  it('does not change getPaths behavior', () => {
    const writeStore = createInitializedDir('product-specs');
    writeConfig(project, [
      'project_name: app',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      '',
    ].join('\n'));

    expect(resolveSpecStore(project.paths).writeRoot).toBe(writeStore);
    expect(getPaths(project.root).root).toBe(project.root);
    expect(getPaths(project.root).specsDir).toBe(join(project.root, 'specs'));
  });
});

function writeConfig(target: TestProject, content: string): void {
  writeFileSync(target.paths.configFile, content, 'utf8');
}

function createInitializedDir(name: string): string {
  const root = join(project.root, '..', name);
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  return root;
}
