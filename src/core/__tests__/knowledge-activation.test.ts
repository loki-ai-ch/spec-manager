import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../spec-io.js';
import { buildKnowledgeActivation, extractModuleConstraints } from '../knowledge-activation.js';
import type { KnowledgeProjection } from '../capability-types.js';
import { setKnowledgeAnnotation } from '../knowledge.js';

let project: TestProject;
beforeEach(() => { project = createTestProject('knowledge-activation-paths-'); });
afterEach(() => project.cleanup());

describe('extractModuleConstraints', () => {
  it('distinguishes current, historical and unknown paths with detection evidence', () => {
    mkdirSync(`${project.root}/src/core`, { recursive: true });
    writeFileSync(`${project.root}/src/core/current.ts`, 'export {};\n');
    createSpec({ paths: project.paths, code: 'paths-L1', level: 'L1', title: 'Paths', topic: 'paths', parentCode: null });
    updateSpec(project.paths, 'paths-L1', {
      content: '# Paths\n\nUse `src/core/current.ts` and `src/core/removed.ts`. Plain mention src/core/maybe.ts.\n', aiSummary: 'paths',
    });
    const spec = findSpecByCode(project.paths, 'paths-L1')!;
    const historicalKnowledge: KnowledgeProjection = {
      state: 'historical',
      basis: 'explicit',
      reason: 'Removed module from older implementation.',
      reviewedAt: '2026-07-17T00:00:00.000Z',
    };
    expect(extractModuleConstraints(project.paths, spec, [], historicalKnowledge).map(item => [item.path, item.pathState, item.pathReason, item.contained, item.detection])).toEqual([
      ['src/core/current.ts', 'current-path', 'current-exists', true, 'structured'],
      ['src/core/maybe.ts', 'historical-path', 'historical-source', true, 'text-fallback'],
      ['src/core/removed.ts', 'historical-path', 'historical-source', true, 'structured'],
    ]);
  });

  it('does not mark missing current sources as historical without explicit history evidence', () => {
    createSpec({ paths: project.paths, code: 'paths-L1', level: 'L1', title: 'Paths', topic: 'paths', parentCode: null });
    updateSpec(project.paths, 'paths-L1', {
      content: '# Paths\n\nUse `src/core/removed.ts`.\n', aiSummary: 'paths',
    });
    const spec = findSpecByCode(project.paths, 'paths-L1')!;

    expect(extractModuleConstraints(project.paths, spec)).toEqual([
      expect.objectContaining({
        path: 'src/core/removed.ts',
        pathState: 'unknown-path',
        pathReason: 'missing-no-history',
        contained: true,
      }),
    ]);
  });

  it('rejects traversal and symlink escapes before treating paths as current', () => {
    mkdirSync(`${project.root}/src`, { recursive: true });
    const sibling = `${project.root}-outside`;
    const traversalPath = `src/../../${basename(sibling)}/secret.ts`;
    rmSync(sibling, { recursive: true, force: true });
    mkdirSync(sibling, { recursive: true });
    writeFileSync(`${sibling}/secret.ts`, 'export {};\n');
    symlinkSync(sibling, `${project.root}/src/outside`);
    createSpec({ paths: project.paths, code: 'paths-L1', level: 'L1', title: 'Paths', topic: 'paths', parentCode: null });
    updateSpec(project.paths, 'paths-L1', {
      content: `# Paths\n\nUse \`${traversalPath}\` and \`src/outside/secret.ts\`.\n`,
      aiSummary: 'paths',
    });
    const spec = findSpecByCode(project.paths, 'paths-L1')!;

    expect(extractModuleConstraints(project.paths, spec)).toEqual([
      expect.objectContaining({ path: traversalPath, pathState: 'unknown-path', pathReason: 'outside-root', contained: false }),
      expect.objectContaining({ path: 'src/outside/secret.ts', pathState: 'unknown-path', pathReason: 'outside-root', contained: false }),
    ]);
    rmSync(sibling, { recursive: true, force: true });
  });
});

describe('canonical topic recommendation', () => {
  it('returns ambiguous for equally strong topics and always allows create-new', () => {
    createSpec({ paths: project.paths, code: 'alpha-L1', level: 'L1', title: 'Shared Workflow', topic: 'alpha', parentCode: null });
    updateSpec(project.paths, 'alpha-L1', { content: '# Shared Workflow\n', aiSummary: 'shared workflow' });
    createSpec({ paths: project.paths, code: 'beta-L1', level: 'L1', title: 'Shared Workflow', topic: 'beta', parentCode: null });
    updateSpec(project.paths, 'beta-L1', { content: '# Shared Workflow\n', aiSummary: 'shared workflow' });
    const activation = buildKnowledgeActivation({ paths: project.paths, request: 'shared workflow' });
    expect(activation.topicRecommendation).toMatchObject({
      selection: 'ambiguous', selectionRequired: true, createNewAllowed: true,
      candidates: [expect.objectContaining({ topic: 'alpha' }), expect.objectContaining({ topic: 'beta' })],
    });
    expect(activation.selectedTopic).toBeNull();
    expect(activation.suggestedTopic).toBeNull();
  });

  it('returns create-new when no history matches', () => {
    const activation = buildKnowledgeActivation({ paths: project.paths, request: 'unrelated request' });
    expect(activation.topicRecommendation).toEqual({ candidates: [], selection: 'create-new', selectionRequired: true, createNewAllowed: true });
    expect(activation.selectedTopic).toBeNull();
    expect(activation.suggestedTopic).toBeNull();
  });

  it('selects the canonical candidate only for high-confidence matches', () => {
    createSpec({ paths: project.paths, code: 'agent-install-L1', level: 'L1', title: 'Agent Install', topic: 'agent-install', parentCode: null });
    updateSpec(project.paths, 'agent-install-L1', { content: '# Agent Install\n\nAgent install workflow.\n', aiSummary: 'Agent install workflow' });

    const activation = buildKnowledgeActivation({ paths: project.paths, request: 'Agent install workflow' });

    expect(activation.topicRecommendation.selection).toBe('candidate');
    expect(activation.selectedTopic).toBe('agent-install');
    expect(activation.selectionRequired).toBe(false);
  });

  it('counts current topic knowledge with the resolver instead of lifecycle status', () => {
    createSpec({ paths: project.paths, code: 'knowledge-L1', level: 'L1', title: 'Knowledge', topic: 'knowledge', parentCode: null });
    updateSpec(project.paths, 'knowledge-L1', { status: 'confirmed', content: '# Knowledge\n\nShared resolver topic.\n', aiSummary: 'Shared resolver topic' });
    createSpec({ paths: project.paths, code: 'knowledge-L2.1', level: 'L2', title: 'Knowledge Design', topic: 'knowledge', parentCode: 'knowledge-L1' });
    updateSpec(project.paths, 'knowledge-L2.1', { status: 'archived', content: '# Knowledge Design\n\nShared resolver topic.\n', aiSummary: 'Shared resolver topic' });
    setKnowledgeAnnotation({
      paths: project.paths,
      sourceRef: 'spec:knowledge-L1',
      state: 'current',
      reason: 'Reviewed as current.',
      now: '2026-07-17T00:00:00.000Z',
    });

    const activation = buildKnowledgeActivation({ paths: project.paths, request: 'shared resolver topic' });

    expect(activation.topicRecommendation.candidates[0]).toMatchObject({
      topic: 'knowledge',
      relatedSpecCount: 2,
      currentKnowledgeCount: 1,
    });
  });
});
