---
code: spec-knowledge-loop-L1
level: L1
title: Spec Knowledge Activation Loop
topic: spec-knowledge-loop
parentCode: null
status: implemented
aiSummary: >-
  定义 Spec 知识激活闭环：跨 topic 召回可解释历史约束，治理知识有效性与替代关系，在新 L1/L2 中记录复用、修改、拒绝或待验证，并把关键
  AC、Task 结果和经验反馈到后续迭代；保持纯本地、确定性、人工审批和渐进式上下文。
relations:
  - type: references
    target: guided-assist-workflow-L1
  - type: references
    target: delivery-summary-L1
  - type: references
    target: adaptive-profile-intelligence-L1
  - type: references
    target: workflow-surface-simplification-L1
created: '2026-07-15T13:05:05.159Z'
updated: '2026-07-16T02:39:26.856Z'
changeSummary: 'cascade: task-complete'
---
# Spec Knowledge Activation Loop — 需求文档

## 背景

spec-manager 当前已经形成规模化的规格资产：项目内有 196 份已实施 Spec、31 个 topic、126 个已完成 Task 和 30 张 Decision Card；主 `specs` 目录累计 48,374 个物理行，196 份 Spec 均已提供 `aiSummary`。这些数据证明记录链路已经建立，但尚未稳定转化为下一次迭代的输入。

本轮以“让 L0/L1/L2 角色 Agent 协作”为真实请求生成历史 Brief 时，系统将请求归为 `agent`，返回 0 份相关 Spec、0 条 Decision 和“没有相关历史”；仓库实际存在 `agent-install-surface`、`guided-assist-workflow`、`spec-manager-ai-ux`、`workflow-surface-simplification` 等相关 topic。一次真实查询即出现假阴性，说明当前按单一 topic 精确匹配的方式无法承载持续增长的 Spec 规模。

知识有效性也缺少显式治理：196 份 Spec 全部处于 implemented，没有 archived Spec；30 张 Decision 全部处于 active，没有 superseded Decision；仅 74 份 Spec 声明 relations。验收知识方面，当前只有 21/126 份 active L3 的关键 AC ready，89 份缺少关键 AC 章节，16 份章节为空。未来 Agent 即使找到历史，也难以可靠判断哪些约束仍有效、哪些已经被替代、哪些验收标准必须继承。

如果不建立“召回—判断—继承—反馈”闭环，新增 Spec 主要增加存储量和阅读成本，无法持续降低重复调研、重复设计和兼容性回归风险；引入更多角色 Agent 还会进一步放大低价值文档产量。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| History retrieval | 新请求依赖单一 topic 精确匹配，跨 topic 相关历史无法进入 Brief | P1 | 真实角色 Agent 请求返回 0 条历史 |
| Knowledge validity | implemented 只表示曾经交付，不能表示知识当前仍适用 | P1 | 196 个 implemented、0 个 archived、0 条替代关系 |
| Constraint inheritance | 新规格没有统一声明复用、修改、拒绝哪些历史约束 | P1 | 仅 74/196 Spec 声明 relations |
| Acceptance continuity | 历史关键 AC 无法稳定进入后续规格和验证 | P1 | 仅 21/126 active L3 critical AC ready |
| Learning feedback | Task 完成事实没有统一沉淀为可检索的有效经验和失效信息 | P2 | 126 个 Task 已完成，但 Brief 对跨 topic 请求仍无历史结果 |
| Value measurement | 当前主要能统计数量与完成状态，不能衡量历史复用效果 | P2 | 现有 Profile 指标不包含召回和继承价值 |

## 用户故事

### Must have

- As a product owner, I want 新需求自动获得跨 topic 的相关历史, so that 我能在立项前识别重复建设、既有约束和潜在冲突。
- As an AI agent, I want 获得有来源、匹配理由和有效性标记的精简历史约束包, so that 我不必读取全部 Spec，也不会把过期内容当成当前要求。
- As a spec author, I want 在新 L1/L2 中明确记录对历史结论的复用、修改、拒绝或待验证处理, so that 后续实施可以追溯本轮如何使用历史知识。
- As an implementer, I want 关键历史验收标准能够进入新的 L3 与验证链路, so that 迭代不会无意破坏已经建立的行为约束。
- As a maintainer, I want Task 完成后形成可复用的结论、偏差和失效信息, so that 本轮实践能够改善下一轮决策。

### Should have

- As a maintainer, I want 查看召回命中率、历史继承率、知识失效率和关键 AC 连续性, so that Spec 价值可以用结果而不是行数衡量。
- As a reviewer, I want 在人工审批时看到新规格与历史决策的冲突提示, so that 覆盖既有决策必须是显式选择。
- As a user, I want 默认只读取少量摘要并按需展开正文, so that Spec 数量增长不会线性增加上下文成本。

### Could have

- As a portfolio owner, I want 通过能力视图观察不同 topic 之间的依赖和替代关系, so that 我能识别重复能力和治理空白。
- As an AI agent, I want 在确定性检索不足时使用可选的语义召回, so that 自然语言差异不会阻断历史复用。

