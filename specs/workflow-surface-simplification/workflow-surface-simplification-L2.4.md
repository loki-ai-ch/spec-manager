---
code: workflow-surface-simplification-L2.4
level: L2
title: L3 Confirm and Run Shortcut Design
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L1
status: implemented
aiSummary: >-
  设计 L3 确认与任务启动合并入口：新增显式 task run 命令，一次完成 L3 freeze、task create、task start；保留
  spec confirm 只确认语义，并要求 planJson/状态机门禁不被绕过。
relations:
  - type: based_on
    target: workflow-surface-simplification-L1
created: '2026-07-15T06:47:48.511Z'
updated: '2026-07-15T06:59:40.643Z'
changeSummary: 'cascade: task-complete'
---
# L3 Confirm and Run Shortcut Design

## 背景

本轮对话暴露出一个高频摩擦点：用户确认 L3 后，通常下一句话就是“创建并执行任务”。当前流程把这拆成两个用户动作：

```bash
spec-manager spec confirm <L3-code>
spec-manager task create <L3-code> --plan ./plan.json
spec-manager task start T-001 --spec <L3-code>
```

这个拆分符合严格状态机，但对真实协作不够顺滑。用户已经明确批准 L3 时，很多场景下就是要进入 Agent Task 执行；Agent 反复等待第二次“创建并执行任务”会显得机械，也增加漏建 task、漏 start 或 plan 路径不一致的概率。

本设计新增一个显式的合并快捷入口，把“确认 L3”和“创建/启动任务”作为同一个用户授权动作执行，同时保留现有 `spec confirm` 的保守行为。

## 目标

- 提供一个显式命令，把 L3 `draft -> frozen`、`task create`、`task start` 合并为一次操作。
- 保留 `spec confirm` 的现有语义：只推进状态，不自动执行。
- 保证合并入口不绕过 L3 人类确认、planJson 校验、Task 创建审计和 start 状态机。
- 降低 Agent 对话里的重复确认：用户说“确认并执行”“创建并执行任务”时，Agent 可以使用一个命令完成。
- 输出 task id、task file、startedAt 和下一条 `task step` 建议。

## 非目标

- 不让普通 `spec confirm <L3>` 自动创建任务。
- 不支持无 planJson 的执行。
- 不自动生成 planJson；Agent 仍需显式提供计划文件。
- 不绕过 placeholder/R22、planJson/R12/R11/R10、adaptive workflow profile、governed critical AC 等门禁。
- 不创建或执行 L1/L2。
- 不支持交互式确认 prompt；用户授权由命令本身表达。

## 方案概述

推荐新增 task 领域命令：

```bash
spec-manager task run <L3-code> --plan ./plan.json [--auto-confirm] [--profile standard|governed] [--profile-reason "..."] [--json]
```

语义：

1. 读取 `<L3-code>`。
2. 如果 L3 是 `draft` 或历史兼容 `confirmed`：
   - 执行与 `spec confirm`/`spec freeze` 等价的 L3 冻结逻辑。
   - 必须通过 placeholder 和 L3 plan/content 校验。
3. 如果 L3 已是 `frozen`：
   - 直接进入 task create/start。
4. 如果 L3 已是 `implemented` 或 archived：
   - fail fast，提示查看 delivery 或创建后续 delta。
5. 读取并校验 `--plan`。
6. 调用现有 `createTask`。
7. 调用现有 `startTask`。
8. 输出下一条 `task step` 或 `assist next` 建议。

可选 alias：

```bash
spec-manager run <L3-code> --plan ./plan.json
```

但第一版建议只实现 `task run`，避免与已有顶层 `run <specCode>` 旧快捷入口语义混淆。若要改造旧 `run`，应作为兼容行为接入同一 handler。

## 技术决策

