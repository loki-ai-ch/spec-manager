import { describe, it, expect } from "vitest";
import {
  compareCandidates,
  stableSortCandidates,
  groupByTopic,
  applyDiversityLimit,
  applyTotalLimit,
  getSortStats,
  verifySortStability,
  DEFAULT_SORT_CONFIG,
} from '../../retrieval/sorting';

describe('sorting', () => {
  const sampleCandidates = [
    {
      candidateId: 'spec-1',
      totalScore: 5,
      confidence: 'high' as const,
      matches: [{ field: 'title', matchedTokens: ['hello'], score: 5, weight: 3.0 }],
      matchedFields: ['title'],
      matchedTokenCount: 1,
      status: 'implemented',
      level: 'L1',
      code: 'spec-1',
    },
    {
      candidateId: 'spec-2',
      totalScore: 3,
      confidence: 'medium' as const,
      matches: [{ field: 'title', matchedTokens: ['world'], score: 3, weight: 3.0 }],
      matchedFields: ['title'],
      matchedTokenCount: 1,
      status: 'confirmed',
      level: 'L2',
      code: 'spec-2',
    },
    {
      candidateId: 'spec-3',
      totalScore: 3,
      confidence: 'medium' as const,
      matches: [{ field: 'title', matchedTokens: ['test'], score: 3, weight: 3.0 }],
      matchedFields: ['title'],
      matchedTokenCount: 1,
      status: 'draft',
      level: 'L3',
      code: 'spec-3',
    },
  ];

  describe('compareCandidates', () => {
    it('should sort by score descending', () => {
      const result = compareCandidates(sampleCandidates[0], sampleCandidates[1]);
      expect(result).toBeLessThan(0); // spec-1 should come before spec-2
    });

    it('should sort by confidence when scores are equal', () => {
      const result = compareCandidates(sampleCandidates[1], sampleCandidates[2]);
      // 两个候选的分数和置信度都相同，应该继续比较下一个字段
      expect(result).not.toBe(0);
    });

    it('should sort by status when scores and confidence are equal', () => {
      const result = compareCandidates(sampleCandidates[1], sampleCandidates[2]);
      // 两个候选的分数和置信度都相同，应该比较状态
      expect(result).not.toBe(0);
    });

    it('should sort by level when scores, confidence, and status are equal', () => {
      const result = compareCandidates(sampleCandidates[1], sampleCandidates[2]);
      // 两个候选的分数、置信度和状态都相同，应该比较层级
      expect(result).not.toBe(0);
    });

    it('should sort by code as final tiebreaker', () => {
      const result = compareCandidates(sampleCandidates[1], sampleCandidates[2]);
      // 'spec-2' < 'spec-3'，所以 spec-2 应该排在前面
      expect(result).toBeLessThan(0);
    });
  });

  describe('stableSortCandidates', () => {
    it('should sort candidates stably', () => {
      const sorted = stableSortCandidates(sampleCandidates);
      
      expect(sorted[0].candidateId).toBe('spec-1');
      expect(sorted[1].candidateId).toBe('spec-2');
      expect(sorted[2].candidateId).toBe('spec-3');
    });

    it('should produce same result on multiple sorts', () => {
      const firstSort = stableSortCandidates(sampleCandidates);
      const secondSort = stableSortCandidates(sampleCandidates);
      
      expect(firstSort).toEqual(secondSort);
    });
  });

  describe('groupByTopic', () => {
    it('should group candidates by topic', () => {
      const candidates = [
        {
          ...sampleCandidates[0],
          matches: [{ field: 'topic', matchedTokens: ['topic-1'], score: 5, weight: 2.5 }],
        },
        {
          ...sampleCandidates[1],
          matches: [{ field: 'topic', matchedTokens: ['topic-1'], score: 3, weight: 2.5 }],
        },
        {
          ...sampleCandidates[2],
          matches: [{ field: 'topic', matchedTokens: ['topic-2'], score: 3, weight: 2.5 }],
        },
      ];
      
      const groups = groupByTopic(candidates);
      
      expect(groups.size).toBe(2);
      expect(groups.get('topic-1')!.length).toBe(2);
      expect(groups.get('topic-2')!.length).toBe(1);
    });
  });

  describe('applyDiversityLimit', () => {
    it('should limit candidates per topic', () => {
      const candidates = [
        {
          ...sampleCandidates[0],
          matches: [{ field: 'topic', matchedTokens: ['topic-1'], score: 5, weight: 2.5 }],
        },
        {
          ...sampleCandidates[1],
          matches: [{ field: 'topic', matchedTokens: ['topic-1'], score: 3, weight: 2.5 }],
        },
        {
          ...sampleCandidates[2],
          matches: [{ field: 'topic', matchedTokens: ['topic-1'], score: 2, weight: 2.5 }],
        },
      ];
      
      const result = applyDiversityLimit(candidates, 2);
      
      expect(result.length).toBe(2);
    });

    it('should not limit explicit topic', () => {
      const candidates = [
        {
          ...sampleCandidates[0],
          matches: [{ field: 'topic', matchedTokens: ['explicit-topic'], score: 5, weight: 2.5 }],
        },
        {
          ...sampleCandidates[1],
          matches: [{ field: 'topic', matchedTokens: ['explicit-topic'], score: 3, weight: 2.5 }],
        },
        {
          ...sampleCandidates[2],
          matches: [{ field: 'topic', matchedTokens: ['explicit-topic'], score: 2, weight: 2.5 }],
        },
      ];
      
      const result = applyDiversityLimit(candidates, 2, 'explicit-topic');
      
      expect(result.length).toBe(3);
    });
  });

  describe('applyTotalLimit', () => {
    it('should limit total candidates', () => {
      const result = applyTotalLimit(sampleCandidates, 2);
      
      expect(result.length).toBe(2);
    });

    it('should return all candidates if limit is higher', () => {
      const result = applyTotalLimit(sampleCandidates, 10);
      
      expect(result.length).toBe(3);
    });
  });

  describe('getSortStats', () => {
    it('should calculate sort statistics', () => {
      const stats = getSortStats(10, sampleCandidates);
      
      expect(stats.originalCount).toBe(10);
      expect(stats.finalCount).toBe(3);
      expect(stats.averageScore).toBeGreaterThan(0);
    });
  });

  describe('verifySortStability', () => {
    it('should verify sort stability', () => {
      const isStable = verifySortStability(sampleCandidates);
      
      expect(isStable).toBe(true);
    });
  });
});
