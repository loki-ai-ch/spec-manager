import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, findSpecByCode, updateSpec, generateSpecCode } from '../spec-io.js';
import { addTaskVerification, createTask, startTask, reportStep, completeTask, findTask, listTasks, failTask, waitTask, showTask } from '../task.js';
import { hit as auditHit, readAudit } from '../audit.js';
import { createDecision, setDecisionPartial } from '../decision.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-task-cascade-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * 把 plan 的所有步骤标记为 succeeded（R5: completeTask 前必须先逐个 reportStep）。
 */
function markPlanSucceeded(paths: ProjectPaths, specCode: string, planJson: { steps: Array<{ stepNo: number | string }> }, taskId: string): void {
  for (const s of planJson.steps) {
    reportStep({ paths, taskId, stepNo: s.stepNo, status: 'succeeded', outputJson: '{"summary":"ok"}' });
  }
  addTaskVerification({ paths, taskId, specCode, command: 'npm test', exitCode: 0, summary: 'passed' });
}

function planFor(specCode: string, steps = [{ stepNo: 1, stepType: 'tool_action' as const, name: 'run verify test' }]) {
  return { coveredSpecs: [specCode], steps };
}

function createFrozenHierarchy(topic = 'auth'): { l1Code: string; l2Code: string; l3Code: string } {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(paths, l3Code, { status: 'frozen' });
  return { l1Code, l2Code, l3Code };
}

function createDraftL3Hierarchy(topic = 'auth'): { l1Code: string; l2Code: string; l3Code: string } {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  return { l1Code, l2Code, l3Code };
}

/**
 * 完整 task cascade 到 L1 → cascadedL1Specs 应含 L1 code(R18 提示用)。
 */
describe('completeTask cascade → cascadedL1Specs', () => {
  it('cascadedL1Specs 正确收集 L1', () => {
    const { l1Code, l3Code } = createFrozenHierarchy('auth');

    const planJson = planFor(l3Code);
    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson,
    });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, planJson, task.id);
    const result = completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });
    expect(result.cascadedL1Specs).toEqual([l1Code]);
    expect(result.cascadedSpecs.map(c => c.level)).toEqual(['L3', 'L2', 'L1']);
  });

  it('多个 L3 共享 L1 时,部分 L3 完成的 L1 不进 cascadedL1Specs', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    updateSpec(paths, l1Code, { status: 'confirmed' });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    updateSpec(paths, l2Code, { status: 'confirmed' });
    const l3a = generateSpecCode('auth', 'L3', l2Code, 0);
    createSpec({ paths, code: l3a, level: 'L3', title: 'L3a', topic: 'auth', parentCode: l2Code });
    const l3b = generateSpecCode('auth', 'L3', l2Code, 1);
    createSpec({ paths, code: l3b, level: 'L3', title: 'L3b', topic: 'auth', parentCode: l2Code });

    updateSpec(paths, l3a, { status: 'frozen' });
    updateSpec(paths, l3b, { status: 'frozen' });

    const planJson = planFor(l3a);
    const { task: taskA } = createTask({
      paths,
      specCode: l3a,
      autoConfirm: false,
      planJson,
    });
    startTask(paths, taskA.id);
    markPlanSucceeded(paths, l3a, planJson, taskA.id);
    const result = completeTask({ paths, taskId: taskA.id });
    expect(result.cascadedL1Specs).toEqual([]);
    expect(result.skippedSpecs.some(s => s.code === l2Code)).toBe(true);
    expect(result.skippedSpecs.some(s => s.code === l1Code)).toBe(false);
  });
});

