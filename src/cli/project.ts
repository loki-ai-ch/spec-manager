import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import {
  detectAgentProviders,
  installAgentSupport,
  listAgentPlatforms,
  listAgentProviders,
  parseAgentProviders,
  type AgentProviderDetection,
} from '../core/agents.js';
import { getPaths } from '../core/paths.js';
import { listAllSpecs } from '../core/spec-io.js';
import { runProjectDoctor } from '../core/usability.js';
import {
  isTaskWorkflowProfile,
  readAdaptiveWorkflowConfig,
  writeAdaptiveWorkflowConfig,
  type TaskWorkflowProfile,
} from '../core/workflow-profile.js';
import { recommendWorkflowProfile, type ProfileRecommendation } from '../core/profile-recommendation.js';
import { buildProfileMetrics, type ProfileMetricsReport } from '../core/profile-metrics.js';
import {
  buildAdaptiveWorkflowAdoptionPreview,
  type AdaptiveWorkflowAdoptionPreview,
} from '../core/adaptive-workflow-adoption.js';
import { buildCriticalReadinessReport, type CriticalReadinessReport } from '../core/critical-readiness.js';
import { buildScopeReadinessReport } from '../core/scope-readiness.js';
import { buildKnowledgeMetrics } from '../core/knowledge-metrics.js';
import { enableKnowledgeGovernance, previewKnowledgeGovernance } from '../core/knowledge-governance-adoption.js';
import { previewKnowledgeMigration } from '../core/knowledge-migration.js';
import { applyRepositoryRemediation, planRepositoryRemediation } from '../core/remediation.js';
import { applyLifecycleReconciliation, planLifecycleReconciliation } from '../core/reconciliation.js';
import { buildDocsConsistencyReport, type DocsConsistencyReport } from '../core/docs-consistency.js';
import { resolveSpecStore, type SpecStoreResolution } from '../core/spec-store.js';
import { printPathGroup, requireInitialized } from './common.js';
import { runSetupCommand } from './setup-presenter.js';

