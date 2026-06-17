import { listDecisions } from './decision.js';
import type { ProjectPaths } from './paths.js';
import { recommendWorkflowProfile } from './profile-recommendation.js';
import { listAllSpecs } from './spec-io.js';
import { listTasks } from './task.js';
import { buildLessonsReport } from './lessons.js';
import type {
  AgentBrief,
  AssistFinding,
  AssistSourceRef,
  BriefDecisionRef,
  BriefSpecRef,
  BriefTaskRef,
} from './capability-types.js';

export interface BuildAgentBriefInput {
  paths: ProjectPaths;
  request: string;
  topic?: string;
}

const MAX_SPECS = 5;
const MAX_DECISIONS = 3;
const MAX_TASKS = 5;
const MAX_BRIEF_LESSONS = 5;

export function buildAgentBrief(input: BuildAgentBriefInput): AgentBrief {
  const request = input.request.trim();
  if (!request) {
    throw new Error('AGENT_BRIEF_REQUEST_REQUIRED: --request must be non-empty');
  }

  const topic = normalizeOptional(input.topic) ?? inferTopic(request);
  const relevantSpecs = selectSpecs(input.paths, topic);
  const relevantDecisions = selectDecisions(input.paths, topic);
  const relevantTasks = selectTasks(input.paths, topic);
  const lessons = buildLessonsReport(input.paths, { topic: topic ?? undefined, request, limit: MAX_BRIEF_LESSONS }).lessons;
  const findings = buildFindings(topic, relevantSpecs, relevantDecisions, relevantTasks, lessons);

  return {
    schemaVersion: 'agent-brief.v1',
    request,
    topic,
    profileRecommendation: recommendWorkflowProfile({ paths: input.paths, request }),
    relevantSpecs,
    relevantDecisions,
    relevantTasks,
    lessons,
    suggestedReads: buildSuggestedReads(relevantSpecs, relevantDecisions, relevantTasks),
    findings,
    nextCommand: nextCommandFor(request, topic, relevantSpecs),
  };
}

export function inferTopic(request: string): string | null {
  const tokens = request.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  const preferred = tokens.find(token => token.includes('-'));
  return preferred ?? tokens[0] ?? null;
}

function selectSpecs(paths: ProjectPaths, topic: string | null): BriefSpecRef[] {
  if (!topic) return [];
  return listAllSpecs(paths)
    .filter(spec => spec.fm.topic === topic)
    .sort((a, b) => statusRank(b.fm.status) - statusRank(a.fm.status) || a.fm.code.localeCompare(b.fm.code))
    .slice(0, MAX_SPECS)
    .map(spec => ({
      code: spec.fm.code,
      level: spec.fm.level,
      status: spec.fm.status,
      title: spec.fm.title,
      sourceRef: {
        kind: 'spec',
        id: spec.fm.code,
        path: spec.filePath,
        summary: spec.fm.aiSummary ?? spec.fm.title,
      },
    }));
}

function selectDecisions(paths: ProjectPaths, topic: string | null): BriefDecisionRef[] {
  if (!topic) return [];
  return listDecisions(paths, { topic })
    .slice(0, MAX_DECISIONS)
    .map(decision => ({
      id: decision.id,
      status: decision.fm.status,
      title: decision.fm.what,
      sourceRef: {
        kind: 'decision',
        id: decision.id,
        path: decision.filePath,
        summary: decision.fm.what,
      },
    }));
}

function selectTasks(paths: ProjectPaths, topic: string | null): BriefTaskRef[] {
  if (!topic) return [];
  return listTasks(paths, { topic })
    .sort((a, b) => taskStatusRank(b.status) - taskStatusRank(a.status) || b.created.localeCompare(a.created))
    .slice(0, MAX_TASKS)
    .map(task => ({
      id: task.id,
      specCode: task.specCode,
      status: task.status,
      sourceRef: {
        kind: 'task',
        id: `${task.specCode}:${task.id}`,
        summary: `${task.status} task for ${task.specCode}`,
      },
    }));
}

function buildFindings(
  topic: string | null,
  specs: BriefSpecRef[],
  decisions: BriefDecisionRef[],
  tasks: BriefTaskRef[],
  lessons: AgentBrief['lessons'],
): AssistFinding[] {
  const findings: AssistFinding[] = [];
  if (!topic) {
    findings.push({
      id: 'brief.topic.unresolved',
      severity: 'advisory',
      title: 'Topic was not resolved',
      detail: 'Pass --topic to bind this brief to an existing project topic.',
      sourceRefs: [],
    });
  }
  if (topic && specs.length === 0 && decisions.length === 0 && tasks.length === 0 && lessons.length === 0) {
    findings.push({
      id: 'brief.history.none',
      severity: 'advisory',
      title: 'No related local history found',
      detail: `No specs, decisions, tasks, or lessons were found for topic ${topic}.`,
      sourceRefs: [],
      nextCommand: `spec-manager spec new L1 --topic ${topic} --title "..."`,
    });
  }
  return findings;
}

function buildSuggestedReads(
  specs: BriefSpecRef[],
  decisions: BriefDecisionRef[],
  tasks: BriefTaskRef[],
): AssistSourceRef[] {
  const refs = [
    ...specs.map(item => item.sourceRef),
    ...decisions.map(item => item.sourceRef),
    ...tasks.map(item => item.sourceRef),
  ];
  const seen = new Set<string>();
  return refs.filter(ref => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nextCommandFor(request: string, topic: string | null, specs: BriefSpecRef[]): string {
  if (!topic) return `spec-manager guide "${escapeForDoubleQuotes(request)}"`;
  if (specs.length === 0) return `spec-manager spec new L1 --topic ${topic} --title "..."`;
  return `spec-manager flow status --topic ${topic}`;
}

function statusRank(status: string): number {
  if (status === 'draft' || status === 'confirmed' || status === 'frozen') return 3;
  if (status === 'implemented') return 2;
  return 1;
}

function taskStatusRank(status: string): number {
  if (status === 'failed') return 5;
  if (status === 'running' || status === 'waiting') return 4;
  if (status === 'draft') return 3;
  if (status === 'completed') return 2;
  return 1;
}

function normalizeOptional(input: string | undefined): string | null {
  const trimmed = input?.trim();
  return trimmed ? trimmed : null;
}

function escapeForDoubleQuotes(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
