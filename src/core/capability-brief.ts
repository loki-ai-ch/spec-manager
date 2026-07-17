import { buildDesignContextReport, isDesignRelevantRequest } from './design-context.js';
import type { ProjectPaths } from './paths.js';
import { recommendWorkflowProfile } from './profile-recommendation.js';
import { buildProjectSnapshot } from './project-snapshot.js';
import { buildLessonsReport } from './lessons.js';
import { DEFAULT_RETRIEVAL_CONFIG, executeRetrieval } from './retrieval/index.js';
import { extractConstraintSignal } from './retrieval/normalization.js';
import { buildKnowledgeActivation, extractModuleConstraints, inferActivationTopic } from './knowledge-activation.js';
import type { DecisionRecord } from './decision.js';
import type { SpecRecord } from './spec-io.js';
import type { TaskRecord } from './task.js';
import { emptyKnowledgeRegistry, readKnowledgeRegistry, resolveKnowledge, type KnowledgeRegistry } from './knowledge.js';
import type { ProjectSnapshot } from './project-snapshot.js';
import type {
  AgentBrief,
  AssistFinding,
  AssistSourceRef,
  BriefDecisionRef,
  BriefSpecRef,
  BriefTaskRef,
  HistoryMatch,
  KnowledgeProjection,
  ConstraintPackage,
} from './capability-types.js';
import { extractAcceptanceCriteria } from './spec-sections.js';

export interface BuildAgentBriefInput {
  paths: ProjectPaths;
  request: string;
  topic?: string;
}

const MAX_SPECS = 5;
const MAX_DECISIONS = 3;
const MAX_TASKS = 5;
const MAX_BRIEF_LESSONS = 5;
const DESIGN_GUIDANCE = [
  'Read DESIGN.md prose before using tokens; token values support the design story, not the other way around.',
  'Prefer specific sources of inspiration over generic adjectives like modern, clean, premium, or trustworthy.',
  'Respect negative constraints, do/don\'t lists, and explicit omissions as part of the design character.',
  'Treat unknown sections as possible domain-specific design intent instead of ignoring them.',
];

