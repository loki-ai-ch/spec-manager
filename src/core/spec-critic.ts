import { findSpecByCode } from './spec-io.js';
import type { ProjectPaths } from './paths.js';
import type { AssistFinding, AssistSeverity, AssistSourceRef, SpecCritiqueReport } from './capability-types.js';
import { buildSectionAliasDiagnostics } from './spec-sections.js';
import { REQUIRED_SECTIONS } from './validate.js';

interface SectionRule {
  id: string;
  title: string;
  detail: string;
  severity: AssistSeverity;
  anyOf: string[];
}

const L1_RULES: SectionRule[] = [
  sectionRule('l1.background.missing', 'Missing background', 'Add a ## 背景 section explaining why this work exists.', 'blocking', ['背景', 'background']),
  sectionRule('l1.user_stories.missing', 'Missing user stories', 'Add a ## 用户故事 section with target users and outcomes.', 'blocking', ['用户故事', 'user stories', 'stories']),
  sectionRule('l1.acceptance.missing', 'Missing acceptance criteria', 'Add a ## 验收标准 section with concrete AC items.', 'blocking', ['验收标准', 'acceptance criteria']),
  sectionRule('l1.scope.missing', 'Missing scope boundary', 'Add a ## 范围边界 section that states in-scope and out-of-scope work.', 'blocking', ['范围边界', 'scope']),
  sectionRule('l1.metrics.missing', 'Missing metrics', 'Add a ## 度量指标 section so impact can be evaluated.', 'warning', ['度量指标', 'metrics']),
  sectionRule('l1.risks.missing', 'Missing risks', 'Add a risk section such as ## 风险与依赖 or ## 风险与缓解.', 'warning', ['风险', '风险与依赖', '风险与缓解', 'risks']),
];

const L2_RULES: SectionRule[] = [
  sectionRule('l2.overview.missing', 'Missing solution overview', 'Add a ## 方案概述 section describing the technical approach.', 'blocking', ['方案概述', 'overview']),
  sectionRule('l2.decisions.missing', 'Missing technical decisions', 'Add a ## 技术决策 section explaining key choices.', 'warning', ['技术决策', 'decisions']),
  sectionRule('l2.modules.missing', 'Missing affected modules', 'Add a ## 受影响模块 section with module boundaries.', 'blocking', ['受影响模块', 'affected modules', 'modules']),
  sectionRule('l2.contracts.missing', 'Missing interface contracts', 'Add a ## 接口契约 section with CLI/API/data contracts.', 'blocking', ['接口契约', 'contracts', 'interface contracts']),
  sectionRule('l2.tests.missing', 'Missing test strategy', 'Add a ## 测试策略 section.', 'warning', ['测试策略', 'test strategy']),
  sectionRule('l2.split.missing', 'Missing L3 split plan', 'Add a ## L3 裂变计划 section with implementation slices.', 'blocking', ['l3 裂变计划', 'l3 split', 'split plan']),
  sectionRule('l2.compat.missing', 'Missing compatibility notes', 'Add a ## 兼容性 section when behavior must remain stable.', 'warning', ['兼容性', 'compatibility']),
];

const L3_RULES: SectionRule[] = [
  sectionRule('l3.goals.missing', 'Missing goals', 'Add a ## 目标 section with implementation goals.', 'blocking', ['目标', 'goals']),
  sectionRule('l3.modules.missing', 'Missing affected modules', 'Add a ## 受影响模块 section or explain touched files.', 'warning', ['受影响模块', 'affected modules', 'modules']),
  sectionRule('l3.steps.missing', 'Missing implementation steps', 'Add a ## 实施步骤 section with file-level steps.', 'blocking', ['实施步骤', 'implementation steps']),
  sectionRule('l3.verification.missing', 'Missing verification commands', 'Add a ## 验证命令 section with executable checks.', 'blocking', ['验证命令', 'verification commands']),
  sectionRule('l3.rollback.missing', 'Missing rollback or risk handling', 'Add rollback or risk handling details.', 'warning', ['回滚', '风险与缓解', 'rollback', 'risks']),
];

export function buildSpecCritique(paths: ProjectPaths, specCode: string): SpecCritiqueReport {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  if (spec.fm.level !== 'L1' && spec.fm.level !== 'L2' && spec.fm.level !== 'L3') {
    throw new Error(`SPEC_CRITIQUE_UNSUPPORTED_LEVEL: ${spec.fm.level}`);
  }

  const sections = parseSections(spec.content);
  const sourceRef: AssistSourceRef = {
    kind: 'spec',
    id: spec.fm.code,
    path: spec.filePath,
    summary: spec.fm.title,
  };
  const findings = [
    ...rulesForLevel(spec.fm.level).flatMap(rule => sectionFinding(rule, sections, sourceRef)),
    ...sectionAliasFindings(spec.fm.level, spec.content, sourceRef),
    ...scopeFindings(spec.fm.level, spec.content, sourceRef),
    ...designPhilosophyFindings(spec.fm.level, [
      spec.fm.code,
      spec.fm.topic,
      spec.fm.title,
      spec.content,
    ].join('\n'), sourceRef),
  ];

  return {
    schemaVersion: 'spec-critique.v1',
    specCode: spec.fm.code,
    level: spec.fm.level,
    status: spec.fm.status,
    findings,
    summary: summarize(findings),
  };
}

