---
code: harness-coding-L1
level: L1
title: Coding Harness 集成路线
topic: harness-coding
parentCode: null
status: implemented
aiSummary: >-
  将 spec-manager 定位为 coding harness 的任务控制层，规划 frozen L3 到 task
  context、执行回写、验证归档、变更闭环和多工具集成的长期路线
created: '2026-06-08T07:18:45.238Z'
updated: '2026-06-09T01:36:43.895Z'
changeSummary: 'cascade: project-reconcile'
---
# Coding Harness 集成路线

# Coding Harness 集成路线 — 需求文档

## 背景

spec-manager 当前已经能管理 L1 PRD、L2 Design、L3 Impl、Agent Task、decision 和本地审计数据。现有流程解决了“先规格、后实现”的治理问题，但与 Codex、OpenCode、CI sandbox、本地测试 harness 等 coding harness 的衔接仍主要依赖人工口头约定和聊天上下文。

长期看，spec-manager 应定位为 coding harness 的任务控制层：负责 intent、scope、决策、准入状态、执行轨迹和验证记录；coding harness 负责代码修改、测试执行、UI/API smoke、patch 生成和执行反馈。

当前存在四类摩擦：

1. **任务上下文不够 harness-ready**：L3 frozen 后，AI 仍需要多次读取 spec、decision、task、项目规则，才能拼出可执行任务包。
2. **执行轨迹依赖人工补记**：task step/complete 已存在，但 coding harness 没有稳定的上下文输入和回写约定，容易遗漏关键实现步骤、测试结果和风险。
3. **验证结果缺少结构化归档**：测试命令、exit code、artifact 路径、验收标准覆盖情况尚未形成统一数据模型。
4. **实现偏差缺少闭环**：coding harness 发现 L3 与代码现实冲突时，缺少明确的 change proposal 或 spec amendment 流程，容易直接即兴修改。

如果不做集成，spec-manager 会停留在“规格文档工具”；coding harness 的实际执行过程仍散落在对话、终端输出和未结构化 commit 说明中，长期追溯成本会继续上升。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 任务上下文 | frozen L3 到 Agent Task 的上下文包没有稳定命令和字段 | P1 | 当前常用命令只有 `spec show`、`decision list`、`task list`，需人工组合 |
| 执行回写 | task step/complete 缺少面向 coding harness 的约定格式 | P1 | Agent Task 记录能力存在，但没有 harness 集成契约 |
| 验证归档 | 测试命令、exit code、artifact、AC 覆盖未结构化 | P2 | complete 只能记录自然语言结果，无法可靠审计 |
| 变更闭环 | L3 实施中发现偏差时没有 proposal/amendment 流程 | P2 | 当前流程强调 frozen 后实现，但缺少 frozen 后偏差处理 |
| 多工具兼容 | Codex、OpenCode、CI、本地脚本需要同一上下文协议 | P3 | AGENTS.md 已覆盖工具入口，但未覆盖执行数据接口 |

## 用户故事

### Must have

- As a **coding agent**, I want **从 frozen L3 生成紧凑、完整、可执行的 task context**, so that **我可以直接进入代码阅读和实现而不重复猜测需求**
- As a **维护者**, I want **coding harness 的关键执行步骤自动或半自动写回 Agent Task**, so that **每次实现都有可追溯的执行记录**
- As a **coding agent**, I want **task context 包含验收标准、相关决策、禁止事项和建议验证命令**, so that **实现和验证能对齐 frozen L3**

### Should have

- As a **维护者**, I want **验证结果以结构化方式记录**, so that **我能审计某个任务是否真正跑过必要测试**
- As a **coding agent**, I want **发现 frozen L3 与代码现实冲突时有变更提交流程**, so that **我不需要在实现阶段私自扩大或改变范围**
- As a **CI harness**, I want **读取同一份 task context 并回写验证结果**, so that **本地 agent 与 CI 的执行记录一致**

### Could have

- As a **项目负责人**, I want **按 topic 汇总 spec、task、verification、change 的交付状态**, so that **长期路线图可以从本地数据生成**
- As a **coding agent**, I want **通过 JSON 输出消费 task context**, so that **不同 harness 可以稳定解析而不是依赖自然语言**

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| harness-ready task context | 需要 3+ 次 CLI/文件读取拼接上下文 | 新增单命令输出，包含目标、非目标、AC、决策、验证、下一步至少 6 类信息 |
| Agent Task 执行回写 | 依赖人工逐条 `task step` | 提供适合 harness 调用的 step/report 格式，完整实现流程 SHOULD 在 2-3 次调用内记录 |
| 验证结构化 | 测试结果多为自然语言 | 支持记录 command、exitCode、summary、artifacts、AC 覆盖 |
| frozen 后偏差处理 | 无明确命令/状态 | 支持 change proposal 或 amendment 入口，并能关联 task 与 L3 |
| 多工具兼容 | AGENTS.md 只有流程规则 | task context 输出 MUST 同时适合 Codex/OpenCode/CI 读取 |

## 验收标准

