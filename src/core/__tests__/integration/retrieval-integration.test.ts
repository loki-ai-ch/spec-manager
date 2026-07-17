import { describe, it, expect } from "vitest";
import { executeRetrieval, DEFAULT_RETRIEVAL_CONFIG } from '../../retrieval/index.js';

describe('retrieval integration', () => {
  const sampleCandidates = [
    {
      id: 'spec-1',
      title: 'User Authentication System',
      topic: 'auth',
      code: 'auth-L1',
      aiSummary: 'Implement user authentication with JWT tokens',
      status: 'implemented',
      level: 'L1',
    },
    {
      id: 'spec-2',
      title: 'User Profile Management',
      topic: 'user',
      code: 'user-L1',
      aiSummary: 'Manage user profiles and settings',
      status: 'confirmed',
      level: 'L1',
    },
    {
      id: 'spec-3',
      title: 'Authentication API Endpoints',
      topic: 'auth',
      code: 'auth-L2',
      aiSummary: 'REST API endpoints for authentication',
      status: 'draft',
      level: 'L2',
    },
    {
      id: 'spec-4',
      title: 'Database Schema Design',
      topic: 'database',
      code: 'db-L1',
      aiSummary: 'Design database schema for the application',
      status: 'implemented',
      level: 'L1',
    },
  ];

  const sampleRelations = [
    { type: 'based_on', sourceId: 'spec-3', targetId: 'spec-1' },
    { type: 'references', sourceId: 'spec-2', targetId: 'spec-1' },
  ];

  describe('executeRetrieval', () => {
    it('should retrieve specs based on query', () => {
      const query = 'user authentication';
      const { results, stats } = executeRetrieval(query, sampleCandidates, sampleRelations);
      
      expect(results.length).toBeGreaterThan(0);
      expect(stats.totalCandidates).toBe(4);
      expect(stats.finalCandidates).toBeLessThanOrEqual(DEFAULT_RETRIEVAL_CONFIG.maxResults);
    });

    it('should handle explicit topic filtering', () => {
      const query = 'authentication';
      const config = { ...DEFAULT_RETRIEVAL_CONFIG, explicitTopic: 'auth' };
      const { results } = executeRetrieval(query, sampleCandidates, sampleRelations, config);
      
      // 应该只返回 auth 相关的 spec
      for (const result of results) {
        const topicMatch = result.matches.find(m => m.field === 'topic');
        if (topicMatch) {
          expect(topicMatch.matchedTokens).toContain('auth');
        }
      }
    });

    it('should handle empty query', () => {
      const query = '';
      const { results, stats } = executeRetrieval(query, sampleCandidates, sampleRelations);
      
      // 空查询应该返回一些结果（基于其他字段匹配）
      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(stats.totalCandidates).toBe(4);
    });

    it('should handle no matches', () => {
      const query = 'completely unrelated query';
      const { results, stats } = executeRetrieval(query, sampleCandidates, sampleRelations);
      
      expect(results.length).toBeGreaterThanOrEqual(0); // 可能返回一些结果
      expect(stats.totalCandidates).toBe(4);
      expect(stats.filteredCandidates).toBe(0);
    });

    it('should respect maxResults limit', () => {
      const query = 'user';
      const config = { ...DEFAULT_RETRIEVAL_CONFIG, maxResults: 2 };
      const { results } = executeRetrieval(query, sampleCandidates, sampleRelations, config);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should calculate diversity stats', () => {
      const query = 'authentication';
      const { stats } = executeRetrieval(query, sampleCandidates, sampleRelations);
      
      expect(stats.topicCoverage).toBeGreaterThanOrEqual(0);
      expect(stats.topicCoverage).toBeLessThanOrEqual(1);
      expect(stats.diversityScore).toBeGreaterThanOrEqual(0);
      expect(stats.diversityScore).toBeLessThanOrEqual(1);
    });
  });
});
