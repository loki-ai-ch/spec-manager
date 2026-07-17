import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, updateSpec, generateSpecCode } from '../spec-io.js';
import {
  createDecision,
  listDecisions,
  findDecision,
  supersedeDecision,
  updateDecision,
  setDecisionPartial,
  deleteDecision,
} from '../decision.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-decision-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function createL1Implemented(topic = 'auth', title = 'Auth L1'): string {
  const code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code, level: 'L1', title, topic, parentCode: null });
  updateSpec(paths, code, { status: 'frozen' });
  updateSpec(paths, code, { status: 'implemented' });
  return code;
}

function createL1Draft(topic = 'auth', title = 'Auth L1'): string {
  const code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code, level: 'L1', title, topic, parentCode: null });
  return code;
}

function createL1Confirmed(topic = 'auth', title = 'Auth L1'): string {
  const code = createL1Draft(topic, title);
  updateSpec(paths, code, { status: 'confirmed' });
  return code;
}

describe('createDecision — R18 允许 confirmed/implemented L1', () => {
  it('confirmed L1 可预建决策', () => {
    const code = createL1Confirmed();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: '用 JWT' });
    expect(d.fm.status).toBe('active');
    expect(d.fm.docCode).toBe(code);
    expect(existsSync(d.filePath)).toBe(true);
  });

  it('implemented L1 可建决策', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: '用 JWT' });
    expect(d.fm.status).toBe('active');
    expect(d.fm.docCode).toBe(code);
    expect(d.id).toMatch(/^DC-\d{3}$/);
    expect(existsSync(d.filePath)).toBe(true);
  });

  it('draft L1 不可建决策 (R18)', () => {
    const code = createL1Draft();
    expect(() => createDecision({ paths, docCode: code, topic: 'auth', what: 'X' }))
      .toThrow(/R18: L1 必须 confirmed 或 implemented/);
  });

  it('frozen L1 不可建决策 (R18)', () => {
    const code = createL1Draft();
    updateSpec(paths, code, { status: 'frozen' });
    expect(() => createDecision({ paths, docCode: code, topic: 'auth', what: 'X' }))
      .toThrow(/R18: L1 必须 confirmed 或 implemented/);
  });

  it('what 超过 500 字抛错', () => {
    const code = createL1Implemented();
    expect(() => createDecision({ paths, docCode: code, topic: 'auth', what: 'x'.repeat(501) })).toThrow(/what.*501.*500/);
  });

  it('L2 spec 不可建决策', () => {
    const l1Code = createL1Draft();
    updateSpec(paths, l1Code, { status: 'confirmed' });
    const l2Code = generateSpecCode('auth', 'L2');
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    expect(() => createDecision({ paths, docCode: l2Code, topic: 'auth', what: 'X' })).toThrow(/只能关联 L1/);
  });
});