- 合并命令放在 `task` 命名空间，因为用户意图是“进入执行”，而不是单纯确认 spec。
- 命令实现必须复用现有 spec transition handler 或抽取共享 core helper，不能复制一套冻结规则。
- `task run` 必须使用 store-aware write paths，与 `spec/task` 现有 write root 行为一致。
- `task run` 应返回结构化结果：spec transition、created task、started task、next command。
- 如果 task 已存在，应 fail fast，并提示 `task start <taskId> --spec <code>` 或 `task list --spec <code>`；第一版不自动复用已有 task，避免误启动旧任务。
- JSON 输出必须是单对象，适合 Agent 使用。

## 接口契约

命令：

```bash
spec-manager task run <specCode> --plan <file> [--auto-confirm] [--profile <profile>] [--profile-reason <reason>] [--json]
```

Text 输出示例：

```text
✓ L3 workflow-surface-simplification-L3.3.2: draft -> frozen
✓ Task T-001 created and started
  file: specs/.../tasks/workflow-surface-simplification-L3.3.2-T-001.json
  startedAt: 2026-07-15T...

Next:
  spec-manager task step T-001 --spec workflow-surface-simplification-L3.3.2 --no 1 --status succeeded --output-json '{"summary":"..."}'
```

JSON 输出示例：

```json
{
  "spec": {
    "code": "workflow-surface-simplification-L3.3.2",
    "oldStatus": "draft",
    "newStatus": "frozen"
  },
  "task": {
    "id": "T-001",
    "status": "running",
    "file": "..."
  },
  "nextCommand": "spec-manager task step T-001 --spec workflow-surface-simplification-L3.3.2 --no 1 --status succeeded --output-json '{\"summary\":\"...\"}'"
}
```

## Agent Guidance

Agent guidance 应新增规则：

- 当用户明确说“确认并执行”“创建并执行任务”“继续执行 L3”时，优先使用 `spec-manager task run <L3-code> --plan <planFile>`。
- 当用户只说“确认 L3”或给出 `spec confirm` 命令时，只执行 `spec confirm`，不自动创建 task。
- 如果需要先生成 planJson，Agent 可以写 plan file 后再运行 `task run`；planJson 仍必须包含 `coveredSpecs`。

## 受影响模块

- `src/cli/task.ts`: 新增 `task run` 命令。
- `src/core/task.ts` 或新增 `src/core/task-run.ts`: 合并 freeze/create/start 的 core helper。
- `src/cli/spec-handlers.ts`: 复用 L3 transition 规则，或抽取冻结 helper。
- `src/cli/__tests__/task.test.ts`: 覆盖 CLI 行为。
- `src/core/__tests__/task-run.test.ts`: 覆盖 core 状态机。
- README / agent templates / skill guidance: 更新推荐命令。

## L3 裂变计划

- L3.4.1: Task Run Core and CLI
- L3.4.2: Task Run Guidance and Compatibility

## 验收标准

1. **AC-1**: 用户 MUST 能用一条显式命令完成 L3 freeze、Task create 和 Task start。
2. **AC-2**: `spec confirm <L3>` MUST 保持只确认/冻结，不自动创建 Task。
3. **AC-3**: `task run` MUST 复用现有 L3 transition、planJson 校验、Task 创建和 start 规则，不绕过门禁。
4. **AC-4**: `task run` MUST 要求 `--plan`，且 planJson `coveredSpecs` 必须包含当前 L3。
5. **AC-5**: L3 已 frozen 时，`task run` MUST 能直接 create/start Task。
6. **AC-6**: L3 已有 active/draft task 时，`task run` MUST fail fast，并给出可执行恢复命令。
7. **AC-7**: `task run --json` MUST 输出单个对象，包含 spec transition、task、nextCommand。
8. **AC-8**: Agent guidance MUST 明确自然语言“确认并执行”映射到 `task run`，但普通 `spec confirm` 不自动执行。

## 风险

- 合并入口如果命名在 `spec confirm` 下，会让保守用户担心确认动作自动执行；因此首选 `task run`。
- 如果实现复制 `spec confirm` 逻辑，未来 L3 冻结规则会分叉；必须复用 handler/core。
- 如果自动复用已有 task，可能启动错任务；第一版 fail fast 更安全。
- 如果 Agent 把所有 L3 confirm 都改成 run，会违背用户只想确认规格的场景；guidance 必须区分语义。
