import type { ProjectPaths } from './paths.js';
import { readAdaptiveWorkflowConfig, type TaskWorkflowProfile } from './workflow-profile.js';

export type RecommendedWorkflowProfile = 'quick' | 'standard' | 'governed';
export type RiskFactorSeverity = 'low' | 'medium' | 'high';

export interface ProfileRiskFactor {
  id: string;
  severity: RiskFactorSeverity;
  matched: string;
  reason: string;
}

export interface ProfileRecommendation {
  schemaVersion: 'profile-recommendation.experimental.v1';
  ruleVersion: 'profile-recommendation-rules.v1';
  recommendedProfile: RecommendedWorkflowProfile;
  riskFactors: ProfileRiskFactor[];
  reasons: string[];
  override: {
    allowed: true;
    requiresReason: boolean;
    guidance: string;
  };
  adaptiveWorkflow: {
    enabled: boolean;
    defaultProfile: TaskWorkflowProfile;
    note: string;
  };
}

export interface ProfileRecommendationInput {
  paths: ProjectPaths;
  request: string;
  files?: string[];
}

interface Rule {
  id: string;
  profile: RecommendedWorkflowProfile;
  severity: RiskFactorSeverity;
  reason: string;
  terms?: string[];
  fileTerms?: string[];
  fileCountGreaterThan?: number;
}

const RULE_VERSION = 'profile-recommendation-rules.v1';

const RULES: Rule[] = [
  {
    id: 'schema_or_migration',
    profile: 'governed',
    severity: 'high',
    reason: 'Schema, database, or migration changes can corrupt durable project state.',
    terms: ['schema', 'migration', 'database', 'ddl', '数据迁移', '数据库', '表结构'],
    fileTerms: ['src/core/spec-policy.ts', 'schema', 'migration', 'database'],
  },
  {
    id: 'security_or_permission',
    profile: 'governed',
    severity: 'high',
    reason: 'Security, authentication, permission, or payment changes require stronger evidence.',
    terms: ['auth', 'security', 'permission', 'token', 'payment', '权限', '认证', '登录', '支付', '安全'],
  },
  {
    id: 'production_or_deploy',
    profile: 'governed',
    severity: 'high',
    reason: 'Production, release, deploy, or rollback changes have high operational impact.',
    terms: ['deploy', 'production', 'release', 'rollback', '上线', '生产', '发布', '回滚'],
  },
  {
    id: 'workflow_core',
    profile: 'governed',
    severity: 'high',
    reason: 'Core workflow files control status transitions, gates, or evidence semantics.',
    fileTerms: [
      'src/core/task-completion.ts',
      'src/core/integrity.ts',
      'src/core/workflow-profile.ts',
      'src/core/task-evidence.ts',
      'src/core/spec-policy.ts',
      'src/core/task.ts',
    ],
  },
  {
    id: 'multi_file',
    profile: 'standard',
    severity: 'medium',
    reason: 'Multiple files usually need a full spec and task execution record.',
    fileCountGreaterThan: 1,
  },
  {
    id: 'feature_or_refactor',
    profile: 'standard',
    severity: 'medium',
    reason: 'Feature, refactor, CLI, test, or docs+code work should use the full workflow.',
    terms: ['feature', 'refactor', 'cli', 'test', 'docs+code', '功能', '重构', '测试'],
  },
  {
    id: 'spec_workflow',
    profile: 'standard',
    severity: 'medium',
    reason: 'Spec workflow changes should preserve review and execution traceability.',
    terms: ['spec', 'l1', 'l2', 'l3', 'task', 'workflow'],
  },
  {
    id: 'small_text_change',
    profile: 'quick',
    severity: 'low',
    reason: 'Small text, formatting, comment, or typo changes may fit the quick exception.',
    terms: ['typo', 'format', 'comment', 'copy', '文案', '注释', '格式', '错别字'],
  },
];

const PROFILE_RANK: Record<RecommendedWorkflowProfile, number> = {
  quick: 1,
  standard: 2,
  governed: 3,
};

