/**
 * 验证 spec 正文的必填段，**只返回 warning，不 throw**。
 * 这是 MCP 版 doc_update 的 validateSpecSections 行为的直接复刻。
 *
 * 必填段定义:
 *   L1: 背景 / 用户故事 / 验收标准 / 范围边界
 *   L2: 方案概述 / 技术决策 / 受影响模块 / 接口契约 / L3 裂变计划
 *   L3: 目标 / 实施步骤 / 验证命令
 *
 * 同时校验 RFC 2119 关键字（如果 L1/L2 内容包含"验收标准"段，则该段每条 AC 应含
 * SHALL/MUST/SHOULD 之一）。这是 OpenSpec 风格的强化。
 */

import { isPlaceholderContent } from './placeholder.js';
import { sectionBody, validateCriticalAcceptanceCriteria } from './spec-sections.js';
import { splitArgs, VERIFY_RE, VERIFY_TYPE_ARITY } from './verify.js';

const SPEC_CODE_INLINE_RE = /\b[a-z0-9][a-z0-9-]*-L[0-3](?:\.\d+)*(?:-(?!\d{8}\b)[a-z0-9][a-z0-9-]*)?\b/;

export type SpecLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface ValidationWarning {
  rule: string;          // 'missing_section' | 'rfc2119_missing' | ...
  level: 'info' | 'warn';
  message: string;
  section?: string;
}

export const REQUIRED_SECTIONS: Record<SpecLevel, string[]> = {
  L0: ['愿景', '路线图'],
  L1: ['背景', '用户故事', '验收标准', '范围边界'],
  L2: ['方案概述', '技术决策', '受影响模块', '接口契约', 'L3 裂变计划'],
  L3: ['目标', '实施步骤', '验证命令'],
};

const RFC_2119_KEYWORDS = ['SHALL', 'MUST', 'SHOULD', 'MAY'];

