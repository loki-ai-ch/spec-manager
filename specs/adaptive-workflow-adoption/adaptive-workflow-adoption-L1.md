---
code: adaptive-workflow-adoption-L1
level: L1
title: Adaptive Workflow 采用预检与迁移安全
topic: adaptive-workflow-adoption
parentCode: null
status: implemented
aiSummary: >-
  定义 adaptive workflow 从 legacy compatibility 进入显式采用的预检路径：adoption
  preview、governed readiness、legacy 历史解释、workflow enable/disable 反馈增强和 Agent
  入口提示。
created: '2026-06-16T07:09:06.979Z'
updated: '2026-06-16T07:24:04.828Z'
changeSummary: 'cascade: task-complete'
---
# Adaptive Workflow 采用预检与迁移安全

## 背景

`adaptive-evidence-workflow` 已实现 adaptive workflow 配置、Task Profile 快照、关键 AC evidence gate 和 `task evidence`。`adaptive-profile-intelligence` 已实现 Profile 推荐与 `project profile metrics` 治理报告。

当前项目自身的 metrics 显示：

- adaptive workflow 仍为 disabled，处于 legacy compatibility。
- 现有 65 个 Task 全部归入 legacy。
- standard/governed 采用、coverage warning 和 override 审计都还没有真实执行数据。

这说明能力已经具备，但采用路径仍缺少安全预检。直接启用 adaptive workflow 会改变后续 Task 的 profile 语义；虽然不会改写历史 Task，但用户需要先知道默认 Profile、关键 AC 覆盖要求、已有规格质量和 Agent 入口是否准备好。

本 L1 的目标是把 adaptive workflow 从“可手动启用”推进到“可预检、可解释、可回滚地采用”。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 采用风险不可见 | 启用前缺少 dry-run 报告说明后续 Task 会受到哪些 Profile 规则影响 | P1 | `project workflow enable` 当前直接写配置 |
| 历史数据解释不足 | 所有历史 Task 都是 legacy，metrics 可见但没有迁移/采用建议 | P1 | `project profile metrics --json` totals: legacy=65 |
| governed 准备度未知 | 启用 governed 或默认 governed 前，用户不知道 L3 是否普遍声明关键 AC | P1 | governed 依赖 `## 关键验收标准` 和 verification coverage |
| 回滚心智负担 | 禁用 workflow 虽已存在，但启用前未明确“只影响后续 Task，不改历史” | P1 | 方法论已说明，CLI adoption flow 未集中呈现 |
| Agent 使用一致性 | Agent 入口知道推荐/metrics，但没有“启用前先 preview”的强流程提示 | P2 | Agent 入口规则当前只提 recommend/metrics |

## 用户故事

### Must have

- As a **项目维护者**, I want **在启用 adaptive workflow 前看到 adoption preview**, so that **我知道启用会如何影响后续 Task**
- As a **执行 Agent**, I want **在项目仍为 legacy 时获得下一步采用建议**, so that **我不会盲目继续创建 legacy Task**
- As a **审计者**, I want **确认启用/禁用不会改写历史 Task Profile**, so that **历史记录仍可解释**
- As a **治理负责人**, I want **看到 governed readiness 和关键 AC 声明覆盖情况**, so that **我能决定默认 standard 还是 governed**

### Should have

- As a **团队负责人**, I want **adoption preview 输出 JSON**, so that **可以把它接入发布检查或 CI 报告**
- As a **维护者**, I want **启用后立即看到新的 workflow 状态和推荐下一步**, so that **配置变化有明确反馈**
- As a **Agent 模板维护者**, I want **入口规则提示启用前使用 preview**, so that **不同工具行为一致**

### Could have

- As a **项目维护者**, I want **对历史 legacy Task 生成只读解释报告**, so that **可以区分“历史未参与治理”和“治理缺口”**

## 功能目标

| 能力 | 现状 | 目标 |
|---|---|---|
| 启用前预检 | 无 preview，直接 enable | 提供只读 adoption preview，展示当前 workflow 状态、metrics、recommended default profile、readiness warning |
| governed readiness | 单个 governed Task 创建时校验关键 AC | preview 汇总 L3 关键 AC 声明覆盖和缺口示例 |
| legacy 解释 | metrics 显示 legacy 数量 | preview 明确历史 legacy 不迁移、不构成新治理违规 |
| JSON 输出 | workflow show 有 JSON，metrics 有 JSON | preview 支持 text/json 稳定 schema |
| Agent 入口 | 提到 recommend/metrics | 增加“启用前先 preview”的规则 |

