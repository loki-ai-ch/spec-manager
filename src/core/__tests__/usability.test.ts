import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask } from '../task.js';
import { getFlowStatus, renderTemplate, runProjectDoctor } from '../usability.js';
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
});

describe('getFlowStatus', () => {
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

describe('renderTemplate', () => {
  it('renders title placeholders', () => {
    const content = renderTemplate(process.cwd(), 'L1', 'User authentication');
    expect(content).toContain('# User authentication');
  });
});
