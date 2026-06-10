import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { getPaths, type ProjectPaths } from '../paths.js';
import { hit, readAudit, startSession, report, showSummary, RULE_ID_RE, ALL_RULE_IDS, checkCompliance, COMPLIANCE_BASELINE } from '../audit.js';
import { registerAuditCommands } from '../../cli/audit.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { addTaskVerification, completeTask, createTask, reportStep, startTask } from '../task.js';
import { createTaskLinkedChangeProposal, resolveTaskLinkedChangeProposal } from '../delta.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-audit-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('RULE_ID_RE / ALL_RULE_IDS', () => {
  it('R1-R24 都匹配正则', () => {
    for (let i = 1; i <= 24; i++) {
      expect(RULE_ID_RE.test(`R${i}`)).toBe(true);
    }
  });

  it('R0, R25, R99 不匹配', () => {
    expect(RULE_ID_RE.test('R0')).toBe(false);
    expect(RULE_ID_RE.test('R25')).toBe(false);
    expect(RULE_ID_RE.test('R99')).toBe(false);
  });

  it('ALL_RULE_IDS 有 24 个', () => {
    expect(ALL_RULE_IDS).toHaveLength(24);
    expect(ALL_RULE_IDS[0]).toBe('R1');
    expect(ALL_RULE_IDS[23]).toBe('R24');
  });
});

describe('readAudit — 读取审计状态', () => {
  it('无文件时返回空状态', () => {
    const state = readAudit(paths);
    expect(state.rules.R1).toBe(0);
    expect(state.pending).toEqual([]);
    expect(state.sessionId).toBe('');
  });

  it('rules 缺失时自动补全 24 条', () => {
    // 写一个缺 rules 的文件
    const { writeFileSync } = require('node:fs');
    writeFileSync(paths.auditFile, JSON.stringify({ sessionId: 'test', pending: [] }), 'utf8');
    const state = readAudit(paths);
    expect(state.rules.R1).toBe(0);
    expect(state.rules.R24).toBe(0);
    expect(Object.keys(state.rules)).toHaveLength(24);
  });
});

describe('hit — 记录规则命中', () => {
  it('hit 后 rules 计数 +1', () => {
    hit({ paths, ruleId: 'R3', specCode: 'auth-L3' });
    const state = readAudit(paths);
    expect(state.rules.R3).toBe(1);
  });

  it('多次 hit 同一规则累加', () => {
    hit({ paths, ruleId: 'R7' });
    hit({ paths, ruleId: 'R7' });
    hit({ paths, ruleId: 'R7' });
    const state = readAudit(paths);
    expect(state.rules.R7).toBe(3);
  });

  it('pending 队列追加条目', () => {
    hit({ paths, ruleId: 'R18', specCode: 'auth-L1' });
    const state = readAudit(paths);
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].ruleId).toBe('R18');
    expect(state.pending[0].specCode).toBe('auth-L1');
    expect(state.pending[0].reported).toBe(false);
  });

  it('非法 ruleId 抛错', () => {
    expect(() => hit({ paths, ruleId: 'R0' })).toThrow(/格式非法/);
    expect(() => hit({ paths, ruleId: 'R25' })).toThrow(/格式非法/);
    expect(() => hit({ paths, ruleId: 'xxx' })).toThrow(/格式非法/);
  });

  it('lastUpdated 被更新', () => {
    hit({ paths, ruleId: 'R1' });
    const state = readAudit(paths);
    expect(state.lastUpdated).toBeTruthy();
  });

  it('auto-initializes session when sessionId is empty', () => {
    const before = readAudit(paths);
    expect(before.sessionId).toBe('');

    hit({ paths, ruleId: 'R1' });

    const after = readAudit(paths);
    expect(after.sessionId).toMatch(/^sess-[a-z0-9]+$/);
    expect(after.rules.R1).toBe(1);
  });

  it('does not reset counters when auto-initializing session', () => {
    hit({ paths, ruleId: 'R3' });
    hit({ paths, ruleId: 'R7' });

    const after = readAudit(paths);
    expect(after.sessionId).toBeTruthy();
    expect(after.rules.R3).toBe(1);
    expect(after.rules.R7).toBe(1);
  });
});

