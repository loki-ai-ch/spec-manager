import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  formatKnowledgeSourceRef,
  parseKnowledgeSourceRef,
  readKnowledgeRegistry,
  resolveKnowledge,
  setKnowledgeAnnotation,
  validateKnowledgeSource,
} from '../knowledge.js';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, findSpecByCode, updateSpec, writeSpec } from '../spec-io.js';
import { createDecision, supersedeDecision } from '../decision.js';
import { createTask } from '../task.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-knowledge-');
});

afterEach(() => {
  project.cleanup();
});

describe('canonical knowledge source refs', () => {
  it('parses and formats every supported source kind', () => {
    const refs = [
      'spec:auth-L1',
      'decision:auth:DC-001',
      'task:auth-L3.1.1:T-001',
      'lesson:task:auth-L3.1.1:T-001',
      'lesson:decision:auth:DC-001',
      'lesson:incident:INC-20260716-001',
      'ac:auth-L1:AC-1',
    ];
    expect(refs.map(ref => formatKnowledgeSourceRef(parseKnowledgeSourceRef(ref)))).toEqual(refs);
  });

  it('rejects malformed composite identities', () => {
    expect(() => parseKnowledgeSourceRef('decision:missing-topic')).toThrow(/KNOWLEDGE_SOURCE_REF_INVALID/);
    expect(() => parseKnowledgeSourceRef('task:not a spec:T-001')).toThrow(/KNOWLEDGE_SOURCE_REF_INVALID/);
    expect(() => parseKnowledgeSourceRef('lesson:task:missing-task-id')).toThrow(/KNOWLEDGE_SOURCE_REF_INVALID/);
  });
});

describe('knowledge source validation and derivation', () => {
  it('validates Spec, Decision, Task, Lesson, and AC sources', () => {
    const taskId = createKnowledgeFixture();
    for (const ref of [
      'spec:auth-L1',
      'decision:auth:DC-001',
      `task:auth-L3.1.1:${taskId}`,
      `lesson:task:auth-L3.1.1:${taskId}`,
      'lesson:decision:auth:DC-001',
      'ac:auth-L1:AC-1',
    ]) {
      expect(formatKnowledgeSourceRef(validateKnowledgeSource(project.paths, ref))).toBe(ref);
    }
  });

  it('defaults an implemented Spec to unknown', () => {
    createSpecWithAcceptance('auth-L1');
    markSpecImplemented('auth-L1');

    expect(resolveKnowledge(project.paths, 'spec:auth-L1')).toMatchObject({
      state: 'unknown',
      basis: 'default',
      reviewedBy: 'system',
    });
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });

  it('derives archived Specs and incoming replacement relations', () => {
    createSpecWithAcceptance('history-L1', 'history');
    updateSpec(project.paths, 'history-L1', { status: 'archived' });
    createSpecWithAcceptance('old-L1', 'old');
    createSpecWithAcceptance('new-L1', 'new');
    updateSpec(project.paths, 'new-L1', { addRelation: { type: 'supersedes', target: 'old-L1' } });

    expect(resolveKnowledge(project.paths, 'spec:history-L1')).toMatchObject({
      state: 'historical',
      basis: 'derived',
    });

    expect(resolveKnowledge(project.paths, 'spec:old-L1')).toMatchObject({
      state: 'superseded',
      basis: 'derived',
      replacementRef: 'spec:new-L1',
    });
  });

  it('derives active and superseded Decision states', () => {
    createSpecWithAcceptance('auth-L1');
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createDecision({ paths: project.paths, docCode: 'auth-L1', topic: 'auth', what: 'First choice' });
    createDecision({ paths: project.paths, docCode: 'auth-L1', topic: 'auth', what: 'Second choice' });

    expect(resolveKnowledge(project.paths, 'decision:auth:DC-001')).toMatchObject({
      state: 'current',
      basis: 'derived',
    });
    supersedeDecision(project.paths, 'DC-001', 'DC-002');
    expect(resolveKnowledge(project.paths, 'decision:auth:DC-001')).toMatchObject({
      state: 'superseded',
      replacementRef: 'decision:auth:DC-002',
    });
  });

  it('rejects missing source assets and AC IDs', () => {
    createSpecWithAcceptance('auth-L1');
    expect(() => validateKnowledgeSource(project.paths, 'spec:missing-L1')).toThrow(/KNOWLEDGE_SOURCE_NOT_FOUND/);
    expect(() => validateKnowledgeSource(project.paths, 'ac:auth-L1:AC-99')).toThrow(/KNOWLEDGE_SOURCE_NOT_FOUND/);
  });
});

