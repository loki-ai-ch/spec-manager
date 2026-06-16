import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { recommendWorkflowProfile } from '../profile-recommendation.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-profile-recommendation-');
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('recommendWorkflowProfile', () => {
  it('returns schema, adaptive workflow status, reasons and override guidance', () => {
    const recommendation = recommendWorkflowProfile({
      paths: project.paths,
      request: 'Add CLI support for profile recommendation',
    });

    expect(recommendation.schemaVersion).toBe('profile-recommendation.experimental.v1');
    expect(recommendation.ruleVersion).toBe('profile-recommendation-rules.v1');
    expect(recommendation.recommendedProfile).toBe('standard');
    expect(recommendation.adaptiveWorkflow).toMatchObject({
      enabled: false,
      defaultProfile: 'standard',
    });
    expect(recommendation.adaptiveWorkflow.note).toContain('legacy completion semantics');
    expect(recommendation.reasons.length).toBeGreaterThan(0);
    expect(recommendation.override.allowed).toBe(true);
  });

  it('recommends governed for high-risk request keywords', () => {
    const recommendation = recommendWorkflowProfile({
      paths: project.paths,
      request: 'Change auth token permission checks for production deploy',
    });

    expect(recommendation.recommendedProfile).toBe('governed');
    expect(recommendation.riskFactors.some(factor => factor.severity === 'high')).toBe(true);
    expect(recommendation.riskFactors.map(factor => factor.id)).toEqual([
      'security_or_permission',
      'production_or_deploy',
    ]);
    expect(recommendation.reasons.join('\n')).toContain('critical AC');
  });

  it('recommends governed for workflow core files and keeps deterministic output', () => {
    const input = {
      paths: project.paths,
      request: 'Refactor workflow internals',
      files: ['src/core/task-completion.ts', '', 'docs/methodology.md'],
    };

    const first = recommendWorkflowProfile(input);
    const second = recommendWorkflowProfile(input);

    expect(first).toEqual(second);
    expect(first.recommendedProfile).toBe('governed');
    expect(first.riskFactors.some(factor => factor.id === 'workflow_core')).toBe(true);
  });

  it('recommends quick for low-risk text changes', () => {
    const recommendation = recommendWorkflowProfile({
      paths: project.paths,
      request: 'Fix typo in docs copy',
      files: ['README.md'],
    });

    expect(recommendation.recommendedProfile).toBe('quick');
    expect(recommendation.riskFactors).toEqual([
      expect.objectContaining({ id: 'small_text_change', severity: 'low' }),
    ]);
    expect(recommendation.reasons.join('\n')).toContain('Quick is limited');
    expect(recommendation.override.requiresReason).toBe(false);
  });

  it('promotes quick-like requests to governed when higher risk also matches', () => {
    const recommendation = recommendWorkflowProfile({
      paths: project.paths,
      request: 'Fix typo in auth permission copy',
    });

    expect(recommendation.recommendedProfile).toBe('governed');
    expect(recommendation.riskFactors.map(factor => factor.id)).toEqual([
      'security_or_permission',
      'small_text_change',
    ]);
  });

  it('defaults to standard when no rule matches', () => {
    const recommendation = recommendWorkflowProfile({
      paths: project.paths,
      request: 'Investigate behavior and decide next step',
    });

    expect(recommendation.recommendedProfile).toBe('standard');
    expect(recommendation.riskFactors).toEqual([
      expect.objectContaining({ id: 'default_standard', severity: 'medium' }),
    ]);
  });

  it('includes enabled adaptive workflow config', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'governed' });

    const recommendation = recommendWorkflowProfile({
      paths: project.paths,
      request: 'Add feature tests',
    });

    expect(recommendation.adaptiveWorkflow).toMatchObject({
      enabled: true,
      defaultProfile: 'governed',
    });
    expect(recommendation.adaptiveWorkflow.note).toContain('adaptive workflow enabled');
  });

  it('rejects empty requests', () => {
    expect(() => recommendWorkflowProfile({ paths: project.paths, request: '   ' }))
      .toThrow(/PROFILE_RECOMMENDATION_REQUEST_REQUIRED/);
  });
});
