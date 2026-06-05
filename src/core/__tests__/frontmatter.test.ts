import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFrontmatter, writeFrontmatter, writeFrontmatterAtomic } from '../frontmatter.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-fm-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('writeFrontmatter / readFrontmatter roundtrip', () => {
  it('基本 roundtrip', () => {
    const data = { code: 'auth-L1', level: 'L1', title: 'Auth', status: 'draft' };
    const content = '# Auth\n\nSome content.\n';
    const output = writeFrontmatter(data, content);
    const filePath = join(root, 'test.md');
    const { writeFileSync } = require('node:fs');
    writeFileSync(filePath, output, 'utf8');
    const result = readFrontmatter(filePath);
    expect(result.data.code).toBe('auth-L1');
    expect(result.data.level).toBe('L1');
    expect(result.data.title).toBe('Auth');
    expect(result.content.trim()).toBe('# Auth\n\nSome content.');
  });

  it('数组字段 roundtrip', () => {
    const data = { code: 'x', coveredTasks: ['T-001', 'T-002'], relations: [{ type: 'implements', target: 'y' }] };
    const output = writeFrontmatter(data, 'body');
    const filePath = join(root, 'arr.md');
    const { writeFileSync } = require('node:fs');
    writeFileSync(filePath, output, 'utf8');
    const result = readFrontmatter(filePath);
    expect(result.data.coveredTasks).toEqual(['T-001', 'T-002']);
    expect(result.data.relations).toEqual([{ type: 'implements', target: 'y' }]);
  });

  it('null 字段 roundtrip', () => {
    const data = { code: 'x', parentCode: null };
    const output = writeFrontmatter(data, 'body');
    const filePath = join(root, 'null.md');
    const { writeFileSync } = require('node:fs');
    writeFileSync(filePath, output, 'utf8');
    const result = readFrontmatter(filePath);
    expect(result.data.parentCode).toBeNull();
  });

  it('特殊字符 roundtrip', () => {
    const data = { code: 'x', title: 'Title with "quotes" and : colons' };
    const output = writeFrontmatter(data, 'body');
    const filePath = join(root, 'special.md');
    const { writeFileSync } = require('node:fs');
    writeFileSync(filePath, output, 'utf8');
    const result = readFrontmatter(filePath);
    expect(result.data.title).toBe('Title with "quotes" and : colons');
  });

  it('空 content', () => {
    const data = { code: 'x' };
    const output = writeFrontmatter(data, '');
    const filePath = join(root, 'empty.md');
    const { writeFileSync } = require('node:fs');
    writeFileSync(filePath, output, 'utf8');
    const result = readFrontmatter(filePath);
    expect(result.data.code).toBe('x');
  });
});

describe('writeFrontmatterAtomic — 原子写', () => {
  it('创建目录并写入', () => {
    const filePath = join(root, 'sub', 'deep', 'test.md');
    writeFrontmatterAtomic(filePath, { code: 'x', level: 'L1' }, '# Title\n');
    expect(existsSync(filePath)).toBe(true);
    const result = readFrontmatter(filePath);
    expect(result.data.code).toBe('x');
  });

  it('覆盖已有文件', () => {
    const filePath = join(root, 'overwrite.md');
    writeFrontmatterAtomic(filePath, { code: 'old' }, 'old content');
    writeFrontmatterAtomic(filePath, { code: 'new' }, 'new content');
    const result = readFrontmatter(filePath);
    expect(result.data.code).toBe('new');
    expect(result.content).toContain('new content');
  });
});

describe('stripUndefined — undefined 字段过滤', () => {
  it('undefined 值不出现在输出中', () => {
    const data = { code: 'x', title: 'T', aiSummary: undefined, milestone: undefined };
    const output = writeFrontmatter(data, 'body');
    expect(output).not.toContain('aiSummary');
    expect(output).not.toContain('milestone');
    expect(output).toContain('code: x');
  });

  it('嵌套对象中的 undefined 被过滤', () => {
    const data = { code: 'x', nested: { a: 1, b: undefined } };
    const output = writeFrontmatter(data, 'body');
    const filePath = join(root, 'nested.md');
    const { writeFileSync } = require('node:fs');
    writeFileSync(filePath, output, 'utf8');
    const result = readFrontmatter(filePath);
    expect(result.data.nested).toEqual({ a: 1 });
  });
});
