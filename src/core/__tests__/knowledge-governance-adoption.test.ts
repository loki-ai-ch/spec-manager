import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProject, type TestProject } from './project-fixture.js';
import {
  enableKnowledgeGovernance,
  isKnowledgeGovernedCreatedAt,
  previewKnowledgeGovernance,
  readKnowledgeGovernanceConfig,
} from '../knowledge-governance-adoption.js';
import { createSpec, findSpecByCode, updateSpec } from '../spec-io.js';
import { validateKnowledgeGovernanceTransition } from '../spec-policy.js';

let project: TestProject;
beforeEach(() => {
  project = createTestProject('knowledge-governance-adoption-');
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
});
afterEach(() => project.cleanup());

describe('knowledge governance adoption', () => {
  it('previews without writing configuration', () => {
    const before = readFileSync(project.paths.configFile, 'utf8');
    expect(previewKnowledgeGovernance(project.paths)).toMatchObject({
      current: { enabled: false },
      writes: false,
    });
    expect(readFileSync(project.paths.configFile, 'utf8')).toBe(before);
  });

  it('persists an explicit baseline and classifies only later assets', () => {
    const baseline = new Date('2026-07-16T10:00:00.000Z');
    enableKnowledgeGovernance(project.paths, baseline);
    expect(readKnowledgeGovernanceConfig(project.paths)).toMatchObject({
      enabled: true,
      enabledAt: baseline.toISOString(),
    });
    expect(isKnowledgeGovernedCreatedAt(project.paths, '2026-07-16T09:59:59.999Z')).toBe(false);
    expect(isKnowledgeGovernedCreatedAt(project.paths, '2026-07-16T10:00:00.001Z')).toBe(true);
  });

  it('requires governance declarations only for assets created after enablement', () => {
    createSpec({ paths: project.paths, code: 'new-L1', level: 'L1', title: 'New', topic: 'new', parentCode: null });
    updateSpec(project.paths, 'new-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'new-L2.1', level: 'L2', title: 'Design', topic: 'new', parentCode: 'new-L1' });
    updateSpec(project.paths, 'new-L2.1', { status: 'confirmed' });
    enableKnowledgeGovernance(project.paths, new Date('2026-07-16T10:00:00.000Z'));
    const l1 = findSpecByCode(project.paths, 'new-L1')!;
    l1.fm.created = '2026-07-16T10:00:00.001Z';
    expect(() => validateKnowledgeGovernanceTransition(project.paths, l1, 'confirmed'))
      .toThrow('HISTORY_REVIEW_REQUIRED');
    createSpec({ paths: project.paths, code: 'new-L3.1.1', level: 'L3', title: 'Impl', topic: 'new', parentCode: 'new-L2.1' });
    const l3 = findSpecByCode(project.paths, 'new-L3.1.1')!;
    l3.fm.created = '2026-07-16T10:00:00.001Z';
    expect(() => validateKnowledgeGovernanceTransition(project.paths, l3, 'frozen'))
      .toThrow('DELIVERY_LEARNING_POLICY_REQUIRED');
  });
});
