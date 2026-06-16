import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ProjectPaths } from './paths.js';
import { writeAtomic } from './frontmatter.js';

export type WorkflowProfile = 'legacy' | 'standard' | 'governed';
export type TaskWorkflowProfile = 'standard' | 'governed';
export type TaskWorkflowProfileSource = 'project-default' | 'explicit' | 'legacy';

export interface AdaptiveWorkflowConfig {
  enabled: boolean;
  defaultProfile: TaskWorkflowProfile;
}

export interface ResolvedTaskWorkflowProfile {
  profile: WorkflowProfile;
  profileSource: TaskWorkflowProfileSource;
  profileOverrideReason: string | null;
}

const DEFAULT_ADAPTIVE_WORKFLOW_CONFIG: AdaptiveWorkflowConfig = {
  enabled: false,
  defaultProfile: 'standard',
};

const TASK_PROFILES = new Set<TaskWorkflowProfile>(['standard', 'governed']);

export function readAdaptiveWorkflowConfig(paths: ProjectPaths): AdaptiveWorkflowConfig {
  const config = readProjectConfig(paths);
  const raw = config.adaptiveWorkflow;
  if (raw === undefined || raw === null) return { ...DEFAULT_ADAPTIVE_WORKFLOW_CONFIG };
  if (!isRecord(raw)) {
    throw new Error('INVALID_ADAPTIVE_WORKFLOW_CONFIG: adaptiveWorkflow must be an object');
  }
  const enabled = raw.enabled;
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    throw new Error('INVALID_ADAPTIVE_WORKFLOW_CONFIG: adaptiveWorkflow.enabled must be boolean');
  }
  const defaultProfile = raw.defaultProfile;
  if (defaultProfile !== undefined && !isTaskWorkflowProfile(defaultProfile)) {
    throw new Error('INVALID_ADAPTIVE_WORKFLOW_CONFIG: adaptiveWorkflow.defaultProfile must be standard|governed');
  }
  return {
    enabled: enabled ?? false,
    defaultProfile: (defaultProfile as TaskWorkflowProfile | undefined) ?? 'standard',
  };
}

export function writeAdaptiveWorkflowConfig(paths: ProjectPaths, config: AdaptiveWorkflowConfig): AdaptiveWorkflowConfig {
  assertAdaptiveWorkflowConfig(config);
  const projectConfig = readProjectConfig(paths);
  projectConfig.adaptiveWorkflow = {
    enabled: config.enabled,
    defaultProfile: config.defaultProfile,
  };
  writeAtomic(paths.configFile, stringifyYaml(projectConfig));
  return config;
}

export function resolveTaskWorkflowProfile(
  paths: ProjectPaths,
  explicitProfile?: string,
  overrideReason?: string,
): ResolvedTaskWorkflowProfile {
  const config = readAdaptiveWorkflowConfig(paths);
  if (!config.enabled) {
    if (explicitProfile !== undefined) {
      throw new Error('ADAPTIVE_WORKFLOW_DISABLED: project adaptive workflow is not enabled');
    }
    return {
      profile: 'legacy',
      profileSource: 'legacy',
      profileOverrideReason: null,
    };
  }

  if (explicitProfile !== undefined && !isTaskWorkflowProfile(explicitProfile)) {
    throw new Error(`INVALID_WORKFLOW_PROFILE: ${explicitProfile} (must be standard|governed)`);
  }

  const profile = explicitProfile ?? config.defaultProfile;
  const profileSource: TaskWorkflowProfileSource = explicitProfile === undefined ? 'project-default' : 'explicit';
  const reason = overrideReason?.trim() || null;
  if (explicitProfile !== undefined && explicitProfile !== config.defaultProfile && !reason) {
    throw new Error('PROFILE_OVERRIDE_REASON_REQUIRED: --profile-reason is required when overriding project default profile');
  }
  return {
    profile,
    profileSource,
    profileOverrideReason: reason,
  };
}

export function isTaskWorkflowProfile(value: unknown): value is TaskWorkflowProfile {
  return typeof value === 'string' && TASK_PROFILES.has(value as TaskWorkflowProfile);
}

function assertAdaptiveWorkflowConfig(config: AdaptiveWorkflowConfig): void {
  if (typeof config.enabled !== 'boolean') {
    throw new Error('INVALID_ADAPTIVE_WORKFLOW_CONFIG: adaptiveWorkflow.enabled must be boolean');
  }
  if (!isTaskWorkflowProfile(config.defaultProfile)) {
    throw new Error('INVALID_ADAPTIVE_WORKFLOW_CONFIG: adaptiveWorkflow.defaultProfile must be standard|governed');
  }
}

function readProjectConfig(paths: ProjectPaths): Record<string, unknown> {
  if (!existsSync(paths.configFile)) return {};
  const parsed = parseYaml(readFileSync(paths.configFile, 'utf8')) as unknown;
  if (parsed === null || parsed === undefined) return {};
  if (!isRecord(parsed)) {
    throw new Error('INVALID_ADAPTIVE_WORKFLOW_CONFIG: config.yaml must be a YAML object');
  }
  return { ...parsed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
