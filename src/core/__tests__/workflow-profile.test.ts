import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  readAdaptiveWorkflowConfig,
  resolveTaskWorkflowProfile,
  writeAdaptiveWorkflowConfig,
} from '../workflow-profile.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-workflow-profile-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\nspecWorkflow: default\nrulesAppliesTo: []\ncontext: |\n  Tech stack: TypeScript\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('readAdaptiveWorkflowConfig', () => {
  it('defaults to disabled standard when config is missing adaptiveWorkflow', () => {
    expect(readAdaptiveWorkflowConfig(project.paths)).toEqual({
      enabled: false,
      defaultProfile: 'standard',
    });
  });

  it('reads enabled governed config', () => {
    writeFileSync(project.paths.configFile, 'project_name: test\nadaptiveWorkflow:\n  enabled: true\n  defaultProfile: governed\n', 'utf8');

    expect(readAdaptiveWorkflowConfig(project.paths)).toEqual({
      enabled: true,
      defaultProfile: 'governed',
    });
  });

  it('rejects invalid adaptiveWorkflow values', () => {
    writeFileSync(project.paths.configFile, 'project_name: test\nadaptiveWorkflow:\n  enabled: yes\n  defaultProfile: strict\n', 'utf8');

    expect(() => readAdaptiveWorkflowConfig(project.paths)).toThrow(/INVALID_ADAPTIVE_WORKFLOW_CONFIG/);
  });
});

describe('writeAdaptiveWorkflowConfig', () => {
  it('preserves existing project config fields semantically', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'governed' });

    const parsed = parseYaml(readFileSync(project.paths.configFile, 'utf8')) as Record<string, unknown>;
    expect(parsed.project_name).toBe('test');
    expect(parsed.specWorkflow).toBe('default');
    expect(parsed.rulesAppliesTo).toEqual([]);
    expect(parsed.context).toBe('Tech stack: TypeScript\n');
    expect(parsed.adaptiveWorkflow).toEqual({ enabled: true, defaultProfile: 'governed' });
  });
});

describe('resolveTaskWorkflowProfile', () => {
  it('resolves legacy when adaptive workflow is disabled', () => {
    expect(resolveTaskWorkflowProfile(project.paths)).toEqual({
      profile: 'legacy',
      profileSource: 'legacy',
      profileOverrideReason: null,
    });
  });

  it('rejects explicit profile when adaptive workflow is disabled', () => {
    expect(() => resolveTaskWorkflowProfile(project.paths, 'standard')).toThrow(/ADAPTIVE_WORKFLOW_DISABLED/);
  });

  it('uses project default when enabled', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });

    expect(resolveTaskWorkflowProfile(project.paths)).toEqual({
      profile: 'standard',
      profileSource: 'project-default',
      profileOverrideReason: null,
    });
  });

  it('requires a reason when overriding project default', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });

    expect(() => resolveTaskWorkflowProfile(project.paths, 'governed')).toThrow(/PROFILE_OVERRIDE_REASON_REQUIRED/);
    expect(resolveTaskWorkflowProfile(project.paths, 'governed', 'high-risk change')).toEqual({
      profile: 'governed',
      profileSource: 'explicit',
      profileOverrideReason: 'high-risk change',
    });
  });
});
