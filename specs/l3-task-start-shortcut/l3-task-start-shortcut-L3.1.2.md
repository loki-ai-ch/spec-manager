---
code: l3-task-start-shortcut-L3.1.2
level: L3
title: Shortcut Guidance Sync
topic: l3-task-start-shortcut
parentCode: l3-task-start-shortcut-L2.1
status: implemented
aiSummary: >-
  同步 README、skill/SKILL.md、subskill 与 agent templates 的 task run/task create
  --start 指导，并用 docs-guidance.test.ts 锁定 confirm-only 与兼容路径语义。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取本 L3、l3-task-start-shortcut-L2.1、l3-task-start-shortcut-L3.1.1、历史
      Task、agent-plan 模板及现有指导文件
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 README.md 与 readme_en.md 增加 task create --start 主路径说明
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 skill/SKILL.md 与 skill/subskills/impl.md 同步快捷入口规则
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 templates/agents 与 .agents/skills/spec-manager 同步 agent guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: >-
      编辑 src/core/__tests__/docs-guidance.test.ts 断言 run、create --start 与
      confirm-only 语义
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      验证: npm test -- src/core/__tests__/docs-guidance.test.ts && npm test &&
      npm run lint && npm run build
    status: pending
relations:
  - type: based_on
    target: l3-task-start-shortcut-L2.1
  - type: references
    target: l3-task-start-shortcut-L3.1.1
  - type: references
    target: l3-task-start-shortcut-L3.1.1
created: '2026-07-15T09:37:03.952Z'
updated: '2026-07-15T10:07:25.849Z'
changeSummary: 'cascade: task-complete'
---
# Shortcut Guidance Sync - 实施规格

## 目标

实施 `l3-task-start-shortcut-L2.1` 的 L3 裂变项 2：统一 README、skill 与 agent 模板的 Task 快捷入口指导，明确 draft L3 使用 `task run`、frozen L3 可使用 `task create --start`，并保留分步命令兼容说明。

**前置依赖**：`l3-task-start-shortcut-L3.1.1` 已 implemented

## 实施步骤

### Step 1 - 上下文收集

- SHALL 读取本 L3、`l3-task-start-shortcut-L2.1`、`l3-task-start-shortcut-L3.1.1`、同 topic 历史 Task和 `templates/agent-plan.json`。
- SHALL 复核 README、`skill/SKILL.md`、`templates/agents/*`、`.agents/skills/spec-manager/*` 及 `src/core/__tests__/docs-guidance.test.ts` 中现有 task run/create/start 指导。

### Step 2 - 更新中英文 README

- SHALL 更新 `README.md` 与 `readme_en.md`，把 `task run` 作为 draft L3 的 confirm/create/start 主入口。
- SHALL 增加 frozen L3 的 `task create --start` 示例，并将 create + start 两步标注为兼容或高级路径。

### Step 3 - 更新发布 skill 指导

- SHALL 更新 `skill/SKILL.md`，明确仅确认 L3 时仍只执行 `spec confirm`；确认并执行时使用 `task run`；已 frozen 且创建并执行时使用 `task create --start`。
- SHALL 同步 `skill/subskills/impl.md` 中 Task 执行步骤，避免继续把 create 后手动 start 作为唯一主路径。

### Step 4 - 更新 agent 模板与仓库内 workflow capsule

- SHALL 同步 `templates/agents/` 下 AGENTS、CLAUDE、CODEBUDDY、CURSOR、WINDSURF 与 codebuddy skill 模板。
- SHALL 同步 `.agents/skills/spec-manager/` 中对应指导与模板副本，保证开发入口和发布资产一致。

### Step 5 - 强化 guidance 测试

- SHALL 更新 `src/core/__tests__/docs-guidance.test.ts`，断言核心文档同时包含 `task run`、`task create --start` 与 confirm-only 不自动建 Task 的语义。
- SHOULD 使用集中式文档文件列表，避免重复断言散落。

### Step 6 - 验证

- SHALL 运行 docs-guidance 目标测试、全量测试、lint 和 build，并确认 exit code 均为 0。

## 验收标准

- AC-1: 中英文 README 清楚区分 draft L3、frozen L3 和仅确认三种路径。
- AC-2: 发布 skill 与所有 agent 模板包含 `task create <L3-code> --plan <planFile> --start` 指导。
- AC-3: 分步 create/start 命令仍被描述为兼容路径，不造成行为移除误解。
- AC-4: docs-guidance 自动化测试能检测上述命令或语义缺失。

## 关键验收标准

- AC-1
- AC-2

## 验证命令

```bash
# 正向验证：指导一致性
npm test -- src/core/__tests__/docs-guidance.test.ts
# 预期：docs-guidance tests 全部通过，exit code 0

# 全量回归
npm test
npm run lint
npm run build
# 预期：所有命令 exit code 0
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
  "coveredSpecs": ["l3-task-start-shortcut-L3.1.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取本 L3、l3-task-start-shortcut-L2.1、l3-task-start-shortcut-L3.1.1、历史 Task、agent-plan 模板及现有指导文件"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 README.md 与 readme_en.md 增加 task create --start 主路径说明"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 skill/SKILL.md 与 skill/subskills/impl.md 同步快捷入口规则"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 templates/agents 与 .agents/skills/spec-manager 同步 agent guidance"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/__tests__/docs-guidance.test.ts 断言 run、create --start 与 confirm-only 语义"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: npm test -- src/core/__tests__/docs-guidance.test.ts && npm test && npm run lint && npm run build"}
  ]
}
```

`autoConfirm: false`，本计划不包含 human_gate，保持显式步骤上报。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 指导语义错误 | 回退 README、skill、agent templates 与 guidance test 的本次变更 | < 5 min |
| 发布资产与开发副本不一致 | 以 `skill/` 和 `templates/agents/` 为发布源重新同步 `.agents/skills/spec-manager/` 副本并复跑测试 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 多份 agent 模板漏改 | 由 docs-guidance 测试遍历集中式文件列表 |
| 用户误以为 create/start 被移除 | 文档保留明确的兼容路径说明 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | l3-task-start-shortcut-L2.1 | 实现 L2 裂变项 2 |
| references | l3-task-start-shortcut-L3.1.1 | 前序依赖：CLI 参数已实现 |
| references | workflow-surface-simplification-L3.4.2 | 延续既有 shortcut guidance |