export function validateSpecContent(level: SpecLevel, content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const required = REQUIRED_SECTIONS[level] ?? [];
  const sections = parseSections(content);

  if (isPlaceholderContent(content)) {
    warnings.push({
      rule: 'placeholder_marker',
      level: 'warn',
      message: 'contentTemplate 仍包含占位标记，请使用 spec-manager spec update <code> --content <file> --ai-summary "..."',
    });
  }

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

  // R17: L2 是架构拆解,不是任务清单。这里做 warning-only 的结构味道检查。
  if (level === 'L2') {
    const checklistLines = content.split('\n').filter(l => /^\s*[-*]\s+\[[ xX]\]/.test(l)).length;
    const todoLines = content.split('\n').filter(l => /\b(TODO|todo)\b|待办|任务清单/.test(l)).length;
    if (checklistLines + todoLines >= 3) {
      warnings.push({
        rule: 'R17',
        level: 'warn',
        message: 'R17: L2 应描述架构拆解、技术决策和接口契约，不应退化为 todolist',
      });
    }

    if (/scope-split|scope split|范围拆分/.test(content)) {
      const splitPlan = sections.find(s => s.heading === 'L3 裂变计划');
      const plannedChildren = splitPlan?.body.match(/\bL3[-\s.]\d*/g)?.length ?? 0;
      if (plannedChildren < 2) {
        warnings.push({
          rule: 'R20',
          level: 'warn',
          message: 'R20: scope-split L2 必须在 L3 裂变计划中批量列出子 L3',
          section: 'L3 裂变计划',
        });
      }
    }
  }

  const crossLayerLines = content.split('\n').filter(l => /(父\s*L[0-3]|父级|上层|下层|based_on|implements|references|supersedes)/i.test(l));
  const crossLayerWithoutCode = crossLayerLines.filter(l => !SPEC_CODE_INLINE_RE.test(l));
  if (crossLayerWithoutCode.length > 0) {
    warnings.push({
      rule: 'R14',
      level: 'warn',
      message: `R14: ${crossLayerWithoutCode.length} 行跨层引用未使用 spec code，跨层引用只写 code 不复述正文`,
    });
  }

  if (level === 'L2' || level === 'L3') {
    const hasCodeEvidence = /`(?:src|app|lib|frontend|backend|tests?|specs?)\/[^`]+`|(?:src|app|lib|frontend|backend|tests?|specs?)\/[\w./-]+|代码调查|实际代码|现有代码|复用清单/.test(content);
    if (!hasCodeEvidence) {
      warnings.push({
        rule: 'R23',
        level: 'warn',
        message: 'R23: Spec 写作前必须基于实际代码；正文应包含代码调查、现有代码路径或复用清单',
      });
    }
  }

  // @verify 语法校验（仅 L3）
  if (level === 'L3') {
    const ac = sections.find(s => s.heading === '验收标准');
    if (ac) {
      for (const line of ac.body.split('\n')) {
        const trimmed = line.trim();
        if (!/@verify:/.test(trimmed)) continue;

        const m = VERIFY_RE.exec(trimmed);
        if (!m) {
          warnings.push({
            rule: 'verify_syntax_error',
            level: 'warn',
            message: `@verify 行格式不正确: "${trimmed}" — 期望 @verify: type(arg1, ...)`,
            section: '验收标准',
          });
          continue;
        }
        const [, type, argsStr] = m;
        const argCount = splitArgs(argsStr).length;
        if (!(type in VERIFY_TYPE_ARITY)) {
          warnings.push({
            rule: 'unknown_verify_type',
            level: 'warn',
            message: `未知 @verify 类型: "${type}" — 支持: file-exists, export-exists, command`,
            section: '验收标准',
          });
        } else if (argCount !== VERIFY_TYPE_ARITY[type]) {
          warnings.push({
            rule: 'verify_arity_mismatch',
            level: 'warn',
            message: `@verify: ${type}() 参数数量错误: 期望 ${VERIFY_TYPE_ARITY[type]}，实际 ${argCount}`,
            section: '验收标准',
          });
        }
      }
    }
    const critical = validateCriticalAcceptanceCriteria(content);
    for (const id of critical.unknown) {
      warnings.push({
        rule: 'unknown_critical_ac',
        level: 'warn',
        message: `关键验收标准引用了不存在的 AC: ${id}`,
        section: '关键验收标准',
      });
    }
  } else if (sectionBody(content, '关键验收标准')) {
    warnings.push({
      rule: 'critical_ac_non_l3',
      level: 'warn',
      message: '关键验收标准段仅应出现在 L3 spec 中',
      section: '关键验收标准',
    });
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
  const mutatingStep = steps.find(s => /(edit|write|create|modify|implement|fix|patch|修改|创建|实现|修复|写入|编辑)/i.test(String(s.name ?? '')));
  if (mutatingStep) {
    const firstTwo = steps.slice(0, 2).map(s => String(s.name ?? '')).join(' ');
    if (!/(read|inspect|research|survey|grep|rg|调研|读取|走读|检查|搜索)/i.test(firstTwo)) {
      warnings.push({
        rule: 'R8',
        level: 'warn',
        message: 'R8: 改代码前必须调研；含修改类步骤的 planJson 前两步应包含读取/搜索/调研',
      });
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

export function extractPlanJsonFromSpecContent(content: string): unknown {
  const heading = content.match(/^##\s+planJson \(final\)\s*$/im);
  if (!heading || heading.index === undefined) {
    throw new Error('PLAN_JSON_MISSING: 未找到 ## planJson (final) 段');
  }

  const afterHeading = content.slice(heading.index + heading[0].length);
  const nextHeading = afterHeading.search(/^##\s+/m);
  const section = nextHeading >= 0 ? afterHeading.slice(0, nextHeading) : afterHeading;
  const block = section.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!block) {
    throw new Error('PLAN_JSON_MISSING: ## planJson (final) 段缺少 ```json 代码块');
  }

  try {
    return JSON.parse(block[1]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`PLAN_JSON_INVALID: ${detail}`);
  }
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
