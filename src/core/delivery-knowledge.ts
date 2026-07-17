import { existsSync, readFileSync } from 'node:fs';
import type { ProjectPaths } from './paths.js';
import { findSpecByCode } from './spec-io.js';
import { findTask } from './task.js';
import { extractAcceptanceCriteria } from './spec-sections.js';
import { withProjectTransaction } from './transaction.js';
import { buildTaskEvidence } from './task-evidence.js';

export type DeliveryConclusion = 'validated' | 'invalidated' | 'discovered' | 'none';
export type DeliveryKnowledgeStatus = 'draft' | 'approved' | 'rejected';
export interface DeliveryKnowledgeRecord {
  id: string; topic: string; specCode: string; taskId: string;
  conclusion: DeliveryConclusion; summary: string; evidenceRefs: string[]; affectedCriteria: string[];
  status: DeliveryKnowledgeStatus; reviewReason?: string; createdAt: string; reviewedAt?: string;
}
export interface DeliveryKnowledgeRegistry { schemaVersion: 'delivery-knowledge.v1'; records: DeliveryKnowledgeRecord[] }

export interface EnsureDeliveryKnowledgeDraftResult {
  action: 'created' | 'reused';
  knowledgeId: string;
  status: DeliveryKnowledgeStatus;
  sourceRefs: string[];
}

export function readDeliveryKnowledge(paths: ProjectPaths): DeliveryKnowledgeRegistry {
  if (!existsSync(paths.deliveryKnowledgeFile)) return { schemaVersion: 'delivery-knowledge.v1', records: [] };
  try {
    const parsed = JSON.parse(readFileSync(paths.deliveryKnowledgeFile, 'utf8')) as DeliveryKnowledgeRegistry;
    if (parsed.schemaVersion !== 'delivery-knowledge.v1' || !Array.isArray(parsed.records)) throw new Error('invalid schema');
    return parsed;
  } catch (err) { throw new Error(`DELIVERY_KNOWLEDGE_INVALID: ${err instanceof Error ? err.message : String(err)}`); }
}

