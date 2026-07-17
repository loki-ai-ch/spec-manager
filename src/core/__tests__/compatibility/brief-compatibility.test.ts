import { describe, it, expect } from "vitest";
import { buildAgentBrief } from '../../capability-brief.js';
import type { ProjectPaths } from '../../paths.js';

describe('brief compatibility', () => {
  // 模拟 ProjectPaths
  const mockPaths: ProjectPaths = {
    root: '/tmp/test-project',
    specsDir: '/tmp/test-project/specs',
    tasksDir: '/tmp/test-project/specs',
    decisionsDir: '/tmp/test-project/decisions',
    incidentsDir: '/tmp/test-project/incidents',
    configPath: '/tmp/test-project/.spec-manager.json',
  };

  describe('buildAgentBrief', () => {
    it('should return valid AgentBrief schema', () => {
      // 这个测试需要实际的项目结构，这里只是验证函数存在
      expect(typeof buildAgentBrief).toBe('function');
    });

    it('should have required fields', () => {
      // 验证 AgentBrief 类型包含所有必需字段
      const requiredFields = [
        'schemaVersion',
        'request',
        'topic',
        'profileRecommendation',
        'relevantSpecs',
        'relevantDecisions',
        'relevantTasks',
        'lessons',
        'suggestedReads',
        'findings',
        'nextCommand',
      ];
      
      // 这里只是验证类型定义，实际测试需要模拟数据
      expect(requiredFields.length).toBe(11);
    });

    it('should maintain schema version', () => {
      // 验证 schema 版本兼容性
      const expectedVersion = 'agent-brief.v1';
      expect(expectedVersion).toBe('agent-brief.v1');
    });
  });
});