export function buildAgentBrief(input: BuildAgentBriefInput): AgentBrief {
  const request = input.request.trim();
  if (!request) throw new Error('AGENT_BRIEF_REQUEST_REQUIRED: --request must be non-empty');

  const explicitTopic = normalizeOptional(input.topic);
  const snapshot = buildProjectSnapshot(input.paths, { include: ['specs', 'tasks', 'decisions', 'incidents'] });
  const activation = buildKnowledgeActivation({
    paths: input.paths,
    request,
    explicitTopic,
    specs: snapshot.specs,
    maxResults: MAX_SPECS,
  });
  const topic = activation.selectedTopic;
  const specSelection = selectSpecs(snapshot.specs, request, explicitTopic);
  const selectedDecisions = selectDecisions(snapshot.decisions, request, explicitTopic);
  const selectedTasks = selectTasks(snapshot.tasks, snapshot.specs, request, explicitTopic);
  const selectedLessons = buildLessonsReport(input.paths, {
    topic: explicitTopic ?? undefined,
    request,
    limit: MAX_BRIEF_LESSONS,
  }).lessons;
  let registry: KnowledgeRegistry;
  let registryWarning: AssistFinding | null = null;
  try {
    registry = readKnowledgeRegistry(input.paths);
  } catch (err) {
    registry = emptyKnowledgeRegistry();
    registryWarning = {
      id: 'brief.knowledge.registry-invalid',
      severity: 'warning',
      title: 'Knowledge registry could not be read',
      detail: err instanceof Error ? err.message : String(err),
      sourceRefs: [],
    };
  }
  const relevantSpecs = specSelection.items.map(item => ({
    ...item,
    knowledge: knowledgeProjection(input.paths, `spec:${item.code}`, registry, snapshot),
  }));
  const relevantDecisions = selectedDecisions.map(item => ({
    ...item,
    knowledge: knowledgeProjection(input.paths, `decision:${item.topic}:${item.id}`, registry, snapshot),
  }));
  const relevantTasks = selectedTasks.map(item => ({
    ...item,
    knowledge: knowledgeProjection(input.paths, `task:${item.specCode}:${item.id}`, registry, snapshot),
  }));
  const lessons = selectedLessons.map(item => ({
    ...item,
    knowledge: knowledgeProjection(input.paths, lessonKnowledgeRef(item), registry, snapshot),
  }));
  const constraintPackage = buildConstraintPackage(input.paths, request, snapshot, relevantSpecs, relevantDecisions, lessons);
  const findings = buildFindings(explicitTopic, topic, relevantSpecs, relevantDecisions, relevantTasks, lessons);
  if (registryWarning) findings.push(registryWarning);
  const designContext = isDesignRelevantRequest(request)
    ? buildDesignContextReport({ paths: input.paths })
    : null;
  const designRef = designContext?.exists ? designContextSourceRef(designContext) : null;

  return {
    schemaVersion: 'agent-brief.v1',
    request,
    topic,
    selectedTopic: activation.selectedTopic,
    retrieval: {
      scope: activation.scope,
      explicitTopic,
      inferredTopic: activation.inferredTopic,
      candidateCount: activation.candidateCount,
      resultLimit: MAX_SPECS,
    },
    topicRecommendation: activation.topicRecommendation,
    profileRecommendation: recommendWorkflowProfile({ paths: input.paths, request }),
    relevantSpecs,
    relevantDecisions,
    relevantTasks,
    lessons,
    constraintPackage,
    ...(designContext?.exists ? { designContext } : {}),
    ...(designContext?.exists ? { designGuidance: [...DESIGN_GUIDANCE] } : {}),
    suggestedReads: buildSuggestedReads(
      relevantSpecs,
      relevantDecisions,
      relevantTasks,
      designRef ? [designRef] : [],
    ),
    findings: [...topicSelectionFindings(activation), ...findings],
    nextCommand: nextCommandFor(request, topic, relevantSpecs, activation),
  };
}

function topicSelectionFindings(activation: ReturnType<typeof buildKnowledgeActivation>): AssistFinding[] {
  if (!activation.selectionRequired) return [];
  const inferred = activation.inferredTopic;
  if (activation.topicRecommendation.selection === 'ambiguous') {
    return [{
      id: 'brief.topic.selection-required',
      severity: 'advisory',
      title: 'Topic selection is required',
      detail: `Multiple existing topics match this request. Choose one explicitly before continuing: ${activation.topicRecommendation.candidates.map(item => item.topic).join(', ')}.`,
      sourceRefs: [],
      nextCommand: activation.topicRecommendation.candidates[0]
        ? `spec-manager brief "${escapeForDoubleQuotes(activation.request)}" --topic ${activation.topicRecommendation.candidates[0].topic}`
        : undefined,
    }];
  }
  return [{
    id: 'brief.topic.create-new-required',
    severity: 'advisory',
    title: 'New topic must be explicit',
    detail: inferred
      ? `No existing topic was selected. Create or pass topic ${inferred} explicitly before continuing.`
      : 'No existing topic was selected. Create or pass a topic explicitly before continuing.',
    sourceRefs: [],
    ...(inferred ? { nextCommand: `spec-manager spec new L1 --topic ${inferred} --title "..."` } : {}),
  }];
}

