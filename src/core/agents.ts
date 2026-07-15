import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { ProjectPaths } from './paths.js';

export const AGENT_PROVIDERS = ['claude', 'codex', 'opencode', 'mimocode', 'codebuddy', 'cursor', 'windsurf'] as const;

export type AgentProvider = (typeof AGENT_PROVIDERS)[number];
export type AgentProviderSelection = AgentProvider | 'all';
export type AgentPlatformTarget = AgentProviderSelection;

export interface AgentProviderInfo {
  provider: AgentProvider;
  aliases: string[];
  files: string[];
  description: string;
  notes: string[];
  installSteps: AgentInstallStep[];
}

export interface AgentPlatformInfo {
  platform: string;
  command: string;
  aliases: string[];
  target: AgentPlatformTarget;
  description: string;
  notes: string[];
}

export type AgentInstallStep =
  | { kind: 'template'; source: string; target: string }
  | { kind: 'directory'; source: string; target: string };

export interface InstallAgentSupportOptions {
  paths: ProjectPaths;
  packageRoot: string;
  providers: AgentProviderSelection[];
  force?: boolean;
  syncManaged?: boolean;
  dryRun?: boolean;
}

export interface InstallAgentPlatformSupportOptions extends Omit<InstallAgentSupportOptions, 'providers'> {
  platform: string;
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

export interface ManagedAgentAssetInspection {
  missing: string[];
  drifted: string[];
}

export interface MergeMissingDirectory {
  source: string;
  target: string;
}

export interface MergeMissingDirectoryOptions {
  paths: ProjectPaths;
  packageRoot: string;
  directories: MergeMissingDirectory[];
  dryRun?: boolean;
  write?: (target: string, content: string) => void;
}

export interface MergeMissingDirectoryReport {
  created: string[];
  skipped: string[];
  notes: string[];
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
    provider: 'mimocode',
    aliases: ['mimocode', 'mimo-code', 'mimo code', 'mimo'],
    files: ['AGENTS.md'],
    description: 'MiMo-Code project instructions via AGENTS.md.',
    notes: ['MiMo-Code reads project instructions from AGENTS.md.'],
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

export const AGENT_PLATFORM_INFO: AgentPlatformInfo[] = [
  platform('claude', 'claude', ['claude-code'], 'claude', 'Claude Code native skill + CLAUDE.md.', []),
  platform('codebuddy', 'codebuddy', ['code-buddy', 'code buddy'], 'codebuddy', 'CodeBuddy native skill + CODEBUDDY.md.', []),
  platform('codex', 'codex', ['openai-codex'], 'codex', 'Codex AGENTS.md instructions.', []),
  platform('opencode', 'opencode', ['open-code', 'open code'], 'opencode', 'OpenCode AGENTS.md instructions.', []),
  platform('kilo', 'kilo', ['kilo-code', 'kilo code'], 'codex', 'Kilo Code AGENTS-compatible fallback instructions.', ['Kilo Code uses AGENTS-compatible fallback instructions.']),
  platform('copilot', 'copilot', ['github-copilot', 'github copilot', 'copilot-cli'], 'codex', 'GitHub Copilot CLI AGENTS-compatible fallback instructions.', ['GitHub Copilot CLI uses AGENTS-compatible fallback instructions.']),
  platform('vscode', 'vscode', ['vs-code', 'vs code', 'vscode-copilot', 'vs-code-copilot'], 'codex', 'VS Code Copilot Chat AGENTS-compatible fallback instructions.', ['VS Code Copilot Chat uses AGENTS-compatible fallback instructions.']),
  platform('aider', 'aider', [], 'codex', 'Aider AGENTS-compatible fallback instructions.', ['Aider uses AGENTS-compatible fallback instructions.']),
  platform('claw', 'claw', ['openclaw', 'open-claw'], 'codex', 'OpenClaw AGENTS-compatible fallback instructions.', ['OpenClaw uses AGENTS-compatible fallback instructions.']),
  platform('droid', 'droid', ['factory-droid', 'factory droid'], 'codex', 'Factory Droid AGENTS-compatible fallback instructions.', ['Factory Droid uses AGENTS-compatible fallback instructions.']),
  platform('trae', 'trae', [], 'codex', 'Trae AGENTS-compatible fallback instructions.', ['Trae uses AGENTS-compatible fallback instructions.']),
  platform('trae-cn', 'trae-cn', ['trae cn', 'trae_china', 'trae china'], 'codex', 'Trae CN AGENTS-compatible fallback instructions.', ['Trae CN uses AGENTS-compatible fallback instructions.']),
  platform('cursor', 'cursor', [], 'cursor', 'Cursor project rules via .cursorrules.', []),
  platform('gemini', 'gemini', ['gemini-cli', 'gemini cli'], 'codex', 'Gemini CLI AGENTS-compatible fallback instructions.', ['Gemini CLI uses AGENTS-compatible fallback instructions.']),
  platform('hermes', 'hermes', [], 'codex', 'Hermes AGENTS-compatible fallback instructions.', ['Hermes uses AGENTS-compatible fallback instructions.']),
  platform('kimi', 'kimi', ['kimi-code', 'kimi code'], 'codex', 'Kimi Code AGENTS-compatible fallback instructions.', ['Kimi Code uses AGENTS-compatible fallback instructions.']),
  platform('amp', 'amp', [], 'codex', 'Amp AGENTS-compatible fallback instructions.', ['Amp uses AGENTS-compatible fallback instructions.']),
  platform('agents', 'agents', ['agent-skills', 'agent skills'], 'all', 'Cross-framework agent install.', ['Installs all bundled spec-manager agent entrypoints.']),
  platform('skills', 'skills', ['skill'], 'all', 'Cross-framework skill install alias.', ['Installs all bundled spec-manager agent entrypoints.']),
  platform('kiro', 'kiro', ['kiro-ide', 'kiro-cli'], 'codex', 'Kiro IDE/CLI AGENTS-compatible fallback instructions.', ['Kiro IDE/CLI uses AGENTS-compatible fallback instructions.']),
  platform('pi', 'pi', ['pi-agent', 'pi coding agent'], 'codex', 'Pi coding agent AGENTS-compatible fallback instructions.', ['Pi coding agent uses AGENTS-compatible fallback instructions.']),
  platform('devin', 'devin', ['devin-cli'], 'codex', 'Devin CLI AGENTS-compatible fallback instructions.', ['Devin CLI uses AGENTS-compatible fallback instructions.']),
  platform('antigravity', 'antigravity', ['google-antigravity', 'google antigravity'], 'codex', 'Google Antigravity AGENTS-compatible fallback instructions.', ['Google Antigravity uses AGENTS-compatible fallback instructions.']),
  platform('mimocode', 'mimocode', ['mimo-code', 'mimo code', 'mimo'], 'mimocode', 'MiMo-Code AGENTS.md instructions.', []),
  platform('windsurf', 'windsurf', [], 'windsurf', 'Windsurf project rules via .windsurfrules.', []),
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

export function normalizeAgentPlatform(input: string): AgentPlatformInfo {
  const key = normalizeAgentKey(input);
  const platformInfo = AGENT_PLATFORM_INFO.find((info) =>
    [info.platform, info.command, ...info.aliases]
      .map(normalizeAgentKey)
      .includes(key),
  );
  if (platformInfo) return platformInfo;
  throw new Error(
    `unsupported AI platform: ${input}. Use one of: ${AGENT_PLATFORM_INFO.map((info) => info.command).join(', ')}`,
  );
}

export function normalizeAgentProvider(input: string): AgentProviderSelection {
  const key = normalizeAgentKey(input);
  if (key === 'all' || key === '*') return 'all';
  const provider = AGENT_PROVIDER_INFO.find((info) =>
    info.aliases.map(normalizeAgentKey).includes(key),
  );
  if (provider) return provider.provider;
  throw new Error(
    `unsupported AI provider: ${input}. Use one of: all, ${AGENT_PROVIDERS.join(', ')}`,
  );
}

export function listAgentPlatforms(): AgentPlatformInfo[] {
  return AGENT_PLATFORM_INFO;
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
      if (options.syncManaged && isAgentEntryTarget(step.target)) continue;
      applyInstallStep(options, report, step);
    }
    report.notes.push(...config.notes);
  }