describe('knowledge registry writes', () => {
  it('writes an explicit annotation and gives it priority', () => {
    createSpecWithAcceptance('auth-L1');
    const result = setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:auth-L1',
      state: 'current',
      reason: 'Reviewed against the current implementation.',
      now: '2026-07-16T08:00:00.000Z',
    });

    expect(result).toMatchObject({ state: 'current', basis: 'explicit', reviewedBy: 'human' });
    expect(resolveKnowledge(project.paths, 'spec:auth-L1')).toMatchObject({
      state: 'current',
      basis: 'explicit',
      reviewedAt: '2026-07-16T08:00:00.000Z',
    });
    expect(readKnowledgeRegistry(project.paths).annotations['spec:auth-L1'].reason).toContain('Reviewed');
  });

  it('keeps a repeated semantic write idempotent', () => {
    createSpecWithAcceptance('auth-L1');
    const input = {
      paths: project.paths,
      sourceRef: 'spec:auth-L1',
      state: 'current' as const,
      reason: 'Still current.',
    };
    const first = setKnowledgeAnnotation({ ...input, now: '2026-07-16T08:00:00.000Z' });
    const second = setKnowledgeAnnotation({ ...input, now: '2026-07-17T08:00:00.000Z' });
    expect(second.reviewedAt).toBe(first.reviewedAt);
  });

  it('requires a replacement for superseded state', () => {
    createSpecWithAcceptance('auth-L1');
    expect(() => setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:auth-L1',
      state: 'superseded',
      reason: 'Replaced.',
    })).toThrow(/KNOWLEDGE_REPLACEMENT_REQUIRED/);
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });

  it('rejects a transitive replacement cycle', () => {
    for (const topic of ['first', 'second', 'third']) createSpecWithAcceptance(`${topic}-L1`, topic);
    setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:first-L1',
      state: 'superseded',
      reason: 'Use second.',
      replacementRef: 'spec:second-L1',
    });
    setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:second-L1',
      state: 'superseded',
      reason: 'Use third.',
      replacementRef: 'spec:third-L1',
    });
    expect(() => setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:third-L1',
      state: 'superseded',
      reason: 'Use first.',
      replacementRef: 'spec:first-L1',
    })).toThrow(/KNOWLEDGE_REPLACEMENT_CYCLE/);
    expect(readKnowledgeRegistry(project.paths).annotations['spec:third-L1']).toBeUndefined();
  });

  it('rolls back the registry when nested audit persistence fails', () => {
    createSpecWithAcceptance('auth-L1');
    writeFileSync(project.paths.auditFile, '{broken json', 'utf8');
    expect(() => setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:auth-L1',
      state: 'current',
      reason: 'Reviewed.',
    })).toThrow();
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });

  it('fails closed on a damaged registry', () => {
    createSpecWithAcceptance('auth-L1');
    writeFileSync(project.paths.knowledgeFile, '{broken json', 'utf8');
    expect(() => resolveKnowledge(project.paths, 'spec:auth-L1')).toThrow(/KNOWLEDGE_REGISTRY_INVALID/);
  });

  it('serializes annotation keys in stable order', () => {
    createSpecWithAcceptance('zeta-L1', 'zeta');
    createSpecWithAcceptance('alpha-L1', 'alpha');
    setKnowledgeAnnotation({ paths: project.paths, sourceRef: 'spec:zeta-L1', state: 'current', reason: 'Z.' });
    setKnowledgeAnnotation({ paths: project.paths, sourceRef: 'spec:alpha-L1', state: 'current', reason: 'A.' });
    const content = readFileSync(project.paths.knowledgeFile, 'utf8');
    expect(content.indexOf('spec:alpha-L1')).toBeLessThan(content.indexOf('spec:zeta-L1'));
  });
});

function createSpecWithAcceptance(code: string, topic = 'auth'): void {
  createSpec({ paths: project.paths, code, level: 'L1', title: code, topic, parentCode: null });
  updateSpec(project.paths, code, {
    content: `# ${code}\n\n## 验收标准\n\n1. **AC-1**: criterion\n`,
    aiSummary: `${code} summary`,
  });
}

function createKnowledgeFixture(): string {
  createSpecWithAcceptance('auth-L1');
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createDecision({ paths: project.paths, docCode: 'auth-L1', topic: 'auth', what: 'Use local knowledge' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Impl', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1', {
    status: 'frozen',
    content: '# Impl\n\n## 目标\nx\n\n## 实施步骤\ny\n\n## 验证命令\nnpm test\n',
    aiSummary: 'impl',
  });
  return createTask({
    paths: project.paths,
    specCode: 'auth-L3.1.1',
    autoConfirm: false,
    planJson: {
      coveredSpecs: ['auth-L3.1.1'],
      steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 knowledge fixture' }],
    },
  }).task.id;
}

function markSpecImplemented(code: string): void {
  const spec = findSpecByCode(project.paths, code);
  if (!spec) throw new Error(`missing spec ${code}`);
  writeSpec({ ...spec, fm: { ...spec.fm, status: 'implemented' } });
}
