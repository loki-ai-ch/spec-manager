---
code: spec-manager-ai-ux-L3.1.6
level: L3
title: README onboarding simplification
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: 简化 README 新手入口，把长篇规则和完整教程后移，首屏聚焦 3 步试用、AI agent 接入和进阶链接，降低首次尝试心理成本。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: 读取 README/readme_zh、spec-manager-ai-ux-L2.1 和现有命令入口'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 README.md 简化首屏、Quick Start 和 AI agent 接入
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 readme_zh.md 同步中文新手路径
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 收纳复杂教程和命令参考，避免首屏过载
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 验证 targeted tests、npm run build 和 git diff --check
    status: pending
created: '2026-06-12T10:29:25.686Z'
updated: '2026-06-12T10:36:42.724Z'
changeSummary: 'cascade: task-complete'
---
# README onboarding simplification — 实施规格

## 目标

实施 `spec-manager-ai-ux-L2.1` 的增量交付：把中英文 README 从“完整手册优先”改成“3 分钟可试优先”，让新用户看到第一屏就知道怎么开始。

**前置依赖**: `spec-manager-ai-ux-L3.1.1-readme` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 读取 `README.md`、`readme_zh.md` 当前结构和长度。
- 读取 `spec-manager-ai-ux-L2.1` 和本 L3。
- 确认现有功能命令：`project init`、`project agents`、`guide`、`new feature`、`flow status`、`template`。

### Step 2 — 重写 README 首屏和 Quick Start

- 在 `README.md` 顶部保留一句定位和 3 个核心收益。
- 将 “What it does” 的长功能清单压缩为 “Why use it”。
- 将 Quick Start 改为 3 步：
  1. install / npx
  2. init + agent setup
  3. ask AI 或 `guide/new feature`
- 首屏 SHOULD 明确：不用先理解完整方法论也可以开始。

### Step 3 — 重写中文 README 首屏和 Quick Start

- `readme_zh.md` 与英文结构一致。
- 中文文案 SHOULD 直接回应用户担忧：“不用一上来就理解完整流程”。
- 保留 MiMo-Code 兼容入口，但从复杂 provider 表格中降噪。

### Step 4 — 收纳复杂内容

- 将完整命令表、端到端教程、规则细节保留在 README 后半部分或链接到 `docs/methodology.md`。
- 不删除高级用户需要的命令参考，但 SHALL 避免在首屏展示大量命令。
- 如有重复的 “AI Agent Setup” / “Quick start” / “Tutorial” 内容，SHOULD 合并或显著缩短。

### Step 5 — 验证

- 运行 `npm test -- src/cli/__tests__/project-agents.test.ts src/core/__tests__/agents.test.ts` 确认 README 相关 provider 行为未被误改。
- 运行 `npm run build`。
- 运行 `git diff --check`。

## 验证命令

```bash
# 正向验证: provider 相关行为不回退
npm test -- src/cli/__tests__/project-agents.test.ts src/core/__tests__/agents.test.ts
# 预期输出包含: Test Files  2 passed

# 正向验证: build
npm run build
# 预期退出码: 0

# 文档格式检查
git diff --check
# 预期无输出
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["spec-manager-ai-ux-L3.1.6"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "mcp_tool",
      "name": "上下文收集: 读取 README/readme_zh、spec-manager-ai-ux-L2.1 和现有命令入口"
    },
    {
      "stepNo": 2,
      "stepType": "mcp_tool",
      "name": "编辑 README.md 简化首屏、Quick Start 和 AI agent 接入"
    },
    {
      "stepNo": 3,
      "stepType": "mcp_tool",
      "name": "编辑 readme_zh.md 同步中文新手路径"
    },
    {
      "stepNo": 4,
      "stepType": "mcp_tool",
      "name": "收纳复杂教程和命令参考，避免首屏过载"
    },
    {
      "stepNo": 5,
      "stepType": "mcp_tool",
      "name": "验证 targeted tests、npm run build 和 git diff --check"
    }
  ]
}
```

autoConfirm: false。理由: README 是项目入口文案，改动会影响新用户认知，需要显式批准后实施。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| README 简化后信息缺失 | `git revert <commit>` 或恢复 README/readme_zh.md 对应段落 | < 5 min |
| 新手路径描述与 CLI 不一致 | 修正文档命令并补跑验证 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 过度简化导致高级用户找不到完整流程 | 在首屏给 “Full workflow / Methodology” 链接，后半保留命令参考 |
| 中英文 README 漂移 | 两份 README 使用同构章节和相同命令示例 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-manager-ai-ux-L2.1 | spec-manager-ai-ux-L2.1 |
