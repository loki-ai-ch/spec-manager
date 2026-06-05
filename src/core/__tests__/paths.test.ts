import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSpecFiles, specFilePath, getPaths, type ProjectPaths } from '../paths.js';
import { findSpecByCode, listAllSpecs, createSpec, generateSpecCode, invalidateSpecCache, updateSpec, migrateSpecPaths } from '../spec-io.js';
import { archiveChange } from '../archive.js';
import type { SpecLevel } from '../validate.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-test-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * 平铺布局：默认写 specs/<topic>/<code>.md；legacy 文件保留 -<date> 后缀用于兼容测试。
 */
function writeSpecFile(
  topic: string,
  code: string,
  title = 'Test',
  level = 'L1',
  parentCode: string | null = null,
  opts?: { legacyDate?: string },
): string {
  const dir = join(root, 'specs', topic);
  mkdirSync(dir, { recursive: true });
  const fileName = opts?.legacyDate ? `${code}-${opts.legacyDate}.md` : `${code}.md`;
  const filePath = join(dir, fileName);
  const pc = parentCode ?? 'null';
  const fm = `---\ncode: ${code}\nlevel: ${level}\ntitle: ${title}\ntopic: ${topic}\nparentCode: ${pc}\nstatus: draft\nproject: 1\naiSummary: ''\ncoveredTasks: []\nrelations: []\ncreated: 2026-06-04T00:00:00Z\nupdated: 2026-06-04T00:00:00Z\n---\n# ${title}\n`;
  writeFileSync(filePath, fm, 'utf8');
  return filePath;
}

function confirmSpec(code: string): void {
  updateSpec(paths, code, { status: 'confirmed' });
}

describe('listSpecFiles — 平铺扫描', () => {
  it('空项目返回空', () => {
    expect(listSpecFiles(paths)).toEqual([]);
  });

  it('单层 L1 spec', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth L1');
    const all = listSpecFiles(paths);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({
      topic: 'auth',
      code: 'auth-L1',
      filePath: expect.stringContaining('auth-L1.md'),
    });
  });

  it('兼容 legacy 日期后缀 spec 文件', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth L1', 'L1', null, { legacyDate: '20260604' });
    const all = listSpecFiles(paths);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({
      topic: 'auth',
      code: 'auth-L1',
      filePath: expect.stringContaining('auth-L1-20260604.md'),
    });
  });

  it('canonical 与 legacy 同 code 并存时拒绝静默选择', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth L1');
    writeSpecFile('auth', 'auth-L1', 'Auth L1 Legacy', 'L1', null, { legacyDate: '20260604' });
    expect(() => listSpecFiles(paths)).toThrow(/重复 spec code/);
  });

  it('3 层平铺 L1+L2+L3 全部发现', () => {
    writeSpecFile('auth', 'auth-L1', 'L1', 'L1');
    writeSpecFile('auth', 'auth-L2', 'L2', 'L2', 'auth-L1');
    writeSpecFile('auth', 'auth-L3', 'L3', 'L3', 'auth-L2');
    writeSpecFile('auth', 'auth-L3.1.2', 'L3-2', 'L3', 'auth-L2');
    const all = listSpecFiles(paths);
    const codes = all.map(s => s.code).sort();
    expect(codes).toEqual(['auth-L1', 'auth-L2', 'auth-L3', 'auth-L3.1.2'].sort());
  });

  it('多 topic 平铺', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth L1');
    writeSpecFile('auth', 'auth-L2', 'Auth L2', 'L2', 'auth-L1');
    writeSpecFile('billing', 'billing-L1', 'Billing L1');
    const all = listSpecFiles(paths);
    expect(all).toHaveLength(3);
    const byTopic = all.reduce<Record<string, number>>((m, s) => {
      m[s.topic] = (m[s.topic] ?? 0) + 1;
      return m;
    }, {});
    expect(byTopic).toEqual({ auth: 2, billing: 1 });
  });

  it('跳过 decisions/ tasks/ 元数据目录中的 .md', () => {
    writeSpecFile('auth', 'auth-L1', 'L1');
    const decDir = join(root, 'specs', 'auth', 'decisions');
    mkdirSync(decDir, { recursive: true });
    writeFileSync(join(decDir, 'decisions.md'), '# not a spec');
    const tasksDir = join(root, 'specs', 'auth', 'tasks');
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, 'tasks.md'), '# not a spec');
    const all = listSpecFiles(paths);
    expect(all).toHaveLength(1);
    expect(all[0].code).toBe('auth-L1');
  });
});

