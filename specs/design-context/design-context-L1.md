---
code: design-context-L1
level: L1
title: DESIGN.md 设计上下文融合
topic: design-context
parentCode: null
status: implemented
aiSummary: >-
  将 DESIGN.md 重写为 spec-manager 原生设计上下文能力，覆盖 UI 风格漂移与 task evidence
  验收缺口，第一版聚焦读取、lint、brief 注入和 verification/evidence 接入。
created: '2026-06-26T02:29:28.665Z'
updated: '2026-06-26T02:47:53.969Z'
changeSummary: 'cascade: task-complete'
---
# DESIGN.md 设计上下文融合 — 需求文档

## 背景

spec-manager 已经能把 PRD、技术设计、实施规格、Agent Task 和验收证据纳入本地闭环，但对前端视觉类任务仍缺少稳定的项目级设计事实源。当前 AI agent 在处理 UI 需求时主要依赖一次性 prompt、历史 spec 摘要和通用前端经验，容易在跨任务、跨 agent 或长周期迭代中出现视觉风格漂移；同时视觉约束没有进入 task evidence，导致“代码通过测试但不符合设计系统”的问题难以在完成门禁前被结构化发现。

`/Users/loki/code/github/design.md` 提供了一个可读、可解析、可 lint 的 DESIGN.md 格式：用 Markdown prose 表达设计意图，用 YAML tokens 表达颜色、字体、间距、圆角和组件 token，并能输出结构化 findings。将它重写为 spec-manager 原生能力后，spec-manager 可以在不依赖外部服务的前提下，把设计上下文纳入 Agent Brief 和 Task 验收证据。

量化证据：当前 spec-manager 仓库已有 130 个 implemented specs，已有 `assist brief`、`task evidence`、`@verify`、`acceptance report` 等闭环能力，但 `rg -n "DESIGN|Tailwind|visual" src specs README.md readme_zh.md skill templates rules` 未发现面向 DESIGN.md 或视觉上下文的原生能力；因此视觉约束覆盖率基线为 0 个原生命令、0 个 brief 设计上下文来源、0 条 design lint 证据类型。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 上下文缺失 | UI 任务没有项目级设计事实源注入 Agent Brief，agent 只能依赖临时 prompt 和历史摘要。 | P1 | 代码调查：`capability-brief` 只聚合 specs/decisions/tasks/lessons |
| 验收缺口 | Task 完成证据无法表达 DESIGN.md lint 或设计 token 回归，视觉偏差不会进入 acceptance report。 | P1 | 代码调查：`task-evidence` 聚焦 critical AC 与 verification 记录 |
| 工具割裂 | 外部 `design.md` 项目有 lint/diff/export 能力，但与 spec-manager 状态机、任务、证据模型没有统一入口。 | P2 | `/Users/loki/code/github/design.md` 项目调查 |
| 命名混淆 | DESIGN.md 格式与 spec-manager 的 L2 Design 概念同名，若直接暴露容易造成用户理解成本。 | P2 | spec-manager 现有 L2 Design 工作流 |

## 用户故事

### Must have

- As an AI coding agent, I want spec-manager to detect and summarize project DESIGN.md context in Agent Brief, so that UI work starts from approved design intent instead of a vague prompt.
- As a project maintainer, I want DESIGN.md lint findings to be available as structured task verification evidence, so that visual-system violations can block or warn before task completion.
- As a frontend implementer, I want the first version to reuse spec-manager commands and local files, so that I do not need to install or run a separate design.md CLI during normal spec-manager workflow.
- As a spec reviewer, I want the integration scope to be explicit, so that DESIGN.md support does not silently expand into automatic UI rewriting or broad design generation.

### Should have

- As an agent, I want brief output to include design prose and token summaries separately, so that exact values and design rationale are both available.
- As a maintainer, I want design lint results to be serializable as JSON, so that task evidence and acceptance reports can reference the same facts.
- As a user, I want the feature name to avoid confusion with L2 Design, so that I can distinguish design context from technical design specs.

### Could have

- As a frontend implementer, I could export DESIGN.md tokens to Tailwind or DTCG formats from spec-manager, so that implementation tooling can consume the same source.
- As a reviewer, I could compare two DESIGN.md files for token regressions, so that visual-system changes have reviewable diffs.

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| DESIGN.md 原生读取 | 0 个 spec-manager 原生命令读取 DESIGN.md | 至少 1 个原生命令或 assist 能力能读取 DESIGN.md 并输出结构化摘要 |
| Brief 设计上下文注入 | `assist brief` 输出 0 个设计上下文来源 | 当项目存在 DESIGN.md 且请求涉及 UI/视觉时，brief 输出 1 组设计上下文摘要和 sourceRef |
| 设计 lint 证据 | Task verification 中没有 DESIGN.md lint 证据类型 | Task 能记录至少 1 条 DESIGN.md lint verification，并进入 evidence/acceptance 汇总 |
| 外部项目融合 | 外部 design.md 能力与 spec-manager 状态机无绑定 | 第一版核心能力在 spec-manager 内部可用，不要求用户直接调用外部 CLI |

## 验收标准

