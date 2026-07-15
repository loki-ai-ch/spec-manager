---
code: workflow-surface-simplification-L3.4.1
level: L3
title: Task Run Core and CLI
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.4
status: implemented
aiSummary: >-
  实现 task run 核心与 CLI：一条命令复用 L3 transition、createTask、startTask，完成 L3 freeze +
  task create/start；支持 json、profile、store-aware write root，并保持 spec confirm
  不自动执行。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey task run integration points
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement task run helper and CLI
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add task run behavior tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.4
created: '2026-07-15T06:50:04.510Z'
updated: '2026-07-15T06:59:40.636Z'
changeSummary: 'cascade: task-complete'
---
# Task Run Core and CLI

## 背景

`workflow-surface-simplification-L2.4` 已确认：L3 确认后进入执行是高频连续动作，当前 `spec confirm`、`task create`、`task start` 拆成多轮用户输入，导致对话重复、plan 文件管理分散，也容易漏掉 `task start`。本 L3 实现第一阶段：新增 `spec-manager task run <L3-code> --plan <file>`，用一条显式命令完成 L3 freeze、Task create 和 Task start。

现有代码中：

- `src/cli/spec-handlers.ts` 已封装 `runSpecTransitionCommand`，包含 L3 draft confirm -> frozen、placeholder/R22、R2/R9 audit 和状态机规则。
- `src/core/task.ts` 已封装 `createTask`、`startTask`、active task 检查、planJson 校验和 adaptive workflow profile 规则。
- `src/cli/task.ts` 已将 task 命令接入 store-aware `getWritePaths()`。

实现必须复用这些能力，不能复制第二套冻结或任务门禁。

## 目标

- 新增 `spec-manager task run <specCode> --plan <file>`。
- 当 L3 为 `draft` 或历史兼容 `confirmed` 时，先冻结 L3，再 create/start task。
- 当 L3 已为 `frozen` 时，直接 create/start task。
- 输出 spec transition、task id、task file、startedAt 和 nextCommand。
- 支持 `--json` 单对象输出。
- 支持 `--auto-confirm`、`--profile`、`--profile-reason`，与 `task create` 行为一致。
- 保持 store-aware write root。

## 非目标

- 不改变 `spec confirm <L3>` 行为。
- 不自动生成 planJson。
- 不自动复用已有 active/draft task。
- 不实现 guidance/docs 更新；由 L3.4.2 处理。
- 不新增顶层 `run` alias。
- 不跳过任何 planJson、profile、critical AC 或 task 状态门禁。

## 实施步骤

1. 新增 task run core/helper：
   - 可放在 `src/cli/task-run.ts`，或 `src/core/task-run.ts` + CLI presenter。
   - 输入：paths、specCode、planJson、autoConfirm、profile、profileReason。
   - 输出：spec transition summary、created task、task file、started task、nextCommand。
2. 复用 L3 transition 逻辑：
   - 若 spec status 为 `draft`：调用 `runSpecTransitionCommand({ command: 'confirm' })`，得到 frozen。
   - 若 spec status 为 `confirmed`：调用 `runSpecTransitionCommand({ command: 'freeze' })` 或等价 transition，兼容历史 confirmed L3。
   - 若 spec status 为 `frozen`：不 transition，记录 old/new 均为 frozen 或 transition=null。
   - 其它状态 fail fast。
3. 复用 task create/start：
   - 调用 `createTask`。
   - 调用 `startTask(paths, task.id, specCode)`。
   - 不直接写 task JSON。
4. 在 `src/cli/task.ts` 注册：
   - `task run <specCode>`
   - required `--plan <file>`
   - options: `--auto-confirm`、`--profile`、`--profile-reason`、`--json`
   - 使用 `getWritePaths()`。
5. 错误处理：
   - 复用 `PLAN_JSON_INVALID`、`ADAPTIVE_WORKFLOW_DISABLED`、`INVALID_WORKFLOW_PROFILE`、`PROFILE_OVERRIDE_REASON_REQUIRED`、`GOVERNED_CRITICAL_AC_REQUIRED`、`UNKNOWN_CRITICAL_AC` 的 exit 2 格式。
   - active task 已存在时应 exit 2，并提示 `task list --spec <code>` 或 `task start <taskId> --spec <code>`。
   - 非 L3 或非 draft/confirmed/frozen 状态应 exit 2。
6. 添加测试：
   - draft L3 + valid plan -> frozen + task running。
   - frozen L3 + valid plan -> task running，不重复 transition。
   - `spec confirm <L3>` 仍只 frozen，不创建 task。
   - missing/invalid plan -> exit 2。
   - plan `coveredSpecs` 不含 specCode -> exit 2。
   - active task 已存在 -> exit 2。
   - `--json` 输出单对象。
   - external store 场景使用 write root。
7. 运行 targeted tests、lint、build。

## 接口契约

命令：

```bash
spec-manager task run <specCode> --plan <file> [--auto-confirm] [--profile <profile>] [--profile-reason <reason>] [--json]
```

Text 输出：

```text
✓ L3 workflow-surface-simplification-L3.4.1: draft → frozen
✓ Task T-001 created and started for workflow-surface-simplification-L3.4.1
  file: /path/specs/.../tasks/workflow-surface-simplification-L3.4.1-T-001.json
  status: running
  startedAt: 2026-07-15T...
  profile: standard (project-default)

Next:
  spec-manager task step T-001 --spec workflow-surface-simplification-L3.4.1 --no 1 --status succeeded --output-json '{"summary":"..."}'
```

JSON 输出：

```json
{
  "spec": {
    "code": "workflow-surface-simplification-L3.4.1",
    "oldStatus": "draft",
    "newStatus": "frozen",
    "transitioned": true
  },
  "task": {
    "id": "T-001",
    "status": "running",
    "file": "/path/specs/.../tasks/workflow-surface-simplification-L3.4.1-T-001.json",
    "startedAt": "2026-07-15T...",
    "profile": "standard",
    "profileSource": "project-default"
  },
  "nextCommand": "spec-manager task step T-001 --spec workflow-surface-simplification-L3.4.1 --no 1 --status succeeded --output-json '{\"summary\":\"...\"}'"
}
```

## 验收标准

1. **AC-1**: `task run` MUST 用一条命令完成 draft L3 freeze、Task create 和 Task start。
2. **AC-2**: frozen L3 MUST 可直接 `task run` create/start。
3. **AC-3**: `spec confirm <L3>` MUST 保持只冻结，不创建 Task。
4. **AC-4**: `task run` MUST 要求 `--plan`，且沿用现有 planJson 校验与错误提示。
5. **AC-5**: 已有 active/draft task 时 MUST fail fast，不自动复用。
6. **AC-6**: `task run --json` MUST 输出单个对象，包含 spec、task、nextCommand。
7. **AC-7**: external specStore 场景 MUST 写入 resolved write root。
8. **AC-8**: targeted tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/cli/__tests__/task.test.ts src/cli/__tests__/store-aware-writes.test.ts
npm run lint
npm run build
```

如实现新增独立测试文件，应包含该文件和现有 task/store-aware tests。

## 风险与回滚

- 风险：复制 spec confirm 逻辑导致状态机分叉。必须复用 `runSpecTransitionCommand` 或抽取同一 core transition helper。
- 风险：create 成功但 start 失败会产生 draft task。start 失败理论上只应来自状态机异常；如发生，返回明确错误，后续可手动 `task start`。
- 风险：active task 自动复用会启动错任务。第一版 fail fast。
- 回滚：删除 `task run` 命令/helper/tests，不影响现有 `spec confirm`、`task create`、`task start`。
