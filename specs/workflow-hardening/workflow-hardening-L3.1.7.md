---
code: workflow-hardening-L3.1.7
level: L3
title: Normalize legacy step type on write
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
aiSummary: Normalize legacy mcp_tool step type before task write
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 task create、plan validation、stepType schema 和相关测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 createTask 使用 parsedPlan.data 作为归一化写入源
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 validatePlanJson 兼容旧 mcp_tool 且保持新枚举提示
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 补充 task create 和 validatePlanJson 兼容归一化测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 targeted tests、build、doctor 和 git diff --check
    status: pending
created: '2026-06-16T09:37:13.168Z'
updated: '2026-06-16T09:41:46.079Z'
changeSummary: 'cascade: task-complete'
---
# Normalize legacy step type on write — 实施规格

## 目标

修复 `workflow-hardening-L3.1.6` 后发现的兼容链路缺口：旧 `stepType: "mcp_tool"` 虽然能被 `StepTypeSchema` 接受并归一化为 `tool_action`，但 `createTask()` 仍使用原始 `input.planJson` 写入 task，导致旧值可能继续落盘。

本 L3 只修复归一化落盘和 plan warning 一致性，不再做新的历史数据迁移。

## 代码调查

- `src/schemas/spec.ts`
  - `StepTypeSchema` 使用 preprocess 将旧值 `mcp_tool` 映射为 `tool_action`。
  - `PlanJsonSchema` 可以产出归一化后的 `parsedPlan.data`。
- `src/core/task.ts`
  - `createTask()` 当前执行 `PlanJsonSchema.safeParse(input.planJson)`，但后续仍从 `input.planJson.steps` 写 task steps。
  - R12 coveredSpecs 检查也直接读取原始 `input.planJson.coveredSpecs`。
- `src/core/validate.ts`
  - `validatePlanJson()` 当前只接受 `llm_call | tool_action | human_gate`，会把旧 `mcp_tool` 当非法值报警。
- `src/core/__tests__/validate.test.ts`
  - 已覆盖 `PlanJsonSchema.parse()` 能把旧值归一化。
- `src/core/__tests__/task-cascade.test.ts` / `src/cli/__tests__/task.test.ts`
  - 可补充 createTask/CLI 写入归一化行为。

## 实施步骤

### Step 1 — 使用 parsed plan 作为写入事实源

- 在 `createTask()` 中将 `parsedPlan.data` 作为后续 plan 事实源。
- `coveredSpecs` 检查、steps 写入、spec frontmatter steps 快照均使用归一化后的 plan。
- 创建 task 后，旧输入 `mcp_tool` 必须落盘为 `tool_action`。

### Step 2 — 修复 plan warning 一致性

- `validatePlanJson()` 对旧 `mcp_tool` 兼容，不再给非法枚举 warning。
- warning 文案仍只推荐 `llm_call | tool_action | human_gate`。
- 非法值仍正常 warning。

### Step 3 — 补充测试

- 增加 core 测试：`createTask()` 接收旧 `mcp_tool` plan 时，task JSON/spec steps 均为 `tool_action`。
- 增加 validate 测试：`validatePlanJson()` 对旧 `mcp_tool` 不产生非法枚举 warning。
- 如 CLI 已覆盖 createTask 路径，可不额外加 CLI 重复测试。

### Step 4 — 验证

- 运行 targeted tests：
  - `npm test -- src/core/__tests__/task-cascade.test.ts src/core/__tests__/validate.test.ts src/cli/__tests__/task.test.ts`
- 运行 `npm run build`。
- 运行 `spec-manager project doctor`。
- 运行 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/task-cascade.test.ts src/core/__tests__/validate.test.ts src/cli/__tests__/task.test.ts
npm run build
spec-manager project doctor
git diff --check
```

## 验收标准

- `createTask()` 不再将旧 `mcp_tool` 写入新 task JSON 或 spec frontmatter steps。
- `validatePlanJson()` 对旧 `mcp_tool` 兼容，不产生误导性非法枚举 warning。
- 新推荐枚举仍是 `tool_action`，不会重新向用户面暴露 `mcp_tool`。
- 验证命令通过。

## planJson

```json
{
  "coveredSpecs": ["workflow-hardening-L3.1.7"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "读取 task create、plan validation、stepType schema 和相关测试"
    },
    {
      "stepNo": 2,
      "stepType": "tool_action",
      "name": "修改 createTask 使用 parsedPlan.data 作为归一化写入源"
    },
    {
      "stepNo": 3,
      "stepType": "tool_action",
      "name": "修改 validatePlanJson 兼容旧 mcp_tool 且保持新枚举提示"
    },
    {
      "stepNo": 4,
      "stepType": "tool_action",
      "name": "补充 task create 和 validatePlanJson 兼容归一化测试"
    },
    {
      "stepNo": 5,
      "stepType": "tool_action",
      "name": "验证 targeted tests、build、doctor 和 git diff --check"
    }
  ]
}
```

## 回滚方案

如修复导致旧 plan 无法创建 task，回滚本次提交；`workflow-hardening-L3.1.6` 的历史迁移和新枚举仍保持不变。
