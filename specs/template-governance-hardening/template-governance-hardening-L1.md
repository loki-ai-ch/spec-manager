---
code: template-governance-hardening-L1
level: L1
title: Template Governance and Agent Guidance Parity
topic: template-governance-hardening
parentCode: null
status: implemented
aiSummary: >-
  定义模板治理与 Agent guidance parity 加固需求，覆盖 DESIGN.md、task run、docs check、delivery
  guidance 与 L1/L2/L3 模板边界问题。
created: '2026-07-15T08:20:43.360Z'
updated: '2026-07-15T09:03:06.616Z'
changeSummary: 'cascade: task-complete'
---
# Template Governance and Agent Guidance Parity — 需求文档

## 背景

spec-manager 已经陆续加入多项降低上手门槛和提升 Agent 执行质量的能力：`spec-manager <platform> install`、`spec-manager task run`、`spec-manager brief`、`spec-manager assist delivery`、`specs/DESIGN.md` 默认设计上下文、`project docs check`。但模板体系仍存在多个重复入口和局部滞后：

- 2026-07-15 的模板走读发现 `skill/SKILL.md` 已包含完整 DESIGN.md、delivery、docs check 指南，而 `templates/agents/AGENTS.md`、`CLAUDE.md`、`CURSOR.md`、`WINDSURF.md` 主要只投射核心流程规则，设计上下文提醒不完整。
- `project docs check` 当前只检查 `skill/SKILL.md` 和 `templates/agents/*/SKILL.md` 中的少量关键词，顶层 Agent capsule 可漂移而不被报告。
- L1/L2/L3 模板仍有若干历史痕迹：L1 写着确认 Q1-Q3 但未定义；L2 同时禁止具体文件路径又要求复用清单写路径；L3 示例偏 Java/JAR/curl，容易带偏 npm/CLI/前端项目。
- 本仓库本地生成的 `.agents/skills/spec-manager/templates/agents/*` 与发布源 `templates/agents/*` 已出现差异，说明模板源、安装目标和自举环境之间缺少稳定 parity 检查。

如果不处理，用户在不同 Agent 平台看到的规则会不一致，设计能力和快捷执行能力不一定被显式触发，后续每次新增工作流能力都可能继续扩大模板漂移面。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| Agent guidance parity | 发布模板、native skill、自举 `.agents` 入口对 DESIGN.md、docs check、delivery 指南覆盖不一致 | P1 | 2026-07-15 模板走读 diff |
| Template boundary clarity | L1/L2/L3 模板部分约束互相拉扯或示例偏具体技术栈 | P1 | `templates/L1-prd.md`、`templates/L2-design.md`、`templates/L3-impl.md` |
| Consistency automation gap | docs check 没覆盖顶层 Agent capsule 和模板漂移关键短语 | P1 | `src/core/docs-consistency.ts` |
| Maintenance cost | 多个 Agent 模板重复维护，新增能力需人工同步多处 | P2 | `templates/agents/*`、`skill/SKILL.md` |

## 用户故事

### Must have

- As a spec-manager 用户, I want 每个 Agent 平台安装后的入口都明确提醒正确的 spec-manager 工作流和 DESIGN.md 能力, so that 我不用猜某个平台是否支持同一套流程。
- As an AI agent, I want L1/L2/L3 模板边界清晰且技术栈中立, so that 我能生成更少歧义、更少返工的规格。
- As a maintainer, I want `project docs check` 能发现 Agent 模板关键能力漂移, so that 发布前能阻止 guidance 滞后。
- As a release owner, I want 模板源和安装资产有可测试的 parity, so that npm 包发布后不会把旧指令交给用户。

### Should have

- As a maintainer, I want Agent capsule 的重复规则集中化或至少有机器校验, so that 新增能力时不需要靠记忆同步多处。
- As a UI/design task user, I want 所有 Agent 入口都显式指向 `specs/DESIGN.md` 和 legacy fallback, so that 设计上下文不会被遗漏。

### Could have

- As a maintainer, I want 后续可生成 Agent capsule, so that 模板维护从复制粘贴转向单源渲染。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| Agent guidance parity | 至少 5 个顶层 Agent capsule 未被 docs check 的 guidanceFindings 扫描 | 所有发布入口模板都被 docs check 或专门测试覆盖关键能力短语 |
| Design guidance 覆盖 | 仅 `skill/SKILL.md` 和 CodeBuddy skill 明确包含完整 `specs/DESIGN.md` 规则 | 所有 Agent 安装入口包含设计上下文使用规则或引用统一规则段 |
| 模板边界清晰度 | L1 有未定义 Q1-Q3；L2 路径约束冲突；L3 示例偏 Java/JAR | L1/L2/L3 模板消除已识别歧义，示例语言无关 |
| 漂移检测 | `.agents` 本地生成资产差异只能人工 diff 发现 | 发布检查或测试能捕捉关键指导漂移 |

