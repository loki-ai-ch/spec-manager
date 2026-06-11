import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSpec, findSpecByCode, updateSpec, writeSpec } from '../spec-io.js';
import { createTask } from '../task.js';
import { getFlowStatus, getUpstreamFreezeAdvice, readProjectContext, renderRichGuide, renderTemplate, runProjectDoctor, suggestAfterSpecCommand } from '../usability.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-usability-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('runProjectDoctor', () => {
  it('reports missing agent setup as a warning with an action', () => {
    const checks = runProjectDoctor(project.paths);
    const agentCheck = checks.find((c) => c.label === 'AI agent instructions');
    expect(agentCheck?.status).toBe('warn');
    expect(agentCheck?.action).toBe('spec-manager project agents --provider all');
  });

  it('suggests safe managed sync instead of force for incomplete Claude skill assets', () => {
    mkdirSync(join(project.root, '.claude', 'skills', 'spec-manager'), { recursive: true });
    const checks = runProjectDoctor(project.paths);
    const rules = checks.find(check => check.label === 'Claude skill rules bundled');
    expect(rules?.action).toContain('--sync-managed --dry-run');
    expect(rules?.action).not.toContain('--force');
  });

  it('suggests safe managed sync instead of force for incomplete CodeBuddy skill assets', () => {
    mkdirSync(join(project.root, '.codebuddy', 'skills', 'spec-manager'), { recursive: true });
    const checks = runProjectDoctor(project.paths);
    const rules = checks.find(check => check.label === 'CodeBuddy skill rules bundled');
    expect(rules?.action).toContain('--sync-managed --dry-run');
    expect(rules?.action).not.toContain('--force');
  });

  it('reports managed agent asset drift with a dry-run sync action', () => {
    mkdirSync(join(project.root, '.claude', 'skills', 'spec-manager'), { recursive: true });
    writeFileSync(join(project.root, '.claude', 'skills', 'spec-manager', 'SKILL.md'), '# stale\n', 'utf8');

    const check = runProjectDoctor(project.paths, process.cwd()).find((candidate) => candidate.label === 'Managed agent assets');

    expect(check?.status).toBe('warn');
    expect(check?.detail).toContain('drifted');
    expect(check?.action).toContain('--sync-managed --dry-run');
  });

  it('does not report a complete spec that references the marker as placeholder', () => {
    createSpec({ paths: project.paths, code: 'docs-L1', level: 'L1', title: 'Docs', topic: 'docs', parentCode: null });
    updateSpec(project.paths, 'docs-L1', {
      content: completeMarkerExample(),
      aiSummary: 'documents placeholder behavior',
    });

    const check = runProjectDoctor(project.paths).find((candidate) => candidate.label === 'Spec placeholder content');

    expect(check?.status).toBe('ok');
  });
});

describe('doctor blocking', () => {
  it('marks agent setup warning as non-blocking', () => {
    const checks = runProjectDoctor(project.paths);
    const agentCheck = checks.find((c) => c.label === 'AI agent instructions');
    expect(agentCheck?.blocking).toBe(false);
  });
});

