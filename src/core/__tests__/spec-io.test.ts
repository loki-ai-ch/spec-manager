import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import {
  createSpec,
  readSpec,
  updateSpec,
  findSpecByCode,
  listAllSpecs,
  generateSpecCode,
  invalidateSpecCache,
  writeSpec,
  type SpecRecord,
} from '../spec-io.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-spec-io-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
  invalidateSpecCache();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('generateSpecCode — 编码生成', () => {
  it('L1 编码 = topic-L1', () => {
    expect(generateSpecCode('auth', 'L1')).toBe('auth-L1');
  });

  it('L2 编码 = topic-L2', () => {
    expect(generateSpecCode('billing', 'L2')).toBe('billing-L2');
  });

  it('L3 编码 = topic-L3', () => {
    expect(generateSpecCode('payment', 'L3')).toBe('payment-L3');
  });

  it('L0 编码 = topic-L0', () => {
    expect(generateSpecCode('vision', 'L0')).toBe('vision-L0');
  });

  it('L2 带 parentCode = topic-L2.N', () => {
    expect(generateSpecCode('auth', 'L2', 'auth-L1')).toBe('auth-L2.1');
    expect(generateSpecCode('auth', 'L2', 'auth-L1', 1)).toBe('auth-L2.2');
  });

  it('L3 带 parentCode = topic-L3.N.M', () => {
    expect(generateSpecCode('auth', 'L3', 'auth-L2.1')).toBe('auth-L3.1.1');
    expect(generateSpecCode('auth', 'L3', 'auth-L2.1', 2)).toBe('auth-L3.1.3');
  });
});

describe('createSpec — 创建 spec', () => {
  it('创建 L1 spec', () => {
    const rec = createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    expect(rec.fm.code).toBe('auth-L1');
    expect(rec.fm.level).toBe('L1');
    expect(rec.fm.status).toBe('draft');
    expect(rec.fm.topic).toBe('auth');
    expect(rec.fm.parentCode).toBeNull();
    expect(existsSync(rec.filePath)).toBe(true);
  });

  it('创建 L2 spec (parent = L1)', () => {
    const l1 = createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const l2 = createSpec({ paths, code: 'auth-L2', level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: 'auth-L1' });
    expect(l2.fm.parentCode).toBe('auth-L1');
    expect(l2.filePath).toContain('auth-L2');
  });

  it('创建 L3 spec (parent = L2)', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createSpec({ paths, code: 'auth-L2', level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: 'auth-L1' });
    const l3 = createSpec({ paths, code: 'auth-L3', level: 'L3', title: 'Auth Impl', topic: 'auth', parentCode: 'auth-L2' });
    expect(l3.fm.parentCode).toBe('auth-L2');
    expect(l3.fm.steps).toBeUndefined();
  });

  it('L2 无 parent 抛 R7 错误', () => {
    expect(() => createSpec({
      paths, code: 'bad-L2', level: 'L2', title: 'Bad', topic: 'auth', parentCode: null,
    })).toThrow(/R7/);
  });

  it('L3 无 parent 抛 R7 错误', () => {
    expect(() => createSpec({
      paths, code: 'bad-L3', level: 'L3', title: 'Bad', topic: 'auth', parentCode: null,
    })).toThrow(/R7/);
  });

  it('L3 parent 是 L1 抛 R7 错误', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    expect(() => createSpec({
      paths, code: 'auth-L3', level: 'L3', title: 'Bad', topic: 'auth', parentCode: 'auth-L1',
    })).toThrow(/R7.*L3.*L2/);
  });

  it('parentCode 指向不存在的 spec 抛错', () => {
    expect(() => createSpec({
      paths, code: 'auth-L2', level: 'L2', title: 'Bad', topic: 'auth', parentCode: 'nonexistent',
    })).toThrow(/不存在/);
  });

  it('L1 spec 文件名含日期后缀', () => {
    const rec = createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    expect(rec.filePath).toMatch(/auth-L1-\d{8}\.md$/);
  });
});

describe('readSpec — 读取 spec', () => {
  it('读取已创建的 spec', () => {
    const created = createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const read = readSpec(created.filePath);
    expect(read).not.toBeNull();
    expect(read!.fm.code).toBe('auth-L1');
    expect(read!.fm.title).toBe('Auth');
  });

  it('读取不存在的文件返回 null', () => {
    expect(readSpec(join(root, 'nonexistent.md'))).toBeNull();
  });
});

