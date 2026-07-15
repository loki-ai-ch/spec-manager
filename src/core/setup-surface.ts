import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { ProjectPaths } from './paths.js';
import {
  detectAgentProviders,
  listAgentProviders,
  type AgentProvider,
} from './agents.js';
import { resolveSpecStore, type SpecStoreDiagnostic, type SpecStoreResolvedEntry } from './spec-store.js';
import { buildWorkflowNextProjection } from './workflow-surface.js';
import { readAdaptiveWorkflowConfig, type TaskWorkflowProfile } from './workflow-profile.js';

export type UxProfile = 'core' | 'advanced';
export type SetupProviderStatus = 'installed' | 'available' | 'unknown';

export interface SetupWorkflowProfileSummary {
  enabled: boolean;
  defaultProfile: TaskWorkflowProfile;
}

export interface SetupProviderProjection {
  provider: AgentProvider;
  status: SetupProviderStatus;
  files: string[];
  suggestedCommand: string | null;
}

export interface SetupSurfaceProjection {
  schemaVersion: 'setup.v1';
  projectRoot: string;
  initialized: boolean;
  executionRoot: string;
  writeRoot: string;
  writeStore: SpecStoreResolvedEntry;
  contextSources: SpecStoreResolvedEntry[];
  uxProfile: UxProfile;
  workflowProfile: SetupWorkflowProfileSummary;
  providers: SetupProviderProjection[];
  diagnostics: SpecStoreDiagnostic[];
  blockingReason: string | null;
  nextAction: string;
  suggestedCommands: string[];
}

export interface BuildSetupSurfaceOptions {
  request?: string;
  topic?: string;
}

export function buildSetupSurface(
  paths: ProjectPaths,
  opts: BuildSetupSurfaceOptions = {},
): SetupSurfaceProjection {
  const store = resolveSpecStore(paths);
  const next = buildWorkflowNextProjection(paths, { request: opts.request, topic: opts.topic });
  const diagnostics = [...store.diagnostics, ...uxProfileDiagnostics(paths)];
  const blocking = diagnostics.find(diagnostic => diagnostic.severity === 'error');
  const suggestedCommands = setupSuggestedCommands(paths, next.suggestedCommands, blocking);

  return {
    schemaVersion: 'setup.v1',
    projectRoot: paths.root,
    initialized: paths.isInitialized,
    executionRoot: store.executionRoot,
    writeRoot: store.writeRoot,
    writeStore: store.writeStore,
    contextSources: store.contextSources,
    uxProfile: readUxProfile(paths),
    workflowProfile: readWorkflowProfileSummary(paths),
    providers: buildProviderProjections(paths),
    diagnostics,
    blockingReason: blocking ? `${blocking.code}: ${blocking.message}` : (next.blockingReason ?? null),
    nextAction: next.nextAction || 'spec-manager next "<work>"',
    suggestedCommands,
  };
}

function buildProviderProjections(paths: ProjectPaths): SetupProviderProjection[] {
  const detected = detectAgentProviders(paths);
  const detectedProviders = new Set(detected.providers);
  return listAgentProviders().map((info) => ({
    provider: info.provider,
    status: detectedProviders.has(info.provider) ? 'installed' : 'available',
    files: detected.reasons[info.provider] ?? info.files,
    suggestedCommand: detectedProviders.has(info.provider)
      ? null
      : `spec-manager project agents --provider ${info.provider}`,
  }));
}

function readWorkflowProfileSummary(paths: ProjectPaths): SetupWorkflowProfileSummary {
  const config = readAdaptiveWorkflowConfig(paths);
  return {
    enabled: config.enabled,
    defaultProfile: config.defaultProfile,
  };
}

function readUxProfile(paths: ProjectPaths): UxProfile {
  const value = readProjectConfigValue(paths, 'uxProfile');
  return value === 'advanced' ? 'advanced' : 'core';
}

function uxProfileDiagnostics(paths: ProjectPaths): SpecStoreDiagnostic[] {
  const value = readProjectConfigValue(paths, 'uxProfile');
  if (value === undefined || value === null || value === 'core' || value === 'advanced') return [];
  return [{
    severity: 'warning',
    code: 'ux_profile_invalid',
    message: 'uxProfile must be core or advanced.',
    fix: 'Use uxProfile: core or uxProfile: advanced in .spec-manager/config.yaml.',
  }];
}

function readProjectConfigValue(paths: ProjectPaths, key: string): unknown {
  if (!existsSync(paths.configFile)) return undefined;
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(paths.configFile, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  return (parsed as Record<string, unknown>)[key];
}

function setupSuggestedCommands(
  paths: ProjectPaths,
  nextCommands: string[],
  blocking?: SpecStoreDiagnostic,
): string[] {
  const commands = new Set<string>();
  if (!paths.isInitialized) commands.add('spec-manager project init --name <project-name>');
  commands.add('spec-manager project context --json');
  commands.add('spec-manager project store doctor');
  commands.add('spec-manager project agents --provider all');
  for (const command of nextCommands) commands.add(command);
  if (blocking?.fix) commands.add('spec-manager project store doctor');
  if (commands.size === 0) commands.add('spec-manager next "<work>"');
  return [...commands];
}
