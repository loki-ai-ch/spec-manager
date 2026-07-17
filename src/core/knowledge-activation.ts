import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { ProjectPaths } from './paths.js';
import { emptyKnowledgeRegistry, readKnowledgeRegistry, resolveKnowledge } from './knowledge.js';
import { buildProjectSnapshot } from './project-snapshot.js';
import { listAllSpecs, type SpecRecord } from './spec-io.js';
import { DEFAULT_RETRIEVAL_CONFIG, executeRetrieval, type RetrievalResult } from './retrieval/index.js';
import type { AssistSourceRef, KnowledgeProjection, ModuleConstraint, TopicRecommendation } from './capability-types.js';
import { extractCriticalAcceptanceCriteria } from './spec-sections.js';

export interface KnowledgeActivationProjection {
  request: string;
  explicitTopic: string | null;
  inferredTopic: string | null;
  suggestedTopic: string | null;
  selectedTopic: string | null;
  selectionRequired: boolean;
  scope: 'topic' | 'project';
  candidateCount: number;
  hasRelatedHistory: boolean;
  matches: RetrievalResult[];
  topicRecommendation: TopicRecommendation;
}

export function buildKnowledgeActivation(input: {
  paths: ProjectPaths;
  request: string;
  explicitTopic?: string | null;
  specs?: SpecRecord[];
  maxResults?: number;
}): KnowledgeActivationProjection {
  const request = input.request.trim();
  const explicitTopic = normalize(input.explicitTopic);
  const inferredTopic = inferActivationTopic(request);
  const specs = (input.specs ?? listAllSpecs(input.paths))
    .filter(spec => !explicitTopic || spec.fm.topic === explicitTopic);
  const candidates = specs.map(spec => ({
    id: spec.fm.code, title: spec.fm.title, topic: spec.fm.topic, code: spec.fm.code,
    aiSummary: spec.fm.aiSummary, status: spec.fm.status, level: spec.fm.level,
    bodySignals: spec.content.slice(0, 4000),
    moduleSignals: extractModuleConstraints(input.paths, spec).map(item => item.path).join(' '),
  }));
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const relations = specs.flatMap(spec => {
    const declared = (spec.fm.relations ?? [])
      .filter(relation => candidateIds.has(relation.target))
      .map(relation => ({ type: relation.type, sourceId: spec.fm.code, targetId: relation.target }));
    const parent = spec.fm.parentCode && candidateIds.has(spec.fm.parentCode)
      ? [{ type: 'parent', sourceId: spec.fm.code, targetId: spec.fm.parentCode }]
      : [];
    return [...declared, ...parent];
  });
  const { results } = executeRetrieval(request, candidates, relations, {
    ...DEFAULT_RETRIEVAL_CONFIG,
    explicitTopic: explicitTopic ?? undefined,
    maxResults: input.maxResults ?? DEFAULT_RETRIEVAL_CONFIG.maxResults,
  });
  const topicRecommendation = buildCanonicalTopicRecommendation(input.paths, specs, results);
  const selectedTopic = explicitTopic
    ?? (topicRecommendation.selection === 'candidate' ? topicRecommendation.candidates[0]?.topic ?? null : null);
  return {
    request, explicitTopic, inferredTopic,
    selectedTopic,
    suggestedTopic: selectedTopic,
    selectionRequired: topicRecommendation.selectionRequired,
    scope: explicitTopic ? 'topic' : 'project', candidateCount: candidates.length,
    hasRelatedHistory: results.length > 0, matches: results, topicRecommendation,
  };
}

export function buildCanonicalTopicRecommendation(paths: ProjectPaths, specs: SpecRecord[], results: RetrievalResult[]): TopicRecommendation {
  const specByCode = new Map(specs.map(spec => [spec.fm.code, spec]));
  const snapshot = buildProjectSnapshot(paths, { include: ['specs', 'tasks', 'decisions', 'incidents'] });
  let registry = emptyKnowledgeRegistry();
  try {
    registry = readKnowledgeRegistry(paths);
  } catch {
    registry = emptyKnowledgeRegistry();
  }
  const grouped = new Map<string, { scores: number[]; specs: SpecRecord[] }>();
  for (const result of results) {
    const spec = specByCode.get(result.candidateId);
    if (!spec) continue;
    const group = grouped.get(spec.fm.topic) ?? { scores: [], specs: [] };
    group.scores.push(result.score);
    group.specs.push(spec);
    grouped.set(spec.fm.topic, group);
  }
  const candidates = [...grouped].map(([topic, group]) => {
    const uniqueSpecs = [...new Map(group.specs.map(spec => [spec.fm.code, spec])).values()];
    const bestScore = Math.max(...group.scores);
    const confidence = Math.min(0.99, bestScore / (bestScore + 2));
    const knowledgeStates = uniqueSpecs.map(spec => {
      try {
        return resolveKnowledge(paths, `spec:${spec.fm.code}`, { registry, snapshot }).state;
      } catch {
        return 'unknown' as const;
      }
    });
    const currentKnowledgeCount = knowledgeStates.filter(state => state === 'current').length;
    const unknownKnowledgeCount = knowledgeStates.filter(state => state === 'unknown').length;
    const criticalConstraintCount = uniqueSpecs.reduce((sum, spec) => sum + extractCriticalAcceptanceCriteria(spec.content).length, 0);
    return {
      topic, confidence, relatedSpecCount: uniqueSpecs.length, currentKnowledgeCount, criticalConstraintCount,
      reasons: [
        `best retrieval score ${bestScore.toFixed(2)}`,
        `${uniqueSpecs.length} related Spec(s)`,
        `${currentKnowledgeCount} current knowledge source(s)`,
        `${unknownKnowledgeCount} unknown knowledge source(s)`,
        `${criticalConstraintCount} critical constraint(s)`,
      ],
    };
  }).sort((a, b) => b.confidence - a.confidence || b.relatedSpecCount - a.relatedSpecCount || a.topic.localeCompare(b.topic)).slice(0, 5);
  const top = candidates[0];
  const second = candidates[1];
  const selection = !top || top.confidence < 0.55
    ? 'create-new' as const
    : second && top.confidence - second.confidence < 0.05
      ? 'ambiguous' as const
      : 'candidate' as const;
  return {
    candidates,
    selection,
    selectionRequired: selection !== 'candidate',
    createNewAllowed: true,
  };
}

