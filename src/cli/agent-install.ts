import { Command } from 'commander';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installAgentPlatformSupport,
  listAgentPlatforms,
  normalizeAgentPlatform,
  type AgentInstallReport,
} from '../core/agents.js';
import { getPaths } from '../core/paths.js';
import { printPathGroup } from './common.js';

interface AgentInstallCliOptions {
  dryRun: boolean;
  force: boolean;
  syncManaged: boolean;
}

export function registerAgentInstallCommands(program: Command): void {
  program
    .command('install')
    .description('Install spec-manager instructions for an AI platform')
    .requiredOption('--platform <platform>', 'AI platform, such as claude, codex, kimi, agents')
    .option('--dry-run', 'show planned writes without changing files', false)
    .option('--force', 'overwrite existing agent entry files and managed assets', false)
    .option('--sync-managed', 'sync managed skill assets while preserving custom files', false)
    .action((opts: AgentInstallCliOptions & { platform: string }) => {
      runPlatformInstall(opts.platform, opts);
    });

  for (const platform of listAgentPlatforms()) {
    program
      .command(platform.command)
      .description(`Install spec-manager instructions for ${platform.description}`)
      .command('install')
      .description(platform.description)
      .option('--dry-run', 'show planned writes without changing files', false)
      .option('--force', 'overwrite existing agent entry files and managed assets', false)
      .option('--sync-managed', 'sync managed skill assets while preserving custom files', false)
      .action((opts: AgentInstallCliOptions) => {
        runPlatformInstall(platform.command, opts);
      });
  }
}

function runPlatformInstall(platform: string, opts: AgentInstallCliOptions): void {
  try {
    const platformInfo = normalizeAgentPlatform(platform);
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const report = installAgentPlatformSupport({
      paths: getPaths(),
      packageRoot,
      platform: platformInfo.platform,
      force: Boolean(opts.force),
      syncManaged: Boolean(opts.syncManaged),
      dryRun: Boolean(opts.dryRun),
    });
    printAgentInstallReport(report, opts.dryRun ? 'planned' : 'installed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('unsupported AI platform:')) {
      console.error(`✗ ${message}`);
      process.exit(2);
    }
    throw err;
  }
}

function printAgentInstallReport(report: AgentInstallReport, verb: string): void {
  console.log(`✓ AI agent support ${verb}: ${report.providers.join(', ')}`);
  printPathGroup(report.dryRun ? 'would create' : 'created', report.created);
  printPathGroup(report.dryRun ? 'would overwrite' : 'overwritten', report.overwritten);
  printPathGroup('skipped', report.skipped);
  if (report.notes.length > 0) {
    console.log('notes:');
    for (const note of unique(report.notes)) console.log(`  - ${note}`);
  }
  if (!report.dryRun) {
    console.log('');
    console.log('Next:');
    console.log('  Use spec-manager to add user authentication feature.');
    console.log('  Verify: spec-manager project doctor');
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
