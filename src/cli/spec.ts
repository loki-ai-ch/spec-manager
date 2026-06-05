import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { getPaths } from '../core/paths.js';
import {
  createSpec,
  findSpecByCode,
  generateSpecCode,
  isPlaceholderContent,
  listAllSpecs,
  migrateSpecPaths,
  updateSpec,
  DESC_MAX_LEN,
} from '../core/spec-io.js';
import { canTransition, isActiveStatus, nextStatuses } from '../core/status.js';
import { validateSpecContent, validatePlanJson, type SpecLevel } from '../core/validate.js';
import { hit } from '../core/audit.js';
import { listDecisions } from '../core/decision.js';
import { suggestAfterSpecCommand } from '../core/usability.js';
import { fail, requireInitialized } from './common.js';

export function registerSpec(program: Command): void {
  const cmd = program.command('spec').description('Spec 增删改查');

  cmd
    .command('new <level>')
    .description('创建 Spec（L0/L1/L2/L3）。L2/L3 需 --parent。--code 可选,不传自动生成 <topic>-<level>')
    .requiredOption('--topic <topic>', 'topic 名（如 auth）')
    .option('--code <code>', 'spec code（如 auth-L1）；不传则自动生成 <topic>-<level>')
    .requiredOption('--title <title>', 'spec 标题')
    .option('--parent <parentCode>', '父 spec code（L2→L1, L3→L2）')
    .option('--desc <desc>', `描述后缀（≤${DESC_MAX_LEN} 字符，如 readme/batch/tests），追加到 code 末尾`)
    .option('--milestone <milestone>', '迭代版本号（如 v1.0 / v1.0-beta）')
    .option('--allow-duplicate-topic', '允许同 topic 下创建额外 L1（已确认不是重复需求）', false)
    .action((level: string, opts) => {
      if (!['L0', 'L1', 'L2', 'L3'].includes(level)) {
        fail(`✗ level 必须是 L0/L1/L2/L3，收到 "${level}"`, 2);
      }
      const paths = getPaths();
      requireInitialized(paths);
      if ((level === 'L2' || level === 'L3') && !opts.parent) {
        fail(`✗ R7: ${level} 必须有 --parent 指向父 spec code`, 2);
      }
      if (opts.desc) {
        if (opts.desc.length > DESC_MAX_LEN) {
          fail(`✗ --desc 超过 ${DESC_MAX_LEN} 字符（当前 ${opts.desc.length}）`, 2);
        }
        if (!/^[a-z0-9-]+$/.test(opts.desc)) {
          fail(`✗ --desc 只允许小写字母、数字、连字符`, 2);
        }
      }
      // 点分编号：统计同父的已有子 spec 数量，用于生成下一个索引
      let siblingCount = 0;
      if (opts.parent) {
        const allSpecs = listAllSpecs(paths);
        siblingCount = allSpecs.filter(s => s.fm.parentCode === opts.parent).length;
      }
      const code = opts.code ?? generateSpecCode(opts.topic, level as SpecLevel, opts.parent, siblingCount, opts.desc);
      if (findSpecByCode(paths, code)) {
        fail(`✗ code 重复: ${code}`, 2);
      }
      if (level === 'L1') {
        hit({ paths, ruleId: 'R16', specCode: code });
        const existingL1 = listAllSpecs(paths)
          .filter(s => s.fm.level === 'L1' && s.fm.topic === opts.topic && isActiveStatus(s.fm.status));
        if (existingL1.length > 0 && !opts.allowDuplicateTopic) {
          const decisions = listDecisions(paths, { topic: opts.topic, includeAll: true });
          const lines = [`✗ R16: topic=${opts.topic} 已有 active L1，创建新 L1 前必须先查重`];
          for (const s of existingL1) lines.push(`  - ${s.fm.code} (${s.fm.status}) ${s.fm.title}`);
          lines.push(`  历史决策: ${decisions.length} 张`);
          lines.push(`  若确认不是重复需求，请加 --allow-duplicate-topic`);
          fail(lines.join('\n'), 2);
        }
      }
      const rec = createSpec({
        paths,
        code,
        level: level as SpecLevel,
        title: opts.title,
        topic: opts.topic,
        parentCode: opts.parent ?? null,
        milestone: opts.milestone,
      });
      console.log(`✓ 已创建 ${level} spec`);
      console.log(`  code:     ${rec.fm.code}`);
      console.log(`  file:     ${rec.filePath}`);
      console.log(`  status:   ${rec.fm.status}`);
      if (rec.fm.milestone) console.log(`  milestone:${rec.fm.milestone}`);
      console.log(`\nNext: ${suggestAfterSpecCommand(rec)}`);
    });

  cmd
    .command('list')
    .description('列出 specs（默认隐藏 archived）')
    .option('--level <level>', '按层过滤 L0/L1/L2/L3')
    .option('--topic <topic>', '按 topic 过滤')
    .option('--status <status>', '按状态过滤 draft/confirmed/frozen/implemented/archived')
    .option('--include-archived', '包含 archived')
    .action((opts) => {
      const paths = getPaths();
      requireInitialized(paths);
      let specs = listAllSpecs(paths);
      if (opts.level) specs = specs.filter(s => s.fm.level === opts.level);
      if (opts.topic) specs = specs.filter(s => s.fm.topic === opts.topic);
      if (opts.status) specs = specs.filter(s => s.fm.status === opts.status);
      if (!opts.includeArchived) specs = specs.filter(s => isActiveStatus(s.fm.status));
      specs.sort((a, b) => a.fm.code.localeCompare(b.fm.code));
      if (specs.length === 0) {
        console.log('(无匹配 spec)');
        return;
      }
      console.log(`${'CODE'.padEnd(28)}${'LEVEL'.padEnd(6)}${'STATUS'.padEnd(13)}TOPIC        TITLE`);
      console.log('-'.repeat(100));
      for (const s of specs) {
        console.log(
          `${s.fm.code.padEnd(28)}${s.fm.level.padEnd(6)}${s.fm.status.padEnd(13)}${s.fm.topic.padEnd(13)}${s.fm.title}`,
        );
      }
      console.log(`\n共 ${specs.length} 条`);
    });

  cmd
    .command('show <code>')
    .description('查看 spec 详情。默认窄视图（R19），--include-content 才返回正文。')
    .option('--include-content', '返回完整 contentTemplate（窄视图默认不含）')
    .action((code, opts) => {
      const paths = getPaths();
      const rec = findSpecByCode(paths, code);
      if (!rec) {
        fail(`✗ 未找到: ${code}`);
      }
      const fm = rec.fm;
      console.log('--- metadata ---');
      console.log(`code:        ${fm.code}`);
      console.log(`level:       ${fm.level}`);
      console.log(`title:       ${fm.title}`);
      console.log(`topic:       ${fm.topic}`);
      console.log(`parent:      ${fm.parentCode ?? '(null)'}`);
      console.log(`status:      ${fm.status}`);
      console.log(`aiSummary:   ${fm.aiSummary || '(空)'}`);
      console.log(`created:     ${fm.created}`);
      console.log(`updated:     ${fm.updated}`);
      console.log(`relations:   ${fm.relations?.length ?? 0}`);
      if (opts.includeContent) {
        console.log('\n--- content ---');
        console.log(rec.content);
      } else {
        hit({ paths, ruleId: 'R19', specCode: code });
        console.log('\n(省略正文；加 --include-content 查看)');
      }
    });

  cmd
    .command('update <code>')
    .description('更新 spec：--content 写正文、--ai-summary 写摘要（≤300 字符）、--change-summary 写变更说明')
    .option('--content <file>', '从文件读 contentTemplate 内容（- 表示 stdin）')
    .option('--ai-summary <s>', 'aiSummary（≤300 字符）')
    .option('--change-summary <s>', '本次修改的原因说明')
    .action((code, opts) => {
      const paths = getPaths();
      const rec = findSpecByCode(paths, code);
      if (!rec) {
        fail(`✗ 未找到: ${code}`);
      }
      const patch: Parameters<typeof updateSpec>[2] = {};
      if (opts.content) {
        patch.content = opts.content === '-' ? readStdin() : readFileSync(opts.content, 'utf8');
      }
      if (opts.aiSummary) patch.aiSummary = opts.aiSummary;
      if (opts.changeSummary) patch.changeSummary = opts.changeSummary;

      const result = updateSpec(paths, code, patch);
      for (const w of result.warnings) console.warn(`⚠ ${w}`);
      // 写完自动跑一次非阻断校验
      const warnings = validateSpecContent(result.record.fm.level, result.record.content);
      for (const w of warnings) {
        const sym = w.level === 'warn' ? '⚠' : 'ℹ';
        console.log(`${sym} [${w.rule}] ${w.message}`);
      }
      console.log(`✓ 已更新 ${code}（status: ${result.record.fm.status}）`);
      console.log(`Next: ${suggestAfterSpecCommand(result.record)}`);
    });

  // 状态推进命令
  for (const { cmd: sub, status: target } of [
    { cmd: 'confirm', status: 'confirmed' as const },
    { cmd: 'freeze', status: 'frozen' as const },
    { cmd: 'implement', status: 'implemented' as const },
  ]) {
    cmd
      .command(`${sub} <code>`)
      .description(`推进 status 到 ${target}（R2: 仅用户/自动 cascade 触发）`)
      .option('--force', '强制推进（跳过 R3 L3 保护）', false)
      .action((code, opts: { force: boolean }) => {
        const paths = getPaths();
        const rec = findSpecByCode(paths, code);
        if (!rec) {
          fail(`✗ 未找到: ${code}`);
        }
        // R22: 推进到 confirmed/frozen 之前,contentTemplate 不能只有占位
        if ((target === 'confirmed' || target === 'frozen') && isPlaceholderContent(rec.content)) {
          fail(
            `✗ R22: ${code} 的 contentTemplate 仍是占位（"<!-- 在此粘贴正文 -->"）\n` +
            `  请先: spec-manager spec update ${code} --content <file> --ai-summary "..." --change-summary "..."`,
            2,
          );
        }
        if (!canTransition(rec.fm.status, target)) {
          fail(`✗ 状态非法: ${rec.fm.status} → ${target}\n  合法的下一态：${nextStatuses(rec.fm.status).join(', ')}`, 2);
        }
        // R3: L3 的 implemented 应由 task cascade 触发，手动推进需 --force
        if (target === 'implemented' && rec.fm.level === 'L3' && rec.fm.status === 'frozen' && !opts.force) {
          fail(
            `⚠ R3: L3 spec ${code} 的 implemented 应由 task complete 自动 cascade\n` +
            `  如确需手动推进，请用: spec-manager spec implement ${code} --force`,
            2,
          );
        }
        hit({ paths, ruleId: 'R2', specCode: code });
        hit({ paths, ruleId: 'R9', specCode: code });
        const { record } = updateSpec(paths, code, { status: target, changeSummary: `${rec.fm.status} → ${target}` });
        console.log(`✓ ${code}: ${rec.fm.status} → ${target}`);
        console.log(`Next: ${suggestAfterSpecCommand(record)}`);
      });
  }

  cmd
    .command('validate <code>')
    .description('校验 spec 正文（必填段 + RFC 2119）。warning-only，exit 0。')
    .action((code) => {
      const paths = getPaths();
      const rec = findSpecByCode(paths, code);
      if (!rec) {
        fail(`✗ 未找到: ${code}`);
      }
      const warnings = validateSpecContent(rec.fm.level, rec.content);
      if (warnings.length === 0) {
        console.log(`✓ ${code} (${rec.fm.level}): 所有必填段齐全，无 RFC 2119 警告`);
      } else {
        for (const w of warnings) {
          const sym = w.level === 'warn' ? '⚠' : 'ℹ';
          console.log(`${sym} [${w.rule}] ${w.message}`);
        }
      }
    });

  cmd
    .command('add-relation <code>')
    .description('添加 spec 关联（基于/替代/实现/参考）')
    .requiredOption('--target <targetCode>', '目标 spec code')
    .requiredOption('--type <type>', '关联类型：based_on | supersedes | implements | references')
    .action((code, opts) => {
      const paths = getPaths();
      if (!['based_on', 'supersedes', 'implements', 'references'].includes(opts.type)) {
        fail(`✗ type 必须是 based_on | supersedes | implements | references`, 2);
      }
      updateSpec(paths, code, { addRelation: { type: opts.type, target: opts.target } });
      console.log(`✓ ${code} --[${opts.type}]--> ${opts.target}`);
    });

  cmd
    .command('migrate-paths')
    .description('迁移 active spec 文件名：<code>-YYYYMMDD.md → <code>.md（读取仍兼容旧格式）')
    .option('--dry-run', '只显示迁移计划，不改文件', false)
    .action((opts: { dryRun: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const result = migrateSpecPaths(paths, { dryRun: opts.dryRun });
      if (result.migrated.length === 0) {
        console.log('✓ 无需迁移，active spec 文件名已是 canonical 格式');
        return;
      }
      console.log(`${opts.dryRun ? '计划迁移' : '✓ 已迁移'} ${result.migrated.length} 个 spec 文件:`);
      for (const m of result.migrated) {
        console.log(`  ${m.code}`);
        console.log(`    from: ${m.from}`);
        console.log(`    to:   ${m.to}`);
      }
    });

  cmd
    .command('validate-plan <file>')
    .description('校验 planJson 格式（INC-005 字段名 / R11 步数 / R10 末步验证）')
    .action((file) => {
      const plan = JSON.parse(readFileSync(file, 'utf8'));
      const warnings = validatePlanJson(plan);
      if (warnings.length === 0) {
        console.log(`✓ planJson 校验通过`);
        return;
      }
      const paths = getPaths();
      const hitRules = new Set<string>();
      for (const w of warnings) {
        console.log(`⚠ [${w.rule}] ${w.message}`);
        // R10/R11 是规范违反:落 audit 让人 review
        if (w.rule === 'R10' || w.rule === 'R11') {
          hitRules.add(w.rule);
        }
      }
      for (const ruleId of hitRules) {
        hit({ paths, ruleId });
      }
    });
}

function readStdin(): string {
  return readFileSync(0, 'utf8');
}
