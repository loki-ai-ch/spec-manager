---
code: l3-task-start-shortcut-L2.1
level: L2
title: L3 Confirm and Task Auto-Start Shortcut Design
topic: l3-task-start-shortcut
parentCode: l3-task-start-shortcut-L1
status: implemented
aiSummary: >-
  设计 L3 执行快捷入口：保留 task run 作为 confirm/create/start 主路径，新增 task create --start 让
  frozen L3 创建后立即 running，并保持默认 draft 兼容。
relations:
  - type: references
    target: workflow-surface-simplification-L3.4.1
  - type: references
    target: workflow-surface-simplification-L3.4.2
created: '2026-07-15T09:27:11.137Z'
updated: '2026-07-15T10:07:25.857Z'
changeSummary: 'cascade: task-complete'
---
# L3 Confirm and Task Auto-Start Shortcut Design — 技术设计

## 方案概述

本设计在现有 `task run` 基础上补齐用户自然入口：

```
draft L3 + plan  ── spec-manager task run <L3> --plan ./plan.json ──> frozen + Task running
frozen L3 + plan ── spec-manager task create <L3> --plan ./plan.json --start ──> Task running
```

保留旧行为：

```bash
spec-manager task create <L3> --plan ./plan.json
# 仍只创建 draft task，不自动启动
```