describe('findSpecByCode — 平铺查找', () => {
  it('L1', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth L1', 'L1');
    const rec = findSpecByCode(paths, 'auth-L1');
    expect(rec).not.toBeNull();
    expect(rec!.fm.level).toBe('L1');
    expect(rec!.fm.title).toBe('Auth L1');
  });

  it('L2', () => {
    writeSpecFile('auth', 'auth-L1', 'L1', 'L1');
    writeSpecFile('auth', 'auth-L2', 'L2', 'L2', 'auth-L1');
    const rec = findSpecByCode(paths, 'auth-L2');
    expect(rec).not.toBeNull();
    expect(rec!.fm.level).toBe('L2');
    expect(rec!.fm.parentCode).toBe('auth-L1');
  });

  it('L3', () => {
    writeSpecFile('auth', 'auth-L1', 'L1', 'L1');
    writeSpecFile('auth', 'auth-L2', 'L2', 'L2', 'auth-L1');
    writeSpecFile('auth', 'auth-L3', 'L3', 'L3', 'auth-L2');
    const rec = findSpecByCode(paths, 'auth-L3');
    expect(rec).not.toBeNull();
    expect(rec!.fm.parentCode).toBe('auth-L2');
  });

  it('找不到返回 null', () => {
    expect(findSpecByCode(paths, 'nonexistent-L1')).toBeNull();
  });
});

describe('specFilePath — 平铺路径计算', () => {
  it('L1: specs/<topic>/<code>.md', () => {
    const p = specFilePath(paths, null, 'auth-L1', 'auth', '20260604');
    expect(p).toBe(join(root, 'specs', 'auth', 'auth-L1.md'));
  });

  it('L2: 同样平铺在 specs/<topic>/ 下', () => {
    const p = specFilePath(paths, null, 'auth-L2.1', 'auth', '20260605');
    expect(p).toBe(join(root, 'specs', 'auth', 'auth-L2.1.md'));
  });

  it('L3: 同样平铺', () => {
    const p = specFilePath(paths, null, 'auth-L3.1.1', 'auth', '20260606');
    expect(p).toBe(join(root, 'specs', 'auth', 'auth-L3.1.1.md'));
  });

  it('无 topic 时从 code 推断', () => {
    const p = specFilePath(paths, null, 'auth-L1', undefined, '20260604');
    expect(p).toBe(join(root, 'specs', 'auth', 'auth-L1.md'));
  });
});

describe('createSpec — 平铺落盘', () => {
  it('L1 落在 specs/<topic>/<code>.md', () => {
    const code = generateSpecCode('auth', 'L1');
    const rec = createSpec({
      paths,
      code,
      level: 'L1',
      title: 'Auth',
      topic: 'auth',
      parentCode: null,
    });
    expect(existsSync(rec.filePath)).toBe(true);
    expect(rec.filePath).toMatch(/specs\/auth\/auth-L1\.md$/);
    expect(rec.fm.code).toBe(code);
    expect(rec.fm.status).toBe('draft');
  });

  it('L2 平铺在 topic 下', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    confirmSpec(l1Code);
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    const l2 = createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    expect(l2.filePath).toMatch(/specs\/auth\/auth-L2\.1\.md$/);
    expect(l2.fm.parentCode).toBe(l1Code);
  });

  it('L3 平铺在 topic 下', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    confirmSpec(l1Code);
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    confirmSpec(l2Code);
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    const l3 = createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });
    expect(l3.filePath).toMatch(/specs\/auth\/auth-L3\.1\.1\.md$/);
  });

  it('L2 无 parent 抛 R7', () => {
    expect(() => createSpec({
      paths, code: generateSpecCode('auth', 'L2'), level: 'L2', title: 'bad', topic: 'auth', parentCode: null,
    })).toThrow(/R7/);
  });

  it('L3 父是 L1 抛 R7(level 错配)', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    expect(() => createSpec({
      paths, code: generateSpecCode('auth', 'L3', l1Code), level: 'L3', title: 'bad', topic: 'auth', parentCode: l1Code,
    })).toThrow(/R7.*L3.*L2/);
  });

  it('parentCode 指向不存在的 spec 抛错', () => {
    expect(() => createSpec({
      paths, code: generateSpecCode('auth', 'L2', 'nonexistent-L1'), level: 'L2', title: 'bad', topic: 'auth', parentCode: 'nonexistent-L1',
    })).toThrow(/不存在的 spec/);
  });

  it('支持 milestone 字段', () => {
    const code = generateSpecCode('auth', 'L1');
    const rec = createSpec({
      paths,
      code,
      level: 'L1',
      title: 'Auth',
      topic: 'auth',
      parentCode: null,
      milestone: 'v1.0',
    });
    expect(rec.fm.milestone).toBe('v1.0');
    const reread = findSpecByCode(paths, code);
    expect(reread!.fm.milestone).toBe('v1.0');
  });

  it('listAllSpecs 能找到三层全部', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    confirmSpec(l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    confirmSpec(l2Code);
    createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });
    const all = listAllSpecs(paths);
    expect(all).toHaveLength(3);
    expect(all.map(s => s.fm.code).sort()).toEqual([l1Code, l2Code, l3Code].sort());
  });
});

