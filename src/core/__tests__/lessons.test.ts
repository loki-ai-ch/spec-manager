import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createDecision } from '../decision.js';
import { buildLessonsReport } from '../lessons.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask, reportStep, startTask } from '../task.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-lessons-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('buildLessonsReport', () => {
  it('returns advisory when no lessons are available', () => {
    const report = buildLessonsReport(project.paths, { topic: 'auth' });

    expect(report.schemaVersion).toBe('lessons.v1');
    expect(report.lessons).toEqual([]);
    expect(report.findings).toEqual([
      expect.objectContaining({ id: 'lessons.none', severity: 'advisory' }),
    ]);
  });

  it('collects active decisions and failed task output for a topic', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createDecision({
      paths: project.paths,
      docCode: 'auth-L1',
      topic: 'auth',
      what: 'Use assist brief before implementation',
      why: 'It keeps local context visible.',
      affectedCriteria: ['AC-1'],
    });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', { status: 'frozen' });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [
          { stepNo: 1, stepType: 'tool_action', name: '验证 auth failure' },
          { stepNo: 2, stepType: 'tool_action', name: '验证 npm test' },
        ],
      },
    });
    startTask(project.paths, task.id, 'auth-L3.1.1');
    reportStep({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      taskId: task.id,
      stepNo: 1,
      status: 'failed',
      outputJson: '{"summary":"Token check failed"}',
    });

    const report = buildLessonsReport(project.paths, { topic: 'auth', request: 'auth token work' });

    expect(report.findings).toEqual([]);
    expect(report.lessons.map(lesson => lesson.id)).toContain('decision:DC-001');
    expect(report.lessons.map(lesson => lesson.id)).toContain('task:auth-L3.1.1:T-001');
    expect(report.lessons.find(lesson => lesson.id.startsWith('task:'))?.detail).toContain('Token check failed');
  });
});
