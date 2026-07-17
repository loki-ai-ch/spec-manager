import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, findSpecByCode } from '../spec-io.js';
import { previewKnowledgeMigration } from '../knowledge-migration.js';

let project: TestProject;
beforeEach(() => {
  project = createTestProject('knowledge-migration-');
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
});
afterEach(() => project.cleanup());

describe('knowledge migration preview', () => {
  it('returns stable candidates without writing the registry or config', () => {
    const config = readFileSync(project.paths.configFile, 'utf8');
    const specPath = findSpecByCode(project.paths, 'auth-L1')!.filePath;
    const specBefore = readFileSync(specPath, 'utf8');
    const first = previewKnowledgeMigration(project.paths, { topic: 'auth', limit: 5 });
    const second = previewKnowledgeMigration(project.paths, { topic: 'auth', limit: 5 });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 'knowledge-migration-preview.v2', writes: false, readOnly: true,
      items: [{ sourceRef: 'spec:auth-L1', batch: 1 }],
      simulatedMetricsDelta: { validityUnknown: -1 },
    });
    expect(Object.keys(first.batches).sort()).toEqual([
      'critical-ac-readiness', 'decision-lifecycle', 'history-disposition', 'spec-validity', 'supersedes-relation',
    ]);
    expect(readFileSync(project.paths.configFile, 'utf8')).toBe(config);
    expect(readFileSync(specPath, 'utf8')).toBe(specBefore);
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });
});