describe('generateSpecCode — 格式校验', () => {
  it('匹配 <topic>-<level> 格式', () => {
    const code = generateSpecCode('auth', 'L1');
    expect(code).toBe('auth-L1');
  });

  it('不同 topic/level 生成不同 code', () => {
    expect(generateSpecCode('auth', 'L1')).toBe('auth-L1');
    expect(generateSpecCode('billing', 'L2')).toBe('billing-L2');
  });
});

describe('listAllSpecs 内存缓存', () => {
  it('连续调用返回相同结果(缓存命中)', () => {
    writeSpecFile('auth', 'auth-L1', 'L1', 'L1');
    const a = listAllSpecs(paths);
    const b = listAllSpecs(paths);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  it('writeSpec 写后失效缓存,读到新内容', async () => {
    const code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code, level: 'L1', title: 'old title', topic: 'auth', parentCode: null });
    expect(listAllSpecs(paths)[0].fm.title).toBe('old title');
    await new Promise(r => setTimeout(r, 5));
    updateSpec(paths, code, { content: '# new body', aiSummary: 'new body' });
    expect(listAllSpecs(paths)[0].content).toBe('# new body\n');
  });

  it('invalidateSpecCache() 清空全部缓存', () => {
    writeSpecFile('auth', 'auth-L1', 'L1', 'L1');
    expect(listAllSpecs(paths)).toHaveLength(1);
    invalidateSpecCache();
    expect(listAllSpecs(paths)).toHaveLength(1);
  });
});

describe('migrateSpecPaths — legacy 日期后缀迁移', () => {
  it('dry-run 只返回计划，不改文件', () => {
    const oldPath = writeSpecFile('auth', 'auth-L1', 'Auth', 'L1', null, { legacyDate: '20260604' });
    const result = migrateSpecPaths(paths, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0].from).toBe(oldPath);
    expect(result.migrated[0].to).toBe(join(root, 'specs', 'auth', 'auth-L1.md'));
    expect(existsSync(oldPath)).toBe(true);
    expect(existsSync(join(root, 'specs', 'auth', 'auth-L1.md'))).toBe(false);
  });

  it('执行迁移后 findSpecByCode 读取 canonical 文件', () => {
    const oldPath = writeSpecFile('auth', 'auth-L1', 'Auth', 'L1', null, { legacyDate: '20260604' });
    const result = migrateSpecPaths(paths);
    const newPath = join(root, 'specs', 'auth', 'auth-L1.md');
    expect(result.migrated).toHaveLength(1);
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    expect(findSpecByCode(paths, 'auth-L1')!.filePath).toBe(newPath);
  });

  it('frontmatter code 不一致时拒绝迁移', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth', 'L1', null, { legacyDate: '20260604' });
    const badPath = join(root, 'specs', 'auth', 'auth-L1-20260604.md');
    const raw = `---\ncode: auth-L2\nlevel: L1\ntitle: Auth\ntopic: auth\nparentCode: null\nstatus: draft\n---\n# Auth\n`;
    writeFileSync(badPath, raw, 'utf8');
    expect(() => migrateSpecPaths(paths)).toThrow(/frontmatter code 不一致/);
    expect(existsSync(badPath)).toBe(true);
  });

  it('目标 canonical 文件已存在时拒绝迁移', () => {
    writeSpecFile('auth', 'auth-L1', 'Auth', 'L1', null, { legacyDate: '20260604' });
    writeSpecFile('auth', 'auth-L1', 'Auth Canonical');
    expect(() => migrateSpecPaths(paths)).toThrow(/目标文件已存在/);
    expect(readdirSync(join(root, 'specs', 'auth')).sort()).toEqual(['auth-L1-20260604.md', 'auth-L1.md']);
  });
});

describe('archiveChange — RENAMED 整目录移动', () => {
  it('L1 rename 应移到 <newCode>.md,旧文件不残留', () => {
    const oldCode = 'auth-L1';
    const newCode = 'auth-v2-L1';
    createSpec({ paths, code: oldCode, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const changesDir = join(root, 'changes', 'r1');
    mkdirSync(join(changesDir, 'deltas'), { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '---\nname: r1\nwhy: x\nscope: y\nrisk: z\n---\n# p');
    writeFileSync(join(changesDir, 'deltas', `${oldCode}.md`), `---
code: ${oldCode}
---

## RENAMED Requirements
- FROM: ${oldCode} TO: ${newCode}
`, 'utf8');
    archiveChange(paths, 'r1');
    // 旧文件不应存在
    expect(existsSync(join(root, 'specs', 'auth', `${oldCode}.md`))).toBe(false);
    expect(existsSync(join(root, 'specs', 'auth', `${newCode}.md`))).toBe(true);
  });
});