describe('startSession — 初始化审计会话', () => {
  it('写入 sessionId 和 topic', () => {
    startSession(paths, { sessionId: 'sess-001', topic: 'auth' });
    const state = readAudit(paths);
    expect(state.sessionId).toBe('sess-001');
    expect(state.topic).toBe('auth');
    expect(state.startedAt).toBeTruthy();
  });

  it('rules 全部归零', () => {
    hit({ paths, ruleId: 'R3' });
    startSession(paths, { sessionId: 'reset' });
    const state = readAudit(paths);
    expect(state.rules.R3).toBe(0);
  });
});

describe('audit CLI session', () => {
  async function runAuditCli(args: string[]): Promise<void> {
    const oldRoot = process.env.SPEC_MANAGER_ROOT;
    process.env.SPEC_MANAGER_ROOT = root;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const program = new Command();
      program.exitOverride();
      registerAuditCommands(program);
      await program.parseAsync(['node', 'test', ...args], { from: 'node' });
    } finally {
      logSpy.mockRestore();
      if (oldRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
      else process.env.SPEC_MANAGER_ROOT = oldRoot;
    }
  }

  it('不传 --session-id 时自动生成 sessionId', async () => {
    await runAuditCli(['audit', 'session']);
    expect(readAudit(paths).sessionId).toMatch(/^sess-[0-9a-f]{8}$/);
  });

  it('传 --session-id 时保留用户指定值', async () => {
    await runAuditCli(['audit', 'session', '--session-id', 'manual']);
    expect(readAudit(paths).sessionId).toBe('manual');
  });
});

describe('report — 标记已审计', () => {
  it('标记 pending 为 reported', () => {
    hit({ paths, ruleId: 'R3' });
    hit({ paths, ruleId: 'R7' });
    const result = report(paths);
    expect(result.markedReported).toBe(2);
    expect(result.remaining).toBe(0);
    const state = readAudit(paths);
    expect(state.pending).toEqual([]);
  });

  it('无 pending 时 report 返回 0', () => {
    const result = report(paths);
    expect(result.markedReported).toBe(0);
  });

  it('archive 文件被创建', () => {
    hit({ paths, ruleId: 'R3' });
    report(paths);
    const archivePath = join(root, '.spec-manager', 'audit-archive.json');
    expect(existsSync(archivePath)).toBe(true);
    const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
    expect(archive).toHaveLength(1);
    expect(archive[0].ruleId).toBe('R3');
  });
});

describe('showSummary — 文本摘要', () => {
  it('返回包含 rule hit counts 的文本', () => {
    hit({ paths, ruleId: 'R3' });
    hit({ paths, ruleId: 'R7' });
    const summary = showSummary(paths);
    expect(summary).toContain('R3: 1');
    expect(summary).toContain('R7: 1');
    expect(summary).toContain('R1: 0');
    expect(summary).toContain('pending:');
  });

  it('按 ruleId 过滤', () => {
    hit({ paths, ruleId: 'R3' });
    hit({ paths, ruleId: 'R7' });
    const summary = showSummary(paths, { ruleId: 'R3' });
    expect(summary).toContain('R3: 1');
    expect(summary).not.toContain('R7');
  });

  it('包含合规基线检查结果', () => {
    hit({ paths, ruleId: 'R1' });
    hit({ paths, ruleId: 'R4' });
    hit({ paths, ruleId: 'R13' });
    hit({ paths, ruleId: 'R18' });
    hit({ paths, ruleId: 'R22' });
    const summary = showSummary(paths);
    expect(summary).toContain('compliance: ✓ PASS');
  });

  it('合规基线未满足时显示 FAIL', () => {
    hit({ paths, ruleId: 'R1' });
    const summary = showSummary(paths);
    expect(summary).toContain('compliance: ✗ FAIL');
    expect(summary).toContain('✗ R4: 0 (min 1)');
  });

  it('completed task without verification emits warning', () => {
    const specCode = createCompletedTask('audit-no-verify', true);

    const summary = showSummary(paths);

    expect(summary).toContain('warnings:');
    expect(summary).toContain(`completed task T-001 (${specCode}) has no verification evidence`);
    expect(summary).toContain('completed task history is immutable');
  });

  it('completed task with verification does not emit missing verification warning', () => {
    const specCode = createCompletedTask('audit-with-verify');

    const summary = showSummary(paths);

    expect(summary).not.toContain(`completed task T-001 (${specCode}) has no verification evidence`);
  });

  it('unresolved task-linked change proposal emits warning', () => {
    const specCode = createCompletedTask('audit-change-open');
    createTaskLinkedChangeProposal({
      paths,
      taskCode: 'T-001',
      specCode,
      reason: 'implementation drift',
      impact: 'L3 AC',
    });

    const summary = showSummary(paths);

    expect(summary).toContain('unresolved change proposal audit-change-open-l3-1-1-work-t-001-proposal');
    expect(summary).toContain('spec-manager change resolve audit-change-open-l3-1-1-work-t-001-proposal');
  });

  it('resolved task-linked change proposal does not emit warning', () => {
    const specCode = createCompletedTask('audit-change-resolved');
    const proposal = createTaskLinkedChangeProposal({
      paths,
      taskCode: 'T-001',
      specCode,
      reason: 'implementation drift',
      impact: 'L3 AC',
    });
    resolveTaskLinkedChangeProposal(paths, proposal.name);

    const summary = showSummary(paths);

    expect(summary).not.toContain(`unresolved change proposal ${proposal.name}`);
  });
});

