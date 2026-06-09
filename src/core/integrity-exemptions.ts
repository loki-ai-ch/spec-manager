import { existsSync, readFileSync } from 'node:fs';
import type { ProjectPaths } from './paths.js';
import { writeAtomic } from './frontmatter.js';

export type IntegrityExemptionKind = 'legacy-missing-verification';

export interface IntegrityExemption {
  id: string;
  kind: IntegrityExemptionKind;
  specCode: string;
  taskId: string;
  reason: string;
  createdAt: string;
  migrationId: string;
}

export interface IntegrityExemptionRegistry {
  version: 1;
  exemptions: IntegrityExemption[];
}

export interface IntegrityExemptionProblem {
  sourceId: string;
  message: string;
}

export interface IntegrityExemptionReadResult {
  registry: IntegrityExemptionRegistry;
  problems: IntegrityExemptionProblem[];
}

export function emptyIntegrityExemptionRegistry(): IntegrityExemptionRegistry {
  return { version: 1, exemptions: [] };
}

export function readIntegrityExemptions(paths: ProjectPaths): IntegrityExemptionReadResult {
  if (!existsSync(paths.integrityExemptionsFile)) {
    return { registry: emptyIntegrityExemptionRegistry(), problems: [] };
  }

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(paths.integrityExemptionsFile, 'utf8'));
  } catch (err) {
    return invalidRegistry(`cannot parse integrity exemption registry: ${errorMessage(err)}`);
  }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.exemptions)) {
    return invalidRegistry('integrity exemption registry must have version 1 and an exemptions array');
  }

  const exemptions: IntegrityExemption[] = [];
  const problems: IntegrityExemptionProblem[] = [];
  const ids = new Set<string>();
  const taskKeys = new Set<string>();
  for (const [index, item] of value.exemptions.entries()) {
    if (!isIntegrityExemption(item)) {
      problems.push({ sourceId: `exemption[${index}]`, message: `integrity exemption at index ${index} has invalid fields` });
      continue;
    }
    const taskKey = exemptionTaskKey(item);
    if (ids.has(item.id)) {
      problems.push({ sourceId: item.id, message: `duplicate integrity exemption id: ${item.id}` });
      continue;
    }
    if (taskKeys.has(taskKey)) {
      problems.push({ sourceId: taskKey, message: `duplicate integrity exemption task key: ${taskKey}` });
      continue;
    }
    ids.add(item.id);
    taskKeys.add(taskKey);
    exemptions.push(item);
  }
  return { registry: { version: 1, exemptions }, problems };
}

export function mergeIntegrityExemptions(
  registry: IntegrityExemptionRegistry,
  additions: IntegrityExemption[],
): IntegrityExemptionRegistry {
  const byId = new Map(registry.exemptions.map(exemption => [exemption.id, exemption]));
  const byTask = new Map(registry.exemptions.map(exemption => [exemptionTaskKey(exemption), exemption]));
  const merged = [...registry.exemptions];
  for (const exemption of additions) {
    if (!isIntegrityExemption(exemption)) {
      throw new Error('INVALID_EXEMPTION: invalid fields');
    }
    const sameId = byId.get(exemption.id);
    const sameTask = byTask.get(exemptionTaskKey(exemption));
    if (sameId && JSON.stringify(sameId) !== JSON.stringify(exemption)) {
      throw new Error(`EXEMPTION_CONFLICT: id ${exemption.id}`);
    }
    if (sameTask && sameTask.id !== exemption.id) {
      throw new Error(`EXEMPTION_CONFLICT: task ${exemptionTaskKey(exemption)}`);
    }
    if (sameId || sameTask) continue;
    merged.push(exemption);
    byId.set(exemption.id, exemption);
    byTask.set(exemptionTaskKey(exemption), exemption);
  }
  return { version: 1, exemptions: merged };
}

export function writeIntegrityExemptions(paths: ProjectPaths, registry: IntegrityExemptionRegistry): void {
  writeAtomic(paths.integrityExemptionsFile, `${JSON.stringify(registry, null, 2)}\n`);
}

export function exemptionTaskKey(exemption: Pick<IntegrityExemption, 'specCode' | 'taskId'>): string {
  return `${exemption.specCode}:${exemption.taskId}`;
}

function invalidRegistry(message: string): IntegrityExemptionReadResult {
  return {
    registry: emptyIntegrityExemptionRegistry(),
    problems: [{ sourceId: 'integrity-exemptions', message }],
  };
}

function isIntegrityExemption(value: unknown): value is IntegrityExemption {
  if (!isRecord(value)) return false;
  return value.kind === 'legacy-missing-verification'
    && nonEmpty(value.id)
    && nonEmpty(value.specCode)
    && nonEmpty(value.taskId)
    && nonEmpty(value.reason)
    && nonEmpty(value.createdAt)
    && nonEmpty(value.migrationId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
