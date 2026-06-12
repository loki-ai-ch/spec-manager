import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createChange } from '../delta.js';
import { planArchiveChange } from '../archive-plan.js';
import { createSpec, findSpecByCode, invalidateSpecCache, updateSpec } from '../spec-io.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-archive-plan-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
  invalidateSpecCache();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

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

function writeDelta(changeName: string, fileName: string, content: string): void {
  writeFileSync(join(root, 'changes', changeName, 'deltas', fileName), content, 'utf8');
}

function writePlaceholder(changeName: string, topic: string, code: string, content: string): void {
  const dir = join(root, 'changes', changeName, 'specs', topic, code);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${code}.md`), content, 'utf8');
}

describe('planArchiveChange', () => {
  it('sorts entries, plans reference updates, and does not modify disk', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, 'auth-L1', { status: 'confirmed', content: '# old\n', aiSummary: 'old' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    createSpec({ paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(paths, 'billing-L1', { content: '# billing\n', aiSummary: 'billing' });
    createChange({ paths, name: 'mixed-plan' });
    writeValidProposal('mixed-plan');
    writePlaceholder('mixed-plan', 'auth', 'auth-L3.1.1-login', `---
code: auth-L3.1.1-login
level: L3
title: Login
topic: auth
parentCode: auth-L2.1
status: draft
---
# Login
`);
    writeDelta('mixed-plan', 'mixed.md', `---
code: mixed
---

## ADDED Requirements

### Requirement: auth-L3.1.1-login
# Login

## MODIFIED Requirements

### Requirement: billing-L1
# updated

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1
`);

    const before = readFileSync(findSpecByCode(paths, 'auth-L1')!.filePath, 'utf8');
    const plan = planArchiveChange({ paths, name: 'mixed-plan' });

    expect(plan.entries.map(entry => entry.op)).toEqual(['RENAMED', 'MODIFIED', 'ADDED']);
    expect(plan.referenceUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'spec-parent', specCode: 'auth-L2.1', oldCode: 'auth-L1', newCode: 'auth-v2-L1' }),
    ]));
    expect(existsSync(join(root, 'changes', 'mixed-plan'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'mixed-plan'))).toBe(false);
    expect(readFileSync(findSpecByCode(paths, 'auth-L1')!.filePath, 'utf8')).toBe(before);
  });

  it('rejects proposal without why and scope with R24', () => {
    writeFileSync(paths.auditFile, '{"sentinel":"unchanged"}\n', 'utf8');
    createChange({ paths, name: 'bad-proposal' });
    writeDelta('bad-proposal', 'auth-L1.md', `---
code: auth-L1
---

## REMOVED Requirements

### Requirement: auth-L1
`);

    expect(() => planArchiveChange({ paths, name: 'bad-proposal' })).toThrow(/R24.*why\/scope/);
    expect(readFileSync(paths.auditFile, 'utf8')).toBe('{"sentinel":"unchanged"}\n');
  });

  it('rejects RENAMED target conflicts during preflight', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Old', topic: 'auth', parentCode: null });
    createSpec({ paths, code: 'auth-v2-L1', level: 'L1', title: 'New', topic: 'auth', parentCode: null });
    createChange({ paths, name: 'rename-conflict' });
    writeValidProposal('rename-conflict');
    writeDelta('rename-conflict', 'auth-L1.md', `---
code: auth-L1
---

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1
`);

    expect(() => planArchiveChange({ paths, name: 'rename-conflict' })).toThrow(/目标 spec 已存在/);
  });

  it('rejects duplicate MODIFIED entries for the same spec in one delta file', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { content: '# original\n', aiSummary: 'original' });
    createChange({ paths, name: 'duplicate-modified-one-file' });
    writeValidProposal('duplicate-modified-one-file');
    writeDelta('duplicate-modified-one-file', `${code}.md`, `---
code: ${code}
---

## MODIFIED Requirements

### Requirement: ${code}
# first

### Requirement: ${code}
# second
`);

    expect(() => planArchiveChange({ paths, name: 'duplicate-modified-one-file' }))
      .toThrow(/重复 MODIFIED.*auth-L1.*2 entries/);
    expect(findSpecByCode(paths, code)!.content).toBe('# original\n');
    expect(existsSync(join(root, 'changes', 'duplicate-modified-one-file'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'duplicate-modified-one-file'))).toBe(false);
  });

  it('rejects duplicate MODIFIED entries for the same spec across delta files', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { content: '# original\n', aiSummary: 'original' });
    createChange({ paths, name: 'duplicate-modified-files' });
    writeValidProposal('duplicate-modified-files');
    writeDelta('duplicate-modified-files', 'first.md', `---
code: first
---

## MODIFIED Requirements

### Requirement: ${code}
# first
`);
    writeDelta('duplicate-modified-files', 'second.md', `---
code: second
---

## MODIFIED Requirements

### Requirement: ${code}
# second
`);

    expect(() => planArchiveChange({ paths, name: 'duplicate-modified-files' }))
      .toThrow(/重复 MODIFIED.*auth-L1.*2 entries/);
    expect(findSpecByCode(paths, code)!.content).toBe('# original\n');
    expect(existsSync(join(root, 'changes', 'duplicate-modified-files'))).toBe(true);
    expect(existsSync(join(root, 'archive', 'duplicate-modified-files'))).toBe(false);
  });

  it('rejects REMOVED when surviving specs reference the target', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    createSpec({ paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(paths, 'billing-L1', { addRelation: { type: 'references', target: 'auth-L1' } });
    createChange({ paths, name: 'remove-referenced-spec' });
    writeValidProposal('remove-referenced-spec');
    writeDelta('remove-referenced-spec', 'removed.md', `---
code: removed
---

## REMOVED Requirements

### Requirement: auth-L1
`);

    expect(() => planArchiveChange({ paths, name: 'remove-referenced-spec' }))
      .toThrow(/REMOVED 引用完整性检查失败[\s\S]*auth-L1 <- spec parentCode auth-L2\.1[\s\S]*auth-L1 <- spec relation references billing-L1/);
    expect(findSpecByCode(paths, 'auth-L1')).not.toBeNull();
    expect(existsSync(join(root, 'changes', 'remove-referenced-spec'))).toBe(true);
  });

  it('rejects REMOVED when repository metadata references the target', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    const decisionDir = join(root, 'specs', 'auth', 'decisions');
    mkdirSync(taskDir, { recursive: true });
    mkdirSync(decisionDir, { recursive: true });
    mkdirSync(paths.incidentsDir, { recursive: true });
    writeFileSync(join(taskDir, `${code}-T-001.json`), JSON.stringify({ id: 'T-001', specCode: code }), 'utf8');
    writeFileSync(join(decisionDir, 'DC-001.md'), `---
id: DC-001
docCode: ${code}
---
# Decision
`, 'utf8');
    writeFileSync(join(paths.incidentsDir, 'INC-001.md'), `---
id: INC-001
specCode: ${code}
---
# Incident
`, 'utf8');
    createChange({ paths, name: 'related-change' });
    writeFileSync(join(root, 'changes', 'related-change', 'proposal.md'), `---
name: related-change
why: related
scope: related
specCode: ${code}
---
# Related
`, 'utf8');
    createChange({ paths, name: 'remove-metadata-target' });
    writeValidProposal('remove-metadata-target');
    writeDelta('remove-metadata-target', 'removed.md', `---
code: removed
---

## REMOVED Requirements

### Requirement: ${code}
`);

    expect(() => planArchiveChange({ paths, name: 'remove-metadata-target' }))
      .toThrow(/auth-L1 <- task T-001[\s\S]*auth-L1 <- decision DC-001[\s\S]*auth-L1 <- incident INC-001[\s\S]*auth-L1 <- change proposal related-change/);
  });

  it('rejects RENAMED followed by REMOVED when surviving references project to the removed code', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
    createChange({ paths, name: 'rename-remove-referenced' });
    writeValidProposal('rename-remove-referenced');
    writeDelta('rename-remove-referenced', 'mixed.md', `---
code: mixed
---

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1

## REMOVED Requirements

### Requirement: auth-v2-L1
`);

    expect(() => planArchiveChange({ paths, name: 'rename-remove-referenced' }))
      .toThrow(/auth-v2-L1 <- spec parentCode auth-L2\.1/);
  });

  it('allows REMOVED when every spec reference source is removed in the same change', () => {
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

    expect(planArchiveChange({ paths, name: 'remove-family' }).entries.map(entry => entry.code))
      .toEqual(['auth-L2.1', 'auth-L1']);
  });

  it('allows same-code REMOVED and ADDED replacement with surviving references', () => {
    const code = 'auth-L1';
    createSpec({ paths, code, level: 'L1', title: 'Old Auth', topic: 'auth', parentCode: null });
    updateSpec(paths, code, { status: 'confirmed' });
    createSpec({ paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: code });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    const decisionDir = join(root, 'specs', 'auth', 'decisions');
    mkdirSync(taskDir, { recursive: true });
    mkdirSync(decisionDir, { recursive: true });
    mkdirSync(paths.incidentsDir, { recursive: true });
    writeFileSync(join(taskDir, `${code}-T-001.json`), JSON.stringify({ id: 'T-001', specCode: code }), 'utf8');
    writeFileSync(join(decisionDir, 'DC-001.md'), `---
id: DC-001
docCode: ${code}
---
# Decision
`, 'utf8');
    writeFileSync(join(paths.incidentsDir, 'INC-001.md'), `---
id: INC-001
specCode: ${code}
---
# Incident
`, 'utf8');
    createChange({ paths, name: 'replacement-related-change' });
    writeFileSync(join(root, 'changes', 'replacement-related-change', 'proposal.md'), `---
name: replacement-related-change
why: related
scope: related
specCode: ${code}
---
# Related
`, 'utf8');
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

    expect(() => planArchiveChange({ paths, name: 'replace-same-code' })).not.toThrow();
  });

  it('allows rename-remove-add replacement when references project to the final code', () => {
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

    const plan = planArchiveChange({ paths, name: 'rename-replace' });
    expect(plan.referenceUpdates).toContainEqual(expect.objectContaining({
      kind: 'spec-parent',
      specCode: 'auth-L2.1',
      newCode: 'auth-v2-L1',
    }));
  });

  it('rejects RENAMED task target conflicts during preflight', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Old', topic: 'auth', parentCode: null });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, 'auth-L1-T-001.json'), JSON.stringify({
      id: 'T-001',
      specCode: 'auth-L1',
      status: 'completed',
      created: '2026-06-11T00:00:00.000Z',
    }), 'utf8');
    const targetTaskFile = join(taskDir, 'auth-v2-L1-T-001.json');
    writeFileSync(targetTaskFile, '{"sentinel":"preserve"}\n', 'utf8');
    createChange({ paths, name: 'rename-task-conflict' });
    writeValidProposal('rename-task-conflict');
    writeDelta('rename-task-conflict', 'auth-L1.md', `---
code: auth-L1
---

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1
`);

    expect(() => planArchiveChange({ paths, name: 'rename-task-conflict' })).toThrow(/目标 task 文件已存在/);
    expect(readFileSync(targetTaskFile, 'utf8')).toBe('{"sentinel":"preserve"}\n');
  });

  it('rejects chained RENAMED conflicts at the final task target', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Old', topic: 'auth', parentCode: null });
    const taskDir = join(root, 'specs', 'auth', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, 'auth-L1-T-001.json'), JSON.stringify({
      id: 'T-001',
      specCode: 'auth-L1',
      status: 'completed',
      created: '2026-06-11T00:00:00.000Z',
    }), 'utf8');
    const finalTaskFile = join(taskDir, 'auth-v3-L1-T-001.json');
    writeFileSync(finalTaskFile, '{"sentinel":"preserve"}\n', 'utf8');
    createChange({ paths, name: 'rename-chain-task-conflict' });
    writeValidProposal('rename-chain-task-conflict');
    writeDelta('rename-chain-task-conflict', 'auth-L1.md', `---
code: auth-L1
---

## RENAMED Requirements
- FROM: auth-L1 TO: auth-v2-L1
- FROM: auth-v2-L1 TO: auth-v3-L1
`);

    expect(() => planArchiveChange({ paths, name: 'rename-chain-task-conflict' })).toThrow(/目标 task 文件已存在/);
    expect(readFileSync(finalTaskFile, 'utf8')).toBe('{"sentinel":"preserve"}\n');
  });

  it('rejects ADDED without placeholder metadata', () => {
    createChange({ paths, name: 'missing-placeholder' });
    writeValidProposal('missing-placeholder');
    writeDelta('missing-placeholder', 'auth-L1.md', `---
code: auth-L1
---

## ADDED Requirements

### Requirement: auth-L1
# Auth
`);

    expect(() => planArchiveChange({ paths, name: 'missing-placeholder' })).toThrow(/无法推断 auth-L1 的 topic/);
  });

  it('rejects ADDED with ambiguous placeholders across topics', () => {
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

    expect(() => planArchiveChange({ paths, name: 'ambiguous-placeholder' }))
      .toThrow(new RegExp(`ADDED ${code} 占位定义歧义: .*alpha.*${code}\\.md, .*beta.*${code}\\.md`));
    expect(findSpecByCode(paths, code)).toBeNull();
    expect(existsSync(join(root, 'changes', 'ambiguous-placeholder'))).toBe(true);
  });

  it('allows multiple ADDED codes when each has one placeholder', () => {
    createChange({ paths, name: 'unique-placeholders' });
    writeValidProposal('unique-placeholders');
    writePlaceholder('unique-placeholders', 'alpha', 'alpha-L1', `---
code: alpha-L1
level: L1
title: Alpha
topic: alpha
parentCode: null
status: draft
---
# Alpha
`);
    writePlaceholder('unique-placeholders', 'beta', 'beta-L1', `---
code: beta-L1
level: L1
title: Beta
topic: beta
parentCode: null
status: draft
---
# Beta
`);
    writeDelta('unique-placeholders', 'added.md', `---
code: added
---

## ADDED Requirements

### Requirement: alpha-L1
# Alpha

### Requirement: beta-L1
# Beta
`);

    const plan = planArchiveChange({ paths, name: 'unique-placeholders' });
    expect(plan.entries.map(entry => [entry.code, entry.metadata?.topic])).toEqual([
      ['alpha-L1', 'alpha'],
      ['beta-L1', 'beta'],
    ]);
  });

  it('rejects ADDED L3 whose parent is not L2 with R7', () => {
    createSpec({ paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    createChange({ paths, name: 'bad-parent' });
    writeValidProposal('bad-parent');
    writePlaceholder('bad-parent', 'auth', 'auth-L3.1.1-login', `---
code: auth-L3.1.1-login
level: L3
title: Login
topic: auth
parentCode: auth-L1
status: draft
---
# Login
`);
    writeDelta('bad-parent', 'auth-L3.1.1-login.md', `---
code: auth-L3.1.1-login
---

## ADDED Requirements

### Requirement: auth-L3.1.1-login
# Login
`);

    expect(() => planArchiveChange({ paths, name: 'bad-parent' })).toThrow(/R7.*L3.*L2/);
  });
});
