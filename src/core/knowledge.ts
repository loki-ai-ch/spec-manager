import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { hit } from './audit.js';
import { SPEC_CODE_RE, TOPIC_RE } from './constants.js';
import { buildProjectSnapshot, taskKey, type ProjectSnapshot } from './project-snapshot.js';
import type { ProjectPaths } from './paths.js';
import { extractAcceptanceCriteria } from './spec-sections.js';
import { withProjectTransaction } from './transaction.js';
import { readDeliveryKnowledge } from './delivery-knowledge.js';

export const KNOWLEDGE_REGISTRY_SCHEMA_VERSION = 'knowledge-registry.v1' as const;

export const KnowledgeStateSchema = z.enum([
  'current',
  'historical',
  'superseded',
  'invalidated',
  'unknown',
]);

export type KnowledgeState = z.infer<typeof KnowledgeStateSchema>;
export type KnowledgeBasis = 'explicit' | 'derived' | 'default';
export type KnowledgeSourceKind = 'spec' | 'decision' | 'task' | 'lesson' | 'ac';

const KnowledgeAnnotationSchema = z.object({
  state: KnowledgeStateSchema,
  reason: z.string().trim().min(1),
  replacementRef: z.string().trim().min(1).optional(),
  reviewedAt: z.string().datetime(),
  reviewedBy: z.string().trim().min(1),
}).strict();

const KnowledgeRegistrySchema = z.object({
  schemaVersion: z.literal(KNOWLEDGE_REGISTRY_SCHEMA_VERSION),
  annotations: z.record(z.string(), KnowledgeAnnotationSchema),
}).strict();

export interface KnowledgeAnnotation {
  state: KnowledgeState;
  reason: string;
  replacementRef?: string;
  reviewedAt: string;
  reviewedBy: string;
}

export interface KnowledgeRegistry {
  schemaVersion: typeof KNOWLEDGE_REGISTRY_SCHEMA_VERSION;
  annotations: Record<string, KnowledgeAnnotation>;
}

export interface ResolvedKnowledge extends KnowledgeAnnotation {
  sourceRef: string;
  basis: KnowledgeBasis;
}

export type ParsedKnowledgeSourceRef =
  | { kind: 'spec'; specCode: string }
  | { kind: 'decision'; topic: string; decisionId: string }
  | { kind: 'task'; specCode: string; taskId: string }
  | { kind: 'lesson'; sourceKind: 'task' | 'decision' | 'incident' | 'delivery'; sourceIdentity: string }
  | { kind: 'ac'; specCode: string; acId: string };

export interface SetKnowledgeAnnotationInput {
  paths: ProjectPaths;
  sourceRef: string;
  state: KnowledgeState;
  reason: string;
  replacementRef?: string;
  reviewedBy?: string;
  now?: string;
}

export function emptyKnowledgeRegistry(): KnowledgeRegistry {
  return {
    schemaVersion: KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
    annotations: {},
  };
}

export function parseKnowledgeSourceRef(sourceRef: string): ParsedKnowledgeSourceRef {
  const value = sourceRef.trim();
  let match = value.match(/^spec:([^:]+)$/);
  if (match && SPEC_CODE_RE.test(match[1])) return { kind: 'spec', specCode: match[1] };

  match = value.match(/^decision:([^:]+):([^:]+)$/);
  if (match && TOPIC_RE.test(match[1]) && isStableId(match[2])) {
    return { kind: 'decision', topic: match[1], decisionId: match[2] };
  }

  match = value.match(/^task:([^:]+):([^:]+)$/);
  if (match && SPEC_CODE_RE.test(match[1]) && isStableId(match[2])) {
    return { kind: 'task', specCode: match[1], taskId: match[2] };
  }

  match = value.match(/^lesson:(task|decision|incident|delivery):(.+)$/);
  if (match && isValidLessonIdentity(match[1], match[2])) {
    return {
      kind: 'lesson',
      sourceKind: match[1] as 'task' | 'decision' | 'incident' | 'delivery',
      sourceIdentity: match[2],
    };
  }

  match = value.match(/^ac:([^:]+):(AC-[A-Za-z0-9.-]+)$/i);
  if (match && SPEC_CODE_RE.test(match[1])) {
    return { kind: 'ac', specCode: match[1], acId: match[2].toUpperCase() };
  }

  throw new Error(`KNOWLEDGE_SOURCE_REF_INVALID: ${sourceRef}`);
}

function isStableId(input: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input);
}

function isValidLessonIdentity(sourceKind: string, identity: string): boolean {
  if (sourceKind === 'task') {
    const match = identity.match(/^([^:]+):([^:]+)$/);
    return Boolean(match && SPEC_CODE_RE.test(match[1]) && isStableId(match[2]));
  }
  if (sourceKind === 'decision') {
    const match = identity.match(/^([^:]+):([^:]+)$/);
    return Boolean(match && TOPIC_RE.test(match[1]) && isStableId(match[2]));
  }
  return isStableId(identity);
}

