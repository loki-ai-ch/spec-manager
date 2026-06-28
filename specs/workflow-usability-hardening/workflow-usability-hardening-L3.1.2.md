---
code: workflow-usability-hardening-L3.1.2
level: L3
title: Safe and Batch Task Step Reporting
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L2.1
status: implemented
aiSummary: 实施规格：增强 task step 上报的最新快照 merge，并新增 task step-batch 用于多步骤安全上报。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey task step reporting write path
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement safe step merge and batch CLI
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update task step reporting tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
relations:
  - type: based_on
    target: workflow-usability-hardening-L2.1
created: '2026-06-27T14:04:30.157Z'
updated: '2026-06-27T14:16:16.128Z'
changeSummary: 'cascade: task-complete'
---
# Safe and Batch Task Step Reporting — 实施规格

## 目标

降低多个 `spec-manager task step` 并发执行时的 JSON 覆盖风险，并提供官方 `task step-batch` 入口，方便 Agent 一次性上报多个 step，避免并行进程互相覆盖。

## 范围

包含：

- 调整 `reportStep` 写入逻辑，使它基于最新 task 快照 merge 当前 step。
- 增加有限 retry 或冲突重读机制，降低并发读-改-写丢失。
- 新增 `spec-manager task step-batch <taskId> --input <json> [--spec <specCode>]`。
- batch 内复用 `reportStep` 语义，保留 R15 warning。
- 增加 core/CLI 测试覆盖多 step 顺序上报、不同 step 不互相覆盖、batch warning 输出。

不包含：

- 进程级跨平台文件锁。
- 修改 task JSON schema。
- 改变 `task step` 现有参数 contract。
- planJson diagnostics 和 section alias。

## 关键验收标准

1. **AC-1**: `reportStep` MUST 基于最新 task 文件状态更新目标 step，避免用旧快照覆盖其他 step。
2. **AC-2**: `task step-batch` MUST 能从 JSON 文件顺序上报多个 step，并输出每个 step 的结果。
3. **AC-3**: batch 上报 MUST 复用单步 R15 warning 行为。
4. **AC-4**: 现有 `task step` CLI 行为 MUST 保持兼容。
5. **AC-5**: 测试 MUST 覆盖多个 step 更新后状态均保留为 succeeded。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/task.ts` | 调整 `reportStep` merge 最新 task 快照，新增 batch helper 可选 |
| `src/cli/task.ts` | 增加 `task step-batch` 命令 |
| `src/cli/__tests__/task.test.ts` | 覆盖 step-batch CLI |
| `src/core/__tests__/task-cascade.test.ts` 或相关 task 测试 | 覆盖多 step 更新不丢失 |
| `README.md` / `readme_en.md` / `skill/SKILL.md` | 说明 batch 用于多 step/并发场景 |

## 实施步骤

1. 读取 `reportStep`、`findTaskById`、`writeTaskJSON`、task CLI 测试，确认现有写入路径。
2. 调整 `reportStep`：定位 spec 后重新读取最新 task，基于最新 `steps` 替换目标 step。
3. 如需要，加入最多 2 次 retry：写入前后若检测到目标外 step 被旧值覆盖，则重读 merge。
4. 新增 batch input parser，输入包含 `steps[]`，每项字段对应 `task step` flags。
5. 增加 `task step-batch` CLI 命令和 text/json 输出。
6. 增加测试覆盖单步兼容、batch 多 step、R15 warning。
7. 运行聚焦测试与全量验证。

## 验证命令

```bash
npm test -- --run src/cli/__tests__/task.test.ts src/core/__tests__/task-cascade.test.ts
npm test
npm run lint
npm run build
```

## 回滚策略

若 batch 或 merge 逻辑引入兼容问题，回滚 `task step-batch` 命令和 `reportStep` 最新快照 merge；现有 task 文件 schema 不变，无数据迁移。
