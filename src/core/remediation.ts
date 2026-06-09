import { join } from 'node:path';
import type { ProjectPaths } from './paths.js';
import { siblingMetaDir } from './paths.js';
import { createDecision, listDecisions, nextDecisionId, type CreateDecisionInput } from './decision.js';
import {
  exemptionTaskKey,
  mergeIntegrityExemptions,
  readIntegrityExemptions,
  type IntegrityExemption,
} from './integrity-exemptions.js';
import { findSpecByCode } from './spec-io.js';
import { listTasks } from './task.js';
import { withProjectTransaction } from './transaction.js';
import { mergeMissingDirectories } from './agents.js';

export const REPOSITORY_REMEDIATION_V1 = 'repository-remediation-v1' as const;
export type RepositoryRemediationId = typeof REPOSITORY_REMEDIATION_V1;

export interface PlannedAction {
  action: 'create' | 'skip';
  target: string;
  detail: string;
}

export interface RemediationConflict {
  target: string;
  message: string;
}

export interface RepositoryRemediationPlan {
  migrationId: RepositoryRemediationId;
  decisions: PlannedAction[];
  exemptions: PlannedAction[];
  agentAssets: PlannedAction[];
  conflicts: RemediationConflict[];
}

export interface RepositoryRemediationOptions {
  paths: ProjectPaths;
  packageRoot: string;
  migrationId: string;
  now?: string;
}

export interface RepositoryRemediationReport extends RepositoryRemediationPlan {
  applied: boolean;
}

export const REPOSITORY_REMEDIATION_V1_DECISIONS: Omit<CreateDecisionInput, 'paths'>[] = [
  {
    docCode: 'l3-approval-L1',
    topic: 'l3-approval',
    what: '一次明确的 L3 人工审批直接冻结规格，并保留实施前人工门禁。',
    why: '减少重复审批步骤，同时维持实现代码只能基于 frozen L3 的约束。',
  },
  {
    docCode: 'roadmap-openspec-L1',
    topic: 'roadmap-openspec',
    what: '以本地文件为事实源，补齐 rich guide、agent 检测、交互视图与 shell completion。',
    why: '提升 spec-manager 的可发现性与跨 agent 使用体验，同时保持 local-first。',
  },
  {
    docCode: 'spec-manager-ai-ux-L1',
    topic: 'spec-manager-ai-ux',
    what: '通过场景化文档、精简 skill 和核心测试改善 AI 使用 spec-manager 的体验。',
    why: '降低 AI 理解和操作工作流的成本；已被后续废弃的能力不作为当前推荐。',
  },
  {
    docCode: 'workflow-hardening-L1',
    topic: 'workflow-hardening',
    what: '以 CLI 为工作流事实源，统一 agent 入口并强化规格、计划和任务状态校验。',
    why: '防止不同工具入口产生流程漂移，并让错误在实施前被发现。',
  },
];

export const REPOSITORY_REMEDIATION_V1_TASKS = [
  ['spec-manager-ai-ux-L3.1.1-readme', 'T-001'],
  ['spec-manager-ai-ux-L3.1.2-skill', 'T-001'],
  ['spec-manager-ai-ux-L3.1.3-encoding', 'T-001'],
  ['spec-manager-ai-ux-L3.1.4-batch', 'T-001'],
  ['spec-manager-ai-ux-L3.1.5-tests', 'T-001'],
  ['roadmap-openspec-L3.1.1-guide', 'T-001'],
  ['workflow-hardening-L3.1.1-cli', 'T-001'],
  ['workflow-hardening-L3.1.2-hints', 'T-001'],
  ['workflow-hardening-L3.1.3-tools', 'T-001'],
  ['roadmap-openspec-L3.1.2-agents', 'T-001'],
  ['roadmap-openspec-L3.1.3-view', 'T-001'],
  ['l3-approval-L3.1.1-single-freeze', 'T-001'],
  ['roadmap-openspec-L3.1.4-completion', 'T-001'],
  ['workflow-hardening-L3.1.4-placeholder-fix', 'T-001'],
  ['harness-coding-L3.1.1-context', 'T-001'],
  ['harness-coding-L3.1.2-report', 'T-001'],
] as const;

export const REPOSITORY_REMEDIATION_V1_AGENT_DIRECTORIES = [
  { source: 'rules', target: '.claude/skills/spec-manager/rules' },
  { source: 'templates', target: '.claude/skills/spec-manager/templates' },
] as const;

