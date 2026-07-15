---
code: workflow-surface-simplification-L3.1.2
level: L3
title: Next and Dashboard CLI
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.1
status: implemented
aiSummary: >-
  将 workflow surface core projection 暴露为 next 和 dashboard 顶层 CLI：支持 text/json
  输出、topic scope、单 JSON 对象契约；不实现 brief、不写项目文件、不改变旧命令行为。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and current usability CLI tests
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement next and dashboard CLI presenters
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add CLI tests for next and dashboard
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted usability and workflow surface tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.1
created: '2026-07-15T02:31:28.285Z'
updated: '2026-07-15T02:45:27.200Z'
changeSummary: 'cascade: task-complete'
---
# Next and Dashboard CLI

## 背景

`workflow-surface-simplification-L3.1.1` 已经实现只读 workflow surface core projection。下一步需要把 projection 暴露为用户和 Agent 可直接使用的 CLI 入口，让新用户可以用更短的命令获得 next action 和项目摘要。

本规格只实现 `spec-manager next` 与 `spec-manager dashboard`。`spec-manager brief` 涉及 Agent Brief、Design Context 和 assist 能力复用，后续单独拆分。

## 目标

- 新增 `spec-manager next [request...] [--topic <topic>] [--json]`。
- 新增 `spec-manager dashboard [--topic <topic>] [--json]`。
- CLI 输出复用 `src/core/workflow-surface.ts` 的 projection，不重新实现状态判断。
- text 输出适合人读，json 输出为单个 JSON 对象，适合 Agent 消费。
- 保持现有 `guide`、`flow status`、`view` 行为不变。

## 非目标

- 不新增 `brief` 命令。
- 不修改 agent templates 或 README。
- 不改变 existing `guide`/`assist guide`/`flow status` 输出。
- 不执行任何写操作。

## 涉及文件

- `src/cli/usability.ts`: 注册 `next` 和 `dashboard` 命令，或拆出新的 CLI 注册文件后在 `src/cli/index.ts` 注册。
- `src/core/workflow-surface.ts`: 如有必要补充 projection 字段，但不得引入写操作。
- `src/cli/__tests__/usability.test.ts`: 增加 CLI 行为测试。
- `src/core/__tests__/workflow-surface.test.ts`: 如 projection 契约变化，同步补测。

## 实施步骤

1. 在 CLI 层注册 `next` 和 `dashboard` 顶层命令。
2. 实现 text presenter：
   - `next` 输出 Project Root、Request、Topic、Status、Next、Why、Suggested。
   - `dashboard` 输出 Project Root、topic 数、draft spec 数、active task 数、warnings 和每个 topic 的 next action。
3. 实现 json presenter，确保 stdout 只输出 JSON 对象。
4. 对未初始化项目、无 topic、显式 topic、dashboard topic filter 添加 CLI 测试。
5. 确认旧命令测试仍通过。

## 接口契约

### next

```bash
spec-manager next "add auth"
spec-manager next "add auth" --topic auth
spec-manager next "add auth" --json
```

text 输出必须包含：

- `Project:`
- `Request:`
- `Topic:`
- `Status:`
- `Next:`

当存在 `blockingReason` 时输出 `Why:`。当存在 `suggestedCommands` 时输出 `Suggested:`。

json 输出必须直接序列化 `WorkflowNextProjection`。

### dashboard

```bash
spec-manager dashboard
spec-manager dashboard --topic auth
spec-manager dashboard --json
```

text 输出必须包含：

- `Project:`
- `Initialized:`
- `Topics:`
- `Active tasks:`
- `Draft specs:`

topic 行必须包含 topic 名称、spec/task 计数和 next action。

json 输出必须直接序列化 `WorkflowDashboardProjection`。

## 验收标准

1. **AC-1**: `spec-manager next "request"` MUST 输出 core projection 的 status、topic 和 next action。
2. **AC-2**: `spec-manager next --json` MUST 输出单个 JSON 对象，且包含 `projectRoot`、`initialized`、`status`、`nextAction`。
3. **AC-3**: `spec-manager dashboard` MUST 输出 project summary、topic summary 和 next action。
4. **AC-4**: `spec-manager dashboard --json` MUST 输出单个 JSON 对象，且包含 `topics`、`activeTaskCount`、`draftSpecCount`、`warnings`。
5. **AC-5**: `--topic` MUST 限定 next/dashboard 的 topic scope。
6. **AC-6**: 新命令 MUST NOT 写入 spec、task、audit 或 config 文件。
7. **AC-7**: 现有 `guide`、`flow status`、`view` 测试 MUST 保持通过。

## 验证命令

```bash
npm test -- src/cli/__tests__/usability.test.ts src/core/__tests__/workflow-surface.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：顶层 `next` 命令可能与用户对 shell 的常见命令心智冲突，但它比 `assist guide` 更短，符合 core quick path 目标。
- 风险：text presenter 如果过于详细，会变成 dashboard 的重复。实施时应保持 `next` 只突出一个 primary action。
- 回滚：删除新增 CLI 注册和测试，core projection 可继续保留供后续使用。
