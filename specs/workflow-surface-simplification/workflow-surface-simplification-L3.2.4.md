---
code: workflow-surface-simplification-L3.2.4
level: L3
title: Store-aware Spec and Task Write Commands
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.2
status: implemented
aiSummary: >-
  第一批 store-aware 写命令：为 spec/task/decision CLI 引入 write root helper，使有效
  specStore.path 下核心写命令写入 external write root；未配置时保持本地兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey CLI path usage
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Add store-aware write paths helper
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Connect spec task decision commands
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Add external store write tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.2
created: '2026-07-15T05:46:23.536Z'
updated: '2026-07-15T05:56:19.977Z'
changeSummary: 'cascade: task-complete'
---
# Store-aware Spec and Task Write Commands

## 背景

`workflow-surface-simplification-L3.2.1` 到 `workflow-surface-simplification-L3.2.3` 已经实现了 spec store resolver、只读 project context/store doctor，以及 workflow surface 的 write root 投影。但当前 `spec`、`task`、`decision` 等写命令仍使用当前 project root。对于多仓库场景，用户已经能看到 write root，却无法让核心写命令写入该 root，体验仍不闭环。

本规格实现第一批 store-aware 写命令：当 `.spec-manager/config.yaml` 配置了有效 `specStore.path` 时，核心写命令应使用 resolved write root；未配置时保持现有单仓库行为。

## 目标

- 为核心写命令引入 store-aware paths resolver。
- `spec new/update/confirm/freeze/validate/show/list/add-relation` MUST 能在 configured write root 上工作。
- `task create/start/step/verify/complete/show/list/evidence` MUST 能在 configured write root 上工作。
- `decision create/list/show/update/supersede/set-partial/delete` MUST 能在 configured write root 上工作。
- 命令输出 SHOULD 在写入或读取时显示 write root，至少在新 store-aware helper 可用处保留调试能力。
- 未配置 `specStore` 时 MUST 保持当前行为和测试兼容。

## 非目标

- 不实现 `--store <id|path>` 覆盖。
- 不实现 `project store set`。
- 不迁移已有 specs/tasks/decisions。
- 不让只读 context source 参与写入。
- 不要求所有非核心命令一次性 store-aware；project doctor/status/docs/check 可后续单独处理。

## 涉及文件

- `src/cli/common.ts` 或新增 CLI helper：提供 `getWritePaths()` / `resolveWritePaths()`。
- `src/core/spec-store.ts`: 如需要，提供 `resolveWriteProjectPaths(paths)`。
- `src/cli/spec.ts`: 使用 write root paths。
- `src/cli/task.ts`: 使用 write root paths。
- `src/cli/decision.ts`: 使用 write root paths。
- 相关 CLI 测试：验证外部 write root 下 spec/task/decision 文件写入。
- 现有 core tests 不应需要修改，除非类型调整。

## 实施步骤

1. 新增 store-aware ProjectPaths helper：
   - 输入 execution paths。
   - 调用 `resolveSpecStore(executionPaths)`。
   - 若 diagnostics 存在 error，写命令 MUST 拒绝并提示 fix。
   - 返回 `getPaths(writeRoot)`。
2. 将 `spec` CLI 命令中的 `getPaths()` 替换为 write paths helper。
3. 将 `task` CLI 命令中的 `getPaths()` 替换为 write paths helper。
4. 将 `decision` CLI 命令中的 `getPaths()` 替换为 write paths helper。
5. 添加测试：
   - 无 `specStore` 时行为保持本地写入。
   - 配置外部 write root 时，`spec new` 写入外部 root。
   - 外部 root 上 frozen L3 可创建/启动 task。
   - decision create/list 使用外部 root。
   - missing/uninitialized write root 时写命令失败并包含 fix。
6. 运行 targeted tests、lint、build。

## 接口契约

配置示例：

```yaml
specStore:
  id: product-planning
  path: ../product-specs
  mode: write
```

执行：

```bash
spec-manager spec new L1 --topic auth --title "Auth"
```

预期：

- 如果 `../product-specs` 存在且已初始化，spec 写入 `../product-specs/specs/auth/auth-L1.md`。
- 如果 `../product-specs` 缺失或未初始化，命令失败，并输出 resolver diagnostic 与 fix。
- 未配置 `specStore` 时，仍写入当前项目 `specs/`。

## 验收标准

1. **AC-1**: 未配置 `specStore` 时，spec/task/decision 写命令 MUST 保持现有行为。
2. **AC-2**: 配置有效外部 write root 时，`spec new` MUST 写入 external write root。
3. **AC-3**: 配置有效外部 write root 时，task create/start/step/verify/complete MUST 使用 external write root 的 specs/tasks。
4. **AC-4**: 配置有效外部 write root 时，decision create/list/show MUST 使用 external write root。
5. **AC-5**: 写命令 MUST NOT 写入 read-only context source。
6. **AC-6**: write root diagnostics 有 error 时，写命令 MUST fail fast，并展示 fix。
7. **AC-7**: targeted tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/cli/__tests__/spec.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/decision.test.ts src/core/__tests__/spec-store.test.ts
npm run lint
npm run build
```

如现有测试文件名不同，实施时应选择覆盖 spec/task/decision CLI 的实际测试文件。

## 风险与回滚

- 风险：一次性接入 spec/task/decision 写命令影响面大。实施应集中在 CLI paths helper，避免改 core 存储逻辑。
- 风险：某些只读命令也位于同一 CLI 文件中，误改后可能改变读取语义。测试必须覆盖主要读写路径。
- 风险：task id `T-001` 在不同 write root 下各自独立，测试需要显式传 `--spec` 避免歧义。
- 回滚：恢复 CLI 使用 `getPaths()` 的位置，保留 resolver 和只读 context 能力。
