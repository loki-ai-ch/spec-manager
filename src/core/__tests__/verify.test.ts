import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseVerifyRules, executeVerifyRules, splitArgs } from '../verify.js';

describe('parseVerifyRules', () => {
  it('解析 file-exists 规则', () => {
    const md = `## 验收标准

1. **AC-1**: 用户 SHALL 能创建 spec
2. @verify: file-exists(src/cli/spec.ts)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'file-exists', path: 'src/cli/spec.ts' }]);
  });

  it('解析 export-exists 规则', () => {
    const md = `## 验收标准

1. @verify: export-exists(src/core/spec-io.ts, findSpecByCode)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'export-exists', file: 'src/core/spec-io.ts', symbol: 'findSpecByCode' }]);
  });

  it('解析 command 规则', () => {
    const md = `## 验收标准

1. @verify: command(npm run lint)
2. @verify: command(npm test)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([
      { type: 'command', cmd: 'npm run lint' },
      { type: 'command', cmd: 'npm test' },
    ]);
  });

  it('解析 design-lint 规则', () => {
    const md = `## 验收标准

1. @verify: design-lint(DESIGN.md)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'design-lint', path: 'DESIGN.md' }]);
  });

  it('混合解析三种规则', () => {
    const md = `## 验收标准

1. **AC-1**: 用户 SHALL 能创建 spec
2. @verify: file-exists(src/core/verify.ts)
3. @verify: export-exists(src/core/verify.ts, parseVerifyRules)
4. @verify: command(npm test)
5. **AC-2**: 其他文字描述
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toHaveLength(3);
    expect(rules[0]).toEqual({ type: 'file-exists', path: 'src/core/verify.ts' });
    expect(rules[1]).toEqual({ type: 'export-exists', file: 'src/core/verify.ts', symbol: 'parseVerifyRules' });
    expect(rules[2]).toEqual({ type: 'command', cmd: 'npm test' });
  });

  it('非验收标准段内的 @verify 行被忽略', () => {
    const md = `## 目标

@verify: file-exists(src/index.ts)

## 验收标准

1. @verify: file-exists(src/core/verify.ts)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'file-exists', path: 'src/core/verify.ts' }]);
  });

  it('未知规则类型跳过', () => {
    const md = `## 验收标准

1. @verify: unknown-rule(arg)
2. @verify: file-exists(src/index.ts)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'file-exists', path: 'src/index.ts' }]);
  });

  it('参数数量不匹配跳过', () => {
    const md = `## 验收标准

1. @verify: file-exists(a, b)
2. @verify: export-exists(a)
3. @verify: file-exists(ok.ts)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'file-exists', path: 'ok.ts' }]);
  });

  it('空内容返回空数组', () => {
    expect(parseVerifyRules('', '验收标准')).toEqual([]);
    expect(parseVerifyRules('## 其他段\nnothing', '验收标准')).toEqual([]);
  });

  it('命令中包含 && 不影响解析', () => {
    const md = `## 验收标准

1. @verify: command(npm run lint && npm test)
`;
    const rules = parseVerifyRules(md, '验收标准');
    expect(rules).toEqual([{ type: 'command', cmd: 'npm run lint && npm test' }]);
  });
});