这样不改变生命周期状态机，不移除现有三步命令，只把用户反馈里最重复的 “create 之后还要手动 start” 做成显式参数，并把文档/Agent guidance 的主路径收敛到一条推荐命令。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 合并 L3 confirm + create + start 的主入口 | A: 改 `spec confirm` 加 `--run`; B: 继续推荐现有 `task run`; C: 新增 `spec confirm-run` | B | `task run` 已实现并测试 draft/frozen L3 的 freeze/create/start；避免重复状态机 |
| create 后立即启动 | A: 改 `task create` 默认自动 start; B: 新增 `task create --start`; C: 强制用户用 `task run` | B | 满足“create 之后立即执行”的需求，同时保留 draft task 兼容 |
| 输出结构 | A: 复用 create 输出后追加 startedAt/Next; B: 复用 task run printer | A | `create --start` 不做 spec transition，输出应保持 create 命令语义 |
| JSON 输出 | A: 保持 create result；B: task status 返回 running 并包含 startedAt/nextCommand | B | 机器调用方需要知道 task 已 running |
| 文档主路径 | A: 三步全部列为主路径; B: task run / create --start 为主路径，三步为兼容高级路径 | B | 降低上手门槛 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/cli/task.ts` | 修改 | `task create` 增加 `--start`，创建后调用 `startTask` | CLI tests |
| `src/cli/__tests__/task.test.ts` | 修改 | 覆盖 `task create --start`、默认 draft 兼容、JSON 输出 | targeted tests |
| `README.md` / `readme_en.md` | 修改 | L3 执行主路径说明 | docs-guidance |
| `skill/SKILL.md` / `templates/agents/*` | 修改 | Agent guidance 推荐 task run / create --start | docs-guidance |
| `templates/L3-impl.md` / `templates/agent-plan.json` | 可能修改 | 若当前模板仍教三步为主路径则改为 shortcut | docs-guidance |

## 数据模型

不新增持久化数据模型。

`TaskRecord.status` 已支持 `draft` 和 `running`；`startTask` 已设置 `startedAt`。

## 接口契约

### Existing Main Shortcut

```bash
spec-manager task run <L3-code> --plan ./plan.json
```

语义不变：

- draft L3: `draft -> frozen`, create task, start task。
- frozen L3: 不重复 transition，create task, start task。
- 输出 running task id 和下一步 `task step` 命令。

### New Create Auto-Start

```bash
spec-manager task create <L3-code> --plan ./plan.json --start
```

语义：

- 仅接受 frozen L3，与现有 `task create` 一致。
- 先调用 `createTask` 创建 draft task。
- 随后调用 `startTask(paths, task.id, specCode)`。
- 输出 task status 为 `running`、`startedAt` 和下一步 `task step` 命令。

默认兼容：

```bash
spec-manager task create <L3-code> --plan ./plan.json
```

仍输出 `status: draft`。

### JSON Output

`task create --start --json` 输出：

```json
{
  "task": {
    "id": "T-001",
    "status": "running",
    "startedAt": "..."
  },
  "taskFile": "...",
  "nextCommand": "spec-manager task step T-001 --spec <L3-code> --no 1 --status succeeded --output-json '{\"summary\":\"...\"}'"
}
```

不传 `--start` 的 `--json` 保持现有 create result，避免破坏脚本。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| `createTask` 成功但 `startTask` 失败 | 可能留下 draft task | startTask 失败直接抛错，用户可手动 `task start` | CLI 输出错误；不伪造 running |
| 已有 active task | `createTask` 拒绝 | 保持现有 `TASK_ALREADY_ACTIVE` | 用户完成/失败已有任务 |
| 用户想只建 draft | 默认不传 `--start` | 兼容旧行为 | 无需恢复 |

## 向后兼容

- `task run` 行为不变。
- `task create` 默认行为不变。
- `task start` 保留。
- `spec confirm` 仍只负责冻结 L3，不创建 task。
- 不自动生成 planJson。

## 关键交互流程

```text
用户: 确认并执行 L3
  -> spec-manager task run <L3> --plan ./plan.json
  -> L3 frozen
  -> Task running
  -> 输出 next task step command

用户: L3 已 frozen，创建并执行任务
  -> spec-manager task create <L3> --plan ./plan.json --start
  -> Task running
  -> 输出 next task step command
```

## 可观测性

- **日志**: CLI 输出 `created and started`、`status: running`、`startedAt`。
- **指标**: 无新增持久化指标。
- **告警**: 无。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Task run command | `src/cli/task-run.ts` | `runTaskRunCommand`, `printTaskRunResult` | 保持 confirm/create/start 主路径 |
| Task CLI | `src/cli/task.ts` | `registerTaskCommands` | 新增 `task create --start` |
| Task core | `src/core/task.ts` | `createTask`, `startTask` | 复用创建和启动行为 |
| CLI tests | `src/cli/__tests__/task.test.ts` | task CLI suite | 覆盖新参数与兼容 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| l3-task-start-shortcut-L3.1.1 | Task Create Auto-Start CLI：新增 `task create --start`、JSON/text 输出、测试 | l3-task-start-shortcut-L2.1 confirmed |
| l3-task-start-shortcut-L3.1.2 | Shortcut Guidance Sync：README、skill、agent templates 统一推荐 `task run` / `task create --start`，保留三步兼容说明 | l3-task-start-shortcut-L3.1.1 implemented |

## 验证策略

| 场景 | 验证 |
|---|---|
| frozen L3 `task create --start` | CLI test 断言 task status running、startedAt 存在 |
| default `task create` | CLI test 断言 task status draft |
| JSON 输出 | CLI test 断言 status/nextCommand |
| task run 不回归 | 现有 task run tests |
| docs guidance | docs-guidance tests |
| 全量回归 | `npm test`、`npm run lint`、`npm run build` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 用户混淆 `task run` 和 `task create --start` | 文档说明：draft L3 用 `task run`；已 frozen L3 可用 `task create --start` |
| JSON shape 改动破坏脚本 | 仅 `--start --json` 使用新 shape；默认 `--json` 保持 create result |
| 输出文案漂移 | docs-guidance 测试覆盖关键命令 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | l3-task-start-shortcut-L1 | 承接需求 |
| references | workflow-surface-simplification-L2.4 | 既有 confirm-and-run 设计 |
| references | workflow-surface-simplification-L3.4.1 | 既有 task run core |
| references | workflow-surface-simplification-L3.4.2 | 既有 task run guidance |
