import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, writeSpec } from '../spec-io.js';
import {
  applyRepositoryRemediation,
  planRepositoryRemediation,
  REPOSITORY_REMEDIATION_V1,
  REPOSITORY_REMEDIATION_V1_DECISIONS,
  REPOSITORY_REMEDIATION_V1_TASKS,
} from '../remediation.js';
import { listDecisions } from '../decision.js';
import { readIntegrityExemptions } from '../integrity-exemptions.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-remediation-');
  seedMigrationTargets();
});

afterEach(() => {
  project.cleanup();
});

describe('repository remediation', () => {
  it('plans fixed decisions and exemptions without writing during dry-run', () => {
    const plan = planRepositoryRemediation({ paths: project.paths, packageRoot: process.cwd(), migrationId: REPOSITORY_REMEDIATION_V1 });
    expect(plan.decisions.filter(item => item.action === 'create')).toHaveLength(4);
    expect(plan.exemptions.filter(item => item.action === 'create')).toHaveLength(16);
    expect(plan.conflicts).toEqual([]);
    expect(existsSync(project.paths.integrityExemptionsFile)).toBe(false);
    expect(listDecisions(project.paths, { includeAll: true })).toEqual([]);
  });

  it('applies idempotently without changing terminal task bytes', () => {
    const before = taskBytes();
    const first = applyRepositoryRemediation({
      paths: project.paths,
      packageRoot: process.cwd(),
      migrationId: REPOSITORY_REMEDIATION_V1,
      now: '2026-06-08T00:00:00.000Z',
    });
    expect(first.decisions.filter(item => item.action === 'create')).toHaveLength(4);
    expect(first.exemptions.filter(item => item.action === 'create')).toHaveLength(16);
    expect(first.agentAssets.some(item => item.action === 'create')).toBe(true);
    expect(listDecisions(project.paths, { includeAll: true })).toHaveLength(4);
    expect(readIntegrityExemptions(project.paths).registry.exemptions).toHaveLength(16);
    expect(taskBytes()).toEqual(before);
    const second = applyRepositoryRemediation({ paths: project.paths, packageRoot: process.cwd(), migrationId: REPOSITORY_REMEDIATION_V1 });
    expect([...second.decisions, ...second.exemptions].every(item => item.action === 'skip')).toBe(true);
  });

  it('rejects unknown migrations and ineligible task targets before writing', () => {
    expect(() => planRepositoryRemediation({ paths: project.paths, packageRoot: process.cwd(), migrationId: 'unknown' })).toThrow('UNKNOWN_MIGRATION');
    const [specCode, taskId] = REPOSITORY_REMEDIATION_V1_TASKS[0];
    writeFileSync(taskPath(specCode, taskId), JSON.stringify({
      id: taskId,
      specCode,
      status: 'running',
      steps: [],
      created: '2026-06-01T00:00:00.000Z',
    }), 'utf8');
    expect(() => applyRepositoryRemediation({ paths: project.paths, packageRoot: process.cwd(), migrationId: REPOSITORY_REMEDIATION_V1 })).toThrow('REMEDIATION_CONFLICT');
    expect(listDecisions(project.paths, { includeAll: true })).toEqual([]);
  });
});

function seedMigrationTargets(): void {
  for (const input of REPOSITORY_REMEDIATION_V1_DECISIONS) {
    const spec = createSpec({ paths: project.paths, code: input.docCode, level: 'L1', title: input.docCode, topic: input.topic, parentCode: null });
    writeSpec({ ...spec, fm: { ...spec.fm, status: 'implemented' } });
  }
  for (const [specCode, taskId] of REPOSITORY_REMEDIATION_V1_TASKS) {
    const topic = specCode.slice(0, specCode.indexOf('-L3'));
    mkdirSync(join(project.paths.specsDir, topic, 'tasks'), { recursive: true });
    writeFileSync(taskPath(specCode, taskId), JSON.stringify({
      id: taskId,
      specCode,
      status: 'completed',
      steps: [{ stepNo: 1, stepType: 'tool_action', name: 'legacy', status: 'succeeded' }],
      created: '2026-06-01T00:00:00.000Z',
    }), 'utf8');
  }
}

function taskPath(specCode: string, taskId: string): string {
  const topic = specCode.slice(0, specCode.indexOf('-L3'));
  return join(project.paths.specsDir, topic, 'tasks', `${specCode}-${taskId}.json`);
}

function taskBytes(): Record<string, string> {
  return Object.fromEntries(REPOSITORY_REMEDIATION_V1_TASKS.map(([specCode, taskId]) => [
    `${specCode}:${taskId}`,
    readFileSync(taskPath(specCode, taskId), 'utf8'),
  ]));
}