export function planRepositoryRemediation(options: RepositoryRemediationOptions): RepositoryRemediationPlan {
  assertMigrationId(options.migrationId);
  const conflicts: RemediationConflict[] = [];
  const decisions = listDecisions(options.paths, { includeAll: true });
  const decisionActions = REPOSITORY_REMEDIATION_V1_DECISIONS.map(input => {
    const existing = decisions.find(decision => decision.fm.docCode === input.docCode);
    if (!existing) return action('create', input.docCode, 'create missing Decision Card');
    if (existing.fm.what !== input.what || existing.fm.why !== input.why) {
      conflicts.push({ target: input.docCode, message: `existing Decision Card differs for ${input.docCode}` });
    }
    return action('skip', input.docCode, 'Decision Card already exists');
  });

  const exemptionResult = readIntegrityExemptions(options.paths);
  for (const problem of exemptionResult.problems) {
    conflicts.push({ target: problem.sourceId, message: problem.message });
  }
  const existingByTask = new Map(exemptionResult.registry.exemptions.map(exemption => [exemptionTaskKey(exemption), exemption]));
  const tasks = new Map(listTasks(options.paths).map(task => [`${task.specCode}:${task.id}`, task]));
  const exemptionActions = REPOSITORY_REMEDIATION_V1_TASKS.map(([specCode, taskId]) => {
    const key = `${specCode}:${taskId}`;
    const task = tasks.get(key);
    if (!task || task.status !== 'completed' || (task.verifications ?? []).some(v => v.exitCode === 0)) {
      conflicts.push({ target: key, message: `migration target is not an eligible legacy completed task: ${key}` });
    }
    const existing = existingByTask.get(key);
    if (!existing) return action('create', key, 'register legacy missing-verification exemption');
    if (existing.migrationId !== REPOSITORY_REMEDIATION_V1) {
      conflicts.push({ target: key, message: `task already has an exemption from ${existing.migrationId}` });
    }
    return action('skip', key, 'legacy exemption already registered');
  });
  const assetReport = mergeMissingDirectories({
    paths: options.paths,
    packageRoot: options.packageRoot,
    directories: [...REPOSITORY_REMEDIATION_V1_AGENT_DIRECTORIES],
    dryRun: true,
  });
  for (const note of assetReport.notes) conflicts.push({ target: 'agent-assets', message: note });
  const agentAssets = [
    ...assetReport.created.map(target => action('create', target, 'create missing Claude skill asset')),
    ...assetReport.skipped.map(target => action('skip', target, 'Claude skill asset already exists')),
  ];

  return {
    migrationId: REPOSITORY_REMEDIATION_V1,
    decisions: decisionActions,
    exemptions: exemptionActions,
    agentAssets,
    conflicts,
  };
}

export function applyRepositoryRemediation(options: RepositoryRemediationOptions): RepositoryRemediationReport {
  const plan = planRepositoryRemediation(options);
  if (plan.conflicts.length > 0) {
    throw new Error(`REMEDIATION_CONFLICT: ${plan.conflicts.map(conflict => conflict.message).join('; ')}`);
  }
  const now = options.now ?? new Date().toISOString();
  withProjectTransaction(options.paths, options.migrationId, tx => {
    for (const planned of plan.decisions.filter(item => item.action === 'create')) {
      const input = REPOSITORY_REMEDIATION_V1_DECISIONS.find(item => item.docCode === planned.target);
      if (!input) throw new Error(`missing decision manifest entry: ${planned.target}`);
      const spec = findSpecByCode(options.paths, input.docCode);
      if (!spec) throw new Error(`Spec not found: ${input.docCode}`);
      tx.snapshot(join(siblingMetaDir(spec.filePath, 'decisions'), `${nextDecisionId(options.paths, input.topic)}.md`));
      createDecision({ paths: options.paths, ...input });
    }
    const current = readIntegrityExemptions(options.paths);
    const additions = plan.exemptions
      .filter(item => item.action === 'create')
      .map(item => exemptionForTask(item.target, now));
    const merged = mergeIntegrityExemptions(current.registry, additions);
    tx.write(options.paths.integrityExemptionsFile, `${JSON.stringify(merged, null, 2)}\n`);
    mergeMissingDirectories({
      paths: options.paths,
      packageRoot: options.packageRoot,
      directories: [...REPOSITORY_REMEDIATION_V1_AGENT_DIRECTORIES],
      write: (target, content) => tx.write(target, content),
    });
  });
  const finalPlan = planRepositoryRemediation(options);
  if (finalPlan.conflicts.length > 0 || [...finalPlan.decisions, ...finalPlan.exemptions, ...finalPlan.agentAssets].some(item => item.action !== 'skip')) {
    throw new Error('REMEDIATION_INCOMPLETE: migration did not converge to an idempotent state');
  }
  return { ...plan, applied: true };
}

function exemptionForTask(taskKey: string, createdAt: string): IntegrityExemption {
  const separator = taskKey.lastIndexOf(':');
  const specCode = taskKey.slice(0, separator);
  const taskId = taskKey.slice(separator + 1);
  return {
    id: `${REPOSITORY_REMEDIATION_V1}:${specCode}:${taskId}`,
    kind: 'legacy-missing-verification',
    specCode,
    taskId,
    reason: 'Task completed before successful verification became mandatory.',
    createdAt,
    migrationId: REPOSITORY_REMEDIATION_V1,
  };
}

function action(actionName: PlannedAction['action'], target: string, detail: string): PlannedAction {
  return { action: actionName, target, detail };
}

function assertMigrationId(migrationId: string): asserts migrationId is RepositoryRemediationId {
  if (migrationId !== REPOSITORY_REMEDIATION_V1) {
    throw new Error(`UNKNOWN_MIGRATION: ${migrationId}. Supported: ${REPOSITORY_REMEDIATION_V1}`);
  }
}