export function formatKnowledgeSourceRef(source: ParsedKnowledgeSourceRef): string {
  switch (source.kind) {
    case 'spec': return `spec:${source.specCode}`;
    case 'decision': return `decision:${source.topic}:${source.decisionId}`;
    case 'task': return `task:${source.specCode}:${source.taskId}`;
    case 'lesson': return `lesson:${source.sourceKind}:${source.sourceIdentity}`;
    case 'ac': return `ac:${source.specCode}:${source.acId}`;
  }
}

export function readKnowledgeRegistry(paths: ProjectPaths): KnowledgeRegistry {
  if (!existsSync(paths.knowledgeFile)) return emptyKnowledgeRegistry();
  try {
    const parsed = KnowledgeRegistrySchema.parse(JSON.parse(readFileSync(paths.knowledgeFile, 'utf8')));
    return parsed as KnowledgeRegistry;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`KNOWLEDGE_REGISTRY_INVALID: ${detail}`);
  }
}

export function validateKnowledgeSource(
  paths: ProjectPaths,
  sourceRef: string,
  snapshot: ProjectSnapshot = buildKnowledgeSnapshot(paths),
): ParsedKnowledgeSourceRef {
  const parsed = parseKnowledgeSourceRef(sourceRef);
  let exists = false;
  switch (parsed.kind) {
    case 'spec':
      exists = snapshot.indexes.specByCode.has(parsed.specCode);
      break;
    case 'decision':
      exists = snapshot.decisions.some(decision =>
        decision.fm.topic === parsed.topic
        && (decision.id === parsed.decisionId || decision.fm.id === parsed.decisionId));
      break;
    case 'task':
      exists = snapshot.indexes.taskByKey.has(taskKey(parsed.specCode, parsed.taskId));
      break;
    case 'lesson':
      exists = parsed.sourceKind === 'delivery'
        ? readDeliveryKnowledge(paths).records.some(item => item.id === parsed.sourceIdentity && item.status === 'approved')
        : validateLessonSource(parsed, snapshot);
      break;
    case 'ac': {
      const spec = snapshot.indexes.specByCode.get(parsed.specCode);
      exists = Boolean(spec && extractAcceptanceCriteria(spec.content).some(item => item.id === parsed.acId));
      break;
    }
  }
  if (!exists) throw new Error(`KNOWLEDGE_SOURCE_NOT_FOUND: ${sourceRef}`);
  return parsed;
}

export function resolveKnowledge(
  paths: ProjectPaths,
  sourceRef: string,
  options?: { registry?: KnowledgeRegistry; snapshot?: ProjectSnapshot },
): ResolvedKnowledge {
  const snapshot = options?.snapshot ?? buildKnowledgeSnapshot(paths);
  const parsed = validateKnowledgeSource(paths, sourceRef, snapshot);
  const canonical = formatKnowledgeSourceRef(parsed);
  const registry = options?.registry ?? readKnowledgeRegistry(paths);
  const explicit = registry.annotations[canonical];
  if (explicit) return { sourceRef: canonical, basis: 'explicit', ...explicit };

  const derived = deriveKnowledge(parsed, snapshot);
  if (derived) return { sourceRef: canonical, basis: 'derived', ...derived };

  return {
    sourceRef: canonical,
    state: 'unknown',
    basis: 'default',
    reason: 'No explicit review or stable derivation is available.',
    reviewedAt: '',
    reviewedBy: 'system',
  };
}

export function setKnowledgeAnnotation(input: SetKnowledgeAnnotationInput): ResolvedKnowledge {
  const sourceRef = formatKnowledgeSourceRef(validateKnowledgeSource(input.paths, input.sourceRef));
  const reason = input.reason.trim();
  if (!reason) throw new Error('KNOWLEDGE_REASON_REQUIRED: --reason must be non-empty');
  const reviewedBy = input.reviewedBy?.trim() || 'human';
  const replacementRef = normalizeReplacement(input.paths, sourceRef, input.state, input.replacementRef);

  return withProjectTransaction(input.paths, `knowledge set ${sourceRef}`, tx => {
    const registry = readKnowledgeRegistry(input.paths);
    assertNoReplacementCycle(registry, sourceRef, replacementRef);
    const existing = registry.annotations[sourceRef];
    const same = existing
      && existing.state === input.state
      && existing.reason === reason
      && existing.replacementRef === replacementRef
      && existing.reviewedBy === reviewedBy;
    const annotation: KnowledgeAnnotation = same ? existing : {
      state: input.state,
      reason,
      ...(replacementRef ? { replacementRef } : {}),
      reviewedAt: input.now ?? new Date().toISOString(),
      reviewedBy,
    };
    if (!same) {
      registry.annotations[sourceRef] = annotation;
      tx.write(input.paths.knowledgeFile, serializeKnowledgeRegistry(registry));
    }
    hit({
      paths: input.paths,
      ruleId: 'R9',
      countRule: false,
      metadata: {
        action: 'knowledge.set',
        sourceRef,
        state: input.state,
        idempotent: Boolean(same),
      },
    });
    return { sourceRef, basis: 'explicit', ...annotation };
  });
}

