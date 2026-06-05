import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { ProjectPaths } from './paths.js';

export const AGENT_PROVIDERS = ['claude', 'codex', 'opencode', 'codebuddy'] as const;

export type AgentProvider = (typeof AGENT_PROVIDERS)[number];
export type AgentProviderSelection = AgentProvider | 'all';

export interface InstallAgentSupportOptions {
  paths: ProjectPaths;
  packageRoot: string;
  providers: AgentProviderSelection[];
  force?: boolean;
}

export interface AgentInstallReport {
  providers: AgentProvider[];
  created: string[];
  overwritten: string[];
  skipped: string[];
  notes: string[];
}

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
  switch (key) {
    case 'all':
    case '*':
      return 'all';
    case 'claude':
    case 'claude-code':
      return 'claude';
    case 'codex':
    case 'openai-codex':
      return 'codex';
    case 'opencode':
    case 'open-code':
      return 'opencode';
    case 'codebuddy':
    case 'code-buddy':
    case 'cbc':
      return 'codebuddy';
    default:
      throw new Error(
        `unsupported AI provider: ${input}. Use one of: all, claude, codex, opencode, codebuddy`,
      );
  }
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

export function installAgentSupport(options: InstallAgentSupportOptions): AgentInstallReport {
  const providers = expandAgentProviders(options.providers);
  const report: AgentInstallReport = {
    providers,
    created: [],
    overwritten: [],
    skipped: [],
    notes: [],
  };

  let agentsMdWritten = false;
  for (const provider of providers) {
    switch (provider) {
      case 'claude':
        installClaudeSupport(options, report);
        break;
      case 'codex':
        if (!agentsMdWritten) {
          writeTemplate(options, report, 'templates/agents/AGENTS.md', 'AGENTS.md');
          agentsMdWritten = true;
        }
        report.notes.push('Codex reads project instructions from AGENTS.md.');
        break;
      case 'opencode':
        if (!agentsMdWritten) {
          writeTemplate(options, report, 'templates/agents/AGENTS.md', 'AGENTS.md');
          agentsMdWritten = true;
        }
        report.notes.push('OpenCode reads AGENTS.md and also falls back to CLAUDE.md when AGENTS.md is absent.');
        break;
      case 'codebuddy':
        installCodeBuddySupport(options, report);
        break;
    }
  }

  return report;
}

function installClaudeSupport(options: InstallAgentSupportOptions, report: AgentInstallReport): void {
  writeTemplate(options, report, 'templates/agents/CLAUDE.md', 'CLAUDE.md');
  const skillTarget = join(options.paths.root, '.claude', 'skills', 'spec-manager');
  copyDirectory(options, report, join(options.packageRoot, 'skill'), skillTarget);
  copyDirectory(options, report, join(options.packageRoot, 'rules'), join(skillTarget, 'rules'));
  copyDirectory(options, report, join(options.packageRoot, 'templates'), join(skillTarget, 'templates'));
  report.notes.push('Claude Code can invoke the spec-manager skill with /spec-manager.');
}

function installCodeBuddySupport(options: InstallAgentSupportOptions, report: AgentInstallReport): void {
  writeTemplate(options, report, 'templates/agents/CODEBUDDY.md', 'CODEBUDDY.md');
  const skillTarget = join(options.paths.root, '.codebuddy', 'skills', 'spec-manager');
  writeTemplate(options, report, 'templates/agents/codebuddy-skill/SKILL.md', '.codebuddy/skills/spec-manager/SKILL.md');
  copyDirectory(options, report, join(options.packageRoot, 'skill', 'subskills'), join(skillTarget, 'subskills'));
  copyDirectory(options, report, join(options.packageRoot, 'rules'), join(skillTarget, 'rules'));
  copyDirectory(options, report, join(options.packageRoot, 'templates'), join(skillTarget, 'templates'));
  report.notes.push('CodeBuddy reads CODEBUDDY.md and auto-discovers .codebuddy/skills/spec-manager.');
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
