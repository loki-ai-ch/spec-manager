import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ProjectPaths } from './paths.js';
import { writeAtomic } from './frontmatter.js';
import { listAllSpecs } from './spec-io.js';

export interface KnowledgeGovernanceConfig {
  enabled: boolean;
  enabledAt: string | null;
  requireHistoryReview: boolean;
  requireScopePlan: boolean;
  requireLearningPolicy: boolean;
}

export function readKnowledgeGovernanceConfig(paths: ProjectPaths): KnowledgeGovernanceConfig {
  const config = readConfig(paths);
  const raw = config.knowledgeGovernance;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { enabled: false, enabledAt: null, requireHistoryReview: true, requireScopePlan: true, requireLearningPolicy: true };
  }
  const value = raw as Record<string, unknown>;
  return {
    enabled: value.enabled === true,
    enabledAt: typeof value.enabledAt === 'string' ? value.enabledAt : null,
    requireHistoryReview: value.requireHistoryReview !== false,
    requireScopePlan: value.requireScopePlan !== false,
    requireLearningPolicy: value.requireLearningPolicy !== false,
  };
}

export function previewKnowledgeGovernance(paths: ProjectPaths) {
  const current = readKnowledgeGovernanceConfig(paths);
  const specs = listAllSpecs(paths);
  return {
    schemaVersion: 'knowledge-governance-adoption.v1',
    current,
    legacy: specs.length,
    rules: ['historyReview', 'scopePlan', 'deliveryLearningPolicy'],
    writes: false,
  };
}

export function enableKnowledgeGovernance(paths: ProjectPaths, now = new Date()): KnowledgeGovernanceConfig {
  const config = readConfig(paths);
  const enabled = {
    enabled: true, enabledAt: now.toISOString(),
    requireHistoryReview: true, requireScopePlan: true, requireLearningPolicy: true,
  };
  config.knowledgeGovernance = enabled;
  writeAtomic(paths.configFile, stringifyYaml(config));
  return enabled;
}

export function isKnowledgeGovernedCreatedAt(paths: ProjectPaths, created?: string): boolean {
  const config = readKnowledgeGovernanceConfig(paths);
  return Boolean(config.enabled && config.enabledAt && created && created >= config.enabledAt);
}

function readConfig(paths: ProjectPaths): Record<string, unknown> {
  if (!existsSync(paths.configFile)) return {};
  const parsed = parseYaml(readFileSync(paths.configFile, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_KNOWLEDGE_GOVERNANCE_CONFIG');
  return { ...parsed as Record<string, unknown> };
}
