---
code: delivery-summary-L3.1.1
level: L3
title: 交付摘要 Core Projection
topic: delivery-summary
parentCode: delivery-summary-L2.1
status: implemented
aiSummary: >-
  实现用户交付摘要 core projection：新增 DeliverySummaryReport 类型与
  buildDeliverySummary，只读聚合 spec/task/verification/acceptance 事实。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 delivery-summary-L3.1.1 与相关 acceptance/task 类型，确认实现边界
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 DeliverySummaryReport 相关类型与 buildDeliverySummary core projection
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: >-
      新增 core tests 覆盖 passed/failed/no verification/not completed/missing
      resource/只读性
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行 targeted tests、full tests、build 与 spec validate
    status: pending
created: '2026-06-17T07:15:32.508Z'
updated: '2026-06-17T07:42:32.998Z'
changeSummary: 'cascade: task-complete'
---
# 交付摘要 Core Projection — L3 Impl

## 背景

`delivery-summary-L2.1` 将用户交付摘要拆成 core projection 与 CLI 两片。本片只实现 core projection，不新增 CLI 命令，不改文档，不改变任何 spec/task 状态。

目标是在本地事实源上生成稳定的 `DeliverySummaryReport`，供后续 CLI 渲染和 Agent 消费。

## 目标

- 新增 `DeliverySummaryReport` 及相关 summary 类型。
- 新增 `buildDeliverySummary(paths, taskId, specCode)`。
- 复用 `buildAcceptanceReport`，不重算 acceptance 口径。
- 覆盖 passed verification、failed verification、无 verification、task 未完成、missing resource、只读性测试。
- 保持本片只读，不新增 CLI、不更新文档、不写 spec/task/audit。

## 实现范围

新增/修改：

- `src/core/capability-types.ts`
  - 新增 `DeliveryVerificationSummary`
  - 新增 `DeliveryStepSummary`
  - 新增 `DeliverySummaryReport`
- `src/core/delivery-summary.ts`（新增）
  - 导出 `buildDeliverySummary(paths, taskId, specCode)`
- `src/core/__tests__/delivery-summary.test.ts`（新增）
  - 覆盖核心投影行为

不包含：

- 不新增 `assist delivery` CLI。
- 不更新 README / skill / templates。
- 不修改 `assist guide` 路由。
- 不写 spec/task/audit。

## 接口契约

### TypeScript 类型

```ts
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
```

### Core 函数

```ts
export function buildDeliverySummary(
  paths: ProjectPaths,
  taskId: string,
  specCode: string,
): DeliverySummaryReport
```

错误语义：

- spec 不存在：抛 `SPEC_NOT_FOUND: <specCode>`。
- task 不存在：抛 `TASK_NOT_FOUND: <taskId> (in <specCode>)`。

## 实施步骤

1. 读取 `delivery-summary-L3.1.1`、`src/core/acceptance-report.ts`、`src/core/task.ts`、`src/core/capability-types.ts`，确认字段和错误语义。
2. 在 `src/core/capability-types.ts` 增加 delivery summary 相关类型，并导入 `VerificationLayer` 类型。
3. 新增 `src/core/delivery-summary.ts`，实现 spec/task 查找、acceptance report 复用、steps/verifications/artifacts 归一化、findings/nextAction/summary 生成。
4. 新增 `src/core/__tests__/delivery-summary.test.ts`，使用现有测试 fixture 方式创建 frozen L3、Task、verification records。
5. 运行 targeted tests，修正类型或行为问题。
6. 运行 full tests、build、spec validate。
7. 记录 task step 与 verification evidence，完成 Agent Task。

## 核心算法

`buildDeliverySummary` 执行顺序：

1. 使用 `findSpecByCode(paths, specCode)` 定位 spec；不存在则抛 `SPEC_NOT_FOUND`。
2. 使用 `findTask(paths, specCode, taskId)` 定位 task；不存在则抛 `TASK_NOT_FOUND`。
3. 调用 `buildAcceptanceReport(paths, taskId, specCode)` 获取验收证据。
4. 从 `task.steps ?? []` 归一化 `DeliveryStepSummary[]`。
5. 从 `acceptance.verifications` 归一化 `DeliveryVerificationSummary[]`：
   - `exitCode === 0` -> `passed`
   - 其他 -> `failed`
