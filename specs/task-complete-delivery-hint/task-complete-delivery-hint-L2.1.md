---
code: task-complete-delivery-hint-L2.1
level: L2
title: Task 完成交付提示设计
topic: task-complete-delivery-hint
parentCode: task-complete-delivery-hint-L1
status: implemented
aiSummary: >-
  设计 task complete 成功后的 delivery nextCommand 提示：CLI text 追加 Next 块，JSON 增加
  nextCommand，不改 core completion 门禁。
created: '2026-06-17T08:27:49.925Z'
updated: '2026-06-17T08:42:27.516Z'
changeSummary: 'cascade: task-complete'
---
# Task 完成交付提示设计 — L2 Design

## 背景

`task complete` 成功后已经输出 completed、finishedAt、verification gate、cascade 和 R18 决策卡结果。现在缺少一个明确的最终交付入口提示，导致弱 Agent 完成 Task 后还要凭记忆运行 `assist delivery`。

本设计只增强 CLI 成功输出，不改变 core completion 门禁、状态机、verification 执行或 cascade 逻辑。

## 方案概述

在 `src/cli/task.ts` 的 `task complete` 成功路径中计算 delivery command：

```text
spec-manager assist delivery <taskId> --spec <specCode>
```

text 输出末尾增加：

```text
Next:
  spec-manager assist delivery T-001 --spec auth-L3.1.1
```

`--json` 输出在 legacy result 外增加非破坏性字段：

```json
{
  "task": { ... },
  "cascadedSpecs": [],
  "cascadedL1Specs": [],
  "skippedSpecs": [],
  "nextCommand": "spec-manager assist delivery T-001 --spec auth-L3.1.1"
}
```

## 目标

- `task complete` 成功 text 输出包含 delivery summary 命令。
- `task complete --json` 包含 `nextCommand` 字段。
- 完成失败路径不输出 delivery 提示。
- 不改变 `runTaskCompletion` 的 core result 和门禁逻辑。
- 补 CLI tests 覆盖 text、json、failure path。

## 非目标

- 不改 `runTaskCompletion` core gate 流程。
- 不改 `completeTask` facade。
- 不改 `assist delivery` 输出。
- 不自动运行 delivery summary。

## 技术决策

1. 提示在 CLI 层生成，避免污染 core completion 领域对象。
2. JSON 使用新增 `nextCommand` 顶层字段，不删除任何旧字段。
3. specCode 使用 `result.task.specCode`，避免用户未传 `--spec` 时命令缺上下文。
4. text 输出放在 cascade/R18 之后，作为最后下一步。
5. failure path 不 catch completion error，不主动输出 nextCommand。

## 接口契约

### Text 输出

成功完成后追加：

```text
Next:
  spec-manager assist delivery <taskId> --spec <specCode>
```

### JSON 输出

`task complete --json` 输出保留现有 legacy fields，并新增：

- `nextCommand: string`

示例：

```json
{
  "task": { "id": "T-001", "specCode": "auth-L3.1.1", "status": "completed" },
  "cascadedSpecs": [],
  "cascadedL1Specs": [],
  "skippedSpecs": [],
  "nextCommand": "spec-manager assist delivery T-001 --spec auth-L3.1.1"
}
```

## 受影响模块

- `src/cli/task.ts`
- `src/cli/__tests__/task.test.ts`
- README / readme_zh / skill/templates 如需同步，只加短提示

## 核心流程

1. 调用 `runTaskCompletion`。
2. completion 成功后计算 `deliveryCommand(result.task.id, result.task.specCode)`。
3. JSON 模式：输出 legacy result + `nextCommand`。
4. Text 模式：保留原输出，末尾增加 `Next:` 块。
5. completion 抛错时不改变现有错误路径。

## L3 裂变计划

### L3.1.1 Completion Delivery Hint

范围：

- 新增 CLI delivery command helper。
- text/json 输出增加 nextCommand。
- CLI tests 覆盖成功 text、成功 json、失败不输出。
- 运行全量验证。

验收：

- 满足 L1 AC-1 到 AC-5。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| JSON 消费方不接受新增字段 | 不删除旧字段；新增字段语义独立 |
| 输出过长 | 只加 2 行 Next 块 |
| 错误路径误提示交付 | 只在 runTaskCompletion 成功后计算和打印 |

## 备注

如果后续希望 core API 也暴露 structured next action，可另起独立 spec；本片先保持 CLI 层增强。
