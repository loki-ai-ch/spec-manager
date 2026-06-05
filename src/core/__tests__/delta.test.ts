import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createChange, getChangeDir, listChanges, parseDeltaFile, parseDeltaSpec, renderDeltaFile } from '../delta.js';
import { readFrontmatter } from '../frontmatter.js';
import { createSpec, generateSpecCode, invalidateSpecCache } from '../spec-io.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-delta-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
  invalidateSpecCache();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('createChange — 创建 change 目录', () => {
  it('创建基础目录结构', () => {
    const result = createChange({ paths, name: 'add-auth' });
    expect(result.name).toBe('add-auth');
    expect(existsSync(join(result.root, 'proposal.md'))).toBe(true);
    expect(existsSync(join(result.root, 'deltas'))).toBe(true);
    expect(existsSync(join(result.root, 'specs'))).toBe(true);
    expect(existsSync(join(result.root, 'README.md'))).toBe(true);
  });

  it('proposal.md 含 frontmatter', () => {
    const result = createChange({ paths, name: 'add-auth', description: 'Add auth module' });
    const { data, content } = readFrontmatter(result.proposalFile);
    expect(data.name).toBe('add-auth');
    expect(content).toContain('Add auth module');
  });

  it('非法 name 抛错', () => {
    expect(() => createChange({ paths, name: 'BAD_NAME' })).toThrow(/非法/);
    expect(() => createChange({ paths, name: 'has space' })).toThrow(/非法/);
  });

  it('重复 name 抛错', () => {
    createChange({ paths, name: 'add-auth' });
    expect(() => createChange({ paths, name: 'add-auth' })).toThrow(/已存在/);
  });
});

describe('getChangeDir — 获取 change 目录结构', () => {
  it('不存在返回 null', () => {
    expect(getChangeDir(paths, 'nonexistent')).toBeNull();
  });

  it('返回目录结构', () => {
    createChange({ paths, name: 'add-auth' });
    const dir = getChangeDir(paths, 'add-auth');
    expect(dir).not.toBeNull();
    expect(dir!.root).toContain('add-auth');
    expect(dir!.proposal).toContain('proposal.md');
    expect(dir!.deltaFiles).toEqual([]);
    expect(dir!.specFiles).toEqual([]);
  });

  it('specs/ 下的占位文件被发现', () => {
    createChange({ paths, name: 'add-auth' });
    const specDir = join(root, 'changes', 'add-auth', 'specs', 'auth', 'auth-L1');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'auth-L1.md'), '---\ncode: auth-L1\nlevel: L1\n---\n# Auth\n', 'utf8');
    const dir = getChangeDir(paths, 'add-auth');
    expect(dir!.specFiles).toHaveLength(1);
  });
});

describe('listChanges — 列出所有 change', () => {
  it('无 change 返回空', () => {
    expect(listChanges(paths)).toEqual([]);
  });

  it('列出已创建的 change', () => {
    createChange({ paths, name: 'add-auth' });
    createChange({ paths, name: 'add-billing' });
    const all = listChanges(paths);
    expect(all).toHaveLength(2);
    expect(all.map(c => c.name).sort()).toEqual(['add-auth', 'add-billing']);
  });
});

