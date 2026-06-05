import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAgentSupport, parseAgentProviders } from '../core/agents.js';
import { getPaths } from '../core/paths.js';
import { listAllSpecs } from '../core/spec-io.js';

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
    .option('-p, --provider <provider>', 'all | claude | codex | opencode | codebuddy（可逗号组合）', 'all')
    .option('--force', '覆盖已存在的 agent 指令文件/skill 目录')
    .action((opts) => {
      const paths = getPaths();
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
      const report = installAgentSupport({
        paths,
        packageRoot,
        providers: parseAgentProviders(opts.provider),
        force: Boolean(opts.force),
      });

      console.log(`✓ AI agent support installed: ${report.providers.join(', ')}`);
      printPathGroup('created', report.created);
      printPathGroup('overwritten', report.overwritten);
      printPathGroup('skipped', report.skipped);
      if (report.notes.length > 0) {
        console.log('notes:');
        for (const note of report.notes) console.log(`  - ${note}`);
      }
    });

  cmd
    .command('status')
    .description('项目状态总览：spec 状态分布 / topic 列表 / 任务数')
    .action(() => {
      const paths = getPaths();
      if (!paths.isInitialized) {
        console.error('✗ 项目未初始化。先跑: spec-manager project init');
        process.exit(1);
      }
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

function printPathGroup(label: string, paths: string[]): void {
  if (paths.length === 0) return;
  console.log(`${label}:`);
  for (const p of paths) console.log(`  - ${p}`);
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
