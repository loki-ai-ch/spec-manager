---
code: workflow-surface-simplification-L3.2.6
level: L3
title: Workflow Shortcut Write Root Parity
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.2
status: implemented
aiSummary: >-
  补齐 next/brief/dashboard/new feature/top-level run 的 write root parity，修正
  project context 过期 note，并以外部 specStore 测试锁定短路径语义。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey shortcut write root paths
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement workflow surface write root reads
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Implement shortcut write commands parity
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Fix project context note
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: Add store-aware shortcut tests
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.2
created: '2026-07-15T07:16:45.345Z'
updated: '2026-07-15T07:25:04.481Z'
changeSummary: 'cascade: task-complete'
---
# Workflow Shortcut Write Root Parity

## 背景

`workflow-surface-simplification-L3.2.4` 已让第一批 `spec`、`task`、`decision` 核心写命令使用 resolved write root。但后续 README 和 onboarding 把 `next`、`brief`、`dashboard`、`new feature` 和顶层 `run` 推成更常用的短路径。当前这些短路径仍直接使用 execution root 的 `getPaths()` 读取或写入 specs/tasks，导致配置 `specStore.path` 后，推荐入口可能看不到外部 write root 的规格，甚至把新 spec/task 写回代码仓库本地。

## 目标

- 让 `next`、`brief`、`dashboard` 的 workflow/spec/task 读取基于 resolved write root，同时保留 execution root、write root 的投影展示。
- 让 `spec-manager new feature` 使用 resolved write root 创建 L1。
- 让顶层兼容 `spec-manager run <L3-code> --plan <file>` 复用 `task run` 的 store-aware 语义。
- 修正 `project context` 过期 note，避免继续声称写命令仍使用当前项目根。
- 增加测试覆盖外部 `specStore.path` 下短路径读取/写入行为。

## 非目标

- 不引入 `--store <id|path>` 覆盖。
- 不改变 `task run` core/CLI 语义。
- 不迁移历史 specs。
- 不让 read-only `contextSources` 参与写入。

## 实施步骤

1. 走读 `src/cli/usability.ts`、`src/core/workflow-surface.ts`、`src/cli/project.ts` 和 store-aware tests。
2. 调整 workflow surface projection：诊断仍基于 execution root，但 topic snapshot/flow/dashboard 读取 resolved write root。
3. 调整 `brief`：Design Context/Agent Brief 和 workflow next 使用 resolved write root 读取 specs/tasks；输出继续展示 execution root/write root。
4. 调整 `new feature`：使用 write paths helper 创建 L1，未配置 `specStore` 时保持现有行为。
5. 调整顶层 `run`：复用 `runTaskRunCommand` 或等价 store-aware helper，避免在 execution root 创建 task。
6. 更新 `project context` note。
7. 增加 CLI/core tests，覆盖外部 write root 下 `next/dashboard/brief/new feature/run`。
8. 运行 targeted tests、lint、build。

## 接口契约

配置：

```yaml
specStore:
  id: product-planning
  path: ../product-specs
  mode: write
```

从 code repo 执行：

```bash
spec-manager next "auth"
spec-manager dashboard
spec-manager brief "auth"
spec-manager new feature --topic auth "Auth"
spec-manager run auth-L3.1.1 --plan ./plan.json
```

预期：

- 读取类短路径基于 external write root 的 specs/tasks 给出状态和下一步。
- `new feature` 写入 external write root。
- 顶层 `run` 在 external write root 上冻结/创建/启动 task。
- 命令仍展示或在 JSON 中暴露 execution root 与 write root，帮助 Agent 确认写入位置。

## 验收标准

1. **AC-1**: 配置外部 `specStore.path` 时，`next` MUST 基于 external write root 的 specs/tasks 推导下一步。
2. **AC-2**: 配置外部 `specStore.path` 时，`dashboard` MUST 展示 external write root 的 topics/tasks。
3. **AC-3**: 配置外部 `specStore.path` 时，`brief` MUST 使用 external write root 的 specs/tasks 和 DESIGN.md context。
4. **AC-4**: 配置外部 `specStore.path` 时，`new feature` MUST 写入 external write root，不写入 execution root。
5. **AC-5**: 配置外部 `specStore.path` 时，顶层 `run` MUST 在 external write root 上执行 task run，不写入 execution root。
6. **AC-6**: `project context` note MUST accurately describe resolved writeRoot semantics.
7. **AC-7**: 未配置 `specStore` 时，上述短路径 MUST 保持单仓库兼容。
8. **AC-8**: targeted tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/cli/__tests__/store-aware-writes.test.ts src/core/__tests__/workflow-surface.test.ts src/cli/__tests__/usability.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：`brief` 同时依赖 request/topic 推断和 Design Context，切换读取 root 后可能改变相关上下文。测试需要覆盖 external write root 的 spec/task 和 DESIGN.md。
- 风险：顶层 `run` 与 `task run` 输出略有差异。优先复用同一 core command，避免分叉。
- 回滚：恢复短路径对 `getPaths()` 的直接使用，同时保留 L3.2.4 的核心写命令 store-aware 行为。
