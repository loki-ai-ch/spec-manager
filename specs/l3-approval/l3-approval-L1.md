---
code: l3-approval-L1
level: L1
title: L3 单次批准冻结流程
topic: l3-approval
parentCode: null
status: implemented
created: '2026-06-08T02:47:09.731Z'
updated: '2026-06-08T03:12:56.346Z'
aiSummary: 优化 L3 审核门禁：一次明确人工批准后直接进入 frozen，L1/L2 仍进入 confirmed，并兼容历史 confirmed L3
changeSummary: frozen → implemented
---
# L3 单次批准冻结流程 — 需求文档

## 背景

当前 L3 实施规格从可编辑状态进入可执行状态，需要连续完成两次人工状态推进：

1. 用户批准后执行 `draft -> confirmed`。
2. 用户再次批准后执行 `confirmed -> frozen`。

两次推进表达的是同一份 L3 正文的批准，期间通常没有新的内容变更或独立审核目标。现有 README、规则和 agent 指令均要求这两个动作分别执行，导致每条 L3 在进入 Agent Task 前至少多一次用户确认和一次 CLI 调用。

当前项目已有 11 条 implemented L3，均经历了该双重推进流程。按每条 L3 多一次批准计算，已产生至少 11 次重复人工动作。随着 L3 数量增加，该重复门禁会持续增加流程等待时间，并容易让 L3 停留在 `confirmed`，无法创建 Agent Task。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 重复审核 | L3 的 confirm 与 freeze 对同一正文要求两次人工批准 | P1 | 当前状态机和流程规则 |
| 流程阻塞 | L3 已获批准但停留在 confirmed 时仍不能创建 Agent Task | P1 | R3 要求 L3 frozen |
| 操作一致性 | 快捷 approve、spec confirm、spec freeze 对 L3 的推进语义分散 | P2 | 当前 CLI 使用流程 |
| 向后兼容 | 历史项目可能已有 confirmed L3，需要可继续推进 | P2 | 现有状态模型 |

## 用户故事

### Must have

- As a **规格审核者**, I want **一次批准即可让 L3 进入 frozen**, so that **不需要对同一份实施规格重复确认**。
- As a **AI agent**, I want **用户批准 L3 后可以立即进入 Agent Task 流程**, so that **不会因遗漏第二次 freeze 而阻塞实施**。
- As a **项目维护者**, I want **L3 仍保留明确的人工审核门禁**, so that **减少操作步骤不会变成自动批准**。

### Should have

- As a **历史项目用户**, I want **已有 confirmed L3 仍可正常冻结**, so that **升级后不需要迁移或重建规格**。
- As a **CLI 用户**, I want **所有流程提示和工具入口描述统一为 L3 单次批准**, so that **不会继续收到重复确认指引**。

### Could have

- As a **项目维护者**, I want **能够识别长期停留在 confirmed 的历史 L3**, so that **可以集中完成状态收尾**。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| L3 人工批准次数 | 每条 L3 需要 2 次 | 每条 L3 需要 1 次 |
| L3 批准后的状态 | 第一次批准后为 confirmed，仍不可执行 | 一次批准后为 frozen，可创建 Agent Task |
| 历史 confirmed L3 兼容 | 需要再次 freeze | 保留一次操作即可进入 frozen |
| 流程提示一致性 | 多处描述“两次批准” | 所有入口统一描述“一次批准后 frozen” |

## 验收标准

1. **AC-1**: **Given** 一条正文完整的 draft L3，**When** 用户明确批准该 L3，**Then** 系统 **SHALL** 通过一次批准动作将其推进到 frozen。
2. **AC-2**: **Given** 一条正文完整的 draft L1 或 L2，**When** 用户批准该规格，**Then** 系统 **SHALL** 仍将其推进到 confirmed。
3. **AC-3**: **Given** 一条历史 confirmed L3，**When** 用户批准或冻结该规格，**Then** 系统 **SHALL** 将其推进到 frozen。
4. **AC-4**: **Given** 一条未获用户明确批准的 draft L3，**When** AI agent 执行日常规格流程，**Then** 系统和工具入口 **MUST NOT** 自动将其推进到 frozen。
5. **AC-5**: **Given** 一条已通过单次批准进入 frozen 的 L3，**When** 用户创建 Agent Task，**Then** 系统 **SHALL** 按现有 R3 规则允许创建。
6. **AC-6**: **Given** 用户查看 README、规则、guide 或已支持的 agent 入口，**When** 内容描述 L3 审核流程，**Then** 内容 **SHALL** 统一表达“一次人工批准后进入 frozen”。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 每条 L3 从 draft 到 frozen 的人工批准次数 | 2 次 | 1 次 | 流程测试与 CLI 调用记录 |
| 每条 L3 从 draft 到 frozen 的状态推进命令次数 | 2 次 | 1 次 | CLI 流程测试 |
| 因等待第二次 freeze 停留在 confirmed 的新 L3 | 待测量 | 0 条 | spec 状态列表 |
| L3 双重批准描述残留 | 多处 | 0 处 | 文档与模板一致性测试 |

## 范围边界

- **做**:
  - 将 L3 的一次明确人工批准直接映射为 frozen。
  - 保持 L1/L2 批准后进入 confirmed。
  - 兼容已有 confirmed L3 的冻结流程。
  - 同步 CLI 提示、规则、文档和 agent 入口。
- **不做**:
  - 不取消 L3 的人工审核门禁。
  - 不允许未批准的 L3 自动进入 frozen。
  - 不放宽 frozen L3 才能创建 Agent Task 的规则。
  - 不改变 task complete 推进 implemented 的行为。
- **推迟**:
  - 自动扫描并批量冻结历史 confirmed L3。
  - 可配置的自定义状态机。

## 设计原则

1. **一次批准只表达一个审核结论** — L3 的批准结论直接表示正文可执行。违反判断：同一份未变更 L3 仍要求第二次人工批准。
2. **减少动作不减少门禁** — 必须先收到用户明确批准信号，才能进入 frozen。违反判断：创建或更新 L3 后自动冻结。
3. **层级语义保持清晰** — L1/L2 的批准仍进入 confirmed，L3 的批准进入 frozen。违反判断：所有层级被无差别推进到 frozen。
4. **历史状态可继续使用** — 已有 confirmed L3 不需要迁移即可完成冻结。违反判断：升级后 confirmed L3 无法推进或必须重建。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | L3 单次批准状态语义与 CLI 行为 | 无 | P1 |
| Phase 2 | 流程提示、文档与 agent 入口统一 | Phase 1 | P1 |
| Phase 3 | 兼容性与完整流程测试 | Phase 1 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| L3 单次批准流程 | Phase 1-3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 用户误以为取消了人工审核 | 降低对 frozen 状态的信任 | 文档明确“一次人工批准”，而非自动冻结 |
| 不同 CLI 入口语义不一致 | 部分入口仍产生 confirmed L3 | 统一验收并覆盖完整流程测试 |
| 历史 confirmed L3 行为变化 | 旧项目操作习惯受影响 | 保留 confirmed 到 frozen 的兼容推进能力 |

## 关联

- based_on: `workflow-hardening-L1`
- 影响规则: R1、R2、R3、R4
