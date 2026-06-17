---
code: ai-capability-compensation-L2.1
level: L2
title: AI 能力补偿层技术设计
topic: ai-capability-compensation
parentCode: ai-capability-compensation-L1
status: implemented
aiSummary: >-
  技术设计：新增 assist 能力补偿入口，围绕 Agent Brief/Lessons、Spec Critic、Task
  Next/Drift、Acceptance Report 构建只读 projection 与 CLI presenter，不改变现有生命周期门禁。
relations:
  - type: based_on
    target: ai-capability-compensation-L1
created: '2026-06-17T03:41:02.369Z'
updated: '2026-06-17T04:00:00.512Z'
changeSummary: 'cascade: task-complete'
---
# AI 能力补偿层技术设计

## 背景

`ai-capability-compensation-L1` 要求把 spec-manager 从流程治理工具升级为 AI 能力补偿层：通过本地确定性 CLI 能力，把强模型或优秀工程师通常隐式完成的上下文整理、方案审查、执行导航、偏差检测、证据验收和经验复用显式化。

当前代码基础已经具备：

- `src/core/project-snapshot.ts`、`src/core/spec-io.ts`、`src/core/repository.ts` 提供本地 spec/task/decision/incident 读取基础。
- `src/core/usability.ts` 与 `src/cli/usability.ts` 已提供 `guide --format rich`、`flow status`、`run` 等 AI 使用入口。
- `src/core/task-evidence.ts` 已提供关键 AC、verification、artifact 的只读 evidence projection。
- `src/core/profile-recommendation.ts` 已提供本地确定性 Profile 推荐。
- `src/core/critical-readiness.ts`、`src/core/validate.ts`、`src/core/spec-sections.ts` 已有部分 spec 质量和 AC readiness 能力。
- `src/core/agents.ts` 与 templates/agent 资产已支持多 Agent 指令分发。

## 方案概述

新增一个只读/advisory 的能力补偿层，统一通过 `spec-manager assist` 命令组暴露。能力补偿层不写 spec/task 状态，不改变现有 hard gate，而是从本地事实源构建稳定 projection，再用 text/json presenter 给 Agent 或用户消费。

核心数据流：

```text
request/spec/task/git worktree
  -> local fact readers
  -> deterministic projection
  -> text/json presenter
  -> Agent or human reviewer
```

首轮交付五类能力：

| 能力 | 目的 | 命令 |
|---|---|---|
| Agent Brief + Lessons | 开工前统一上下文、历史、风险和下一步 | `assist brief`、`assist lessons` |
| Spec Critic | L1/L2/L3 审核前分层质量审查 | `assist critique` |
| Task Next | running Task 续跑与失败恢复导航 | `assist next` |
| Drift Check | frozen L3 与实际 diff 的路径范围偏差提示 | `assist drift` |
| Acceptance Report | 面向用户的证据验收报告 | `assist acceptance` |

所有新 projection 必须满足：

- 不写入 spec/task/decision/incident 文件。
- 不改变状态机。
- 不新增隐藏门禁。
- 输出必须标记 blocking/warning/advisory 的来源和能力边界。
- JSON 输出字段稳定，供未来 harness/CI 消费。

## 技术决策

### 决策 1：采用 `assist` 命令组作为能力补偿入口

选择新增 `spec-manager assist ...`，而不是把所有能力拆进 `guide`、`spec`、`task`、`project`。

理由：

- `assist` 清楚表达默认只读、advisory、report 语义。
- 避免破坏已有命令输出和用户脚本。
- 让能力补偿层与 workflow hard gate 保持边界。
- 后续可以按 projection 垂直切片扩展，不使已有 command 文件继续膨胀。

进入 L3 前建议创建 decision 记录该选择。

### 决策 2：Core projection 与 CLI presenter 分离

Core 只返回结构化对象，不直接打印。CLI handler 负责参数解析、错误码、text/json 输出和用户提示。

理由：

- 便于单元测试覆盖模型补偿逻辑。
- 保持现有 architecture-refactor 后的核心分层方向。
- 未来 harness/CI 可以直接消费 JSON projection。

