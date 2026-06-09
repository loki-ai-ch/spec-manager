import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { getPaths, type ProjectPaths } from '../paths.js';
import { archiveChange } from '../archive.js';
import { createChange } from '../delta.js';
import { createSpec, findSpecByCode, updateSpec, invalidateSpecCache } from '../spec-io.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-archive-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
  invalidateSpecCache();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeDelta(changeName: string, fileName: string, content: string): void {
  writeFileSync(join(root, 'changes', changeName, 'deltas', fileName), content, 'utf8');
}

function writeValidProposal(changeName: string): void {
  writeFileSync(
    join(root, 'changes', changeName, 'proposal.md'),
    `---
name: ${changeName}
why: test why
scope: test scope
---
# ${changeName}
`,
    'utf8',
  );
}

describe('archiveChange — 预检与失败安全', () => {
  it('RENAMED migrates structured child references', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    createChange({ paths, name: 'rename-references' });
    writeValidProposal('rename-references');
    writeDelta('rename-references', 'auth-L1.md', `---
code: auth-L1
---

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1
`);

    archiveChange(paths, 'rename-references');
    expect(findSpecByCode(paths, 'auth-L2.1')?.fm.parentCode).toBe('auth-v2-L1');
    expect(findSpecByCode(paths, 'auth-L1')).toBeNull();
  });

  it('RENAMED 目标 code 已存在时拒绝覆盖且不归档', () => {
    const oldCode = 'auth-L1';
    const newCode = 'auth-v2-L1';
    createSpec({ paths, code: oldCode, level: 'L1', title: 'Old', topic: 'auth', parentCode: null });
    createSpec({ paths, code: newCode, level: 'L1', title: 'New', topic: 'auth', parentCode: null });
    updateSpec(paths, newCode, { content: '# target\n', aiSummary: 'target' });
    createChange({ paths, name: 'rename-conflict' });
    writeValidProposal('rename-conflict');
    writeDelta('rename-conflict', `${oldCode}.md`, `---
code: ${oldCode}
---

## RENAMED Requirements
- FROM: ${oldCode} TO: ${newCode}
`);

    expect(() => archiveChange(paths, 'rename-conflict')).toThrow(/目标 spec 已存在/);
    expect(existsSync(join(root, 'changes', 'rename-conflict'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'rename-conflict'))).toBe(false);
    expect(findSpecByCode(paths, oldCode)).not.toBeNull();
    expect(findSpecByCode(paths, newCode)!.content).toBe('# target\n');
  });

  it('任一 entry 预检失败时不应用其它 MODIFIED entry', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { content: '# old\n', aiSummary: 'old' });
    createChange({ paths, name: 'partial-fail' });
    writeValidProposal('partial-fail');
    writeDelta('partial-fail', `${code}.md`, `---
code: ${code}
---

## MODIFIED Requirements

### Requirement: ${code}
# new

## REMOVED Requirements

### Requirement: missing-L1
`);

    expect(() => archiveChange(paths, 'partial-fail')).toThrow(/预检失败/);
    expect(existsSync(join(root, 'changes', 'partial-fail'))).toBe(true);
    expect(findSpecByCode(paths, code)!.content).toBe('# old\n');
  });

  it('ADDED 缺占位文件时不创建 spec 且不归档', () => {
    createChange({ paths, name: 'add-missing-placeholder' });
    writeValidProposal('add-missing-placeholder');
    writeDelta('add-missing-placeholder', 'auth-L1.md', `---
code: auth-L1
---

## ADDED Requirements

### Requirement: auth-L1
# Auth
`);

    expect(() => archiveChange(paths, 'add-missing-placeholder')).toThrow(/无法推断 auth-L1 的 topic/);
    expect(existsSync(join(root, 'changes', 'add-missing-placeholder'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'add-missing-placeholder'))).toBe(false);
    expect(findSpecByCode(paths, 'auth-L1')).toBeNull();
  });

  it('proposal 缺 why/scope 时拒绝归档', () => {
    createChange({ paths, name: 'bad-proposal' });
    writeDelta('bad-proposal', 'auth-L1.md', `---
code: auth-L1
---

## REMOVED Requirements

### Requirement: auth-L1
`);

    expect(() => archiveChange(paths, 'bad-proposal')).toThrow(/R24.*why\/scope/);
    expect(existsSync(join(root, 'changes', 'bad-proposal'))).toBe(true);
  });

  it('apply 阶段失败时回滚已应用的 MODIFIED entry', () => {
    const l1Code = 'auth-L1';
    createSpec({ paths, code: l1Code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, l1Code, { content: '# old\n', aiSummary: 'old' });

    createChange({ paths, name: 'apply-rollback' });
    writeValidProposal('apply-rollback');
    mkdirSync(join(root, 'changes', 'apply-rollback', 'specs', 'auth', 'auth-L2'), { recursive: true });
    writeFileSync(
      join(root, 'changes', 'apply-rollback', 'specs', 'auth', 'auth-L2', 'auth-L2.md'),
      `---
code: auth-L2
level: L2
title: Auth Design
topic: auth
parentCode: ${l1Code}
status: draft
---
# Auth Design
`,
      'utf8',
    );
    writeDelta('apply-rollback', 'auth-L1.md', `---
code: auth-L1
---

## MODIFIED Requirements

### Requirement: auth-L1
# new

## ADDED Requirements

### Requirement: auth-L2
# Auth Design
`);

    expect(() => archiveChange(paths, 'apply-rollback')).toThrow(/R4/);
    expect(findSpecByCode(paths, l1Code)!.content).toBe('# old\n');
    expect(findSpecByCode(paths, 'auth-L2')).toBeNull();
    expect(existsSync(join(root, 'changes', 'apply-rollback'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'apply-rollback'))).toBe(false);
  });
});