describe('audit hit R18 联动 (P0 闭环)', () => {
  it('confirmed L1 预建决策后普通 completeTask 成功级联', () => {
    const { l1Code, l2Code, l3Code } = createFrozenHierarchy('r18-success');
    createDecision({ paths, docCode: l1Code, topic: 'r18-success', what: '预建关键决策' });

    const planJson = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, planJson, task.id);

    const result = completeTask({ paths, taskId: task.id });

    expect(result.cascadedL1Specs).toEqual([l1Code]);
    expect(findTask(paths, l3Code, task.id)?.status).toBe('completed');
    expect(findSpecByCode(paths, l3Code)?.fm.status).toBe('implemented');
    expect(findSpecByCode(paths, l2Code)?.fm.status).toBe('implemented');
    expect(findSpecByCode(paths, l1Code)?.fm.status).toBe('implemented');
    expect(readAudit(paths).rules.R18).toBe(1);
  });

  it('缺少决策卡片时普通 completeTask 拒绝并回滚级联', () => {
    const { l1Code, l2Code, l3Code } = createFrozenHierarchy('r18-rollback');
    const planJson = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, planJson, task.id);

    expect(() => completeTask({ paths, taskId: task.id })).toThrow(
      new RegExp(`spec-manager decision create ${l1Code} --topic <topic>`),
    );

    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
    expect(findSpecByCode(paths, l3Code)?.fm.status).toBe('frozen');
    expect(findSpecByCode(paths, l2Code)?.fm.status).toBe('confirmed');
    expect(findSpecByCode(paths, l1Code)?.fm.status).toBe('confirmed');
  });

  it('只有 partial 决策卡片时普通 completeTask 拒绝并回滚级联', () => {
    const { l1Code, l3Code } = createFrozenHierarchy('r18-partial');
    const decision = createDecision({ paths, docCode: l1Code, topic: 'r18-partial', what: '已局部失效的决策' });
    setDecisionPartial({ paths, id: decision.id, reason: '不再代表当前方案' });
    const planJson = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, planJson, task.id);

    expect(() => completeTask({ paths, taskId: task.id })).toThrow(/active 决策卡片/);
    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
  });

  it('task complete 后手动 audit hit R18 落库', () => {
    const { l1Code, l3Code } = createFrozenHierarchy('auth');

    const planJson = planFor(l3Code);
    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson,
    });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, planJson, task.id);
    completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });

    auditHit({ paths, ruleId: 'R18', specCode: l1Code });
    const audit = readAudit(paths);
    // bypass 事件保留，但只有手动成功 hit 增加 R18 合规计数
    expect(audit.rules.R18).toBe(1);
    expect(audit.pending.some(p => p.ruleId === 'R18' && p.specCode === l1Code)).toBe(true);
    expect(audit.pending.some(p => p.metadata?.event === 'task-complete-bypass' && p.metadata?.reason === 'test fixture')).toBe(true);
  });
});

describe('R5 跳步检测 (P1 修复)', () => {
  it('有 pending 步骤时 completeTask 拒绝', () => {
    const { l3Code } = createFrozenHierarchy('auth');

    const planJson = planFor(l3Code, [
      { stepNo: 1, stepType: 'tool_action' as const, name: 'inspect source files' },
      { stepNo: 2, stepType: 'tool_action' as const, name: 'run verify test' },
    ]);
    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson,
    });
    startTask(paths, task.id);
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"a"}' });
    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/R5.*1 个步骤未成功/);
  });

  it('skipped 步视为跳步,completeTask 拒绝', () => {
    const { l3Code } = createFrozenHierarchy('auth');

    const planJson = planFor(l3Code, [
      { stepNo: 1, stepType: 'tool_action' as const, name: 'inspect source files' },
      { stepNo: 2, stepType: 'tool_action' as const, name: 'run verify test' },
    ]);
    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson,
    });
    startTask(paths, task.id);
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"a"}' });
    reportStep({ paths, taskId: task.id, stepNo: 2, status: 'skipped' });
    expect(() => completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' })).toThrow(/R5/);
  });
});

describe('R15 step outputJson warning', () => {
  it('succeeded step 缺 outputJson 时返回 warning', () => {
    const { l3Code } = createFrozenHierarchy('auth');

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
    });
    startTask(paths, task.id);
    const result = reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded' });
    expect(result.warnings.some(w => w.includes('R15'))).toBe(true);
  });

  it('outputJson 缺 summary 时返回 warning', () => {
    const { l3Code } = createFrozenHierarchy('billing');

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
    });
    startTask(paths, task.id);
    const result = reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded', outputJson: '{"ok":true}' });
    expect(result.warnings.some(w => w.includes('summary'))).toBe(true);
  });

  it('step report 写 task JSON,不改写 spec frontmatter 计划快照', () => {
    const { l3Code } = createFrozenHierarchy('report-state');
    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
    });
    startTask(paths, task.id, l3Code);
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"ok"}' });

    const updatedTask = findTask(paths, l3Code, task.id);
    const spec = findSpecByCode(paths, l3Code);
    expect(updatedTask?.steps?.[0].status).toBe('succeeded');
    expect(spec?.fm.steps?.[0].status).toBe('pending');
  });
});