function buildConstraintPackage(
  paths: ProjectPaths,
  request: string,
  snapshot: ProjectSnapshot,
  specs: BriefSpecRef[],
  decisions: BriefDecisionRef[],
  lessons: AgentBrief['lessons'],
): ConstraintPackage {
  const selected = new Set(specs.map(item => item.code));
  const specByCode = new Map(specs.map(item => [item.code, item]));
  const acceptanceCriteria = snapshot.specs
    .filter(spec => selected.has(spec.fm.code) && spec.fm.level === 'L3')
    .flatMap(spec => extractAcceptanceCriteria(spec.content).map(item => ({
      id: item.id, specCode: spec.fm.code, text: item.text,
      ...constraintTrust(specByCode.get(spec.fm.code)?.knowledge, [specByCode.get(spec.fm.code)!.sourceRef], specByCode.get(spec.fm.code)?.match?.confidence),
    })));
  const moduleMap = new Map<string, ConstraintPackage['codeModules'][number]>();
  for (const spec of snapshot.specs.filter(item => selected.has(item.fm.code))) {
    const selectedSpec = specByCode.get(spec.fm.code)!;
    for (const module of extractModuleConstraints(paths, spec, [selectedSpec.sourceRef], selectedSpec.knowledge)) {
      const existing = moduleMap.get(module.path);
      if (!existing || module.confidence > existing.confidence) moduleMap.set(module.path, module);
    }
  }
  const stateConflicts: ConstraintPackage['conflicts'] = [...specs, ...decisions]
    .filter(item => item.knowledge?.state === 'superseded' || item.knowledge?.state === 'invalidated')
    .map(item => ({
      sourceRef: item.sourceRef, state: item.knowledge!.state, reason: item.knowledge!.reason,
      requestEvidence: request, historicalEvidenceRef: `${item.sourceRef.kind}:${item.sourceRef.id}`,
      matchedTerms: [],
      polarity: { request: 'unknown' as const, historical: 'unknown' as const },
      reasonCodes: [`knowledge-${item.knowledge!.state}`], verdict: 'candidate' as const,
      ...constraintTrust(item.knowledge, [item.sourceRef], item.match?.confidence),
    }));
  const lexicalConflicts = acceptanceCriteria.flatMap(item => buildLexicalConflict(request, item));
  const dispositionConflicts = snapshot.specs
    .filter(spec => selected.has(spec.fm.code))
    .flatMap(spec => (spec.fm.historyReview?.dispositions ?? [])
      .filter(disposition => disposition.action === 'change' || disposition.action === 'reject')
      .map(disposition => {
        const selectedSpec = specByCode.get(spec.fm.code)!;
        return {
          sourceRef: selectedSpec.sourceRef,
          state: selectedSpec.knowledge?.state ?? 'unknown',
          reason: disposition.reason ?? `Historical source disposition is ${disposition.action}.`,
          requestEvidence: request,
          historicalEvidenceRef: disposition.sourceRef,
          matchedTerms: [],
          polarity: { request: 'unknown' as const, historical: 'unknown' as const },
          reasonCodes: [`history-${disposition.action}`],
          verdict: disposition.action === 'reject' ? 'candidate' as const : 'unknown' as const,
          ...constraintTrust(selectedSpec.knowledge, [selectedSpec.sourceRef], selectedSpec.match?.confidence),
        };
      }));
  const conflicts = [...stateConflicts, ...lexicalConflicts, ...dispositionConflicts];
  const unknownDimensions: string[] = [];
  if (!acceptanceCriteria.length) unknownDimensions.push('acceptanceCriteria');
  if (!moduleMap.size) unknownDimensions.push('codeModules');
  if (!conflicts.length) unknownDimensions.push('conflicts');
  return {
    specs: specs.map(item => item.sourceRef),
    decisions: decisions.map(item => item.sourceRef),
    acceptanceCriteria,
    lessons: lessons.map(item => ({
      id: item.id, title: item.title,
      ...constraintTrust(item.knowledge, item.sourceRefs, item.confidence),
    })),
    codeModules: [...moduleMap.values()],
    conflicts,
    unknownDimensions,
  };
}

function constraintTrust(
  knowledge: KnowledgeProjection | undefined,
  sourceRefs: AssistSourceRef[],
  confidence: 'high' | 'medium' | 'low' | undefined,
) {
  const retrievalConfidence = confidence === 'high' ? 0.95 : confidence === 'medium' ? 0.75 : confidence === 'low' ? 0.5 : 0.5;
  const knowledgeConfidence = knowledge?.basis === 'explicit' ? 1 : knowledge?.basis === 'derived' ? 0.8 : 0.5;
  return { sourceRefs, confidence: Math.min(retrievalConfidence, knowledgeConfidence), knowledgeState: knowledge?.state ?? 'unknown' };
}