describe('listDecisions — topic / includeAll / docCode / criteria 过滤', () => {
  function setup(): { codeA: string; codeB: string } {
    const codeA = createL1Implemented('auth', 'Auth A');
    const codeB = createL1Implemented('billing', 'Billing B');
    return { codeA, codeB };
  }

  it('无过滤返回所有 active', () => {
    const { codeA, codeB } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'X' });
    createDecision({ paths, docCode: codeB, topic: 'billing', what: 'Y' });
    const all = listDecisions(paths);
    expect(all).toHaveLength(2);
  });

  it('--topic 过滤', () => {
    const { codeA, codeB } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'X' });
    createDecision({ paths, docCode: codeB, topic: 'billing', what: 'Y' });
    expect(listDecisions(paths, { topic: 'auth' })).toHaveLength(1);
    expect(listDecisions(paths, { topic: 'billing' })).toHaveLength(1);
  });

  it('--docCode 过滤(task complete R18 自检用)', () => {
    const { codeA, codeB } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'X' });
    createDecision({ paths, docCode: codeB, topic: 'billing', what: 'Y' });
    const onlyA = listDecisions(paths, { docCode: codeA });
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0].fm.docCode).toBe(codeA);
  });

  it('同 topic 多个 L1 时不重复扫描且 docCode 精确匹配', () => {
    const codeA = createL1Implemented('auth', 'Auth A');
    const codeB = 'auth-v2-L1';
    createSpec({ paths, code: codeB, level: 'L1', title: 'Auth B', topic: 'auth', parentCode: null });
    updateSpec(paths, codeB, { status: 'frozen' });
    updateSpec(paths, codeB, { status: 'implemented' });

    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A decision' });

    const byTopic = listDecisions(paths, { topic: 'auth' });
    expect(byTopic).toHaveLength(1);
    expect(byTopic[0].fm.docCode).toBe(codeA);
    expect(listDecisions(paths, { docCode: codeB })).toHaveLength(0);
  });

  it('默认不含 superseded', () => {
    const { codeA } = setup();
    const a = createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A' });
    const b = createDecision({ paths, docCode: codeA, topic: 'auth', what: 'B' });
    supersedeDecision(paths, a.id, b.id);
    const active = listDecisions(paths);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(b.id);
  });

  it('--include-all 含 superseded/partial', () => {
    const { codeA } = setup();
    const a = createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A' });
    const b = createDecision({ paths, docCode: codeA, topic: 'auth', what: 'B' });
    supersedeDecision(paths, a.id, b.id);
    expect(listDecisions(paths, { includeAll: true })).toHaveLength(2);
  });

  it('--criteria 单 criterion 匹配(AC-7 核心)', () => {
    const { codeA } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A1', affectedCriteria: ['AC-1', 'AC-2'] });
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A2', affectedCriteria: ['AC-3'] });
    const hit = listDecisions(paths, { criteria: 'AC-1' });
    expect(hit).toHaveLength(1);
    expect(hit[0].fm.what).toBe('A1');
  });

  it('--criteria 多 criterion 取并集', () => {
    const { codeA } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A1', affectedCriteria: ['AC-1'] });
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A2', affectedCriteria: ['AC-2'] });
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A3', affectedCriteria: ['AC-3'] });
    const hit = listDecisions(paths, { criteria: ['AC-1', 'AC-2'] });
    expect(hit).toHaveLength(2);
    expect(hit.map(d => d.fm.what).sort()).toEqual(['A1', 'A2']);
  });

  it('--criteria 数组形式也支持', () => {
    const { codeA } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A1', affectedCriteria: ['AC-1'] });
    const hit = listDecisions(paths, { criteria: ['AC-1'] });
    expect(hit).toHaveLength(1);
  });

  it('--criteria 空字符串 / 空数组 = 不过滤', () => {
    const { codeA } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A1' });
    expect(listDecisions(paths, { criteria: '' })).toHaveLength(1);
    expect(listDecisions(paths, { criteria: [] })).toHaveLength(1);
  });

  it('无 affectedCriteria 的决策不匹配任何 criteria 过滤', () => {
    const { codeA } = setup();
    createDecision({ paths, docCode: codeA, topic: 'auth', what: 'A1' });
    expect(listDecisions(paths, { criteria: 'AC-1' })).toHaveLength(0);
  });
});

describe('updateDecision — 编辑 what/why/affectedCriteria', () => {
  it('可改 what/why/affectedCriteria', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'old' });
    const updated = updateDecision({ paths, id: d.id, what: 'new', why: '因为 X', affectedCriteria: ['AC-1'] });
    expect(updated.fm.what).toBe('new');
    expect(updated.fm.why).toBe('因为 X');
    expect(updated.fm.affectedCriteria).toEqual(['AC-1']);
    expect(updated.fm.status).toBe('active');
    // updated ≥ created(同一毫秒内可能相等,只要不更早)
    expect(updated.fm.updated >= d.fm.updated).toBe(true);
  });

  it('不改的字段保留原值', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'old', why: '原 why' });
    const updated = updateDecision({ paths, id: d.id, what: 'new' });
    expect(updated.fm.what).toBe('new');
    expect(updated.fm.why).toBe('原 why');
  });

  it('partial 状态的决策不可编辑', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    setDecisionPartial({ paths, id: d.id, reason: 'test' });
    expect(() => updateDecision({ paths, id: d.id, what: 'Y' })).toThrow(/不能编辑 partial/);
  });

  it('superseded 状态的决策不可编辑', () => {
    const code = createL1Implemented();
    const a = createDecision({ paths, docCode: code, topic: 'auth', what: 'A' });
    const b = createDecision({ paths, docCode: code, topic: 'auth', what: 'B' });
    supersedeDecision(paths, a.id, b.id);
    expect(() => updateDecision({ paths, id: a.id, what: 'X' })).toThrow(/不能编辑 superseded/);
  });

  it('不传任何字段抛错', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    expect(() => updateDecision({ paths, id: d.id })).toThrow(/未提供任何可更新字段/);
  });

  it('what 超过 500 字抛错', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    expect(() => updateDecision({ paths, id: d.id, what: 'x'.repeat(501) })).toThrow(/what.*501/);
  });
});

