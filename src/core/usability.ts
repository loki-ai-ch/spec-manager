import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_PROVIDER_INFO } from './agents.js';
import { readAudit } from './audit.js';
import { PLACEHOLDER_MARKER } from './constants.js';
import { listAllSpecs, type SpecRecord } from './spec-io.js';
import { listTasks, type TaskRecord } from './task.js';
import type { ProjectPaths } from './paths.js';
import type { SpecLevel } from './validate.js';

export type DoctorSeverity = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  status: DoctorSeverity;
  label: string;
  detail: string;
  action?: string;
}

export function runProjectDoctor(paths: ProjectPaths): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  checks.push(fileCheck(paths.isInitialized, '.spec-manager/', 'Project initialized', 'spec-manager project init'));
  checks.push(fileCheck(existsSync(paths.configFile), '.spec-manager/config.yaml', 'Config file present', 'spec-manager project init'));
  checks.push(fileCheck(existsSync(paths.auditFile), '.spec-manager/audit.json', 'Audit file present', 'spec-manager project init'));
  checks.push(fileCheck(existsSync(paths.specsDir), 'specs/', 'Specs directory present', 'spec-manager project init'));
  checks.push(fileCheck(existsSync(paths.changesDir), 'changes/', 'Changes directory present', 'spec-manager project init'));
  checks.push(fileCheck(existsSync(paths.archiveDir), 'archive/', 'Archive directory present', 'spec-manager project init'));

  const agentFiles = AGENT_PROVIDER_INFO.flatMap((p) => p.files);
  const installedAgentFiles = Array.from(new Set(agentFiles)).filter((f) => existsSync(join(paths.root, trimTrailingSlash(f))));
  checks.push({
    status: installedAgentFiles.length > 0 ? 'ok' : 'warn',
    label: 'AI agent instructions',
    detail: installedAgentFiles.length > 0 ? installedAgentFiles.join(', ') : 'No agent instruction files found',
    action: installedAgentFiles.length > 0 ? undefined : 'spec-manager project agents --provider all',
  });

  const claudeSkill = join(paths.root, '.claude', 'skills', 'spec-manager');
  if (existsSync(claudeSkill)) {
    checks.push(fileCheck(existsSync(join(claudeSkill, 'rules')), '.claude/skills/spec-manager/rules', 'Claude skill rules bundled', 'spec-manager project agents --provider claude --force'));
    checks.push(fileCheck(existsSync(join(claudeSkill, 'templates')), '.claude/skills/spec-manager/templates', 'Claude skill templates bundled', 'spec-manager project agents --provider claude --force'));
  }
  const codeBuddySkill = join(paths.root, '.codebuddy', 'skills', 'spec-manager');
  if (existsSync(codeBuddySkill)) {
    checks.push(fileCheck(existsSync(join(codeBuddySkill, 'rules')), '.codebuddy/skills/spec-manager/rules', 'CodeBuddy skill rules bundled', 'spec-manager project agents --provider codebuddy --force'));
    checks.push(fileCheck(existsSync(join(codeBuddySkill, 'templates')), '.codebuddy/skills/spec-manager/templates', 'CodeBuddy skill templates bundled', 'spec-manager project agents --provider codebuddy --force'));
  }

  const specs = paths.isInitialized ? listAllSpecs(paths) : [];
  const placeholders = specs.filter((s) => s.content.includes(PLACEHOLDER_MARKER));
  checks.push({
    status: placeholders.length === 0 ? 'ok' : 'warn',
    label: 'Spec placeholder content',
    detail: placeholders.length === 0 ? 'No placeholder specs' : placeholders.map((s) => s.fm.code).join(', '),
    action: placeholders.length === 0 ? undefined : 'spec-manager spec update <code> --content ./draft.md --ai-summary "..." --change-summary "..."',
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
    });
  }

  return checks;
}

function fileCheck(condition: boolean, detail: string, label: string, action?: string): DoctorCheck {
  return { status: condition ? 'ok' : 'fail', label, detail, action: condition ? undefined : action };
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
  const placeholder = specs.find((s) => s.content.includes(PLACEHOLDER_MARKER));
  if (placeholder) {
    return `spec-manager spec update ${placeholder.fm.code} --content ./draft.md --ai-summary "..." --change-summary "..."`;
  }
  const draft = specs.find((s) => s.fm.status === 'draft');
  if (draft) return `spec-manager spec confirm ${draft.fm.code}`;
  const confirmedL3 = specs.find((s) => s.fm.level === 'L3' && s.fm.status === 'confirmed');
  if (confirmedL3) return `spec-manager spec freeze ${confirmedL3.fm.code}`;
  const frozenL3 = specs.find((s) => s.fm.level === 'L3' && s.fm.status === 'frozen');
  if (frozenL3) {
    const task = tasks.find((t) => t.specCode === frozenL3.fm.code && t.status !== 'completed' && t.status !== 'failed');
    if (!task) return `spec-manager task create ${frozenL3.fm.code} --plan ./plan.json`;
    if (task.status === 'draft') return `spec-manager task start ${task.id} --spec ${task.specCode}`;
    if (task.status === 'running') return `spec-manager task step ${task.id} --spec ${task.specCode} --no <N> --status succeeded --output-json '{"summary":"..."}'`;
    if (task.status === 'waiting') return `Resolve wait reason, then spec-manager task start ${task.id} --spec ${task.specCode}`;
  }
  const confirmedNonL3 = specs.find((s) => (s.fm.level === 'L1' || s.fm.level === 'L2') && s.fm.status === 'confirmed');
  if (confirmedNonL3?.fm.level === 'L1') return `spec-manager spec new L2 --topic ${topic} --parent ${confirmedNonL3.fm.code} --title "..."`;
  if (confirmedNonL3?.fm.level === 'L2') return `spec-manager spec new L3 --topic ${topic} --parent ${confirmedNonL3.fm.code} --title "..."`;
  return 'No immediate action. Use spec-manager flow status for details.';
}

export function suggestAfterSpecCommand(spec: SpecRecord): string {
  if (spec.content.includes(PLACEHOLDER_MARKER)) {
    return `spec-manager spec update ${spec.fm.code} --content ./draft.md --ai-summary "..." --change-summary "init"`;
  }
  if (spec.fm.status === 'draft') return `Wait for user approval, then spec-manager spec confirm ${spec.fm.code}`;
  if (spec.fm.level === 'L3' && spec.fm.status === 'confirmed') return `Wait for user approval, then spec-manager spec freeze ${spec.fm.code}`;
  if (spec.fm.level === 'L3' && spec.fm.status === 'frozen') return `spec-manager task create ${spec.fm.code} --plan ./plan.json`;
  if (spec.fm.level === 'L1' && spec.fm.status === 'confirmed') return `spec-manager spec new L2 --topic ${spec.fm.topic} --parent ${spec.fm.code} --title "..."`;
  if (spec.fm.level === 'L2' && spec.fm.status === 'confirmed') return `spec-manager spec new L3 --topic ${spec.fm.topic} --parent ${spec.fm.code} --title "..."`;
  return 'spec-manager flow status';
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
