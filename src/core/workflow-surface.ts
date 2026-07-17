import { getPaths, type ProjectPaths } from './paths.js';
import { buildProjectSnapshot } from './project-snapshot.js';
import type { SpecRecord } from './spec-io.js';
import { isPlaceholderContent } from './spec-io.js';
import type { TaskRecord } from './task.js';
import {
  resolveSpecStore,
  type SpecStoreDiagnostic,
  type SpecStoreResolvedEntry,
} from './spec-store.js';
import {
  getFlowStatus,
  isBlockingDoctorCheck,
  runProjectDoctor,
  type DoctorCheck,
  type TopicFlow,
} from './usability.js';
import { buildViewModel } from './view.js';
import { buildKnowledgeActivation } from './knowledge-activation.js';
import type { TopicRecommendation } from './capability-types.js';

export type WorkflowSurfaceStatus =
  | 'not_initialized'
  | 'blocked_by_doctor'
  | 'needs_l1'
  | 'needs_spec_update'
  | 'needs_user_approval'
  | 'needs_child_spec'
  | 'ready_for_task'
  | 'task_draft'
  | 'task_running'
  | 'task_waiting'
  | 'no_immediate_action';

export interface WorkflowNextProjection {
  projectRoot: string;
  executionRoot: string;
  writeRoot: string;
  writeStore: SpecStoreResolvedEntry;
  contextSources: SpecStoreResolvedEntry[];
  storeDiagnostics: SpecStoreDiagnostic[];
  initialized: boolean;
  request: string;
  topic: string | null;
  topicRecommendation?: TopicRecommendation;
  status: WorkflowSurfaceStatus;
  blockingReason?: string;
  nextAction: string;
  suggestedCommands: string[];
  warnings: string[];
}

export interface WorkflowDashboardTopic {
  topic: string;
  specCount: number;
  taskCount: number;
  draftSpecCount: number;
  activeTaskCount: number;
  nextAction: string;
}

export interface WorkflowDashboardProjection {
  projectRoot: string;
  executionRoot: string;
  writeRoot: string;
  writeStore: SpecStoreResolvedEntry;
  contextSources: SpecStoreResolvedEntry[];
  storeDiagnostics: SpecStoreDiagnostic[];
  initialized: boolean;
  topics: WorkflowDashboardTopic[];
  activeTaskCount: number;
  draftSpecCount: number;
  warningCount: number;
  warnings: string[];
}

export interface BuildWorkflowNextOptions {
  request?: string;
  topic?: string;
}

export interface BuildWorkflowDashboardOptions {
  topic?: string;
}

