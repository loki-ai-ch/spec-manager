import type { HistoryDispositionActionT, HistoryReviewT } from '../schemas/spec.js';
import { readKnowledgeRegistry, resolveKnowledge, validateKnowledgeSource, type ResolvedKnowledge } from './knowledge.js';
import type { ProjectPaths } from './paths.js';
import { extractAcceptanceCriteria } from './spec-sections.js';
import { findSpecByCode, updateSpec } from './spec-io.js';

export interface HistoryDisposition {
  sourceRef: string;
  action: HistoryDispositionActionT;
  reason?: string;
  affectedCriteria: string[];
}

export interface HistoryReviewItem {
  sourceRef: string;
  knowledge: ResolvedKnowledge;
  disposition: HistoryDisposition | null;
}

export interface HistoryReviewReport {
  specCode: string;
  adopted: boolean;
  noRelevantHistoryReason: string | null;
  items: HistoryReviewItem[];
  unresolved: string[];
  byCriterion: Record<string, Array<{ sourceRef: string; action: HistoryDispositionActionT }>>;
}

export function attachHistorySources(input: {
  paths: ProjectPaths;
  specCode: string;
  sources: string[];
  noRelevantHistoryReason?: string;
}): HistoryReviewT {
  const spec = requireSpec(input.paths, input.specCode);
  const sources = [...new Set(input.sources.map(item => item.trim()).filter(Boolean))];
  for (const sourceRef of sources) validateKnowledgeSource(input.paths, sourceRef);
  const existing = spec.fm.historyReview;
  const merged = [...new Set([...(existing?.sources ?? []), ...sources])];
  const reason = input.noRelevantHistoryReason?.trim();
  if (merged.length === 0 && !reason) {
    throw new Error('HISTORY_REASON_REQUIRED: empty history requires --reason-if-empty');
  }
  const historyReview: HistoryReviewT = {
    sources: merged,
    dispositions: existing?.dispositions ?? [],
    ...(merged.length === 0 ? { noRelevantHistoryReason: reason } : {}),
    reviewedAt: new Date().toISOString(),
  };
  updateSpec(input.paths, input.specCode, { historyReview });
  return historyReview;
}

export function setHistoryDisposition(input: {
  paths: ProjectPaths;
  specCode: string;
  sourceRef: string;
  action: HistoryDispositionActionT;
  reason?: string;
  affectedCriteria?: string[];
}): HistoryReviewT {
  const spec = requireSpec(input.paths, input.specCode);
  const review = spec.fm.historyReview;
  if (!review?.sources.includes(input.sourceRef)) {
    throw new Error(`HISTORY_SOURCE_NOT_ATTACHED: ${input.sourceRef}`);
  }
  const reason = input.reason?.trim();
  if (input.action !== 'reuse' && !reason) {
    throw new Error(`HISTORY_REASON_REQUIRED: ${input.action}`);
  }
  const criteria = [...new Set(input.affectedCriteria ?? [])];
  const available = new Set(extractAcceptanceCriteria(spec.content).map(item => item.id));
  const unknown = criteria.filter(item => !available.has(item));
  if (unknown.length > 0) throw new Error(`HISTORY_AC_NOT_FOUND: ${unknown.join(', ')}`);
  const disposition: HistoryDisposition = {
    sourceRef: input.sourceRef,
    action: input.action,
    ...(reason ? { reason } : {}),
    affectedCriteria: criteria,
  };
  const dispositions = [
    ...review.dispositions.filter(item => item.sourceRef !== input.sourceRef),
    disposition,
  ];
  const historyReview: HistoryReviewT = {
    ...review,
    dispositions,
    reviewedAt: new Date().toISOString(),
  };
  updateSpec(input.paths, input.specCode, { historyReview });
  return historyReview;
}

export function buildHistoryReviewReport(paths: ProjectPaths, specCode: string): HistoryReviewReport {
  const spec = requireSpec(paths, specCode);
  const review = spec.fm.historyReview;
  if (!review) {
    return { specCode, adopted: false, noRelevantHistoryReason: null, items: [], unresolved: [], byCriterion: {} };
  }
  const registry = readKnowledgeRegistry(paths);
  const items = review.sources.map(sourceRef => ({
    sourceRef,
    knowledge: resolveKnowledge(paths, sourceRef, { registry }),
    disposition: review.dispositions.find(item => item.sourceRef === sourceRef) ?? null,
  }));
  const byCriterion: HistoryReviewReport['byCriterion'] = {};
  for (const disposition of review.dispositions) {
    for (const criterion of disposition.affectedCriteria) {
      byCriterion[criterion] = [...(byCriterion[criterion] ?? []), {
        sourceRef: disposition.sourceRef,
        action: disposition.action,
      }];
    }
  }
  return {
    specCode,
    adopted: true,
    noRelevantHistoryReason: review.noRelevantHistoryReason ?? null,
    items,
    unresolved: items.filter(item => !item.disposition).map(item => item.sourceRef),
    byCriterion,
  };
}

function requireSpec(paths: ProjectPaths, code: string) {
  const spec = findSpecByCode(paths, code);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${code}`);
  return spec;
}