describe('R3 / R7 audit hit (P1 修复)', () => {
  it('非 frozen L3 建 task 触发 R3 audit hit', () => {
    const { l3Code } = createDraftL3Hierarchy('auth');
    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
    })).toThrow(/R3/);
    const audit = readAudit(paths);
    expect(audit.rules.R3).toBe(1);
    expect(audit.pending.some(p => p.ruleId === 'R3' && p.specCode === l3Code)).toBe(true);
  });

  it('L2 无 parent 触发 R7 audit hit', () => {
    const code = generateSpecCode('auth', 'L2');
    expect(() => createSpec({
      paths, code, level: 'L2', title: 'bad', topic: 'auth', parentCode: null,
    })).toThrow(/R7/);
    const audit = readAudit(paths);
    expect(audit.rules.R7).toBe(1);
  });

  it('L3 parent 是 L1 触发 R7 audit hit', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const code = generateSpecCode('auth', 'L3', l1Code);
    expect(() => createSpec({
      paths, code, level: 'L3', title: 'bad', topic: 'auth', parentCode: l1Code,
    })).toThrow(/R7.*L3.*L2/);
    const audit = readAudit(paths);
    expect(audit.rules.R7).toBe(1);
  });
});

describe('R10 / R12 planJson 门禁', () => {
  it('末步不是验证步骤时 createTask 拒绝并记录 R10', () => {
    const { l3Code } = createFrozenHierarchy('auth');
    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [l3Code],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'edit source files' }],
      },
    })).toThrow(/R10/);
    const audit = readAudit(paths);
    expect(audit.rules.R10).toBe(1);
  });

  it('coveredSpecs 缺当前 L3 时 createTask 拒绝并记录 R12', () => {
    const { l3Code } = createFrozenHierarchy('auth');
    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['other-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
      },
    })).toThrow(new RegExp(`R12[\\s\\S]*coveredSpecs[\\s\\S]*${l3Code}[\\s\\S]*Example`));
    const audit = readAudit(paths);
    expect(audit.rules.R12).toBe(1);
  });

  it('coveredSpecs 缺失时 createTask 错误包含可复制 JSON 示例', () => {
    const { l3Code } = createFrozenHierarchy('missing-covered');
    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: {
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
      },
    })).toThrow(new RegExp(`"coveredSpecs": \\["${l3Code}"\\]`));
  });

  it('超过 20 步时 createTask 拒绝并记录 R11', () => {
    const { l3Code } = createFrozenHierarchy('auth');
    const steps = Array.from({ length: 21 }, (_, i) => ({
      stepNo: i + 1,
      stepType: 'tool_action' as const,
      name: i === 20 ? 'run verify test' : `inspect file ${i + 1}`,
    }));
    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: { coveredSpecs: [l3Code], steps },
    })).toThrow(/R11/);
    const audit = readAudit(paths);
    expect(audit.rules.R11).toBe(1);
  });
});

describe('adaptive workflow profile task creation', () => {
  function enableWorkflow(defaultProfile: 'standard' | 'governed'): void {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile });
  }

  function setL3Content(specCode: string, critical = true): void {
    updateSpec(paths, specCode, {
      content: `# Impl

## 目标
\`src/core/task.ts\`

## 实施步骤
steps

## 验收标准
1. **AC-1**: Given task creation, When profile is resolved, Then task SHALL store profile.
2. **AC-2**: Given governed task, When key AC is missing, Then task SHALL be blocked.

${critical ? `## 关键验收标准
- AC-1
` : ''}
## 验证命令
\`\`\`bash
npm test
\`\`\`
`,
      aiSummary: 'adaptive profile fixture',
      changeSummary: 'test fixture content',
    });
  }

  it('creates legacy task when adaptive workflow is disabled', () => {
    const { l3Code } = createFrozenHierarchy('adaptive-legacy');

    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) });

    expect(task.profile).toBe('legacy');
    expect(task.profileSource).toBe('legacy');
    expect(task.profileOverrideReason).toBeNull();
  });

  it('uses project default profile when adaptive workflow is enabled', () => {
    const { l3Code } = createFrozenHierarchy('adaptive-standard');
    setL3Content(l3Code);
    enableWorkflow('standard');

    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) });

    expect(task.profile).toBe('standard');
    expect(task.profileSource).toBe('project-default');
  });

  it('requires reason when explicit profile overrides project default', () => {
    const { l3Code } = createFrozenHierarchy('adaptive-override');
    setL3Content(l3Code);
    enableWorkflow('standard');

    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
      profile: 'governed',
    })).toThrow(/PROFILE_OVERRIDE_REASON_REQUIRED/);

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
      profile: 'governed',
      profileOverrideReason: 'high risk',
    });
    expect(task.profile).toBe('governed');
    expect(task.profileSource).toBe('explicit');
    expect(task.profileOverrideReason).toBe('high risk');
  });

  it('rejects explicit profile when adaptive workflow is disabled', () => {
    const { l3Code } = createFrozenHierarchy('adaptive-disabled');

    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
      profile: 'standard',
    })).toThrow(/ADAPTIVE_WORKFLOW_DISABLED/);
  });

  it('blocks governed task creation without valid critical AC', () => {
    const { l3Code } = createFrozenHierarchy('adaptive-governed');
    setL3Content(l3Code, false);
    enableWorkflow('governed');

    expect(() => createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) }))
      .toThrow(/GOVERNED_CRITICAL_AC_REQUIRED/);
  });

  it('blocks governed task creation with unknown critical AC reference', () => {
    const { l3Code } = createFrozenHierarchy('adaptive-unknown');
    updateSpec(paths, l3Code, {
      content: `# Impl

## 目标
\`src/core/task.ts\`

## 实施步骤
steps

## 验收标准
1. **AC-1**: Given task creation, When profile is resolved, Then task SHALL store profile.

## 关键验收标准
- AC-2

## 验证命令
\`\`\`bash
npm test
\`\`\`
`,
      aiSummary: 'adaptive profile fixture',
    });
    enableWorkflow('governed');

    expect(() => createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) }))
      .toThrow(/UNKNOWN_CRITICAL_AC.*AC-2/);
  });
});

