---
code: adaptive-profile-intelligence-L1
level: L1
title: Profile 推荐与治理效果度量
topic: adaptive-profile-intelligence
parentCode: null
status: implemented
aiSummary: >-
  定义 Profile 推荐、用户覆盖审计和本地治理效果度量；推荐输出可解释、可覆盖，度量按 Profile 汇总 Task 状态和 evidence
  coverage，保持 legacy 兼容且不引入远端遥测。
created: '2026-06-16T01:31:34.551Z'
updated: '2026-06-16T06:40:43.848Z'
changeSummary: 'cascade: task-complete'
---
# Profile 推荐与治理效果度量 — 需求文档

## 背景

`adaptive-evidence-workflow-L1` 已实现 quick、standard、governed 三档治理 Profile、显式启用兼容策略、Task Profile 快照、关键 AC evidence coverage 门禁和 `task evidence` 动态投影。当前系统已经能执行用户显式选择的 Profile，但还没有为“该选哪一档”提供一致的本地推荐，也没有按 Profile 汇总治理效果。

这导致两个问题：

1. Profile 选择仍依赖执行者经验。不同 Agent 或不同人面对相同风险特征时，可能选择不同治理强度。
2. 用户覆盖默认 Profile 或未来推荐 Profile 时，虽然 `task create --profile-reason` 可以保存单个 Task 的覆盖理由，但缺少统一的推荐、覆盖和效果汇总视图。
3. 项目维护者无法回答“governed 是否真的更稳”“standard warning 是否经常被忽略”“哪些风险特征最常触发高强度治理”等问题。

本阶段目标是在不引入云端遥测、不自动替代人工判断的前提下，提供本地、可解释、可覆盖的 Profile 推荐和治理效果度量。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 推荐一致性 | Profile 选择缺少确定性规则和可读理由 | P1 | `adaptive-evidence-workflow-L1` AC-8 |
| 覆盖审计 | 用户覆盖推荐/默认 Profile 的理由分散在 Task JSON 中 | P1 | `TaskRecord.profileOverrideReason` 已存在但无汇总视图 |
| 度量可见性 | 缺少按 Profile 汇总的完成率、失败率和 evidence 覆盖率 | P1 | `task evidence` 已有单 Task 投影但无聚合 |
| 渐进采用 | 推荐能力若自动强制执行会改变现有流程 | P1 | adaptive workflow 默认 legacy compatibility |
| 规则演进 | 推荐规则需要随项目经验迭代但不能变成黑箱 | P2 | 方法论文档强调系统保证与目标能力边界 |

## 用户故事

### Must have

- As a **工作发起者**, I want **根据请求文本和变更特征获得 Profile 推荐及理由**, so that **我可以用一致标准选择 quick、standard 或 governed**
- As a **执行 Agent**, I want **推荐结果明确说明是否可覆盖以及覆盖时需要记录什么**, so that **我不会把推荐误当成不可变硬门禁**
- As a **项目维护者**, I want **查看 Profile 采用、覆盖、完成和 evidence 覆盖统计**, so that **我可以判断治理强度是否匹配项目风险**
- As a **审计者**, I want **看到推荐 Profile、最终 Profile 和覆盖理由之间的差异**, so that **我可以追踪风险接受决策**

### Should have

- As a **团队负责人**, I want **看到按 topic、Profile 和时间窗口的本地汇总**, so that **我可以识别治理成本或质量风险集中区域**
- As a **工具维护者**, I want **推荐规则以可测试的本地规则表达**, so that **后续可以在不引入远端服务的情况下演进**
- As a **standard 工作执行者**, I want **看到 standard warning 的历史占比**, so that **我可以判断是否需要升级为 governed**

### Could have

- As a **项目维护者**, I want **导出 Profile 度量 JSON**, so that **可以接入外部仪表盘或 release report**

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| Profile 推荐 | 无 CLI/API 推荐能力 | 对一次请求输出 1 个推荐 Profile、风险特征列表和理由 |
| 推荐可覆盖 | 只能显式传 `--profile` 和 `--profile-reason` | 推荐结果明确展示覆盖要求；Task 创建保留最终 Profile 与理由 |
| 覆盖审计 | 单 Task 可读，缺少聚合 | 能列出推荐与最终 Profile 不一致的 Task 或候选记录 |
| Profile 度量 | 无聚合命令 | 按 Profile 汇总 Task 数、完成数、失败数、完成率和 governed coverage 结果 |
| standard warning 可见性 | 单次 complete 输出 warning | 度量中展示 standard 关键 AC coverage warning 数量 |
| 兼容性 | 未启用 adaptive workflow 时保持 legacy | 推荐和度量命令可运行，但不得自动启用或加严项目 |

## 验收标准