describe('parseDeltaFile — 解析 delta 文件', () => {
  it('解析 ADDED 段', () => {
    const content = `---
code: auth-L1
---

## ADDED Requirements

### Requirement: auth-L1
#### Title: Authentication
The system **SHALL** support login.
`;
    const deltaDir = join(root, 'changes', 'test-change', 'deltas');
    mkdirSync(deltaDir, { recursive: true });
    const filePath = join(deltaDir, 'auth-L1.md');
    writeFileSync(filePath, content, 'utf8');

    const { specCode, entries } = parseDeltaFile(filePath);
    expect(specCode).toBe('auth-L1');
    expect(entries).toHaveLength(1);
    expect(entries[0].op).toBe('ADDED');
    expect(entries[0].code).toBe('auth-L1');
  });

  it('解析 MODIFIED 段', () => {
    const content = `---
code: auth-L1
---

## MODIFIED Requirements

### Requirement: auth-L1
Updated content here.
`;
    const deltaDir = join(root, 'changes', 'test-change', 'deltas');
    mkdirSync(deltaDir, { recursive: true });
    const filePath = join(deltaDir, 'auth-L1.md');
    writeFileSync(filePath, content, 'utf8');

    const { entries } = parseDeltaFile(filePath);
    expect(entries).toHaveLength(1);
    expect(entries[0].op).toBe('MODIFIED');
    expect(entries[0].code).toBe('auth-L1');
  });

  it('解析 REMOVED 段', () => {
    const content = `---
code: auth-L1
---

## REMOVED Requirements

### Requirement: auth-L1-old
`;
    const deltaDir = join(root, 'changes', 'test-change', 'deltas');
    mkdirSync(deltaDir, { recursive: true });
    const filePath = join(deltaDir, 'auth-L1.md');
    writeFileSync(filePath, content, 'utf8');

    const { entries } = parseDeltaFile(filePath);
    expect(entries).toHaveLength(1);
    expect(entries[0].op).toBe('REMOVED');
    expect(entries[0].code).toBe('auth-L1-old');
  });

  it('解析 RENAMED 段', () => {
    const content = `---
code: auth-L1
---

## RENAMED Requirements

- FROM: auth-L1-old TO: auth-L1-new
`;
    const deltaDir = join(root, 'changes', 'test-change', 'deltas');
    mkdirSync(deltaDir, { recursive: true });
    const filePath = join(deltaDir, 'auth-L1.md');
    writeFileSync(filePath, content, 'utf8');

    const { entries } = parseDeltaFile(filePath);
    expect(entries).toHaveLength(1);
    expect(entries[0].op).toBe('RENAMED');
    expect(entries[0].code).toBe('auth-L1-old');
    expect(entries[0].newCode).toBe('auth-L1-new');
  });

  it('缺 frontmatter code 抛错', () => {
    const content = `---
level: L1
---
# No code
`;
    const deltaDir = join(root, 'changes', 'test-change', 'deltas');
    mkdirSync(deltaDir, { recursive: true });
    const filePath = join(deltaDir, 'bad.md');
    writeFileSync(filePath, content, 'utf8');

    expect(() => parseDeltaFile(filePath)).toThrow(/code/);
  });
});

describe('parseDeltaSpec — 解析整个 change 目录', () => {
  it('解析含 delta 文件的 change', () => {
    createChange({ paths, name: 'add-auth' });
    const deltaContent = `---
code: auth-L1
---

## ADDED Requirements

### Requirement: auth-L1
The system **SHALL** support login.
`;
    writeFileSync(join(root, 'changes', 'add-auth', 'deltas', 'auth-L1.md'), deltaContent, 'utf8');
    const spec = parseDeltaSpec(paths, 'add-auth');
    expect(spec.name).toBe('add-auth');
    expect(spec.changes).toHaveLength(1);
    expect(spec.changes[0].op).toBe('ADDED');
  });

  it('不存在的 change 抛错', () => {
    expect(() => parseDeltaSpec(paths, 'nonexistent')).toThrow(/not found/i);
  });

  it('delta entry 缺 code 抛错', () => {
    createChange({ paths, name: 'bad-delta' });
    // 写一个缺 code 的 delta 文件（手动绕过 parseDeltaFile 的检查）
    const badContent = `---
code: auth-L1
---

## ADDED Requirements

### Requirement:
Missing code here.
`;
    writeFileSync(join(root, 'changes', 'bad-delta', 'deltas', 'bad.md'), badContent, 'utf8');
    // parseDeltaSpec 会在 entry.code 检查时抛错
    // 但 parseDeltaFile 会解析出 code=''，而 DeltaSpecSchema 会因为 code 为空拒绝
    expect(() => parseDeltaSpec(paths, 'bad-delta')).toThrow();
  });
});

describe('renderDeltaFile — 渲染 delta 文件', () => {
  it('渲染 ADDED entry', () => {
    const entries = [{ op: 'ADDED' as const, code: 'auth-L1', title: 'Auth', content: 'The system SHALL support login.' }];
    const output = renderDeltaFile('auth-L1', entries);
    expect(output).toContain('code: auth-L1');
    expect(output).toContain('## ADDED Requirements');
    expect(output).toContain('### Requirement: auth-L1');
  });

  it('渲染 RENAMED entry', () => {
    const entries = [{ op: 'RENAMED' as const, code: 'old-code', newCode: 'new-code' }];
    const output = renderDeltaFile('auth-L1', entries);
    expect(output).toContain('## RENAMED Requirements');
    expect(output).toContain('FROM: old-code TO: new-code');
  });

  it('渲染多种 op', () => {
    const entries = [
      { op: 'ADDED' as const, code: 'a', content: 'new' },
      { op: 'REMOVED' as const, code: 'b', changeSummary: 'gone' },
    ];
    const output = renderDeltaFile('auth-L1', entries);
    expect(output).toContain('## ADDED Requirements');
    expect(output).toContain('## REMOVED Requirements');
  });
});
