---
code: task-complete-delivery-hint-L3.1.1
level: L3
title: Completion Delivery Hint 实现
topic: task-complete-delivery-hint
parentCode: task-complete-delivery-hint-L2.1
status: implemented
aiSummary: >-
  实现 task complete 成功后的 delivery nextCommand 提示：text 增加 Next 块，JSON 增加
  nextCommand，不改 core completion。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 task-complete-delivery-hint-L3.1.1 与 task complete CLI 实现/测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 在 task complete 成功 text/json 输出中增加 delivery nextCommand
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 补 CLI tests 覆盖 text/json/失败路径
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行 targeted tests、full tests、build 与 spec validate
    status: pending
created: '2026-06-17T08:29:42.663Z'
updated: '2026-06-17T08:42:27.508Z'
changeSummary: 'cascade: task-complete'
---
# Completion Delivery Hint 实现 — L3 Impl

## 背景

`task complete` 成功后已经有完整门禁和 cascade 输出，但没有直接提示最终交付摘要命令。本片只在 CLI 成功输出中增加 delivery next step，不改变 core completion 逻辑。

## 目标

- 在 `task complete` text 成功输出末尾增加 `Next:` 块。
- 在 `task complete --json` 输出中增加 `nextCommand` 字段。
- completion 失败路径不输出 delivery 提示。
- 不改 `runTaskCompletion`、`completeTask`、门禁、cascade、audit。
- 补 CLI tests 并跑全量验证。

## 实现范围

修改：

- `src/cli/task.ts`
  - 新增 `deliverySummaryCommand(taskId, specCode)` helper。
  - `--json` 输出 legacy result + `nextCommand`。
  - text 输出成功末尾追加 `Next:` 块。
- `src/cli/__tests__/task.test.ts`
  - 成功 text 输出包含 delivery command。
  - 成功 json 输出包含 `nextCommand`。
  - completion gate 失败时不输出 delivery command。

不包含：

- 不改 `src/core/task-completion.ts`。
- 不改 `src/core/task.ts` facade。
- 不改 `assist delivery`。
- 不新增 task 状态。

## 接口契约

### Text

成功路径输出末尾追加：

```text
Next:
  spec-manager assist delivery <taskId> --spec <specCode>
```

### JSON

`task complete --json` 在现有字段上增加：

```json
{
  "nextCommand": "spec-manager assist delivery T-001 --spec auth-L3.1.1"
}
```

旧字段 `task`、`cascadedSpecs`、`cascadedL1Specs`、`skippedSpecs` 保持不变。

## 实施步骤

1. 读取冻结 L3、`src/cli/task.ts` 和 `src/cli/__tests__/task.test.ts`。
2. 在 CLI 层新增 delivery command helper。
3. 修改 `task complete` text/json 成功输出。
4. 补 CLI tests 覆盖 text、json、失败不提示。
5. 运行 targeted tests、full tests、build、spec validate。
6. 记录 Task steps 和 verification evidence，完成 Task。

## 关键验收标准

- **AC-1**: Given `task complete` 成功，When 使用 text 输出，Then 输出包含 `Next:` 和 `spec-manager assist delivery <taskId> --spec <specCode>`。
- **AC-2**: Given `task complete` 成功，Then 原有 completed、finishedAt、verification、cascade/R18 输出仍存在。
- **AC-3**: Given `task complete --json` 成功，Then JSON 包含 `nextCommand`，且旧字段仍存在。
- **AC-4**: Given completion gate 失败，When CLI 抛错，Then stdout 不包含 delivery command。
- **AC-5**: Given 实现完成，Then core completion tests 不需要改动且全量测试通过。

## 测试计划

Targeted：

- `npm test -- src/cli/__tests__/task.test.ts`

Regression：

- `npm test`
- `npm run build`
- `spec-manager spec validate task-complete-delivery-hint-L3.1.1`

## Agent Task Plan

```json
{
  "coveredSpecs": ["task-complete-delivery-hint-L3.1.1"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "读取 task-complete-delivery-hint-L3.1.1 与 task complete CLI 实现/测试"
    },
    {
      "stepNo": 2,
      "stepType": "tool_action",
      "name": "在 task complete 成功 text/json 输出中增加 delivery nextCommand"
    },
    {
      "stepNo": 3,
      "stepType": "tool_action",
      "name": "补 CLI tests 覆盖 text/json/失败路径"
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

- `npm test -- src/cli/__tests__/task.test.ts`
- `npm test`
- `npm run build`
- `spec-manager spec validate task-complete-delivery-hint-L3.1.1`

## 风险与约束

- 不修改 core completion result，避免破坏 facade 与既有核心测试。
- JSON 只新增字段，不删除旧字段。
- delivery 提示只在 completion 成功后生成。
