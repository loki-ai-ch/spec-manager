/**
 * 候选评分模块
 * 实现字段权重配置、匹配算法和置信度计算
 */

import { tokenize } from './normalization.js';

// 字段权重配置
export const FIELD_WEIGHTS = {
  title: 3.0,
  topic: 2.5,
  code: 2.0,
  aiSummary: 1.5,
  decisionWhat: 1.0,
  decisionWhy: 1.0,
  bodySignals: 0.75,
  moduleSignals: 1.25,
} as const;

// 置信度等级
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

// 匹配结果
export interface MatchResult {
  field: string;
  matchedTokens: string[];
  score: number;
  weight: number;
}

// 候选评分结果
export interface CandidateScore {
  candidateId: string;
  totalScore: number;
  confidence: ConfidenceLevel;
  matches: MatchResult[];
  matchedFields: string[];
  matchedTokenCount: number;
}

/**
 * 计算单个字段的匹配分数
 * 基于 TF-IDF 变体，考虑词频和文档频率
 */
export function calculateFieldScore(
  queryTokens: string[],
  fieldTokens: string[],
  fieldWeight: number
): { score: number; matchedTokens: string[] } {
  if (!queryTokens.length || !fieldTokens.length) {
    return { score: 0, matchedTokens: [] };
  }
  
  // 计算词频 (TF)
  const fieldTokenFreq = new Map<string, number>();
  for (const token of fieldTokens) {
    fieldTokenFreq.set(token, (fieldTokenFreq.get(token) || 0) + 1);
  }
  
  // 计算匹配的 token
  const matchedTokens: string[] = [];
  let totalScore = 0;
  
  for (const queryToken of queryTokens) {
    const freq = fieldTokenFreq.get(queryToken);
    if (freq) {
      // 计算 TF 分数 (对数缩放)
      const tfScore = Math.log(1 + freq);
      totalScore += tfScore;
      matchedTokens.push(queryToken);
    }
  }
  
  // 应用字段权重
  const weightedScore = totalScore * fieldWeight;
  
  return { score: weightedScore, matchedTokens };
}

/**
 * 计算候选的总匹配分数
 */
export function calculateCandidateScore(
  queryTokens: string[],
  candidate: {
    id: string;
    title?: string;
    topic?: string;
    code?: string;
    aiSummary?: string;
    decisionWhat?: string;
    decisionWhy?: string;
    bodySignals?: string;
    moduleSignals?: string;
  }
): CandidateScore {
  const matches: MatchResult[] = [];
  let totalScore = 0;
  let matchedTokenCount = 0;
  const matchedFields: string[] = [];
  
  // 计算每个字段的匹配分数
  const fieldCalculations = [
    { field: 'title', text: candidate.title, weight: FIELD_WEIGHTS.title },
    { field: 'topic', text: candidate.topic, weight: FIELD_WEIGHTS.topic },
    { field: 'code', text: candidate.code, weight: FIELD_WEIGHTS.code },
    { field: 'aiSummary', text: candidate.aiSummary, weight: FIELD_WEIGHTS.aiSummary },
    { field: 'decisionWhat', text: candidate.decisionWhat, weight: FIELD_WEIGHTS.decisionWhat },
    { field: 'decisionWhy', text: candidate.decisionWhy, weight: FIELD_WEIGHTS.decisionWhy },
    { field: 'bodySignals', text: candidate.bodySignals, weight: FIELD_WEIGHTS.bodySignals },
    { field: 'moduleSignals', text: candidate.moduleSignals, weight: FIELD_WEIGHTS.moduleSignals },
  ];
  
  for (const { field, text, weight } of fieldCalculations) {
    if (!text) continue;
    
    const fieldTokens = tokenize(text);
    const { score, matchedTokens } = calculateFieldScore(queryTokens, fieldTokens, weight);
    
    if (score > 0) {
      matches.push({
        field,
        matchedTokens,
        score,
        weight,
      });
      
      totalScore += score;
      matchedTokenCount += matchedTokens.length;
      matchedFields.push(field);
    }
  }
  
  // 计算置信度
  const confidence = calculateConfidence(totalScore, matchedFields.length, matchedTokenCount);
  
  return {
    candidateId: candidate.id,
    totalScore,
    confidence,
    matches,
    matchedFields,
    matchedTokenCount,
  };
}

/**
 * 计算置信度等级
 */
export function calculateConfidence(
  totalScore: number,
  matchedFieldCount: number,
  matchedTokenCount: number
): ConfidenceLevel {
  // 高置信度：分数高且匹配字段多
  if (totalScore >= 5.0 && matchedFieldCount >= 3) {
    return 'high';
  }
  
  // 中置信度：分数中等或匹配字段较多
  if (totalScore >= 2.0 || matchedFieldCount >= 2) {
    return 'medium';
  }
  
  // 低置信度：有一些匹配
  if (totalScore > 0 && matchedTokenCount > 0) {
    return 'low';
  }
  
  // 无置信度：无匹配
  return 'none';
}

/**
 * 批量计算多个候选的分数
 */
export function calculateBatchScores(
  queryTokens: string[],
  candidates: Array<{
    id: string;
    title?: string;
    topic?: string;
    code?: string;
    aiSummary?: string;
    decisionWhat?: string;
    decisionWhy?: string;
  }>
): CandidateScore[] {
  return candidates.map(candidate => 
    calculateCandidateScore(queryTokens, candidate)
  );
}

/**
 * 过滤掉置信度为 'none' 的候选
 */
export function filterValidCandidates(scores: CandidateScore[]): CandidateScore[] {
  return scores.filter(score => score.confidence !== 'none');
}

/**
 * 获取置信度权重（用于排序）
 */
export function getConfidenceWeight(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'high': return 1.0;
    case 'medium': return 0.7;
    case 'low': return 0.4;
    case 'none': return 0.0;
  }
}

/**
 * 计算归一化分数（0-1 范围）
 */
export function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.min(score / maxScore, 1.0);
}

/**
 * 生成匹配理由
 */
export function generateMatchReason(candidateScore: CandidateScore): string {
  if (candidateScore.confidence === 'none') {
    return '无匹配';
  }
  
  const { matchedFields, matchedTokenCount, confidence } = candidateScore;
  
  const fieldNames: Record<string, string> = {
    title: '标题',
    topic: '主题',
    code: '代码',
    aiSummary: 'AI 摘要',
    decisionWhat: '决策内容',
    decisionWhy: '决策理由',
  };
  
  const matchedFieldNames = matchedFields
    .map(field => fieldNames[field] || field)
    .join('、');
  
  const confidenceText = {
    high: '高度',
    medium: '中度',
    low: '低度',
  }[confidence] || '';
  
  return `${confidenceText}相关：匹配了${matchedFieldNames}，共${matchedTokenCount}个关键词`;
}
