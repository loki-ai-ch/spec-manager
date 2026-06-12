import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import {
  applySpecRelationPolicy,
  applySpecStatusPolicy,
  applySpecUpdatePolicy,
  buildInitialSpecRecord,
  validateSpecParentPolicy,
  type CreateSpecPolicyInput,
  type UpdateSpecPolicyInput,
} from '../spec-policy.js';
import type { SpecFrontmatter, SpecRecord } from '../spec-io.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-spec-policy-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function spec(code: string, level: SpecFrontmatter['level'], status: SpecFrontmatter['status'], parentCode: string | null = null): SpecRecord {
  const topic = code.replace(/-L[0-3].*$/, '');
  return {
    fm: {
      code,
      level,
      title: code,
      topic,
      parentCode,
      status,
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    },
    content: `# ${code}\n`,
    filePath: join(paths.specsDir, topic, `${code}.md`),
  };
}

function createInput(overrides: Partial<CreateSpecPolicyInput>): CreateSpecPolicyInput {
  return {
    paths,
    code: 'auth-L2.1',
    level: 'L2',
    title: 'Auth design',
    topic: 'auth',
    parentCode: 'auth-L1',
    findSpecByCode: () => null,
    ...overrides,
  };
}

function updateInput(existing: SpecRecord, patch: UpdateSpecPolicyInput['patch'], allSpecs: SpecRecord[] = [existing]): UpdateSpecPolicyInput {
  return {
    paths,
    code: existing.fm.code,
    existing,
    patch,
    findSpecByCode: (_paths, code) => allSpecs.find(s => s.fm.code === code) ?? null,
  };
}

describe('spec policy create rules', () => {
  it('allows L2 under a confirmed L1', () => {
    const parent = spec('auth-L1', 'L1', 'confirmed');
    const input = createInput({ parentRecord: parent });

    const parentPolicy = validateSpecParentPolicy(input);
    const { record } = buildInitialSpecRecord(input, parentPolicy, '2026-01-02T00:00:00.000Z');

    expect(parentPolicy.parentFilePath).toBe(parent.filePath);
    expect(record.fm.code).toBe('auth-L2.1');
    expect(record.fm.status).toBe('draft');
    expect(record.filePath).toMatch(/auth-L2\.1\.md$/);
  });

  it('allows L3 under a confirmed L2', () => {
    const parent = spec('auth-L2.1', 'L2', 'confirmed', 'auth-L1');
    const input = createInput({
      code: 'auth-L3.1.1',
      level: 'L3',
      title: 'Auth implementation',
      parentCode: 'auth-L2.1',
      parentRecord: parent,
    });

    const parentPolicy = validateSpecParentPolicy(input);
    const { record } = buildInitialSpecRecord(input, parentPolicy);

    expect(record.fm.parentCode).toBe('auth-L2.1');
  });

  it('rejects L2 or L3 without parentCode with R7', () => {
    expect(() => validateSpecParentPolicy(createInput({ level: 'L2', parentCode: null }))).toThrow(/R7/);
    expect(() => validateSpecParentPolicy(createInput({ level: 'L3', parentCode: null }))).toThrow(/R7/);
  });

  it('rejects draft parent with R4', () => {
    expect(() => validateSpecParentPolicy(createInput({
      parentRecord: spec('auth-L1', 'L1', 'draft'),
    }))).toThrow(/R4/);
  });

  it('rejects L3 under L1 with R7', () => {
    expect(() => validateSpecParentPolicy(createInput({
      code: 'auth-L3.1.1',
      level: 'L3',
      parentCode: 'auth-L1',
      parentRecord: spec('auth-L1', 'L1', 'confirmed'),
    }))).toThrow(/R7.*L3.*L2/);
  });
});

describe('spec policy update rules', () => {
  it('updates content and aiSummary', () => {
    const existing = spec('auth-L1', 'L1', 'draft');

    const { record, warnings } = applySpecUpdatePolicy(updateInput(existing, {
      content: '# Updated\n',
      aiSummary: 'updated',
    }));

    expect(record.content).toBe('# Updated\n');
    expect(record.fm.aiSummary).toBe('updated');
    expect(warnings).toEqual([]);
  });

  it('truncates long aiSummary and returns a warning', () => {
    const existing = spec('auth-L1', 'L1', 'draft');
    const { record, warnings } = applySpecUpdatePolicy(updateInput(existing, {
      aiSummary: 'x'.repeat(301),
    }));

    expect(record.fm.aiSummary).toHaveLength(300);
    expect(warnings.some(w => w.includes('截断'))).toBe(true);
  });

  it('rejects content without aiSummary with R13', () => {
    expect(() => applySpecUpdatePolicy(updateInput(spec('auth-L1', 'L1', 'draft'), {
      content: '# Updated\n',
    }))).toThrow(/R13/);
  });

  it('rejects placeholder content with R22', () => {
    expect(() => applySpecUpdatePolicy(updateInput(spec('auth-L1', 'L1', 'draft'), {
      content: '# Auth\n\n<!-- 在此粘贴正文 -->\n',
      aiSummary: 'placeholder',
    }))).toThrow(/R22/);
  });
});

describe('spec policy relation rules', () => {
  it('adds a valid relation', () => {
    const existing = spec('auth-L1', 'L1', 'draft');
    const target = spec('billing-L1', 'L1', 'draft');
    const fm = { ...existing.fm };

    applySpecRelationPolicy(updateInput(existing, {
      addRelation: { type: 'references', target: 'billing-L1' },
    }, [existing, target]), fm);

    expect(fm.relations).toEqual([{ type: 'references', target: 'billing-L1' }]);
  });

  it('rejects invalid relation type', () => {
    const existing = spec('auth-L1', 'L1', 'draft');
    expect(() => applySpecRelationPolicy(updateInput(existing, {
      addRelation: { type: 'invalid', target: 'billing-L1' },
    }), { ...existing.fm })).toThrow(/RELATION_INVALID/);
  });

  it('rejects missing relation target', () => {
    const existing = spec('auth-L1', 'L1', 'draft');
    expect(() => applySpecRelationPolicy(updateInput(existing, {
      addRelation: { type: 'references', target: 'missing-L1' },
    }), { ...existing.fm })).toThrow(/RELATION_TARGET_NOT_FOUND/);
  });
});

describe('spec policy status rules', () => {
  it('rejects ordinary illegal transitions', () => {
    const existing = spec('auth-L1', 'L1', 'confirmed');
    expect(() => applySpecStatusPolicy(updateInput(existing, {
      status: 'implemented',
    }), { ...existing.fm }, [])).toThrow(/状态非法/);
  });

  it('allows authorized L3 implemented transition', () => {
    const existing = spec('auth-L3.1.1', 'L3', 'frozen', 'auth-L2.1');
    const fm = { ...existing.fm };

    applySpecStatusPolicy({
      ...updateInput(existing, { status: 'implemented' }),
      transitionAuthority: 'task-complete',
    }, fm, []);

    expect(fm.status).toBe('implemented');
  });
});