describe('updateSpec — 更新 spec', () => {
  it('更新 content', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const { record } = updateSpec(paths, 'auth-L1', { content: '# New Content\n' });
    expect(record.content).toBe('# New Content\n');
  });

  it('更新 aiSummary', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const { record } = updateSpec(paths, 'auth-L1', { aiSummary: 'short summary' });
    expect(record.fm.aiSummary).toBe('short summary');
  });

  it('aiSummary 超 300 字符自动截断', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const long = 'x'.repeat(301);
    const { record, warnings } = updateSpec(paths, 'auth-L1', { aiSummary: long });
    expect(record.fm.aiSummary).toHaveLength(300);
    expect(warnings.some(w => w.includes('截断'))).toBe(true);
  });

  it('更新 status', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const { record } = updateSpec(paths, 'auth-L1', { status: 'confirmed' });
    expect(record.fm.status).toBe('confirmed');
  });

  it('追加 step', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createSpec({ paths, code: 'auth-L2', level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: 'auth-L1' });
    createSpec({ paths, code: 'auth-L3', level: 'L3', title: 'Auth Impl', topic: 'auth', parentCode: 'auth-L2' });
    const step = { stepNo: 1, stepType: 'mcp_tool' as const, name: 'read file', status: 'succeeded' as const };
    const { record } = updateSpec(paths, 'auth-L3', { appendStep: step });
    expect(record.fm.steps).toHaveLength(1);
    expect(record.fm.steps![0].stepNo).toBe(1);
  });

  it('替换 step', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createSpec({ paths, code: 'auth-L2', level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: 'auth-L1' });
    createSpec({ paths, code: 'auth-L3', level: 'L3', title: 'Auth Impl', topic: 'auth', parentCode: 'auth-L2' });
    updateSpec(paths, 'auth-L3', {
      appendStep: { stepNo: 1, stepType: 'mcp_tool', name: 'old', status: 'pending' },
    });
    const { record } = updateSpec(paths, 'auth-L3', {
      replaceStep: { no: 1, step: { stepNo: 1, stepType: 'llm_call', name: 'new', status: 'succeeded' } },
    });
    expect(record.fm.steps).toHaveLength(1);
    expect(record.fm.steps![0].name).toBe('new');
  });

  it('添加 relation', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const { record } = updateSpec(paths, 'auth-L1', {
      addRelation: { type: 'references', target: 'billing-L1' },
    });
    expect(record.fm.relations).toHaveLength(1);
    expect(record.fm.relations![0].target).toBe('billing-L1');
  });

  it('更新不存在的 spec 抛错', () => {
    expect(() => updateSpec(paths, 'nonexistent', { content: 'x' })).toThrow(/not found/i);
  });

  it('更新后 updated 时间戳变新', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const before = findSpecByCode(paths, 'auth-L1')!.fm.updated;
    const { record } = updateSpec(paths, 'auth-L1', { content: 'new' });
    expect(record.fm.updated >= before).toBe(true);
  });
});

describe('findSpecByCode — 按 code 查找', () => {
  it('找到已创建的 spec', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const found = findSpecByCode(paths, 'auth-L1');
    expect(found).not.toBeNull();
    expect(found!.fm.code).toBe('auth-L1');
  });

  it('找不到返回 null', () => {
    expect(findSpecByCode(paths, 'nonexistent')).toBeNull();
  });

  it('多个同 topic 不同 level 的 spec 都能找到', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createSpec({ paths, code: 'auth-L2', level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: 'auth-L1' });
    expect(findSpecByCode(paths, 'auth-L1')).not.toBeNull();
    expect(findSpecByCode(paths, 'auth-L2')).not.toBeNull();
  });
});

describe('listAllSpecs — 列出所有 spec (带缓存)', () => {
  it('空项目返回空', () => {
    expect(listAllSpecs(paths)).toEqual([]);
  });

  it('列出所有已创建的 spec', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createSpec({ paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    const all = listAllSpecs(paths);
    expect(all).toHaveLength(2);
    expect(all.map(s => s.fm.code).sort()).toEqual(['auth-L1', 'billing-L1']);
  });

  it('写入后 invalidateSpecCache 能看到新数据', () => {
    const rec = createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    // 第一次 list 填缓存
    expect(listAllSpecs(paths)).toHaveLength(1);
    // 直接修改文件
    updateSpec(paths, 'auth-L1', { content: '# Updated\n' });
    // 不 invalidate 的话可能拿到旧缓存(取决于 mtime)
    invalidateSpecCache(rec.filePath);
    const updated = listAllSpecs(paths);
    expect(updated[0].content).toContain('Updated');
  });
});
