---
code: spec-manager-ai-ux-L3.1.7
level: L3
title: README v0.4.2 harness update
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: README v0.4.2 harness governance update
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: Review README structure and release context for v0.4.2
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: >-
      Update README with a concise overview and adaptive harness governance
      section
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: Run documentation format checks and relevant validation
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: >-
      Verify git diff --check and commit README update without staging local
      personal settings
    status: pending
created: '2026-06-16T09:09:14.301Z'
updated: '2026-06-16T09:12:56.926Z'
changeSummary: 'cascade: task-complete'
---
# README v0.4.2 harness update — 实施规格

## 目标

更新 `README.md`，让新用户先理解 spec-manager 的整体定位，再理解 `v0.4.2` 针对 adaptive harness、Profile、critical AC readiness 和验收证据治理的新增能力。

本次只改英文 README，不改变 CLI 行为、包发布内容或 agent 模板。

## 实施步骤

### Step 1 — 上下文确认

- 读取 `README.md` 当前结构。
- 参考 `v0.4.2` release 内容和已实现命令：
  - `spec-manager project profile recommend`
  - `spec-manager project profile metrics`
  - `spec-manager project workflow preview`
  - `spec-manager project readiness critical`
- 确认 README 仍保持新手优先，不把首屏变成完整方法论文档。

### Step 2 — 新增整体介绍

- 在 “Why Use It” 或相邻位置补充一句清晰定位：spec-manager 将 PRD、设计、实现计划、任务、决策和验证记录保存在仓库中。
- 保持现有 3-Minute Start 不被打断。
- 避免营销化长文，使用 README 风格的简洁说明。

### Step 3 — 新增 adaptive harness 说明

- 新增一个短章节说明 `v0.4.2` 的 adaptive harness governance：
  - Task 创建时记录 Profile 快照。
  - `standard` 模式报告 warning。
  - `governed` 模式要求 critical AC 及其验证证据覆盖。
  - readiness/reporting 命令用于预览和审计，不作为隐藏 gate。
- 提供最小命令示例。

### Step 4 — 验证与提交

- 运行 `git diff --check`。
- 如 README 仅文档变更，不强制运行全量测试。
- 提交 README 和 spec/task 记录，不提交 `.claude/settings.local.json`。

## 验证命令

```bash
git diff --check
```

## planJson

```json
{
  "coveredSpecs": ["spec-manager-ai-ux-L3.1.7"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "mcp_tool",
      "name": "Review README and v0.4.2 release context"
    },
    {
      "stepNo": 2,
      "stepType": "mcp_tool",
      "name": "Add concise project overview and adaptive harness governance README section"
    },
    {
      "stepNo": 3,
      "stepType": "mcp_tool",
      "name": "Run git diff --check"
    },
    {
      "stepNo": 4,
      "stepType": "mcp_tool",
      "name": "Commit README and spec-manager records"
    }
  ]
}
```

## 验收标准

- README 首屏定位仍简洁，不影响 3-Minute Start。
- README 包含本次 harness / critical AC readiness 更新的可读说明。
- README 包含相关命令入口。
- `git diff --check` 通过。

## 回滚方案

如 README 文案不合适，回滚本次文档提交或移除新增章节即可。