export function registerProject(program: Command): void {
  const cmd = program.command('project').description('项目管理（init/status）');

  cmd
    .command('setup [request...]')
    .description('只读 setup：输出初始化、write root、agent 入口和下一步建议')
    .option('--topic <topic>', '限定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((requestParts: string[], opts: { topic?: string; json: boolean }) => {
      runSetupCommand(requestParts, opts);
    });

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

      const configYaml = stringifyYaml({
        project_name: opts.name,
        specWorkflow: opts.workflow,
        rulesAppliesTo: [],
        created: new Date().toISOString(),
      });
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
    .description('安装 AI agent 指令与 skill（不传 provider 自动检测；显式 all 安装全部）')
    .option('-p, --provider <provider>', 'list | all | claude | codex | opencode | mimocode | codebuddy | cursor | windsurf（可逗号组合）')
    .option('--dry-run', '只显示将写入/覆盖/跳过的文件，不实际落盘')
    .option('--force', '覆盖已存在的 agent 指令文件/skill 目录')
    .option('--sync-managed', '逐文件同步托管 agent 资产；保留目标中的额外自定义文件')
    .action((opts) => {
      const providerInput = opts.provider === undefined ? undefined : String(opts.provider);
      if (providerInput?.trim().toLowerCase() === 'list') {
        printAgentProviderList();
        return;
      }

      const paths = getPaths();
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
      const detection = providerInput === undefined ? detectAgentProviders(paths) : undefined;
      if (detection && detection.providers.length === 0) {
        throw new Error(
          'NO_PROVIDER_DETECTED: no AI agent provider marker found. Use --provider all or pass an explicit provider.',
        );
      }
      const report = installAgentSupport({
        paths,
        packageRoot,
        providers: detection?.providers ?? parseAgentProviders(providerInput ?? ''),
        force: Boolean(opts.force),
        syncManaged: Boolean(opts.syncManaged),
        dryRun: Boolean(opts.dryRun),
      });

      const verb = report.dryRun ? 'planned' : 'installed';
      console.log(`✓ AI agent support ${verb}: ${report.providers.join(', ')}`);
      if (detection) printAgentDetection(detection);
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
        console.log('  Use spec-manager to add user authentication feature.');
        console.log('  Verify: spec-manager project doctor');
      }
    });

  const workflow = cmd
    .command('workflow')
    .description('管理风险自适应工作流配置（显式启用后影响后续 Task Profile）');

  workflow
    .command('preview')
    .description('只读预检 adaptive workflow 采用状态、governed readiness 和推荐默认 Profile')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const preview = buildAdaptiveWorkflowAdoptionPreview(paths);
      if (opts.json) {
        console.log(JSON.stringify(preview, null, 2));
        return;
      }
      printAdaptiveWorkflowAdoptionPreview(preview);
    });

  workflow
    .command('show')
    .description('查看 adaptive workflow 配置')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const config = readAdaptiveWorkflowConfig(paths);
      if (opts.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }
      console.log('Adaptive workflow:');
      console.log(`  enabled: ${config.enabled}`);
      console.log(`  defaultProfile: ${config.defaultProfile}`);
      if (!config.enabled) {
        console.log('  mode: legacy compatibility (existing task completion semantics unchanged)');
      }
    });

  workflow
    .command('enable')
    .description('显式启用 adaptive workflow')
    .option('--default-profile <profile>', 'standard | governed', 'standard')
    .action((opts: { defaultProfile: string }) => {
      const paths = getPaths();
      requireInitialized(paths);
      if (!isTaskWorkflowProfile(opts.defaultProfile)) {
        throw new Error(`INVALID_WORKFLOW_PROFILE: ${opts.defaultProfile} (must be standard|governed)`);
      }
      const config = writeAdaptiveWorkflowConfig(paths, {
        enabled: true,
        defaultProfile: opts.defaultProfile as TaskWorkflowProfile,
      });
      console.log('✓ Adaptive workflow enabled');
      console.log(`  defaultProfile: ${config.defaultProfile}`);
      console.log('  Future tasks will record standard/governed profile snapshots.');
      console.log('  Historical tasks are not modified.');
      console.log('  Audit adoption with `spec-manager project profile metrics`.');
    });

  workflow
    .command('disable')
    .description('禁用 adaptive workflow（只影响后续 Task，不改写历史 Task）')
    .action(() => {
      const paths = getPaths();
      requireInitialized(paths);
      const current = readAdaptiveWorkflowConfig(paths);
      const config = writeAdaptiveWorkflowConfig(paths, {
        enabled: false,
        defaultProfile: current.defaultProfile,
      });
      console.log('✓ Adaptive workflow disabled');
      console.log(`  defaultProfile: ${config.defaultProfile}`);
      console.log('  existing task profile snapshots were not modified');
      console.log('  Only future task profile resolution changes.');
      console.log('  Existing task profile snapshots remain unchanged.');
    });

  const profile = cmd
    .command('profile')
    .description('Profile 推荐与治理效果报告');

  profile
    .command('recommend')
    .description('根据请求文本和可选文件路径推荐 quick/standard/governed Profile')
    .requiredOption('--request <text>', '工作请求或变更描述')
    .option('--files <paths>', '逗号分隔的相关文件路径')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { request: string; files?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const recommendation = recommendWorkflowProfile({
          paths,
          request: opts.request,
          files: splitCommaList(opts.files),
        });
        if (opts.json) {
          console.log(JSON.stringify(recommendation, null, 2));
          return;
        }
        printProfileRecommendation(recommendation);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('PROFILE_RECOMMENDATION_REQUEST_REQUIRED:')) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  profile
    .command('metrics')
    .description('汇总 Profile 采用、完成状态、Evidence coverage 与覆盖审计')
    .option('--topic <topic>', '只统计指定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildProfileMetrics(paths, { topic: opts.topic });
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printProfileMetrics(report);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_PROFILE_METRICS_TOPIC:')) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  const readiness = cmd
    .command('readiness')
    .description('项目治理 readiness 只读报告');

  readiness
    .command('critical')
    .description('汇总 active L3 的关键 AC readiness 和修复建议')
    .option('--topic <topic>', '只统计指定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildCriticalReadinessReport(paths, { topic: opts.topic });
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printCriticalReadinessReport(report);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('INVALID_CRITICAL_READINESS_TOPIC:')) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  readiness.command('scope')
    .description('汇总计划子级范围完整性')
    .option('--topic <topic>', '只统计指定 topic')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; json: boolean }) => {
      const paths = getPaths(); requireInitialized(paths);
      const report = buildScopeReadinessReport(paths, opts.topic);
      if (opts.json) return console.log(JSON.stringify(report, null, 2));
      console.log(`Scope readiness: ready=${report.summary.ready} blocked=${report.summary.blocked} legacy=${report.summary.legacy}`);
      for (const item of report.items.filter(item => item.status === 'blocked')) {
        console.log(`- ${item.specCode}: ${item.mode}; missing=${item.missingChildren.join(',') || '-'} incomplete=${item.incompleteChildren.join(',') || '-'}`);
      }
    });

  const knowledge = cmd.command('knowledge').description('知识治理只读报告');
  const adoption = knowledge.command('adoption').description('知识治理采用');
  adoption.command('preview').option('--json', 'JSON', false).action((opts: { json?: boolean }) => {
    const report = previewKnowledgeGovernance(getPaths());
    console.log(opts.json ? JSON.stringify(report, null, 2) : `Knowledge governance: enabled=${report.current.enabled}, legacy=${report.legacy}`);
  });
  adoption.command('enable').option('--json', 'JSON', false).action((opts: { json?: boolean }) => {
    const result = enableKnowledgeGovernance(getPaths());
    console.log(opts.json ? JSON.stringify(result, null, 2) : `✓ knowledge governance enabled at ${result.enabledAt}`);
  });
  const migration = knowledge.command('migration').description('历史知识治理迁移');
  migration.command('preview')
    .option('--topic <topic>')
    .option('--limit <n>', '候选上限', '20')
    .option('--json', 'JSON', false)
    .action((opts: { topic?: string; limit: string; json?: boolean }) => {
      const limit = Number(opts.limit);
      if (!Number.isInteger(limit) || limit < 1) throw new Error('KNOWLEDGE_MIGRATION_LIMIT_INVALID');
      const report = previewKnowledgeMigration(getPaths(), { topic: opts.topic, limit });
      if (opts.json) return console.log(JSON.stringify(report, null, 2));
      const candidateCount = Object.values(report.batches).reduce((sum, batch) => sum + batch.length, 0);
      console.log(`Knowledge migration preview: ${candidateCount} candidate(s), dimensions=5, writes=false`);
      for (const [dimension, candidates] of Object.entries(report.batches)) {
        console.log(`- ${dimension}: ${candidates.length}`);
      }
    });
  knowledge.command('metrics').option('--topic <topic>').option('--json', 'JSON', false)
    .action((opts: { topic?: string; json: boolean }) => {
      const paths = getPaths(); requireInitialized(paths); const report = buildKnowledgeMetrics(paths, opts.topic);
      if (opts.json) return console.log(JSON.stringify(report, null, 2));
      console.log(
        `Knowledge metrics: validity eligible=${report.validity.eligible} unknown=${report.validity.unknown}, `
        + `delivery declared=${report.delivery.declarationCoverage.numerator}/${report.delivery.declarationCoverage.denominator}, `
        + `approved=${report.delivery.approvalCoverage.numerator}/${report.delivery.approvalCoverage.denominator}, `
        + `scope blocked=${report.scope.blocked}`,
      );
    });

  const docs = cmd
    .command('docs')
    .description('文档、package 与 agent guidance 一致性检查');

  docs
    .command('check')
    .description('只读检查 README、package files 与 agent guidance 一致性')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const report = buildDocsConsistencyReport(paths);
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printDocsConsistencyReport(report);
      }
      if (report.summary.errors > 0) process.exit(1);
    });

  cmd
    .command('context')
    .description('只读输出当前执行根、规格写入根和上下文源')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const context = buildProjectContext(paths);
      if (opts.json) {
        console.log(JSON.stringify(context, null, 2));
        return;
      }
      printProjectContext(context);
    });

  const store = cmd
    .command('store')
    .description('只读查看 spec store 解析与诊断');

  store
    .command('show')
    .description('展示当前 resolved spec store')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const resolution = resolveSpecStore(paths);
      if (opts.json) {
        console.log(JSON.stringify(resolution, null, 2));
        return;
      }
      printStoreResolution(resolution);
    });

  store
    .command('doctor')
    .description('检查 spec store 与只读上下文源配置')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const resolution = resolveSpecStore(paths);
      const report = {
        executionRoot: resolution.executionRoot,
        writeRoot: resolution.writeRoot,
        diagnostics: resolution.diagnostics,
      };
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }
      printStoreDoctor(resolution);
    });

  cmd
    .command('reconcile')
    .description('预览或执行已审阅范围内的历史规格状态对账')
    .option('--dry-run', '仅预览对账计划，不写入文件')
    .action((opts) => {
      const paths = getPaths();
      requireInitialized(paths);
      const report = opts.dryRun ? planLifecycleReconciliation(paths) : applyLifecycleReconciliation(paths);
      console.log(`✓ Lifecycle reconciliation ${opts.dryRun ? 'planned' : 'applied'}`);
      printRemediationGroup('implementations', report.implementationActions);
      printRemediationGroup('decisions', report.decisionActions);
      if (report.conflicts.length > 0) {
        console.log('blocked:');
        for (const conflict of report.conflicts) console.log(`  - ${conflict.target}: ${conflict.message}`);
      }
    });

  cmd
    .command('remediate')
    .description('执行显式、版本化的仓库修复迁移')
    .requiredOption('--migration <id>', '迁移 ID')
    .option('--dry-run', '仅预览迁移计划，不写入文件')
    .action((opts) => {
      const paths = getPaths();
      requireInitialized(paths);
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
      const report = opts.dryRun
        ? planRepositoryRemediation({ paths, packageRoot, migrationId: String(opts.migration) })
        : applyRepositoryRemediation({ paths, packageRoot, migrationId: String(opts.migration) });
      console.log(`✓ Repository remediation ${opts.dryRun ? 'planned' : 'applied'}: ${report.migrationId}`);
      printRemediationGroup('decisions', report.decisions);
      printRemediationGroup('exemptions', report.exemptions);
      printRemediationGroup('agent assets', report.agentAssets);
      if (report.conflicts.length > 0) {
        console.log('conflicts:');
        for (const conflict of report.conflicts) console.log(`  - ${conflict.target}: ${conflict.message}`);
      }
    });

  cmd
    .command('doctor')
    .description('检查项目初始化、agent 指令、skill 资产、占位 spec 和 audit 状态')
    .action(() => {
      const paths = getPaths();
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
      const checks = runProjectDoctor(paths, packageRoot);
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

interface ProjectContext extends SpecStoreResolution {
  nextAction: string;
  note: string;
}

function buildProjectContext(paths: ReturnType<typeof getPaths>): ProjectContext {
  return {
    ...resolveSpecStore(paths),
    nextAction: 'spec-manager next "<work>"',
    note: 'This is a read-only context projection. Store-aware spec/task/decision commands and core workflow shortcuts use the resolved writeRoot; contextSources remain read-only.',
  };
}

function printProjectContext(context: ProjectContext): void {
  console.log('Project Context:');
  console.log(`  Execution Root: ${context.executionRoot}`);
  console.log(`  Write Root: ${context.writeRoot}`);
  console.log('  Write Store:');
  printStoreEntry(context.writeStore, '    ');
  console.log('  Context Sources:');
  if (context.contextSources.length === 0) {
    console.log('    (none)');
  } else {
    for (const source of context.contextSources) printStoreEntry(source, '    ');
  }
  console.log('  Diagnostics:');
  printStoreDiagnostics(context.diagnostics, '    ');
  console.log(`  Next: ${context.nextAction}`);
  console.log(`  Note: ${context.note}`);
}

function printStoreResolution(resolution: SpecStoreResolution): void {
  console.log('Spec Store:');
  console.log(`  Execution Root: ${resolution.executionRoot}`);
  console.log(`  Write Root: ${resolution.writeRoot}`);
  console.log('  Write Store:');
  printStoreEntry(resolution.writeStore, '    ');
  console.log('  Context Sources:');
  if (resolution.contextSources.length === 0) {
    console.log('    (none)');
  } else {
    for (const source of resolution.contextSources) printStoreEntry(source, '    ');
  }
  console.log('  Diagnostics:');
  printStoreDiagnostics(resolution.diagnostics, '    ');
}

function printStoreDoctor(resolution: SpecStoreResolution): void {
  if (resolution.diagnostics.length === 0) {
    console.log('Store doctor: ok');
    return;
  }
  console.log('Store doctor: issues');
  printStoreDiagnostics(resolution.diagnostics, '  ');
}

function printStoreEntry(
  entry: SpecStoreResolution['writeStore'],
  indent: string,
): void {
  console.log(`${indent}- ${entry.id} [${entry.mode}]`);
  console.log(`${indent}  path: ${entry.path}`);
  console.log(`${indent}  exists: ${entry.exists}`);
  console.log(`${indent}  initialized: ${entry.initialized}`);
}

function printStoreDiagnostics(
  diagnostics: SpecStoreResolution['diagnostics'],
  indent: string,
): void {
  if (diagnostics.length === 0) {
    console.log(`${indent}(none)`);
    return;
  }
  for (const diagnostic of diagnostics) {
    console.log(`${indent}- [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.fix) console.log(`${indent}  fix: ${diagnostic.fix}`);
  }
}

function printProfileRecommendation(recommendation: ProfileRecommendation): void {
  console.log(`Recommended Profile: ${recommendation.recommendedProfile}`);
  console.log(`Rule Version: ${recommendation.ruleVersion}`);
  console.log('Adaptive Workflow:');
  console.log(`  enabled: ${recommendation.adaptiveWorkflow.enabled}`);
  console.log(`  defaultProfile: ${recommendation.adaptiveWorkflow.defaultProfile}`);
  console.log(`  note: ${recommendation.adaptiveWorkflow.note}`);
  console.log('Risk Factors:');
  for (const factor of recommendation.riskFactors) {
    console.log(`  - ${factor.id} [${factor.severity}] matched "${factor.matched}": ${factor.reason}`);
  }
  console.log('Reasons:');
  for (const reason of recommendation.reasons) console.log(`  - ${reason}`);
  console.log('Override:');
  console.log(`  allowed: ${recommendation.override.allowed}`);
  console.log(`  requiresReason: ${recommendation.override.requiresReason}`);
  console.log(`  guidance: ${recommendation.override.guidance}`);
}

function printAdaptiveWorkflowAdoptionPreview(preview: AdaptiveWorkflowAdoptionPreview): void {
  console.log('Adaptive Workflow Adoption Preview:');
  console.log(`  schemaVersion: ${preview.schemaVersion}`);
  console.log(`  generatedAt: ${preview.generatedAt}`);
  console.log('Adaptive Workflow:');
  console.log(`  enabled: ${preview.adaptiveWorkflow.enabled}`);
  console.log(`  defaultProfile: ${preview.adaptiveWorkflow.defaultProfile}`);
  console.log(`  note: ${preview.adaptiveWorkflow.note}`);
  console.log('Task Profile Metrics:');
  console.log(`  totalTasks: ${preview.taskProfileMetrics.totalTasks}`);
  console.log(`  legacyTasks: ${preview.taskProfileMetrics.legacyTasks}`);
  console.log(`  standardTasks: ${preview.taskProfileMetrics.standardTasks}`);
  console.log(`  governedTasks: ${preview.taskProfileMetrics.governedTasks}`);
  console.log('Governed Readiness:');
  console.log(`  activeL3Specs: ${preview.governedReadiness.activeL3Specs}`);
  console.log(`  withCriticalAcceptanceCriteria: ${preview.governedReadiness.withCriticalAcceptanceCriteria}`);
  console.log(`  withoutCriticalAcceptanceCriteria: ${preview.governedReadiness.withoutCriticalAcceptanceCriteria}`);
  console.log(`  readyForGovernedDefault: ${preview.governedReadiness.readyForGovernedDefault}`);
  console.log('  examplesWithoutCriticalAcceptanceCriteria:');
  if (preview.governedReadiness.examplesWithoutCriticalAcceptanceCriteria.length === 0) {
    console.log('    (none)');
  } else {
    for (const code of preview.governedReadiness.examplesWithoutCriticalAcceptanceCriteria) console.log(`    - ${code}`);
  }
  console.log('Recommendation:');
  console.log(`  recommendedDefaultProfile: ${preview.recommendation.recommendedDefaultProfile}`);
  console.log('  reasons:');
  for (const reason of preview.recommendation.reasons) console.log(`    - ${reason}`);
  console.log('  warnings:');
  if (preview.recommendation.warnings.length === 0) {
    console.log('    (none)');
  } else {
    for (const warning of preview.recommendation.warnings) console.log(`    - ${warning}`);
  }
  console.log('  nextSteps:');
  for (const step of preview.recommendation.nextSteps) console.log(`    - ${step}`);
  console.log('History Policy:');
  console.log(`  mutatesHistoricalTasks: ${preview.historyPolicy.mutatesHistoricalTasks}`);
  console.log(`  note: ${preview.historyPolicy.note}`);
}

function printProfileMetrics(report: ProfileMetricsReport): void {
  console.log('Profile Metrics:');
  console.log(`  schemaVersion: ${report.schemaVersion}`);
  console.log(`  generatedAt: ${report.generatedAt}`);
  if (report.topic) console.log(`  topic: ${report.topic}`);
  console.log('Adaptive Workflow:');
  console.log(`  enabled: ${report.adaptiveWorkflow.enabled}`);
  console.log(`  defaultProfile: ${report.adaptiveWorkflow.defaultProfile}`);
  console.log(`  note: ${report.adaptiveWorkflow.note}`);
  console.log('Totals:');
  console.log(`  tasks: ${report.totals.tasks}`);
  console.log(`  completed: ${report.totals.completed}`);
  console.log(`  failed: ${report.totals.failed}`);
  console.log(`  active: ${report.totals.active}`);
  console.log('By Profile:');
  for (const profile of ['legacy', 'standard', 'governed'] as const) {
    const bucket = report.byProfile[profile];
    const rate = bucket.completionRate === null ? 'n/a' : `${Math.round(bucket.completionRate * 100)}%`;
    console.log(`  - ${profile}: tasks=${bucket.tasks} completed=${bucket.completed} failed=${bucket.failed} active=${bucket.active} completionRate=${rate}`);
  }
  console.log('Governed Coverage:');
  console.log(`  required: ${report.evidence.governed.required}`);
  console.log(`  covered: ${report.evidence.governed.covered}`);
  console.log(`  failed: ${report.evidence.governed.failed}`);
  console.log(`  uncovered: ${report.evidence.governed.uncovered}`);
  console.log(`  completedWithGaps: ${report.evidence.governed.completedWithGaps.length}`);
  for (const item of report.evidence.governed.completedWithGaps) {
    console.log(`    - ${item.specCode}/${item.taskId}: missing ${item.missing.join(', ')}`);
  }
  console.log('Standard Warnings:');
  console.log(`  warnings: ${report.evidence.standard.warnings}`);
  for (const item of report.evidence.standard.missing) {
    console.log(`    - ${item.specCode}/${item.taskId}: missing ${item.missing.join(', ')}`);
  }
  console.log('Explicit Overrides:');
  console.log(`  count: ${report.overrides.length}`);
  for (const item of report.overrides) {
    console.log(`    - ${item.specCode}/${item.taskId}: ${item.profile} (${item.reason})`);
  }
  console.log('Invalid Evidence Projections:');
  console.log(`  count: ${report.evidence.invalidProjections.length}`);
  for (const item of report.evidence.invalidProjections) {
    console.log(`    - ${item.specCode}/${item.taskId}: ${item.error}`);
  }
}

function printCriticalReadinessReport(report: CriticalReadinessReport): void {
  console.log('Critical AC Readiness:');
  console.log(`  schemaVersion: ${report.schemaVersion}`);
  console.log(`  generatedAt: ${report.generatedAt}`);
  if (report.topic) console.log(`  topic: ${report.topic}`);
  console.log('Totals:');
  console.log(`  activeL3: ${report.totals.activeL3}`);
  console.log(`  ready: ${report.totals.ready}`);
  console.log(`  missing: ${report.totals.missing}`);
  console.log(`  empty: ${report.totals.empty}`);
  console.log(`  unknown: ${report.totals.unknown}`);
  console.log(`  readinessRatio: ${Math.round(report.readinessRatio * 100)}%`);
  console.log(`Summary: ${report.summary}`);
  console.log('Gaps:');
  const gaps = report.items.filter(item => item.status !== 'ready');
  if (gaps.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of gaps) {
      console.log(`  - ${item.specCode}: ${item.status}`);
      console.log(`    reason: ${item.reason}`);
      if (item.unknownCriticalIds.length > 0) {
        console.log(`    unknownCriticalIds: ${item.unknownCriticalIds.join(', ')}`);
      }
      console.log(`    suggestion: ${item.suggestion}`);
    }
  }
  console.log('Recommendations:');
  for (const recommendation of report.recommendations) console.log(`  - ${recommendation}`);
  console.log('Governed Upgrade:');
  console.log(`  readyForGovernedDefault: ${report.governedUpgrade.readyForGovernedDefault}`);
  console.log(`  note: ${report.governedUpgrade.note}`);
}

function printDocsConsistencyReport(report: DocsConsistencyReport): void {
  console.log('Docs consistency:');
  console.log(`  schemaVersion: ${report.schemaVersion}`);
  console.log(`  summary: errors=${report.summary.errors} warnings=${report.summary.warnings} infos=${report.summary.infos}`);
  if (report.findings.length === 0) {
    console.log('  ✓ ok');
    return;
  }
  for (const finding of report.findings) {
    const mark = finding.severity === 'error' ? '✗' : finding.severity === 'warning' ? '⚠' : 'ℹ';
    const path = finding.path ? ` (${finding.path})` : '';
    console.log(`  ${mark} [${finding.id}] ${finding.title}${path}`);
    console.log(`    ${finding.detail}`);
    if (finding.suggestion) console.log(`    fix: ${finding.suggestion}`);
  }
}

function splitCommaList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function printRemediationGroup(label: string, actions: Array<{ action: string; target: string; detail: string }>): void {
  console.log(`${label}:`);
  if (actions.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const action of actions) console.log(`  - ${action.action}: ${action.target} (${action.detail})`);
}

function printAgentDetection(detection: AgentProviderDetection): void {
  console.log('detected:');
  for (const provider of detection.providers) {
    for (const reason of detection.reasons[provider] ?? []) {
      console.log(`  - ${reason} -> ${provider}`);
    }
  }
}

function printAgentProviderList(): void {
  console.log('Supported AI agent providers:');
  for (const provider of listAgentProviders()) {
    console.log(`  - ${provider.provider}`);
    console.log(`    aliases: ${provider.aliases.join(', ')}`);
    console.log(`    files: ${provider.files.join(', ')}`);
    console.log(`    ${provider.description}`);
  }
  console.log('');
  console.log('Supported AI platform install commands:');
  for (const platform of listAgentPlatforms()) {
    console.log(`  - spec-manager ${platform.command} install`);
    console.log(`    target: ${platform.target}`);
    console.log(`    ${platform.description}`);
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
