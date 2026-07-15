import { buildAgentBrief } from '../core/capability-brief.js';

export type AgentBriefForPresentation = Awaited<ReturnType<typeof buildAgentBrief>>;

export function renderBriefTextLines(brief: AgentBriefForPresentation): string[] {
  const lines = [
    'Agent Brief',
    `Request: ${brief.request}`,
    `Topic: ${brief.topic ?? '(unresolved)'}`,
  ];
  if (brief.profileRecommendation) {
    lines.push(`Recommended Profile: ${brief.profileRecommendation.recommendedProfile}`);
  }
  if (brief.relevantSpecs.length > 0) {
    lines.push('Relevant Specs:');
    for (const spec of brief.relevantSpecs) lines.push(`  - ${spec.code} ${spec.status} ${spec.title}`);
  }
  if (brief.relevantDecisions.length > 0) {
    lines.push('Relevant Decisions:');
    for (const decision of brief.relevantDecisions) lines.push(`  - ${decision.id} ${decision.status} ${decision.title}`);
  }
  if (brief.relevantTasks.length > 0) {
    lines.push('Relevant Tasks:');
    for (const task of brief.relevantTasks) lines.push(`  - ${task.id} ${task.status} ${task.specCode}`);
  }
  if (brief.lessons.length > 0) {
    lines.push('Lessons:');
    for (const lesson of brief.lessons) lines.push(`  - ${lesson.id} [${lesson.confidence}] ${lesson.title}`);
  }
  const design = brief.designContext;
  const summary = design?.summary;
  if (design && summary) {
    lines.push(`Design Context: ${summary.name ?? 'DESIGN.md'}`);
    lines.push(`  file: ${design.path}`);
    lines.push(`  lint: errors=${design.result.errors}, warnings=${design.result.warnings}, infos=${design.result.infos}`);
    lines.push(`  tokens: colors=${summary.tokenCounts.colors}, typography=${summary.tokenCounts.typography}, spacing=${summary.tokenCounts.spacing}, rounded=${summary.tokenCounts.rounded}, components=${summary.tokenCounts.components}`);
    if (summary.proseSummary.length > 0) {
      lines.push('  Prose:');
      for (const item of summary.proseSummary.slice(0, 5)) lines.push(`    - ${item}`);
    }
    if (brief.designGuidance && brief.designGuidance.length > 0) {
      lines.push('  Design Guidance:');
      for (const item of brief.designGuidance.slice(0, 4)) lines.push(`    - ${item}`);
    }
    const notableFindings = design.findings.filter(item => item.severity !== 'info').slice(0, 5);
    if (notableFindings.length > 0) {
      lines.push('  Findings:');
      for (const finding of notableFindings) {
        lines.push(`    - [${finding.severity}]${finding.path ? ` ${finding.path}:` : ''} ${finding.message}`);
      }
      const remainingFindings = design.findings.filter(item => item.severity !== 'info').length - notableFindings.length;
      if (remainingFindings > 0) {
        lines.push(`    - ... ${remainingFindings} more Design Context finding(s) omitted`);
      }
    }
  }
  if (brief.suggestedReads.length > 0) {
    lines.push('Suggested Reads:');
    for (const read of brief.suggestedReads) lines.push(`  - ${read.kind}:${read.id}${read.path ? ` (${read.path})` : ''}`);
  }
  lines.push(...renderFindingsTextLines(brief.findings));
  lines.push(`Next: ${brief.nextCommand}`);
  return lines;
}

export function renderFindingsTextLines(
  findings: Array<{ severity: string; id?: string; title: string; detail: string }>,
): string[] {
  if (findings.length === 0) return [];
  const lines = ['Findings:'];
  for (const finding of findings) {
    const id = finding.id ? ` ${finding.id}` : '';
    lines.push(`  - [${finding.severity}]${id} ${finding.title}`);
    lines.push(`    ${finding.detail}`);
  }
  return lines;
}
