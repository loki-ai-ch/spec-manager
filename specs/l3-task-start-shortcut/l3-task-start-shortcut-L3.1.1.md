---
code: l3-task-start-shortcut-L3.1.1
level: L3
title: Task Create Auto-Start CLI
topic: l3-task-start-shortcut
parentCode: l3-task-start-shortcut-L2.1
status: implemented
aiSummary: >-
  在 src/cli/task.ts 为 task create 增加 --start，复用 startTask 输出
  running/startedAt/nextCommand；在 task CLI 测试覆盖 auto-start、JSON 与默认 draft 兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取本 L3、l3-task-start-shortcut-L2.1、历史 Task、agent-plan 模板及 Task CLI
      调用链
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/cli/task.ts 注册 task create --start 参数
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/cli/task.ts 在创建后复用 startTask 启动 Task
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/task.ts 输出 running 状态、startedAt 与 nextCommand
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/cli/__tests__/task.test.ts 覆盖 auto-start、JSON 与默认 draft 兼容
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      验证: npm test -- src/cli/__tests__/task.test.ts && npm run lint && npm run
      build
    status: pending
relations:
  - type: based_on
    target: l3-task-start-shortcut-L2.1
  - type: references
    target: workflow-surface-simplification-L3.4.1
created: '2026-07-15T09:35:56.197Z'
updated: '2026-07-15T09:48:36.476Z'
changeSummary: 'cascade: task-complete'
---
# Task Create Auto-Start CLI - 实施规格

## 目标

实施 `l3-task-start-shortcut-L2.1` 的 L3 裂变项 1：为 frozen L3 的 `task create` 增加显式 `--start`，复用现有 Task 创建与启动状态机，并覆盖文本、JSON 和默认兼容行为。

**前置依赖**：无

## 实施步骤

### Step 1 - 上下文收集

- SHALL 读取本 L3、`l3-task-start-shortcut-L2.1`、同 topic 历史 Task 和 `templates/agent-plan.json`。
- SHALL 复核 `src/cli/task.ts`、`src/cli/task-run.ts`、`src/core/task.ts` 与 `src/cli/__tests__/task.test.ts` 的函数签名和调用链。

### Step 2 - 注册 create --start 参数

- SHALL 在 `src/cli/task.ts` 的 `task create` 命令增加布尔选项 `--start`，默认值为 false，并扩展 action opts 类型。
- SHALL 保持未传 `--start` 时的 create-only 行为和输出结构不变。

### Step 3 - 创建后启动 Task

- SHALL 在 `createTask` 成功后仅当 `opts.start` 为 true 时调用 `startTask(paths, result.task.id, specCode)`。
- SHALL 使用启动后的 TaskRecord 生成输出；若 `startTask` 抛错则传播错误，并保留可手动启动的 draft Task。

### Step 4 - 输出 running 状态与下一步命令

- SHALL 在文本输出中展示 `created and started`、`status: running`、`startedAt` 与第一步 `task step` 命令。
- SHALL 在 `--start --json` 输出中返回 running task、taskFile 与 nextCommand；未传 `--start --json` 时保持现有 create result。
- SHOULD 复用 `task run` 已有 next-step 命令构造逻辑，避免命令文案漂移。

### Step 5 - 添加 CLI 回归测试

- SHALL 在 `src/cli/__tests__/task.test.ts` 覆盖 `task create --start` 的 running 状态、startedAt、文本输出和 JSON 输出。
- SHALL 断言默认 `task create` 仍产生 draft Task，且 frozen gate、active task 拒绝等既有行为不回归。

### Step 6 - 验证

- SHALL 运行目标 CLI 测试、lint 和 build，并确认所有命令 exit code 为 0。

## 验收标准

- AC-1: frozen L3 执行 `task create <spec> --plan <file> --start` 后 Task 状态为 running 且 startedAt 非空。
- AC-2: `--start --json` 返回 running task、taskFile 和可执行的 nextCommand。
- AC-3: 不传 `--start` 时 Task 状态仍为 draft，既有 JSON shape 不变。
- AC-4: create 成功但 start 失败时不伪造 running 状态，错误向调用方传播。

## 关键验收标准

- AC-1
- AC-3

## 验证命令

```bash
# 正向验证：新增参数与输出
npm test -- src/cli/__tests__/task.test.ts
# 预期：目标测试全部通过，exit code 0

# 静态与构建验证
npm run lint
npm run build
# 预期：两条命令 exit code 0
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际工具>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["l3-task-start-shortcut-L3.1.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取本 L3、l3-task-start-shortcut-L2.1、历史 Task、agent-plan 模板及 Task CLI 调用链"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/cli/task.ts 注册 task create --start 参数"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/cli/task.ts 在创建后复用 startTask 启动 Task"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/task.ts 输出 running 状态、startedAt 与 nextCommand"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/task.test.ts 覆盖 auto-start、JSON 与默认 draft 兼容"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: npm test -- src/cli/__tests__/task.test.ts && npm run lint && npm run build"}
  ]
}
```

`autoConfirm: false`，本计划不包含 human_gate，保持显式步骤上报。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| CLI 或输出回归 | 回退 `src/cli/task.ts` 与对应测试的本次变更，恢复 create-only 分支 | < 5 min |
| 已留下 draft Task | 使用现有 `task start <id> --spec <code>` 恢复执行，或按正常 Task 生命周期标记失败 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| create 与 run 的 nextCommand 文案漂移 | 提取或导出共享 helper，并由 CLI 测试锁定精确字符串 |
| JSON 默认行为被意外改变 | 为有无 `--start` 分别断言输出 shape |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | l3-task-start-shortcut-L2.1 | 实现 L2 裂变项 1 |
| references | workflow-surface-simplification-L3.4.1 | 复用既有 task run 实现模式 |
