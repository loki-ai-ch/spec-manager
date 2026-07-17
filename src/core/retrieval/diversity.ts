/**
 * 多样性裁剪模块
 * 实现 topic 多样性限制和层级优先级
 */

import type { CandidateWithMetadata } from './sorting.js';

// 多样性配置
export interface DiversityConfig {
  // 每个 topic 的最大结果数
  maxPerTopic: number;
  // 总结果数限制
  maxTotal: number;
  // 显式 topic（不受多样性限制）
  explicitTopic?: string;
  // 层级优先级
  levelPriority: string[];
}

// 默认多样性配置
export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  maxPerTopic: 2,
  maxTotal: 5,
  levelPriority: ['L1', 'L2', 'L3'],
};

/**
 * 应用多样性裁剪
 */
export function applyDiversityPruning(
  candidates: CandidateWithMetadata[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): CandidateWithMetadata[] {
  if (config.explicitTopic) return candidates.slice(0, config.maxTotal);

  const selected: CandidateWithMetadata[] = [];
  const overflow: CandidateWithMetadata[] = [];
  const topicCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const topic = extractTopic(candidate);
    const count = topicCounts.get(topic) ?? 0;
    if (count < config.maxPerTopic) {
      selected.push(candidate);
      topicCounts.set(topic, count + 1);
    } else {
      overflow.push(candidate);
    }
  }

  const selectedIds = new Set(selected.map(candidate => candidate.candidateId));
  const ranked = candidates.filter(candidate => selectedIds.has(candidate.candidateId));
  for (const candidate of overflow) {
    if (ranked.length >= config.maxTotal) break;
    ranked.push(candidate);
  }
  return ranked.slice(0, config.maxTotal);
}

/**
 * 从候选中提取 topic
 */
function extractTopic(candidate: CandidateWithMetadata): string {
  if (candidate.topic) return candidate.topic;

  // 首先尝试从匹配信息中获取 topic
  const topicMatch = candidate.matches.find(m => m.field === 'topic');
  if (topicMatch && topicMatch.matchedTokens.length > 0) {
    return topicMatch.matchedTokens[0];
  }
  
  // 如果没有 topic 匹配，尝试从 candidateId 中提取
  // 例如：spec-knowledge-loop-L1 -> spec-knowledge-loop
  const parts = candidate.candidateId.split('-');
  if (parts.length >= 2) {
    // 移除最后的级别标识（如 L1, L2, L3）
    const lastPart = parts[parts.length - 1];
    if (/^L\d+$/.test(lastPart)) {
      return parts.slice(0, -1).join('-');
    }
  }
  
  return 'unknown';
}

/**
 * 计算多样性统计信息
 */
export function getDiversityStats(
  originalCandidates: CandidateWithMetadata[],
  prunedCandidates: CandidateWithMetadata[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): {
  originalCount: number;
  prunedCount: number;
  topicCoverage: number;
  levelDistribution: Map<string, number>;
  topicDistribution: Map<string, number>;
  diversityScore: number;
} {
  const originalTopics = new Set(originalCandidates.map(c => extractTopic(c)));
  const prunedTopics = new Set(prunedCandidates.map(c => extractTopic(c)));
  
  const levelDistribution = new Map<string, number>();
  const topicDistribution = new Map<string, number>();
  
  for (const candidate of prunedCandidates) {
    const level = candidate.level || 'unknown';
    levelDistribution.set(level, (levelDistribution.get(level) || 0) + 1);
    
    const topic = extractTopic(candidate);
    topicDistribution.set(topic, (topicDistribution.get(topic) || 0) + 1);
  }
  
  // 计算 topic 覆盖率
  const topicCoverage = originalTopics.size > 0 
    ? prunedTopics.size / originalTopics.size 
    : 0;
  
  // 计算多样性分数（0-1）
  const diversityScore = calculateDiversityScore(
    prunedCandidates.length,
    prunedTopics.size,
    config.maxTotal,
    originalTopics.size
  );
  
  return {
    originalCount: originalCandidates.length,
    prunedCount: prunedCandidates.length,
    topicCoverage,
    levelDistribution,
    topicDistribution,
    diversityScore,
  };
}

/**
 * 计算多样性分数
 */
function calculateDiversityScore(
  resultCount: number,
  topicCount: number,
  maxTotal: number,
  totalTopics: number
): number {
  if (resultCount === 0 || maxTotal === 0) return 0;
  
  // 因素1：结果数量利用率
  const utilization = resultCount / maxTotal;
  
  // 因素2：topic 多样性
  const topicDiversity = totalTopics > 0 
    ? Math.min(topicCount / totalTopics, 1) 
    : 0;
  
  // 因素3：分布均匀性（理想情况下每个 topic 应该有相同数量的结果）
  const idealPerTopic = resultCount / Math.max(topicCount, 1);
  const uniformity = 1 - Math.abs(1 - idealPerTopic) / Math.max(idealPerTopic, 1);
  
  // 加权平均
  return (utilization * 0.4 + topicDiversity * 0.4 + uniformity * 0.2);
}

/**
 * 验证多样性约束
 */
export function validateDiversityConstraints(
  candidates: CandidateWithMetadata[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  
  // 检查总数限制
  if (candidates.length > config.maxTotal) {
    violations.push(`结果数量 ${candidates.length} 超过限制 ${config.maxTotal}`);
  }
  
  // 检查每个 topic 的限制
  const topicCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const topic = extractTopic(candidate);
    const currentCount = topicCounts.get(topic) || 0;
    topicCounts.set(topic, currentCount + 1);
    
    // 显式 topic 不受限制
    if (config.explicitTopic && topic === config.explicitTopic) {
      continue;
    }
    
    if (currentCount + 1 > config.maxPerTopic) {
      violations.push(`Topic "${topic}" 的结果数量 ${currentCount + 1} 超过限制 ${config.maxPerTopic}`);
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * 生成多样性报告
 */
export function generateDiversityReport(
  candidates: CandidateWithMetadata[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): string {
  const stats = getDiversityStats(candidates, candidates, config);
  const validation = validateDiversityConstraints(candidates, config);
  
  const lines = [
    '=== 多样性报告 ===',
    `总结果数: ${stats.prunedCount} / ${config.maxTotal}`,
    `Topic 覆盖率: ${(stats.topicCoverage * 100).toFixed(1)}%`,
    `多样性分数: ${(stats.diversityScore * 100).toFixed(1)}%`,
    '',
    '--- Topic 分布 ---',
  ];
  
  for (const [topic, count] of stats.topicDistribution) {
    const status = count <= config.maxPerTopic ? '✓' : '✗';
    lines.push(`${status} ${topic}: ${count} / ${config.maxPerTopic}`);
  }
  
  lines.push('', '--- 层级分布 ---');
  for (const [level, count] of stats.levelDistribution) {
    lines.push(`${level}: ${count}`);
  }
  
  if (!validation.isValid) {
    lines.push('', '--- 违规项 ---');
    for (const violation of validation.violations) {
      lines.push(`✗ ${violation}`);
    }
  }
  
  return lines.join('\n');
}
