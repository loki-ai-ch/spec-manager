import { describe, it, expect } from 'vitest';
import { validateSpecContent, validatePlanJson } from '../validate.js';

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

## 受影响模块
modules

## 接口契约
contract

## L3 裂变计划
plan
`;
    expect(validateSpecContent('L2', content)).toEqual([]);
  });

  it('L3 完整正文无 warning', () => {
    const content = `# Auth Impl

## 目标
goal

## 实施步骤
steps

## 验证命令
vitest
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
});

describe('validatePlanJson — planJson 校验', () => {
  it('合法 planJson 无 warning', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'mcp_tool', name: 'read source file' },
        { stepNo: 2, stepType: 'llm_call', name: 'generate code' },
        { stepNo: 3, stepType: 'mcp_tool', name: 'run verify test' },
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
      stepType: 'mcp_tool',
      name: `step ${i + 1} do something`,
    }));
    const warnings = validatePlanJson({ steps });
    expect(warnings.some(w => w.rule === 'R11')).toBe(true);
  });

  it('steps 缺 stepNo 返回 INC-005 warning', () => {
    const plan = {
      steps: [{ stepType: 'mcp_tool', name: 'do something' }],
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
      steps: [{ stepNo: 1, stepType: 'mcp_tool' }],
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
      steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'do' }],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.message.includes('<5'))).toBe(true);
  });

  it('末步不含验证字样返回 R10 info', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'mcp_tool', name: 'read source file' },
        { stepNo: 2, stepType: 'llm_call', name: 'generate code' },
      ],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.rule === 'R10')).toBe(true);
  });

  it('末步含"验证"则无 R10 warning', () => {
    const plan = {
      steps: [
        { stepNo: 1, stepType: 'mcp_tool', name: 'read source file' },
        { stepNo: 2, stepType: 'mcp_tool', name: 'run verify tests' },
      ],
    };
    const warnings = validatePlanJson(plan);
    expect(warnings.some(w => w.rule === 'R10')).toBe(false);
  });
});