function buildLexicalConflict(
  request: string,
  criterion: ConstraintPackage['acceptanceCriteria'][number],
): ConstraintPackage['conflicts'] {
  const requestSignal = extractConstraintSignal(request);
  const historicalSignal = extractConstraintSignal(criterion.text);
  const historicalTerms = new Set(historicalSignal.objectTerms);
  const shared = requestSignal.objectTerms.filter(term => historicalTerms.has(term));
  const oppositePolarity = requestSignal.polarity !== 'unknown'
    && historicalSignal.polarity !== 'unknown'
    && requestSignal.polarity !== historicalSignal.polarity;
  if (shared.length === 0 || !oppositePolarity) return [];
  const verdict = shared.length >= 2 ? 'candidate' as const : 'unknown' as const;
  return [{
    sourceRef: criterion.sourceRefs[0], state: criterion.knowledgeState,
    reason: `Request and ${criterion.specCode}:${criterion.id} use opposite constraint polarity for ${shared.join(', ')}.`,
    requestEvidence: request, historicalEvidenceRef: `ac:${criterion.specCode}:${criterion.id}`,
    matchedTerms: shared,
    polarity: { request: requestSignal.polarity, historical: historicalSignal.polarity },
    reasonCodes: ['polarity-mismatch', 'shared-object-term'], verdict,
    sourceRefs: criterion.sourceRefs, confidence: verdict === 'candidate' ? criterion.confidence : Math.min(0.4, criterion.confidence),
    knowledgeState: criterion.knowledgeState,
  }];
}

export function inferTopic(request: string): string | null {
  return inferActivationTopic(request);
}

function selectSpecs(
  allSpecs: SpecRecord[],
  request: string,
  explicitTopic: string | null,
): { items: BriefSpecRef[]; candidateCount: number } {
  const specs = explicitTopic ? allSpecs.filter(spec => spec.fm.topic === explicitTopic) : allSpecs;
  const candidates = specs.map(spec => ({
    id: spec.fm.code,
    title: spec.fm.title,
    topic: spec.fm.topic,
    code: spec.fm.code,
    aiSummary: spec.fm.aiSummary,
    status: spec.fm.status,
    level: spec.fm.level,
  }));
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const relations = specs.flatMap(spec => {
    const declared = (spec.fm.relations ?? [])
      .filter(relation => candidateIds.has(relation.target))
      .filter(relation => ['based_on', 'references', 'implements', 'supersedes'].includes(relation.type))
      .map(relation => ({ type: relation.type, sourceId: spec.fm.code, targetId: relation.target }));
    const parent = spec.fm.parentCode && candidateIds.has(spec.fm.parentCode)
      ? [{ type: 'parent', sourceId: spec.fm.code, targetId: spec.fm.parentCode }]
      : [];
    return [...declared, ...parent];
  });
  const { results } = executeRetrieval(request, candidates, relations as any, {
    ...DEFAULT_RETRIEVAL_CONFIG,
    explicitTopic: explicitTopic ?? undefined,
    maxResults: MAX_SPECS,
  });

  if (explicitTopic && results.length === 0) {
    return {
      candidateCount: candidates.length,
      items: specs
        .sort((a, b) => statusRank(b.fm.status) - statusRank(a.fm.status) || a.fm.code.localeCompare(b.fm.code))
        .slice(0, MAX_SPECS)
        .map(specToBriefRef),
    };
  }

  const byCode = new Map(specs.map(spec => [spec.fm.code, spec]));
  const matchedItems = results.flatMap(result => {
      const spec = byCode.get(result.candidateId);
      return spec ? [{ ...specToBriefRef(spec), match: retrievalMatch(result) }] : [];
    });
  if (!explicitTopic) return { candidateCount: candidates.length, items: matchedItems };

  const matchedCodes = new Set(matchedItems.map(item => item.code));
  const fallbackItems = specs
    .filter(spec => !matchedCodes.has(spec.fm.code))
    .sort((a, b) => statusRank(b.fm.status) - statusRank(a.fm.status) || a.fm.code.localeCompare(b.fm.code))
    .map(specToBriefRef);
  return {
    candidateCount: candidates.length,
    items: [...matchedItems, ...fallbackItems].slice(0, MAX_SPECS),
  };
}