### 决策 3：首版只做确定性启发式，不做 AI 语义判断

相关性、critique、drift 都基于本地文件、状态、section、路径 token、topic 和显式字段。

理由：

- 保持无网络、无 MCP、无远端模型依赖。
- 避免把模型自评伪装成系统保证。
- 与 `methodology-hardening-L1` 的 hard gate/warning/advisory 边界一致。

### 决策 4：Drift Check 首版只判断路径范围

首版 drift 不判断行为语义，只检查工作区变更文件是否落在 L3 declared scope 中。

理由：

- 语义 drift 需要更复杂的代码理解，容易误报或过度承诺。
- 路径级 drift 已能捕捉“改了未授权文件”这类高价值风险。
- 无 declared scope 时必须输出 advisory，而不是伪造判断。

## 受影响模块

| 模块 | 新增/修改 | 职责 |
|---|---|---|
| `src/core/capability-types.ts` | 新增 | 共享 schema types、severity、source refs、finding |
| `src/core/lessons.ts` | 新增 | 聚合 decision/incident/failed task 为 lessons |
| `src/core/capability-brief.ts` | 新增 | 构建 Agent Brief，复用 profile recommendation 与 lessons |
| `src/core/spec-critic.ts` | 新增 | 分层 spec critique projection |
| `src/core/task-next.ts` | 新增 | Task 下一步导航 projection |
| `src/core/drift-check.ts` | 新增 | git diff 与 L3 declared scope 偏差 projection |
| `src/core/acceptance-report.ts` | 新增 | 基于 task evidence 的验收报告 projection |
| `src/cli/capability.ts` | 新增 | 注册 `assist` 命令组和 presenter |
| `src/cli/index.ts` | 修改 | 注册 assist 命令 |
| `templates/agents/*`、`skill/SKILL.md` | 修改 | 非平凡工作引导读取或生成 Agent Brief |
| `README.md` / `readme_zh.md` | 修改 | 增加能力补偿层使用示例 |
| `docs/methodology.md` | 可选修改 | 记录 assist 的 advisory/report 边界 |

边界要求：

- Core 不直接 `console.log`。
- CLI 不直接解析 markdown 业务细节，只调用 core projection。
- Git 读取通过小接口封装，便于测试。
- Presenter 不修改 projection 含义。

## 接口契约

### CLI 契约

| 命令 | 输入 | 输出 | 对应 L1 AC |
|---|---|---|---|
| `spec-manager assist brief --request <text> [--topic T] [--json]` | 请求文本、可选 topic | Agent Brief + Lessons + 推荐下一步 | AC-1、AC-6、AC-7 |
| `spec-manager assist critique <specCode> [--json]` | L1/L2/L3 spec code | 分层质量审查结果 | AC-2 |
| `spec-manager assist next <taskId> --spec <specCode> [--json]` | Task id + spec code | 当前 task 下一步导航 | AC-3 |
| `spec-manager assist drift <taskId> --spec <specCode> [--json]` | Task id + spec code | git diff 与 frozen L3 范围偏差提示 | AC-4 |
| `spec-manager assist acceptance <taskId> --spec <specCode> [--json]` | Task id + spec code | 面向用户的验收报告 | AC-5 |
| `spec-manager assist lessons [--topic T] [--json]` | 可选 topic | 历史经验聚合 | AC-6 |

### Severity 契约

```ts
export type AssistSeverity = 'blocking' | 'warning' | 'advisory';
```

- `blocking`：表示报告发现缺少继续工作的必要输入，或如果执行现有状态推进可能被当前 hard gate 阻止。`assist` 本身不执行阻断。
- `warning`：表示较高风险缺口，需要人工判断。
- `advisory`：表示启发式建议、相关性不足或不完整语义判断。

### Source Ref 契约

```ts
export interface AssistSourceRef {
  kind: 'spec' | 'task' | 'decision' | 'incident' | 'audit' | 'git' | 'config' | 'rule';
  id: string;
  path?: string;
  summary?: string;
}
```