describe('checkCompliance — 合规基线检查', () => {
  it('COMPLIANCE_BASELINE 包含 R1/R4/R13/R18/R22', () => {
    expect(COMPLIANCE_BASELINE).toEqual(['R1', 'R4', 'R13', 'R18', 'R22']);
  });

  it('全部满足时 pass=true', () => {
    const state = readAudit(paths);
    state.rules.R1 = 1;
    state.rules.R4 = 1;
    state.rules.R13 = 1;
    state.rules.R18 = 1;
    state.rules.R22 = 1;
    const result = checkCompliance(state);
    expect(result.pass).toBe(true);
    expect(result.details.every(d => d.pass)).toBe(true);
  });

  it('任一未满足时 pass=false', () => {
    const state = readAudit(paths);
    state.rules.R1 = 1;
    state.rules.R4 = 0;
    state.rules.R13 = 1;
    state.rules.R18 = 1;
    state.rules.R22 = 1;
    const result = checkCompliance(state);
    expect(result.pass).toBe(false);
    expect(result.details.find(d => d.ruleId === 'R4')!.pass).toBe(false);
  });

  it('计数大于1也算通过', () => {
    const state = readAudit(paths);
    state.rules.R1 = 5;
    state.rules.R4 = 3;
    state.rules.R13 = 2;
    state.rules.R18 = 1;
    state.rules.R22 = 10;
    const result = checkCompliance(state);
    expect(result.pass).toBe(true);
  });
});

function createCompletedTask(topic: string, removeVerification = false): string {
  const l1Code = `${topic}-L1`;
  createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic, parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = `${topic}-L2.1`;
  createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic, parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = `${topic}-L3.1.1-work`;
  createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic, parentCode: l2Code });
  updateSpec(paths, l3Code, { status: 'frozen' });
  createTask({
    paths,
    specCode: l3Code,
    autoConfirm: false,
    planJson: {
      coveredSpecs: [l3Code],
      steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'run verify test' }],
    },
  });
  startTask(paths, 'T-001', l3Code);
  reportStep({ paths, taskId: 'T-001', specCode: l3Code, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"ok"}' });
  addTaskVerification({ paths, taskId: 'T-001', specCode: l3Code, command: 'npm test', exitCode: 0, summary: 'passed' });
  completeTask({ paths, taskId: 'T-001', specCode: l3Code, skipR18Check: true });
  if (removeVerification) {
    const taskFile = join(paths.specsDir, topic, 'tasks', `${l3Code}-T-001.json`);
    const legacy = JSON.parse(readFileSync(taskFile, 'utf8'));
    delete legacy.verifications;
    writeFileSync(taskFile, JSON.stringify(legacy, null, 2), 'utf8');
  }
  return l3Code;
}