describe('T-001 跨 spec 冲突修复 (specCode scoped lookup)', () => {
  /**
   * 两个不同 L3 spec 各建一个 T-001，验证:
   * - findTask(paths, specCode, 'T-001') 能区分
   * - startTask(paths, 'T-001', specCode) 能区分
   * - completeTask({ paths, taskId: 'T-001', specCode }) 能区分
   */
  function setupTwoL3sWithT001() {
    const { l3Code: l3a } = createFrozenHierarchy('auth');
    const { l3Code: l3b } = createFrozenHierarchy('billing');

    const { task: taskA } = createTask({
      paths, specCode: l3a, autoConfirm: false,
      planJson: planFor(l3a),
    });
    const { task: taskB } = createTask({
      paths, specCode: l3b, autoConfirm: false,
      planJson: planFor(l3b),
    });

    return { l3a, l3b, taskA, taskB };
  }

  it('两个 L3 各有 T-001，findTask 用 specCode 区分', () => {
    const { l3a, l3b, taskA, taskB } = setupTwoL3sWithT001();
    expect(taskA.id).toBe('T-001');
    expect(taskB.id).toBe('T-001');
    // findTask with specCode returns correct task
    const foundA = findTask(paths, l3a, 'T-001');
    const foundB = findTask(paths, l3b, 'T-001');
    expect(foundA).not.toBeNull();
    expect(foundB).not.toBeNull();
    expect(foundA!.specCode).toBe(l3a);
    expect(foundB!.specCode).toBe(l3b);
  });

  it('startTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    // l3a's T-001 is running, l3b's T-001 is still draft
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('running');
    expect(b!.status).toBe('draft');
  });

  it('completeTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    reportStep({ paths, taskId: 'T-001', specCode: l3a, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"ok"}' });
    addTaskVerification({ paths, taskId: 'T-001', specCode: l3a, command: 'npm test', exitCode: 0, summary: 'passed' });
    completeTask({ paths, taskId: 'T-001', specCode: l3a, skipR18Check: true, bypassReason: 'test fixture' });
    // l3a's T-001 completed, l3b's T-001 still draft
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('completed');
    expect(b!.status).toBe('draft');
  });

  it('listTasks 按 specCode 过滤', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    const authTasks = listTasks(paths, { specCode: l3a });
    const billingTasks = listTasks(paths, { specCode: l3b });
    expect(authTasks).toHaveLength(1);
    expect(billingTasks).toHaveLength(1);
    expect(authTasks[0].specCode).toBe(l3a);
    expect(billingTasks[0].specCode).toBe(l3b);
  });

  it('listTasks 按 topic 过滤', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    const authTasks = listTasks(paths, { topic: 'auth' });
    const billingTasks = listTasks(paths, { topic: 'billing' });
    expect(authTasks).toHaveLength(1);
    expect(billingTasks).toHaveLength(1);
    expect(authTasks[0].specCode).toBe(l3a);
    expect(billingTasks[0].specCode).toBe(l3b);
  });

  it('showTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    const shownA = showTask(paths, 'T-001', { specCode: l3a });
    const shownB = showTask(paths, 'T-001', { specCode: l3b });
    expect(shownA).not.toBeNull();
    expect(shownB).not.toBeNull();
    expect(shownA!.task.specCode).toBe(l3a);
    expect(shownB!.task.specCode).toBe(l3b);
  });

  it('showTask reports shownSteps and totalSteps when truncated', () => {
    const { l3Code } = createFrozenHierarchy('shown-total');
    const planJson = planFor(
      l3Code,
      Array.from({ length: 8 }, (_, i) => ({
        stepNo: i + 1,
        stepType: 'tool_action' as const,
        name: i === 7 ? 'run verify test' : `inspect file ${i + 1}`,
      })),
    );
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });

    const truncated = showTask(paths, task.id, { specCode: l3Code });
    expect(truncated?.shownSteps).toBe(5);
    expect(truncated?.totalSteps).toBe(8);
    expect(truncated?.truncated).toBe(true);

    const full = showTask(paths, task.id, { specCode: l3Code, full: true });
    expect(full?.shownSteps).toBe(8);
    expect(full?.totalSteps).toBe(8);
    expect(full?.truncated).toBe(false);
  });

  it('failTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    failTask({ paths, taskId: 'T-001', specCode: l3a, errorCode: 'TEST', errorMessage: 'test fail' });
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('failed');
    expect(b!.status).toBe('draft');
  });

  it('waitTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    waitTask({ paths, taskId: 'T-001', specCode: l3a, reason: 'waiting for auth' });
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('waiting');
    expect(b!.status).toBe('draft');
  });
});

