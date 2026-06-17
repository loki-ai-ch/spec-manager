---
code: delivery-summary-L2.1
level: L2
title: 用户交付摘要设计
topic: delivery-summary
parentCode: delivery-summary-L1
status: implemented
aiSummary: >-
  补齐用户交付摘要 L2 设计：定义只读 delivery summary projection、assist delivery
  CLI、接口契约、受影响模块和 L3 裂变计划。
created: '2026-06-17T07:12:08.769Z'
updated: '2026-06-17T07:42:33.006Z'
changeSummary: 'cascade: task-complete'
---
# 用户交付摘要 — L2 Design

## 背景

`delivery-summary-L1` 要求新增一个只读投影，把一次 Agent Task 的本地事实整理成用户可读的交付说明。现有能力已经提供：

- `buildAcceptanceReport(paths, taskId, specCode)`：验收证据、关键 AC 覆盖、人工验收提示、残余风险。
- `TaskRecord`：Task 状态、步骤、verification records、profile、错误/等待信息。
- `findSpecByCode` / `findTask`：spec 与 task 定位。
- `assist acceptance` CLI：已有验收报告输出模式，可复用错误处理与渲染风格。

本设计把交付摘要定义为一个新的 core projection 和一个 CLI 子命令，不写状态、不运行验证、不完成 Task。

## 方案概述

交付摘要由两层组成：

1. core projection `buildDeliverySummary(paths, taskId, specCode)`：把 spec、task、steps、verification、artifacts、acceptance findings、next action 归并成稳定结构。
2. CLI 命令 `spec-manager assist delivery`：把 projection 渲染成 text 或 JSON。

实现上优先复用现有 evidence/acceptance 结构，不再新增一套任务完成判断逻辑。

## 目标

- 提供 `buildDeliverySummary(paths, taskId, specCode)`，聚合 spec、task、steps、verification、artifacts、acceptance findings 与 next action。
- 提供 `spec-manager assist delivery <taskId> --spec <specCode> [--json]`。
- text 输出面向最终回复用户；JSON 输出面向 Agent/工具链继续加工。
- 复用现有错误语义：missing spec/task 仍抛出 `SPEC_NOT_FOUND` / `TASK_NOT_FOUND` 风格错误，并由 CLI 走现有 assist 错误处理。
- 保持只读：不调用 task complete、task verify、task step、writeSpec、writeTask 或 audit 写入。

## 非目标

- 不自动运行测试或验证命令。
- 不自动判断业务验收已经完成。
- 不替代 `assist acceptance` 的证据明细视图。
- 不生成 release notes、changelog 或 git commit 摘要。
- 不引入网络、远端模型或遥测。

## 技术决策

1. `buildAcceptanceReport` 作为唯一验收证据入口，交付摘要只做再组织，不重算 AC 覆盖。
2. verification 采用 `exitCode === 0` 视为 passed 的简单归一化，failed 只做事实陈述。
3. `summary` 采用 string[]，便于 CLI 分行输出，也便于 JSON 消费方二次加工。
4. `nextAction` 只给单条主建议，避免交付摘要变成任务导航器。
5. 交付摘要不会读取或修改 audit；只读性通过代码依赖边界和测试共同约束。
6. `assist delivery` 必须显式要求 `--spec`，避免跨 spec 的 taskId 歧义。

## 接口契约

### Core

在 `src/core/capability-types.ts` 新增：

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

新增 `src/core/delivery-summary.ts`：

- 输入：`paths`, `taskId`, `specCode`。
- 输出：`DeliverySummaryReport`。
- 错误：沿用 `SPEC_NOT_FOUND` / `TASK_NOT_FOUND`。
- 来源：spec metadata、TaskRecord、buildAcceptanceReport。

### CLI

在 `src/cli/capability.ts` 的 `assist` 命令组新增：

```bash
spec-manager assist delivery <taskId> --spec <specCode>
spec-manager assist delivery <taskId> --spec <specCode> --json
```

输出约束：

- text 包含 `Delivery Summary`、Task、Spec、Status、Summary、Steps、Verifications、Artifacts、Human Acceptance、Residual Risk、Next Action。
- JSON 直接输出 `DeliverySummaryReport`。
- missing spec/task 保持现有 assist 错误出口。

## 受影响模块

- `src/core/capability-types.ts`
- `src/core/delivery-summary.ts`（新增）
- `src/core/acceptance-report.ts`（复用，不改口径）
- `src/cli/capability.ts`
- `src/cli/__tests__/capability.test.ts`
- `src/core/__tests__/delivery-summary.test.ts`（新增）
- `README.md`
- `readme_zh.md`
- `skill/SKILL.md`
- `templates/agents/*`

## 核心流程

1. `findSpecByCode(paths, specCode)`，不存在抛错。
2. `findTask(paths, specCode, taskId)`，不存在抛错。
3. 调用 `buildAcceptanceReport(paths, taskId, specCode)`。
4. 归并 task steps、verification records、artifacts。
5. 生成 summary lines、headline、nextAction、findings。
6. CLI 根据 `--json` 选择 JSON 或 text 渲染。

## L3 裂变计划

### L3.1.1 Core Projection

范围：

- 新增 `DeliverySummaryReport`、`DeliveryVerificationSummary`、`DeliveryStepSummary`。
- 新增 `buildDeliverySummary`。
- 新增 core tests 覆盖 completed / failed verification / no verification / not completed / missing resource。

验收：

- 满足 L1 AC-1 到 AC-5。
- text 相关字段都能由 core 数据稳定生成。

### L3.1.2 CLI 与文档

范围：

- 新增 `assist delivery` CLI。
- 新增 CLI tests。
- 更新 README、readme_zh、skill、templates 的交付建议。

验收：

- 满足 L1 AC-6、AC-7。
- 文档默认交付路径包含 delivery summary。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 与 acceptance 输出重复 | delivery 只做最终交付摘要，acceptance 保留证据明细 |
| 用户误读为业务验收完成 | text 文案只说 recorded evidence / needs human confirmation |
| 输出过长 | text 输出摘要化，JSON 保留完整结构 |
| 只读能力被误接入状态写入 | core tests 可检查 task JSON 和 audit 不被改变；代码不导入写入 API |

## 备注

后续如果需要把 `assist guide` 进一步推荐到 `assist delivery`，应放到独立的小片中处理，不并入本 L2，以免把路由规则和投影实现绑在一起。
