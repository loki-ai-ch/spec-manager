import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildAgentBrief, inferTopic } from '../capability-brief.js';
import { createDecision } from '../decision.js';
import { createSpec, findSpecByCode, updateSpec } from '../spec-io.js';
import { setKnowledgeAnnotation } from '../knowledge.js';

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
  it('does not write during brief and projects explicit knowledge', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed', aiSummary: 'Auth permission knowledge' });
    setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:auth-L1',
      state: 'current',
      reason: 'Reviewed for current auth behavior.',
      now: '2026-07-16T08:00:00.000Z',
    });
    const registryBefore = readFileSync(project.paths.knowledgeFile, 'utf8');
    const specPath = findSpecByCode(project.paths, 'auth-L1')!.filePath;
    const specBefore = readFileSync(specPath, 'utf8');

    const brief = buildAgentBrief({ paths: project.paths, request: 'Auth permission knowledge', topic: 'auth' });

    expect(brief.relevantSpecs[0].knowledge).toMatchObject({ state: 'current', basis: 'explicit' });
    expect(readFileSync(project.paths.knowledgeFile, 'utf8')).toBe(registryBefore);
    expect(readFileSync(specPath, 'utf8')).toBe(specBefore);
  });

  it('does not create a registry while projecting default unknown', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed', aiSummary: 'Auth permission knowledge' });
    const brief = buildAgentBrief({ paths: project.paths, request: 'Auth permission knowledge', topic: 'auth' });
    expect(brief.relevantSpecs[0].knowledge).toMatchObject({ state: 'unknown', basis: 'default' });
    expect(existsSync(project.paths.knowledgeFile)).toBe(false);
  });
  it('infers a topic and returns advisory when no history exists', () => {
    const brief = buildAgentBrief({ paths: project.paths, request: 'auth login support' });

    expect(brief.schemaVersion).toBe('agent-brief.v1');
    expect(brief.topic).toBeNull();
    expect(brief.selectedTopic).toBeNull();
    expect(brief.topicRecommendation).toMatchObject({ selection: 'create-new', selectionRequired: true });
    expect(brief.nextCommand).toContain('spec-manager spec new L1 --topic auth');
    expect(brief.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'brief.topic.create-new-required', severity: 'advisory' }),
      expect.objectContaining({ id: 'brief.history.none', severity: 'advisory' }),
    ]));
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

  it('prefers specs/DESIGN.md for visual request design context', () => {
    writeDesignFixture();
    writeManagedDesignFixture();

    const brief = buildAgentBrief({ paths: project.paths, request: 'update UI button styling', topic: 'auth' });

    expect(brief.designContext?.summary?.name).toBe('Managed Specs');
    expect(brief.designContext?.path).toBe(`${project.root}/specs/DESIGN.md`);
  });

  it('includes design philosophy guidance for visual requests when DESIGN.md exists', () => {
    writeDesignFixture();

    const brief = buildAgentBrief({ paths: project.paths, request: 'update UI button styling', topic: 'auth' });

    expect(brief.designGuidance).toHaveLength(4);
    expect(brief.designGuidance).toEqual(expect.arrayContaining([
      expect.stringContaining('Read DESIGN.md prose'),
      expect.stringContaining('specific sources of inspiration'),
      expect.stringContaining('negative constraints'),
    ]));
  });

  it('does not include design context for non-visual requests', () => {
    writeDesignFixture();

    const brief = buildAgentBrief({ paths: project.paths, request: 'auth permission change', topic: 'auth' });

    expect(brief.designContext).toBeUndefined();
    expect(brief.designGuidance).toBeUndefined();
    expect(brief.suggestedReads.map(ref => `${ref.kind}:${ref.id}`)).not.toContain('config:DESIGN.md');
  });

  it('does not add missing DESIGN.md findings for visual requests', () => {
    const brief = buildAgentBrief({ paths: project.paths, request: 'polish frontend layout', topic: 'auth' });

    expect(brief.designContext).toBeUndefined();
    expect(brief.designGuidance).toBeUndefined();
    expect(brief.findings.some(finding => finding.detail.includes('DESIGN.md'))).toBe(false);
  });

  it('retrieves cross-topic specs for a mixed Chinese and English request', () => {
    createSpec({ paths: project.paths, code: 'agent-install-surface-L1', level: 'L1', title: 'Agent Install', topic: 'agent-install-surface', parentCode: null });
    updateSpec(project.paths, 'agent-install-surface-L1', { status: 'confirmed', aiSummary: '为多种 Agent 提供安装入口' });
    createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(project.paths, 'billing-L1', { status: 'confirmed', aiSummary: 'Billing invoices and payments' });

    const brief = buildAgentBrief({ paths: project.paths, request: '让 L0 L1 L2 角色 Agent 协作' });

    expect(brief.retrieval).toEqual(expect.objectContaining({ scope: 'project', explicitTopic: null }));
    expect(brief.relevantSpecs.map(spec => spec.code)).toContain('agent-install-surface-L1');
    expect(brief.topicRecommendation).toMatchObject({
      selection: 'candidate', selectionRequired: false, createNewAllowed: true,
      candidates: [expect.objectContaining({ topic: 'agent-install-surface' })],
    });
    expect(brief.topic).toBe('agent-install-surface');
    expect(brief.selectedTopic).toBe('agent-install-surface');
    expect(brief.relevantSpecs.find(spec => spec.code === 'agent-install-surface-L1')?.match)
      .toEqual(expect.objectContaining({ confidence: expect.any(String), reasons: expect.any(Array) }));
  });

  it('keeps an explicit topic as a strict retrieval scope', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed', aiSummary: 'Agent authentication' });
    createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(project.paths, 'billing-L1', { status: 'confirmed', aiSummary: 'Billing invoices' });

    const brief = buildAgentBrief({ paths: project.paths, request: 'Agent authentication', topic: 'billing' });

    expect(brief.retrieval).toEqual(expect.objectContaining({ scope: 'topic', explicitTopic: 'billing' }));
    expect(brief.relevantSpecs.map(spec => spec.code)).toEqual(['billing-L1']);
  });

  it('adds per-item trust, path state and explainable conflict candidates', () => {
    mkdirSync(`${project.root}/src/core`, { recursive: true });
    writeFileSync(`${project.root}/src/core/current.ts`, 'export {};\n');
    createSpec({ paths: project.paths, code: 'trust-L1', level: 'L1', title: 'Trust', topic: 'trust', parentCode: null });
    updateSpec(project.paths, 'trust-L1', { status: 'confirmed', content: '# Trust\n', aiSummary: 'module access' });
    createSpec({ paths: project.paths, code: 'trust-L2.1', level: 'L2', title: 'Trust Design', topic: 'trust', parentCode: 'trust-L1' });
    updateSpec(project.paths, 'trust-L2.1', { status: 'confirmed', content: '# Design\n', aiSummary: 'module access design' });
    createSpec({ paths: project.paths, code: 'trust-L3.1.1', level: 'L3', title: 'Trust Impl', topic: 'trust', parentCode: 'trust-L2.1' });
    updateSpec(project.paths, 'trust-L3.1.1', {
      status: 'frozen', aiSummary: 'retain module access',
      content: '# Impl\n\n## 验收标准\n1. **AC-1**: System SHALL retain module access.\n\nUse `src/core/current.ts` and `src/core/removed.ts`.\n',
    });
    setKnowledgeAnnotation({ paths: project.paths, sourceRef: 'spec:trust-L3.1.1', state: 'current', reason: 'Reviewed current constraint.' });

    const brief = buildAgentBrief({ paths: project.paths, request: 'remove module access', topic: 'trust' });
    expect(brief.constraintPackage?.acceptanceCriteria[0]).toMatchObject({
      id: 'AC-1', confidence: expect.any(Number), knowledgeState: 'current', sourceRefs: [expect.objectContaining({ id: 'trust-L3.1.1' })],
    });
    expect(brief.constraintPackage?.codeModules).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'src/core/current.ts', pathState: 'current-path', detection: 'structured', knowledgeState: 'current' }),
      expect.objectContaining({ path: 'src/core/removed.ts', pathState: 'unknown-path', pathReason: 'missing-no-history', detection: 'structured', knowledgeState: 'current' }),
    ]));
    expect(brief.constraintPackage?.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        verdict: 'candidate',
        reasonCodes: ['polarity-mismatch', 'shared-object-term'],
        matchedTerms: expect.arrayContaining(['access', 'module']),
        polarity: { request: 'negative', historical: 'positive' },
        historicalEvidenceRef: 'ac:trust-L3.1.1:AC-1',
      }),
    ]));
  });

  it('detects CJK conflict candidates, weak unknowns, and same-polarity non-conflicts', () => {
    createSpec({ paths: project.paths, code: 'knowledge-L1', level: 'L1', title: 'Knowledge', topic: 'knowledge', parentCode: null });
    updateSpec(project.paths, 'knowledge-L1', { status: 'confirmed', content: '# Knowledge\n', aiSummary: '自动批准知识记录' });
    createSpec({ paths: project.paths, code: 'knowledge-L2.1', level: 'L2', title: 'Knowledge Design', topic: 'knowledge', parentCode: 'knowledge-L1' });
    updateSpec(project.paths, 'knowledge-L2.1', { status: 'confirmed', content: '# Design\n', aiSummary: '自动批准知识记录' });
    createSpec({ paths: project.paths, code: 'knowledge-L3.1.1', level: 'L3', title: 'Knowledge Impl', topic: 'knowledge', parentCode: 'knowledge-L2.1' });
    updateSpec(project.paths, 'knowledge-L3.1.1', {
      status: 'frozen',
      aiSummary: '自动批准知识记录',
      content: '# Impl\n\n## 验收标准\n1. **AC-1**: 系统自动批准知识记录。\n2. **AC-2**: 系统批准发布。\n',
    });

    const candidate = buildAgentBrief({ paths: project.paths, request: '禁止自动批准知识记录', topic: 'knowledge' });
    expect(candidate.constraintPackage?.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        verdict: 'candidate',
        matchedTerms: expect.arrayContaining(['自动', '批准', '知识']),
        polarity: { request: 'negative', historical: 'positive' },
      }),
    ]));

    const unknown = buildAgentBrief({ paths: project.paths, request: '禁止批准流程', topic: 'knowledge' });
    expect(unknown.constraintPackage?.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ verdict: 'unknown', matchedTerms: ['批准'] }),
    ]));

    const none = buildAgentBrief({ paths: project.paths, request: '允许自动批准知识记录', topic: 'knowledge' });
    expect(none.constraintPackage?.conflicts ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ historicalEvidenceRef: 'ac:knowledge-L3.1.1:AC-1' }),
    ]));
  });

  it('requires explicit topic selection for ambiguous history matches', () => {
    createSpec({ paths: project.paths, code: 'alpha-L1', level: 'L1', title: 'Shared Workflow', topic: 'alpha', parentCode: null });
    updateSpec(project.paths, 'alpha-L1', { status: 'confirmed', content: '# Shared Workflow\n', aiSummary: 'shared workflow' });
    createSpec({ paths: project.paths, code: 'beta-L1', level: 'L1', title: 'Shared Workflow', topic: 'beta', parentCode: null });
    updateSpec(project.paths, 'beta-L1', { status: 'confirmed', content: '# Shared Workflow\n', aiSummary: 'shared workflow' });

    const brief = buildAgentBrief({ paths: project.paths, request: 'shared workflow' });

    expect(brief.topic).toBeNull();
    expect(brief.topicRecommendation).toMatchObject({ selection: 'ambiguous', selectionRequired: true });
    expect(brief.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'brief.topic.selection-required',
        nextCommand: 'spec-manager brief "shared workflow" --topic alpha',
      }),
    ]));
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

function writeManagedDesignFixture(): void {
  mkdirSync(`${project.root}/specs`, { recursive: true });
  writeFileSync(
    `${project.root}/specs/DESIGN.md`,
    [
      '---',
      'name: Managed Specs',
      'colors:',
      '  primary: "#2A2C2E"',
      '---',
      '',
      '## Overview',
      '',
      'Managed specs design system.',
    ].join('\n'),
    'utf8',
  );
}
