import { Command } from 'commander';
import { getPaths } from '../core/paths.js';
import { buildAgentBrief } from '../core/capability-brief.js';
import { buildLessonsReport } from '../core/lessons.js';
import { buildSpecCritique } from '../core/spec-critic.js';
import { buildTaskNextReport } from '../core/task-next.js';
import { buildDriftCheckReport } from '../core/drift-check.js';
import { buildAcceptanceReport } from '../core/acceptance-report.js';
import { buildGuidedAssistReport } from '../core/guided-assist.js';
import { buildDeliverySummary } from '../core/delivery-summary.js';
import { requireInitialized } from './common.js';

export function registerCapabilityCommands(program: Command): void {
  const assist = program.command('assist').description('AI 能力补偿（guide / brief / lessons / 只读报告）');

  assist
    .command('guide')
    .description('推荐下一条 assist / workflow 命令')
    .requiredOption('--request <text>', '工作请求')
    .option('--topic <topic>', 'topic 名')
    .option('--spec <specCode>', '绑定 spec code')
    .option('--task <taskId>', '绑定 task id')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { request: string; topic?: string; spec?: string; task?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        if (!opts.request.trim()) {
          console.error('✗ GUIDED_ASSIST_REQUEST_REQUIRED: --request must be non-empty');
          process.exit(2);
        }
        if (opts.task && !opts.spec) {
          console.error('✗ GUIDED_ASSIST_SPEC_REQUIRED: --task requires --spec to avoid ambiguous task ids');
          process.exit(2);
        }
        const report = buildGuidedAssistReport({
          paths,
          request: opts.request,
          topic: opts.topic,
          specCode: opts.spec,
          taskId: opts.task,
        });
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        renderGuidedAssistText(report);
      } catch (err) {
        handleTaskSpecError(err);
      }
    });

  assist
    .command('brief')
    .description('生成 Agent Brief 与建议读取列表')
    .requiredOption('--request <text>', '工作请求')
    .option('--topic <topic>', 'topic 名')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { request: string; topic?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const brief = buildAgentBrief({ paths, request: opts.request, topic: opts.topic });
        if (opts.json) {
          console.log(JSON.stringify(brief, null, 2));
          return;
        }
        renderBriefText(brief);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('AGENT_BRIEF_REQUEST_REQUIRED:')) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  assist
    .command('critique <specCode>')
    .description('分层审查 L1/L2/L3 spec 质量缺口')
    .option('--json', '以 JSON 格式输出', false)
    .action((specCode: string, opts: { json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildSpecCritique(paths, specCode);
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        renderCritiqueText(report);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('SPEC_NOT_FOUND:')) {
          console.error(`✗ ${message}`);
          process.exit(1);
        }
        if (message.startsWith('SPEC_CRITIQUE_UNSUPPORTED_LEVEL:')) {
          console.error(`✗ ${message}`);
          process.exit(2);
        }
        throw err;
      }
    });

  assist
    .command('next <taskId>')
    .description('生成 Task 下一步导航报告')
    .requiredOption('--spec <specCode>', '限定 task 所属 L3 spec')
    .option('--json', '以 JSON 格式输出', false)
    .action((taskId: string, opts: { spec: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildTaskNextReport(paths, taskId, opts.spec);
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        renderTaskNextText(report);
      } catch (err) {
        handleTaskSpecError(err);
      }
    });

  assist
    .command('drift <taskId>')
    .description('检查 Task 变更文件是否偏离 L3 声明范围')
    .requiredOption('--spec <specCode>', '限定 task 所属 L3 spec')
    .option('--json', '以 JSON 格式输出', false)
    .action((taskId: string, opts: { spec: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildDriftCheckReport(paths, taskId, opts.spec);
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        renderDriftText(report);
      } catch (err) {
        handleTaskSpecError(err);
      }
    });

  assist
    .command('acceptance <taskId>')
    .description('生成 Task 验收证据汇总报告')
    .requiredOption('--spec <specCode>', '限定 task 所属 L3 spec')
    .option('--json', '以 JSON 格式输出', false)
    .action((taskId: string, opts: { spec: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildAcceptanceReport(paths, taskId, opts.spec);
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        renderAcceptanceText(report);
      } catch (err) {
        handleTaskSpecError(err);
      }
    });

  assist
    .command('delivery <taskId>')
    .description('生成面向用户交付的 Task 摘要')
    .requiredOption('--spec <specCode>', '限定 task 所属 L3 spec')
    .option('--json', '以 JSON 格式输出', false)
    .action((taskId: string, opts: { spec: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      try {
        const report = buildDeliverySummary(paths, taskId, opts.spec);
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        renderDeliverySummaryText(report);
      } catch (err) {
        handleTaskSpecError(err);
      }
    });

  assist
    .command('lessons')
    .description('生成项目经验 lessons 报告')
    .option('--topic <topic>', 'topic 名')
    .option('--request <text>', '可选请求文本，用于相关性排序')
    .option('--json', '以 JSON 格式输出', false)
    .action((opts: { topic?: string; request?: string; json: boolean }) => {
      const paths = getPaths();
      requireInitialized(paths);
      const report = buildLessonsReport(paths, { topic: opts.topic, request: opts.request });
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }
      renderLessonsText(report);
    });
}