1. **AC-1**: **Given** 一个 `frozen` L3 spec, **When** 用户执行 task context 生成命令, **Then** 输出 **SHALL** 包含 spec 摘要、目标、非目标、验收标准、相关 decision、建议验证命令和下一步 task 操作。
2. **AC-2**: **Given** 一个未 frozen 的 L3 spec, **When** 用户尝试创建或导出 implementation task context, **Then** 系统 **MUST** 阻止进入实现态并提示先完成 L3 冻结。
3. **AC-3**: **Given** coding harness 完成若干实现步骤, **When** 它回写 task step/report, **Then** 系统 **SHALL** 保留 step 时间、摘要、可选文件列表、测试摘要和风险备注。
4. **AC-4**: **Given** coding harness 执行验证命令, **When** 它提交验证结果, **Then** 系统 **SHOULD** 记录 command、exitCode、summary 和 artifact 路径。
5. **AC-5**: **Given** 实施中发现 frozen L3 与代码现实冲突, **When** coding harness 提交 change proposal, **Then** 系统 **SHALL** 将 proposal 关联到 task 和 L3，并阻止无记录的范围扩大。
6. **AC-6**: **Given** Codex、OpenCode 或 CI 读取 task context, **When** 使用机器可读输出模式, **Then** 字段名和结构 **MUST** 稳定并有测试覆盖。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| frozen L3 到可执行上下文的读取次数 | 3+ | 1 | 记录一次 L3→Task 流程中的 CLI 调用数 |
| task 执行记录完整率 | 待测量 | ≥90% 任务包含 step、verification 或明确未验证原因 | 扫描 task 数据 |
| 验证结果结构化字段覆盖 | 0 | command/exitCode/summary/artifacts 至少 4 个字段 | 单元测试与 fixture |
| 实现偏差记录率 | 待测量 | 所有 L3 范围变化 MUST 有 change 记录 | audit 命令检查 |
| 多 harness 兼容 | 无协议 | 至少覆盖 Codex、OpenCode、CI 三类消费场景 | 文档示例与 smoke |

## 范围边界

- **做**:
  - frozen L3 到 harness-ready Agent Task context 的生成
  - 面向 coding harness 的 task step/report 回写约定
  - 验证结果结构化记录
  - frozen 后实现偏差的 change proposal/amendment 闭环
  - Codex/OpenCode/CI 可消费的文本与 JSON 输出
- **不做**(显式排除):
  - 不实现一个新的 coding agent
  - 不替代 Codex、OpenCode、CI 或测试框架
  - 不引入云端执行、远端队列、遥测或 SaaS 同步
  - 不要求项目必须采用特定语言、测试框架或 CI 平台
- **推迟**:
  - 图形化 dashboard
  - 多仓库 workspace 调度
  - 自动生成代码补丁
  - 基于 LLM 的验收标准自动判定

## 设计原则

1. **控制层原则** — spec-manager 只管理意图、范围、状态、记录和验证证据，不直接承担代码生成。违反判断: spec-manager 需要理解业务代码 AST 才能完成核心流程。
2. **本地优先原则** — 所有 task context、step、verification、change 数据 MUST 存在本地仓库。违反判断: 没有网络或远端服务时核心流程不可用。
3. **冻结准入原则** — implementation task context MUST 只从 frozen L3 生成。违反判断: draft L3 可直接进入实现态。
4. **机器可读原则** — 面向 harness 的输出 SHOULD 提供稳定 JSON，并保持人类可读文本。违反判断: harness 只能解析自然语言段落。
5. **最小协议原则** — 集成协议只定义必要字段，避免绑定具体 agent 或 CI 产品。违反判断: 字段命名或流程只适配某一个工具。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | frozen L3 -> Agent Task context 生成 | 现有 L3/task 流程 | P1 |
| Phase 2 | coding harness step/report 回写格式 | Phase 1 | P1 |
| Phase 3 | verification 结构化记录与审计 | Phase 2 | P2 |
| Phase 4 | frozen 后 change proposal/amendment 闭环 | Phase 2 | P2 |
| Phase 5 | Codex/OpenCode/CI 集成示例与 JSON schema 稳定化 | Phase 1-4 | P3 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| task context 命令与输出格式 | Phase 1 | 1 |
| task report/step 批量回写协议 | Phase 2 | 1 |
| verification 数据模型与 audit | Phase 3 | 1 |
| change proposal/amendment 流程 | Phase 4 | 1 |
| harness 集成文档与 JSON schema | Phase 5 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| task context 输出过长 | coding agent 仍需筛选大量文本 | L2 定义字段优先级和摘要长度 |
| JSON schema 过早固化 | 后续扩展困难 | Phase 1 先提供 experimental 字段，Phase 5 稳定 |
| 回写协议过重 | agent 执行成本上升 | 保持 summary 必填，其他字段可选 |
| 验证命令跨项目差异大 | 无法统一执行 | spec 只记录命令和结果，不内置语言框架假设 |
| frozen 后变更流程太繁琐 | agent 绕开流程直接改代码 | 提供轻量 proposal 命令和清晰下一步提示 |

## 关联

- 前序: `workflow-hardening-L1` 已实现多工具入口规则统一
- 前序: `spec-manager-ai-ux-L1` 已实现 AI 使用体验和 task batch 基础
- 关联: `roadmap-openspec-L1` 的 rich guide/project context 可作为 task context 的上游能力
