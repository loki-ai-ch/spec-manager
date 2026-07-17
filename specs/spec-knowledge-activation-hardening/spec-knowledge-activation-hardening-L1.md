---
code: spec-knowledge-activation-hardening-L1
level: L1
title: Spec Knowledge Activation Hardening
topic: spec-knowledge-activation-hardening
parentCode: null
status: implemented
aiSummary: >-
  定义知识激活加固需求：让跨 topic 召回进入工作流路由，默认治理新 L1/L2/L3，完善历史约束包与 Delivery Knowledge
  审批复验，补齐召回、处置、scope、delivery、关键 AC evidence 指标，并以只读预览渐进治理历史资产。
relations:
  - type: based_on
    target: spec-knowledge-governance-L1
  - type: based_on
    target: spec-knowledge-loop-L1
  - type: references
    target: critical-ac-readiness-L1
  - type: references
    target: adaptive-profile-intelligence-L1
created: '2026-07-16T07:54:10.771Z'
updated: '2026-07-16T09:11:57.037Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-governance-L1'
    - 'spec:spec-knowledge-loop-L1'
    - 'spec:critical-ac-readiness-L1'
    - 'spec:adaptive-profile-intelligence-L1'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-governance-L1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-loop-L1'
      action: reuse
    - sourceRef: 'spec:critical-ac-readiness-L1'
      action: reuse
    - sourceRef: 'spec:adaptive-profile-intelligence-L1'
      action: reuse
  reviewedAt: '2026-07-16T07:54:50.904Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-activation-hardening-L2.1
      title: Knowledge Activation Routing and Constraint Package
      required: true
    - code: spec-knowledge-activation-hardening-L2.2
      title: Governance Adoption Review Integrity and Migration Metrics
      required: true
  leaf: false
  updatedAt: '2026-07-16T08:04:47.370Z'
---
# Spec Knowledge Activation Hardening - 需求文档

## 背景

项目已经具备 207 份 implemented Spec、33 个 topic、132 个 completed Task、33 张 active Decision，且 207 份 Spec 全部具有 aiSummary。跨 topic 召回、知识有效性、历史处置、范围完整性、Delivery Knowledge 和治理指标的基础机制也已经交付。

但当前机制尚未形成稳定的知识激活闭环：一次“让 L0/L1/L2 角色 Agent 协作”的真实请求虽然能够召回多个相关 topic，后续路由仍按推断出的 `agent` 精确 topic 报告无历史；207 份 Spec 中 historyReview 为 0，74 份 L1/L2 的 scope readiness 全部为 legacy，132 份 L3 中没有一份显式启用 delivery learning；知识注册表只有 1 条人工有效性标注，33 张 Decision 全部 active，关系中没有替代型关系；关键 AC readiness 仅 25/132，比例为 18.9%。

如果这些缺口继续存在，新增 Spec 数量会持续增长，但团队仍需人工判断历史是否相关、是否有效以及是否可以复用，已经实现的知识治理能力无法成为新迭代的默认工作方式。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 激活断链 | 跨 topic 召回结果没有进入后续工作流判断，出现“已找到历史但仍报告无历史” | P1 | 真实 Brief 输出与 next 路由对比 |
| 治理未采用 | historyReview、scopePlan、delivery learning 均为可选机制，现有或新近资产采用率接近 0 | P1 | knowledge metrics 与仓库统计 |
| 可信度缺口 | Delivery Knowledge approve 时未重新确认引用来源仍有效 | P1 | 已实施规格与当前行为对账 |
| 约束包不完整 | 召回尚未稳定提供正文信号、代码模块、关键 AC、冲突约束和失败路径 | P1 | Agent Brief 当前输出 |
| 指标不完整 | 缺少召回、处置、evidence 覆盖率和 invalid projection，topic 口径不完整 | P2 | knowledge metrics 当前输出 |
| 历史债务 | 旧资产没有有效性、替代、继承和关键 AC 治理，但不能安全自动推断 | P2 | 207 Spec、33 Decision、132 L3 统计 |

## 用户故事

### Must have

- As a 发起新迭代的团队成员, I want 系统把跨 topic 召回结果用于后续工作流判断, so that 不会在找到相关历史后仍错误地要求从零开始。
- As a Spec 审核者, I want 新 L1/L2 默认声明历史来源的 reuse/change/reject/unknown 处置, so that 每次批准都明确历史约束如何继承。
- As a Task 审核者, I want 交付知识在批准时再次确认 Task、证据和 AC 来源有效, so that 失效或漂移的证据不会进入后续召回。
- As a 后续实现 Agent, I want 获得小型、可解释的历史约束包, so that 能直接看到有效决策、关键 AC、复用能力、失败经验、代码影响面和冲突风险。
- As a 项目治理者, I want 用完整且 topic 口径正确的指标观察采用率和缺口, so that 可以渐进治理高价值资产而不批量误判历史。

