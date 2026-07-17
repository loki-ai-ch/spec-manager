import { calculateBatchScores, calculateConfidence, generateMatchReason } from './scoring.js';
import { buildRelationIndex, expandCandidates, mergeWithExpandedScores } from './relation-expansion.js';
import { stableSortCandidates } from './sorting.js';
import { applyDiversityPruning } from './diversity.js';
import { tokenize } from './normalization.js';
import type { CandidateScore, MatchResult } from './scoring.js';
import type { CandidateWithMetadata } from './sorting.js';
/**
 * 检索模块入口
 * 导出所有检索相关功能
 */

export * from './normalization.js';
export * from './scoring.js';
export * from './relation-expansion.js';
export * from './sorting.js';
export * from './diversity.js';

// 检索配置
export interface RetrievalConfig {
  maxResults: number;
  maxPerTopic: number;
  explicitTopic?: string;
  expansionWeight: number;
  diversityWeight: number;
}

// 默认检索配置
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  maxResults: 5,
  maxPerTopic: 2,
  expansionWeight: 0.3,
  diversityWeight: 0.5,
};

// 检索结果
export interface RetrievalResult {
  candidateId: string;
  topic?: string;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matches: Array<{
    field: string;
    matchedTokens: string[];
    score: number;
    weight: number;
  }>;
  matchedFields: string[];
  matchedTokenCount: number;
  matchReason: string;
}

// 检索统计
export interface RetrievalStats {
  totalCandidates: number;
  filteredCandidates: number;
  expandedCandidates: number;
  finalCandidates: number;
  topicCoverage: number;
  diversityScore: number;
}

/**
 * 执行检索
 */
export function executeRetrieval(
  query: string,
  candidates: Array<{
    id: string;
    title?: string;
    topic?: string;
    code?: string;
    aiSummary?: string;
    decisionWhat?: string;
    decisionWhy?: string;
    bodySignals?: string;
    moduleSignals?: string;
    status?: string;
    level?: string;
  }>,
  relations: Array<{
    type: string;
    sourceId: string;
    targetId: string;
  }>,
  config: RetrievalConfig = DEFAULT_RETRIEVAL_CONFIG
): { results: RetrievalResult[]; stats: RetrievalStats } {
  const queryTokens = tokenize(query);
  const scopedCandidates = config.explicitTopic
    ? candidates.filter(candidate => candidate.topic === config.explicitTopic)
    : candidates;
  const candidateScores = calculateBatchScores(queryTokens, scopedCandidates);
  const validCandidates = candidateScores.filter(score => score.totalScore > 0);
  const relationIndex = buildRelationIndex(relations as any);
  const expandedCandidates = expandCandidates(
    validCandidates,
    relationIndex,
    new Map(scopedCandidates.map(candidate => [candidate.id, candidate])),
    3
  );
  const mergedScores = mergeWithExpandedScores(
    validCandidates,
    expandedCandidates,
    config.expansionWeight
  );
  const scoreById = new Map(candidateScores.map(score => [score.candidateId, score]));
  const expansionById = new Map(expandedCandidates.map(expanded => [expanded.expandedCandidateId, expanded]));
  const candidatesWithMetadata: CandidateWithMetadata[] = [];
  for (const candidate of scopedCandidates) {
    const mergedScore = mergedScores.get(candidate.id);
    if (mergedScore === undefined) continue;
    const direct = scoreById.get(candidate.id);
    const expansion = expansionById.get(candidate.id);
    const relationMatch: MatchResult[] = expansion
      ? [{ field: 'relation', matchedTokens: [expansion.relationType], score: mergedScore, weight: expansion.relationWeight }]
      : [];
    const matches = direct?.matches.length ? direct.matches : relationMatch;
    const matchedFields = direct?.matchedFields.length ? direct.matchedFields : relationMatch.map(match => match.field);
    const matchedTokenCount = direct?.matchedTokenCount ?? relationMatch.length;
    const baseScore: CandidateScore = direct ?? {
      candidateId: candidate.id,
      totalScore: mergedScore,
      confidence: calculateConfidence(mergedScore, matchedFields.length, matchedTokenCount),
      matches,
      matchedFields,
      matchedTokenCount,
    };
    candidatesWithMetadata.push({
      ...baseScore,
      totalScore: mergedScore,
      matches,
      matchedFields,
      matchedTokenCount,
      ...candidate,
    });
  }
  const sortedCandidates = stableSortCandidates(candidatesWithMetadata as any);
  const diversifiedCandidates = applyDiversityPruning(
    sortedCandidates,
    {
      maxPerTopic: config.maxPerTopic,
      maxTotal: config.maxResults,
      explicitTopic: config.explicitTopic,
      levelPriority: ['L1', 'L2', 'L3'],
    }
  );
  
  const results: RetrievalResult[] = diversifiedCandidates.map(candidate => ({
    candidateId: candidate.candidateId,
    topic: candidate.topic,
    score: candidate.totalScore,
    confidence: candidate.confidence,
    matches: candidate.matches,
    matchedFields: candidate.matchedFields,
    matchedTokenCount: candidate.matchedTokenCount,
    matchReason: generateMatchReason(candidate),
  }));
  
  const stats: RetrievalStats = {
    totalCandidates: scopedCandidates.length,
    filteredCandidates: validCandidates.length,
    expandedCandidates: expandedCandidates.length,
    finalCandidates: results.length,
    topicCoverage: calculateTopicCoverage(results, candidates),
    diversityScore: calculateDiversityScore(results),
  };
  
  return { results, stats };
}

/**
 * 计算 topic 覆盖率
 */
function calculateTopicCoverage(
  results: RetrievalResult[],
  candidates: Array<{ topic?: string }>
): number {
  const allTopics = new Set(candidates.map(c => c.topic).filter(Boolean));
  const resultTopics = new Set(results.map(result => result.topic).filter(Boolean));
  
  return allTopics.size > 0 ? resultTopics.size / allTopics.size : 0;
}

/**
 * 计算多样性分数
 */
function calculateDiversityScore(results: RetrievalResult[]): number {
  if (results.length === 0) return 0;
  
  const topics = new Set(results.map(result => result.topic ?? 'unknown'));
  
  return topics.size / results.length;
}
