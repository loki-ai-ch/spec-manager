import { describe, it, expect } from 'vitest';
import { PlanJsonSchema } from '../../schemas/spec.js';
import { buildSectionAliasDiagnostics } from '../spec-sections.js';
import {
  buildPlanJsonDiagnostics,
  extractPlanJsonFromSpecContent,
  formatPlanJsonDiagnostics,
  validateSpecContent,
  validatePlanJson,
} from '../validate.js';

describe('validateSpecContent — 必填段校验', () => {
  it('L1 完整正文无 warning', () => {
    const content = `# Auth

## 背景
some background

## 用户故事
As a user...

## 验收标准
1. **AC-1**: 系统 SHALL 支持登录
2. **AC-2**: 系统 MUST 验证密码

## 范围边界
scope
`;
    expect(validateSpecContent('L1', content)).toEqual([]);
  });

  it('L1 缺段返回 warning', () => {
    const content = `# Auth

## 背景
some
`;
    const warnings = validateSpecContent('L1', content);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.some(w => w.section === '用户故事')).toBe(true);
    expect(warnings.some(w => w.section === '验收标准')).toBe(true);
    expect(warnings.some(w => w.section === '范围边界')).toBe(true);
  });

  it('L1 验收标准缺 RFC 2119 关键字', () => {
    const content = `# Auth

## 背景
bg

## 用户故事
story

## 验收标准
1. **AC-1**: 系统支持登录

## 范围边界
scope
`;
    const warnings = validateSpecContent('L1', content);
    expect(warnings.some(w => w.rule === 'rfc2119_missing')).toBe(true);
  });

  it('L2 完整正文无 warning', () => {
    const content = `# Auth Design

## 方案概述
overview

## 技术决策
decisions

## 受影响模块
modules

## 接口契约
contract

## L3 裂变计划
plan

## 复用清单
\`src/core/auth.ts\`
`;
    expect(validateSpecContent('L2', content)).toEqual([]);
  });

  it('L2 退化为 todolist 时返回 R17 warning', () => {
    const content = `# Auth Design

## 方案概述
- [ ] TODO: task 1
- [ ] TODO: task 2
- [ ] 待办 task 3

## 技术决策
none

## 受影响模块
modules

## 接口契约
contract

## L3 裂变计划
plan
`;
    const warnings = validateSpecContent('L2', content);
    expect(warnings.some(w => w.rule === 'R17')).toBe(true);
  });

  it('跨层引用不用 spec code 时返回 R14 warning', () => {
    const content = `# Auth Design

## 方案概述
overview

## 技术决策
decisions

## 受影响模块
\`src/core/auth.ts\`

## 接口契约
contract

## L3 裂变计划
plan

## 关联
- 父 L1: 用户认证需求
`;
    const warnings = validateSpecContent('L2', content);
    expect(warnings.some(w => w.rule === 'R14')).toBe(true);
  });

  it('scope-split L2 未批量列出子 L3 时返回 R20 warning', () => {
    const content = `# Auth Design

## 方案概述
scope-split

## 技术决策
decisions

## 受影响模块
\`src/core/auth.ts\`

## 接口契约
contract

## L3 裂变计划
只有一个任务
`;
    const warnings = validateSpecContent('L2', content);
    expect(warnings.some(w => w.rule === 'R20')).toBe(true);
  });

  it('L3 完整正文无 warning', () => {
    const content = `# Auth Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
vitest

## 代码调查
\`src/core/auth.ts\`
`;
    expect(validateSpecContent('L3', content)).toEqual([]);
  });

  it('L3 缺段返回 warning', () => {
    const content = `# Auth Impl

## 目标
goal
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.section === '实施步骤')).toBe(true);
    expect(warnings.some(w => w.section === '验证命令')).toBe(true);
  });

  it('L3 alias 段名返回 section_alias warning 且不放行缺失规范段', () => {
    const content = `# Auth Impl

## 目标
goal

## 实施计划
steps

## 验证方式
npm test

## 代码调查
\`src/core/auth.ts\`
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'missing_section', section: '实施步骤' }),
      expect.objectContaining({ rule: 'missing_section', section: '验证命令' }),
      expect.objectContaining({ rule: 'section_alias', section: '实施步骤' }),
      expect.objectContaining({ rule: 'section_alias', section: '验证命令' }),
    ]));
    expect(buildSectionAliasDiagnostics(content, ['目标', '实施步骤', '验证命令']).map(item => item.alias))
      .toEqual(['实施计划', '验证方式']);
  });

  it('规范段名存在时不返回 alias diagnostic', () => {
    const content = `# Auth Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
npm test

## 代码调查
\`src/core/auth.ts\`
`;
    expect(buildSectionAliasDiagnostics(content, ['目标', '实施步骤', '验证命令'])).toEqual([]);
    expect(validateSpecContent('L3', content).some(warning => warning.rule === 'section_alias')).toBe(false);
  });

  it('L3 缺代码调查依据时返回 R23 warning', () => {
    const content = `# Auth Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
vitest
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.rule === 'R23')).toBe(true);
  });

  it('L0 缺段返回 warning', () => {
    const content = `# Vision
`;
    const warnings = validateSpecContent('L0', content);
    expect(warnings.some(w => w.section === '愿景')).toBe(true);
    expect(warnings.some(w => w.section === '路线图')).toBe(true);
  });

  it('L1 验收标准无 AC 编号条目时 warning', () => {
    const content = `# Auth

## 背景
bg

## 用户故事
story

## 验收标准
just some text without AC numbering

## 范围边界
scope
`;
    const warnings = validateSpecContent('L1', content);
    expect(warnings.some(w => w.rule === 'no_ac_items')).toBe(true);
  });

  it('正文包含 placeholder marker 时返回 warning', () => {
    const content = `# Auth

## 背景
bg

## 用户故事
story

## 验收标准
1. **AC-1**: 系统 SHALL 支持登录

## 范围边界
scope

<!-- 在此粘贴正文 -->
`;
    const warnings = validateSpecContent('L1', content);
    expect(warnings.some(w => w.rule === 'placeholder_marker')).toBe(true);
  });

  it('完整正文引用 placeholder marker 示例时不返回 warning', () => {
    const content = `# Placeholder validation

## 背景
This complete specification documents placeholder validation behavior across validate, guide, flow, and doctor.

## 用户故事
As a maintainer, I want examples such as <!-- 在此粘贴正文 --> to remain valid documentation.

## 验收标准
1. **AC-1**: Given a complete specification, When it references the marker, Then validation SHALL not report a placeholder.

## 范围边界
The real scaffold marker in a short, otherwise empty specification remains blocked by R22.
`;
    const warnings = validateSpecContent('L1', content);
    expect(warnings.some(w => w.rule === 'placeholder_marker')).toBe(false);
  });
});

describe('validateSpecContent — critical acceptance criteria', () => {
  it('accepts L3 critical AC references that exist in acceptance criteria', () => {
    const content = `# Impl

## 目标
\`src/core/task.ts\`

## 实施步骤
steps

## 验收标准
1. **AC-1**: Given x, When y, Then z SHALL happen.
2. AC-2 Given x, When y, Then z SHALL happen.
3. @verify: file-exists(src/core/task.ts)

## 关键验收标准
- AC-1
- AC-2

## 验证命令
\`\`\`bash
npm test
\`\`\`
`;

    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.rule === 'unknown_critical_ac')).toBe(false);
  });

  it('warns when critical AC references an unknown AC', () => {
    const content = `# Impl

## 目标
\`src/core/task.ts\`

## 实施步骤
steps

## 验收标准
1. **AC-1**: Given x, When y, Then z SHALL happen.

## 关键验收标准
- AC-2

## 验证命令
\`\`\`bash
npm test
\`\`\`
`;

    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.rule === 'unknown_critical_ac' && w.message.includes('AC-2'))).toBe(true);
  });

  it('warns when non-L3 specs define critical AC', () => {
    const content = `# Auth

## 背景
bg

## 用户故事
story

## 验收标准
1. **AC-1**: 系统 SHALL 支持登录

## 关键验收标准
- AC-1

## 范围边界
scope
`;

    const warnings = validateSpecContent('L1', content);
    expect(warnings.some(w => w.rule === 'critical_ac_non_l3')).toBe(true);
  });
});