export function serializeKnowledgeRegistry(registry: KnowledgeRegistry): string {
  const annotations = Object.fromEntries(
    Object.entries(registry.annotations)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceRef, annotation]) => [sourceRef, annotation]),
  );
  return `${JSON.stringify({ schemaVersion: KNOWLEDGE_REGISTRY_SCHEMA_VERSION, annotations }, null, 2)}\n`;
}

function buildKnowledgeSnapshot(paths: ProjectPaths): ProjectSnapshot {
  return buildProjectSnapshot(paths, { include: ['specs', 'tasks', 'decisions', 'incidents'] });
}

function validateLessonSource(
  source: Extract<ParsedKnowledgeSourceRef, { kind: 'lesson' }>,
  snapshot: ProjectSnapshot,
): boolean {
  if (source.sourceKind === 'task') {
    const match = source.sourceIdentity.match(/^([^:]+):([^:]+)$/);
    return Boolean(match && snapshot.indexes.taskByKey.has(taskKey(match[1], match[2])));
  }
  if (source.sourceKind === 'decision') {
    const match = source.sourceIdentity.match(/^([^:]+):([^:]+)$/);
    return Boolean(match && snapshot.decisions.some(decision =>
      decision.fm.topic === match[1] && (decision.id === match[2] || decision.fm.id === match[2])));
  }
  if (source.sourceKind === 'delivery') {
    return snapshot.scope ? true : true;
  }
  return snapshot.incidents.some(incident => incident.id === source.sourceIdentity || incident.fm.id === source.sourceIdentity);
}

function deriveKnowledge(
  source: ParsedKnowledgeSourceRef,
  snapshot: ProjectSnapshot,
): KnowledgeAnnotation | null {
  const systemAnnotation = (state: KnowledgeState, reason: string, replacementRef?: string): KnowledgeAnnotation => ({
    state,
    reason,
    ...(replacementRef ? { replacementRef } : {}),
    reviewedAt: '',
    reviewedBy: 'system',
  });

  if (source.kind === 'spec') {
    const spec = snapshot.indexes.specByCode.get(source.specCode)!;
    if (spec.fm.status === 'archived') {
      return systemAnnotation('historical', 'The source Spec is archived.');
    }
    const replacement = snapshot.specs.find(candidate =>
      (candidate.fm.relations ?? []).some(relation => relation.type === 'supersedes' && relation.target === source.specCode));
    if (replacement) {
      return systemAnnotation(
        'superseded',
        `The source Spec is superseded by ${replacement.fm.code}.`,
        `spec:${replacement.fm.code}`,
      );
    }
  }

  if (source.kind === 'decision') {
    const decision = snapshot.decisions.find(candidate =>
      candidate.fm.topic === source.topic
      && (candidate.id === source.decisionId || candidate.fm.id === source.decisionId))!;
    if (decision.fm.status === 'active') {
      return systemAnnotation('current', 'The source Decision is active.');
    }
    if (decision.fm.status === 'superseded') {
      const replacementRef = decision.fm.supersededById
        ? `decision:${decision.fm.topic}:${decision.fm.supersededById}`
        : undefined;
      return systemAnnotation('superseded', 'The source Decision is superseded.', replacementRef);
    }
    return systemAnnotation('unknown', 'The source Decision is partial and requires review.');
  }

  if (source.kind === 'ac') {
    const spec = snapshot.indexes.specByCode.get(source.specCode)!;
    if (spec.fm.status === 'archived') {
      return systemAnnotation('historical', `The owning Spec ${source.specCode} is archived.`);
    }
  }
  return null;
}

function normalizeReplacement(
  paths: ProjectPaths,
  sourceRef: string,
  state: KnowledgeState,
  input: string | undefined,
): string | undefined {
  const raw = input?.trim();
  if (state === 'superseded' && !raw) {
    throw new Error('KNOWLEDGE_REPLACEMENT_REQUIRED: superseded state requires --replacement');
  }
  if (!raw) return undefined;
  const replacementRef = formatKnowledgeSourceRef(validateKnowledgeSource(paths, raw));
  if (replacementRef === sourceRef) {
    throw new Error(`KNOWLEDGE_REPLACEMENT_CYCLE: ${sourceRef} cannot replace itself`);
  }
  return replacementRef;
}

function assertNoReplacementCycle(
  registry: KnowledgeRegistry,
  sourceRef: string,
  replacementRef: string | undefined,
): void {
  if (!replacementRef) return;
  const visited = new Set([sourceRef]);
  let current: string | undefined = replacementRef;
  while (current) {
    if (visited.has(current)) {
      throw new Error(`KNOWLEDGE_REPLACEMENT_CYCLE: ${[...visited, current].join(' -> ')}`);
    }
    visited.add(current);
    current = registry.annotations[current]?.replacementRef;
  }
}
