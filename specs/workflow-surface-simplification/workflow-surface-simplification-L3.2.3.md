---
code: workflow-surface-simplification-L3.2.3
level: L3
title: Workflow Surface Write Root Projection
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.2
status: implemented
aiSummary: >-
  将 spec store resolution 投影到 next/dashboard/brief：新增
  executionRoot/writeRoot/writeStore/contextSources/storeDiagnostics 字段，并在
  text/json 输出中显示 write root；不改变写命令行为。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and current workflow surface projection presenters
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Extend workflow surface projections with write root store data
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update next dashboard brief presenters and tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted workflow surface usability and spec store tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.2
created: '2026-07-15T05:32:12.900Z'
updated: '2026-07-15T05:45:27.113Z'
changeSummary: 'cascade: task-complete'
---
# Workflow Surface Write Root Projection

## 背景

`workflow-surface-simplification-L3.2.1` 实现了 spec store resolver，`workflow-surface-simplification-L3.2.2` 暴露了 `project context` 和 `project store doctor`。但当前 `next`、`dashboard`、`brief` 仍只展示 `projectRoot`，没有明确告诉用户和 Agent 当前 execution root、write root 和 context sources。

为了降低多仓库使用时写错规格根的风险，需要把 store resolution 投影到 workflow surface 输出中。此步骤仍然只读，不改变任何 spec/task/decision 写入行为。

## 目标

- 在 `WorkflowNextProjection` 和 `WorkflowDashboardProjection` 中加入 execution root、write root、write store、context sources 和 store diagnostics。
- `spec-manager next` text/json MUST 展示 write root。
- `spec-manager dashboard` text/json MUST 展示 write root 和 store diagnostics。
- `spec-manager brief` JSON MUST 在 `next` 对象中包含 write root；text 输出 MUST 在 Workflow Next 附近展示 write root。
- 保持 `projectRoot` 字段兼容，避免破坏已有消费者。

## 非目标

- 不让 `next/dashboard/brief` 执行写操作。
- 不修改 `spec/task/decision` 命令的写入 root。
- 不实现 `--store`。
- 不修改 README 或 agent templates。

## 涉及文件

- `src/core/workflow-surface.ts`: 引入 `resolveSpecStore`，扩展 projection 字段。
- `src/cli/usability.ts`: 更新 next/dashboard/brief text presenter。
- `src/core/__tests__/workflow-surface.test.ts`: 补 write root/context source 测试。
- `src/cli/__tests__/usability.test.ts`: 补 CLI 输出测试。

## 实施步骤

1. 扩展 workflow surface projection 类型，保留 `projectRoot`，新增：
   - `executionRoot`
   - `writeRoot`
   - `writeStore`
   - `contextSources`
   - `storeDiagnostics`
2. 在 `buildWorkflowNextProjection` 和 `buildWorkflowDashboardProjection` 中调用 `resolveSpecStore(paths)`。
3. 将 store diagnostics 合并进 workflow warnings，或单独保留 `storeDiagnostics` 字段；JSON 必须能区分来源。
4. 更新 `next` / `dashboard` text presenter 显示 Write Root。
5. 更新 `brief` text 输出，在 Workflow Next 附近显示 Write Root。
6. 增加测试覆盖默认本地 root 和外部 store 配置。
7. 运行 targeted tests、lint、build。

## 接口契约

`next --json` 新增字段示例：

```json
{
  "projectRoot": "/repo/app",
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
  "storeDiagnostics": []
}
```

text 输出必须包含：

```text
Project: /repo/app
Write Root: /repo/product-specs
```

如果 `storeDiagnostics` 非空，text 输出必须显示 diagnostics 或 warning。

## 验收标准

1. **AC-1**: `buildWorkflowNextProjection` MUST 包含 execution root、write root、write store、context sources 和 store diagnostics。
2. **AC-2**: `buildWorkflowDashboardProjection` MUST 包含 execution root、write root、write store、context sources 和 store diagnostics。
3. **AC-3**: `spec-manager next --json` MUST 输出 write root 相关字段。
4. **AC-4**: `spec-manager next` text MUST 显示 `Write Root:`。
5. **AC-5**: `spec-manager dashboard` text/json MUST 显示或包含 write root。
6. **AC-6**: `spec-manager brief` text/json MUST 通过 workflow next projection 暴露 write root。
7. **AC-7**: 本改动 MUST NOT 改变任何写命令行为。

## 验证命令

```bash
npm test -- src/core/__tests__/workflow-surface.test.ts src/cli/__tests__/usability.test.ts src/core/__tests__/spec-store.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：新增 JSON 字段可能让输出变大，但它是向后兼容新增字段。
- 风险：用户可能误解 write root 已影响所有写命令。text 中如有必要应保留 “现有写命令尚未 store-aware” 的 note，但不要污染 JSON 契约。
- 回滚：移除 projection 新字段和 presenter 文案，保留 store resolver 与 project context CLI。