### Should have

- As a 规格规划者, I want 新 L1/L2 显式声明范围是否收敛及计划子级, so that 上位规格不会在仍有未创建交付物时提前完成。
- As a L3 作者, I want 每份新 L3 显式选择是否启用 delivery learning 并说明例外, so that Task 完成阶段不会依赖隐藏默认值。
- As a 维护者, I want 获得按 topic、活跃度和风险排序的历史治理清单, so that 可以优先处理最可能被未来迭代复用的知识。

### Could have

- As a 项目维护者, I want 对高价值 topic 进行批次治理预览, so that 人工确认前可以评估工作量和预期覆盖率变化。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| 跨 topic 激活路由 | 已复现 1 次召回成功但路由判定无历史 | 同类回归用例错误判定为 0 |
| 历史继承采用 | 207 份 Spec 中 historyReview 为 0 | 本能力启用后新 confirmed L1/L2 采用率 100% |
| Scope 治理采用 | 74 份 L1/L2 全部 legacy | 本能力启用后新 L1/L2 在生命周期推进前显式声明率 100% |
| Delivery learning 声明 | 132 份 L3 显式启用数为 0 | 新 frozen L3 显式选择启用或说明不启用的比例 100% |
| Delivery Knowledge 审批可信度 | approve 不重新校验来源 | approved 记录来源复验覆盖率 100% |
| 关键 AC | active L3 readiness 为 25/132 (18.9%) | 新 governed L3 readiness 100%，选定迁移批次不低于 80% |
| 知识治理指标 | 仅提供 validity/disposition/scope/delivery 数量 | 提供设计约定的覆盖率、topic 口径和无效投影清单 |
| 历史替代关系 | 替代型关系为 0 | 支持生成候选清单并由人工确认，不设自动写入目标 |

## 验收标准

1. **AC-1**: **Given** 一个未显式指定 topic 的新需求能够召回其他 topic 的相关历史，**When** 系统生成后续工作流建议，**Then** 建议 **SHALL** 承认相关历史并提供复用、继续调研或创建新 topic 的可解释选择，不得同时报告“没有相关历史”。
2. **AC-2**: **Given** 一个新 L1 或 L2 即将进入 confirmed，**When** 存在已召回历史或确实没有相关历史，**Then** 系统 **SHALL** 要求完成逐项历史处置或记录无相关历史理由。
3. **AC-3**: **Given** 一个新 L1/L2 声明了交付范围，**When** 其生命周期尝试完成，**Then** 系统 **SHALL** 依据显式范围阻断 open、missing 或 incomplete 子级，并为例外提供可审计说明。
4. **AC-4**: **Given** 一个新 L3 即将 frozen，**When** 作者选择 delivery learning 策略，**Then** 系统 **SHALL** 保存显式启用状态或带理由的不启用状态；启用后的 Task 在完成前必须声明结论或 none。
5. **AC-5**: **Given** 一条 draft Delivery Knowledge 引用了 Task、成功 evidence 和 AC，**When** 人工批准它，**Then** 系统 **SHALL** 重新校验全部来源；任一来源失效时保持 draft 并返回可解释错误。
6. **AC-6**: **Given** 一个新需求存在相关历史，**When** 系统生成历史约束包，**Then** 输出 **SHALL** 在受控数量内包含相关 Spec、当前 Decision、关键 AC、批准的经验、代码影响面、潜在冲突、来源和置信度；缺失维度必须显式标为 unknown。
7. **AC-7**: **Given** 用户按 project 或 topic 查看知识治理指标，**When** 报告生成，**Then** 报告 **SHALL** 给出有效性、历史处置、scope、delivery、召回、关键 AC evidence 的数量与覆盖率，并隔离列出无法解析的投影。
8. **AC-8**: **Given** 207 份历史 Spec 和相关 Decision 尚未治理，**When** 用户请求迁移预览，**Then** 系统 **SHALL** 只生成按价值和风险排序的候选批次，不得自动把 implemented 推断为 current，也不得自动写入替代型关系或历史处置。
9. **AC-9**: **Given** 旧 Spec、Task 或脚本没有新增治理字段，**When** 升级后继续使用既有只读和执行命令，**Then** 系统 **SHALL** 保持存储格式可读、CLI 兼容和纯本地运行。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 激活路由一致性 | 已知失败用例 1 个 | 回归用例 100% 一致 | Brief 与下一步建议契约测试 |
| 新 L1/L2 历史处置覆盖率 | 0% | 100% | 按创建时间统计 confirmed 资产 |
| 新 L1/L2 scope 声明率 | 0% | 100% | Scope readiness 按创建时间统计 |
| 新 L3 learning 策略声明率 | 0% | 100% | L3 frontmatter 与 Task 完成记录统计 |
| Delivery approve 来源复验率 | 0% | 100% | 审批结果与来源校验记录 |
| 新 governed L3 关键 AC readiness | 当前项目整体 18.9% | 100% | Critical readiness 报告 |
| 指标维度完成率 | 4 类计数，覆盖率维度缺失 | AC-7 所列维度 100% | Knowledge metrics 契约测试 |
| 自动误写历史资产 | 0 | 保持 0 | 迁移前后仓库 diff 与审计记录 |

