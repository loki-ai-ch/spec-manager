import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, findSpecByCode, updateSpec, generateSpecCode } from '../spec-io.js';
import { addTaskVerification, createTask, startTask, reportStep, completeTask } from '../task.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'task-complete-verify-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function createFrozenL3WithContent(content: string): string {
  const l1Code = generateSpecCode('test', 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'test', parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode('test', 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'test', parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode('test', 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'test', parentCode: l2Code });
  updateSpec(paths, l3Code, { status: 'frozen', content, aiSummary: 'test L3 spec' });
  return l3Code;
}

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [
      { stepNo: 1, stepType: 'tool_action' as const, name: 'implement feature' },
      { stepNo: 2, stepType: 'tool_action' as const, name: 'run verify test' },
    ],
  };
}

function markStepsAndVerify(paths: ProjectPaths, taskId: string, specCode: string) {
  reportStep({ paths, taskId, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"done"}' });
  reportStep({ paths, taskId, stepNo: 2, status: 'succeeded', outputJson: '{"summary":"done"}' });
  addTaskVerification({ paths, taskId, specCode, command: 'npm test', exitCode: 0, summary: 'passed' });
}

describe('completeTask — AC-1 验证命令自动执行', () => {
  it('does not execute verification commands before planned steps succeed', () => {
    const marker = join(root, 'should-not-exist');
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
touch ${marker}
\`\`\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);

    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/R5/);
    expect(existsSync(marker)).toBe(false);
  });

  it('验证命令全部通过时 complete 成功', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });

  it('验证命令失败时拒绝 complete', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
exit 1
\`\`\`

## 验收标准
1. AC-1

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/验证命令失败/);
  });

  it('skipVerification 跳过验证命令执行', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
exit 1
\`\`\`

## 验收标准
1. AC-1

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture', skipVerification: true });
    expect(result.task.status).toBe('completed');
  });

  it('无验证命令段时跳过命令执行', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });
});

describe('completeTask — AC-2 @verify 规则自动执行', () => {
  it('@verify file-exists 通过时 complete 成功', () => {
    // 创建一个真实存在的文件
    writeFileSync(join(root, 'exists.ts'), 'export const x = 1;');

    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: file-exists(exists.ts)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });

  it('@verify file-exists 失败时拒绝 complete', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: file-exists(nonexistent.ts)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/@verify 规则失败/);
  });

  it('@verify command 通过时 complete 成功', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: command(echo hello)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });

  it('@verify command 失败时拒绝 complete', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: command(exit 1)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/@verify 规则失败/);
  });

  it('@verify design-diff 通过时 complete 成功', () => {
    writeFileSync(join(root, 'DESIGN.before.md'), validDesign('Before'));
    writeFileSync(join(root, 'DESIGN.md'), [
      '---',
      'name: After',
      'colors:',
      '  accent: "#334455"',
      '  primary: "#1A1C1E"',
      '---',
      '',
      '## Overview',
      '',
      'Updated design.',
    ].join('\n'));

    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: design-diff(DESIGN.before.md, DESIGN.md)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });

  it('@verify design-diff regression 时拒绝 complete', () => {
    writeFileSync(join(root, 'DESIGN.before.md'), [
      '---',
      'name: Before',
      'colors:',
      '  primary: "#1A1C1E"',
      '  secondary: "#222222"',
      '---',
      '',
      '## Overview',
      '',
      'Before design.',
    ].join('\n'));
    writeFileSync(join(root, 'DESIGN.md'), validDesign('After'));

    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: design-diff(DESIGN.before.md, DESIGN.md)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/@verify 规则失败/);
  });

  it('--skip-verify 跳过 @verify 规则执行', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
2. @verify: file-exists(nonexistent.ts)

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, skipVerify: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });

  it('无验收标准段时跳过 @verify', () => {
    const content = `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 代码调查
\`src/core/verify.ts\`
`;
    const l3Code = createFrozenL3WithContent(content);
    const plan = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: plan });
    startTask(paths, task.id);
    markStepsAndVerify(paths, task.id, l3Code);

    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.task.status).toBe('completed');
  });
});

function validDesign(name: string): string {
  return [
    '---',
    `name: ${name}`,
    'colors:',
    '  primary: "#1A1C1E"',
    '---',
    '',
    '## Overview',
    '',
    'Valid design.',
  ].join('\n');
}
