import type { ProjectPaths } from './paths.js';
import { listAllSpecs } from './spec-io.js';
import { validateCriticalAcceptanceCriteria } from './spec-sections.js';

export type CriticalReadinessStatus = 'missing' | 'empty' | 'unknown' | 'ready';

export interface CriticalReadinessItem {
  specCode: string;
  topic: string;
  status: CriticalReadinessStatus;
  missingSection: boolean;
  emptySection: boolean;
  unknownCriticalIds: string[];
  criticalCount: number;
  reason: string;
  suggestion: string;
}

export interface CriticalReadinessReport {
  schemaVersion: 'critical-readiness.experimental.v1';
  generatedAt: string;
  topic?: string;
  totals: {
    activeL3: number;
    ready: number;
    missing: number;
    empty: number;
    unknown: number;
  };
  readinessRatio: number;
  items: CriticalReadinessItem[];
  summary: string;
  recommendations: string[];
  governedUpgrade: {
    readyForGovernedDefault: boolean;
    note: string;
  };
}

export interface BuildCriticalReadinessReportOptions {
  topic?: string;
  now?: Date;
}

export function buildCriticalReadinessReport(
  paths: ProjectPaths,
  opts?: BuildCriticalReadinessReportOptions,
): CriticalReadinessReport {
  const topic = normalizeTopic(opts?.topic);
  const items = listAllSpecs(paths)
    .filter(spec => spec.fm.level === 'L3' && spec.fm.status !== 'archived')
    .filter(spec => topic === undefined || spec.fm.topic === topic)
    .sort((a, b) => a.fm.code.localeCompare(b.fm.code))
    .map(spec => classifySpec(spec.fm.code, spec.fm.topic, spec.content));
  const totals = summarize(items);
  const readinessRatio = totals.activeL3 === 0 ? 0 : totals.ready / totals.activeL3;
  const readyForGovernedDefault = topic === undefined && totals.activeL3 > 0 && totals.ready === totals.activeL3;

  return {
    schemaVersion: 'critical-readiness.experimental.v1',
    generatedAt: (opts?.now ?? new Date()).toISOString(),
    ...(topic ? { topic } : {}),
    totals,
    readinessRatio,
    items,
    summary: summarizeText(totals, topic),
    recommendations: recommendations(totals),
    governedUpgrade: {
      readyForGovernedDefault,
      note: governedUpgradeNote({ topic, readyForGovernedDefault }),
    },
  };
}

function normalizeTopic(topic: string | undefined): string | undefined {
  if (topic === undefined) return undefined;
  const trimmed = topic.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error('INVALID_CRITICAL_READINESS_TOPIC: --topic must be a safe topic name');
  }
  return trimmed;
}

function classifySpec(specCode: string, topic: string, content: string): CriticalReadinessItem {
  const missingSection = !hasSection(content, '关键验收标准');
  const critical = validateCriticalAcceptanceCriteria(content);
  const emptySection = !missingSection && critical.criticalCriteria.length === 0 && critical.unknown.length === 0;

  if (critical.unknown.length > 0) {
    return {
      specCode,
      topic,
      status: 'unknown',
      missingSection: false,
      emptySection: false,
      unknownCriticalIds: critical.unknown,
      criticalCount: critical.criticalCriteria.length,
      reason: 'critical acceptance criteria reference unknown AC ids',
      suggestion: 'Fix the critical AC references so they point to real acceptance criteria in this L3.',
    };
  }

  if (missingSection) {
    return {
      specCode,
      topic,
      status: 'missing',
      missingSection: true,
      emptySection: false,
      unknownCriticalIds: [],
      criticalCount: 0,
      reason: 'missing critical acceptance criteria section',
      suggestion: 'Read the L3 context and add real critical AC references after human or agent review; do not invent them automatically.',
    };
  }

  if (emptySection) {
    return {
      specCode,
      topic,
      status: 'empty',
      missingSection: false,
      emptySection: true,
      unknownCriticalIds: [],
      criticalCount: 0,
      reason: 'critical acceptance criteria section is empty',
      suggestion: 'Confirm whether this L3 needs governed readiness; if it does, add real critical AC references from its acceptance criteria.',
    };
  }

  return {
    specCode,
    topic,
    status: 'ready',
    missingSection: false,
    emptySection: false,
    unknownCriticalIds: [],
    criticalCount: critical.criticalCriteria.length,
    reason: 'critical acceptance criteria are ready',
    suggestion: 'No readiness repair is needed for this L3.',
  };
}

function hasSection(content: string, heading: string): boolean {
  return content
    .split('\n')
    .some(line => new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`).test(line.trim()));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarize(items: CriticalReadinessItem[]): CriticalReadinessReport['totals'] {
  const totals: CriticalReadinessReport['totals'] = {
    activeL3: items.length,
    ready: 0,
    missing: 0,
    empty: 0,
    unknown: 0,
  };
  for (const item of items) {
    totals[item.status] += 1;
  }
  return totals;
}

function summarizeText(totals: CriticalReadinessReport['totals'], topic?: string): string {
  const scope = topic ? `topic ${topic}` : 'project';
  return `${scope}: ${totals.ready}/${totals.activeL3} active L3 spec(s) are critical AC ready.`;
}

function recommendations(totals: CriticalReadinessReport['totals']): string[] {
  if (totals.activeL3 === 0) {
    return ['No active L3 specs were found; create and freeze L3 specs before assessing governed readiness.'];
  }
  if (totals.ready === totals.activeL3) {
    return ['All active L3 specs are ready; rerun spec-manager project workflow preview before considering governed default.'];
  }
  const out = ['Repair readiness gaps by reading each L3 and adding only real critical AC references; do not auto-generate critical AC.'];
  if (totals.missing > 0) out.push(`${totals.missing} active L3 spec(s) are missing the critical AC section.`);
  if (totals.empty > 0) out.push(`${totals.empty} active L3 spec(s) have an empty critical AC section.`);
  if (totals.unknown > 0) out.push(`${totals.unknown} active L3 spec(s) reference unknown critical AC ids.`);
  return out;
}

function governedUpgradeNote(input: { topic?: string; readyForGovernedDefault: boolean }): string {
  if (input.topic) {
    return 'This topic-filtered report only describes scoped readiness; run the full project readiness report or adoption preview before considering governed default.';
  }
  return input.readyForGovernedDefault
    ? 'All active L3 specs are ready; rerun adoption preview before considering governed default.'
    : 'Do not use governed as the default profile until every active L3 declares valid critical acceptance criteria.';
}