function handleTaskSpecError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith('SPEC_NOT_FOUND:') || message.startsWith('TASK_NOT_FOUND:')) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  if (message.startsWith('UNKNOWN_CRITICAL_AC:')) {
    console.error(`✗ ${message}`);
    process.exit(2);
  }
  throw err;
}

function renderGuidedAssistText(report: Awaited<ReturnType<typeof buildGuidedAssistReport>>): void {
  console.log('Guided Assist');
  console.log(`Request: ${report.request || '(none)'}`);
  console.log(`Topic: ${report.topic ?? '(unresolved)'}`);
  console.log(`Spec: ${report.specCode ?? '-'}`);
  console.log(`Task: ${report.taskId ?? '-'}`);
  console.log(`Stage: ${report.stage}`);
  console.log(`Next: ${report.nextCommand}`);
  console.log(`Reason: ${report.reason}`);
  if (report.alternatives.length > 0) {
    console.log('Alternatives:');
    for (const item of report.alternatives) {
      console.log(`  - ${item.command}`);
      console.log(`    ${item.reason}`);
    }
  }
  renderFindings(report.findings);
}

function renderTaskNextText(report: Awaited<ReturnType<typeof buildTaskNextReport>>): void {
  console.log('Task Next');
  console.log(`Task: ${report.taskId}`);
  console.log(`Spec: ${report.specCode}`);
  console.log(`Status: ${report.taskStatus}`);
  console.log(`Current Step: ${report.currentStep ?? '-'}`);
  console.log(`Next: ${report.nextAction}`);
  if (report.incompleteSteps.length > 0) {
    console.log('Incomplete Steps:');
    for (const step of report.incompleteSteps) console.log(`  - [${step.status}] ${step.stepNo}: ${step.name}`);
  }
  if (report.lastFailure) console.log(`Last Failure: ${report.lastFailure}`);
  if (report.evidenceSummary) {
    const s = report.evidenceSummary;
    console.log(`Evidence: required=${s.required}, covered=${s.covered}, failed=${s.failed}, uncovered=${s.uncovered}`);
  }
  renderFindings(report.findings);
}

function renderDriftText(report: Awaited<ReturnType<typeof buildDriftCheckReport>>): void {
  console.log('Drift Check');
  console.log(`Task: ${report.taskId}`);
  console.log(`Spec: ${report.specCode}`);
  console.log(`Changed Files: ${report.changedFiles.length}`);
  for (const file of report.changedFiles) console.log(`  - ${file.status} ${file.path}`);
  console.log(`Declared Files: ${report.declaredFiles.length}`);
  for (const file of report.declaredFiles) console.log(`  - ${file}`);
  if (report.undeclaredFiles.length > 0) {
    console.log('Undeclared Files:');
    for (const file of report.undeclaredFiles) console.log(`  - ${file}`);
  }
  renderFindings(report.findings);
}