### Won't have

- 本轮不建设 L0/L1/L2 角色 Agent 编排；角色 Agent 后续共享本能力输出的历史约束包。
- 本轮不以 Spec 数量、字数或行数增长作为成功指标。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| 跨 topic 历史召回 | 真实测试请求返回 0 条，实际至少存在 4 个相关 topic | 人工标注基准集中 Top 5 命中率不低于 80% |
| 假“无历史”控制 | 已观察案例中相关历史存在但仍返回无历史 | 基准集中存在相关历史的请求不得返回“无历史” |
| 上下文可解释性 | 只按 topic 选取，未说明跨 topic 匹配理由 | 每个推荐结果均包含来源、匹配理由和有效性信息 |
| 渐进式读取 | topic 内最多返回 5 条，但跨 topic 召回缺失 | 默认历史约束包不超过 5 份 Spec 摘要，正文按需展开 |
| 知识有效性 | 0 个 archived Spec、0 条显式替代关系 | 被明确替代或失效的知识 100% 具有状态和替代/原因来源 |
| 历史继承 | 无统一复用/修改/拒绝/待验证声明 | 有相关历史的新标准或 governed L1/L2 100% 给出处理结论 |
| 关键 AC 连续性 | 21/126 active L3 ready | 新 governed L3 100% 声明有效关键 AC，并可追溯来源 |
| 迭代反馈 | 126 个已完成 Task 尚不能支持跨 topic 请求召回 | 纳入闭环的新完成 Task 100% 产生经审核的迭代结论或明确声明无新增知识 |

## 验收标准

1. **AC-1**: **Given** 一个没有显式 topic、但仓库存在跨 topic 相关历史的新请求, **When** 用户请求迭代上下文, **Then** 系统 **SHALL** 在全库候选中返回最多 5 份排序后的相关 Spec，而不是只查询推断出的单一 topic。
2. **AC-2**: **Given** 一个被推荐的历史 Spec、Decision、Task 经验或验收约束, **When** 用户查看历史约束包, **Then** 每条结果 **SHALL** 展示来源、匹配理由、有效性和置信信息。
3. **AC-3**: **Given** 仓库中存在人工标注的相关历史, **When** 请求措辞与 topic 名称不完全一致或包含中文, **Then** 系统 **SHALL NOT** 返回“没有相关历史”。
4. **AC-4**: **Given** 历史知识已经被替代、失效或仅保留作背景, **When** 该知识进入候选结果, **Then** 系统 **SHALL** 标明其当前有效性，并指向替代来源或失效原因。
5. **AC-5**: **Given** 新 L1/L2 获得了相关历史约束包, **When** 规格进入人工审批, **Then** 规格 **SHALL** 对每项关键历史结论记录复用、修改、拒绝或待验证之一，并保留来源引用。
6. **AC-6**: **Given** 新 L3 继承了历史关键行为约束, **When** 创建 governed Task, **Then** 关键 AC **SHALL** 能够追溯到当前规格或明确引用的历史来源，并进入验证证据覆盖检查。
7. **AC-7**: **Given** 纳入闭环的 Task 完成, **When** 生成交付结果, **Then** 系统 **SHALL** 记录预期与实际偏差、被验证或失效的历史判断、可复用经验，或者明确声明本轮没有新增知识。
8. **AC-8**: **Given** 用户使用默认历史约束包, **When** 相关 Spec 数量持续增长, **Then** 系统 **SHALL** 优先提供摘要且默认不超过 5 份 Spec，正文只能按需展开。
9. **AC-9**: **Given** 系统提出历史推荐、有效性或继承建议, **When** 用户尚未确认, **Then** 系统 **SHALL NOT** 自动修改、确认、归档或替代任何 Spec、Decision 或 Task。
10. **AC-10**: **Given** 现有项目依赖本地 Markdown/JSON、确定性输出和现有工作流门禁, **When** 本能力上线, **Then** 系统 **SHALL** 保持纯本地、可解释、可审计，并兼容现有显式 topic 查询与历史数据。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| Top 5 历史召回命中率 | 真实测试案例为 0% | 人工标注基准集不低于 80% | 固定请求集与人工相关性标签对比 |
| 假“无历史”率 | 已观察案例为 100% | 基准集中相关历史存在时为 0% | 统计存在标注结果但返回空集的请求 |
| 历史处理声明覆盖率 | 0%，当前无统一契约 | 新标准/governed L1/L2 为 100% | 检查相关历史是否均有四态处理结论 |
| 推荐可解释覆盖率 | 当前跨 topic 推荐不存在 | 推荐结果 100% | 检查来源、理由、有效性、置信信息 |
| 新 governed L3 关键 AC readiness | 项目整体 21/126 | 纳入闭环的新 governed L3 为 100% | readiness 报告按创建时间和 topic 统计 |
| 迭代结论覆盖率 | 待测量 | 纳入闭环的新完成 Task 为 100% | 完成记录是否含结论或无新增知识声明 |
| 默认上下文规模 | topic 内最多 5 条，跨 topic 不可用 | 最多 5 份 Spec 摘要 | 历史约束包输出统计 |
| 历史复用价值 | 待测量 | 每轮发布可报告复用、修改、拒绝数量 | 按交付摘要聚合历史处理声明 |