  return report;
}

export function installAgentPlatformSupport(options: InstallAgentPlatformSupportOptions): AgentInstallReport {
  const platformInfo = normalizeAgentPlatform(options.platform);
  const report = installAgentSupport({
    ...options,
    providers: [platformInfo.target],
  });
  report.notes.push(...platformInfo.notes);
  return report;
}

export function inspectManagedAgentAssets(
  paths: ProjectPaths,
  packageRoot: string,
  providers: AgentProviderSelection[],
): ManagedAgentAssetInspection {
  const result: ManagedAgentAssetInspection = { missing: [], drifted: [] };
  for (const asset of listManagedAssets(packageRoot, providers)) {
    const target = join(paths.root, ...asset.target.split('/'));
    if (!existsSync(target)) {
      result.missing.push(asset.target);
    } else if (readFileSync(target, 'utf8') !== readFileSync(asset.source, 'utf8')) {
      result.drifted.push(asset.target);
    }
  }
  return result;
}

export function mergeMissingDirectories(options: MergeMissingDirectoryOptions): MergeMissingDirectoryReport {
  const report: MergeMissingDirectoryReport = { created: [], skipped: [], notes: [] };
  for (const directory of options.directories) {
    const sourceRoot = join(options.packageRoot, ...directory.source.split('/'));
    const targetRoot = join(options.paths.root, ...directory.target.split('/'));
    if (!existsSync(sourceRoot)) {
      report.notes.push(`missing bundled asset: ${sourceRoot}`);
      continue;
    }
    for (const sourceFile of listDirectoryFiles(sourceRoot)) {
      const rel = relative(sourceRoot, sourceFile);
      const target = join(targetRoot, rel);
      const displayed = displayPath(options.paths, target);
      if (existsSync(target)) {
        report.skipped.push(displayed);
        continue;
      }
      report.created.push(displayed);
      if (options.dryRun) continue;
      const content = readFileSync(sourceFile, 'utf8');
      if (options.write) options.write(target, content);
      else {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content, 'utf8');
      }
    }
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
  if (existsSync(target) && readFileSync(target, 'utf8') === content) {
    report.skipped.push(displayPath(options.paths, target));
    return;
  }
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
  if (existed && !options.force && !options.syncManaged) {
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
  if (existed && (options.force || options.syncManaged)) {
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
  if (!existsSync(source)) {
    report.notes.push(`missing bundled asset: ${source}`);
    return;
  }
  for (const sourceFile of listDirectoryFiles(source)) {
    const rel = relative(source, sourceFile);
    const targetFile = join(target, rel);
    const path = displayPath(options.paths, targetFile);
    const existed = existsSync(targetFile);
    if (existed && readFileSync(targetFile, 'utf8') === readFileSync(sourceFile, 'utf8')) {
      report.skipped.push(path);
      continue;
    }
    if (existed && !options.force && !options.syncManaged) {
      report.skipped.push(path);
      continue;
    }
    if (options.dryRun) {
      (existed ? report.overwritten : report.created).push(path);
      continue;
    }
    mkdirSync(dirname(targetFile), { recursive: true });
    cpSync(sourceFile, targetFile);
    (existed ? report.overwritten : report.created).push(path);
  }
}

function displayPath(paths: ProjectPaths, target: string): string {
  const rel = relative(paths.root, target);
  return rel.length > 0 ? rel : target;
}

function listDirectoryFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listDirectoryFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

function listManagedAssets(
  packageRoot: string,
  providers: AgentProviderSelection[],
): Array<{ source: string; target: string }> {
  const assets = new Map<string, string>();
  for (const provider of expandAgentProviders(providers)) {
    for (const step of providerConfig(provider).installSteps) {
      const source = join(packageRoot, ...step.source.split('/'));
      if (!existsSync(source)) continue;
      if (step.kind === 'template') {
        if (isAgentEntryTarget(step.target)) continue;
        assets.set(step.target, source);
        continue;
      }
      for (const sourceFile of listDirectoryFiles(source)) {
        assets.set(join(step.target, relative(source, sourceFile)), sourceFile);
      }
    }
  }
  return [...assets.entries()]
    .map(([target, source]) => ({ source, target }))
    .sort((a, b) => a.target.localeCompare(b.target));
}

function isAgentEntryTarget(target: string): boolean {
  return ['CLAUDE.md', 'AGENTS.md', 'CODEBUDDY.md', '.cursorrules', '.windsurfrules'].includes(target);
}

function platform(
  platformName: string,
  command: string,
  aliases: string[],
  target: AgentPlatformTarget,
  description: string,
  notes: string[],
): AgentPlatformInfo {
  return { platform: platformName, command, aliases, target, description, notes };
}

function normalizeAgentKey(input: string): string {
  return input.toLowerCase().trim().replace(/[\s_-]+/g, '-');
}