1. **AC-1**: **Given** 用户提供一个工作请求或变更描述, **When** 调用 Profile 推荐能力, **Then** 系统 **SHALL** 返回 quick、standard 或 governed 中的一个推荐 Profile、触发的风险特征和可读理由。
2. **AC-2**: **Given** 推荐结果为 governed 或 standard, **When** 用户选择不同 Profile 继续创建 Task, **Then** 系统 **SHALL** 要求或保留覆盖理由，并能在审计视图中展示推荐与最终选择的差异。
3. **AC-3**: **Given** adaptive workflow 未启用, **When** 用户调用推荐或度量命令, **Then** 系统 **SHALL** 不自动修改配置、不改变 Task 完成语义，并清楚说明当前项目仍按 legacy compatibility 运行。
4. **AC-4**: **Given** 项目存在多个带 Profile 快照的 Task, **When** 用户查看治理效果度量, **Then** 系统 **SHALL** 按 Profile 汇总 Task 总数、completed 数、failed 数、running 数和完成率。
5. **AC-5**: **Given** 项目存在 governed Task, **When** 用户查看治理效果度量, **Then** 系统 **SHALL** 汇总关键 AC evidence coverage 的 covered、failed、uncovered 数量，并标识 completed governed 缺口。
6. **AC-6**: **Given** 项目存在 standard Task 且关键 AC 未完整覆盖, **When** 用户查看治理效果度量, **Then** 系统 **SHALL** 统计 warning 数量，但 **MUST** 不把 standard warning 计为完成违规。
7. **AC-7**: **Given** 推荐规则命中多个风险特征, **When** 输出推荐结果, **Then** 系统 **SHALL** 保留确定性优先级，且相同输入在相同规则版本下输出一致。
8. **AC-8**: **Given** 用户请求 JSON 输出, **When** 调用推荐或度量命令, **Then** 系统 **SHALL** 输出稳定 schemaVersion，并避免依赖自然语言解析。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 推荐确定性 | 无推荐能力 | 相同输入 100% 输出相同推荐 | 推荐规则单元测试 |
| 推荐理由覆盖 | 无推荐理由 | 每次推荐至少 1 条风险特征和 1 条理由 | CLI/API 测试 |
| Profile 统计完整性 | 无聚合 | 100% 带 profile 快照 Task 被纳入汇总 | fixture 聚合测试 |
| governed coverage 缺口识别 | 单 Task doctor/integrity | 度量汇总能统计所有 governed 缺口 | evidence 聚合测试 |
| legacy 兼容 | 推荐/度量不存在 | 未启用项目命令可读且不写配置 | installed CLI smoke |

## 范围边界

- **做**:
  - 提供本地 Profile 推荐规则和 CLI/API
  - 输出推荐 Profile、风险特征、理由和覆盖说明
  - 汇总 Task Profile 采用、状态和 evidence coverage 度量
  - 汇总推荐与最终 Profile 不一致的覆盖记录
  - 支持 text/json 输出
- **不做**:
  - 不使用远端 AI、云端遥测或外部数据库
  - 不自动替用户选择或强制采用推荐 Profile
  - 不自动启用 adaptive workflow
  - 不自动修改历史 Task 的 Profile
  - 不用自然语言声称业务结果真实正确
- **推迟**:
  - 基于历史结果自动调参
  - 组织级策略下发
  - 可视化仪表盘
  - 行业合规模板

## 设计原则

1. **推荐是解释性输入，不是隐藏门禁** — 推荐必须说明理由并允许用户覆盖。
2. **确定性优先** — 同一输入和规则版本必须得到相同推荐，避免 Agent 因上下文波动产生不一致治理选择。
3. **本地事实源** — 推荐、覆盖和度量只依赖本地 Spec、Task、verification、config 和 audit 数据。
4. **兼容性优先** — 未启用 adaptive workflow 的项目可以查看推荐和度量，但不得被自动加严。
5. **度量不等同质量** — 完成率和 coverage 率只能反映流程证据，不自动证明业务正确性。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Profile 推荐规则、推荐 CLI/API、text/json 输出 | `adaptive-evidence-workflow-L1` implemented | P1 |
| Phase 2 | 推荐覆盖记录与审计视图 | Phase 1、现有 Task Profile 快照 | P1 |
| Phase 3 | Profile 采用和 evidence coverage 度量汇总 | Phase 1-2、`task evidence` 投影 | P1 |
| Phase 4 | 文档、Agent 入口和方法论契约同步 | Phase 1-3 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Profile 推荐与覆盖审计 | Phase 1-2 | 1 |
| Profile 效果度量与报告 | Phase 3-4 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 推荐规则过度简单 | 用户不信任推荐或频繁覆盖 | 输出命中特征和理由，允许覆盖并度量覆盖率 |
| 推荐规则过度强势 | Agent 把推荐当成不可绕过门禁 | 文档和 CLI 明确推荐可覆盖，硬门禁仍由 Profile 与 evidence gate 决定 |
| 度量被误读为质量指标 | 团队把 coverage 当成业务正确性 | 报告明确“流程证据”边界，不宣称业务结果自动正确 |
| 聚合扫描性能下降 | 大仓库命令变慢 | 复用 ProjectSnapshot 和已有 Task/Evidence 投影，首版按本地文件扫描 |
| 历史 Task 缺少 profile | 汇总结果不完整 | 旧 Task 归入 legacy/unknown 兼容桶，不要求迁移 |

## 关联

- based_on: `adaptive-evidence-workflow-L1`
- based_on: `adaptive-evidence-workflow-L2.1`
- based_on: `adaptive-evidence-workflow-L3.1.1-profile`
- based_on: `adaptive-evidence-workflow-L3.1.2-evidence`