export function extractModuleConstraints(
  paths: ProjectPaths,
  spec: SpecRecord,
  sourceRefs: AssistSourceRef[] = [],
  knowledge?: KnowledgeProjection,
): ModuleConstraint[] {
  const fencedRanges = [...spec.content.matchAll(/```[\s\S]*?```/g)].map(match => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const inlineRanges = [...spec.content.matchAll(/`[^`\n]+`/g)].map(match => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const byPath = new Map<string, ModuleConstraint>();
  for (const match of spec.content.matchAll(/\b(?:src|app|lib|frontend|backend|tests?)\/[A-Za-z0-9_./-]+/g)) {
    const path = match[0].replace(/[.,;:)]+$/, '');
    const index = match.index ?? 0;
    const detection = fencedRanges.some(range => index >= range.start && index < range.end)
      ? 'code-block' as const
      : inlineRanges.some(range => index >= range.start && index < range.end)
        ? 'structured' as const
        : 'text-fallback' as const;
    const trust = evaluatePathTrust(paths.root, path, knowledge, sourceRefs);
    const confidence = trust.pathState === 'current-path'
      ? 0.95
      : trust.pathState === 'historical-path'
        ? 0.65
        : detection === 'text-fallback' ? 0.3 : 0.4;
    const next: ModuleConstraint = {
      path, pathState: trust.pathState, pathReason: trust.pathReason, contained: trust.contained, detection, sourceRefs,
      confidence: Math.min(confidence, trustConfidence(knowledge)),
      knowledgeState: knowledge?.state ?? 'unknown',
    };
    const existing = byPath.get(path);
    if (!existing || next.confidence > existing.confidence) byPath.set(path, next);
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function evaluatePathTrust(
  root: string,
  rawPath: string,
  knowledge: KnowledgeProjection | undefined,
  sourceRefs: AssistSourceRef[],
): Pick<ModuleConstraint, 'pathState' | 'pathReason' | 'contained'> {
  if (!rawPath || rawPath.includes('\0')) {
    return { pathState: 'unknown-path', pathReason: 'invalid-path', contained: false };
  }
  const absolute = resolve(root, rawPath);
  if (!isContained(resolve(root), absolute)) {
    return { pathState: 'unknown-path', pathReason: 'outside-root', contained: false };
  }
  if (existsSync(absolute)) {
    try {
      const real = realpathSync.native(absolute);
      const realRoot = realpathSync.native(root);
      if (!isContained(realRoot, real)) {
        return { pathState: 'unknown-path', pathReason: 'outside-root', contained: false };
      }
    } catch {
      return { pathState: 'unknown-path', pathReason: 'invalid-path', contained: true };
    }
    return { pathState: 'current-path', pathReason: 'current-exists', contained: true };
  }
  if (hasHistoricalEvidence(knowledge, sourceRefs)) {
    return { pathState: 'historical-path', pathReason: 'historical-source', contained: true };
  }
  return { pathState: 'unknown-path', pathReason: 'missing-no-history', contained: true };
}

function isContained(absoluteRoot: string, absolutePath: string): boolean {
  const rel = relative(absoluteRoot, absolutePath);
  return rel === '' || (!rel.startsWith('..') && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function hasHistoricalEvidence(knowledge: KnowledgeProjection | undefined, sourceRefs: AssistSourceRef[]): boolean {
  if (knowledge?.state === 'historical' || knowledge?.state === 'superseded' || knowledge?.state === 'invalidated') return true;
  return sourceRefs.some(ref => /\b(?:historical|superseded|invalidated|archived|removed)\b/i.test(`${ref.id} ${ref.summary ?? ''}`));
}

function trustConfidence(knowledge: KnowledgeProjection | undefined): number {
  if (!knowledge) return 0.5;
  if (knowledge.basis === 'explicit') return 1;
  if (knowledge.basis === 'derived') return 0.8;
  return 0.5;
}

export function inferActivationTopic(request: string): string | null {
  const tokens = request.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  return tokens.find(token => token.includes('-')) ?? tokens[0] ?? null;
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
