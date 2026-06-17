import { listDecisions } from './decision.js';
import { listIncidents } from './incident.js';
import type { ProjectPaths } from './paths.js';
import { listTasks, type TaskRecord } from './task.js';
import type { AssistFinding, AssistSourceRef, Lesson, LessonsReport } from './capability-types.js';

export interface BuildLessonsOptions {
  topic?: string;
  request?: string;
  limit?: number;
}

interface CandidateLesson extends Lesson {
  score: number;
}

const DEFAULT_LIMIT = 8;
const DETAIL_MAX = 260;

export function buildLessonsReport(paths: ProjectPaths, opts: BuildLessonsOptions = {}): LessonsReport {
  const topic = normalizeOptional(opts.topic);
  const requestTokens = tokenize(opts.request ?? '');
  const lessons = collectLessons(paths, topic, requestTokens)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, opts.limit ?? DEFAULT_LIMIT)
    .map(({ score: _score, ...lesson }) => lesson);

  const findings: AssistFinding[] = [];
  if (lessons.length === 0) {
    findings.push({
      id: 'lessons.none',
      severity: 'advisory',
      title: 'No related lessons found',
      detail: topic
        ? `No failed tasks, active decisions, or incidents were found for topic ${topic}.`
        : 'No topic was provided and no global lessons were found.',
      sourceRefs: [],
    });
  }

  return {
    schemaVersion: 'lessons.v1',
    topic,
    lessons,
    findings,
  };
}

function collectLessons(paths: ProjectPaths, topic: string | null, requestTokens: string[]): CandidateLesson[] {
  return [
    ...taskLessons(paths, topic, requestTokens),
    ...decisionLessons(paths, topic, requestTokens),
    ...incidentLessons(paths, topic, requestTokens),
  ];
}

function taskLessons(paths: ProjectPaths, topic: string | null, requestTokens: string[]): CandidateLesson[] {
  const tasks = listTasks(paths, topic ? { topic } : undefined)
    .filter(task => task.status === 'failed' || task.lastFailedOutput || hasFailedStep(task));

  return tasks.map(task => {
    const failedStep = task.steps?.find(step => step.status === 'failed');
    const detail = truncate(
      summaryFromJson(task.lastFailedOutput)
        ?? task.errorMessage
        ?? summaryFromJson(failedStep?.outputJson)
        ?? `Task ${task.id} for ${task.specCode} did not complete successfully.`,
    );
    const title = `Previous task failure: ${task.specCode} ${task.id}`;
    const sourceRef = taskSource(task);
    const score = scoreCandidate(topic, sourceRef.summary ?? '', requestTokens, task.status === 'failed' ? 30 : 20);
    return {
      id: `task:${task.specCode}:${task.id}`,
      topic: topicFromSpecCode(task.specCode),
      title,
      detail,
      sourceRefs: [sourceRef],
      confidence: confidenceFor(score),
      score,
    };
  });
}

function decisionLessons(paths: ProjectPaths, topic: string | null, requestTokens: string[]): CandidateLesson[] {
  return listDecisions(paths, { topic: topic ?? undefined })
    .map(decision => {
      const detail = truncate(decision.fm.why ? `${decision.fm.what} Why: ${decision.fm.why}` : decision.fm.what);
      const sourceRef: AssistSourceRef = {
        kind: 'decision',
        id: decision.id,
        path: decision.filePath,
        summary: decision.fm.what,
      };
      const score = scoreCandidate(topic, `${decision.fm.what} ${decision.fm.why ?? ''}`, requestTokens, 25);
      return {
        id: `decision:${decision.id}`,
        topic: decision.fm.topic,
        title: `Active decision: ${decision.id}`,
        detail,
        sourceRefs: [sourceRef],
        confidence: confidenceFor(score),
        score,
      };
    });
}

function incidentLessons(paths: ProjectPaths, topic: string | null, requestTokens: string[]): CandidateLesson[] {
  return listIncidents(paths)
    .filter(incident => !topic || incident.fm.specCode?.startsWith(`${topic}-`))
    .map(incident => {
      const detail = truncate(firstNonEmptyLine(incident.content) ?? incident.fm.title);
      const sourceRef: AssistSourceRef = {
        kind: 'incident',
        id: incident.id,
        path: incident.filePath,
        summary: incident.fm.title,
      };
      const score = scoreCandidate(topic, `${incident.fm.title} ${incident.content}`, requestTokens, 22);
      return {
        id: `incident:${incident.id}`,
        topic: incident.fm.specCode ? topicFromSpecCode(incident.fm.specCode) : null,
        title: `Incident: ${incident.fm.title}`,
        detail,
        sourceRefs: [sourceRef],
        confidence: confidenceFor(score),
        score,
      };
    });
}

function hasFailedStep(task: TaskRecord): boolean {
  return Boolean(task.steps?.some(step => step.status === 'failed'));
}

function taskSource(task: TaskRecord): AssistSourceRef {
  return {
    kind: 'task',
    id: `${task.specCode}:${task.id}`,
    summary: `${task.status} task for ${task.specCode}`,
  };
}

function scoreCandidate(topic: string | null, text: string, requestTokens: string[], base: number): number {
  const tokenMatches = requestTokens.filter(token => text.toLowerCase().includes(token)).length;
  return base + (topic ? 40 : 0) + tokenMatches * 5;
}

function confidenceFor(score: number): Lesson['confidence'] {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function topicFromSpecCode(specCode: string): string | null {
  const match = specCode.match(/^(.+)-L\d/);
  return match?.[1] ?? null;
}

function tokenize(input: string): string[] {
  return [...new Set(input.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])];
}

function truncate(input: string): string {
  const compact = input.replace(/\s+/g, ' ').trim();
  return compact.length > DETAIL_MAX ? `${compact.slice(0, DETAIL_MAX - 1)}…` : compact;
}

function firstNonEmptyLine(input: string): string | null {
  return input.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? null;
}

function normalizeOptional(input: string | undefined): string | null {
  const trimmed = input?.trim();
  return trimmed ? trimmed : null;
}

function summaryFromJson(input: string | undefined | null): string | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input) as { summary?: unknown; error?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary : null;
    const error = typeof parsed.error === 'string' ? parsed.error : null;
    return summary ?? error ?? input;
  } catch {
    return input;
  }
}
