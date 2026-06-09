import { join } from 'node:path';
import type { ProjectPaths } from './paths.js';
import { siblingMetaDir } from './paths.js';
import { createDecision, listDecisions, nextDecisionId, type CreateDecisionInput } from './decision.js';
import { cascadeImplementedHierarchy } from './lifecycle.js';
import { findSpecByCode, listAllSpecs } from './spec-io.js';
import { withProjectTransaction } from './transaction.js';

export interface ReconciliationAction {
  action: 'implement' | 'create' | 'skip';
  target: string;
  detail: string;
}

export interface ReconciliationConflict {
  target: string;
  message: string;
}

export interface LifecycleReconciliationPlan {
  implementationActions: ReconciliationAction[];
  decisionActions: ReconciliationAction[];
  conflicts: ReconciliationConflict[];
}

export interface LifecycleReconciliationReport extends LifecycleReconciliationPlan {
  applied: boolean;
}

export const LIFECYCLE_RECONCILIATION_TARGETS = [
  'architecture-hardening-L2.1',
  'architecture-hardening-L1',
  'harness-coding-L2.1',
  'harness-coding-L1',
  'repository-remediation-L2.1',
  'repository-remediation-L1',
] as const;

export const LIFECYCLE_RECONCILIATION_STARTS = [
  'architecture-hardening-L2.1',
  'harness-coding-L2.1',
  'repository-remediation-L2.1',
] as const;

export const LIFECYCLE_RECONCILIATION_DECISIONS: Omit<CreateDecisionInput, 'paths'>[] = [
  {
    docCode: 'architecture-hardening-L1',
    topic: 'architecture-hardening',
    what: '以领域不变量、完整性扫描和项目事务强化跨文件一致性与审计可信度。',
    why: '集中修复任务绕过、路径安全、引用完整性、并发写入与验证门禁问题。',
  },
  {
    docCode: 'harness-coding-L1',
    topic: 'harness-coding',
    what: '将任务上下文、执行回写、验证证据和变更闭环纳入 coding harness 控制层。',
    why: '让 frozen L3 到实现结果形成可追踪、可验证、可审计的执行链路。',
  },
  {
    docCode: 'repository-remediation-L1',
    topic: 'repository-remediation',
    what: '通过固定迁移、严格历史豁免和 merge-missing 资产补齐修复历史一致性。',
    why: '在不篡改终态 Task 的前提下消除历史完整性问题并保持未来门禁。',
  },
];

export function planLifecycleReconciliation(paths: ProjectPaths): LifecycleReconciliationPlan {
  const specs = listAllSpecs(paths);
  const byCode = new Map(specs.map(spec => [spec.fm.code, spec]));
  const virtualImplemented = new Set(specs.filter(spec => spec.fm.status === 'implemented').map(spec => spec.fm.code));
  const conflicts: ReconciliationConflict[] = [];
  const implementationActions: ReconciliationAction[] = [];
  const targetSet = new Set<string>(LIFECYCLE_RECONCILIATION_TARGETS);

  for (const code of LIFECYCLE_RECONCILIATION_TARGETS) {
    const spec = byCode.get(code);
    if (!spec) {
      conflicts.push({ target: code, message: `reconciliation target is missing: ${code}` });
      continue;
    }
    if (spec.fm.status === 'implemented') {
      implementationActions.push(action('skip', code, 'spec already implemented'));
      virtualImplemented.add(code);
      continue;
    }
    const children = specs.filter(child => child.fm.parentCode === code);
    const ready = spec.fm.status === 'confirmed'
      && children.length > 0
      && children.every(child => virtualImplemented.has(child.fm.code));
    if (!ready) {
      conflicts.push({ target: code, message: `fixed reconciliation target is not ready: ${code}` });
      continue;
    }
    implementationActions.push(action('implement', code, 'confirmed parent has only implemented direct children'));
    virtualImplemented.add(code);
  }

  for (const spec of specs) {
    if (targetSet.has(spec.fm.code) || spec.fm.status !== 'confirmed' || (spec.fm.level !== 'L1' && spec.fm.level !== 'L2')) continue;
    const children = specs.filter(child => child.fm.parentCode === spec.fm.code);
    if (children.length > 0 && children.every(child => child.fm.status === 'implemented')) {
      conflicts.push({ target: spec.fm.code, message: `ready reconciliation target is outside fixed scope: ${spec.fm.code}` });
    }
  }

  const decisions = listDecisions(paths, { includeAll: true });
  const decisionActions = LIFECYCLE_RECONCILIATION_DECISIONS.map(input => {
    const existing = decisions.find(decision => decision.fm.docCode === input.docCode);
    if (!existing) return action('create', input.docCode, 'create missing Decision Card');
    if (existing.fm.what !== input.what || existing.fm.why !== input.why) {
      conflicts.push({ target: input.docCode, message: `existing Decision Card differs for ${input.docCode}` });
    }
    return action('skip', input.docCode, 'Decision Card already exists');
  });

  return { implementationActions, decisionActions, conflicts };
}

export function applyLifecycleReconciliation(paths: ProjectPaths): LifecycleReconciliationReport {
  const plan = planLifecycleReconciliation(paths);
  if (plan.conflicts.length > 0) {
    throw new Error(`RECONCILIATION_CONFLICT: ${plan.conflicts.map(conflict => conflict.message).join('; ')}`);
  }

  withProjectTransaction(paths, 'lifecycle reconciliation', tx => {
    for (const spec of listAllSpecs(paths)) tx.snapshot(spec.filePath);
    for (const input of LIFECYCLE_RECONCILIATION_DECISIONS) {
      const spec = findSpecByCode(paths, input.docCode);
      if (!spec) throw new Error(`Spec not found: ${input.docCode}`);
      tx.snapshot(join(siblingMetaDir(spec.filePath, 'decisions'), `${nextDecisionId(paths, input.topic)}.md`));
    }
    for (const startSpecCode of LIFECYCLE_RECONCILIATION_STARTS) {
      cascadeImplementedHierarchy({ paths, startSpecCode, authority: 'project-reconcile' });
    }
    for (const planned of plan.decisionActions.filter(item => item.action === 'create')) {
      const input = LIFECYCLE_RECONCILIATION_DECISIONS.find(item => item.docCode === planned.target);
      if (!input) throw new Error(`missing reconciliation decision input: ${planned.target}`);
      createDecision({ paths, ...input });
    }
  });

  const finalPlan = planLifecycleReconciliation(paths);
  if (finalPlan.conflicts.length > 0 || [...finalPlan.implementationActions, ...finalPlan.decisionActions].some(item => item.action !== 'skip')) {
    throw new Error('RECONCILIATION_INCOMPLETE: reconciliation did not converge to an idempotent state');
  }
  return { ...plan, applied: true };
}

function action(actionName: ReconciliationAction['action'], target: string, detail: string): ReconciliationAction {
  return { action: actionName, target, detail };
}
