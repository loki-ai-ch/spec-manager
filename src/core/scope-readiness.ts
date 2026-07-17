import { ScopePlanSchema, type ScopePlanT } from '../schemas/spec.js';
import { buildProjectSnapshot } from './project-snapshot.js';
import type { ProjectPaths } from './paths.js';
import { findSpecByCode, updateSpec } from './spec-io.js';

export interface ScopeReadinessItem {
  specCode: string;
  mode: 'open' | 'fixed' | 'legacy';
  status: 'ready' | 'blocked' | 'legacy';
  missingChildren: string[];
  incompleteChildren: string[];
  reason: string | null;
}

export interface ScopeReadinessReport {
  schemaVersion: 'scope-readiness.v1';
  topic?: string;
  summary: { ready: number; blocked: number; legacy: number };
  items: ScopeReadinessItem[];
}

export function assessScopePlan(paths: ProjectPaths, specCode: string): ScopeReadinessItem {
  const snapshot = buildProjectSnapshot(paths, { include: ['specs'] });
  const spec = snapshot.indexes.specByCode.get(specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  const plan = spec.fm.scopePlan;
  if (!plan) return { specCode, mode: 'legacy', status: 'legacy', missingChildren: [], incompleteChildren: [], reason: null };
  if (plan.mode === 'open') return { specCode, mode: 'open', status: 'blocked', missingChildren: [], incompleteChildren: [], reason: plan.reason ?? null };
  const missingChildren: string[] = [];
  const incompleteChildren: string[] = [];
  for (const child of plan.plannedChildren) {
    const actual = snapshot.indexes.specByCode.get(child.code);
    if (!actual) { if (child.required) missingChildren.push(child.code); continue; }
    if (actual.fm.parentCode !== specCode || actual.fm.status !== 'implemented') incompleteChildren.push(child.code);
  }
  return {
    specCode, mode: 'fixed', status: missingChildren.length || incompleteChildren.length ? 'blocked' : 'ready',
    missingChildren, incompleteChildren, reason: null,
  };
}

export function buildScopeReadinessReport(paths: ProjectPaths, topic?: string): ScopeReadinessReport {
  const specs = buildProjectSnapshot(paths, { include: ['specs'], topic }).specs
    .filter(spec => spec.fm.level === 'L1' || spec.fm.level === 'L2')
    .sort((a, b) => a.fm.code.localeCompare(b.fm.code));
  const items = specs.map(spec => assessScopePlan(paths, spec.fm.code));
  return {
    schemaVersion: 'scope-readiness.v1', ...(topic ? { topic } : {}),
    summary: {
      ready: items.filter(item => item.status === 'ready').length,
      blocked: items.filter(item => item.status === 'blocked').length,
      legacy: items.filter(item => item.status === 'legacy').length,
    }, items,
  };
}

export function setScopePlan(paths: ProjectPaths, specCode: string, plan: Omit<ScopePlanT, 'updatedAt'>): ScopePlanT {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  if (spec.fm.status === 'implemented') throw new Error(`LIFECYCLE_SCOPE_DRIFT: cannot modify scope of implemented ${specCode}`);
  const scopePlan = ScopePlanSchema.parse({ ...plan, updatedAt: new Date().toISOString() });
  updateSpec(paths, specCode, { scopePlan });
  return scopePlan;
}