describe('executeVerifyRules', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'verify-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('file-exists: 存在的文件 → passed=true', () => {
    writeFileSync(path.join(tmpDir, 'exists.ts'), 'export const x = 1;');
    const results = executeVerifyRules([{ type: 'file-exists', path: 'exists.ts' }], tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('exists');
  });

  it('file-exists: 不存在的文件 → passed=false', () => {
    const results = executeVerifyRules([{ type: 'file-exists', path: 'nope.ts' }], tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('not found');
  });

  it('export-exists: 存在且有导出 → passed=true', () => {
    writeFileSync(path.join(tmpDir, 'mod.ts'), 'export function hello() { return 1; }\nexport const world = 2;');
    const results = executeVerifyRules(
      [{ type: 'export-exists', file: 'mod.ts', symbol: 'hello' }],
      tmpDir,
    );
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('hello exported from mod.ts');
  });

  it('export-exists: 存在但无导出 → passed=false', () => {
    writeFileSync(path.join(tmpDir, 'mod.ts'), 'function internal() {}');
    const results = executeVerifyRules(
      [{ type: 'export-exists', file: 'mod.ts', symbol: 'internal' }],
      tmpDir,
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('not found in exports');
  });

  it('export-exists: 文件不存在 → passed=false', () => {
    const results = executeVerifyRules(
      [{ type: 'export-exists', file: 'nope.ts', symbol: 'foo' }],
      tmpDir,
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('not found');
  });

  it('export-exists: 匹配 export {} 块', () => {
    writeFileSync(path.join(tmpDir, 'mod.ts'), 'function hello() {}\nexport { hello };');
    const results = executeVerifyRules(
      [{ type: 'export-exists', file: 'mod.ts', symbol: 'hello' }],
      tmpDir,
    );
    expect(results[0].passed).toBe(true);
  });

  it('export-exists: 匹配 export const', () => {
    writeFileSync(path.join(tmpDir, 'mod.ts'), 'export const myFunc = () => {};');
    const results = executeVerifyRules(
      [{ type: 'export-exists', file: 'mod.ts', symbol: 'myFunc' }],
      tmpDir,
    );
    expect(results[0].passed).toBe(true);
  });

  it('export-exists: 匹配 export type', () => {
    writeFileSync(path.join(tmpDir, 'mod.ts'), 'export type MyType = { x: number };');
    const results = executeVerifyRules(
      [{ type: 'export-exists', file: 'mod.ts', symbol: 'MyType' }],
      tmpDir,
    );
    expect(results[0].passed).toBe(true);
  });

  it('command: exit 0 → passed=true', () => {
    const results = executeVerifyRules([{ type: 'command', cmd: 'echo ok' }], tmpDir);
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('exit 0');
  });

  it('command: exit 1 → passed=false', () => {
    const results = executeVerifyRules([{ type: 'command', cmd: 'exit 1' }], tmpDir);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('exit 1');
  });

  it('多个规则混合执行', () => {
    writeFileSync(path.join(tmpDir, 'a.ts'), 'export const x = 1;');
    const rules = [
      { type: 'file-exists' as const, path: 'a.ts' },
      { type: 'file-exists' as const, path: 'b.ts' },
      { type: 'command' as const, cmd: 'echo ok' },
    ];
    const results = executeVerifyRules(rules, tmpDir);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[2].passed).toBe(true);
  });

  it('design-lint: valid DESIGN.md → passed=true', () => {
    writeFileSync(path.join(tmpDir, 'DESIGN.md'), validDesign('Valid'));
    const results = executeVerifyRules([{ type: 'design-lint', path: 'DESIGN.md' }], tmpDir);
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('lint passed');
    expect(results[0].message).toContain('errors=0');
  });

  it('design-lint: missing DESIGN.md → passed=false', () => {
    const results = executeVerifyRules([{ type: 'design-lint', path: 'DESIGN.md' }], tmpDir);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('DESIGN.md not found');
  });

  it('design-lint: broken token reference → passed=false', () => {
    writeFileSync(path.join(tmpDir, 'DESIGN.md'), [
      '---',
      'name: Broken',
      'colors:',
      '  primary: "{colors.missing}"',
      '---',
      '',
      '## Overview',
      '',
      'Broken design.',
    ].join('\n'));

    const results = executeVerifyRules([{ type: 'design-lint', path: 'DESIGN.md' }], tmpDir);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('errors=1');
    expect(results[0].message).toContain('Broken token reference');
  });

  it('design-lint: warning-only DESIGN.md → passed=true', () => {
    writeFileSync(path.join(tmpDir, 'DESIGN.md'), [
      '# Untokened design',
      '',
      '## Overview',
      '',
      'No YAML here.',
    ].join('\n'));

    const results = executeVerifyRules([{ type: 'design-lint', path: 'DESIGN.md' }], tmpDir);
    expect(results[0].passed).toBe(true);
    expect(results[0].message).toContain('errors=0');
    expect(results[0].message).toContain('warnings=1');
  });
});

describe('splitArgs', () => {
  it('单参数', () => {
    expect(splitArgs('src/index.ts')).toEqual(['src/index.ts']);
  });

  it('双参数', () => {
    expect(splitArgs('src/core/spec-io.ts, findSpecByCode')).toEqual(['src/core/spec-io.ts', 'findSpecByCode']);
  });

  it('含空格的参数被 trim', () => {
    expect(splitArgs(' a , b ')).toEqual(['a', 'b']);
  });

  it('含嵌套括号', () => {
    expect(splitArgs('npm run lint && echo ok')).toEqual(['npm run lint && echo ok']);
  });
});

function validDesign(name: string): string {
  return [
    '---',
    `name: ${name}`,
    'colors:',
    '  primary: "#1A1C1E"',
    '---',
    '',
    '## Overview',
    '',
    'Valid design.',
  ].join('\n');
}
