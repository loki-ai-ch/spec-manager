/**
 * 稳定排序模块
 * 实现基于多维度的稳定排序算法
 */

import { getConfidenceWeight } from './scoring.js';
import type { CandidateScore, ConfidenceLevel } from './scoring.js';

// 排序配置
export interface SortConfig {
  // 主要排序键：匹配分数
  primarySort: 'score';
  // 次要排序键优先级
  secondarySortPriority: Array<'confidence' | 'status' | 'level' | 'code'>;
  // 排序方向
  direction: 'asc' | 'desc';
}

// 默认排序配置
export const DEFAULT_SORT_CONFIG: SortConfig = {
  primarySort: 'score',
  secondarySortPriority: ['confidence', 'status', 'level', 'code'],
  direction: 'desc',
};

// 状态权重
export const STATUS_WEIGHTS: Record<string, number> = {
  implemented: 4,
  confirmed: 3,
  draft: 2,
  deprecated: 1,
  removed: 0,
};

// 层级权重
export const LEVEL_WEIGHTS: Record<string, number> = {
  L1: 3,
  L2: 2,
  L3: 1,
  L0: 0,
};

// 候选项（包含元数据）
export interface CandidateWithMetadata extends CandidateScore {
  topic?: string;
  status?: string;
  level?: string;
  code?: string;
}

/**
 * 比较两个候选项
 * 返回负数表示 a 应该排在 b 前面
 */
export function compareCandidates(
  a: CandidateWithMetadata,
  b: CandidateWithMetadata,
  config: SortConfig = DEFAULT_SORT_CONFIG
): number {
  // 主要排序：匹配分数
  const scoreDiff = config.direction === 'desc' 
    ? b.totalScore - a.totalScore 
    : a.totalScore - b.totalScore;
  
  if (Math.abs(scoreDiff) > 0.001) {
    return scoreDiff;
  }
  
  // 次要排序：按优先级依次比较
  for (const sortKey of config.secondarySortPriority) {
    let diff = 0;
    
    switch (sortKey) {
      case 'confidence':
        diff = getConfidenceWeight(b.confidence) - getConfidenceWeight(a.confidence);
        break;
        
      case 'status':
        const aStatusWeight = STATUS_WEIGHTS[a.status || ''] || 0;
        const bStatusWeight = STATUS_WEIGHTS[b.status || ''] || 0;
        diff = bStatusWeight - aStatusWeight;
        break;
        
      case 'level':
        const aLevelWeight = LEVEL_WEIGHTS[a.level || ''] || 0;
        const bLevelWeight = LEVEL_WEIGHTS[b.level || ''] || 0;
        diff = bLevelWeight - aLevelWeight;
        break;
        
      case 'code':
        // 按字母顺序排序
        const aCode = a.code || a.candidateId;
        const bCode = b.code || b.candidateId;
        diff = aCode.localeCompare(bCode);
        break;
    }
    
    if (Math.abs(diff) > 0.001) {
      return diff;
    }
  }
  
  // 最终回退：按 candidateId 排序（确保稳定性）
  return a.candidateId.localeCompare(b.candidateId);
}

/**
 * 对候选项进行稳定排序
 */
export function stableSortCandidates(
  candidates: CandidateWithMetadata[],
  config: SortConfig = DEFAULT_SORT_CONFIG
): CandidateWithMetadata[] {
  // 使用 Array.sort，它在现代引擎中是稳定的
  return [...candidates].sort((a, b) => compareCandidates(a, b, config));
}

/**
 * 按 topic 分组并排序
 */
export function groupByTopic(
  candidates: CandidateWithMetadata[]
): Map<string, CandidateWithMetadata[]> {
  const groups = new Map<string, CandidateWithMetadata[]>();
  
  for (const candidate of candidates) {
    const topic = candidate.matches.find(m => m.field === 'topic')?.matchedTokens[0] || 'unknown';
    
    if (!groups.has(topic)) {
      groups.set(topic, []);
    }
    
    groups.get(topic)!.push(candidate);
  }
  
  // 对每个组进行排序
  for (const [topic, group] of groups) {
    groups.set(topic, stableSortCandidates(group));
  }
  
  return groups;
}

/**
 * 应用 topic 多样性限制
 */
export function applyDiversityLimit(
  candidates: CandidateWithMetadata[],
  maxPerTopic: number = 2,
  explicitTopic?: string
): CandidateWithMetadata[] {
  const topicCounts = new Map<string, number>();
  const result: CandidateWithMetadata[] = [];
  
  for (const candidate of candidates) {
    const topic = candidate.matches.find(m => m.field === 'topic')?.matchedTokens[0] || 'unknown';
    
    // 显式 topic 不受多样性限制
    if (explicitTopic && topic === explicitTopic) {
      result.push(candidate);
      continue;
    }
    
    const currentCount = topicCounts.get(topic) || 0;
    
    if (currentCount < maxPerTopic) {
      result.push(candidate);
      topicCounts.set(topic, currentCount + 1);
    }
  }
  
  return result;
}

/**
 * 应用总数限制
 */
export function applyTotalLimit(
  candidates: CandidateWithMetadata[],
  maxTotal: number = 5
): CandidateWithMetadata[] {
  return candidates.slice(0, maxTotal);
}

/**
 * 生成排序统计信息
 */
export function getSortStats(
  originalCount: number,
  sortedCandidates: CandidateWithMetadata[]
): {
  originalCount: number;
  finalCount: number;
  topicDistribution: Map<string, number>;
  confidenceDistribution: Map<ConfidenceLevel, number>;
  averageScore: number;
} {
  const topicDistribution = new Map<string, number>();
  const confidenceDistribution = new Map<ConfidenceLevel, number>();
  let totalScore = 0;
  
  for (const candidate of sortedCandidates) {
    // 统计 topic 分布
    const topic = candidate.matches.find(m => m.field === 'topic')?.matchedTokens[0] || 'unknown';
    topicDistribution.set(topic, (topicDistribution.get(topic) || 0) + 1);
    
    // 统计置信度分布
    confidenceDistribution.set(
      candidate.confidence,
      (confidenceDistribution.get(candidate.confidence) || 0) + 1
    );
    
    totalScore += candidate.totalScore;
  }
  
  const averageScore = sortedCandidates.length > 0 
    ? totalScore / sortedCandidates.length 
    : 0;
  
  return {
    originalCount,
    finalCount: sortedCandidates.length,
    topicDistribution,
    confidenceDistribution,
    averageScore,
  };
}

/**
 * 验证排序稳定性
 * 用于测试：相同输入应该产生相同输出
 */
export function verifySortStability(
  candidates: CandidateWithMetadata[],
  config: SortConfig = DEFAULT_SORT_CONFIG
): boolean {
  const firstSort = stableSortCandidates(candidates, config);
  const secondSort = stableSortCandidates(candidates, config);
  
  if (firstSort.length !== secondSort.length) {
    return false;
  }
  
  for (let i = 0; i < firstSort.length; i++) {
    if (firstSort[i].candidateId !== secondSort[i].candidateId) {
      return false;
    }
  }
  
  return true;
}
