import type { ProfileRecommendation } from './profile-recommendation.js';
import type { DesignContextReport } from './design-context.js';
import type { EvidenceCoverageStatus, TaskEvidenceSummary } from './task-evidence.js';
import type { TaskVerificationRecord, VerificationLayer } from './task.js';
import type { WorkflowProfile } from './workflow-profile.js';

export type AssistSeverity = 'blocking' | 'warning' | 'advisory';

export type AssistSourceKind =
  | 'spec'
  | 'task'
  | 'decision'
  | 'incident'
  | 'audit'
  | 'git'
  | 'config'
  | 'rule';

export interface AssistSourceRef {
  kind: AssistSourceKind;
  id: string;
  path?: string;
  summary?: string;
}

export interface AssistFinding {
  id: string;
  severity: AssistSeverity;
  title: string;
  detail: string;
  sourceRefs: AssistSourceRef[];
  nextCommand?: string;
}

export interface Lesson {
  id: string;
  topic: string | null;
  title: string;
  detail: string;
  sourceRefs: AssistSourceRef[];
  confidence: 'high' | 'medium' | 'low';
  match?: HistoryMatch;
  knowledge?: KnowledgeProjection;
}

export interface HistoryMatch {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  matchedTerms: string[];
}

export interface KnowledgeProjection {
  state: 'current' | 'historical' | 'superseded' | 'invalidated' | 'unknown';
  basis: 'explicit' | 'derived' | 'default';
  reason: string;
  replacementRef?: string;
  reviewedAt: string;
}

export interface RetrievalMeta {
  scope: 'project' | 'topic';
  explicitTopic: string | null;
  inferredTopic: string | null;
  candidateCount: number;
  resultLimit: number;
}

export interface CanonicalTopicCandidate {
  topic: string;
  confidence: number;
  relatedSpecCount: number;
  currentKnowledgeCount: number;
  criticalConstraintCount: number;
  reasons: string[];
}

export interface TopicRecommendation {
  candidates: CanonicalTopicCandidate[];
  selection: 'candidate' | 'ambiguous' | 'create-new';
  selectionRequired: boolean;
  createNewAllowed: true;
}

export interface ConstraintTrust {
  sourceRefs: AssistSourceRef[];
  confidence: number;
  knowledgeState: KnowledgeProjection['state'];
}

export interface ModuleConstraint extends ConstraintTrust {
  path: string;
  pathState: 'current-path' | 'historical-path' | 'unknown-path';
  pathReason: 'current-exists' | 'historical-source' | 'outside-root' | 'missing-no-history' | 'invalid-path';
  contained: boolean;
  detection: 'structured' | 'code-block' | 'text-fallback';
}

export interface ConflictCandidate extends ConstraintTrust {
  sourceRef: AssistSourceRef;
  state: KnowledgeProjection['state'];
  reason: string;
  requestEvidence: string;
  historicalEvidenceRef: string;
  matchedTerms: string[];
  polarity: {
    request: 'positive' | 'negative' | 'unknown';
    historical: 'positive' | 'negative' | 'unknown';
  };
  reasonCodes: string[];
  verdict: 'candidate' | 'unknown';
}

export type GovernanceCandidateType =
  | 'spec-validity'
  | 'decision-lifecycle'
  | 'supersedes-relation'
  | 'history-disposition'
  | 'critical-ac-readiness';

export interface GovernanceCandidate {
  candidateType: GovernanceCandidateType;
  subjectRef: string;
  sourceRefs: string[];
  reasonCodes: string[];
  confidence: number;
  knowledgeState: KnowledgeProjection['state'];
  suggestedAction: string;
}

export interface ConstraintPackage {
  specs: AssistSourceRef[];
  decisions: AssistSourceRef[];
  acceptanceCriteria: Array<ConstraintTrust & { id: string; specCode: string; text: string }>;
  lessons: Array<ConstraintTrust & { id: string; title: string }>;
  codeModules: ModuleConstraint[];
  conflicts: ConflictCandidate[];
  unknownDimensions: string[];
}

export interface BriefSpecRef {
  code: string;
  level: string;
  status: string;
  title: string;
  sourceRef: AssistSourceRef;
  match?: HistoryMatch;
  knowledge?: KnowledgeProjection;
}

export interface BriefDecisionRef {
  id: string;
  topic?: string;
  status: string;
  title: string;
  sourceRef: AssistSourceRef;
  match?: HistoryMatch;
  knowledge?: KnowledgeProjection;
}

