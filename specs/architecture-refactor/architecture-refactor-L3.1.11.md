---
code: architecture-refactor-L3.1.11
level: L3
title: Task Completion Facade 结果兼容修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  保留 runTaskCompletion 的 gateResults，同时恢复 completeTask facade 与 task complete
  --json 的历史四字段结果契约。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充 completeTask facade 与 CLI JSON 精确 shape 回归测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 收窄 completeTask facade 运行时结果
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 保持 runTaskCompletion gate diagnostics 公共契约
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证 completion 专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:40:33.968Z'
updated: '2026-06-11T09:43:54.826Z'
changeSummary: 'cascade: task-complete'
---
# Task Completion Facade 结果兼容修复

## 目标

修复 `task-completion` 拆分后的结果 shape 兼容回归：

- 新 application API `runTaskCompletion()` 合理地新增了 `gateResults`。
- 兼容 facade `completeTask()` 当前直接返回 `runTaskCompletion()` 的完整对象，导致运行时额外暴露 `gateResults`。
- `task complete --json` 直接序列化 `completeTask()` 结果，因此既有 JSON 输出从历史四字段静默扩展为五字段。
- TypeScript `CompleteResult` 接口仍只声明历史四字段，形成类型契约与运行时结果不一致。

本 L3 要求保留新 use case diagnostics，同时恢复既有 facade 和 CLI JSON shape。

## 代码调查

- 重构前 `completeTask()` 返回：`task`、`cascadedSpecs`、`cascadedL1Specs`、`skippedSpecs`。
- `TaskCompletionResult` 在上述字段之外新增 `gateResults`，供新 application API 使用。
- `src/core/task.ts` 当前 `return runTaskCompletion(input)`，没有收窄 facade 结果。
- `src/cli/task.ts` 的 `task complete --json` 使用 `JSON.stringify(result)`，因此暴露额外字段。
- `architecture-refactor-L3.1.1-task-completion` 要求保持 `completeTask` API、CLI 行为和结果字段兼容，并允许 `runTaskCompletion` 额外返回 `gateResults`。

## 实施步骤

### Step 1 - 补充精确结果契约测试

- `runTaskCompletion()` 成功结果必须包含 `gateResults`。
- `completeTask()` 成功结果的 enumerable keys 必须精确为历史四字段。
- 真实 Commander `task complete --json` 输出不得包含 `gateResults`，且历史四字段保持存在。

### Step 2 - 收窄兼容 facade

- `completeTask()` 继续委托 `runTaskCompletion()` 执行全部门禁和事务。
- facade 显式构造并返回 `CompleteResult` 历史四字段。
- 不复制 completion 业务逻辑，不改变错误、审计、状态或事务行为。

### Step 3 - 保持新 API diagnostics

- `runTaskCompletion()` 继续返回 `TaskCompletionResult.gateResults`。
- `src/index.ts` 继续公开 `runTaskCompletion` 和 `completeTask`。
- 增加公共 API 行为契约测试，明确两种入口的不同结果层级。

### Step 4 - 验证

- 运行 task completion/task cascade/task CLI/public API 专项测试。
- 运行全量测试、lint、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/task-completion.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__/task.test.ts src/core/__tests__/public-api.test.ts
npm test
npm run lint
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: `runTaskCompletion()` 成功结果继续包含 `gateResults`。
2. **AC-2**: `completeTask()` 运行时结果精确保持历史四字段，不暴露 `gateResults`。
3. **AC-3**: `task complete --json` 保持历史 JSON shape，不包含 `gateResults`。
4. **AC-4**: completion 门禁、审计、事务、文本输出和状态级联行为不变。
5. **AC-5**: 专项测试、全量测试、lint、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.11"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充 completeTask facade 与 CLI JSON 精确 shape 回归测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "收窄 completeTask facade 运行时结果"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "保持 runTaskCompletion gate diagnostics 公共契约"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证 completion 专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改公共 API 与 CLI JSON 结果契约，需要人工批准。

## 回滚方案

若 facade 收窄影响内部调用，保留 `runTaskCompletion` 作为完整结果入口，并让需要 diagnostics 的调用方显式迁移；`completeTask` 仍以兼容结果为准。
