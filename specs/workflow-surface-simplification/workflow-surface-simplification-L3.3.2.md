---
code: workflow-surface-simplification-L3.3.2
level: L3
title: Setup CLI and JSON Presenter
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.3
status: implemented
aiSummary: >-
  实现 setup CLI 暴露层：新增顶层 setup 与 project setup alias，共用 buildSetupSurface
  projection 和 text/json presenter；保持只读，不安装 agent、不写配置、不推进 spec/task。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey setup CLI registration points
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement setup presenter and CLI handlers
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add setup CLI tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.3
created: '2026-07-15T06:30:18.717Z'
updated: '2026-07-15T06:38:19.189Z'
changeSummary: 'cascade: task-complete'
---
# Setup CLI and JSON Presenter

## 背景

`workflow-surface-simplification-L3.3.1` 已经实现 `buildSetupSurface` 只读 projection，聚合 initialized、execution/write root、provider readiness、uxProfile、workflowProfile、nextAction 和 suggestedCommands。当前能力仍停留在 core 层，用户和 Agent 还不能通过推荐入口直接消费 setup projection。

本规格实现 CLI 暴露层：提供 `spec-manager setup` 和 `spec-manager project setup`，二者共享同一 projection 与 presenter，默认只读输出，不写文件、不安装 agent、不推进任何 spec/task 状态。

## 目标

- 新增顶层 `spec-manager setup [request...]` 命令，作为 onboarding 第一入口。
- 新增 `spec-manager project setup [request...]` alias，语义与顶层 setup 完全一致。
- 支持 `--json` 输出单个 setup projection 对象。
- 支持 text presenter，第一屏展示 project/root、write root、provider readiness、ux/workflow profile、next action 和 suggested commands。
- 保持现有 `project init`、`project agents`、`next`、`brief`、`dashboard`、`project doctor` 行为兼容。

## 非目标

- 不实现 `--apply`。
- 不安装或覆盖 agent files。
- 不写 `.spec-manager/config.yaml`，不保存 `uxProfile`。
- 不实现 `--store <id|path>` override。
- 不改变 task workflow profile 的 `standard/governed` 行为。
- 不让 setup 自动创建、确认、冻结或完成任何 spec/task。

## 实施步骤

1. 走读当前 CLI 注册结构：
   - 顶层 quick path 在 `src/cli/usability.ts`。
   - `project` 子命令在 `src/cli/project.ts`。
   - JSON/text presenter 可参考 `next`、`dashboard` 和 shared presenter 写法。
2. 新增 setup presenter：
   - 可放在 `src/cli/setup-presenter.ts` 或 `src/cli/usability.ts` 内。
   - text presenter 必须基于 `SetupSurfaceProjection`。
   - JSON presenter 直接 `JSON.stringify(projection, null, 2)`，不得混入其他 stdout。
3. 注册顶层 `setup [request...]`：
   - options: `--topic <topic>`、`--json`。
   - 调用 `buildSetupSurface(getPaths(), { request, topic })`。
   - 不要求 initialized；未初始化时也要输出初始化建议。
4. 注册 `project setup [request...]`：
   - options 与顶层一致。
   - 与顶层共用同一个 handler 或 helper，避免语义分叉。
5. Text 输出要求：
   - 显示 `Project`、`Execution Root`、`Write Root`。
   - 显示 `UX Profile` 与 `Workflow Profile`，并用一句话说明 UX profile 只影响呈现。
   - 汇总 provider 状态，例如 installed/available 数量和下一条安装建议。
   - 展示 diagnostics，error 置于 warnings/diagnostics 区域。
   - 展示 `Next:` 和 `Suggested Commands:`。
6. 添加 CLI tests：
   - `setup --json` 输出单个 JSON 对象，包含 `schemaVersion: setup.v1`。
   - `project setup --json` 与顶层 setup 关键字段一致。
   - 未初始化项目输出 `project init` nextAction。
   - initialized local 项目 text 输出 write root 和 provider suggestion。
   - external store 场景 text/json 输出 external writeRoot。
   - broken write root 不 throw，输出 diagnostic 和 `project store doctor` 建议。
7. 运行 targeted tests、lint、build。

## 接口契约

新增命令：

```bash
spec-manager setup [request...] [--topic <topic>] [--json]
spec-manager project setup [request...] [--topic <topic>] [--json]
```

JSON 输出：

- 必须是单个 JSON object。
- 必须复用 `SetupSurfaceProjection`。
- 不得输出额外说明、warning 前缀或日志。

Text 输出建议：

```text
Setup: spec-manager
Project Root: /repo/app
Execution Root: /repo/app
Write Root: /repo/product-specs

Profiles:
  UX: core (presentation only)
  Workflow: standard (adaptive workflow disabled)

Agents:
  installed: codex
  available: claude, codebuddy, cursor, windsurf
  Next: spec-manager project agents --provider all

Diagnostics:
  - [error] store_path_missing: ...
    fix: ...

Next:
  spec-manager next "<work>"

Suggested Commands:
  - spec-manager project context --json
  - spec-manager project store doctor
```

## 验收标准

1. **AC-1**: `spec-manager setup --json` MUST 输出单个 `setup.v1` JSON object。
2. **AC-2**: `spec-manager project setup --json` MUST 与顶层 setup 共用同一 projection 语义。
3. **AC-3**: setup 命令 MUST NOT 写文件、安装 agent、创建/确认/freeze/complete specs/tasks。
4. **AC-4**: 未初始化项目 MUST 能输出 setup projection 和 `project init` 建议。
5. **AC-5**: external `specStore.path` 场景 MUST 在 text/json 中显示 resolved write root。
6. **AC-6**: broken write root MUST 不 throw，且输出 diagnostic、blockingReason 和 `project store doctor` 建议。
7. **AC-7**: text presenter MUST 明确区分 `uxProfile` 与 task workflow profile。
8. **AC-8**: targeted tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/cli/__tests__/setup.test.ts src/core/__tests__/setup-surface.test.ts
npm run lint
npm run build
```

如实施时合并到已有 CLI 测试文件，应选择覆盖 setup CLI、project setup alias 和 setup surface projection 的实际测试集合。

## 风险与回滚

- 风险：顶层 setup 与 project setup 逻辑复制会产生漂移；必须共用 helper。
- 风险：text presenter 输出太长，反而不像 onboarding。应保持第一屏短，可执行命令明确。
- 风险：未初始化场景如果调用 requireInitialized，会破坏 setup 诊断入口。setup 必须允许未初始化。
- 回滚：删除 CLI 注册和测试，保留 core setup projection 不影响现有命令。
