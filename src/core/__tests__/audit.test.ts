import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { hit, readAudit, startSession, report, showSummary, RULE_ID_RE, ALL_RULE_IDS } from '../audit.js';

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
});