6. 从 verification artifacts 聚合去重 artifacts。
7. 生成 `findings`：
   - 无 verification：`delivery.verification.missing` advisory，nextCommand 指向 `spec-manager task verify <taskId> --spec <specCode>`。
   - 有 failed verification：`delivery.verification.failed` warning，提示修复失败验证。
   - task 非 completed：`delivery.task.not-completed` advisory，nextCommand 指向 `spec-manager assist next <taskId> --spec <specCode>`。
8. 生成 `nextAction`：
   - 无 verification：`spec-manager task verify <taskId> --spec <specCode>`。
   - 有 failed verification：`Fix failed verification and record a new verification before handoff.`
   - task 非 completed：`spec-manager assist next <taskId> --spec <specCode>`。
   - humanAcceptance 或 residualRisk 有 warning/blocking：`Review acceptance findings with the user before final confirmation.`
   - 其他：`Share this delivery summary with the user for final confirmation.`
9. 生成 `summary`：至少包含 spec 状态、task 状态/步骤概况、verification passed/failed 统计、acceptance/risk finding 统计。

## 关键验收标准

- **AC-1**: Given completed task 和 passed verification，When 调用 `buildDeliverySummary`，Then 返回 `schemaVersion=delivery-summary.v1`，并包含 spec、taskStatus、steps、passed verification、artifacts、humanAcceptance、residualRisk、nextAction。
- **AC-2**: Given task 有 failed verification，When 生成摘要，Then verification status 为 `failed`，并包含 `delivery.verification.failed` warning finding。
- **AC-3**: Given task 没有 verification，When 生成摘要，Then 包含 `delivery.verification.missing` advisory finding，且 nextAction 指向 `spec-manager task verify <taskId> --spec <specCode>`。
- **AC-4**: Given task 未 completed，When 生成摘要，Then 包含 `delivery.task.not-completed` advisory finding，且 nextAction 指向 `spec-manager assist next <taskId> --spec <specCode>`，除非无 verification 或 failed verification 有更高优先级。
- **AC-5**: Given spec 或 task 不存在，When 调用 core 函数，Then 抛出 `SPEC_NOT_FOUND` 或 `TASK_NOT_FOUND` 风格错误。
- **AC-6**: Given 调用 `buildDeliverySummary`，Then 不写入 spec/task/audit 文件。

## 测试计划

新增 `src/core/__tests__/delivery-summary.test.ts`：

1. `builds a delivery summary for a completed task with passed verification`
2. `marks failed verification and emits warning finding`
3. `warns when verification evidence is missing`
4. `points incomplete tasks back to assist next`
5. `throws stable errors for missing spec or task`
6. `does not mutate task or audit files`

## Agent Task Plan

```json
{
  "coveredSpecs": ["delivery-summary-L3.1.1"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "读取 delivery-summary-L3.1.1 与相关 acceptance/task 类型，确认实现边界"
    },
    {
      "stepNo": 2,
      "stepType": "code_change",
      "name": "新增 DeliverySummaryReport 相关类型与 buildDeliverySummary core projection"
    },
    {
      "stepNo": 3,
      "stepType": "test",
      "name": "新增 core tests 覆盖 passed/failed/no verification/not completed/missing resource/只读性"
    },
    {
      "stepNo": 4,
      "stepType": "verification",
      "name": "运行 targeted tests、full tests、build 与 spec validate"
    }
  ]
}
```

## 验证命令

- `npm test -- src/core/__tests__/delivery-summary.test.ts`
- `npm test`
- `npm run build`
- `spec-manager spec validate delivery-summary-L3.1.1`

## 风险与约束

- 本片不得引入 CLI 渲染，避免和 L3.1.2 范围重叠。
- 本片不得调用写入 API；只读性必须有测试覆盖。
- summary 文案必须避免“业务已通过”或“全部完成”这类超出机器证据的断言。
