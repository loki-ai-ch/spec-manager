import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { ProjectPaths } from './paths.js';

export const AGENT_PROVIDERS = ['claude', 'codex', 'opencode', 'codebuddy', 'cursor', 'windsurf'] as const;

export type AgentProvider = (typeof AGENT_PROVIDERS)[number];
export type AgentProviderSelection = AgentProvider | 'all';

export interface AgentProviderInfo {
  provider: AgentProvider;
  aliases: string[];
  files: string[];
  description: string;
  notes: string[];
  installSteps: AgentInstallStep[];
}

export type AgentInstallStep =
  | { kind: 'template'; source: string; target: string }
  | { kind: 'directory'; source: string; target: string };

export interface InstallAgentSupportOptions {
  paths: ProjectPaths;
  packageRoot: string;
  providers: AgentProviderSelection[];
  force?: boolean;
  dryRun?: boolean;
}

export interface AgentInstallReport {
  providers: AgentProvider[];
  dryRun: boolean;
  created: string[];
  overwritten: string[];
  skipped: string[];
  notes: string[];
}

export interface AgentProviderDetection {
  providers: AgentProvider[];
  reasons: Partial<Record<AgentProvider, string[]>>;
}

export const AGENT_PROVIDER_INFO: AgentProviderInfo[] = [
  {
    provider: 'claude',
    aliases: ['claude', 'claude-code'],
    files: ['CLAUDE.md', '.claude/skills/spec-manager/'],
    description: 'Claude Code project instructions and spec-manager skill.',
    notes: ['Claude Code can invoke the spec-manager skill with /spec-manager.'],
    installSteps: [
      { kind: 'template', source: 'templates/agents/CLAUDE.md', target: 'CLAUDE.md' },
      { kind: 'directory', source: 'skill', target: '.claude/skills/spec-manager' },
      { kind: 'directory', source: 'rules', target: '.claude/skills/spec-manager/rules' },
      { kind: 'directory', source: 'templates', target: '.claude/skills/spec-manager/templates' },
    ],
  },
  {
    provider: 'codex',
    aliases: ['codex', 'openai-codex'],
    files: ['AGENTS.md'],
    description: 'Codex project instructions via AGENTS.md.',
    notes: ['Codex reads project instructions from AGENTS.md.'],
    installSteps: [
      { kind: 'template', source: 'templates/agents/AGENTS.md', target: 'AGENTS.md' },
    ],
  },
  {
    provider: 'opencode',
    aliases: ['opencode', 'open-code', 'open code'],
    files: ['AGENTS.md'],
    description: 'OpenCode project instructions via AGENTS.md.',
    notes: ['OpenCode reads AGENTS.md and also falls back to CLAUDE.md when AGENTS.md is absent.'],
    installSteps: [
      { kind: 'template', source: 'templates/agents/AGENTS.md', target: 'AGENTS.md' },
    ],
  },
  {
    provider: 'codebuddy',
    aliases: ['codebuddy', 'code-buddy', 'code buddy', 'cbc'],
    files: ['CODEBUDDY.md', '.codebuddy/skills/spec-manager/'],
    description: 'CodeBuddy project instructions and spec-manager skill.',
    notes: ['CodeBuddy reads CODEBUDDY.md and auto-discovers .codebuddy/skills/spec-manager.'],
    installSteps: [
      { kind: 'template', source: 'templates/agents/CODEBUDDY.md', target: 'CODEBUDDY.md' },
      {
        kind: 'template',
        source: 'templates/agents/codebuddy-skill/SKILL.md',
        target: '.codebuddy/skills/spec-manager/SKILL.md',
      },
      { kind: 'directory', source: 'skill/subskills', target: '.codebuddy/skills/spec-manager/subskills' },
      { kind: 'directory', source: 'rules', target: '.codebuddy/skills/spec-manager/rules' },
      { kind: 'directory', source: 'templates', target: '.codebuddy/skills/spec-manager/templates' },
    ],
  },
  {
    provider: 'cursor',
    aliases: ['cursor'],
    files: ['.cursorrules'],
    description: 'Cursor project rules via .cursorrules.',
    notes: ['Cursor reads project rules from .cursorrules.'],
    installSteps: [
      { kind: 'template', source: 'templates/agents/CURSOR.md', target: '.cursorrules' },
    ],
  },
  {
    provider: 'windsurf',
    aliases: ['windsurf'],
    files: ['.windsurfrules'],
    description: 'Windsurf project rules via .windsurfrules.',
    notes: ['Windsurf reads project rules from .windsurfrules.'],
    installSteps: [
      { kind: 'template', source: 'templates/agents/WINDSURF.md', target: '.windsurfrules' },
    ],
  },
];

export function parseAgentProviders(input: string): AgentProviderSelection[] {
  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return ['all'];
  const providers = parts.map(normalizeAgentProvider);
  return providers.includes('all') ? ['all'] : providers;
}