1. **AC-1**: **Given** 项目根目录存在有效 DESIGN.md，**When** 用户请求 UI/视觉相关工作并生成 Agent Brief，**Then** brief **SHALL** 包含 DESIGN.md 的设计意图摘要、关键 token 摘要和 source reference。
2. **AC-2**: **Given** DESIGN.md 存在结构错误或 lint finding，**When** 用户运行设计上下文校验能力，**Then** 系统 **SHALL** 返回结构化 findings 和 error/warning/info 计数。
3. **AC-3**: **Given** L3/Task 声明需要 DESIGN.md 校验，**When** Task 记录 verification，**Then** task evidence **SHALL** 能展示该 verification 覆盖的 AC、退出结果和相关 artifact。
4. **AC-4**: **Given** 第一版能力交付，**When** 用户只使用 spec-manager 日常命令，**Then** 系统 **MUST** 不要求用户手动运行外部 `design.md` CLI 才能获得 brief 注入或 task evidence。
5. **AC-5**: **Given** 用户请求自动改 UI 或自动生成完整设计系统，**When** 使用本功能第一版，**Then** 系统 **SHOULD** 明确该能力不在当前范围内，并引导进入后续 spec。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| brief 设计上下文覆盖 | 0 | UI/视觉请求下存在 DESIGN.md 时覆盖率 100% | 单元测试与 CLI fixture |
| design lint 结构化输出 | 0 | 至少覆盖 valid、missing YAML、broken ref、contrast finding 四类场景 | 单元测试 |
| task evidence 接入 | 0 | 至少 1 个测试证明 DESIGN.md lint verification 可被 evidence/acceptance 读取 | 单元测试 |
| 外部 CLI 依赖 | 待测量 | 第一版主路径不依赖用户安装外部 design.md CLI | package/test 检查 |

## 范围边界

- **做**:
  - 将 DESIGN.md 的核心解析、lint 和摘要能力重写为 spec-manager 原生设计上下文能力。
  - 在 Agent Brief 中按请求意图注入 DESIGN.md 设计摘要和 source reference。
  - 将 DESIGN.md lint 结果作为 Task verification/evidence 可记录、可展示的事实。
  - 保持本地文件、结构化 JSON、无网络依赖的 spec-manager 风格。
- **不做**(显式排除,至少 2 条):
  - 不做自动修改 UI 代码、自动生成页面或自动套用设计系统。
  - 不做 Figma、浏览器截图、视觉回归图片比对等外部工具集成。
  - 不直接把外部 `design.md` CLI 作为 spec-manager 子进程硬依赖。
  - 不改变 L1/L2/L3/Task 的状态机和审批规则。
- **推迟**(后续版本考虑):
  - DESIGN.md diff 回归门禁。
  - Tailwind v3/v4、DTCG tokens export。
  - DESIGN.md 初始化模板和交互式修复建议。

## 设计原则

1. **原生融合优先** — 第一版应表现为 spec-manager 的本地能力，而不是外部 CLI 包装器。违反判断: 主路径要求用户安装或直接调用外部 `design.md` CLI。
2. **上下文和证据分层** — brief 负责给 agent 读设计意图，task evidence 负责记录可验证事实。违反判断: brief 输出混入完成门禁判断，或 evidence 只存自然语言摘要。
3. **不混淆 L2 Design** — 用户界面和命令命名应使用 design-context/visual-context 等语义。违反判断: 命令或文档让用户难以区分 DESIGN.md 与 L2 技术设计。
4. **渐进式交付** — 先交付读取、lint、brief、evidence，再考虑 export/diff/fix。违反判断: 第一版必须同时完成 token export、自动修复或 UI 生成才可用。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | DESIGN.md 原生解析、lint、结构化摘要 | L1/L2/L3 审核完成 | P1 |
| Phase 2 | Agent Brief 设计上下文注入 | Phase 1 完成 | P1 |
| Phase 3 | Task verification/evidence 接入 | Phase 1 完成 | P1 |
| Phase 4 | diff/export/模板等增强能力评估 | Phase 1-3 完成 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| 设计上下文核心模型与 lint report | Phase 1 | 1 |
| Assist Brief 注入与 source reference | Phase 2 | 1 |
| Task verification/evidence 集成 | Phase 3 | 1 |
| 后续 export/diff 路线评估 | Phase 4 | 0-1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 外部 DESIGN.md 代码许可证和实现风格不同 | 直接复制可能引入维护和合规成本 | L2 明确重写边界，保留必要 attribution，不直接嵌入外部 CLI |
| DESIGN.md 格式仍处 alpha | 过早固化全部 schema 可能造成后续迁移 | 第一版只固化 spec-manager 所需最小子集，并保留 unknown key warning 策略 |
| UI 意图识别不准确 | brief 可能在非 UI 请求中输出噪音，或 UI 请求漏注入 | L2 设计显式定义触发条件和手动 override |
| 验收门禁过重 | 设计 lint warning 可能阻塞非关键任务 | 默认记录 evidence，是否阻塞由 L3 critical AC/profile 决定 |

## 关联

- 外部参考项目：`/Users/loki/code/github/design.md`
- 现有能力参考：`ai-capability-compensation-L2.1`、`harness-coding-L2.1`、`constraint-closed-loop-L2.1`
