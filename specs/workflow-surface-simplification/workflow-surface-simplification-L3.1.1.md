---
code: workflow-surface-simplification-L3.1.1
level: L3
title: Workflow Surface Core Projection
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.1
status: implemented
aiSummary: >-
  新增只读 workflow surface core projection，为 next/dashboard/brief 提供统一
  projectRoot、topic、status、blockingReason、nextAction、suggestedCommands 和
  warnings 数据模型；不注册 CLI、不写入项目文件。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and existing usability/view helpers
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement read-only workflow surface core projection
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add workflow surface unit tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted workflow surface tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.1
created: '2026-07-15T02:20:56.780Z'
updated: '2026-07-15T02:29:47.305Z'
changeSummary: 'cascade: task-complete'
---
# Workflow Surface Core Projection

## 背景

`workflow-surface-simplification-L2.1` 设计了 `next`、`brief`、`dashboard` 作为 core quick path。为了避免每个 CLI 命令各自重新推断下一步，本实施规格先建立一个只读 core projection，统一表达项目 root、topic、状态、阻塞原因、下一步命令和 warnings。

本规格只实现 core projection 与单元测试，不注册新的 CLI 命令。后续 CLI 规格应复用这里的 projection。

## 目标

- 新增 `workflow-surface` core 模块，提供 next action 与 dashboard 的只读数据模型。
- 复用现有 doctor、flow status、snapshot/view 能力，不复制状态机。
- 为后续 `next --json` 和 `dashboard --json` 提供稳定字段。
- 保持 projection 无副作用，不写入 spec、task、audit、config。

## 非目标

- 不新增 CLI 命令。
- 不改 README 或 agent templates。
- 不改变现有 `guide`、`assist`、`flow`、`view` 输出。
- 不实现 external specs root/store。

## 涉及文件

- `src/core/workflow-surface.ts`: 新增 core projection。
- `src/core/__tests__/workflow-surface.test.ts`: 新增单元测试。
- `src/core/usability.ts`: 如需要，可导出或复用现有 next action helper；避免改变现有行为。
- `src/core/view.ts`: 如 dashboard 聚合需要，可复用 view model 类型或函数。

## 数据结构

新增类型建议：

```ts
export interface WorkflowNextProjection {
  projectRoot: string;
  initialized: boolean;
  request: string;
  topic: string | null;
  status: WorkflowSurfaceStatus;
  blockingReason?: string;
  nextAction: string;
  suggestedCommands: string[];
  warnings: string[];
}

export interface WorkflowDashboardProjection {
  projectRoot: string;
  initialized: boolean;
  topics: WorkflowDashboardTopic[];
  activeTaskCount: number;
  draftSpecCount: number;
  warningCount: number;
  warnings: string[];
}
```

`WorkflowSurfaceStatus` 至少覆盖：

- `not_initialized`
- `blocked_by_doctor`
- `needs_l1`
- `needs_spec_update`
- `needs_user_approval`
- `needs_child_spec`
- `ready_for_task`
- `task_draft`
- `task_running`
- `task_waiting`
- `no_immediate_action`

## 行为规则

- `buildWorkflowNextProjection(paths, opts)` MUST 只读项目文件。
- 未初始化时，MUST 返回 `not_initialized`，`nextAction` 指向 `spec-manager project init --name <project-name>`。
- doctor blocking check 存在时，MUST 返回 `blocked_by_doctor` 并使用 blocking check 的 action。
- topic 显式传入时 MUST 使用显式 topic；未传入时 MAY 从 request 推断。
- 无 topic 且 request 无法推断时，MUST 返回 `needs_l1`，topic 为 null，`nextAction` 使用 `<topic>` 占位。
- 已有 topic 时 MUST 复用 `getFlowStatus` / `suggestNextActionForTopic` 的判断，不另写状态机。
- 当 next action 指向 spec update、confirm、freeze、task create/start/step 等命令时，status MUST 尽量映射到稳定枚举。
- warnings MUST 包含非阻塞 doctor 问题摘要。
- suggestedCommands SHOULD 至少包含一个可帮助用户理解状态的只读命令，例如 `flow status` 或 `spec show`。
- `buildWorkflowDashboardProjection(paths, opts)` MUST 汇总 topics、active tasks、draft specs 和 warnings，不写入任何文件。

## 验收标准

1. **AC-1**: 未初始化项目调用 next projection MUST 返回 `not_initialized` 和 project init next action。
2. **AC-2**: 已初始化但无规格的 topic 调用 next projection MUST 返回 `needs_l1` 和创建 L1 的 next action。
3. **AC-3**: draft 占位规格 MUST 返回 `needs_spec_update`，非占位 draft 规格 MUST 返回 `needs_user_approval`。
4. **AC-4**: frozen 实施规格无 active task 时 MUST 返回 `ready_for_task`。
5. **AC-5**: running task MUST 返回 `task_running` 并给出 task step 或 assist next 类建议。
6. **AC-6**: dashboard projection MUST 汇总 topic 数、draft spec 数、active task 数和 warnings。
7. **AC-7**: projection 测试 MUST 覆盖未初始化、无规格 topic、draft spec、frozen spec、running task 和 dashboard 汇总。

## 实施步骤

1. 新建 `src/core/workflow-surface.ts`，定义类型和 status 映射。
2. 实现 `buildWorkflowNextProjection`，复用 doctor、flow 和 snapshot 能力。
3. 实现 `buildWorkflowDashboardProjection`，复用 view/flow 聚合能力。
4. 添加单元测试，使用临时项目 fixtures 覆盖关键状态。
5. 运行相关测试、lint 和 build。

## 验证命令

```bash
npm test -- src/core/__tests__/workflow-surface.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：status 映射过度依赖 nextAction 字符串，后续命令文本变化可能导致测试脆弱。实施时应优先基于 spec/task 状态判断，字符串只作为 fallback。
- 风险：dashboard 与 view/flow 聚合重复。实施时应尽量复用已有 snapshot 或 view model。
- 回滚：删除新增 core 文件和测试，不影响现有 CLI 行为。