describe('getFlowStatus', () => {
  it('suggests reconciliation instead of duplicate child creation for a completed confirmed hierarchy', () => {
    createSpec({ paths: project.paths, code: 'done-L1', level: 'L1', title: 'Done', topic: 'done', parentCode: null });
    updateSpec(project.paths, 'done-L1', { content: '# Done\n', aiSummary: 'done', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'done-L2.1', level: 'L2', title: 'Done design', topic: 'done', parentCode: 'done-L1' });
    updateSpec(project.paths, 'done-L2.1', { content: '# Done design\n', aiSummary: 'done design' });
    writeImplemented('done-L2.1');
    const flow = getFlowStatus(project.paths, { topic: 'done' })[0];
    expect(flow.nextAction).toBe('spec-manager project reconcile --dry-run');
    expect(suggestAfterSpecCommand(flow.specs.find(spec => spec.fm.code === 'done-L1')!, project.paths)).toBe('spec-manager project reconcile --dry-run');
  });

  it('does not suggest duplicate children when a confirmed hierarchy is partially implemented', () => {
    createSpec({ paths: project.paths, code: 'partial-L1', level: 'L1', title: 'Partial', topic: 'partial', parentCode: null });
    updateSpec(project.paths, 'partial-L1', { content: '# Partial\n', aiSummary: 'partial', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'partial-L2.1', level: 'L2', title: 'Partial design', topic: 'partial', parentCode: 'partial-L1' });
    updateSpec(project.paths, 'partial-L2.1', { content: '# Partial design\n', aiSummary: 'partial design', status: 'confirmed' });
    expect(getFlowStatus(project.paths, { topic: 'partial' })[0].nextAction).toContain('spec-manager spec new L3');
    expect(suggestAfterSpecCommand(findSpec('partial-L1'), project.paths)).toBe('spec-manager flow status');
  });
  it('does not let a marker example override the normal next action', () => {
    createSpec({ paths: project.paths, code: 'docs-L1', level: 'L1', title: 'Docs', topic: 'docs', parentCode: null });
    updateSpec(project.paths, 'docs-L1', {
      content: completeMarkerExample(),
      aiSummary: 'documents placeholder behavior',
    });

    const flow = getFlowStatus(project.paths, { topic: 'docs' })[0];
    const spec = flow.specs[0];

    expect(flow.nextAction).toBe('spec-manager spec confirm docs-L1');
    expect(suggestAfterSpecCommand(spec, project.paths)).toContain('draft -> confirmed');
    expect(suggestAfterSpecCommand(spec, project.paths)).not.toContain('spec-manager spec update');
  });

  it('shows one-approval frozen outcome for a draft L3', () => {
    createSpec({ paths: project.paths, code: 'single-L1', level: 'L1', title: 'Single', topic: 'single', parentCode: null });
    updateSpec(project.paths, 'single-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'single-L2', level: 'L2', title: 'Single design', topic: 'single', parentCode: 'single-L1' });
    updateSpec(project.paths, 'single-L2', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'single-L3', level: 'L3', title: 'Single approval', topic: 'single', parentCode: 'single-L2' });
    updateSpec(project.paths, 'single-L3', { content: '# Single\n', aiSummary: 'single' });

    const l3 = getFlowStatus(project.paths, { topic: 'single' })[0].specs.find((spec) => spec.fm.code === 'single-L3')!;

    expect(suggestAfterSpecCommand(l3, project.paths)).toContain('draft -> frozen');
  });

  it('suggests creating task for a frozen L3 without active task', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { content: '# Auth\n', aiSummary: 'auth', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2', { content: '# Design\n', aiSummary: 'design', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3', level: 'L3', title: 'Impl', topic: 'auth', parentCode: 'auth-L2' });
    updateSpec(project.paths, 'auth-L3', { content: '# Impl\n', aiSummary: 'impl', status: 'frozen' });

    const flow = getFlowStatus(project.paths, { topic: 'auth' })[0];
    expect(flow.nextAction).toContain('spec-manager task create auth-L3');
  });

  it('suggests starting a draft task for a frozen L3', () => {
    createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(project.paths, 'billing-L1', { content: '# Billing\n', aiSummary: 'billing', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'billing-L2', level: 'L2', title: 'Design', topic: 'billing', parentCode: 'billing-L1' });
    updateSpec(project.paths, 'billing-L2', { content: '# Design\n', aiSummary: 'design', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'billing-L3', level: 'L3', title: 'Impl', topic: 'billing', parentCode: 'billing-L2' });
    updateSpec(project.paths, 'billing-L3', { content: '# Impl\n', aiSummary: 'impl', status: 'frozen' });
    createTask({
      paths: project.paths,
      specCode: 'billing-L3',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['billing-L3'],
        steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'run verify test' }],
      },
    });

    const flow = getFlowStatus(project.paths, { topic: 'billing' })[0];
    expect(flow.nextAction).toContain('spec-manager task start T-001');
  });
});

function findSpec(code: string) {
  const spec = findSpecByCode(project.paths, code);
  if (!spec) throw new Error(`missing test spec ${code}`);
  return spec;
}

function writeImplemented(code: string): void {
  const spec = findSpecByCode(project.paths, code);
  if (!spec) throw new Error(`missing test spec ${code}`);
  writeSpec({ ...spec, fm: { ...spec.fm, status: 'implemented' } });
}

function completeMarkerExample(): string {
  return `# Placeholder validation

## 背景
This complete specification documents placeholder validation behavior across validate, guide, flow, and doctor.

## 用户故事
As a maintainer, I want examples such as <!-- 在此粘贴正文 --> to remain valid documentation.

## 验收标准
1. **AC-1**: Given a complete specification, When it references the marker, Then validation SHALL not report a placeholder.

## 范围边界
The real scaffold marker in a short, otherwise empty specification remains blocked by R22.
`;
}

describe('renderTemplate', () => {
  it('renders title placeholders', () => {
    const content = renderTemplate(process.cwd(), 'L1', 'User authentication');
    expect(content).toContain('# User authentication');
  });
});