export function declareDeliveryKnowledge(input: { paths: ProjectPaths; specCode: string; taskId: string; conclusion: DeliveryConclusion; summary: string; evidenceRefs?: string[]; affectedCriteria?: string[] }): DeliveryKnowledgeRecord {
  const spec = findSpecByCode(input.paths, input.specCode); if (!spec) throw new Error(`SPEC_NOT_FOUND: ${input.specCode}`);
  const summary = input.summary.trim(); if (!summary) throw new Error('DELIVERY_KNOWLEDGE_SUMMARY_REQUIRED');
  const evidenceRefs = [...new Set(input.evidenceRefs ?? [])];
  const criteria = [...new Set(input.affectedCriteria ?? [])];
  validateDeliveryKnowledgeSources(input.paths, input.specCode, input.taskId, input.conclusion, evidenceRefs, criteria);
  return withProjectTransaction(input.paths, `delivery knowledge ${input.taskId}`, tx => {
    const registry = readDeliveryKnowledge(input.paths);
    const existing = registry.records.find(item => item.specCode === input.specCode && item.taskId === input.taskId);
    if (existing && existing.status !== 'draft') throw new Error(`DELIVERY_KNOWLEDGE_IMMUTABLE: ${existing.id}`);
    const record: DeliveryKnowledgeRecord = {
      id: existing?.id ?? nextId(registry), topic: spec.fm.topic, specCode: input.specCode, taskId: input.taskId,
      conclusion: input.conclusion, summary, evidenceRefs, affectedCriteria: criteria, status: 'draft', createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    registry.records = [...registry.records.filter(item => item.id !== record.id), record];
    tx.write(input.paths.deliveryKnowledgeFile, JSON.stringify(registry, null, 2) + '\n'); return record;
  });
}

export function ensureDeliveryKnowledgeDraft(input: {
  paths: ProjectPaths;
  specCode: string;
  taskId: string;
}): EnsureDeliveryKnowledgeDraftResult {
  const existing = findDeliveryKnowledge(input.paths, input.specCode, input.taskId);
  if (existing) {
    validateDeliveryKnowledgeSources(
      input.paths, existing.specCode, existing.taskId,
      existing.conclusion, existing.evidenceRefs, existing.affectedCriteria,
    );
    return {
      action: 'reused', knowledgeId: existing.id, status: existing.status,
      sourceRefs: deliverySourceRefs(existing.specCode, existing.taskId, existing.evidenceRefs, existing.affectedCriteria),
    };
  }

  const evidence = buildTaskEvidence(input.paths, input.taskId, input.specCode);
  const successfulVerificationIds = evidence.verifications
    .filter(item => item.exitCode === 0)
    .map(item => item.id);
  if (successfulVerificationIds.length === 0) {
    throw new Error(`DELIVERY_EVIDENCE_NOT_FOUND: ${input.specCode}/${input.taskId} requires successful verification`);
  }
  const coveredCriticalIds = evidence.criticalCriteria
    .filter(item => item.status === 'covered')
    .map(item => item.id);
  const record = declareDeliveryKnowledge({
    paths: input.paths,
    specCode: input.specCode,
    taskId: input.taskId,
    conclusion: 'validated',
    summary: `Task ${input.taskId} completed with ${successfulVerificationIds.length} successful verification(s) and ${coveredCriticalIds.length}/${evidence.criticalCriteria.length} critical AC covered.`,
    evidenceRefs: successfulVerificationIds,
    affectedCriteria: coveredCriticalIds,
  });
  return {
    action: 'created', knowledgeId: record.id, status: record.status,
    sourceRefs: deliverySourceRefs(record.specCode, record.taskId, record.evidenceRefs, record.affectedCriteria),
  };
}

export function reviewDeliveryKnowledge(paths: ProjectPaths, id: string, decision: 'approve' | 'reject', reason?: string): DeliveryKnowledgeRecord {
  return withProjectTransaction(paths, `review delivery knowledge ${id}`, tx => {
    const registry = readDeliveryKnowledge(paths); const record = registry.records.find(item => item.id === id);
    if (!record) throw new Error(`DELIVERY_KNOWLEDGE_NOT_FOUND: ${id}`);
    if (record.status !== 'draft') throw new Error(`DELIVERY_KNOWLEDGE_IMMUTABLE: ${id}`);
    if (decision === 'reject' && !reason?.trim()) throw new Error('DELIVERY_REVIEW_REASON_REQUIRED');
    if (decision === 'approve') {
      validateDeliveryKnowledgeSources(paths, record.specCode, record.taskId, record.conclusion, record.evidenceRefs, record.affectedCriteria);
    }
    const updated = { ...record, status: decision === 'approve' ? 'approved' as const : 'rejected' as const, ...(reason?.trim() ? { reviewReason: reason.trim() } : {}), reviewedAt: new Date().toISOString() };
    registry.records = registry.records.map(item => item.id === id ? updated : item);
    tx.write(paths.deliveryKnowledgeFile, JSON.stringify(registry, null, 2) + '\n'); return updated;
  });
}
export function findDeliveryKnowledge(paths: ProjectPaths, specCode: string, taskId: string) { return readDeliveryKnowledge(paths).records.find(item => item.specCode === specCode && item.taskId === taskId) ?? null; }
export function listApprovedDeliveryKnowledge(paths: ProjectPaths, topic?: string) { return readDeliveryKnowledge(paths).records.filter(item => item.status === 'approved' && (!topic || item.topic === topic)); }
export function validateDeliveryKnowledgeSources(
  paths: ProjectPaths,
  specCode: string,
  taskId: string,
  conclusion: DeliveryConclusion,
  evidenceRefs: string[],
  affectedCriteria: string[],
): void {
  const spec = findSpecByCode(paths, specCode); if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  const task = findTask(paths, specCode, taskId); if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId}`);
  if (conclusion !== 'none') {
    if (!evidenceRefs.length) throw new Error('DELIVERY_EVIDENCE_NOT_FOUND: at least one verification is required');
    for (const id of evidenceRefs) {
      const evidence = task.verifications?.find(item => item.id === id);
      if (!evidence) throw new Error(`DELIVERY_EVIDENCE_NOT_FOUND: ${id}`);
      if (evidence.exitCode !== 0) throw new Error(`DELIVERY_EVIDENCE_NOT_SUCCESSFUL: ${id}`);
    }
  }
  const known = new Set(extractAcceptanceCriteria(spec.content).map(item => item.id));
  const invalid = affectedCriteria.filter(item => !known.has(item));
  if (invalid.length) throw new Error(`DELIVERY_AC_NOT_FOUND: ${invalid.join(', ')}`);
}
function nextId(registry: DeliveryKnowledgeRegistry) { const max = Math.max(0, ...registry.records.map(item => Number(item.id.match(/^DK-(\d+)$/)?.[1] ?? 0))); return `DK-${String(max + 1).padStart(3, '0')}`; }

function deliverySourceRefs(specCode: string, taskId: string, evidenceRefs: string[], criteria: string[]): string[] {
  return [
    `task:${specCode}:${taskId}`,
    ...evidenceRefs.map(id => `evidence:${specCode}:${taskId}:${id}`),
    ...criteria.map(id => `ac:${specCode}:${id}`),
  ];
}