## 范围边界

- **做**:
  - 建立跨 topic、可解释、确定性的历史召回与精简约束包。
  - 建立知识有效性及替代/失效来源表达。
  - 建立新规格对历史结论的复用、修改、拒绝、待验证声明。
  - 将关键历史约束接入 L3 验收和 Task 验证证据。
  - 将交付偏差、验证结果和可复用经验反馈到后续召回。
  - 提供召回、继承、有效性和反馈价值指标。
- **不做**:
  - 不引入远程服务、远程遥测或必须联网的知识库。
  - 不默认引入向量数据库、外部 embedding 服务或不可解释的黑盒排序。
  - 不允许系统自动批准、归档、替代或重写历史规格。
  - 不批量修改全部历史 Spec 来伪造完整覆盖率。
  - 不在本轮实现 L0/L1/L2 角色 Agent 编排。
- **推迟**:
  - 可选的本地语义索引与混合检索。
  - 能力地图和跨 topic 知识关系可视化。
  - 基于同一历史约束包的多角色 Agent 协作。
  - 对历史资产的辅助迁移和批量治理工具。

## 设计原则

1. **先激活再扩产** — 优先让已有知识进入新迭代，再增加新的文档生产角色。违反判断:角色或模板增加，但真实跨 topic 请求仍无法召回已有历史。
2. **本地、确定、可解释** — 同一仓库快照和请求应得到稳定结果，每条推荐都说明原因。违反判断:结果依赖远程服务、不可复现或无法解释排序依据。
3. **渐进式上下文** — 默认使用少量摘要，只有明确需要时读取正文。违反判断:Spec 数量增长导致默认上下文近似线性增长。
4. **人类掌握知识状态** — 系统可以建议失效和替代，但状态变化必须经过人工确认。违反判断:检索或 Task 完成自动改变历史知识有效性。
5. **实施状态不等于知识有效性** — 是否交付与是否仍适用必须分别表达。违反判断:仅凭 implemented 就把历史结论视为当前约束。
6. **继承必须可追溯** — 复用、修改、拒绝和待验证都必须指向来源。违反判断:新规格声称参考历史却无法定位具体 Spec、Decision 或 AC。
7. **向前治理优先** — 新闭环先保证新增资产质量，历史治理按价值逐步补齐。违反判断:上线前要求批量重写全部历史资产。
8. **证据闭环而非摘要堆积** — 经验必须连接到请求、规格、验收或结果。违反判断:新增总结无法影响后续召回、设计或验证。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Spec Compass：跨 topic 召回、排序理由、精简历史约束包、固定评测集 | 本 L1 confirmed | P1 |
| Phase 2 | Knowledge Validity：有效性、替代与失效来源、历史冲突提示 | Phase 1 完成 | P1 |
| Phase 3 | History Disposition：复用/修改/拒绝/待验证声明及关键 AC 继承 | Phase 1、Phase 2 完成 | P1 |
| Phase 4 | Delivery Learning：交付反馈、价值指标和治理报告 | Phase 3 完成 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| 跨 topic 历史召回与约束包 | Phase 1 | 1 |
| 知识有效性、继承、反馈与价值度量闭环 | Phase 2–4 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 关键词召回对中文、同义词和命名差异覆盖不足 | 继续产生假阴性 | 固定真实请求评测集，组合摘要、标题、关系和决策信号，保留后续混合检索空间 |
| 相关结果过多或误报 | Agent 上下文噪音增加 | Top 5 上限、匹配理由、置信信息和按需展开 |
| 历史摘要已经过时 | 错误约束被继续传播 | 有效性与更新时间提示，重要继承需人工确认 |
| 有效性治理增加维护成本 | 用户绕过或放弃标注 | 向前治理、默认建议、批量迁移推迟，不阻塞 legacy 历史 |
| 历史处理声明变成形式化填表 | 指标提高但没有真实价值 | 要求关联具体来源，并在交付结果中验证复用或修改是否真实发生 |
| 与现有 Assist、Delivery、Profile 能力重复 | 形成新的平行入口 | 复用既有入口和输出契约，本 L1 只建立闭环与缺失能力 |

## 关联

- references: `guided-assist-workflow-L1` — 复用引导式只读 Assist 入口和人工门禁原则。
- references: `delivery-summary-L1` — 复用交付事实、验证证据与残余风险摘要能力。
- references: `adaptive-profile-intelligence-L1` — 复用本地确定性推荐和治理度量原则。
- references: `workflow-surface-simplification-L1` — 保持核心短路径、现有工作流和本地事实源兼容。
