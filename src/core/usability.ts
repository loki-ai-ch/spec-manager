import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { AGENT_PROVIDER_INFO, detectAgentProviders, inspectManagedAgentAssets } from './agents.js';
import { readAudit } from './audit.js';
import { findSpecByCode, isPlaceholderContent, listAllSpecs, type SpecRecord } from './spec-io.js';
import { listTasks, type TaskRecord } from './task.js';
import type { ProjectPaths } from './paths.js';
import { REQUIRED_SECTIONS, type SpecLevel } from './validate.js';
import { inspectProjectIntegrity } from './integrity.js';
import { assessImplementationReadiness } from './lifecycle.js';

export type DoctorSeverity = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  status: DoctorSeverity;
  label: string;
  detail: string;
  action?: string;
  blocking?: boolean;
}

export function runProjectDoctor(paths: ProjectPaths, packageRoot?: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  checks.push(fileCheck(paths.isInitialized, '.spec-manager/', 'Project initialized', 'spec-manager project init', true));
  checks.push(fileCheck(existsSync(paths.configFile), '.spec-manager/config.yaml', 'Config file present', 'spec-manager project init', true));
  checks.push(fileCheck(existsSync(paths.auditFile), '.spec-manager/audit.json', 'Audit file present', 'spec-manager project init', true));
  checks.push(fileCheck(existsSync(paths.specsDir), 'specs/', 'Specs directory present', 'spec-manager project init', true));
  checks.push(fileCheck(existsSync(paths.changesDir), 'changes/', 'Changes directory present', 'spec-manager project init', true));
  checks.push(fileCheck(existsSync(paths.archiveDir), 'archive/', 'Archive directory present', 'spec-manager project init', true));

  const agentFiles = AGENT_PROVIDER_INFO.flatMap((p) => p.files);
  const installedAgentFiles = Array.from(new Set(agentFiles)).filter((f) => existsSync(join(paths.root, trimTrailingSlash(f))));
  checks.push({
    status: installedAgentFiles.length > 0 ? 'ok' : 'warn',
    label: 'AI agent instructions',
    detail: installedAgentFiles.length > 0 ? installedAgentFiles.join(', ') : 'No agent instruction files found',
    action: installedAgentFiles.length > 0 ? undefined : 'spec-manager project agents --provider all',
    blocking: false,
  });

  const claudeSkill = join(paths.root, '.claude', 'skills', 'spec-manager');
  if (existsSync(claudeSkill)) {
    checks.push(fileCheck(existsSync(join(claudeSkill, 'rules')), '.claude/skills/spec-manager/rules', 'Claude skill rules bundled', 'spec-manager project agents --provider claude --sync-managed --dry-run', false));
    checks.push(fileCheck(existsSync(join(claudeSkill, 'templates')), '.claude/skills/spec-manager/templates', 'Claude skill templates bundled', 'spec-manager project agents --provider claude --sync-managed --dry-run', false));
  }
  const codeBuddySkill = join(paths.root, '.codebuddy', 'skills', 'spec-manager');
  if (existsSync(codeBuddySkill)) {
    checks.push(fileCheck(existsSync(join(codeBuddySkill, 'rules')), '.codebuddy/skills/spec-manager/rules', 'CodeBuddy skill rules bundled', 'spec-manager project agents --provider codebuddy --sync-managed --dry-run', false));
    checks.push(fileCheck(existsSync(join(codeBuddySkill, 'templates')), '.codebuddy/skills/spec-manager/templates', 'CodeBuddy skill templates bundled', 'spec-manager project agents --provider codebuddy --sync-managed --dry-run', false));
  }
  if (packageRoot) {
    const detected = detectAgentProviders(paths);
    if (detected.providers.length > 0) {
      const managed = inspectManagedAgentAssets(paths, packageRoot, detected.providers);
      const problemCount = managed.missing.length + managed.drifted.length;
      checks.push({
        status: problemCount === 0 ? 'ok' : 'warn',
        label: 'Managed agent assets',
        detail: problemCount === 0
          ? 'Installed managed assets match bundled sources'
          : `${managed.missing.length} missing, ${managed.drifted.length} drifted: ${[...managed.missing, ...managed.drifted].slice(0, 3).join(', ')}`,
        action: problemCount === 0 ? undefined : `spec-manager project agents --provider ${detected.providers.join(',')} --sync-managed --dry-run`,
        blocking: false,
      });
    }
  }

  const specs = paths.isInitialized ? listAllSpecs(paths) : [];
  const placeholders = specs.filter((s) => isPlaceholderContent(s.content));
  checks.push({
    status: placeholders.length === 0 ? 'ok' : 'warn',
    label: 'Spec placeholder content',
    detail: placeholders.length === 0 ? 'No placeholder specs' : placeholders.map((s) => s.fm.code).join(', '),
    action: placeholders.length === 0 ? undefined : 'spec-manager spec update <code> --content ./draft.md --ai-summary "..." --change-summary "..."',
    blocking: false,
  });

  try {
    readAudit(paths);
    checks.push({ status: 'ok', label: 'Audit readable', detail: paths.auditFile });
  } catch (err) {
    checks.push({
      status: 'fail',
      label: 'Audit readable',
      detail: err instanceof Error ? err.message : String(err),
      action: 'Check .spec-manager/audit.json permissions or recreate it',
      blocking: true,
    });
  }

  if (paths.isInitialized) {
    const issues = inspectProjectIntegrity(paths);
    checks.push({
      status: issues.length === 0 ? 'ok' : 'warn',
      label: 'Repository integrity',
      detail: issues.length === 0 ? 'No integrity issues' : `${issues.length} issue(s): ${issues.slice(0, 3).map(issue => issue.message).join('; ')}`,
      action: issues.length === 0 ? undefined : 'Review project doctor output and repair issues explicitly',
      blocking: false,
    });
  }

  return checks;
}