describe('validateSpecContent — @verify 语法校验', () => {
  it('L3 合法 @verify 行无 warning', () => {
    const content = `# Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
npm test
\`\`\`

## 验收标准
1. **AC-1**: 用户 SHALL 能创建 spec
2. @verify: file-exists(src/core/verify.ts)
3. @verify: export-exists(src/core/verify.ts, parseVerifyRules)
4. @verify: command(npm test)

## 代码调查
\`src/core/verify.ts\`
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings.filter(w => w.rule.startsWith('verify_'))).toEqual([]);
  });

  it('L3 未知 @verify 类型返回 unknown_verify_type warning', () => {
    const content = `# Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
npm test
\`\`\`

## 验收标准
1. @verify: unknown-type(arg)

## 代码调查
\`src/core/verify.ts\`
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.rule === 'unknown_verify_type')).toBe(true);
  });

  it('L3 @verify 参数数量错误返回 verify_arity_mismatch warning', () => {
    const content = `# Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
npm test
\`\`\`

## 验收标准
1. @verify: file-exists(a, b)

## 代码调查
\`src/core/verify.ts\`
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.rule === 'verify_arity_mismatch')).toBe(true);
  });

  it('L3 @verify 格式错误返回 verify_syntax_error warning', () => {
    const content = `# Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
npm test
\`\`\`

## 验收标准
1. @verify: bad format here

## 代码调查
\`src/core/verify.ts\`
`;
    const warnings = validateSpecContent('L3', content);
    expect(warnings.some(w => w.rule === 'verify_syntax_error')).toBe(true);
  });

  it('L1/L2 spec 含 @verify 行不触发校验', () => {
    const l1 = `# Auth

## 背景
bg

## 用户故事
story

## 验收标准
1. @verify: file-exists(x.ts)

## 范围边界
scope
`;
    const warnings = validateSpecContent('L1', l1);
    expect(warnings.some(w => w.rule === 'verify_syntax_error' || w.rule === 'unknown_verify_type')).toBe(false);

    const l2 = `# Design

## 方案概述
overview

## 技术决策
decisions

## 受影响模块
modules

## 接口契约
contract

## L3 裂变计划
plan

## 验收标准
1. @verify: file-exists(x.ts)
`;
    const warnings2 = validateSpecContent('L2', l2);
    expect(warnings2.some(w => w.rule === 'verify_syntax_error' || w.rule === 'unknown_verify_type')).toBe(false);
  });
});

