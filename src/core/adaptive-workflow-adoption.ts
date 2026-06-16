import type { ProjectPaths } from './paths.js';
import { buildProfileMetrics } from './profile-metrics.js';
import { listAllSpecs } from './spec-io.js';
import { validateCriticalAcceptanceCriteria } from './spec-sections.js';
import { readAdaptiveWorkflowConfig, type TaskWorkflowProfile } from './workflow-profile.js';

export interface AdaptiveWorkflowAdoptionPreview {
  schemaVersion: 'adaptive-workflow-adoption-preview.experimental.v1';
  generatedAt: string;
  adaptiveWorkflow: {
    enabled: boolean;
    defaultProfile: TaskWorkflowProfile;
    note: string;
  };
  taskProfileMetrics: {
    totalTasks: number;
    legacyTasks: number;
    standardTasks: number;
    governedTasks: number;
  };
  governedReadiness: {
    activeL3Specs: number;
    withCriticalAcceptanceCriteria: number;
    withoutCriticalAcceptanceCriteria: number;
    examplesWithoutCriticalAcceptanceCriteria: string[];
    readyForGovernedDefault: boolean;
  };
  recommendation: {
    recommendedDefaultProfile: TaskWorkflowProfile;
    reasons: string[];
    warnings: string[];
    nextSteps: string[];
  };
  historyPolicy: {
    mutatesHistoricalTasks: false;
    note: string;
  };
}

export interface BuildAdaptiveWorkflowAdoptionPreviewOptions {
  now?: Date;
}

const EXAMPLE_LIMIT = 10;

export function buildAdaptiveWorkflowAdoptionPreview(
  paths: ProjectPaths,
  opts?: BuildAdaptiveWorkflowAdoptionPreviewOptions,
): AdaptiveWorkflowAdoptionPreview {
  const adaptive = readAdaptiveWorkflowConfig(paths);
  const metrics = buildProfileMetrics(paths, { now: opts?.now });
  const readiness = buildGovernedReadiness(paths);
  const recommendedDefaultProfile: TaskWorkflowProfile = readiness.readyForGovernedDefault ? 'governed' : 'standard';

  return {
    schemaVersion: 'adaptive-workflow-adoption-preview.experimental.v1',
    generatedAt: (opts?.now ?? new Date()).toISOString(),
    adaptiveWorkflow: {
      enabled: adaptive.enabled,
      defaultProfile: adaptive.defaultProfile,
      note: adaptive.enabled
        ? `adaptive workflow enabled; future tasks use ${adaptive.defaultProfile} unless explicitly overridden`
        : 'adaptive workflow disabled; preview is read-only and does not change legacy completion semantics',
    },
    taskProfileMetrics: {
      totalTasks: metrics.totals.tasks,
      legacyTasks: metrics.byProfile.legacy.tasks,
      standardTasks: metrics.byProfile.standard.tasks,
      governedTasks: metrics.byProfile.governed.tasks,
    },
    governedReadiness: readiness,
    recommendation: {
      recommendedDefaultProfile,
      reasons: recommendationReasons(readiness, metrics.byProfile.legacy.tasks),
      warnings: recommendationWarnings(readiness),
      nextSteps: nextSteps(recommendedDefaultProfile, adaptive.enabled),
    },
    historyPolicy: {
      mutatesHistoricalTasks: false,
      note: 'Adoption preview and workflow enable/disable do not rewrite historical task profile snapshots; legacy tasks remain historical facts, not new governance violations.',
    },
  };
}

function buildGovernedReadiness(paths: ProjectPaths): AdaptiveWorkflowAdoptionPreview['governedReadiness'] {
  const l3Specs = listAllSpecs(paths)
    .filter(spec => spec.fm.level === 'L3' && spec.fm.status !== 'archived')
    .sort((a, b) => a.fm.code.localeCompare(b.fm.code));
  const examplesWithoutCriticalAcceptanceCriteria: string[] = [];
  let withCriticalAcceptanceCriteria = 0;

  for (const spec of l3Specs) {
    const critical = validateCriticalAcceptanceCriteria(spec.content);
    if (critical.criticalCriteria.length > 0 && critical.unknown.length === 0) {
      withCriticalAcceptanceCriteria += 1;
      continue;
    }
    if (examplesWithoutCriticalAcceptanceCriteria.length < EXAMPLE_LIMIT) {
      examplesWithoutCriticalAcceptanceCriteria.push(spec.fm.code);
    }
  }

  const withoutCriticalAcceptanceCriteria = l3Specs.length - withCriticalAcceptanceCriteria;
  return {
    activeL3Specs: l3Specs.length,
    withCriticalAcceptanceCriteria,
    withoutCriticalAcceptanceCriteria,
    examplesWithoutCriticalAcceptanceCriteria,
    readyForGovernedDefault: l3Specs.length > 0 && withoutCriticalAcceptanceCriteria === 0,
  };
}

function recommendationReasons(
  readiness: AdaptiveWorkflowAdoptionPreview['governedReadiness'],
  legacyTasks: number,
): string[] {
  const reasons: string[] = [];
  if (legacyTasks > 0) {
    reasons.push(`${legacyTasks} historical legacy task(s) will remain unchanged after adoption.`);
  }
  if (readiness.readyForGovernedDefault) {
    reasons.push('All active L3 specs declare valid critical acceptance criteria, so governed default is available.');
  } else {
    reasons.push('Some active L3 specs do not declare valid critical acceptance criteria, so standard is the safer default.');
    reasons.push('Governed can still be selected explicitly for high-risk work that is ready for evidence coverage.');
  }
  return reasons;
}

function recommendationWarnings(readiness: AdaptiveWorkflowAdoptionPreview['governedReadiness']): string[] {
  const warnings: string[] = [];
  if (readiness.activeL3Specs === 0) {
    warnings.push('No active L3 specs were found; governed readiness cannot be assessed yet.');
    return warnings;
  }
  if (!readiness.readyForGovernedDefault) {
    warnings.push(`${readiness.withoutCriticalAcceptanceCriteria} active L3 spec(s) lack valid critical acceptance criteria.`);
  }
  return warnings;
}

function nextSteps(defaultProfile: TaskWorkflowProfile, enabled: boolean): string[] {
  const steps = [
    `Run spec-manager project workflow enable --default-profile ${defaultProfile} when ready to adopt.`,
    'Run spec-manager project profile metrics after new tasks complete to audit adoption.',
  ];
  if (enabled) {
    return [
      'Adaptive workflow is already enabled; use this preview to review readiness before changing the default profile.',
      ...steps,
    ];
  }
  return steps;
}