describe('readProjectContext', () => {
  it('reads optional context from config yaml', () => {
    writeFileSync(project.paths.configFile, 'project_name: test\ncontext: |\n  Tech stack: TypeScript\n  Constraint: local only\n', 'utf8');

    expect(readProjectContext(project.paths)).toBe('Tech stack: TypeScript\nConstraint: local only');
  });

  it('returns empty string when context is missing', () => {
    expect(readProjectContext(project.paths)).toBe('');
  });
});

describe('renderRichGuide', () => {
  it('renders structured guide sections for a spec', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    writeFileSync(project.paths.configFile, 'project_name: test\ncontext: |\n  Tech stack: TypeScript\n', 'utf8');

    const output = renderRichGuide(project.paths, process.cwd(), 'auth-L1');

    expect(output).toContain('<task>');
    expect(output).toContain('<project_context>');
    expect(output).toContain('Tech stack: TypeScript');
    expect(output).toContain('<rules>');
    expect(output).toContain('<required_sections>');
    expect(output).toContain('## 背景');
    expect(output).toContain('<template>');
    expect(output).toContain('<next_command>');
  });

  it('includes parent context when the requested spec has a parent', () => {
    createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(project.paths, 'billing-L1', {
      content: '# Billing\n\n## 背景\nx\n## 用户故事\nx\n## 验收标准\n1. **AC-1**: **Given** x, **When** y, **Then** z **SHALL** happen.\n## 范围边界\nx\n',
      aiSummary: 'billing parent summary',
      status: 'confirmed',
    });
    createSpec({ paths: project.paths, code: 'billing-L2', level: 'L2', title: 'Billing design', topic: 'billing', parentCode: 'billing-L1' });

    const output = renderRichGuide(project.paths, process.cwd(), 'billing-L2');

    expect(output).toContain('parent spec: billing-L1');
    expect(output).toContain('aiSummary: billing parent summary');
  });
});

describe('upstream lifecycle advice', () => {
  it('does not warn when L3 upstream L1/L2 are confirmed', () => {
    createSpec({ paths: project.paths, code: 'cache-L1', level: 'L1', title: 'Cache', topic: 'cache', parentCode: null });
    updateSpec(project.paths, 'cache-L1', { content: '# Cache\n', aiSummary: 'cache', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'cache-L2.1', level: 'L2', title: 'Cache design', topic: 'cache', parentCode: 'cache-L1' });
    updateSpec(project.paths, 'cache-L2.1', { content: '# Design\n', aiSummary: 'design', status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'cache-L3.1.1-api', level: 'L3', title: 'Cache API', topic: 'cache', parentCode: 'cache-L2.1' });
    updateSpec(project.paths, 'cache-L3.1.1-api', { content: '# Impl\n', aiSummary: 'impl', status: 'frozen' });
    const l3 = getFlowStatus(project.paths, { topic: 'cache' })[0].specs.find((s) => s.fm.code === 'cache-L3.1.1-api')!;

    expect(getUpstreamFreezeAdvice(project.paths, l3)).toEqual([]);
    expect(suggestAfterSpecCommand(l3, project.paths)).not.toContain('will not cascade');
  });

  it('warns when legacy L1/L2 upstream specs are frozen', () => {
    createSpec({ paths: project.paths, code: 'search-L1', level: 'L1', title: 'Search', topic: 'search', parentCode: null });
    updateSpec(project.paths, 'search-L1', { content: '# Search\n', aiSummary: 'search', status: 'confirmed' });
    updateSpec(project.paths, 'search-L1', { status: 'frozen' });
    createSpec({ paths: project.paths, code: 'search-L2.1', level: 'L2', title: 'Search design', topic: 'search', parentCode: 'search-L1' });
    updateSpec(project.paths, 'search-L2.1', { content: '# Design\n', aiSummary: 'design', status: 'confirmed' });
    updateSpec(project.paths, 'search-L2.1', { status: 'frozen' });
    createSpec({ paths: project.paths, code: 'search-L3.1.1-api', level: 'L3', title: 'Search API', topic: 'search', parentCode: 'search-L2.1' });
    updateSpec(project.paths, 'search-L3.1.1-api', { content: '# Impl\n', aiSummary: 'impl', status: 'frozen' });
    const l3 = getFlowStatus(project.paths, { topic: 'search' })[0].specs.find((s) => s.fm.code === 'search-L3.1.1-api')!;

    expect(getUpstreamFreezeAdvice(project.paths, l3).join('\n')).toContain('L1/L2 must be confirmed');
  });
});
