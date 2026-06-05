import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAgentSupport, listAgentProviders, parseAgentProviders } from '../core/agents.js';
import { getPaths } from '../core/paths.js';
import { listAllSpecs } from '../core/spec-io.js';
import { runProjectDoctor } from '../core/usability.js';
import { printPathGroup, requireInitialized } from './common.js';

export function registerProject(program: Command): void {
  const cmd = program.command('project').description('项目管理（init/status）');

  cmd
    .command('init')
    .description('初始化 .spec-manager/ 目录与 config.yaml')
    .option('-n, --name <name>', '项目名称', 'my-project')
    .option('--workflow <workflow>', 'spec workflow 模板', 'default')
    .action((opts) => {
      const paths = getPaths();
      if (existsSync(paths.configDir)) {
        console.log(`✓ 已初始化（${paths.configDir}）`);
        return;
      }
      mkdirSync(paths.configDir, { recursive: true });
      mkdirSync(paths.incidentsDir, { recursive: true });
      mkdirSync(paths.specsDir, { recursive: true });
      mkdirSync(paths.changesDir, { recursive: true });
      mkdirSync(paths.archiveDir, { recursive: true });

      const configYaml = [
        `# spec-manager project config`,
        `project_name: ${opts.name}`,
        `specWorkflow: ${opts.workflow}`,
        `# rulesAppliesTo 过滤：留空 = 应用全部 24 条规则`,
        `rulesAppliesTo: []`,
        `created: ${new Date().toISOString()}`,
        ``,
      ].join('\n');
      writeFileSync(paths.configFile, configYaml, 'utf8');
      writeFileSync(paths.auditFile, initAuditJson(), 'utf8');
      console.log(`✓ 已初始化 ${paths.configDir}`);
      console.log(`  - config:    ${paths.configFile}`);
      console.log(`  - audit:     ${paths.auditFile}`);
      console.log(`  - specs:     ${paths.specsDir}/`);
      console.log(`  - changes:   ${paths.changesDir}/`);
      console.log(`  - archive:   ${paths.archiveDir}/`);
      console.log(`\n下一步：spec-manager spec new L1 --topic <topic> --code <CODE> --title "..."`);
      console.log(`AI 配置：spec-manager project agents --provider all`);
    });

  cmd
    .command('agents')
    .description('安装 AI agent 指令与 skill（claude/codex/opencode/codebuddy/all）')
    .option('-p, --provider <provider>', 'list | all | claude | codex | opencode | codebuddy（可逗号组合）', 'all')
    .option('--dry-run', '只显示将写入/覆盖/跳过的文件，不实际落盘')
    .option('--force', '覆盖已存在的 agent 指令文件/skill 目录')
    .action((opts) => {
      if (String(opts.provider).trim().toLowerCase() === 'list') {
        printAgentProviderList();
        return;
      }

      const paths = getPaths();
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
      const report = installAgentSupport({
        paths,
        packageRoot,
        providers: parseAgentProviders(opts.provider),
        force: Boolean(opts.force),
        dryRun: Boolean(opts.dryRun),
      });

      const verb = report.dryRun ? 'planned' : 'installed';
      console.log(`✓ AI agent support ${verb}: ${report.providers.join(', ')}`);
      printPathGroup(report.dryRun ? 'would create' : 'created', report.created);
      printPathGroup(report.dryRun ? 'would overwrite' : 'overwritten', report.overwritten);
      printPathGroup('skipped', report.skipped);
      if (report.notes.length > 0) {
        console.log('notes:');
        for (const note of report.notes) console.log(`  - ${note}`);
      }
      if (!report.dryRun) {
        console.log('');
        console.log('Next:');
        console.log('  Claude / CodeBuddy: /spec-manager add user authentication feature');
        console.log('  Codex / OpenCode: Ask "Use spec-manager to add user authentication feature."');
        console.log('  Verify: spec-manager project doctor');
      }
    });

  cmd
    .command('doctor')
    .description('检查项目初始化、agent 指令、skill 资产、占位 spec 和 audit 状态')
    .action(() => {
      const paths = getPaths();
      const checks = runProjectDoctor(paths);
      for (const check of checks) {
        const mark = check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
        console.log(`${mark} ${check.label}: ${check.detail}`);
        if (check.action) console.log(`  Next: ${check.action}`);
      }
      const hasFail = checks.some((c) => c.status === 'fail');
      const hasWarn = checks.some((c) => c.status === 'warn');
      console.log(hasFail ? '\nProject doctor: failed' : hasWarn ? '\nProject doctor: warnings' : '\nProject doctor: ok');
    });

  cmd
    .command('status')
    .description('项目状态总览：spec 状态分布 / topic 列表 / 任务数')
    .action(() => {
      const paths = getPaths();
      requireInitialized(paths);
      const specs = listAllSpecs(paths);
      const byStatus: Record<string, number> = {};
      const byTopic: Record<string, number> = {};
      for (const s of specs) {
        byStatus[s.fm.status] = (byStatus[s.fm.status] ?? 0) + 1;
        byTopic[s.fm.topic] = (byTopic[s.fm.topic] ?? 0) + 1;
      }
      console.log(`📊 项目状态 (root: ${paths.root})\n`);
      console.log('Specs:');
      for (const s of ['draft', 'confirmed', 'frozen', 'implemented', 'archived']) {
        if (byStatus[s]) console.log(`  ${s.padEnd(12)} ${byStatus[s]}`);
      }
      console.log(`\nTopics: ${Object.keys(byTopic).length}`);
      for (const [t, n] of Object.entries(byTopic).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${t.padEnd(20)} ${n} spec(s)`);
      }
      if (specs.length === 0) {
        console.log('\n(尚无 spec)');
      }
    });
}

function printAgentProviderList(): void {
  console.log('Supported AI agent providers:');
  for (const provider of listAgentProviders()) {
    console.log(`  - ${provider.provider}`);
    console.log(`    aliases: ${provider.aliases.join(', ')}`);
    console.log(`    files: ${provider.files.join(', ')}`);
    console.log(`    ${provider.description}`);
  }
}

function initAuditJson(): string {
  const rules: Record<string, number> = {};
  for (let i = 1; i <= 24; i++) rules[`R${i}`] = 0;
  return JSON.stringify(
    { sessionId: '', startedAt: '', topic: '', rules, pending: [], lastUpdated: '' },
    null,
    2,
  );
}