function renderAcceptanceText(report: Awaited<ReturnType<typeof buildAcceptanceReport>>): void {
  console.log('Acceptance Report');
  console.log(`Task: ${report.taskId}`);
  console.log(`Spec: ${report.specCode}`);
  console.log(`Profile: ${report.profile}`);
  console.log(`Summary: required=${report.summary.required}, covered=${report.summary.covered}, failed=${report.summary.failed}, uncovered=${report.summary.uncovered}`);
  console.log('Criteria:');
  if (report.criteria.length === 0) {
    console.log('  - none');
  } else {
    for (const criterion of report.criteria) {
      const refs = criterion.verificationIds.length > 0 ? ` by ${criterion.verificationIds.join(', ')}` : '';
      console.log(`  - [${criterion.status}] ${criterion.id}${refs}`);
      console.log(`    ${criterion.text}`);
    }
  }
  console.log('Verifications:');
  if (report.verifications.length === 0) {
    console.log('  - none');
  } else {
    for (const verification of report.verifications) {
      console.log(`  - ${verification.id} exit=${verification.exitCode} layer=${verification.layer}`);
      console.log(`    ${verification.command}`);
      console.log(`    ${verification.summary}`);
    }
  }
  console.log('Artifacts:');
  if (report.artifacts.length === 0) {
    console.log('  - none');
  } else {
    for (const artifact of report.artifacts) console.log(`  - ${artifact}`);
  }
  console.log('Human Acceptance:');
  renderFindingList(report.humanAcceptance);
  console.log('Residual Risk:');
  renderFindingList(report.residualRisk);
}

function renderDeliverySummaryText(report: Awaited<ReturnType<typeof buildDeliverySummary>>): void {
  console.log('Delivery Summary');
  console.log(`Task: ${report.taskId}`);
  console.log(`Spec: ${report.specCode}`);
  console.log(`Status: ${report.taskStatus}`);
  console.log(`Headline: ${report.headline}`);
  console.log('');
  console.log('Summary:');
  renderSimpleList(report.summary);
  console.log('');
  console.log('Steps:');
  if (report.steps.length === 0) {
    console.log('  - none');
  } else {
    for (const step of report.steps) console.log(`  - [${step.status}] ${step.stepNo}: ${step.name}`);
  }
  console.log('');
  console.log('Verifications:');
  if (report.verifications.length === 0) {
    console.log('  - none');
  } else {
    for (const verification of report.verifications) {
      console.log(`  - ${verification.id} ${verification.status} layer=${verification.layer}`);
      console.log(`    ${verification.command}`);
      console.log(`    ${verification.summary}`);
    }
  }
  console.log('');
  console.log('Artifacts:');
  renderSimpleList(report.artifacts);
  console.log('');
  console.log('Human Acceptance:');
  renderFindingList(report.humanAcceptance);
  console.log('');
  console.log('Residual Risk:');
  renderFindingList(report.residualRisk);
  console.log('');
  renderFindings(report.findings);
  console.log('');
  console.log('Next Action:');
  console.log(`  ${report.nextAction}`);
}

function renderCritiqueText(report: Awaited<ReturnType<typeof buildSpecCritique>>): void {
  console.log('Spec Critique');
  console.log(`Spec: ${report.specCode}`);
  console.log(`Level: ${report.level}`);
  console.log(`Status: ${report.status}`);
  console.log(`Summary: blocking=${report.summary.blocking}, warning=${report.summary.warning}, advisory=${report.summary.advisory}`);
  if (report.findings.length === 0) {
    console.log('(no findings)');
    return;
  }
  renderFindings(report.findings);
}

