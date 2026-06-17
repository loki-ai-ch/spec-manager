import type { ProfileRecommendation } from './profile-recommendation.js';
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
}

export interface BriefSpecRef {
  code: string;
  level: string;
  status: string;
  title: string;
  sourceRef: AssistSourceRef;
}

export interface BriefDecisionRef {
  id: string;
  status: string;
  title: string;
  sourceRef: AssistSourceRef;
}

export interface BriefTaskRef {
  id: string;
  specCode: string;
  status: string;
  sourceRef: AssistSourceRef;
}

export interface AgentBrief {
  schemaVersion: 'agent-brief.v1';
  request: string;
  topic: string | null;
  profileRecommendation: ProfileRecommendation | null;
  relevantSpecs: BriefSpecRef[];
  relevantDecisions: BriefDecisionRef[];
  relevantTasks: BriefTaskRef[];
  lessons: Lesson[];
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
