import type { AuditSink } from './audit-events.js';
import type { ProjectPaths } from './paths.js';
import { isKnowledgeGovernedCreatedAt } from './knowledge-governance-adoption.js';
import { findSpecByCode, updateSpec } from './spec-io.js';
import type { ImplementationAuthority, SpecStatus } from './status.js';
import type { SpecLevel } from './validate.js';
import { buildProjectSnapshot, isFullProjectSnapshot, type ProjectSnapshot } from './project-snapshot.js';
import { assessScopePlan } from './scope-readiness.js';

export type { ImplementationAuthority } from './status.js';

export type ImplementationBlocker =
  | 'missing-spec'
  | 'wrong-status'
  | 'no-children'
  | 'children-incomplete'
  | 'authority-not-allowed'
  | 'scope-open'
  | 'scope-child-missing'
  | 'scope-child-incomplete'
  | 'scope-plan-required';

export interface ImplementationReadiness {
  specCode: string;
  level?: SpecLevel;
  currentStatus?: SpecStatus;
  expectedStatus: 'confirmed' | 'frozen';
  ready: boolean;
  alreadyImplemented: boolean;
  blockers: ImplementationBlocker[];
}

export interface LifecycleCascadeResult {
  cascadedSpecs: Array<{
    code: string;
    oldStatus: string;
    newStatus: 'implemented';
    level: SpecLevel;
  }>;
  skippedSpecs: Array<{ code: string; status: string; reason: string }>;
}

export interface CascadeImplementedHierarchyOptions {
  paths: ProjectPaths;
  startSpecCode: string;
  authority: ImplementationAuthority;
  auditSink?: AuditSink;
}

export function assessImplementationReadiness(
  paths: ProjectPaths,
  specCode: string,
  authority: ImplementationAuthority,
  snapshot?: ProjectSnapshot,
): ImplementationReadiness {
  const project = snapshot && isFullProjectSnapshot(snapshot, ['specs'])
    ? snapshot
    : buildProjectSnapshot(paths, { include: ['specs'] });
  const spec = project.indexes.specByCode.get(specCode) ?? findSpecByCode(paths, specCode);
  const expectedStatus = spec?.fm.level === 'L3' ? 'frozen' : 'confirmed';
  if (!spec) {
    return { specCode, expectedStatus: 'confirmed', ready: false, alreadyImplemented: false, blockers: ['missing-spec'] };
  }
  if (spec.fm.status === 'implemented') {
    return {
      specCode,
      level: spec.fm.level,
      currentStatus: spec.fm.status,
      expectedStatus,
      ready: false,
      alreadyImplemented: true,
      blockers: [],
    };
  }

  const blockers: ImplementationBlocker[] = [];
  if (spec.fm.level === 'L3') {
    if (authority !== 'task-complete') blockers.push('authority-not-allowed');
    if (spec.fm.status !== 'frozen') blockers.push('wrong-status');
  } else if (spec.fm.level === 'L1' || spec.fm.level === 'L2') {
    if (spec.fm.status !== 'confirmed') blockers.push('wrong-status');
    if (spec.fm.scopePlan) {
      const scope = assessScopePlan(paths, specCode);
      if (scope.mode === 'open') blockers.push('scope-open');
      if (scope.missingChildren.length) blockers.push('scope-child-missing');
      if (scope.incompleteChildren.length) blockers.push('scope-child-incomplete');
    }
    const children = project.indexes.childrenByParent.get(specCode) ?? [];
    if (!spec.fm.scopePlan && isKnowledgeGovernedCreatedAt(paths, spec.fm.created)) {
      blockers.push('scope-plan-required');
    } else if (!spec.fm.scopePlan) {
      if (children.length === 0) blockers.push('no-children');
      else if (children.some(child => child.fm.status !== 'implemented')) blockers.push('children-incomplete');
    }
  } else {
    blockers.push('authority-not-allowed');
  }

  return {
    specCode,
    level: spec.fm.level,
    currentStatus: spec.fm.status,
    expectedStatus,
    ready: blockers.length === 0,
    alreadyImplemented: false,
    blockers,
  };
}

export function cascadeImplementedHierarchy(options: CascadeImplementedHierarchyOptions): LifecycleCascadeResult {
  const result: LifecycleCascadeResult = { cascadedSpecs: [], skippedSpecs: [] };
  cascadeOne(options, options.startSpecCode, result);
  return result;
}

function cascadeOne(
  options: CascadeImplementedHierarchyOptions,
  specCode: string,
  result: LifecycleCascadeResult,
): void {
  const spec = findSpecByCode(options.paths, specCode);
  const readiness = assessImplementationReadiness(options.paths, specCode, options.authority);
  if (!spec || !readiness.ready) {
    result.skippedSpecs.push({
      code: specCode,
      status: readiness.currentStatus ?? 'missing',
      reason: readiness.alreadyImplemented ? 'already implemented' : readiness.blockers.join(', '),
    });
    return;
  }

  const oldStatus = spec.fm.status;
  updateSpec(
    options.paths,
    specCode,
    { status: 'implemented', changeSummary: `cascade: ${options.authority}` },
    { auditSink: options.auditSink, transitionAuthority: options.authority },
  );
  result.cascadedSpecs.push({ code: specCode, oldStatus, newStatus: 'implemented', level: spec.fm.level });

  if (spec.fm.parentCode) cascadeOne(options, spec.fm.parentCode, result);
}
