/**
 * 一跳关系扩展模块
 * 实现基于 Spec 关系的上下文扩展
 */

import type { CandidateScore } from './scoring.js';

// 关系类型权重
export const RELATION_WEIGHTS = {
  based_on: 0.8,
  references: 0.6,
  implements: 0.9,
  supersedes: 0.7,
  parent: 0.7,
  child: 0.7,
  related: 0.5,
} as const;

// 关系类型
export type RelationType = keyof typeof RELATION_WEIGHTS;

// 关系定义
export interface Relation {
  type: RelationType;
  sourceId: string;
  targetId: string;
}

// 关系索引
export interface RelationIndex {
  // 从 specId 到其关系的映射
  outgoing: Map<string, Relation[]>;
  incoming: Map<string, Relation[]>;
}

// 扩展结果
export interface ExpandedCandidate {
  originalCandidateId: string;
  expandedCandidateId: string;
  relationType: RelationType;
  relationWeight: number;
  expansionScore: number;
}

/**
 * 构建关系索引
 */
export function buildRelationIndex(relations: Relation[]): RelationIndex {
  const outgoing = new Map<string, Relation[]>();
  const incoming = new Map<string, Relation[]>();
  
  for (const relation of relations) {
    // 添加到 outgoing 索引
    if (!outgoing.has(relation.sourceId)) {
      outgoing.set(relation.sourceId, []);
    }
    outgoing.get(relation.sourceId)!.push(relation);
    
    // 添加到 incoming 索引
    if (!incoming.has(relation.targetId)) {
      incoming.set(relation.targetId, []);
    }
    incoming.get(relation.targetId)!.push(relation);
  }
  
  return { outgoing, incoming };
}

/**
 * 获取 spec 的一跳关系
 */
export function getOneHopRelations(
  specId: string,
  relationIndex: RelationIndex
): Relation[] {
  const relations: Relation[] = [];
  
  // 获取 outgoing 关系
  const outgoing = relationIndex.outgoing.get(specId) || [];
  relations.push(...outgoing);
  
  // 获取 incoming 关系
  const incoming = relationIndex.incoming.get(specId) || [];
  relations.push(...incoming);
  
  return relations;
}

/**
 * 扩展候选列表
 * 从高分候选扩展到直接关联的 spec/decision/task
 */
export function expandCandidates(
  originalScores: CandidateScore[],
  relationIndex: RelationIndex,
  allCandidates: Map<string, any>, // 所有候选的元数据
  maxExpansionPerCandidate: number = 3
): ExpandedCandidate[] {
  const expandedCandidates: ExpandedCandidate[] = [];
  const processedIds = new Set<string>();
  
  // 按分数排序，优先扩展高分候选
  const sortedScores = [...originalScores].sort((a, b) => b.totalScore - a.totalScore);
  
  for (const score of sortedScores) {
    const relations = getOneHopRelations(score.candidateId, relationIndex);
    
    // 限制每个候选的扩展数量
    const limitedRelations = relations.slice(0, maxExpansionPerCandidate);
    
    for (const relation of limitedRelations) {
      // 确定扩展的目标 ID
      const targetId = relation.sourceId === score.candidateId 
        ? relation.targetId 
        : relation.sourceId;
      
      // 避免重复扩展
      if (processedIds.has(targetId)) {
        continue;
      }
      
      // 检查目标是否在候选列表中
      if (!allCandidates.has(targetId)) {
        continue;
      }
      
      // 计算扩展分数
      const relationWeight = RELATION_WEIGHTS[relation.type] || 0.5;
      const expansionScore = score.totalScore * relationWeight;
      
      expandedCandidates.push({
        originalCandidateId: score.candidateId,
        expandedCandidateId: targetId,
        relationType: relation.type,
        relationWeight,
        expansionScore,
      });
      
      processedIds.add(targetId);
    }
  }
  
  return expandedCandidates;
}

/**
 * 合并原始分数和扩展分数
 */
export function mergeWithExpandedScores(
  originalScores: CandidateScore[],
  expandedCandidates: ExpandedCandidate[],
  expansionWeight: number = 0.3
): Map<string, number> {
  const mergedScores = new Map<string, number>();
  
  // 添加原始分数
  for (const score of originalScores) {
    mergedScores.set(score.candidateId, score.totalScore);
  }
  
  // 添加扩展分数
  for (const expanded of expandedCandidates) {
    const currentScore = mergedScores.get(expanded.expandedCandidateId) || 0;
    const additionalScore = expanded.expansionScore * expansionWeight;
    mergedScores.set(expanded.expandedCandidateId, currentScore + additionalScore);
  }
  
  return mergedScores;
}

/**
 * 过滤无效关系
 */
export function filterValidRelations(relations: Relation[]): Relation[] {
  return relations.filter(relation => {
    // 过滤掉自引用关系
    if (relation.sourceId === relation.targetId) {
      return false;
    }
    
    // 过滤掉未知关系类型
    if (!(relation.type in RELATION_WEIGHTS)) {
      return false;
    }
    
    return true;
  });
}

/**
 * 生成关系描述
 */
export function describeRelation(relation: Relation): string {
  const typeDescriptions: Record<RelationType, string> = {
    based_on: '基于',
    references: '引用',
    implements: '实现',
    supersedes: '替代',
    parent: '父级',
    child: '子级',
    related: '相关',
  };
  
  const typeDesc = typeDescriptions[relation.type] || '关联';
  return `${relation.sourceId} ${typeDesc} ${relation.targetId}`;
}

/**
 * 统计关系信息
 */
export function getRelationStats(relationIndex: RelationIndex): {
  totalRelations: number;
  byType: Record<RelationType, number>;
  averageRelationsPerSpec: number;
} {
  const byType: Record<RelationType, number> = {
    based_on: 0,
    references: 0,
    implements: 0,
    supersedes: 0,
    parent: 0,
    child: 0,
    related: 0,
  };
  
  let totalRelations = 0;
  const specs = new Set<string>();
  
  for (const [specId, relations] of relationIndex.outgoing) {
    specs.add(specId);
    for (const relation of relations) {
      totalRelations++;
      byType[relation.type]++;
    }
  }
  
  for (const [specId, relations] of relationIndex.incoming) {
    specs.add(specId);
    for (const relation of relations) {
      // 避免重复计数（outgoing 已经计数过）
      if (!relationIndex.outgoing.has(specId) || 
          !relationIndex.outgoing.get(specId)!.includes(relation)) {
        totalRelations++;
        byType[relation.type]++;
      }
    }
  }
  
  const averageRelationsPerSpec = specs.size > 0 
    ? totalRelations / specs.size 
    : 0;
  
  return {
    totalRelations,
    byType,
    averageRelationsPerSpec,
  };
}
