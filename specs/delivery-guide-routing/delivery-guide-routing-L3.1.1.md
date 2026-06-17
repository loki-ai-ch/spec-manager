---
code: delivery-guide-routing-L3.1.1
level: L3
title: Delivery Stage 路由实现
topic: delivery-guide-routing
parentCode: delivery-guide-routing-L2.1
status: implemented
aiSummary: >-
  实现 guided assist delivery stage：completed task + 交付意图推荐 assist delivery，证据意图保留
  acceptance，未完成任务保留 task-next。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 delivery-guide-routing-L3.1.1 与现有 guided assist 实现和测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 扩展 GuidedAssistStage 并实现 delivery intent 路由
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 补 core 和 CLI tests 覆盖 delivery/acceptance/task-next 路由
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行 targeted tests、full tests、build 与 spec validate
    status: pending
created: '2026-06-17T08:01:19.923Z'
updated: '2026-06-17T08:15:59.905Z'
changeSummary: 'cascade: task-complete'
---
# Delivery Stage 路由实现 — L3 Impl

## 背景

`assist delivery` 已实现最终交付摘要；`assist guide` 当前仍把 `handoff/deliver/交付` 归入 acceptance。为减少弱 Agent 记忆命令的负担，本片在 guided assist 中新增 delivery stage 路由。

## 目标

- 扩展 `GuidedAssistStage` 增加 `delivery`。
- 在 completed task + 交付意图下推荐 `spec-manager assist delivery <taskId> --spec <specCode>`。
- 将 evidence / AC / coverage / 验收覆盖等证据审查意图保留给 `assist acceptance`。
- 非 completed task 即使有交付意图，也继续推荐 `assist next`。
- 补 core 和 CLI tests，验证 JSON/text 都能显示 delivery stage。

## 实现范围

修改：

- `src/core/capability-types.ts`
  - `GuidedAssistStage` 增加 `delivery`。
- `src/core/guided-assist.ts`
  - 新增 `isDeliveryIntent`。
  - 收窄 `isAcceptanceIntent`。
  - 新增 `deliveryCommand`。
  - 调整 `buildReportForContext` 中 task-bound 路由顺序。
  - `alternativesFor('delivery')` 增加 acceptance 和 task show。
- `src/core/__tests__/guided-assist.test.ts`
  - completed + delivery intent -> delivery。
  - completed + evidence/acceptance intent -> acceptance。
  - running + delivery intent -> task-next。
- `src/cli/__tests__/capability.test.ts`
  - `assist guide --json` 可输出 delivery stage。
  - text 输出可显示 `Stage: delivery` 和 delivery next command。

不包含：

- 不改 `assist delivery` 输出。
- 不改 `buildDeliverySummary`。
- 不新增 CLI 参数。
- 不写 spec/task/audit。

## 接口契约

### GuidedAssistStage

```ts
export type GuidedAssistStage =
  | 'brief'
  | 'critique'
  | 'task-next'
  | 'drift'
  | 'acceptance'
  | 'delivery'
  | 'flow'
  | 'needs-input';
```

### 路由优先级

在绑定 task 的场景：

1. drift intent -> `drift`。
2. task status 非 `completed` -> `task-next`。
3. completed task + delivery intent -> `delivery`。
4. acceptance/evidence intent -> `acceptance`。
5. completed task 默认 -> `acceptance`。

### 意图关键词

Delivery intent：

- `handoff`
- `deliver`
- `delivery`
- `final`
- `summary`
- `交付`
- `总结`
- `最终回复`

Acceptance/evidence intent：

- `acceptance`
- `evidence`
- `coverage`
- `AC`
- `验收`
- `证据`
- `覆盖`

若同时命中 delivery 与 evidence，在 completed task 中 evidence intent 优先 acceptance。

## 实施步骤

1. 读取冻结 L3、`guided-assist.ts`、`capability-types.ts`、core/CLI tests。
2. 扩展 `GuidedAssistStage` 类型。
3. 调整 `buildReportForContext` 路由顺序并新增 delivery helper。
4. 补 core tests 覆盖三类路由优先级。
5. 补 CLI tests 覆盖 JSON/text delivery stage。
6. 运行 targeted tests、full tests、build、spec validate。
7. 记录 Task steps 和 verification evidence，完成 Task。

## 关键验收标准

- **AC-1**: Given completed task 和 request `准备最终交付总结`，When 调用 `buildGuidedAssistReport`，Then stage 为 `delivery`，nextCommand 为 `spec-manager assist delivery <taskId> --spec <specCode>`。
- **AC-2**: Given completed task 和 request `查看验收证据覆盖`，When 调用 `buildGuidedAssistReport`，Then stage 为 `acceptance`，nextCommand 为 `spec-manager assist acceptance <taskId> --spec <specCode>`。
- **AC-3**: Given running task 和 request `准备交付`，When 调用 `buildGuidedAssistReport`，Then stage 为 `task-next`。
- **AC-4**: Given CLI `assist guide --json` 和 completed delivery intent，Then JSON 输出包含 `stage: "delivery"` 与 delivery nextCommand。
- **AC-5**: Given CLI text 输出，Then 包含 `Stage: delivery` 和 `Next: spec-manager assist delivery ...`。
- **AC-6**: Given 运行 guide 路由，Then 不修改 task/spec/audit 状态。

## 测试计划

Targeted tests：

- `npm test -- src/core/__tests__/guided-assist.test.ts`
- `npm test -- src/cli/__tests__/capability.test.ts`

Regression：

- `npm test`
- `npm run build`
- `spec-manager spec validate delivery-guide-routing-L3.1.1`

## Agent Task Plan

```json
{
  "coveredSpecs": ["delivery-guide-routing-L3.1.1"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "读取 delivery-guide-routing-L3.1.1 与现有 guided assist 实现和测试"
    },
    {
      "stepNo": 2,
      "stepType": "tool_action",
      "name": "扩展 GuidedAssistStage 并实现 delivery intent 路由"
    },
    {
      "stepNo": 3,
      "stepType": "tool_action",
      "name": "补 core 和 CLI tests 覆盖 delivery/acceptance/task-next 路由"
    },
    {
      "stepNo": 4,
      "stepType": "tool_action",
      "name": "运行 targeted tests、full tests、build 与 spec validate"
    }
  ]
}
```

## 验证命令

- `npm test -- src/core/__tests__/guided-assist.test.ts`
- `npm test -- src/cli/__tests__/capability.test.ts`
- `npm test`
- `npm run build`
- `spec-manager spec validate delivery-guide-routing-L3.1.1`

## 风险与约束

- 不让 delivery 抢走 evidence/coverage/验收证据意图。
- 不让 running task 因为用户说交付而跳过 task-next。
- stage 枚举扩展必须有 core 和 CLI JSON/text 测试覆盖。
