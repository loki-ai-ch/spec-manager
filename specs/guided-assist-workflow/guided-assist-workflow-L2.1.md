---
code: guided-assist-workflow-L2.1
level: L2
title: 引导式 Assist 工作流技术设计
topic: guided-assist-workflow
parentCode: guided-assist-workflow-L1
status: implemented
aiSummary: >-
  设计引导式 Assist 工作流：新增只读 assist guide 推荐器，基于 request/topic/spec/task/git 阶段规则推荐
  brief/critique/next/drift/acceptance 等现有命令。
relations:
  - type: based_on
    target: guided-assist-workflow-L1
  - type: references
    target: ai-capability-compensation-L2.1
  - type: references
    target: ai-capability-compensation-L3.1.1
  - type: references
    target: ai-capability-compensation-L3.1.2-critic
  - type: references
    target: ai-capability-compensation-L3.1.3-next-drift
  - type: references
    target: ai-capability-compensation-L3.1.4-acceptance
  - type: references
    target: roadmap-openspec-L3.1.1-guide
created: '2026-06-17T05:47:45.543Z'
updated: '2026-06-17T06:16:10.035Z'
changeSummary: 'cascade: task-complete'
---
# 引导式 Assist 工作流技术设计

## 方案概述

`guided-assist-workflow-L1` 的核心目标不是新增一套工作流状态机，而是把已经实现的 `assist` 能力变成一个“下一步推荐器”：

```text
request + optional topic/spec/task + local specs/tasks/git
  -> GuidedAssistReport
  -> text/json presenter
  -> user/Agent runs the recommended existing command
```

新增命令：

```bash
spec-manager assist guide --request "<work>" [--topic <topic>] [--spec <specCode>] [--task <taskId>] [--json]
```

设计原则：

