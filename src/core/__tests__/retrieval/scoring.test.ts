import { describe, it, expect } from "vitest";
import {
  calculateFieldScore,
  calculateCandidateScore,
  calculateBatchScores,
  filterValidCandidates,
  getConfidenceWeight,
  normalizeScore,
  generateMatchReason,
  FIELD_WEIGHTS,
} from '../../retrieval/scoring';

describe('scoring', () => {
  describe('calculateFieldScore', () => {
    it('should calculate score for matching tokens', () => {
      const queryTokens = ['hello', 'world'];
      const fieldTokens = ['hello', 'world', 'foo'];
      const weight = 1.0;
      
      const result = calculateFieldScore(queryTokens, fieldTokens, weight);
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchedTokens).toEqual(['hello', 'world']);
    });

    it('should return 0 for no matches', () => {
      const queryTokens = ['foo', 'bar'];
      const fieldTokens = ['hello', 'world'];
      const weight = 1.0;
      
      const result = calculateFieldScore(queryTokens, fieldTokens, weight);
      
      expect(result.score).toBe(0);
      expect(result.matchedTokens).toEqual([]);
    });

    it('should apply field weight', () => {
      const queryTokens = ['hello'];
      const fieldTokens = ['hello'];
      const weight = 2.0;
      
      const result = calculateFieldScore(queryTokens, fieldTokens, weight);
      
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle empty arrays', () => {
      expect(calculateFieldScore([], ['hello'], 1.0).score).toBe(0);
      expect(calculateFieldScore(['hello'], [], 1.0).score).toBe(0);
    });
  });

  describe('calculateCandidateScore', () => {
    it('should calculate total score for candidate', () => {
      const queryTokens = ['hello', 'world'];
      const candidate = {
        id: 'test-1',
        title: 'Hello World',
        topic: 'test',
        code: 'test-1',
        aiSummary: 'A test spec',
      };
      
      const result = calculateCandidateScore(queryTokens, candidate);
      
      expect(result.candidateId).toBe('test-1');
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.confidence).not.toBe('none');
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should return none confidence for no matches', () => {
      const queryTokens = ['foo', 'bar'];
      const candidate = {
        id: 'test-1',
        title: 'Hello World',
      };
      
      const result = calculateCandidateScore(queryTokens, candidate);
      
      expect(result.totalScore).toBe(0);
      expect(result.confidence).toBe('none');
    });
  });

  describe('calculateBatchScores', () => {
    it('should calculate scores for multiple candidates', () => {
      const queryTokens = ['hello'];
      const candidates = [
        { id: 'test-1', title: 'Hello World' },
        { id: 'test-2', title: 'Foo Bar' },
        { id: 'test-3', title: 'Hello Test' },
      ];
      
      const results = calculateBatchScores(queryTokens, candidates);
      
      expect(results.length).toBe(3);
      expect(results[0].totalScore).toBeGreaterThan(0);
      expect(results[1].totalScore).toBe(0);
      expect(results[2].totalScore).toBeGreaterThan(0);
    });
  });

  describe('filterValidCandidates', () => {
    it('should filter out candidates with none confidence', () => {
      const candidates = [
        { candidateId: 'test-1', totalScore: 5, confidence: 'high' as const, matches: [], matchedFields: [], matchedTokenCount: 2 },
        { candidateId: 'test-2', totalScore: 0, confidence: 'none' as const, matches: [], matchedFields: [], matchedTokenCount: 0 },
        { candidateId: 'test-3', totalScore: 2, confidence: 'medium' as const, matches: [], matchedFields: [], matchedTokenCount: 1 },
      ];
      
      const result = filterValidCandidates(candidates);
      
      expect(result.length).toBe(2);
      expect(result[0].candidateId).toBe('test-1');
      expect(result[1].candidateId).toBe('test-3');
    });
  });

  describe('getConfidenceWeight', () => {
    it('should return correct weights', () => {
      expect(getConfidenceWeight('high')).toBe(1.0);
      expect(getConfidenceWeight('medium')).toBe(0.7);
      expect(getConfidenceWeight('low')).toBe(0.4);
      expect(getConfidenceWeight('none')).toBe(0.0);
    });
  });

  describe('normalizeScore', () => {
    it('should normalize score to 0-1 range', () => {
      expect(normalizeScore(5, 10)).toBe(0.5);
      expect(normalizeScore(10, 10)).toBe(1.0);
      expect(normalizeScore(15, 10)).toBe(1.0); // 应该被限制在 1.0
      expect(normalizeScore(0, 10)).toBe(0);
    });

    it('should handle maxScore of 0', () => {
      expect(normalizeScore(5, 0)).toBe(0);
    });
  });

  describe('generateMatchReason', () => {
    it('should generate reason for high confidence', () => {
      const candidateScore = {
        candidateId: 'test-1',
        totalScore: 5,
        confidence: 'high' as const,
        matches: [],
        matchedFields: ['title', 'topic', 'aiSummary'],
        matchedTokenCount: 3,
      };
      
      const result = generateMatchReason(candidateScore);
      
      expect(result).toContain('高度相关');
      expect(result).toContain('标题');
      expect(result).toContain('主题');
      expect(result).toContain('AI 摘要');
    });

    it('should generate reason for no match', () => {
      const candidateScore = {
        candidateId: 'test-1',
        totalScore: 0,
        confidence: 'none' as const,
        matches: [],
        matchedFields: [],
        matchedTokenCount: 0,
      };
      
      const result = generateMatchReason(candidateScore);
      
      expect(result).toBe('无匹配');
    });
  });
});