## 验收标准

1. **AC-1**: **Given** 用户运行 `spec-manager <platform> install`, **When** 安装任一发布支持的 Agent 入口, **Then** 入口说明 **SHALL** 包含 L1->L2->L3->Task、`task run`、writeRoot、docs check、delivery/acceptance、`specs/DESIGN.md` 的一致指导或等价引用。
2. **AC-2**: **Given** 维护者运行 `spec-manager project docs check`, **When** 顶层 Agent capsule 缺少关键 workflow/design guidance, **Then** docs check **SHALL** 输出 warning。
3. **AC-3**: **Given** 维护者查看 L1/L2/L3 模板, **When** 按模板撰写新 spec, **Then** 模板 **SHALL** 不包含未定义问题、互相冲突的层级边界或特定语言/后端部署偏置示例。
4. **AC-4**: **Given** npm 发布前运行测试, **When** Agent guidance、skill guidance 或 template guidance 发生关键能力漂移, **Then** 测试 **SHALL** 失败并指出缺失能力。
5. **AC-5**: **Given** 项目存在本地生成 `.agents/` 资产, **When** docs check 或模板 parity 检查运行, **Then** 系统 **SHOULD** 将其作为本地生成资产提示，不要求发布包包含该目录。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 顶层 Agent capsule guidance 覆盖 | 待测量；当前 docs check 未扫描顶层 capsule | 100% 发布入口模板覆盖关键短语 | 单元测试 + docs check fixture |
| 模板已知歧义数量 | 3 类已知歧义 | 0 个已知歧义残留 | 模板文本测试和人工走读 |
| 相关测试覆盖 | 当前 56 个 docs/agent 相关测试通过，但覆盖不足 | 新增覆盖后相关测试继续通过 | `npm test -- docs-guidance docs-consistency agents project-agents` |
| 发布前检查 | `project docs check` 只覆盖部分 guidance | docs check 可发现 capsule guidance 缺失 | CLI/Core 测试 |

## 范围边界

- **做**:
  - 优化 L1/L2/L3/agent-plan/Agent capsule 模板内容。
  - 扩展 docs consistency 检查范围，覆盖顶层 Agent capsule guidance。
  - 补充模板/Agent guidance parity 测试。
  - 同步 README/skill 中必要的模板治理说明。
- **不做**:
  - 不改变 spec/task 生命周期状态机。
  - 不移除现有 `project agents --provider` 兼容入口。
  - 不把 `.agents/` 生成资产纳入 npm 发布源。
  - 不引入网络依赖或外部模板服务。
- **推迟**:
  - 自动生成所有 Agent capsule 的模板渲染器。
  - topic-scoped DESIGN.md 自动发现。
  - 更复杂的 markdown AST 级模板 lint。

## 设计原则

1. **能力先投射到 Agent 入口** — 新工作流能力只有被 Agent 入口稳定提醒，才算真正降低上手成本。违反判断: README 有能力说明但安装后的 Agent 入口没有等价指导。
2. **模板示例保持技术栈中立** — 默认模板不应暗示 Java、后端 JAR 或 curl 是唯一实现形态。违反判断: 通用模板里的示例只能自然适配单一技术栈。
3. **检查只读、发布前可执行** — docs/template consistency 默认只报告不改文件。违反判断: 检查命令隐式重写用户文档或生成资产。
4. **生成资产不是发布源** — `.agents/` 等安装输出作为本地消费结果，不作为 npm 包维护源。违反判断: 发布包或核心模板以 `.agents/` 为 source of truth。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | 模板内容边界和 Agent guidance parity 加固 | 本 L1 confirmed | P1 |
| Phase 2 | docs consistency / tests 覆盖顶层 capsule 漂移 | Phase 1 设计明确 | P1 |
| Phase 3 | 可选模板单源渲染探索 | Phase 1/2 稳定 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Agent guidance parity 与模板内容修订 | Phase 1 | 1 |
| Docs consistency 检查扩展与测试 | Phase 2 | 1 |
| 模板单源化可行性 | Phase 3 | 0-1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| Agent 入口过长导致模型忽略重点 | 规则更多但执行更差 | 用短规则 + Common Commands，详细内容留在 skill |
| 过严 docs check 阻塞正常发布 | 发布摩擦上升 | 初期使用 warning，只有核心文件缺失才 error |
| 同步 `.agents` 本地资产误导为发布源 | 可能误提交生成目录 | 保持 docs check info 提醒，不纳入 package files |
| 模板改动影响大量既有测试 | 回归成本增加 | 先补 targeted tests，再跑全量 test/lint/build |

## 关联

- references: workflow-usability-hardening-L2.2 — docs consistency 现有设计。
- references: design-context-L2.6 — `specs/DESIGN.md` 默认路径。
- references: agent-install-surface-L2.1 — 平台安装入口和 fallback 说明。
