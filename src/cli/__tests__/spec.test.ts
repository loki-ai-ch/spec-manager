import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerSpec } from '../spec.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-spec-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit:${code}`);
  });
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSpec(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function stderr(): string {
  return errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createL3WithPlan(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1-login', level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1-login', {
    content: `# Login

## 目标
goal

## 实施步骤
steps

## 验证命令
npm test

## 代码调查
\`src/core/auth.ts\`

## planJson (final)

\`\`\`json
{
  "coveredSpecs": ["auth-L3.1.1-login"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 auth-L3.1.1-login 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "验证 npm test"}
  ]
}
\`\`\`
`,
    aiSummary: 'login implementation',
  });
  return 'auth-L3.1.1-login';
}

describe('spec CLI', () => {
  it('freezes a draft L3 with one confirm approval', async () => {
    const code = createL3WithPlan();

    await makeProgram().parseAsync(['spec', 'confirm', code], { from: 'user' });

    expect(findSpecByCode(project.paths, code)?.fm.status).toBe('frozen');
    expect(output()).toContain('draft → frozen');
  });

  it('keeps draft L1 confirmation at confirmed', async () => {
    createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(project.paths, 'billing-L1', { content: '# Billing\n', aiSummary: 'billing' });

    await makeProgram().parseAsync(['spec', 'confirm', 'billing-L1'], { from: 'user' });

    expect(findSpecByCode(project.paths, 'billing-L1')?.fm.status).toBe('confirmed');
    expect(output()).toContain('draft → confirmed');
  });

  it('keeps historical confirmed L3 compatible with freeze', async () => {
    const code = createL3WithPlan();
    updateSpec(project.paths, code, { status: 'confirmed' });

    await makeProgram().parseAsync(['spec', 'freeze', code], { from: 'user' });

    expect(findSpecByCode(project.paths, code)?.fm.status).toBe('frozen');
  });

  it('rejects freezing a draft L1', async () => {
    createSpec({ paths: project.paths, code: 'draft-L1', level: 'L1', title: 'Draft', topic: 'draft', parentCode: null });
    updateSpec(project.paths, 'draft-L1', { content: '# Draft\n', aiSummary: 'draft' });

    await expect(makeProgram().parseAsync(['spec', 'freeze', 'draft-L1'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('L1/L2 请先使用 spec-manager spec confirm');
  });

  it('rejects confirming a placeholder draft L3', async () => {
    createSpec({ paths: project.paths, code: 'placeholder-L1', level: 'L1', title: 'Placeholder', topic: 'placeholder', parentCode: null });
    updateSpec(project.paths, 'placeholder-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'placeholder-L2', level: 'L2', title: 'Placeholder design', topic: 'placeholder', parentCode: 'placeholder-L1' });
    updateSpec(project.paths, 'placeholder-L2', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'placeholder-L3', level: 'L3', title: 'Placeholder', topic: 'placeholder', parentCode: 'placeholder-L2' });

    await expect(makeProgram().parseAsync(['spec', 'confirm', 'placeholder-L3'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('R22');
  });

  it('validates planJson from an L3 spec markdown', async () => {
    const code = createL3WithPlan();

    await makeProgram().parseAsync(['spec', 'validate-plan', '--from-spec', code], { from: 'user' });

    expect(output()).toContain('planJson 校验通过');
  });

  it('rejects validate-plan without file or from-spec', async () => {
    await expect(makeProgram().parseAsync(['spec', 'validate-plan'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('validate-plan 需要 <file> 或 --from-spec <code>');
  });

  it('prints placeholder marker warning during spec validate', async () => {
    createSpec({ paths: project.paths, code: 'placeholder-L1', level: 'L1', title: 'Placeholder', topic: 'placeholder', parentCode: null });

    await makeProgram().parseAsync(['spec', 'validate', 'placeholder-L1'], { from: 'user' });

    expect(output()).toContain('[placeholder_marker]');
  });

  it('does not print placeholder warning for a complete marker example', async () => {
    createSpec({ paths: project.paths, code: 'docs-L1', level: 'L1', title: 'Docs', topic: 'docs', parentCode: null });
    updateSpec(project.paths, 'docs-L1', {
      content: `# Placeholder validation

## 背景
This complete specification documents placeholder validation behavior across validate, guide, flow, and doctor.

## 用户故事
As a maintainer, I want examples such as <!-- 在此粘贴正文 --> to remain valid documentation.

## 验收标准
1. **AC-1**: Given a complete specification, When it references the marker, Then validation SHALL not report a placeholder.

## 范围边界
The real scaffold marker in a short, otherwise empty specification remains blocked by R22.
`,
      aiSummary: 'documents placeholder behavior',
    });

    await makeProgram().parseAsync(['spec', 'validate', 'docs-L1'], { from: 'user' });

    expect(output()).not.toContain('[placeholder_marker]');
  });
});
