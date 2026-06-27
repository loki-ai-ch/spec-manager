---
code: spec-manager-ai-ux-L3.1.9
level: L3
title: Chinese-first README Onboarding Refresh
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: 实施规格：将主 README 调整为中文优先入口，链接英文文档，突出价值点并降低上手门槛。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey current README docs
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Rewrite Chinese-first README
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Create English README link target
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Review docs and run validation
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证后提交并推送 README 改造
    status: pending
relations:
  - type: based_on
    target: spec-manager-ai-ux-L2.1
created: '2026-06-27T13:28:53.394Z'
updated: '2026-06-27T13:35:11.466Z'
changeSummary: 'cascade: task-complete'
---
# Chinese-first README Onboarding Refresh — 实施规格

## 目标

重构项目中英文 README 的入口体验，让中文用户先看到清晰价值、快速安装和第一条命令，同时保留英文 README 作为显式链接。降低新用户理解 spec-manager 的门槛，并突出“规格驱动 AI 编程、项目记忆、验收证据、Design Context”的价值点。

## 范围

包含：

- 将仓库主 `README.md` 调整为中文优先入口。
- 在主 README 顶部显式链接英文文档 `readme_en.md`。
- 将现有英文 README 内容迁移到 `readme_en.md`，并同步关键新能力描述。
- 优化中文 README 的首屏、价值点、快速开始、常见场景和 Design Context 说明。
- 保留现有 CLI 命令、工作流规则和文档语义，不改运行时代码。

不包含：

- 修改 CLI 行为。
- 修改 npm package metadata。
- 改动 release/tag。
- 自动生成营销站点或长篇博客。

## 关键验收标准

- **AC-1**：`README.md` 首屏中文明确说明 spec-manager 是什么、解决什么痛点、适合谁。
- **AC-2**：`README.md` 顶部显式提供英文文档链接。
- **AC-3**：新用户能在 5 分钟内看到安装、初始化、创建第一条需求、执行任务的最短路径。
- **AC-4**：README 突出价值点：项目记忆、L1/L2/L3/Task、verification evidence、Design Context、纯本地 markdown/json。
- **AC-5**：英文 README 独立可读，保留主要安装、工作流、Design Context、命令说明。
- **AC-6**：提交前运行文档相关检查和基础验证，确保链接文件存在、命令示例不明显过期。

## 实施步骤

1. 阅读现有 `README.md`、`readme_zh.md`、`skill/SKILL.md`，确认已有文案和发布包文件约束。
2. 将当前英文 README 迁移为 `readme_en.md`，并保持英文文档可独立阅读。
3. 以当前中文 README 为基础重写 `README.md`，优化首屏结构、价值点和快速开始。
4. 同步中文 README 的 Design Context 路径说明，明确 `specs/DESIGN.md` 是 canonical 入口。
5. 检查 README 中的本地链接、命令示例和 npm 包文件引用。
6. 运行 `npm run lint`、`npm run build`，必要时运行相关测试。
7. 提交并推送到 GitHub。

## 验证命令

```bash
npm run lint
npm run build
```

## 回滚策略

如文档结构不符合预期，可回滚本次 README/readme_en 文档变更与对应 spec/task 记录；不涉及运行时代码和数据迁移。