### Finding 契约

```ts
export interface AssistFinding {
  id: string;
  severity: AssistSeverity;
  title: string;
  detail: string;
  sourceRefs: AssistSourceRef[];
  nextCommand?: string;
}
```

### Agent Brief 契约

```ts
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
```

相关性规则：显式 `--topic` 优先；请求 token 推断 topic；同 topic active specs 优先；failed/running/waiting task 优先；active decision 优先；无法匹配时输出空列表和 advisory。

### Spec Critique 契约

```ts
export interface SpecCritiqueReport {
  schemaVersion: 'spec-critique.v1';
  specCode: string;
  level: 'L1' | 'L2' | 'L3';
  status: string;
  findings: AssistFinding[];
  summary: { blocking: number; warning: number; advisory: number };
}
```

分层检查维度：

| Level | 检查维度 |
|---|---|
| L1 | 背景、用户故事、验收标准、范围边界、非目标、度量、风险、里程碑 |
| L2 | 模块边界、数据模型、接口/CLI 契约、状态流、错误处理、兼容性、测试策略、分阶段 L3 拆分 |
| L3 | 文件级改动、planJson、验证命令、关键 AC、回滚、风险、受影响测试、禁止范围 |

### Task Next 契约

```ts
export interface TaskNextReport {
  schemaVersion: 'task-next.v1';
  taskId: string;
  specCode: string;
  taskStatus: string;
  currentStep: number | null;
  nextAction: string;
  incompleteSteps: TaskStepSummary[];
  lastFailure: string | null;
  evidenceSummary: TaskEvidenceSummary | null;
  findings: AssistFinding[];
}
```

规则：Task 非 running 时输出可用下一命令；running 时指向最小未完成 step；存在 failed step 或 `lastFailedOutput` 时注入失败摘要；有 evidence 时注入关键 AC 覆盖状态；无 verification 时提示记录验证。

### Drift Check 契约

```ts
export interface DriftCheckReport {
  schemaVersion: 'drift-check.v1';
  taskId: string;
  specCode: string;
  changedFiles: DriftFile[];
  declaredFiles: string[];
  undeclaredFiles: string[];
  findings: AssistFinding[];
}
```

Declared scope 来源优先级：

1. L3 中显式的 `## 影响文件`、`## 文件级改动`、`## Implementation Plan` 表格或列表中的路径。
2. planJson steps 中可识别的 file/path 字段。
3. 无 scope 时输出 `advisory: declared scope unavailable`，不判断 drift。

Changed files 通过可注入 git reader 读取 `git status --porcelain` 或 `git diff --name-only`。

### Acceptance Report 契约

```ts
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
```

基于 `buildTaskEvidence` 扩展展示 covered / failed / uncovered / not-required、verification command、exitCode、summary、coversAc、artifacts。报告必须明确：machine evidence 不等于人工或真实环境验收。

### Lessons 契约

```ts
export interface Lesson {
  id: string;
  topic: string | null;
  title: string;
  detail: string;
  sourceRefs: AssistSourceRef[];
  confidence: 'high' | 'medium' | 'low';
}
```

来源包括 failed task、incident、active decision。confidence 根据 topic、请求 token、状态和来源确定。

## 状态流与错误处理

`assist` 不新增状态流；它只读取现有状态。

| 场景 | 行为 |
|---|---|
| 项目未初始化 | CLI 返回 exit 2，提示 `project init` |
| spec/task 不存在 | CLI 返回 exit 1，提示可用 show/list 命令 |
| git 不可用或非 git 仓库 | drift report 输出 warning/advisory；命令不崩溃，除非无法读取项目根 |
| 无相关历史 | brief/lessons 输出空列表 + advisory |
| 无 critical AC | acceptance report 显示 required=0，并提示没有关键 AC 不等于无需人工验收 |
| malformed task/spec | 复用现有 parser 错误；不吞掉数据损坏 |

## 兼容性

