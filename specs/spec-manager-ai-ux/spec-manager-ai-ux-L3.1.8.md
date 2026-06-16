---
code: spec-manager-ai-ux-L3.1.8
level: L3
title: Chinese README v0.4.2 harness update
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: Chinese README v0.4.2 harness governance update
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Review readme_zh.md and English README v0.4.2 sections
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Add Chinese workflow overview and adaptive harness governance sections
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Verify git diff --check and record verification evidence
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      Verify git diff --check and commit Chinese README update without staging
      local personal settings
    status: pending
created: '2026-06-16T09:15:28.332Z'
updated: '2026-06-16T09:17:50.712Z'
changeSummary: 'cascade: task-complete'
---
# Chinese README v0.4.2 harness update — 实施规格

## 目标

同步更新 `readme_zh.md`，补齐英文 README 已新增的整体工作流介绍和 `v0.4.2` adaptive harness governance 说明。

本次只改中文 README，不改变 CLI 行为、包发布内容或 agent 模板。

## 实施步骤

### Step 1 — 上下文确认

- 读取 `readme_zh.md` 当前结构。
- 对照 `README.md` 已新增章节：
  - `How It Works`
  - `Adaptive Harness Governance`
- 确认中文 README 保持中文表达习惯，不做机械直译。

### Step 2 — 新增整体介绍

- 在“为什么用它”和“3 分钟开始”之间新增“它怎么工作”。
- 说明 spec-manager 将 PRD、设计、实现规格、任务历史、决策和验证证据保存在仓库中。
- 保持 `L1 PRD -> L2 Design -> L3 Impl -> Agent Task -> Verification` 链路清晰。

### Step 3 — 新增 adaptive harness 说明

- 新增“自适应 Harness 治理”章节。
- 说明 `v0.4.2` 的 Profile 快照、`standard` warning、`governed` critical AC evidence 要求。
- 列出相关只读预览/审计命令。
- 提供最小命令示例。

### Step 4 — 验证与提交

- 运行 `git diff --check`。
- 记录 task verification evidence。
- 提交 `readme_zh.md`、spec、task 和 audit 记录，不提交 `.claude/settings.local.json`。

## 验证命令

```bash
git diff --check
```

## planJson

```json
{
  "coveredSpecs": ["spec-manager-ai-ux-L3.1.8"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "Review readme_zh.md and English README v0.4.2 sections"
    },
    {
      "stepNo": 2,
      "stepType": "tool_action",
      "name": "Add Chinese workflow overview and adaptive harness governance sections"
    },
    {
      "stepNo": 3,
      "stepType": "tool_action",
      "name": "Verify git diff --check and record verification evidence"
    },
    {
      "stepNo": 4,
      "stepType": "tool_action",
      "name": "Commit Chinese README update without staging local personal settings"
    }
  ]
}
```

## 验收标准

- `readme_zh.md` 与英文 README 的新增内容信息等价。
- 中文文案自然，不机械直译。
- 3 分钟开始入口不被打断。
- `git diff --check` 通过。

## 回滚方案

如中文文案不合适，回滚本次文档提交或移除新增章节即可。