export function parseSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  let current: string | null = null;
  let body: string[] = [];

  const flush = () => {
    if (current) sections.set(current, body.join('\n').trim());
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      flush();
      current = normalizeHeading(match[1]);
      body = [];
      continue;
    }
    if (current) body.push(line);
  }
  flush();
  return sections;
}

function sectionFinding(rule: SectionRule, sections: Map<string, string>, sourceRef: AssistSourceRef): AssistFinding[] {
  if (hasAnySection(sections, rule.anyOf)) return [];
  return [{
    id: rule.id,
    severity: rule.severity,
    title: rule.title,
    detail: rule.detail,
    sourceRefs: [sourceRef],
  }];
}

function sectionAliasFindings(level: 'L1' | 'L2' | 'L3', content: string, sourceRef: AssistSourceRef): AssistFinding[] {
  const required = REQUIRED_SECTIONS[level];
  return buildSectionAliasDiagnostics(content, required).map(diagnostic => ({
    id: `${level.toLowerCase()}.section_alias.${diagnostic.alias}`,
    severity: 'advisory',
    title: 'Section heading alias detected',
    detail: `${diagnostic.message} ${diagnostic.suggestion}`,
    sourceRefs: [sourceRef],
  }));
}

function scopeFindings(level: 'L1' | 'L2' | 'L3', content: string, sourceRef: AssistSourceRef): AssistFinding[] {
  if (level !== 'L3') return [];
  if (/不实现|不包括|禁止范围|不做|out[- ]of[- ]scope|not implement/i.test(content)) return [];
  return [{
    id: 'l3.scope.advisory',
    severity: 'advisory',
    title: 'Implementation exclusions are not explicit',
    detail: 'Consider stating what this L3 does not implement so agents do not expand scope.',
    sourceRefs: [sourceRef],
  }];
}

function designPhilosophyFindings(level: 'L1' | 'L2' | 'L3', content: string, sourceRef: AssistSourceRef): AssistFinding[] {
  if (level !== 'L2' && level !== 'L3') return [];
  if (!isDesignRelatedSpec(content)) return [];
  if (mentionsDesignPhilosophy(content)) return [];
  return [{
    id: 'design.philosophy.guidance.missing',
    severity: 'advisory',
    title: 'Design philosophy guidance is not explicit',
    detail: 'For UI/design-context work, state how agents should use DESIGN.md prose, specific inspiration, and do/don\'t constraints before applying tokens.',
    sourceRefs: [sourceRef],
  }];
}

function isDesignRelatedSpec(content: string): boolean {
  return /\b(ui|visual|style|styling|design-context|design context|DESIGN\.md|frontend)\b|设计|视觉|样式/i.test(content);
}

function mentionsDesignPhilosophy(content: string): boolean {
  return /prose-first|prose|do\/don't|do['’]s and don['’]ts|specific inspiration|negative constraints|DESIGN\.md prose|设计哲学|负约束/i.test(content);
}

function hasAnySection(sections: Map<string, string>, names: string[]): boolean {
  return names.some(name => {
    const normalized = normalizeHeading(name);
    for (const section of sections.keys()) {
      if (section === normalized || section.includes(normalized) || normalized.includes(section)) return true;
    }
    return false;
  });
}

function rulesForLevel(level: 'L1' | 'L2' | 'L3'): SectionRule[] {
  if (level === 'L1') return L1_RULES;
  if (level === 'L2') return L2_RULES;
  return L3_RULES;
}

function summarize(findings: AssistFinding[]): SpecCritiqueReport['summary'] {
  return {
    blocking: findings.filter(finding => finding.severity === 'blocking').length,
    warning: findings.filter(finding => finding.severity === 'warning').length,
    advisory: findings.filter(finding => finding.severity === 'advisory').length,
  };
}

function normalizeHeading(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[：:]+$/g, '')
    .replace(/\s+/g, ' ');
}

function sectionRule(
  id: string,
  title: string,
  detail: string,
  severity: AssistSeverity,
  anyOf: string[],
): SectionRule {
  return { id, title, detail, severity, anyOf };
}