describe('setDecisionPartial — 标记部分失效', () => {
  it('active → partial,带 reason', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    const updated = setDecisionPartial({ paths, id: d.id, reason: 'INC-001:AC-3 假设不成立' });
    expect(updated.fm.status).toBe('partial');
    expect(updated.fm.supersededById).toBeNull();
    expect(updated.content).toContain('Partial 标记');
    expect(updated.content).toContain('INC-001');
  });

  it('缺 reason 抛错', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    expect(() => setDecisionPartial({ paths, id: d.id, reason: '' })).toThrow(/必须提供 reason/);
    expect(() => setDecisionPartial({ paths, id: d.id, reason: '   ' })).toThrow(/必须提供 reason/);
  });

  it('重复标 partial 抛错', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    setDecisionPartial({ paths, id: d.id, reason: 'first' });
    expect(() => setDecisionPartial({ paths, id: d.id, reason: 'second' })).toThrow(/已经是 partial/);
  });

  it('partial 状态默认被 listDecisions 排除(includeAll 可见)', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    setDecisionPartial({ paths, id: d.id, reason: 'test' });
    expect(listDecisions(paths)).toHaveLength(0);
    expect(listDecisions(paths, { includeAll: true })).toHaveLength(1);
  });
});

describe('supersedeDecision — 完整生命周期', () => {
  it('active → superseded,supersededById 指向新决策', () => {
    const code = createL1Implemented();
    const a = createDecision({ paths, docCode: code, topic: 'auth', what: 'A' });
    const b = createDecision({ paths, docCode: code, topic: 'auth', what: 'B' });
    supersedeDecision(paths, a.id, b.id);
    const after = findDecision(paths, a.id);
    expect(after!.fm.status).toBe('superseded');
    expect(after!.fm.supersededById).toBe(b.id);
  });

  it('旧决策历史可通过 --criteria 仍能查到', () => {
    const code = createL1Implemented();
    const a = createDecision({ paths, docCode: code, topic: 'auth', what: 'A', affectedCriteria: ['AC-1'] });
    const b = createDecision({ paths, docCode: code, topic: 'auth', what: 'B', affectedCriteria: ['AC-1'] });
    supersedeDecision(paths, a.id, b.id);
    // active 视角只看 b;includeAll 视角 a+b 都能查
    const active = listDecisions(paths, { criteria: 'AC-1' });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(b.id);
    const all = listDecisions(paths, { criteria: 'AC-1', includeAll: true });
    expect(all.map(d => d.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('deleteDecision — 物理删除', () => {
  it('active 决策可删', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    deleteDecision(paths, d.id);
    expect(existsSync(d.filePath)).toBe(false);
    expect(findDecision(paths, d.id)).toBeNull();
  });

  it('superseded 决策不能直接删除(P0 契约)', () => {
    const code = createL1Implemented();
    const a = createDecision({ paths, docCode: code, topic: 'auth', what: 'A' });
    const b = createDecision({ paths, docCode: code, topic: 'auth', what: 'B' });
    supersedeDecision(paths, a.id, b.id);
    expect(() => deleteDecision(paths, a.id)).toThrow(/superseded.*不能直接删除/);
    expect(existsSync(a.filePath)).toBe(true);
  });

  it('partial 决策不能直接删除(P0 契约)', () => {
    const code = createL1Implemented();
    const d = createDecision({ paths, docCode: code, topic: 'auth', what: 'X' });
    setDecisionPartial({ paths, id: d.id, reason: 'test' });
    expect(() => deleteDecision(paths, d.id)).toThrow(/partial.*不能直接删除/);
    expect(existsSync(d.filePath)).toBe(true);
  });
});