function renderBriefText(brief: Awaited<ReturnType<typeof buildAgentBrief>>): void {
  console.log('Agent Brief');
  console.log(`Request: ${brief.request}`);
  console.log(`Topic: ${brief.topic ?? '(unresolved)'}`);
  if (brief.profileRecommendation) {
    console.log(`Recommended Profile: ${brief.profileRecommendation.recommendedProfile}`);
  }
  if (brief.relevantSpecs.length > 0) {
    console.log('Relevant Specs:');
    for (const spec of brief.relevantSpecs) console.log(`  - ${spec.code} ${spec.status} ${spec.title}`);
  }
  if (brief.relevantDecisions.length > 0) {
    console.log('Relevant Decisions:');
    for (const decision of brief.relevantDecisions) console.log(`  - ${decision.id} ${decision.status} ${decision.title}`);
  }
  if (brief.relevantTasks.length > 0) {
    console.log('Relevant Tasks:');
    for (const task of brief.relevantTasks) console.log(`  - ${task.id} ${task.status} ${task.specCode}`);
  }
  if (brief.lessons.length > 0) {
    console.log('Lessons:');
    for (const lesson of brief.lessons) console.log(`  - ${lesson.id} [${lesson.confidence}] ${lesson.title}`);
  }
  const design = brief.designContext;
  const summary = design?.summary;
  if (design && summary) {
    console.log(`Design Context: ${summary.name ?? 'DESIGN.md'}`);
    console.log(`  file: ${design.path}`);
    console.log(`  lint: errors=${design.result.errors}, warnings=${design.result.warnings}, infos=${design.result.infos}`);
    console.log(`  tokens: colors=${summary.tokenCounts.colors}, typography=${summary.tokenCounts.typography}, spacing=${summary.tokenCounts.spacing}, rounded=${summary.tokenCounts.rounded}, components=${summary.tokenCounts.components}`);
    if (summary.proseSummary.length > 0) {
      console.log('  Prose:');
      for (const item of summary.proseSummary.slice(0, 5)) console.log(`    - ${item}`);
    }
    const notableFindings = design.findings.filter(item => item.severity !== 'info').slice(0, 5);
    if (notableFindings.length > 0) {
      console.log('  Findings:');
      for (const finding of notableFindings) {
        console.log(`    - [${finding.severity}]${finding.path ? ` ${finding.path}:` : ''} ${finding.message}`);
      }
    }
  }
  if (brief.suggestedReads.length > 0) {
    console.log('Suggested Reads:');
    for (const read of brief.suggestedReads) console.log(`  - ${read.kind}:${read.id}${read.path ? ` (${read.path})` : ''}`);
  }
  if (brief.findings.length > 0) {
    renderFindings(brief.findings);
  }
  console.log(`Next: ${brief.nextCommand}`);
}

function renderLessonsText(report: Awaited<ReturnType<typeof buildLessonsReport>>): void {
  console.log('Lessons');
  console.log(`Topic: ${report.topic ?? '(unresolved)'}`);
  if (report.lessons.length === 0) {
    console.log('(no lessons)');
  } else {
    for (const lesson of report.lessons) {
      console.log(`- ${lesson.id} [${lesson.confidence}] ${lesson.title}`);
      console.log(`  ${lesson.detail}`);
    }
  }
  if (report.findings.length > 0) {
    renderFindings(report.findings);
  }
}

function renderFindings(findings: Array<{ severity: string; id?: string; title: string; detail: string }>): void {
  if (findings.length === 0) return;
  console.log('Findings:');
  renderFindingList(findings);
}

function renderFindingList(findings: Array<{ severity: string; id?: string; title: string; detail: string }>): void {
  if (findings.length === 0) {
    console.log('  - none');
    return;
  }
  for (const finding of findings) {
    const id = finding.id ? `${finding.id}: ` : '';
    console.log(`  - [${finding.severity}] ${id}${finding.title}`);
    console.log(`    ${finding.detail}`);
  }
}

function renderSimpleList(items: string[]): void {
  if (items.length === 0) {
    console.log('  - none');
    return;
  }
  for (const item of items) console.log(`  - ${item}`);
}
