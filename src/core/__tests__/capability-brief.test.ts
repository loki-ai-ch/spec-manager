import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildAgentBrief, inferTopic } from '../capability-brief.js';
import { createDecision } from '../decision.js';
import { createSpec, updateSpec } from '../spec-io.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-capability-brief-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('buildAgentBrief', () => {
  it('infers a topic and returns advisory when no history exists', () => {
    const brief = buildAgentBrief({ paths: project.paths, request: 'auth login support' });

    expect(brief.schemaVersion).toBe('agent-brief.v1');
    expect(brief.topic).toBe('auth');
    expect(brief.nextCommand).toContain('spec-manager spec new L1 --topic auth');
    expect(brief.findings).toEqual([
      expect.objectContaining({ id: 'brief.history.none', severity: 'advisory' }),
    ]);
  });

  it('includes profile recommendation, relevant specs, decisions, and suggested reads', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed', aiSummary: 'Auth summary' });
    createDecision({
      paths: project.paths,
      docCode: 'auth-L1',
      topic: 'auth',
      what: 'Use local assist brief for auth work',
      why: 'It keeps lessons visible.',
      affectedCriteria: ['AC-1'],
    });

    const brief = buildAgentBrief({ paths: project.paths, request: 'auth permission change', topic: 'auth' });

    expect(brief.profileRecommendation?.recommendedProfile).toBe('governed');
    expect(brief.relevantSpecs).toEqual([
      expect.objectContaining({ code: 'auth-L1', status: 'confirmed' }),
    ]);
    expect(brief.relevantDecisions).toEqual([
      expect.objectContaining({ id: 'DC-001', status: 'active' }),
    ]);
    expect(brief.suggestedReads.map(ref => `${ref.kind}:${ref.id}`)).toContain('spec:auth-L1');
    expect(brief.suggestedReads.map(ref => `${ref.kind}:${ref.id}`)).toContain('decision:DC-001');
    expect(brief.nextCommand).toBe('spec-manager flow status --topic auth');
  });

  it('rejects empty requests', () => {
    expect(() => buildAgentBrief({ paths: project.paths, request: '   ' }))
      .toThrow(/AGENT_BRIEF_REQUEST_REQUIRED/);
  });

  it('includes design context for visual requests when DESIGN.md exists', () => {
    writeDesignFixture();

    const brief = buildAgentBrief({ paths: project.paths, request: 'update UI button styling', topic: 'auth' });

    expect(brief.designContext?.schemaVersion).toBe('design-context.v1');
    expect(brief.designContext?.summary?.name).toBe('Heritage');
    expect(brief.designContext?.summary?.tokenCounts.colors).toBe(1);
    expect(brief.suggestedReads.map(ref => `${ref.kind}:${ref.id}`)).toContain('config:DESIGN.md');
  });

  it('does not include design context for non-visual requests', () => {
    writeDesignFixture();

    const brief = buildAgentBrief({ paths: project.paths, request: 'auth permission change', topic: 'auth' });

    expect(brief.designContext).toBeUndefined();
    expect(brief.suggestedReads.map(ref => `${ref.kind}:${ref.id}`)).not.toContain('config:DESIGN.md');
  });

  it('does not add missing DESIGN.md findings for visual requests', () => {
    const brief = buildAgentBrief({ paths: project.paths, request: 'polish frontend layout', topic: 'auth' });

    expect(brief.designContext).toBeUndefined();
    expect(brief.findings.some(finding => finding.detail.includes('DESIGN.md'))).toBe(false);
  });
});

describe('inferTopic', () => {
  it('prefers kebab-case tokens', () => {
    expect(inferTopic('add ai-capability-compensation brief')).toBe('ai-capability-compensation');
  });
});

function writeDesignFixture(): void {
  writeFileSync(
    `${project.root}/DESIGN.md`,
    [
      '---',
      'name: Heritage',
      'colors:',
      '  primary: "#1A1C1E"',
      '---',
      '',
      '## Overview',
      '',
      'Editorial design system.',
    ].join('\n'),
    'utf8',
  );
}