export interface BriefTaskRef {
  id: string;
  specCode: string;
  status: string;
  sourceRef: AssistSourceRef;
  match?: HistoryMatch;
  knowledge?: KnowledgeProjection;
}

export interface AgentBrief {
  schemaVersion: 'agent-brief.v1';
  request: string;
  topic: string | null;
  selectedTopic?: string | null;
  retrieval?: RetrievalMeta;
  topicRecommendation?: TopicRecommendation;
  profileRecommendation: ProfileRecommendation | null;
  relevantSpecs: BriefSpecRef[];
  relevantDecisions: BriefDecisionRef[];
  relevantTasks: BriefTaskRef[];
  lessons: Lesson[];
  constraintPackage?: ConstraintPackage;
  designContext?: DesignContextReport;
  designGuidance?: string[];
  suggestedReads: AssistSourceRef[];
  findings: AssistFinding[];
  nextCommand: string;
}

export interface LessonsReport {
  schemaVersion: 'lessons.v1';
  topic: string | null;
  lessons: Lesson[];
  findings: AssistFinding[];
}

export interface SpecCritiqueReport {
  schemaVersion: 'spec-critique.v1';
  specCode: string;
  level: 'L1' | 'L2' | 'L3';
  status: string;
  findings: AssistFinding[];
  summary: {
    blocking: number;
    warning: number;
    advisory: number;
  };
}

export interface TaskStepSummary {
  stepNo: number | string;
  name: string;
  status: string;
}

export interface TaskNextReport {
  schemaVersion: 'task-next.v1';
  taskId: string;
  specCode: string;
  taskStatus: string;
  currentStep: number | string | null;
  nextAction: string;
  incompleteSteps: TaskStepSummary[];
  lastFailure: string | null;
  evidenceSummary: TaskEvidenceSummary | null;
  findings: AssistFinding[];
}

export interface DriftFile {
  path: string;
  status: string;
}

export interface DriftCheckReport {
  schemaVersion: 'drift-check.v1';
  taskId: string;
  specCode: string;
  changedFiles: DriftFile[];
  declaredFiles: string[];
  undeclaredFiles: string[];
  findings: AssistFinding[];
}

export interface AcceptanceCriterionReport {
  id: string;
  text: string;
  status: EvidenceCoverageStatus;
  verificationIds: string[];
}

export interface AcceptanceReport {
  schemaVersion: 'acceptance-report.v1';
  taskId: string;
  specCode: string;
  profile: WorkflowProfile;
  criteria: AcceptanceCriterionReport[];
  verifications: TaskVerificationRecord[];
  artifacts: string[];
  humanAcceptance: AssistFinding[];
  residualRisk: AssistFinding[];
  summary: TaskEvidenceSummary;
}

export interface DeliveryVerificationSummary {
  id: string;
  status: 'passed' | 'failed';
  layer: VerificationLayer;
  command: string;
  summary: string;
  artifacts: string[];
  coversAc: string[];
}

export interface DeliveryStepSummary {
  stepNo: number | string;
  name: string;
  status: string;
}

export interface DeliverySummaryReport {
  schemaVersion: 'delivery-summary.v1';
  taskId: string;
  specCode: string;
  headline: string;
  summary: string[];
  taskStatus: string;
  spec: {
    code: string;
    level: string;
    status: string;
    title: string;
    topic: string;
  };
  steps: DeliveryStepSummary[];
  verifications: DeliveryVerificationSummary[];
  artifacts: string[];
  humanAcceptance: AssistFinding[];
  residualRisk: AssistFinding[];
  nextAction: string;
  findings: AssistFinding[];
  deliveryKnowledge?: { id: string; conclusion: string; status: string; summary: string } | null;
}

export type GuidedAssistStage =
  | 'brief'
  | 'critique'
  | 'task-next'
  | 'drift'
  | 'acceptance'
  | 'delivery'
  | 'flow'
  | 'needs-input';

export interface GuidedAssistAlternative {
  command: string;
  reason: string;
}

export interface GuidedAssistReport {
  schemaVersion: 'guided-assist.v1';
  request: string;
  topic: string | null;
  specCode: string | null;
  taskId: string | null;
  stage: GuidedAssistStage;
  nextCommand: string;
  reason: string;
  alternatives: GuidedAssistAlternative[];
  findings: AssistFinding[];
  sourceRefs: AssistSourceRef[];
}