describe('task verification evidence', () => {
  it('addTaskVerification appends V ids and supports old tasks without verifications', () => {
    const { l3Code } = createFrozenHierarchy('verify-evidence');
    createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
    });
    startTask(paths, 'T-001', l3Code);

    const first = addTaskVerification({
      paths,
      taskId: 'T-001',
      specCode: l3Code,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: [],
      coversAc: ['AC-1'],
    });
    const second = addTaskVerification({
      paths,
      taskId: 'T-001',
      specCode: l3Code,
      command: 'npm run build',
      exitCode: 0,
      summary: 'built',
    });

    expect(first.verification.id).toBe('V-001');
    expect(second.verification.id).toBe('V-002');
    expect(second.task.verifications).toHaveLength(2);
    expect(second.task.verifications?.[0].coversAc).toEqual(['AC-1']);
    expect(second.task.verifications?.[1].artifacts).toEqual([]);
  });
});

describe('task lifecycle hardening', () => {
  it('requires successful verification before completion', () => {
    const { l3Code } = createFrozenHierarchy('verification-required');
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) });
    startTask(paths, task.id, l3Code);
    reportStep({ paths, taskId: task.id, specCode: l3Code, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"ok"}' });
    expect(() => completeTask({ paths, taskId: task.id, specCode: l3Code })).toThrow(/VERIFICATION_REQUIRED/);
  });

  it('keeps completed task history immutable', () => {
    const { l3Code } = createFrozenHierarchy('immutable-task');
    const planJson = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id, l3Code);
    markPlanSucceeded(paths, l3Code, planJson, task.id);
    completeTask({ paths, taskId: task.id, specCode: l3Code, skipR18Check: true, bypassReason: 'test fixture' });
    expect(() => reportStep({ paths, taskId: task.id, specCode: l3Code, stepNo: 1, status: 'failed' })).toThrow(/TASK_IMMUTABLE/);
    expect(() => addTaskVerification({ paths, taskId: task.id, specCode: l3Code, command: 'false', exitCode: 1, summary: 'late' })).toThrow(/TASK_IMMUTABLE/);
  });

  it('rejects a second active task for the same L3', () => {
    const { l3Code } = createFrozenHierarchy('active-task');
    createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) });
    expect(() => createTask({ paths, specCode: l3Code, autoConfirm: false, planJson: planFor(l3Code) })).toThrow(/TASK_ALREADY_ACTIVE/);
  });
});

describe('coveredTasks auto-population', () => {
  it('createTask adds taskId to spec.coveredTasks', () => {
    const { l3Code } = createFrozenHierarchy('covered-tasks');
    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: planFor(l3Code),
    });
    const spec = findSpecByCode(paths, l3Code);
    expect(spec?.fm.coveredTasks).toContain(task.id);
  });

  it('coveredTasks persists after task completion and cascade', () => {
    const { l3Code } = createFrozenHierarchy('covered-persist');
    const planJson = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, planJson, task.id);
    completeTask({ paths, taskId: task.id, skipR18Check: true, bypassReason: 'test fixture' });

    const spec = findSpecByCode(paths, l3Code);
    expect(spec?.fm.coveredTasks).toContain(task.id);
    expect(spec?.fm.status).toBe('implemented');
  });
});