## 验收标准

1. **AC-1**: **Given** adaptive workflow disabled, **When** 用户运行 adoption preview, **Then** 系统 **SHALL** 输出当前 disabled 状态、legacy Task 数量和启用不会改写历史 Task 的说明。
2. **AC-2**: **Given** 项目存在 L3 specs, **When** 生成 adoption preview, **Then** 系统 **SHALL** 汇总 L3 总数、已声明 `## 关键验收标准` 的数量、未声明数量和示例。
3. **AC-3**: **Given** 用户请求 JSON 输出, **When** 运行 adoption preview, **Then** 系统 **SHALL** 输出稳定 `schemaVersion`，不得依赖自然语言解析。
4. **AC-4**: **Given** preview 发现 governed readiness 缺口, **When** 输出建议, **Then** 系统 **SHALL** 推荐默认 `standard`，并说明 governed 可作为显式高风险覆盖使用。
5. **AC-5**: **Given** preview 发现所有 active L3 均具备关键 AC, **When** 输出建议, **Then** 系统 **SHOULD** 允许建议 defaultProfile 为 `governed` 或提示可升级。
6. **AC-6**: **Given** 用户启用 adaptive workflow, **When** 启用完成, **Then** CLI **SHALL** 输出后续 Task 将获得 Profile 快照，并提示可用 `project profile metrics` 审计采用效果。
7. **AC-7**: **Given** 用户禁用 adaptive workflow, **When** 禁用完成, **Then** CLI **SHALL** 明确只影响后续 Task，不改写历史 profile snapshots。
8. **AC-8**: **Given** Agent 入口同步后, **When** 用户查看 AGENTS/skill 规则, **Then** 规则 **SHALL** 提示启用前先运行 adoption preview。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| Adoption preview 可用性 | 无 preview | 命令在本项目 exit 0，text/json 均可读 | CLI smoke |
| governed readiness 可见性 | 单 Task 创建时才发现 | preview 汇总 active L3 关键 AC 声明情况 | fixture 测试 |
| 历史 legacy 解释 | metrics 原始数字 | preview 明确 legacy 不迁移、不违规 | CLI 文本/JSON 测试 |
| Agent 规则一致性 | 无 preview 提示 | managed assets 与模板均包含 preview 规则 | doctor + contract |

## 范围边界

- **做**:
  - 新增只读 adoption preview 能力
  - 复用 profile metrics 和关键 AC 解析
  - 增强 workflow enable/disable 输出说明
  - 同步方法论、skill、Agent 入口
- **不做**:
  - 不自动启用 adaptive workflow
  - 不自动迁移历史 Task profile
  - 不把 preview warning 变成 hard gate
  - 不批量修改历史 L3 的关键 AC
- **推迟**:
  - CI 强制 adoption preview
  - 历史 Task profile backfill
  - 组织级治理策略

## 设计原则

1. **显式采用** — preview 只能解释和建议，不能替用户写配置。
2. **历史不改写** — legacy Task 是历史事实，不作为新治理违规处理。
3. **默认保守** — 只要 governed readiness 不完整，默认建议 standard。
4. **本地可审计** — preview 只依赖本地 specs、tasks、config 和 metrics。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Adoption preview core/API/CLI text/json | profile metrics implemented | P1 |
| Phase 2 | Workflow enable/disable 输出增强与文档同步 | Phase 1 | P1 |
| Phase 3 | Agent/skill managed assets 同步与契约测试 | Phase 1-2 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Adaptive workflow adoption preview 与启用反馈 | Phase 1-3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| preview 被误解为 hard gate | 用户以为 warning 必须修完才能启用 | 文本明确 preview 是建议，不阻断 enable |
| governed readiness 判断过粗 | 仅检查关键 AC 声明，不证明 evidence 质量 | 输出称为 readiness，不声称业务正确 |
| 历史 legacy 被误读为失败 | 造成错误治理压力 | preview 明确 legacy 是启用前历史事实 |
| 与 metrics 重复 | 命令边界混乱 | preview 复用 metrics，但输出采用决策建议 |

## 关联

- based_on: `adaptive-evidence-workflow-L1`
- based_on: `adaptive-profile-intelligence-L1`
- based_on: `adaptive-profile-intelligence-L3.1.2-metrics`
