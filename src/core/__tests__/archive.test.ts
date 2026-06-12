import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { getPaths, type ProjectPaths } from '../paths.js';
import { archiveChange } from '../archive.js';
import { createChange } from '../delta.js';
import { createSpec, findSpecByCode, updateSpec, invalidateSpecCache } from '../spec-io.js';
import { readAudit } from '../audit.js';
import { inspectProjectIntegrity } from '../integrity.js';

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

function writePlaceholder(changeName: string, topic: string, code: string, content: string): void {
  const dir = join(root, 'changes', changeName, 'specs', topic, code);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${code}.md`), content, 'utf8');
}

describe('archiveChange — 预检与失败安全', () => {
  it('REMOVED keeps archived spec and change metadata under one archivedTo root', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { content: '# Auth\n', aiSummary: 'auth' });
    createChange({ paths, name: 'remove-one-root' });
    writeValidProposal('remove-one-root');
    writeDelta('remove-one-root', `${code}.md`, `---
code: ${code}
---

## REMOVED Requirements

### Requirement: ${code}
`);

    const result = archiveChange(paths, 'remove-one-root');

    expect(result.archivedTo).toBe(join(paths.archiveDir, 'remove-one-root'));
    expect(existsSync(join(result.archivedTo, 'proposal.md'))).toBe(true);
    expect(existsSync(join(result.archivedTo, 'deltas', `${code}.md`))).toBe(true);
    expect(existsSync(join(result.archivedTo, 'specs', 'auth', `${code}.md`))).toBe(true);
    expect(readdirSync(paths.archiveDir).filter(name => name.startsWith('remove-one-root'))).toEqual(['remove-one-root']);
  });

  it('REMOVED uses one timestamped root when the historical archive target exists', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createChange({ paths, name: 'remove-existing-root' });
    writeValidProposal('remove-existing-root');
    writeDelta('remove-existing-root', `${code}.md`, `---
code: ${code}
---

## REMOVED Requirements

### Requirement: ${code}
`);
    const historicalRoot = join(paths.archiveDir, 'remove-existing-root');
    mkdirSync(historicalRoot, { recursive: true });
    writeFileSync(join(historicalRoot, 'sentinel.txt'), 'historical\n', 'utf8');

    const result = archiveChange(paths, 'remove-existing-root');

    expect(result.archivedTo).not.toBe(historicalRoot);
    expect(result.archivedTo.startsWith(`${historicalRoot}-`)).toBe(true);
    expect(readFileSync(join(historicalRoot, 'sentinel.txt'), 'utf8')).toBe('historical\n');
    expect(existsSync(join(result.archivedTo, 'proposal.md'))).toBe(true);
    expect(existsSync(join(result.archivedTo, 'specs', 'auth', `${code}.md`))).toBe(true);
  });

  it('REMOVED allows a referenced family when source and target are removed together', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    createChange({ paths, name: 'remove-family' });
    writeValidProposal('remove-family');
    writeDelta('remove-family', 'removed.md', `---
code: removed
---

## REMOVED Requirements

### Requirement: auth-L2.1

### Requirement: auth-L1
`);

    archiveChange(paths, 'remove-family');

    expect(findSpecByCode(paths, 'auth-L1')).toBeNull();
    expect(findSpecByCode(paths, 'auth-L2.1')).toBeNull();
    expect(inspectProjectIntegrity(paths).filter(issue => issue.kind === 'dangling-reference')).toEqual([]);
  });

  it('REMOVED and ADDED replace the same referenced code without dangling references', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Old Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { status: 'confirmed', content: '# Old Auth\n', aiSummary: 'old' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: code });
    createChange({ paths, name: 'replace-same-code' });
    writeValidProposal('replace-same-code');
    writePlaceholder('replace-same-code', 'auth', code, `---
code: ${code}
level: L1
title: New Auth
topic: auth
parentCode: null
status: draft
---
# New Auth
`);
    writeDelta('replace-same-code', 'replace.md', `---
code: replace
---

## REMOVED Requirements

### Requirement: ${code}

## ADDED Requirements

### Requirement: ${code}
# New Auth
`);

    archiveChange(paths, 'replace-same-code');

    expect(findSpecByCode(paths, code)?.fm.title).toBe('New Auth');
    expect(findSpecByCode(paths, code)?.content).toBe('# New Auth\n');
    expect(findSpecByCode(paths, 'auth-L2.1')?.fm.parentCode).toBe(code);
    expect(inspectProjectIntegrity(paths).filter(issue => issue.kind === 'dangling-reference')).toEqual([]);
  });

  it('RENAMED then REMOVED and ADDED replaces the final code and preserves migrated references', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Old Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    createChange({ paths, name: 'rename-replace' });
    writeValidProposal('rename-replace');
    writePlaceholder('rename-replace', 'auth', 'auth-v2-L1', `---
code: auth-v2-L1
level: L1
title: New Auth
topic: auth
parentCode: null
status: draft
---
# New Auth
`);
    writeDelta('rename-replace', 'replace.md', `---
code: replace
---

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1

## REMOVED Requirements

### Requirement: auth-v2-L1

## ADDED Requirements

### Requirement: auth-v2-L1
# New Auth
`);

    archiveChange(paths, 'rename-replace');

    expect(findSpecByCode(paths, 'auth-L1')).toBeNull();
    expect(findSpecByCode(paths, 'auth-v2-L1')?.fm.title).toBe('New Auth');
    expect(findSpecByCode(paths, 'auth-L2.1')?.fm.parentCode).toBe('auth-v2-L1');
    expect(inspectProjectIntegrity(paths).filter(issue => issue.kind === 'dangling-reference')).toEqual([]);
  });

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

  it('multiple RENAMED entries migrate references and task files exactly once', () => {
    const firstCode = 'auth-L1';
    const secondCode = 'billing-L1';
    const firstNewCode = 'auth-v2-L1';
    const secondNewCode = 'billing-v2-L1';
    createSpec({ paths, code: firstCode, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createSpec({ paths, code: secondCode, level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(paths, firstCode, { addRelation: { type: 'references', target: secondCode } });
    updateSpec(paths, secondCode, { addRelation: { type: 'references', target: firstCode } });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    const oldTaskFile = join(taskDir, `${firstCode}-T-001.json`);
    const newTaskFile = join(taskDir, `${firstNewCode}-T-001.json`);
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(oldTaskFile, JSON.stringify({
      id: 'T-001',
      specCode: firstCode,
      status: 'completed',
      steps: [],
      autoConfirm: false,
      created: '2026-06-11T00:00:00.000Z',
    }), 'utf8');

    createChange({ paths, name: 'multiple-renames' });
    writeValidProposal('multiple-renames');
    writeDelta('multiple-renames', 'renames.md', `---
code: renames
---

## RENAMED Requirements
- FROM: ${firstCode} TO: ${firstNewCode}
- FROM: ${secondCode} TO: ${secondNewCode}
`);

    archiveChange(paths, 'multiple-renames');

    expect(findSpecByCode(paths, firstNewCode)?.fm.relations).toContainEqual({ type: 'references', target: secondNewCode });
    expect(findSpecByCode(paths, secondNewCode)?.fm.relations).toContainEqual({ type: 'references', target: firstNewCode });
    expect(findSpecByCode(paths, firstCode)).toBeNull();
    expect(findSpecByCode(paths, secondCode)).toBeNull();
    expect(existsSync(oldTaskFile)).toBe(false);
    expect(JSON.parse(readFileSync(newTaskFile, 'utf8')).specCode).toBe(firstNewCode);
  });

  it('chained RENAMED entries migrate every reference and task directly to the final code', () => {
    const firstCode = 'auth-L1';
    const middleCode = 'auth-v2-L1';
    const finalCode = 'auth-v3-L1';
    createSpec({ paths, code: firstCode, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, firstCode, { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: firstCode });
    createSpec({ paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(paths, 'billing-L1', { addRelation: { type: 'references', target: firstCode } });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    const oldTaskFile = join(taskDir, `${firstCode}-T-001.json`);
    const middleTaskFile = join(taskDir, `${middleCode}-T-001.json`);
    const finalTaskFile = join(taskDir, `${finalCode}-T-001.json`);
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(oldTaskFile, JSON.stringify({
      id: 'T-001',
      specCode: firstCode,
      status: 'completed',
      steps: [],
      verifications: [{ id: 'V-001', command: 'npm test', exitCode: 0, summary: 'passed', artifacts: [], coversAc: [], created: '2026-06-11T00:00:00.000Z', layer: 'functional' }],
      autoConfirm: false,
      created: '2026-06-11T00:00:00.000Z',
    }), 'utf8');
    createChange({ paths, name: 'chained-renames' });
    writeValidProposal('chained-renames');
    writeDelta('chained-renames', 'renames.md', `---
code: renames
---

## RENAMED Requirements
- FROM: ${firstCode} TO: ${middleCode}
- FROM: ${middleCode} TO: ${finalCode}
`);

    archiveChange(paths, 'chained-renames');

    expect(findSpecByCode(paths, finalCode)).not.toBeNull();
    expect(findSpecByCode(paths, firstCode)).toBeNull();
    expect(findSpecByCode(paths, middleCode)).toBeNull();
    expect(findSpecByCode(paths, 'auth-L2.1')?.fm.parentCode).toBe(finalCode);
    expect(findSpecByCode(paths, 'billing-L1')?.fm.relations).toContainEqual({ type: 'references', target: finalCode });
    expect(existsSync(oldTaskFile)).toBe(false);
    expect(existsSync(middleTaskFile)).toBe(false);
    expect(JSON.parse(readFileSync(finalTaskFile, 'utf8')).specCode).toBe(finalCode);
    expect(inspectProjectIntegrity(paths).filter(issue => issue.kind === 'dangling-reference')).toEqual([]);
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

  it('重复 MODIFIED 时拒绝归档且不修改原 spec', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { content: '# old\n', aiSummary: 'old' });
    createChange({ paths, name: 'duplicate-modified' });
    writeValidProposal('duplicate-modified');
    writeDelta('duplicate-modified', 'first.md', `---
code: first
---

## MODIFIED Requirements

### Requirement: ${code}
# first
`);
    writeDelta('duplicate-modified', 'second.md', `---
code: second
---

## MODIFIED Requirements

### Requirement: ${code}
# second
`);

    expect(() => archiveChange(paths, 'duplicate-modified')).toThrow(/重复 MODIFIED.*auth-L1.*2 entries/);
    expect(findSpecByCode(paths, code)!.content).toBe('# old\n');
    expect(existsSync(join(root, 'changes', 'duplicate-modified'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'duplicate-modified'))).toBe(false);
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

  it('ADDED 多 topic 重复占位时不创建 spec 且不归档', () => {
    const code = 'shared-L1';
    createChange({ paths, name: 'ambiguous-placeholder' });
    writeValidProposal('ambiguous-placeholder');
    writePlaceholder('ambiguous-placeholder', 'alpha', code, `---
code: ${code}
level: L1
title: Alpha
topic: alpha
parentCode: null
status: draft
---
# Alpha
`);
    writePlaceholder('ambiguous-placeholder', 'beta', code, `---
code: ${code}
level: L1
title: Beta
topic: beta
parentCode: null
status: draft
---
# Beta
`);
    writeDelta('ambiguous-placeholder', 'added.md', `---
code: added
---

## ADDED Requirements

### Requirement: ${code}
# Shared
`);

    expect(() => archiveChange(paths, 'ambiguous-placeholder')).toThrow(/ADDED shared-L1 占位定义歧义/);
    expect(findSpecByCode(paths, code)).toBeNull();
    expect(existsSync(join(root, 'changes', 'ambiguous-placeholder'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'ambiguous-placeholder'))).toBe(false);
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
    expect(readAudit(paths).rules.R24).toBe(1);
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

  it('ADDED apply failure removes a newly created topic directory and preserves existing topics', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const authSentinel = join(paths.specsDir, 'auth', 'sentinel.txt');
    writeFileSync(authSentinel, 'preserve\n', 'utf8');
    createChange({ paths, name: 'added-topic-apply-rollback' });
    writeValidProposal('added-topic-apply-rollback');
    writePlaceholder('added-topic-apply-rollback', 'new-topic', 'new-topic-L1', `---
code: new-topic-L1
level: L1
title: New Topic
topic: new-topic
parentCode: null
status: draft
---
# New Topic
`);
    writePlaceholder('added-topic-apply-rollback', 'auth', 'auth-L2.1', `---
code: auth-L2.1
level: L2
title: Auth Design
topic: auth
parentCode: auth-L1
status: draft
---
# Auth Design
`);
    writeDelta('added-topic-apply-rollback', 'added.md', `---
code: added
---

## ADDED Requirements

### Requirement: new-topic-L1
# New Topic

### Requirement: auth-L2.1
# Auth Design
`);

    expect(() => archiveChange(paths, 'added-topic-apply-rollback')).toThrow(/R4/);

    expect(findSpecByCode(paths, 'new-topic-L1')).toBeNull();
    expect(existsSync(join(paths.specsDir, 'new-topic'))).toBe(false);
    expect(readFileSync(authSentinel, 'utf8')).toBe('preserve\n');
  });

  it('ADDED move failure removes a newly created topic directory', () => {
    createChange({ paths, name: 'added-topic-move-rollback' });
    writeValidProposal('added-topic-move-rollback');
    writePlaceholder('added-topic-move-rollback', 'new-topic', 'new-topic-L1', `---
code: new-topic-L1
level: L1
title: New Topic
topic: new-topic
parentCode: null
status: draft
---
# New Topic
`);
    writeDelta('added-topic-move-rollback', 'added.md', `---
code: added
---

## ADDED Requirements

### Requirement: new-topic-L1
# New Topic
`);
    writeFileSync(paths.archiveDir, 'not a directory', 'utf8');

    expect(() => archiveChange(paths, 'added-topic-move-rollback')).toThrow();

    expect(findSpecByCode(paths, 'new-topic-L1')).toBeNull();
    expect(existsSync(join(paths.specsDir, 'new-topic'))).toBe(false);
    expect(existsSync(join(paths.changesDir, 'added-topic-move-rollback'))).toBe(true);
  });

  it('REMOVED followed by apply failure leaves no archive directories created by the attempt', () => {
    const removedCode = 'billing-L1';
    createSpec({ paths, code: removedCode, level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(paths, removedCode, { content: '# Billing\n', aiSummary: 'billing' });
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createChange({ paths, name: 'remove-rollback-layout' });
    writeValidProposal('remove-rollback-layout');
    mkdirSync(join(root, 'changes', 'remove-rollback-layout', 'specs', 'auth', 'auth-L2'), { recursive: true });
    writeFileSync(
      join(root, 'changes', 'remove-rollback-layout', 'specs', 'auth', 'auth-L2', 'auth-L2.md'),
      `---
code: auth-L2
level: L2
title: Auth Design
topic: auth
parentCode: auth-L1
status: draft
---
# Auth Design
`,
      'utf8',
    );
    writeDelta('remove-rollback-layout', 'mixed.md', `---
code: mixed
---

## REMOVED Requirements

### Requirement: ${removedCode}

## ADDED Requirements

### Requirement: auth-L2
# Auth Design
`);

    expect(() => archiveChange(paths, 'remove-rollback-layout')).toThrow(/R4/);

    expect(findSpecByCode(paths, removedCode)).not.toBeNull();
    expect(existsSync(join(paths.changesDir, 'remove-rollback-layout'))).toBe(true);
    expect(existsSync(join(paths.archiveDir, 'remove-rollback-layout'))).toBe(false);
  });

  it('change directory move failure rolls back every reference update', () => {
    const oldCode = 'auth-L1';
    const newCode = 'auth-v2-L1';
    createSpec({ paths, code: oldCode, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    const oldTaskFile = join(taskDir, `${oldCode}-T-001.json`);
    const newTaskFile = join(taskDir, `${newCode}-T-001.json`);
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(oldTaskFile, JSON.stringify({
      id: 'T-001',
      specCode: oldCode,
      status: 'completed',
      created: '2026-06-11T00:00:00.000Z',
    }), 'utf8');
    mkdirSync(paths.incidentsDir, { recursive: true });
    const incidentFile = join(paths.incidentsDir, 'INC-20260611-001.md');
    writeFileSync(incidentFile, `---
id: INC-20260611-001
ruleId: R24
severity: high
status: open
title: Archive failure
specCode: ${oldCode}
created: 2026-06-11T00:00:00.000Z
updated: 2026-06-11T00:00:00.000Z
---
# Incident
`, 'utf8');
    createChange({ paths, name: 'related-change' });
    const relatedProposal = join(root, 'changes', 'related-change', 'proposal.md');
    writeFileSync(relatedProposal, `---
name: related-change
why: related
scope: related
specCode: ${oldCode}
---
# Related
`, 'utf8');
    createChange({ paths, name: 'move-failure' });
    writeValidProposal('move-failure');
    writeDelta('move-failure', `${oldCode}.md`, `---
code: ${oldCode}
---

## RENAMED Requirements
- FROM: ${oldCode} TO: ${newCode}
`);
    writeFileSync(paths.archiveDir, 'not a directory', 'utf8');

    expect(() => archiveChange(paths, 'move-failure')).toThrow();

    expect(findSpecByCode(paths, oldCode)).not.toBeNull();
    expect(findSpecByCode(paths, newCode)).toBeNull();
    expect(existsSync(oldTaskFile)).toBe(true);
    expect(existsSync(newTaskFile)).toBe(false);
    expect(readFileSync(incidentFile, 'utf8')).toContain(`specCode: ${oldCode}`);
    expect(readFileSync(relatedProposal, 'utf8')).toContain(`specCode: ${oldCode}`);
    expect(existsSync(join(root, 'changes', 'move-failure'))).toBe(true);
    expect(readAudit(paths).rules.R24).toBe(0);
  });
});
