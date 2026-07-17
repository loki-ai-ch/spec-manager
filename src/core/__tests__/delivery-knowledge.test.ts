import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { addTaskVerification, createTask, startTask } from '../task.js';
import { declareDeliveryKnowledge, ensureDeliveryKnowledgeDraft, findDeliveryKnowledge, listApprovedDeliveryKnowledge, reviewDeliveryKnowledge } from '../delivery-knowledge.js';
import { runDeliveryKnowledgeGate } from '../task-completion.js';
import { buildLessonsReport } from '../lessons.js';
import { buildKnowledgeMetrics } from '../knowledge-metrics.js';

let project: TestProject;
beforeEach(() => { project = createTestProject('spec-mgr-delivery-knowledge-'); });
afterEach(() => project.cleanup());

describe('delivery knowledge', () => {
  it('automatically creates a deterministic draft from successful evidence', () => {
    const task = fixture();
    const verification = addTaskVerification({ paths: project.paths, taskId: task.id, specCode: task.specCode, command: 'npm test', exitCode: 0, summary: 'passed', coversAc: ['AC-1'] }).verification;
    const gate = runDeliveryKnowledgeGate({ paths: project.paths, taskId: task.id, specCode: task.specCode }, task, true);
    expect(gate).toMatchObject({ status: 'passed', metadata: { action: 'created' } });
    expect(findDeliveryKnowledge(project.paths, task.specCode, task.id)).toMatchObject({
      status: 'draft', conclusion: 'validated', evidenceRefs: [verification.id], affectedCriteria: [],
    });
  });

  it('reuses an existing human draft without overwriting it', () => {
    const task = fixture();
    const verification = addTaskVerification({ paths: project.paths, taskId: task.id, specCode: task.specCode, command: 'npm test', exitCode: 0, summary: 'passed' }).verification;
    const existing = declareDeliveryKnowledge({ paths: project.paths, specCode: task.specCode, taskId: task.id, conclusion: 'discovered', summary: 'Human-authored insight', evidenceRefs: [verification.id] });
    expect(ensureDeliveryKnowledgeDraft({ paths: project.paths, specCode: task.specCode, taskId: task.id })).toMatchObject({ action: 'reused', knowledgeId: existing.id });
    expect(findDeliveryKnowledge(project.paths, task.specCode, task.id)?.summary).toBe('Human-authored insight');
  });

  it('accepts explicit none', () => {
    const task = fixture();
    const record = declareDeliveryKnowledge({ paths: project.paths, specCode: task.specCode, taskId: task.id, conclusion: 'none', summary: 'No new reusable knowledge.' });
    expect(record.conclusion).toBe('none');
    expect(runDeliveryKnowledgeGate({ paths: project.paths, taskId: task.id, specCode: task.specCode }, task, true).status).toBe('passed');
  });

  it('excludes draft from retrieval', () => {
    const task = fixture();
    const verification = addTaskVerification({ paths: project.paths, taskId: task.id, specCode: task.specCode, command: 'npm test', exitCode: 0, summary: 'passed' }).verification;
    declareDeliveryKnowledge({ paths: project.paths, specCode: task.specCode, taskId: task.id, conclusion: 'discovered', summary: 'Reusable delivery insight', evidenceRefs: [verification.id], affectedCriteria: ['AC-1'] });
    expect(listApprovedDeliveryKnowledge(project.paths)).toEqual([]);
    expect(buildLessonsReport(project.paths, { topic: 'auth', request: 'Reusable delivery insight' }).lessons).toEqual([]);
  });

  it('keeps review human controlled', () => {
    const task = fixture();
    const verification = addTaskVerification({ paths: project.paths, taskId: task.id, specCode: task.specCode, command: 'npm test', exitCode: 0, summary: 'passed' }).verification;
    const draft = declareDeliveryKnowledge({ paths: project.paths, specCode: task.specCode, taskId: task.id, conclusion: 'validated', summary: 'Auth delivery is reusable', evidenceRefs: [verification.id] });
    expect(findDeliveryKnowledge(project.paths, task.specCode, task.id)?.status).toBe('draft');
    reviewDeliveryKnowledge(project.paths, draft.id, 'approve');
    expect(listApprovedDeliveryKnowledge(project.paths)).toHaveLength(1);
    expect(buildLessonsReport(project.paths, { topic: 'auth', request: 'Auth delivery reusable' }).lessons[0].id).toBe(`delivery:${draft.id}`);
    expect(buildKnowledgeMetrics(project.paths, 'auth').delivery.approved).toBe(1);
    expect(() => reviewDeliveryKnowledge(project.paths, draft.id, 'reject', 'changed')).toThrow(/IMMUTABLE/);
  });

  it('rejects missing and failed evidence', () => {
    const task = fixture();
    expect(() => declareDeliveryKnowledge({ paths: project.paths, specCode: task.specCode, taskId: task.id, conclusion: 'validated', summary: 'x', evidenceRefs: ['V-999'] })).toThrow(/NOT_FOUND/);
    const failed = addTaskVerification({ paths: project.paths, taskId: task.id, specCode: task.specCode, command: 'false', exitCode: 1, summary: 'failed' }).verification;
    expect(() => declareDeliveryKnowledge({ paths: project.paths, specCode: task.specCode, taskId: task.id, conclusion: 'invalidated', summary: 'x', evidenceRefs: [failed.id] })).toThrow(/NOT_SUCCESSFUL/);
  });

  it('revalidates AC sources when approving a draft', () => {
    const task = fixture();
    const verification = addTaskVerification({ paths: project.paths, taskId: task.id, specCode: task.specCode, command: 'npm test', exitCode: 0, summary: 'passed' }).verification;
    const draft = declareDeliveryKnowledge({
      paths: project.paths, specCode: task.specCode, taskId: task.id,
      conclusion: 'validated', summary: 'AC remains valid',
      evidenceRefs: [verification.id], affectedCriteria: ['AC-1'],
    });
    updateSpec(project.paths, task.specCode, {
      content: '# Impl\n\n## 目标\nx\n## 实施步骤\nx\n## 验证命令\nnpm test\n',
      aiSummary: 'AC removed',
    });
    expect(() => reviewDeliveryKnowledge(project.paths, draft.id, 'approve')).toThrow('DELIVERY_AC_NOT_FOUND');
    expect(findDeliveryKnowledge(project.paths, task.specCode, task.id)?.status).toBe('draft');
  });
});

function fixture() {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Impl', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1', { status: 'frozen', deliveryLearning: true, content: '# Impl\n\n## 验收标准\n1. **AC-1**: works\n\n## 目标\nx\n## 实施步骤\nx\n## 验证命令\nnpm test\n', aiSummary: 'impl' });
  const { task } = createTask({ paths: project.paths, specCode: 'auth-L3.1.1', autoConfirm: false, planJson: { coveredSpecs: ['auth-L3.1.1'], steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 fixture' }] } });
  startTask(project.paths, task.id, task.specCode); return { ...task, status: 'running' as const };
}