export function recommendWorkflowProfile(input: ProfileRecommendationInput): ProfileRecommendation {
  const request = input.request.trim();
  if (!request) {
    throw new Error('PROFILE_RECOMMENDATION_REQUEST_REQUIRED: --request must be non-empty');
  }

  const files = normalizeFiles(input.files);
  const adaptive = readAdaptiveWorkflowConfig(input.paths);
  const riskFactors = collectRiskFactors(request, files);
  const recommendedProfile = chooseProfile(riskFactors);
  const finalRiskFactors = riskFactors.length > 0
    ? riskFactors
    : [{
      id: 'default_standard',
      severity: 'medium' as const,
      matched: 'default',
      reason: 'Default non-quick work uses the full spec workflow.',
    }];
  const profile = riskFactors.length > 0 ? recommendedProfile : 'standard';

  return {
    schemaVersion: 'profile-recommendation.experimental.v1',
    ruleVersion: RULE_VERSION,
    recommendedProfile: profile,
    riskFactors: finalRiskFactors,
    reasons: reasonsFor(profile, finalRiskFactors),
    override: {
      allowed: true,
      requiresReason: profile !== 'quick',
      guidance: overrideGuidance(profile),
    },
    adaptiveWorkflow: {
      enabled: adaptive.enabled,
      defaultProfile: adaptive.defaultProfile,
      note: adaptive.enabled
        ? `adaptive workflow enabled; default task profile is ${adaptive.defaultProfile}`
        : 'adaptive workflow disabled; recommendation does not change legacy completion semantics',
    },
  };
}

function collectRiskFactors(request: string, files: string[]): ProfileRiskFactor[] {
  const normalizedRequest = request.toLowerCase();
  const normalizedFiles = files.map(file => file.toLowerCase());
  const factors: ProfileRiskFactor[] = [];

  for (const rule of RULES) {
    const matched = matchRule(rule, normalizedRequest, normalizedFiles, files);
    if (!matched) continue;
    factors.push({
      id: rule.id,
      severity: rule.severity,
      matched,
      reason: rule.reason,
    });
  }
  return factors;
}

function matchRule(rule: Rule, request: string, normalizedFiles: string[], originalFiles: string[]): string | null {
  if (rule.fileCountGreaterThan !== undefined && originalFiles.length > rule.fileCountGreaterThan) {
    return `${originalFiles.length} files`;
  }
  for (const term of rule.terms ?? []) {
    if (request.includes(term.toLowerCase())) return term;
  }
  for (const term of rule.fileTerms ?? []) {
    const normalizedTerm = term.toLowerCase();
    const idx = normalizedFiles.findIndex(file => file.includes(normalizedTerm));
    if (idx >= 0) return originalFiles[idx];
  }
  return null;
}

function chooseProfile(factors: ProfileRiskFactor[]): RecommendedWorkflowProfile {
  return factors
    .map(factor => profileForFactor(factor.id))
    .sort((a, b) => PROFILE_RANK[b] - PROFILE_RANK[a])[0] ?? 'standard';
}

function profileForFactor(id: string): RecommendedWorkflowProfile {
  return RULES.find(rule => rule.id === id)?.profile ?? 'standard';
}

function reasonsFor(profile: RecommendedWorkflowProfile, factors: ProfileRiskFactor[]): string[] {
  const reasons = factors.map(factor => factor.reason);
  if (profile === 'quick') {
    reasons.push('Quick is limited to small, low-risk changes; non-trivial work still requires L1/L2/L3/Task.');
  } else if (profile === 'governed') {
    reasons.push('Governed work requires critical AC declarations and successful verification evidence coverage.');
  } else {
    reasons.push('Standard work uses the full spec workflow while reporting evidence coverage gaps as warnings.');
  }
  return unique(reasons);
}

function overrideGuidance(profile: RecommendedWorkflowProfile): string {
  if (profile === 'quick') {
    return 'You may choose standard or governed if the work is broader than the quick exception.';
  }
  return 'You may override the recommendation, but explicit Task profile overrides should include --profile-reason.';
}

function normalizeFiles(files: string[] | undefined): string[] {
  return (files ?? []).map(file => file.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