function fileCheck(condition: boolean, detail: string, label: string, action?: string, blocking?: boolean): DoctorCheck {
  return { status: condition ? 'ok' : 'fail', label, detail, action: condition ? undefined : action, blocking };
}

export function isBlockingDoctorCheck(check: DoctorCheck): boolean {
  if (check.status === 'ok') return false;
  if (check.blocking !== undefined) return check.blocking;
  return check.status === 'fail' && isCoreProjectCheckLabel(check.label);
}

function isCoreProjectCheckLabel(label: string): boolean {
  return [
    'Project initialized',
    'Config file present',
    'Audit file present',
    'Specs directory present',
    'Changes directory present',
    'Archive directory present',
    'Audit readable',
  ].includes(label);
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export interface TopicFlow {
  topic: string;
  specs: SpecRecord[];
  tasks: TaskRecord[];
  nextAction: string;
}

export type GuideFormat = 'text' | 'rich';

export function getFlowStatus(paths: ProjectPaths, opts?: { topic?: string }): TopicFlow[] {
  const specs = listAllSpecs(paths).filter((s) => !opts?.topic || s.fm.topic === opts.topic);
  const topics = new Set(specs.map((s) => s.fm.topic));
  if (opts?.topic) topics.add(opts.topic);

  return [...topics].sort().map((topic) => {
    const topicSpecs = specs.filter((s) => s.fm.topic === topic).sort(compareSpecRecords);
    const tasks = listTasks(paths, { topic });
    return {
      topic,
      specs: topicSpecs,
      tasks,
      nextAction: suggestNextActionForTopic(topic, topicSpecs, tasks),
    };
  });
}

export function suggestNextActionForTopic(topic: string, specs: SpecRecord[], tasks: TaskRecord[]): string {
  if (specs.length === 0) {
    return `spec-manager spec new L1 --topic ${topic} --title "..."`;
  }
  const placeholder = specs.find((s) => isPlaceholderContent(s.content));
  if (placeholder) {
    return `spec-manager spec update ${placeholder.fm.code} --content ./draft.md --ai-summary "..." --change-summary "..."`;
  }
  const draft = specs.find((s) => s.fm.status === 'draft');
  if (draft) return `spec-manager spec confirm ${draft.fm.code}`;
  const confirmedL3 = specs.find((s) => s.fm.level === 'L3' && s.fm.status === 'confirmed');
  if (confirmedL3) return appendAdvice(`spec-manager spec freeze ${confirmedL3.fm.code}`, getUpstreamFreezeAdviceForSpecs(specs, confirmedL3));
  const frozenL3 = specs.find((s) => s.fm.level === 'L3' && s.fm.status === 'frozen');
  if (frozenL3) {
    const task = tasks.find((t) => t.specCode === frozenL3.fm.code && t.status !== 'completed' && t.status !== 'failed');
    if (!task) return appendAdvice(`spec-manager task create ${frozenL3.fm.code} --plan ./plan.json`, getUpstreamFreezeAdviceForSpecs(specs, frozenL3));
    if (task.status === 'draft') return `spec-manager task start ${task.id} --spec ${task.specCode}`;
    if (task.status === 'running') return `spec-manager task step ${task.id} --spec ${task.specCode} --no <N> --status succeeded --output-json '{"summary":"..."}'`;
    if (task.status === 'waiting') return `Resolve wait reason, then spec-manager task start ${task.id} --spec ${task.specCode}`;
  }
  const confirmedNonL3 = specs.find((s) => s.fm.level === 'L2' && s.fm.status === 'confirmed')
    ?? specs.find((s) => s.fm.level === 'L1' && s.fm.status === 'confirmed');
  if (confirmedNonL3) {
    const children = specs.filter(spec => spec.fm.parentCode === confirmedNonL3.fm.code);
    if (children.length === 0) {
      if (confirmedNonL3.fm.level === 'L1') return `spec-manager spec new L2 --topic ${topic} --parent ${confirmedNonL3.fm.code} --title "..."`;
      return `spec-manager spec new L3 --topic ${topic} --parent ${confirmedNonL3.fm.code} --title "..."`;
    }
    if (assessImplementationReadinessForSpecs(specs, confirmedNonL3.fm.code)) {
      return 'spec-manager project reconcile --dry-run';
    }
  }
  return 'No immediate action. Use spec-manager flow status for details.';
}

export function suggestAfterSpecCommand(spec: SpecRecord, paths?: ProjectPaths): string {
  if (isPlaceholderContent(spec.content)) {
    return `spec-manager spec update ${spec.fm.code} --content ./draft.md --ai-summary "..." --change-summary "init"`;
  }
  if (spec.fm.status === 'draft') {
    const outcome = spec.fm.level === 'L3' ? 'frozen' : 'confirmed';
    return `Wait for user approval, then spec-manager spec confirm ${spec.fm.code} (${spec.fm.status} -> ${outcome})`;
  }
  if (spec.fm.level === 'L3' && spec.fm.status === 'confirmed') {
    return appendAdvice(
      `Wait for user approval, then spec-manager spec freeze ${spec.fm.code}`,
      paths ? getUpstreamFreezeAdvice(paths, spec) : [],
    );
  }
  if (spec.fm.level === 'L3' && spec.fm.status === 'frozen') {
    return appendAdvice(
      `spec-manager task create ${spec.fm.code} --plan ./plan.json`,
      paths ? getUpstreamFreezeAdvice(paths, spec) : [],
    );
  }
  if ((spec.fm.level === 'L1' || spec.fm.level === 'L2') && spec.fm.status === 'confirmed') {
    if (!paths) return 'spec-manager flow status';
    const specs = listAllSpecs(paths);
    const children = specs.filter(child => child.fm.parentCode === spec.fm.code);
    if (children.length === 0) {
      return spec.fm.level === 'L1'
        ? `spec-manager spec new L2 --topic ${spec.fm.topic} --parent ${spec.fm.code} --title "..."`
        : `spec-manager spec new L3 --topic ${spec.fm.topic} --parent ${spec.fm.code} --title "..."`;
    }
    if (assessImplementationReadiness(paths, spec.fm.code, 'project-reconcile').ready) {
      return 'spec-manager project reconcile --dry-run';
    }
  }
  return 'spec-manager flow status';
}

export function getUpstreamFreezeAdvice(paths: ProjectPaths, spec: SpecRecord): string[] {
  return getUpstreamFreezeAdviceForSpecs(listAllSpecs(paths), spec);
}

function getUpstreamFreezeAdviceForSpecs(specs: SpecRecord[], spec: SpecRecord): string[] {
  if (spec.fm.level !== 'L3') return [];
  const advice: string[] = [];
  let parentCode = spec.fm.parentCode;
  while (parentCode) {
    const upstream = specs.find((s) => s.fm.code === parentCode);
    if (!upstream) break;
    if (upstream.fm.status !== 'confirmed' && upstream.fm.status !== 'implemented') {
      advice.push(`Upstream ${upstream.fm.code} is ${upstream.fm.status}; L1/L2 must be confirmed for task completion to cascade.`);
    }
    parentCode = upstream.fm.parentCode;
  }
  return advice;
}

function assessImplementationReadinessForSpecs(specs: SpecRecord[], specCode: string): boolean {
  const spec = specs.find(item => item.fm.code === specCode);
  if (!spec || spec.fm.status !== 'confirmed' || (spec.fm.level !== 'L1' && spec.fm.level !== 'L2')) return false;
  const children = specs.filter(item => item.fm.parentCode === specCode);
  return children.length > 0 && children.every(child => child.fm.status === 'implemented');
}

function appendAdvice(command: string, advice: string[]): string {
  if (advice.length === 0) return command;
  return [command, ...advice.map((line) => `Advice: ${line}`)].join('\n');
}

export function readProjectContext(paths: ProjectPaths): string {
  try {
    const raw = readFileSync(paths.configFile, 'utf8');
    const parsed = parseYaml(raw) as Record<string, unknown> | null;
    const context = parsed?.context;
    return typeof context === 'string' ? context.trim() : '';
  } catch {
    return '';
  }
}

export function renderRichGuide(paths: ProjectPaths, packageRoot: string, request: string): string {
  const matchedSpec = findSpecForRequest(paths, request);
  const topic = matchedSpec?.fm.topic ?? inferTopicFromRequest(request) ?? '<topic>';
  const flow = getFlowStatus(paths, { topic })[0];
  const nextCommand = matchedSpec
    ? suggestAfterSpecCommand(matchedSpec, paths)
    : flow?.nextAction ?? `spec-manager spec new L1 --topic ${topic} --title "..."`;

  return [
    renderTag('task', renderGuideTask(matchedSpec, request)),
    renderTag('project_context', readProjectContext(paths) || '(none)'),
    renderTag('parent_context', renderParentContext(paths, matchedSpec)),
    renderTag('rules', renderGuideRules()),
    renderTag('required_sections', renderRequiredSections(matchedSpec)),
    renderTag('template', renderGuideTemplate(packageRoot, matchedSpec)),
    renderTag('next_command', nextCommand),
  ].join('\n');
}

function compareSpecRecords(a: SpecRecord, b: SpecRecord): number {
  return a.fm.code.localeCompare(b.fm.code);
}

export function renderTemplate(packageRoot: string, level: SpecLevel | 'agent-plan', title?: string): string {
  const fileName = level === 'agent-plan' ? 'agent-plan.json' : `${level}-prd.md`;
  const actual = level === 'L2' ? 'L2-design.md' : level === 'L3' ? 'L3-impl.md' : fileName;
  const raw = readFileSync(join(packageRoot, 'templates', actual), 'utf8');
  return raw.replaceAll('{{title}}', title ?? 'Untitled');
}

function findSpecForRequest(paths: ProjectPaths, request: string): SpecRecord | null {
  const exact = request.trim();
  if (exact) {
    const found = findSpecByCode(paths, exact);
    if (found) return found;
  }
  const specs = listAllSpecs(paths);
  return specs.find((spec) => request.includes(spec.fm.code)) ?? null;
}

function inferTopicFromRequest(input: string): string | null {
  const first = input.toLowerCase().match(/[a-z0-9][a-z0-9-]*/)?.[0];
  return first ?? null;
}

function renderGuideTask(spec: SpecRecord | null, request: string): string {
  if (spec) return `为 ${spec.fm.code} 编写/推进 ${spec.fm.level} spec: ${spec.fm.title}`;
  return request ? `处理请求: ${request}` : '检查当前项目状态并给出下一步';
}

function renderParentContext(paths: ProjectPaths, spec: SpecRecord | null): string {
  if (!spec?.fm.parentCode) return '(none)';
  const parent = findSpecByCode(paths, spec.fm.parentCode);
  if (!parent) return `parent spec: ${spec.fm.parentCode} (not found)`;
  return [
    `parent spec: ${parent.fm.code}`,
    `title: ${parent.fm.title}`,
    `status: ${parent.fm.status}`,
    `aiSummary: ${parent.fm.aiSummary || '(empty)'}`,
  ].join('\n');
}

function renderGuideRules(): string {
  return [
    'R1: 写完 spec 内容后必须停下等待用户审核。',
    'R2: confirm/freeze 是用户审核动作，不由 AI 自行推进。',
    'R13: spec update --content 必须同时提供 aiSummary。',
    'R22: 占位正文必须替换为真实内容。',
  ].join('\n');
}

function renderRequiredSections(spec: SpecRecord | null): string {
  if (!spec) return '(unknown until a spec code is provided)';
  return REQUIRED_SECTIONS[spec.fm.level].map((section) => `## ${section}`).join('\n');
}

function renderGuideTemplate(packageRoot: string, spec: SpecRecord | null): string {
  if (!spec) return '(unknown until a spec code is provided)';
  return renderTemplate(packageRoot, spec.fm.level, spec.fm.title);
}

function renderTag(name: string, body: string): string {
  return `<${name}>\n${body}\n</${name}>`;
}