export function buildWorkflowNextProjection(
  paths: ProjectPaths,
  opts: BuildWorkflowNextOptions = {},
): WorkflowNextProjection {
  const request = (opts.request ?? '').trim();
  const doctor = runProjectDoctor(paths);
  const store = resolveSpecStore(paths);
  const writePaths = getPaths(store.writeRoot);
  const warnings = doctorWarnings(doctor);
  if (!paths.isInitialized) {
    return {
      projectRoot: paths.root,
      executionRoot: store.executionRoot,
      writeRoot: store.writeRoot,
      writeStore: store.writeStore,
      contextSources: store.contextSources,
      storeDiagnostics: store.diagnostics,
      initialized: false,
      request,
      topic: opts.topic ?? inferTopicFromRequest(request),
      status: 'not_initialized',
      blockingReason: 'Project is not initialized',
      nextAction: 'spec-manager project init --name <project-name>',
      suggestedCommands: ['spec-manager project init --name <project-name>'],
      warnings,
    };
  }

  const blocking = doctor.find((check) => isBlockingDoctorCheck(check) && check.action);
  if (blocking?.action) {
    return {
      projectRoot: paths.root,
      executionRoot: store.executionRoot,
      writeRoot: store.writeRoot,
      writeStore: store.writeStore,
      contextSources: store.contextSources,
      storeDiagnostics: store.diagnostics,
      initialized: true,
      request,
      topic: opts.topic ?? inferTopicFromRequest(request),
      status: 'blocked_by_doctor',
      blockingReason: `${blocking.label}: ${blocking.detail}`,
      nextAction: blocking.action,
      suggestedCommands: ['spec-manager project doctor'],
      warnings,
    };
  }

  const inferredActivation = request && !opts.topic
    ? buildKnowledgeActivation({ paths: writePaths, request })
    : null;
  const topic = opts.topic ?? inferredActivation?.selectedTopic ?? null;
  if (!topic) {
    const suggestedTopic = inferredActivation?.inferredTopic ?? inferTopicFromRequest(request);
    const selectionCommands = inferredActivation
      ? selectionCommandsForActivation(request, inferredActivation)
      : suggestedTopic ? [`spec-manager spec new L1 --topic ${suggestedTopic} --title "..."`] : ['spec-manager flow status'];
    return {
      projectRoot: paths.root,
      executionRoot: store.executionRoot,
      writeRoot: store.writeRoot,
      writeStore: store.writeStore,
      contextSources: store.contextSources,
      storeDiagnostics: store.diagnostics,
      initialized: true,
      request,
      topic: null,
      ...(inferredActivation ? { topicRecommendation: inferredActivation.topicRecommendation } : {}),
      status: 'needs_l1',
      blockingReason: inferredActivation?.selectionRequired
        ? topicSelectionBlockingReason(inferredActivation)
        : 'No topic provided or selected from request',
      nextAction: selectionCommands[0],
      suggestedCommands: selectionCommands,
      warnings,
    };
  }

  const snapshot = buildProjectSnapshot(writePaths, { topic });
  const flow = getFlowStatus(writePaths, { topic, snapshot })[0];
  const status = classifyFlow(flow);
  const activation = status === 'needs_l1' ? inferredActivation : null;
  const relatedHistory = Boolean(activation?.hasRelatedHistory);
  return {
    projectRoot: paths.root,
    executionRoot: store.executionRoot,
    writeRoot: store.writeRoot,
    writeStore: store.writeStore,
    contextSources: store.contextSources,
    storeDiagnostics: store.diagnostics,
    initialized: true,
    request,
    topic,
    ...(inferredActivation ? { topicRecommendation: inferredActivation.topicRecommendation } : {}),
    status,
    blockingReason: relatedHistory
      ? `No exact specs found for inferred topic ${topic}, but related project history exists`
      : blockingReasonForStatus(status, flow),
    nextAction: relatedHistory
      ? `spec-manager brief "${request.replace(/"/g, '\\"')}"\nThen review related history before: ${flow.nextAction}`
      : flow.nextAction,
    suggestedCommands: relatedHistory
      ? [`spec-manager brief "${request.replace(/"/g, '\\"')}"`, ...suggestedCommandsForFlow(topic, flow)]
      : suggestedCommandsForFlow(topic, flow),
    warnings,
  };
}

export function buildWorkflowDashboardProjection(
  paths: ProjectPaths,
  opts: BuildWorkflowDashboardOptions = {},
): WorkflowDashboardProjection {
  const doctor = runProjectDoctor(paths);
  const store = resolveSpecStore(paths);
  const writePaths = getPaths(store.writeRoot);
  const warnings = doctorWarnings(doctor);
  if (!paths.isInitialized) {
    return {
      projectRoot: paths.root,
      executionRoot: store.executionRoot,
      writeRoot: store.writeRoot,
      writeStore: store.writeStore,
      contextSources: store.contextSources,
      storeDiagnostics: store.diagnostics,
      initialized: false,
      topics: [],
      activeTaskCount: 0,
      draftSpecCount: 0,
      warningCount: warnings.length,
      warnings,
    };
  }

  const model = buildViewModelOrEmpty(writePaths, opts);
  const topics = model.topics.map((topic) => {
    const draftSpecCount = topic.specs.filter((spec) => spec.status === 'draft').length;
    const activeTaskCount = topic.tasks.filter((task) => isActiveTaskStatus(task.status)).length;
    return {
      topic: topic.topic,
      specCount: topic.specCount,
      taskCount: topic.taskCount,
      draftSpecCount,
      activeTaskCount,
      nextAction: topic.nextAction,
    };
  });

  return {
    projectRoot: paths.root,
    executionRoot: store.executionRoot,
    writeRoot: store.writeRoot,
    writeStore: store.writeStore,
    contextSources: store.contextSources,
    storeDiagnostics: store.diagnostics,
    initialized: true,
    topics,
    activeTaskCount: topics.reduce((sum, topic) => sum + topic.activeTaskCount, 0),
    draftSpecCount: topics.reduce((sum, topic) => sum + topic.draftSpecCount, 0),
    warningCount: warnings.length,
    warnings,
  };
}

function classifyFlow(flow: TopicFlow): WorkflowSurfaceStatus {
  if (flow.specs.length === 0) return 'needs_l1';
  if (flow.specs.some((spec) => isPlaceholderContent(spec.content))) return 'needs_spec_update';
  if (flow.specs.some((spec) => spec.fm.status === 'draft')) return 'needs_user_approval';
  if (flow.specs.some((spec) => spec.fm.level === 'L3' && spec.fm.status === 'confirmed')) {
    return 'needs_user_approval';
  }

  const frozenL3 = flow.specs.find((spec) => spec.fm.level === 'L3' && spec.fm.status === 'frozen');
  if (frozenL3) {
    const task = activeTaskForSpec(flow.tasks, frozenL3.fm.code);
    if (!task) return 'ready_for_task';
    if (task.status === 'draft') return 'task_draft';
    if (task.status === 'running') return 'task_running';
    if (task.status === 'waiting') return 'task_waiting';
  }

  const confirmedWithoutChild = flow.specs.find((spec) =>
    (spec.fm.level === 'L1' || spec.fm.level === 'L2') &&
    spec.fm.status === 'confirmed' &&
    !hasChildSpec(flow.specs, spec.fm.code),
  );
  if (confirmedWithoutChild) return 'needs_child_spec';

  return 'no_immediate_action';
}