1. **只读**：不创建、不确认、不冻结、不启动 Task，不写 audit。
2. **复用**：推荐 `assist brief`、`assist critique`、`assist next`、`assist drift`、`assist acceptance`，不复制这些报告的完整逻辑。
3. **可解释**：每个推荐必须带 stage、reason、sourceRefs 和 alternatives。
4. **保守**：信息不足时推荐补充参数或先跑 `assist brief`，不强行猜。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/core/guided-assist.ts` | 新增 | Guided Assist stage detection and recommendation |
| `src/core/capability-types.ts` | 修改 | 增加 `GuidedAssistReport` / `GuidedAssistAlternative` 类型 |
| `src/cli/capability.ts` | 修改 | 注册 `assist guide` 命令和 presenter |
| `README.md` / `readme_zh.md` | 修改 | 把默认 assist 路径改为先 `assist guide` |
| `skill/SKILL.md` | 修改 | 引导 Agent 优先用 `assist guide` 获取下一步 |
| `templates/agents/*` | 修改 | agent 入口同步短引导 |
| `src/core/__tests__/guided-assist.test.ts` | 新增 | core stage/recommendation tests |
| `src/cli/__tests__/capability.test.ts` | 修改 | CLI JSON/text/error tests |

## 接口契约

## 技术决策

### 决策 1：命令名使用 `assist guide`

`assist guide` 明确属于能力补偿层，而不是通用 spec 流程 `guide`。

理由：

- 避免破坏现有 `spec-manager guide` 默认语义。
- 用户看到 `assist guide` 能理解它是在推荐 assist 子能力。
- 后续可在 `assist` 命令组内部统一发现和补全。

### 决策 2：首版使用固定优先级规则，不做评分模型

stage 判定采用固定优先级表，不引入权重、embedding、远端模型或隐藏评分。

理由：

- 输出可解释，便于测试。
- 失败时用户能理解为什么推荐某条命令。
- 与本地优先、无网络依赖的产品原则一致。

### 决策 3：只推荐，不自动执行

`assist guide` 输出 `nextCommand` 和 `alternatives`，但不执行推荐命令。

理由：

- 避免只读 projection 变成状态机入口。
- 保持所有状态变更仍由现有 `spec` / `task` 命令承担。
- 用户和 Agent 可在看到 reason 后决定是否执行。

### 决策 4：drift 作为意图敏感推荐

只有当 request 明确包含 drift/偏差/范围/改动等意图，或作为 task-next 的 alternative 时，才把 `assist drift` 放到主推荐。

理由：

- 避免每个 running task 都被 drift 打断。
- 保留 drift 的价值：检查实际改动是否超出 L3 声明。
- 降低用户在普通续跑场景下的噪音。

### Core Input

```ts
export interface BuildGuidedAssistInput {
  paths: ProjectPaths;
  request: string;
  topic?: string;
  specCode?: string;
  taskId?: string;
  gitReader?: GitChangedFilesReader;
}
```

`gitReader` 只用于测试注入；默认实现复用 `drift-check` 的 git changed file reader。

### Core Output

```ts
export type GuidedAssistStage =
  | 'brief'
  | 'critique'
  | 'task-next'
  | 'drift'
  | 'acceptance'
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
```

### CLI

```bash
spec-manager assist guide --request "<work>" [--topic <topic>] [--spec <specCode>] [--task <taskId>] [--json]
```

行为：

- `--request` 为空：exit 2，错误 `GUIDED_ASSIST_REQUEST_REQUIRED`。
- `--spec` 不存在：exit 1，错误 `SPEC_NOT_FOUND`。
- `--task` 配合 `--spec` 不存在：exit 1，错误 `TASK_NOT_FOUND`。
- `--task` 未提供 `--spec`：exit 2，提示必须用 `--spec` 消除跨 spec 的 `T-001` 歧义。
- `--json` 输出稳定 schema。
- text 输出标题 `Guided Assist`，包含 Stage、Next、Reason、Alternatives、Findings。

## Stage 判定规则

规则按优先级从高到低执行，首个命中即返回：

| 优先级 | 条件 | stage | nextCommand |
|---|---|---|---|
| 1 | `request` 包含验收/交付/acceptance 且有 `taskId + specCode` | `acceptance` | `spec-manager assist acceptance <taskId> --spec <specCode>` |
| 2 | `taskId + specCode` 且 task status 为 `completed` | `acceptance` | `spec-manager assist acceptance <taskId> --spec <specCode>` |
| 3 | `taskId + specCode` 且 git changed files 非空，并且 request 包含 drift/偏差/范围/改了什么 | `drift` | `spec-manager assist drift <taskId> --spec <specCode>` |
| 4 | `taskId + specCode` 且 task status 为 `running` / `waiting` / `draft` / `failed` | `task-next` | `spec-manager assist next <taskId> --spec <specCode>` |
| 5 | `specCode` 存在且 spec status 为 `draft` 或 level 为 L1/L2/L3 | `critique` | `spec-manager assist critique <specCode>` |
| 6 | 可推断 `topic` 且存在 topic flow | `flow` | `spec-manager flow status --topic <topic>` |
| 7 | 只有 request | `brief` | `spec-manager assist brief --request "<request>" [--topic <topic>]` |
| 8 | request 为空或无法形成建议 | `needs-input` | `spec-manager assist guide --request "<work>" --topic <topic>` |

说明：

- `acceptance` 优先于 `task-next`，因为 completed task 的下一步通常是交付汇总。
- `drift` 不自动成为 hard gate；它只在用户意图或 git diff 明确时作为主推荐，否则作为 alternative。
- `critique` 面向 spec 审查，不只限定 draft；但 draft spec 的 reason 必须强调“确认/冻结前检查”。
- topic 推断复用 `capability-brief` 的 `inferTopic`，再用现有 specs/tasks 做交叉验证。

## Alternatives 规则

每个报告至少给出 0 到 3 个 alternatives：

- stage 为 `brief` 时，可选 `spec-manager guide "<request>"` 或 `spec-manager new feature --topic <topic> "..."`。
- stage 为 `critique` 时，可选 `spec-manager spec show <specCode> --include-content`。
- stage 为 `task-next` 时，如果 git diff 非空，可选 `assist drift`；如果有 verification，可选 `assist acceptance`。
- stage 为 `drift` 时，可选 `assist next`。
- stage 为 `acceptance` 时，可选 `task evidence` 和 `task show`。
- stage 为 `flow` 时，可选 `assist brief`。

Alternatives 只给命令和原因，不执行。

## 数据读取与错误处理

`buildGuidedAssistReport` 读取：

- `findSpecByCode(paths, specCode)`：校验 spec 与构建 sourceRefs。
- `findTask(paths, specCode, taskId)`：校验 task 与读取状态。
- `listAllSpecs(paths)` / `listTasks(paths, { topic })`：topic 推断与 flow fallback。
- `defaultGitChangedFilesReader(paths)`：判断 drift alternative；失败时吞掉并给 advisory finding。

错误处理：

- 资源不存在抛稳定错误，由 CLI 转换 exit code。
- git 读取失败不阻断，只产生 advisory finding。
- topic 推断冲突时不随机选择，stage 设为 `needs-input` 或 `brief`，finding 提示加 `--topic`。

## 与现有命令关系

| 命令 | 职责 | 本设计关系 |
|---|---|---|
| `guide` | spec 流程下一步，包含 rich guide | 不替代 |
| `flow status` | topic 级状态浏览 | 可作为 guided assist fallback |
| `assist brief` | 开工上下文包 | guided assist 的 brief stage 推荐目标 |
| `assist critique` | spec 分层审查 | guided assist 的 critique stage 推荐目标 |
| `assist next` | task 续跑导航 | guided assist 的 task-next stage 推荐目标 |
| `assist drift` | diff/scope 偏差检查 | guided assist 的 drift stage 推荐目标 |
| `assist acceptance` | 交付验收证据汇总 | guided assist 的 acceptance stage 推荐目标 |

## L3 裂变计划

| L3 | 范围 | 交付 |
|---|---|---|
| L3.1.1 Guided Assist Core | 类型、stage 判定、recommendation、core tests | `guided-assist.ts`、`GuidedAssistReport` |
| L3.1.2 Guided Assist CLI + Guidance | `assist guide` presenter、README/skill/templates、CLI tests | 用户入口与文档导流 |

拆成两片的原因：

- Core stage rules 容易演化，需要独立测试。
- 文档/CLI 改动容易扩大范围，单独切片更利于验收。

## 验证策略

Core tests 覆盖：

1. request-only -> `brief`。
2. draft spec -> `critique`。
3. running task -> `task-next`。
4. running task + drift intent + changed files -> `drift`。
5. completed task -> `acceptance`。
6. missing topic/spec/task -> stable findings/errors。

CLI tests 覆盖：

1. `assist guide --request "..." --json` schema。
2. `assist guide --request "..." --spec <code>` text。
3. `assist guide --request "..." --task T-001` without `--spec` exit 2。
4. missing spec/task exit 1。

回归命令：

```bash
npm test -- src/core/__tests__/guided-assist.test.ts
npm test -- src/cli/__tests__/capability.test.ts
npm test
npm run build
spec-manager spec validate guided-assist-workflow-L2.1
```

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 与 `guide` 混淆 | 用户不知道用哪个 | 文档明确：`guide` 走 spec 流程，`assist guide` 走 assist 能力推荐 |
| 推荐规则变复杂 | 维护成本增加 | 首版固定优先级表，测试覆盖每条 stage |
| topic 推断错误 | 推荐错误命令 | 多 topic 冲突时降级为 needs-input，提示 `--topic` |
| drift 读取依赖 git | 非 git 环境输出不稳定 | git 失败不阻断，只产生 advisory |
| 文档入口膨胀 | README 难读 | 默认展示 `assist guide`，把子命令作为直达入口 |

## 关联

- based_on: `guided-assist-workflow-L1`
- references: `ai-capability-compensation-L2.1`
- references: `ai-capability-compensation-L3.1.1`
- references: `ai-capability-compensation-L3.1.2-critic`
- references: `ai-capability-compensation-L3.1.3-next-drift`
- references: `ai-capability-compensation-L3.1.4-acceptance`
- references: `roadmap-openspec-L3.1.1-guide`