- 不改变已有命令输出，除可选 Next 提示外不做 breaking change。
- `assist` 命令默认只读，不写 `.spec-manager/audit.json`。
- 不改变 `task complete` 的 hard gate。
- 不改变 adaptive workflow 默认兼容行为。
- Agent 模板只增加简短引导，不强制旧项目重新安装。

## 测试策略

### Core 单元测试

- `capability-brief.test.ts`：topic 推断、profile recommendation 注入、相关 spec/decision/task 选择、无匹配 advisory。
- `lessons.test.ts`：failed task、incident、decision lesson 聚合和 confidence。
- `spec-critic.test.ts`：L1/L2/L3 各层缺口 fixture。
- `task-next.test.ts`：draft/running/waiting/completed task、failed step、未覆盖 AC。
- `drift-check.test.ts`：declared scope 解析、undeclared files、无 scope advisory。
- `acceptance-report.test.ts`：covered/failed/uncovered/human acceptance 输出。

### CLI 测试

- `assist --json` 输出 schemaVersion 和关键字段。
- text 输出包含稳定标题和 Next 命令。
- 未初始化、spec/task 不存在错误码。

### Contract 测试

- Agent 模板包含 brief 引导但不复制过长规则。
- methodology 文档如新增能力边界，必须区分 hard gate、warning、advisory 和 human gate。

## L3 裂变计划

| L3 | 范围 | 主要文件 | 验证 |
|---|---|---|---|
| L3.1.1 Brief Lessons | `assist brief`、`assist lessons`、core types | `capability-types.ts`、`lessons.ts`、`capability-brief.ts`、`cli/capability.ts` | core + CLI tests |
| L3.1.2 Spec Critic | `assist critique` 分层审查 | `spec-critic.ts`、`cli/capability.ts` | L1/L2/L3 fixture tests |
| L3.1.3 Task Next Drift | `assist next`、`assist drift` | `task-next.ts`、`drift-check.ts` | task/git fixture tests |
| L3.1.4 Acceptance Agents | `assist acceptance`、agent 指令更新、README 示例 | `acceptance-report.ts`、templates、skill、README | evidence + template tests |
| L3.1.5 Metrics | 能力补偿效果 report，可选 | metrics module/CLI | aggregation tests |

首轮建议只推进 L3.1.1 到 L3.1.4；L3.1.5 等前四项产生数据后再决定。

## 验收映射

| L1 AC | L2 设计对应 |
|---|---|
| AC-1 | Agent Brief schema、`assist brief`、相关性规则、profile 注入 |
| AC-2 | Spec Critique schema、分层检查维度、`assist critique` |
| AC-3 | Task Next schema、状态规则、evidence 注入、`assist next` |
| AC-4 | Drift Check schema、declared scope、git reader、`assist drift` |
| AC-5 | Acceptance Report schema、task evidence 扩展展示、human acceptance |
| AC-6 | Lessons schema、来源、confidence、brief 注入 |
| AC-7 | Agent 模板更新和 guide/brief 引导 |
| AC-8 | Severity 语义、advisory 边界、非 hard gate 兼容性 |

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `assist` 命令过大 | 单个 L3 难以实现和审查 | 分 4 个 L3 垂直切片，先 shared types，再按能力扩展 |
| markdown 解析脆弱 | Critic/Drift 误报 | 首版只解析明确 section 和路径 token，无法判断时 advisory |
| 输出太长 | Agent Brief 反而增加负担 | 限制每类 refs 默认数量，完整内容通过 suggestedReads 命令读取 |
| 与 existing guide 重复 | 用户困惑 | guide 保持新手入口，brief 成为 Agent 开工包；README 明确差异 |
| Lessons 噪声 | 注入无关历史 | 按 topic/status/token 排序并标 confidence |
| Drift 被误认为安全门禁 | 用户过度信任路径检查 | 报告中注明只做路径范围 advisory，不判断语义正确性 |

## 关联

- based_on: `ai-capability-compensation-L1`
- references: `roadmap-openspec-L1`
- references: `adaptive-evidence-workflow-L1`
- references: `harness-coding-L1`
- references: `methodology-hardening-L1`