function selectDecisions(
  allDecisions: DecisionRecord[],
  request: string,
  explicitTopic: string | null,
): BriefDecisionRef[] {
  const decisions = allDecisions.filter(decision => decision.fm.status === 'active')
    .filter(decision => !explicitTopic || decision.fm.topic === explicitTopic);
  if (explicitTopic) return decisions.slice(0, MAX_DECISIONS).map(decisionToBriefRef);

  const candidates = decisions.map(decision => ({
    id: decisionKey(decision),
    title: decision.fm.what,
    topic: decision.fm.topic,
    code: decision.fm.docCode,
    decisionWhat: decision.fm.what,
    decisionWhy: decision.fm.why,
    status: decision.fm.status,
  }));
  const { results } = executeRetrieval(request, candidates, [], {
    ...DEFAULT_RETRIEVAL_CONFIG,
    maxResults: MAX_DECISIONS,
  });
  const byKey = new Map(decisions.map(decision => [decisionKey(decision), decision]));
  return results.flatMap(result => {
    const decision = byKey.get(result.candidateId);
    return decision ? [{ ...decisionToBriefRef(decision), match: retrievalMatch(result) }] : [];
  });
}

function selectTasks(
  allTasks: TaskRecord[],
  allSpecs: SpecRecord[],
  request: string,
  explicitTopic: string | null,
): BriefTaskRef[] {
  const topicBySpec = new Map(allSpecs.map(spec => [spec.fm.code, spec.fm.topic]));
  const tasks = allTasks.filter(task => !explicitTopic || topicBySpec.get(task.specCode) === explicitTopic);
  if (explicitTopic) {
    return tasks
      .sort((a, b) => taskStatusRank(b.status) - taskStatusRank(a.status) || b.created.localeCompare(a.created))
      .slice(0, MAX_TASKS)
      .map(taskToBriefRef);
  }

  const candidates = tasks.map(task => ({
    id: taskKey(task),
    title: `${task.status} task`,
    topic: topicBySpec.get(task.specCode),
    code: task.specCode,
    aiSummary: task.errorMessage ?? task.lastFailedOutput ?? undefined,
    status: task.status,
  }));
  const { results } = executeRetrieval(request, candidates, [], {
    ...DEFAULT_RETRIEVAL_CONFIG,
    maxResults: MAX_TASKS,
  });
  const byKey = new Map(tasks.map(task => [taskKey(task), task]));
  return results.flatMap(result => {
    const task = byKey.get(result.candidateId);
    return task ? [{ ...taskToBriefRef(task), match: retrievalMatch(result) }] : [];
  });
}

function buildFindings(
  explicitTopic: string | null,
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
  if (specs.length === 0 && decisions.length === 0 && tasks.length === 0 && lessons.length === 0) {
    const scope = explicitTopic ? `topic ${explicitTopic}` : 'the project';
    findings.push({
      id: 'brief.history.none',
      severity: 'advisory',
      title: 'No related local history found',
      detail: `No specs, decisions, tasks, or lessons were found in ${scope}.`,
      sourceRefs: [],
      ...(topic ? { nextCommand: `spec-manager spec new L1 --topic ${topic} --title "..."` } : {}),
    });
  }
  return findings;
}

function specToBriefRef(spec: SpecRecord): BriefSpecRef {
  return {
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
  };
}

function decisionToBriefRef(decision: DecisionRecord): BriefDecisionRef {
  return {
    id: decision.id,
    topic: decision.fm.topic,
    status: decision.fm.status,
    title: decision.fm.what,
    sourceRef: {
      kind: 'decision',
      id: decision.id,
      path: decision.filePath,
      summary: decision.fm.what,
    },
  };
}