function activeTaskForSpec(tasks: TaskRecord[], specCode: string): TaskRecord | null {
  return tasks.find((task) => task.specCode === specCode && isActiveTaskStatus(task.status)) ?? null;
}

function isActiveTaskStatus(status: TaskRecord['status']): boolean {
  return status !== 'completed' && status !== 'failed';
}

function hasChildSpec(specs: SpecRecord[], parentCode: string): boolean {
  return specs.some((spec) => spec.fm.parentCode === parentCode);
}

function blockingReasonForStatus(status: WorkflowSurfaceStatus, flow: TopicFlow): string | undefined {
  if (status === 'needs_l1') return `No specs found for topic ${flow.topic}`;
  if (status === 'needs_spec_update') {
    const spec = flow.specs.find((candidate) => isPlaceholderContent(candidate.content));
    return spec ? `${spec.fm.code} has placeholder content` : 'A spec has placeholder content';
  }
  if (status === 'needs_user_approval') {
    const spec = flow.specs.find((candidate) => candidate.fm.status === 'draft')
      ?? flow.specs.find((candidate) => candidate.fm.level === 'L3' && candidate.fm.status === 'confirmed');
    return spec ? `${spec.fm.code} is waiting for user approval` : 'A spec is waiting for user approval';
  }
  if (status === 'needs_child_spec') return 'A confirmed spec needs the next child spec';
  if (status === 'ready_for_task') return 'Frozen implementation spec has no active task';
  if (status === 'task_draft') return 'Task exists but has not started';
  if (status === 'task_running') return 'Task is running';
  if (status === 'task_waiting') return 'Task is waiting';
  return undefined;
}

function suggestedCommandsForFlow(topic: string, flow: TopicFlow): string[] {
  const commands = [`spec-manager flow status --topic ${topic}`];
  const spec = flow.specs.find((candidate) => candidate.fm.status === 'draft')
    ?? flow.specs.find((candidate) => candidate.fm.status === 'frozen')
    ?? flow.specs[0];
  if (spec) commands.push(`spec-manager spec show ${spec.fm.code}`);
  return commands;
}

function doctorWarnings(checks: DoctorCheck[]): string[] {
  return checks
    .filter((check) => check.status !== 'ok' && !isBlockingDoctorCheck(check))
    .map((check) => `${check.label}: ${check.detail}`);
}

function buildViewModelOrEmpty(paths: ProjectPaths, opts: BuildWorkflowDashboardOptions) {
  try {
    return buildViewModel(paths, opts.topic ? { topic: opts.topic } : undefined);
  } catch (err) {
    if (opts.topic && err instanceof Error && err.message === `TOPIC_NOT_FOUND: ${opts.topic}`) {
      return { topics: [] };
    }
    throw err;
  }
}

function inferTopicFromRequest(input: string): string | null {
  return input.toLowerCase().match(/[a-z0-9][a-z0-9-]*/)?.[0] ?? null;
}

function selectionCommandsForActivation(
  request: string,
  activation: ReturnType<typeof buildKnowledgeActivation>,
): string[] {
  const escapedRequest = request.replace(/"/g, '\\"');
  if (activation.topicRecommendation.selection === 'ambiguous') {
    return activation.topicRecommendation.candidates.map(candidate =>
      `spec-manager brief "${escapedRequest}" --topic ${candidate.topic}`,
    );
  }
  const topic = activation.inferredTopic ?? inferTopicFromRequest(request);
  return topic
    ? [`spec-manager spec new L1 --topic ${topic} --title "..."`, `spec-manager brief "${escapedRequest}" --topic ${topic}`]
    : ['spec-manager spec new L1 --topic <topic> --title "..."'];
}

function topicSelectionBlockingReason(activation: ReturnType<typeof buildKnowledgeActivation>): string {
  if (activation.topicRecommendation.selection === 'ambiguous') {
    return `Multiple existing topics match this request: ${activation.topicRecommendation.candidates.map(candidate => candidate.topic).join(', ')}`;
  }
  return 'No existing topic was selected; create a new topic explicitly';
}