describe('extractPlanJsonFromSpecContent', () => {
  it('extracts planJson from the final plan section', () => {
    const plan = extractPlanJsonFromSpecContent(`# Impl

## step_report 模板

\`\`\`json
{"taskId":"T-001"}
\`\`\`

## planJson (final)

\`\`\`json
{
  "coveredSpecs": ["auth-L3.1.1-login"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 auth-L3.1.1-login 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "验证 npm test"}
  ]
}
\`\`\`
`);

    expect(plan).toEqual({
      coveredSpecs: ['auth-L3.1.1-login'],
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: '读取 auth-L3.1.1-login 并检查 templates/agent-plan.json' },
        { stepNo: 2, stepType: 'tool_action', name: '验证 npm test' },
      ],
    });
  });

  it('throws PLAN_JSON_MISSING when the final plan section is absent', () => {
    expect(() => extractPlanJsonFromSpecContent('# Impl\n')).toThrow(/PLAN_JSON_MISSING/);
  });

  it('throws PLAN_JSON_INVALID when the json block cannot be parsed', () => {
    expect(() => extractPlanJsonFromSpecContent(`## planJson (final)

\`\`\`json
{ invalid
\`\`\`
`)).toThrow(/PLAN_JSON_INVALID/);
  });
});

describe('validatePlanJson — planJson 校验', () => {
  it('builds actionable diagnostics for legacy plan step fields', () => {
    const diagnostics = buildPlanJsonDiagnostics({
      coveredSpecs: ['auth-L3.1.1'],
      steps: [{ no: 1, type: 'tool_action', desc: 'run verify test' }],
    }, 'auth-L3.1.1');

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'steps[0].stepNo',
        message: expect.stringContaining('legacy field "no"'),
        suggestion: expect.stringContaining('stepNo'),
      }),
      expect.objectContaining({
        path: 'steps[0].stepType',
        message: expect.stringContaining('legacy field "type"'),
        suggestion: expect.stringContaining('stepType'),
      }),
      expect.objectContaining({
        path: 'steps[0].name',
        message: expect.stringContaining('legacy field "desc"'),
        suggestion: expect.stringContaining('name'),
      }),
    ]));
    expect(formatPlanJsonDiagnostics(diagnostics)).toContain('Minimal valid planJson example');
  });

  it('builds actionable diagnostics for invalid stepType and missing coveredSpecs', () => {
    const diagnostics = buildPlanJsonDiagnostics({
      steps: [{ stepNo: 1, stepType: 'bad', name: 'run verify test' }],
    }, 'auth-L3.1.1');

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'steps[0].stepType',
        message: expect.stringContaining('bad'),
        suggestion: expect.stringContaining('tool_action'),
      }),
      expect.objectContaining({
        path: 'coveredSpecs',
        suggestion: expect.stringContaining('auth-L3.1.1'),
      }),
    ]));
  });

  it('normalizes legacy stepType mcp_tool to tool_action', () => {
    const parsed = PlanJsonSchema.parse({
      steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'run verify test' }],
    });

    expect(parsed.steps[0].stepType).toBe('tool_action');
  });

  it('does not warn for legacy stepType mcp_tool', () => {
    const warnings = validatePlanJson({
      steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'run verify test' }],
    });

    expect(warnings.some(w => w.message.includes('mcp_tool') && w.message.includes('不在'))).toBe(false);
  });

  it('合法 planJson 无 warning', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'read source file' },
        { stepNo: 2, stepType: 'llm_call', name: 'generate code' },
        { stepNo: 3, stepType: 'tool_action', name: 'run verify test' },
      ],
    };
    expect(validatePlanJson(plan)).toEqual([]);
  });

  it('非对象返回 warning', () => {
    const warnings = validatePlanJson(null);
    expect(warnings.some(w => w.rule === 'plan_invalid')).toBe(true);
  });

  it('steps 非数组返回 warning', () => {
    const warnings = validatePlanJson({ steps: 'not-array' });
    expect(warnings.some(w => w.rule === 'plan_no_steps')).toBe(true);
  });

  it('steps 为空返回 warning', () => {
    const warnings = validatePlanJson({ steps: [] });
    expect(warnings.some(w => w.rule === 'plan_empty')).toBe(true);
  });

  it('steps 超过 20 返回 R11 warning', () => {
    const steps = Array.from({ length: 21 }, (_, i) => ({
      stepNo: i + 1,
      stepType: 'tool_action',
      name: `step ${i + 1} do something`,
    }));
    const warnings = validatePlanJson({ steps });
    expect(warnings.some(w => w.rule === 'R11')).toBe(true);
  });

  it('steps 缺 stepNo 返回 INC-005 warning', () => {
    const plan = {
      steps: [{ stepType: 'tool_action', name: 'do something' }],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.message.includes('stepNo'))).toBe(true);
  });

  it('steps 缺 stepType 返回 INC-005 warning', () => {
    const plan = {
      steps: [{ stepNo: 1, name: 'do something' }],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.message.includes('stepType'))).toBe(true);
  });

  it('steps 缺 name 返回 INC-005 warning', () => {
    const plan = {
      steps: [{ stepNo: 1, stepType: 'tool_action' }],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.message.includes('name'))).toBe(true);
  });

  it('stepType 非法值返回 warning', () => {
    const plan = {
      steps: [{ stepNo: 1, stepType: 'unknown', name: 'do something' }],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.message.includes('unknown'))).toBe(true);
  });

  it('name 长度 <5 返回 warning', () => {
    const plan = {
      steps: [{ stepNo: 1, stepType: 'tool_action', name: 'do' }],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.message.includes('<5'))).toBe(true);
  });

  it('末步不含验证字样返回 R10 info', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'read source file' },
        { stepNo: 2, stepType: 'llm_call', name: 'generate code' },
      ],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.rule === 'R10')).toBe(true);
  });

  it('末步含"验证"则无 R10 warning', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'read source file' },
        { stepNo: 2, stepType: 'tool_action', name: 'run verify tests' },
      ],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.rule === 'R10')).toBe(false);
  });

  it('修改类 plan 前两步未调研时返回 R8 warning', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'edit source file' },
        { stepNo: 2, stepType: 'tool_action', name: 'run verify tests' },
      ],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.rule === 'R8')).toBe(true);
  });
});
