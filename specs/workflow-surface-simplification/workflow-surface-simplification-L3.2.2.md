---
code: workflow-surface-simplification-L3.2.2
level: L3
title: Project Context and Store Doctor CLI
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.2
status: implemented
aiSummary: >-
  新增只读 project context 与 project store show/doctor CLI：暴露 execution root、write
  root、write store、context sources 和 diagnostics；不接入写命令。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and existing project CLI presenter tests
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement project context and project store read-only CLI commands
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add CLI tests for context store show and store doctor
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted project workflow and spec store tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.2
created: '2026-07-15T05:23:14.273Z'
updated: '2026-07-15T05:29:21.321Z'
changeSummary: 'cascade: task-complete'
---
# Project Context and Store Doctor CLI

## 背景

`workflow-surface-simplification-L3.2.1` 已经实现 spec store 配置解析和 resolver，但目前只能被 core 测试使用。为了让用户和 Agent 明确“当前在哪个代码仓库执行、规格会写到哪里、还有哪些只读上下文源”，需要提供只读 CLI 输出。

本规格新增 `project context` 和 `project store` 只读命令。它们只展示 resolver 结果和 diagnostics，不改变任何写命令行为。

## 目标

- 新增 `spec-manager project context [--json]`，输出 execution root、write root、write store、context sources、diagnostics 和建议下一步。
- 新增 `spec-manager project store show [--json]`，展示当前 store resolution。
- 新增 `spec-manager project store doctor [--json]`，聚焦 diagnostics，并给出可执行修复建议。
- 保持 `project status/doctor` 现有行为兼容。
- 所有新增命令 MUST 为只读命令。

## 非目标

- 不新增 `project store set`。
- 不支持 `--store` 覆盖。
- 不修改 `getPaths()` 行为。
- 不接入 `spec/task/decision` 写命令。
- 不自动创建外部 store。

## 涉及文件

- `src/cli/project.ts`: 注册 `project context` 和 `project store show/doctor`。
- `src/core/spec-store.ts`: 如需要，补充 projection helper；不得引入写操作。
- `src/cli/__tests__/project-workflow.test.ts` 或新增测试文件：覆盖 text/json 输出与 diagnostics。
- `src/core/__tests__/spec-store.test.ts`: 如 resolver 字段变化，同步更新。

## 实施步骤

1. 在 `project` 命令下新增 `context` 子命令。
2. 在 `project` 命令下新增 `store` command group，包含 `show` 和 `doctor`。
3. 实现 text presenter：
   - `context` 输出 execution root、write root、write store、context sources、diagnostics、next action。
   - `store show` 输出 store resolution 摘要。
   - `store doctor` 输出 diagnostics 和 fix。
4. 实现 `--json`，stdout 必须是单个 JSON 对象。
5. 增加测试覆盖默认本地 store、外部 store、diagnostics、JSON 契约。
6. 运行 targeted tests、lint、build。

## 接口契约

### project context

```bash
spec-manager project context
spec-manager project context --json
```

text 输出必须包含：

- `Execution Root:`
- `Write Root:`
- `Write Store:`
- `Context Sources:`
- `Diagnostics:`
- `Next:`

json 输出建议直接基于 resolver：

```json
{
  "executionRoot": "/repo/app",
  "writeRoot": "/repo/product-specs",
  "writeStore": {
    "id": "product-planning",
    "path": "/repo/product-specs",
    "mode": "write",
    "exists": true,
    "initialized": true
  },
  "contextSources": [],
  "diagnostics": [],
  "nextAction": "spec-manager next \"<work>\""
}
```

### project store show

```bash
spec-manager project store show
spec-manager project store show --json
```

职责是展示当前 resolved store，不强调修复。

### project store doctor

```bash
spec-manager project store doctor
spec-manager project store doctor --json
```

职责是输出 diagnostics。无问题时 text 输出 `Store doctor: ok`。

## 验收标准

1. **AC-1**: `project context` MUST 输出 execution root、write root、write store 和 context sources。
2. **AC-2**: `project context --json` MUST 输出单个 JSON 对象，并包含 `executionRoot`、`writeRoot`、`writeStore`、`contextSources`、`diagnostics`。
3. **AC-3**: `project store show` MUST 展示当前 write store 和 read-only context sources。
4. **AC-4**: `project store doctor` MUST 展示 diagnostics；无 diagnostics 时 MUST 输出 ok。
5. **AC-5**: 外部 store 路径缺失/未初始化时 CLI MUST 输出 fix 建议。
6. **AC-6**: 新命令 MUST 不写入任何文件。
7. **AC-7**: 现有 `project status`、`project doctor` 测试 MUST 保持兼容。

## 验证命令

```bash
npm test -- src/cli/__tests__/project-workflow.test.ts src/core/__tests__/spec-store.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：`project context` 可能让用户误以为写命令已 store-aware。输出必须说明当前命令只读，写命令接入会后续实施。
- 风险：diagnostics 和 project doctor 概念重叠。`store doctor` 只聚焦 store/root/context source。
- 回滚：删除新增 CLI 子命令和测试，保留 core resolver。