export function normalizeAgentProvider(input: string): AgentProviderSelection {
  const key = input.toLowerCase().trim().replace(/[\s_-]+/g, '-');
  if (key === 'all' || key === '*') return 'all';
  const provider = AGENT_PROVIDER_INFO.find((info) =>
    info.aliases.map((alias) => alias.toLowerCase().replace(/[\s_-]+/g, '-')).includes(key),
  );
  if (provider) return provider.provider;
  throw new Error(
    `unsupported AI provider: ${input}. Use one of: all, ${AGENT_PROVIDERS.join(', ')}`,
  );
}

export function expandAgentProviders(providers: AgentProviderSelection[]): AgentProvider[] {
  if (providers.includes('all')) return [...AGENT_PROVIDERS];
  const out: AgentProvider[] = [];
  for (const provider of providers) {
    if (provider === 'all') continue;
    if (!out.includes(provider)) out.push(provider);
  }
  return out;
}

export function listAgentProviders(): AgentProviderInfo[] {
  return AGENT_PROVIDER_INFO;
}

export function detectAgentProviders(paths: ProjectPaths): AgentProviderDetection {
  const reasons: Partial<Record<AgentProvider, string[]>> = {};

  for (const info of AGENT_PROVIDER_INFO) {
    for (const file of info.files) {
      const relPath = file.replace(/\/+$/, '');
      if (!existsSync(join(paths.root, ...relPath.split('/')))) continue;
      reasons[info.provider] = reasons[info.provider] ?? [];
      if (!reasons[info.provider]?.includes(relPath)) {
        reasons[info.provider]?.push(relPath);
      }
    }
  }

  return {
    providers: AGENT_PROVIDERS.filter((provider) => (reasons[provider]?.length ?? 0) > 0),
    reasons,
  };
}

export function installAgentSupport(options: InstallAgentSupportOptions): AgentInstallReport {
  const providers = expandAgentProviders(options.providers);
  const report: AgentInstallReport = {
    providers,
    dryRun: Boolean(options.dryRun),
    created: [],
    overwritten: [],
    skipped: [],
    notes: [],
  };

  const installedTargets = new Set<string>();
  for (const provider of providers) {
    const config = providerConfig(provider);
    for (const step of config.installSteps) {
      if (installedTargets.has(step.target)) continue;
      installedTargets.add(step.target);
      applyInstallStep(options, report, step);
    }
    report.notes.push(...config.notes);
  }

  return report;
}

function providerConfig(provider: AgentProvider): AgentProviderInfo {
  const config = AGENT_PROVIDER_INFO.find((p) => p.provider === provider);
  if (!config) throw new Error(`unsupported AI provider: ${provider}`);
  return config;
}

function applyInstallStep(
  options: InstallAgentSupportOptions,
  report: AgentInstallReport,
  step: AgentInstallStep,
): void {
  if (step.kind === 'template') {
    writeTemplate(options, report, step.source, step.target);
  } else {
    copyDirectory(
      options,
      report,
      join(options.packageRoot, ...step.source.split('/')),
      join(options.paths.root, ...step.target.split('/')),
    );
  }
}

function writeTemplate(
  options: InstallAgentSupportOptions,
  report: AgentInstallReport,
  templateRelPath: string,
  targetRelPath: string,
): void {
  const source = join(options.packageRoot, ...templateRelPath.split('/'));
  const target = join(options.paths.root, ...targetRelPath.split('/'));
  const content = readFileSync(source, 'utf8');
  writeManagedFile(options, report, target, content);
}

function writeManagedFile(
  options: InstallAgentSupportOptions,
  report: AgentInstallReport,
  target: string,
  content: string,
): void {
  const path = displayPath(options.paths, target);
  const existed = existsSync(target);
  if (existed && !options.force) {
    report.skipped.push(path);
    return;
  }
  if (options.dryRun) {
    if (existed) {
      report.overwritten.push(path);
    } else {
      report.created.push(path);
    }
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  if (existed && options.force) {
    report.overwritten.push(path);
  } else {
    report.created.push(path);
  }
}

function copyDirectory(
  options: InstallAgentSupportOptions,
  report: AgentInstallReport,
  source: string,
  target: string,
): void {
  const path = displayPath(options.paths, target);
  if (!existsSync(source)) {
    report.notes.push(`missing bundled asset: ${source}`);
    return;
  }
  if (existsSync(target) && !options.force) {
    report.skipped.push(path);
    return;
  }
  if (options.dryRun) {
    if (existsSync(target)) {
      report.overwritten.push(path);
    } else {
      report.created.push(path);
    }
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  const existed = existsSync(target);
  if (existed && options.force) rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  if (existed && options.force) {
    report.overwritten.push(path);
  } else {
    report.created.push(path);
  }
}

function displayPath(paths: ProjectPaths, target: string): string {
  const rel = relative(paths.root, target);
  return rel.length > 0 ? rel : target;
}