function knowledgeProjection(
  paths: ProjectPaths,
  sourceRef: string,
  registry: KnowledgeRegistry,
  snapshot: ProjectSnapshot,
): KnowledgeProjection {
  try {
    const resolved = resolveKnowledge(paths, sourceRef, { registry, snapshot });
    return {
      state: resolved.state,
      basis: resolved.basis,
      reason: resolved.reason,
      ...(resolved.replacementRef ? { replacementRef: resolved.replacementRef } : {}),
      reviewedAt: resolved.reviewedAt,
    };
  } catch (err) {
    return {
      state: 'unknown',
      basis: 'default',
      reason: err instanceof Error ? err.message : String(err),
      reviewedAt: '',
    };
  }
}

function lessonKnowledgeRef(lesson: AgentBrief['lessons'][number]): string {
  if (lesson.id.startsWith('task:')) return `lesson:${lesson.id}`;
  if (lesson.id.startsWith('decision:')) {
    return `lesson:decision:${lesson.topic}:${lesson.id.slice('decision:'.length)}`;
  }
  if (lesson.id.startsWith('incident:')) return `lesson:${lesson.id}`;
  if (lesson.id.startsWith('delivery:')) return `lesson:${lesson.id}`;
  return `lesson:incident:${lesson.id}`;
}

function taskToBriefRef(task: TaskRecord): BriefTaskRef {
  return {
    id: task.id,
    specCode: task.specCode,
    status: task.status,
    sourceRef: {
      kind: 'task',
      id: `${task.specCode}:${task.id}`,
      summary: `${task.status} task for ${task.specCode}`,
    },
  };
}

function retrievalMatch(result: {
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchReason: string;
  matches: Array<{ matchedTokens: string[] }>;
}): HistoryMatch {
  return {
    score: result.score,
    confidence: result.confidence === 'none' ? 'low' : result.confidence,
    reasons: [result.matchReason],
    matchedTerms: [...new Set(result.matches.flatMap(match => match.matchedTokens))],
  };
}

function buildSuggestedReads(
  specs: BriefSpecRef[],
  decisions: BriefDecisionRef[],
  tasks: BriefTaskRef[],
  extraRefs: AssistSourceRef[] = [],
): AssistSourceRef[] {
  const refs = [
    ...specs.map(item => item.sourceRef),
    ...decisions.map(item => item.sourceRef),
    ...tasks.map(item => item.sourceRef),
    ...extraRefs,
  ];
  const seen = new Set<string>();
  return refs.filter(ref => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function designContextSourceRef(designContext: NonNullable<AgentBrief['designContext']>): AssistSourceRef {
  return {
    kind: 'config',
    id: 'DESIGN.md',
    path: designContext.path,
    summary: designContext.summary?.name ? `Design context: ${designContext.summary.name}` : 'Design context',
  };
}

function nextCommandFor(
  request: string,
  topic: string | null,
  specs: BriefSpecRef[],
  activation: ReturnType<typeof buildKnowledgeActivation>,
): string {
  if (!topic && activation.topicRecommendation.selection === 'ambiguous' && activation.topicRecommendation.candidates[0]) {
    return `spec-manager brief "${escapeForDoubleQuotes(request)}" --topic ${activation.topicRecommendation.candidates[0].topic}`;
  }
  if (!topic && activation.inferredTopic) return `spec-manager spec new L1 --topic ${activation.inferredTopic} --title "..."`;
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

function decisionKey(decision: DecisionRecord): string {
  return `${decision.fm.topic}:${decision.id}`;
}

function taskKey(task: TaskRecord): string {
  return `${task.specCode}:${task.id}`;
}

function normalizeOptional(input: string | undefined): string | null {
  const trimmed = input?.trim();
  return trimmed ? trimmed : null;
}

function escapeForDoubleQuotes(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
