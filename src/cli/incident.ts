/**
 * incident 子命令：
 *   new --rule R1 --severity high --title X [--description D] [--spec S] [--task T]
 *   list [--status open]
 *   show <id>
 *   update <id> --status mitigated|resolved|closed [--note "..."]
 */

import { Command } from 'commander';
import { getPaths } from '../core/paths.js';
import { createIncident, listIncidents, findIncident, updateIncidentStatus, type Severity, type IncidentStatus } from '../core/incident.js';

const INCIDENT_STATUSES: IncidentStatus[] = ['open', 'mitigated', 'resolved', 'closed'];

export function registerIncidentCommands(program: Command): void {
  const inc = program
    .command('incident')
    .description('Incident 记录（rule 违反时的根因 + 修复 + 复盘）');

  inc
    .command('new')
    .description('创建 incident（写入 .spec-manager/incidents/INC-YYYYMMDD-NNN.md）')
    .requiredOption('--rule <ruleId>', '触发的规则 ID（R1-R24）')
    .requiredOption('--severity <severity>', '严重度: low|medium|high|critical')
    .requiredOption('--title <title>', '一句话标题')
    .option('--description <desc>', '详细描述（触发场景）')
    .option('--spec <specCode>', '关联的 spec')
    .option('--task <taskCode>', '关联的 task')
    .option('--related-decision <list>', '关联的决策卡片（逗号分隔，如 DC-001,DC-002）')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { rule: string; severity: string; title: string; description?: string; spec?: string; task?: string; relatedDecision?: string; json: boolean }) => {
      const paths = getPaths();
      const relatedDecisions = opts.relatedDecision
        ? opts.relatedDecision.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      const result = createIncident({
        paths,
        ruleId: opts.rule,
        severity: opts.severity as Severity,
        title: opts.title,
        description: opts.description,
        specCode: opts.spec,
        taskCode: opts.task,
        relatedDecisions,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`✓ Incident ${result.id} created`);
      console.log(`  file: ${result.filePath}`);
      console.log(`  rule: ${result.fm.ruleId} | severity: ${result.fm.severity} | status: ${result.fm.status}`);
      if (result.fm.relatedDecisions && result.fm.relatedDecisions.length > 0) {
        console.log(`  decisions: ${result.fm.relatedDecisions.join(', ')}`);
      }
    });

  inc
    .command('list')
    .description('列出 incident（按创建时间倒序）')
    .option('--status <status>', '按 status 过滤: open|mitigated|resolved|closed')
    .option('--related-decision <id>', '按关联决策过滤（返回 relatedDecisions 含此 ID 的）')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { status?: string; relatedDecision?: string; json: boolean }) => {
      const paths = getPaths();
      if (opts.status && !INCIDENT_STATUSES.includes(opts.status as IncidentStatus)) {
        console.error(`✗ --status 非法: ${opts.status}（必须 ${INCIDENT_STATUSES.join('|')}）`);
        process.exit(2);
      }
      const all = listIncidents(paths, {
        status: opts.status as IncidentStatus | undefined,
        relatedDecision: opts.relatedDecision,
      });
      if (opts.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        console.log('(no incidents)');
        return;
      }
      for (const i of all) {
        const sev = i.fm.severity.padEnd(8);
        const st = i.fm.status.padEnd(10);
        const dec = i.fm.relatedDecisions && i.fm.relatedDecisions.length > 0
          ? ` {${i.fm.relatedDecisions.join(',')}}`
          : '';
        console.log(`  ${i.id}  [${sev}] [${st}] ${i.fm.ruleId}  ${i.fm.title}${dec}`);
      }
    });

  inc
    .command('show <id>')
    .description('查看 incident 详情')
    .option('--json', '以 JSON 格式输出', false)
    .action((id: string, opts: { json: boolean }) => {
      const paths = getPaths();
      const i = findIncident(paths, id);
      if (!i) {
        console.error(`✗ Incident not found: ${id}`);
        process.exit(1);
      }
      if (opts.json) {
        console.log(JSON.stringify(i, null, 2));
        return;
      }
      console.log(`# ${i.id} — ${i.fm.title}`);
      console.log('');
      console.log(`规则: ${i.fm.ruleId} | 严重度: ${i.fm.severity} | 状态: ${i.fm.status}`);
      console.log(`spec: ${i.fm.specCode ?? '-'}  task: ${i.fm.taskCode ?? '-'}`);
      console.log(`创建: ${i.fm.created}  更新: ${i.fm.updated}`);
      console.log('');
      console.log(i.content);
    });

  inc
    .command('update <id>')
    .description('更新 incident 状态（推进闭环）')
    .requiredOption('--status <status>', '新状态: open|mitigated|resolved|closed')
    .option('--note <note>', '状态变更说明（追加到正文）')
    .action((id: string, opts: { status: string; note?: string }) => {
      const paths = getPaths();
      const updated = updateIncidentStatus(paths, id, opts.status as IncidentStatus, opts.note);
      console.log(`✓ Incident ${updated.id} → ${updated.fm.status}`);
    });
}
