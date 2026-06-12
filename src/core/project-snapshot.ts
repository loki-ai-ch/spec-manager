import { readFileSync } from 'node:fs';
import type { ProjectPaths } from './paths.js';
import { listAllSpecs, type SpecRecord } from './spec-io.js';
import type { TaskRecord } from './task.js';
import { listDecisions, type DecisionRecord } from './decision.js';
import { listIncidents, type IncidentRecord } from './incident.js';
import { listTaskLinkedChangeProposals, type TaskLinkedChangeProposal } from './delta.js';
import { listTopicMetaFiles } from './repository.js';
import { TASK_FILE_EXT } from './constants.js';

export type ProjectSnapshotInclude = 'specs' | 'tasks' | 'decisions' | 'incidents' | 'changes';

export interface BuildProjectSnapshotOptions {
  include?: ProjectSnapshotInclude[];
  topic?: string;
}

export interface ProjectSnapshotIndexes {
  specByCode: Map<string, SpecRecord>;
  tasksBySpec: Map<string, TaskRecord[]>;
  childrenByParent: Map<string, SpecRecord[]>;
  decisionsByDocCode: Map<string, DecisionRecord[]>;
  decisionById: Map<string, DecisionRecord>;
  taskByKey: Map<string, TaskRecord>;
  changesByTaskKey: Map<string, TaskLinkedChangeProposal[]>;
}

export interface ProjectSnapshot {
  specs: SpecRecord[];
  tasks: TaskRecord[];
  decisions: DecisionRecord[];
  incidents: IncidentRecord[];
  changes: TaskLinkedChangeProposal[];
  indexes: ProjectSnapshotIndexes;
  scope?: ProjectSnapshotScope;
}

export interface ProjectSnapshotScope {
  include: ProjectSnapshotInclude[];
  topic?: string;
}

const DEFAULT_INCLUDE: ProjectSnapshotInclude[] = ['specs', 'tasks', 'decisions', 'incidents', 'changes'];

export function buildProjectSnapshot(paths: ProjectPaths, opts?: BuildProjectSnapshotOptions): ProjectSnapshot {
  const include = new Set(opts?.include ?? DEFAULT_INCLUDE);
  const allSpecs = listAllSpecs(paths);
  const topicSpecCodes = opts?.topic
    ? new Set(allSpecs.filter(spec => spec.fm.topic === opts.topic).map(spec => spec.fm.code))
    : null;

  const specs = include.has('specs')
    ? filterByTopic(allSpecs, opts?.topic)
    : [];
  const tasks = include.has('tasks')
    ? listSnapshotTasks(paths).filter(task => !topicSpecCodes || topicSpecCodes.has(task.specCode))
    : [];
  const decisions = include.has('decisions')
    ? listDecisions(paths, { includeAll: true }).filter(decision => !opts?.topic || decision.fm.topic === opts.topic)
    : [];
  const incidents = include.has('incidents')
    ? listIncidents(paths).filter(incident => !topicSpecCodes || !incident.fm.specCode || topicSpecCodes.has(incident.fm.specCode))
    : [];
  const changes = include.has('changes')
    ? listTaskLinkedChangeProposals(paths).filter(change => !opts?.topic || change.topic === opts.topic)
    : [];

  return {
    specs,
    tasks,
    decisions,
    incidents,
    changes,
    indexes: buildProjectSnapshotIndexes({ specs, tasks, decisions, changes }),
    scope: {
      include: [...include],
      ...(opts?.topic ? { topic: opts.topic } : {}),
    },
  };
}

export function snapshotIncludes(snapshot: ProjectSnapshot, required: ProjectSnapshotInclude[]): boolean {
  if (!snapshot.scope) return false;
  const included = new Set(snapshot.scope.include);
  return required.every(item => included.has(item));
}

export function snapshotCoversTopic(
  snapshot: ProjectSnapshot,
  topic: string | undefined,
  required: ProjectSnapshotInclude[],
): boolean {
  if (!snapshotIncludes(snapshot, required)) return false;
  return snapshot.scope?.topic === undefined || snapshot.scope.topic === topic;
}

export function isFullProjectSnapshot(
  snapshot: ProjectSnapshot,
  required: ProjectSnapshotInclude[] = DEFAULT_INCLUDE,
): boolean {
  return snapshot.scope?.topic === undefined && snapshotIncludes(snapshot, required);
}

function filterByTopic(specs: SpecRecord[], topic: string | undefined): SpecRecord[] {
  return topic ? specs.filter(spec => spec.fm.topic === topic) : specs;
}

function buildProjectSnapshotIndexes(input: {
  specs: SpecRecord[];
  tasks: TaskRecord[];
  decisions: DecisionRecord[];
  changes: TaskLinkedChangeProposal[];
}): ProjectSnapshotIndexes {
  const specByCode = new Map<string, SpecRecord>();
  const tasksBySpec = new Map<string, TaskRecord[]>();
  const childrenByParent = new Map<string, SpecRecord[]>();
  const decisionsByDocCode = new Map<string, DecisionRecord[]>();
  const decisionById = new Map<string, DecisionRecord>();
  const taskByKey = new Map<string, TaskRecord>();
  const changesByTaskKey = new Map<string, TaskLinkedChangeProposal[]>();

  for (const spec of input.specs) {
    specByCode.set(spec.fm.code, spec);
    if (spec.fm.parentCode) {
      childrenByParent.set(spec.fm.parentCode, [...(childrenByParent.get(spec.fm.parentCode) ?? []), spec]);
    }
  }
  for (const task of input.tasks) {
    tasksBySpec.set(task.specCode, [...(tasksBySpec.get(task.specCode) ?? []), task]);
    taskByKey.set(taskKey(task.specCode, task.id), task);
  }
  for (const decision of input.decisions) {
    decisionsByDocCode.set(decision.fm.docCode, [...(decisionsByDocCode.get(decision.fm.docCode) ?? []), decision]);
    decisionById.set(decision.id, decision);
    decisionById.set(decision.fm.id, decision);
  }
  for (const change of input.changes) {
    const key = taskKey(change.specCode, change.taskCode);
    changesByTaskKey.set(key, [...(changesByTaskKey.get(key) ?? []), change]);
  }

  return {
    specByCode,
    tasksBySpec,
    childrenByParent,
    decisionsByDocCode,
    decisionById,
    taskByKey,
    changesByTaskKey,
  };
}

export function taskKey(specCode: string, taskId: string): string {
  return `${specCode}:${taskId}`;
}

function listSnapshotTasks(paths: ProjectPaths): TaskRecord[] {
  return listTopicMetaFiles(paths, 'tasks', { extension: TASK_FILE_EXT })
    .map(file => JSON.parse(readFileSync(file.filePath, 'utf8')) as TaskRecord)
    .sort((a, b) => a.created.localeCompare(b.created));
}