## 范围边界

- **做**: 让跨 topic 召回结果进入工作流路由；完善历史约束包；默认启用面向新资产的 history、scope 和 learning 声明；补强 Delivery Knowledge 审批复验；补齐治理指标；提供只读、人工确认的历史迁移预览。
- **不做**:
  - 不自动把 implemented Spec 批量标记为 current，不自动判定 Decision 或 Spec 已被替代。
  - 不在本轮创建 L0/L1/L2 角色 Agent；角色协作建立在本能力稳定之后。
  - 不引入向量数据库、远程模型、MCP 或网络服务作为必需依赖。
  - 不要求一次性治理全部 207 份历史 Spec 或逆转其生命周期状态。
- **推迟**: 语义 embedding、跨仓库全局知识图谱、自动生成替代关系建议的模型增强、角色 Agent 编排。

## 设计原则

1. **召回与路由一致** - 同一份历史证据必须被 Brief 和下一步判断共同消费。违反判断: 一个输出展示相关历史，另一个输出却声称没有历史。
2. **显式治理优先** - 有效性、继承、范围和交付学习均由可审计声明决定。违反判断: 系统仅根据 implemented 或关键词自动写入治理结论。
3. **未知优于误判** - 无可靠证据时输出 unknown 并给出下一步。违反判断: 缺失数据被静默当作 current、reuse 或无冲突。
4. **渐进迁移** - 新资产执行强约束，历史资产通过只读预览分批治理。违反判断: 升级导致旧资产批量失效或被自动修改。
5. **来源可追溯** - 约束包与指标必须能定位原始 Spec、Decision、Task、evidence 或 AC。违反判断: 输出结论没有 canonical source 或无法复核。
6. **纯本地确定性** - 核心行为在无网络、无模型服务时可复现。违反判断: 相同仓库和请求产生不可解释的随机结果，或必须上传知识正文。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | 激活路由一致性与完整历史约束包 | 既有跨 topic retrieval | P1 |
| Phase 2 | 新资产默认治理与 Delivery approve 来源复验 | Phase 1 完成 | P1 |
| Phase 3 | 完整治理指标与历史迁移预览 | Phase 2 完成 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Knowledge activation routing and constraint package | Phase 1 | 1 |
| Governance adoption, review integrity, and migration metrics | Phase 2-3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 中文请求的词法召回仍可能遗漏语义相关历史 | 约束包不完整 | 保留 unknown、来源解释和人工追加入口，不把低召回当作无历史事实 |
| 默认门禁增加新 Spec 的填写成本 | 用户绕过治理字段 | 提供候选来源、显式 none/不启用理由和可操作下一步 |
| 历史资产规模较大 | 全量治理投入不可控 | 只读预览按活跃度、关系和风险排序，按批次人工确认 |
| 指标口径扩展造成版本兼容风险 | 脚本解析失败 | 保留既有字段并增量扩展，提供 schemaVersion 和兼容测试 |
| 当前工作区存在未提交改动 | 实施时可能发生变更冲突 | 后续 L3 精确限定文件范围，并在 Task 开始前重新检查工作区 |

## 关联

- based_on: `spec-knowledge-governance-L1` - 继承知识有效性、历史处置、范围完整性和人工审核原则。
- based_on: `spec-knowledge-loop-L1` - 继承跨 topic 召回与历史约束包目标。
- references: `critical-ac-readiness-L1` - 沿用关键 AC readiness 的人工修复边界。
- references: `adaptive-profile-intelligence-L1` - 沿用只读、确定性治理指标模式。
