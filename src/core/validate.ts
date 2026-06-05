/**
 * 验证 spec 正文的必填段，**只返回 warning，不 throw**。
 * 这是 MCP 版 doc_update 的 validateSpecSections 行为的直接复刻。
 *
 * 必填段定义:
 *   L1: 背景 / 用户故事 / 验收标准 / 范围边界
 *   L2: 方案概述 / 受影响模块 / 接口契约 / L3 裂变计划
 *   L3: 目标 / 实施步骤 / 验证命令
 *
 * 同时校验 RFC 2119 关键字（如果 L1/L2 内容包含"验收标准"段，则该段每条 AC 应含
 * SHALL/MUST/SHOULD 之一）。这是 OpenSpec 风格的强化。
 */

export type SpecLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface ValidationWarning {
  rule: string;          // 'missing_section' | 'rfc2119_missing' | ...
  level: 'info' | 'warn';
  message: string;
  section?: string;
}

const REQUIRED_SECTIONS: Record<SpecLevel, string[]> = {
  L0: ['愿景', '路线图'],
  L1: ['背景', '用户故事', '验收标准', '范围边界'],
  L2: ['方案概述', '受影响模块', '接口契约', 'L3 裂变计划'],
  L3: ['目标', '实施步骤', '验证命令'],
};

const RFC_2119_KEYWORDS = ['SHALL', 'MUST', 'SHOULD', 'MAY'];

export function validateSpecContent(level: SpecLevel, content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const required = REQUIRED_SECTIONS[level] ?? [];
  const sections = parseSections(content);

  for (const r of required) {
    if (!sections.some(s => s.heading === r)) {
      warnings.push({
        rule: 'missing_section',
        level: 'warn',
        message: `[${level}] 缺少必填段：## ${r}`,
        section: r,
      });
    }
  }

  // RFC 2119 校验：L1 验收标准段每条 AC 应含 SHALL/MUST/SHOULD
  if (level === 'L1') {
    const ac = sections.find(s => s.heading === '验收标准');
    if (ac) {
      const acLines = ac.body.split('\n').map(l => l.trim()).filter(l => /^\d+\.\s*\*\*AC-/.test(l));
      if (acLines.length === 0) {
        warnings.push({
          rule: 'no_ac_items',
          level: 'warn',
          message: '验收标准段未发现 AC 编号条目（应为 "1. **AC-1**: ..." 格式）',
          section: '验收标准',
        });
      } else {
        const without = acLines.filter(l => !RFC_2119_KEYWORDS.some(k => l.includes(k)));
        if (without.length > 0) {
          warnings.push({
            rule: 'rfc2119_missing',
            level: 'info',
            message: `${without.length}/${acLines.length} 条 AC 未使用 RFC 2119 关键字（SHALL/MUST/SHOULD/MAY）。建议标注约束级别。`,
            section: '验收标准',
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * 校验 planJson（来自 templates/agent-plan.json 模板）。
 * INC-005 教训：禁止用 no/type/desc，必须 stepNo/stepType/name。
 */
export interface PlanStep {
  stepNo: number | string;
  stepType: 'llm_call' | 'mcp_tool' | 'human_gate';
  name: string;
}

export interface PlanJson {
  steps: PlanStep[];
}

export function validatePlanJson(plan: unknown): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  if (!plan || typeof plan !== 'object') {
    warnings.push({ rule: 'plan_invalid', level: 'warn', message: 'planJson 不是对象' });
    return warnings;
  }
  const p = plan as Record<string, unknown>;
  if (!Array.isArray(p.steps)) {
    warnings.push({ rule: 'plan_no_steps', level: 'warn', message: 'planJson.steps 不是数组' });
    return warnings;
  }
  const steps = p.steps as Array<Record<string, unknown>>;
  if (steps.length === 0) {
    warnings.push({ rule: 'plan_empty', level: 'warn', message: 'planJson.steps 为空' });
  }
  if (steps.length > 20) {
    warnings.push({
      rule: 'R11',
      level: 'warn',
      message: `R11: planJson 步骤数 ${steps.length} 超过上限 20，需拆分 L3`,
    });
  }
  for (const [i, s] of steps.entries()) {
    if (!('stepNo' in s)) {
      warnings.push({ rule: 'plan_field', level: 'warn', message: `steps[${i}] 缺 stepNo（INC-005: 禁止用 no）` });
    }
    if (!('stepType' in s)) {
      warnings.push({ rule: 'plan_field', level: 'warn', message: `steps[${i}] 缺 stepType（INC-005: 禁止用 type）` });
    } else {
      const t = String(s.stepType);
      if (!['llm_call', 'mcp_tool', 'human_gate'].includes(t)) {
        warnings.push({ rule: 'plan_field', level: 'warn', message: `steps[${i}].stepType="${t}" 不在 [llm_call, mcp_tool, human_gate]` });
      }
    }
    if (!('name' in s)) {
      warnings.push({ rule: 'plan_field', level: 'warn', message: `steps[${i}] 缺 name（INC-005: 禁止用 desc）` });
    } else {
      const n = String(s.name);
      if (n.length < 5) {
        warnings.push({ rule: 'plan_field', level: 'warn', message: `steps[${i}].name 长度 <5，建议含 verb+object+file` });
      }
    }
  }
  // R10: 末步建议是验证
  if (steps.length > 0) {
    const last = steps[steps.length - 1];
    const lastName = String(last.name ?? '').toLowerCase();
    if (!/(验证|verify|test|check|curl|gradle|mvn|pytest|vitest)/.test(lastName)) {
      warnings.push({
        rule: 'R10',
        level: 'info',
        message: 'R10: planJson 末步建议含 "验证" 字样或等价验证命令',
      });
    }
  }
  return warnings;
}

interface Section { heading: string; body: string; }

function parseSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1], body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}
