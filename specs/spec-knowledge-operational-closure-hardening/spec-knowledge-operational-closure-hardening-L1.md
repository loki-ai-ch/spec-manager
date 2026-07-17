---
code: spec-knowledge-operational-closure-hardening-L1
level: L1
title: Knowledge Activation Review Fixes
topic: spec-knowledge-operational-closure-hardening
parentCode: null
status: implemented
aiSummary: >-
  修复知识激活闭环的五个审查缺陷：ambiguous topic 不再隐式选题，路径 containment 与 historical
  需证据，中文冲突可召回，current knowledge 使用 resolver，失效 annotation 进入 invalidProjections。
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-L1
  - type: references
    target: spec-knowledge-activation-hardening-L1
  - type: references
    target: spec-knowledge-governance-L1
  - type: references
    target: critical-ac-readiness-L1
created: '2026-07-16T12:11:13.741Z'
updated: '2026-07-17T02:10:53.526Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-L1'
    - 'spec:spec-knowledge-activation-hardening-L1'
    - 'spec:spec-knowledge-governance-L1'
    - 'spec:critical-ac-readiness-L1'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-L1'
      action: change
      reason: >-
        Correct ambiguous routing, path trust, Chinese conflict tokenization,
        resolver-backed current counts, and stale annotation projections found
        by code review.
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-governance-L1'
      action: reuse
    - sourceRef: 'spec:critical-ac-readiness-L1'
      action: reuse
  reviewedAt: '2026-07-16T12:12:47.737Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-operational-closure-hardening-L2.1
      title: Topic Selection and Module Path Trust
      required: true
    - code: spec-knowledge-operational-closure-hardening-L2.2
      title: Multilingual Conflict and Resolver Metrics Correctness
      required: true
  leaf: false
  updatedAt: '2026-07-16T12:20:32.924Z'
---
# Knowledge Activation Review Fixes - 需求文档

## 背景

上一轮知识运行闭环已经实施并通过 90 个测试文件、1029 个测试，四个 governed Task 的关键 AC evidence 为 16/16，Delivery Knowledge approval coverage 为 100%。但随后代码审查发现 5 个未被测试捕获的语义缺陷，其中 3 个为 P1、2 个为 P2。

这些缺陷会削弱“新需求自动找到正确历史并给出可信约束”的核心价值：topic 候选已经标记 ambiguous 时，系统仍会回退到偶然 token；代码模块可能越出项目根或把待创建路径误称历史路径；中文约束因整段分词而无法识别近义冲突；topic 历史强度把所有未归档 Spec 误称 current knowledge；已删除来源的合法 annotation 不进入 invalid projection。

如果不修复，用户看到的推荐、路径状态、冲突候选和指标虽然结构完整，但部分结论并不符合事实，可能继续造成 topic 分裂、约束误用和治理债务漏报。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| Topic 决策 | ambiguous 候选仍回退 inferred token 并被 Workflow 消费 | P1 | 本轮 code review finding 1 |
| 路径可信度 | 路径未验证根目录边界；不存在的结构化路径被直接标记 historical | P1 | 本轮 code review finding 2 |
| 中文冲突 | 连续中文被视为完整 token，近义或部分重叠约束无法召回 | P1 | 本轮 code review finding 3 |
| 知识强度 | currentKnowledgeCount 实际统计所有非 archived Spec | P2 | 本轮 code review finding 4 |
| 指标完整性 | 合法但来源已删除的 annotation 被静默忽略 | P2 | 本轮 code review finding 5 |

## 用户故事

### Must have

- As a 新需求发起者, I want ambiguous topic 保持待选择状态, so that 系统不会用偶然 token 替我创建或进入错误 topic。
- As a 约束包使用者, I want 模块路径只在项目根内验证且历史状态有证据, so that 我不会把外部路径、拼写错误或待创建文件当成当前/历史实现。
- As a 中文 Spec 维护者, I want 中文近义与部分重叠约束能够产生可解释 conflict candidate, so that 中文需求不会绕过历史禁令。
- As a 治理审核者, I want current knowledge 和 invalid annotation 指标符合事实, so that topic 排序与治理债务不会被虚假数字影响。

### Should have

- As a 维护者, I want 每个修复都有正向、反向和 legacy 回归测试, so that 相同缺陷不会再次出现。

### Could have

- As a 调试者, I want topic、路径和冲突候选公开稳定 reason code, so that 可以定位为何未自动选择或为何降级为 unknown。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| Ambiguous topic | 1 条已知路径仍自动采用 inferred token | ambiguous/create-new 自动选 topic 次数为 0 |
| 路径边界 | 允许包含 `..` 的候选参与存在性判断 | 项目根外路径 100% 拒绝成为 current-path |
| Historical 判定 | 不存在的 inline/code-block 路径 100% 标为 historical | 无历史证据时 100% 为 unknown-path |
| 中文冲突 | 已确认近义中文反例召回率 0% | 固定中文正反样本 100% 符合 candidate/unknown/none 预期 |
| Current knowledge | 非 archived Spec 被全部计为 current | 仅 resolved state=current 进入计数 |
| Stale annotation | 合法格式的失效来源漏报 | 固定失效来源样本 100% 进入 invalidProjections |

## 验收标准

1. **AC-1**: **Given** 两个 canonical topic 候选置信度接近且 recommendation 为 ambiguous，**When** Brief 或 Workflow 生成下一步，**Then** 系统 **SHALL** 不设置自动选择的 topic，并明确展示候选与 create-new 选择。
2. **AC-2**: **Given** 模块候选包含路径穿越、绝对逃逸或解析后位于项目根外，**When** 系统验证路径，**Then** 该候选 **SHALL NOT** 被标记 current-path 或读取项目外存在性。
3. **AC-3**: **Given** 一个结构化路径当前不存在且没有版本历史或历史来源证据，**When** 生成约束包，**Then** 系统 **SHALL** 标记 unknown-path；只有存在可解释历史证据时才能标记 historical-path。
4. **AC-4**: **Given** 中文请求与 current 关键 AC 在对象/动作上重叠但约束极性相反，**When** 生成约束包，**Then** 系统 **SHALL** 产生带双方来源、匹配词、reason code 和置信度的 candidate 或 unknown；无语义重叠时不得误报。
5. **AC-5**: **Given** topic 关联的 Spec 同时包含 current、unknown、historical 或 superseded knowledge state，**When** 计算 canonical topic 历史强度，**Then** currentKnowledgeCount **SHALL** 仅统计 resolved state 为 current 的来源。
6. **AC-6**: **Given** registry 中存在格式合法但来源已删除或不可验证的 annotation，**When** 生成 project/topic metrics，**Then** 系统 **SHALL** 将其加入 invalidProjections，并且不静默计入有效状态。
7. **AC-7**: **Given** legacy 项目和现有英文请求、合法项目内路径及有效 annotation，**When** 升级后运行 Brief、Next、Metrics 与 Migration Preview，**Then** 系统 **SHALL** 保持纯本地、只读边界、CLI/schema 兼容和确定性排序。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| Ambiguous 自动选题率 | 已知反例 100% | 0% | Workflow/Brief fixture |
| 根外路径误判率 | 已知反例可误判 | 0% | 路径穿越与 sibling fixture |
| 无证据 historical 误判率 | inline 不存在路径 100% | 0% | current/proposed/historical 三类 fixture |
| 中文冲突固定集通过率 | 已知近义反例失败 | 100% | 中文 candidate/unknown/none 参数化测试 |
| Current knowledge 统计准确率 | 非 archived 代理口径 | 100% 与 resolver state 一致 | topic recommendation fixture |
| Stale annotation 可见率 | 已知反例 0% | 100% | Metrics invalidProjections fixture |
| 全量回归 | 90 文件、1029 测试通过 | lint/build/全量测试持续通过 | CI 命令结果 |

## 范围边界

- **做**: 修复上述 5 个 code review finding；增加路径 containment 与历史证据状态；复用本地归一化能力改进中文冲突；使用知识 resolver 计算 current count 和失效 annotation；补充正反及 legacy 测试。
- **不做**:
  - 不引入远程模型、embedding、向量数据库、MCP 或外部分词服务。
  - 不自动创建、合并或重命名 topic，不自动改变 validity、Decision 或 relations。
  - 不把 conflict candidate 提升为自动阻断或自动裁决。
  - 不执行存量 annotation、路径或 topic 的批量写迁移。
- **推迟**: Git 历史级文件追踪、跨仓库路径历史、模型驱动语义冲突、语言学级中文分词。

## 设计原则

1. **歧义保持歧义** - ambiguous 必须由用户选择。违反判断: 系统仍把 inferred token 写入后续 topic 路由。
2. **路径先 containment 后存在性** - 只验证项目根内规范化路径。违反判断: 任一根外路径被标记 current。
3. **Historical 必须有证据** - 不存在不等于历史存在。违反判断: 仅凭反引号或代码块就标记 historical。
4. **语言无关的约束极性** - 中文和英文共享对象/动作/否定判断契约。违反判断: 等价中文冲突无候选而英文有候选。
5. **指标来自 resolver 事实** - 名称为 current/invalid 的指标必须使用相同解析器语义。违反判断: 用生命周期状态或语法解析代替知识状态/来源校验。
6. **修复不扩大自动权力** - 所有输出仍为候选或只读投影。违反判断: 修复路径自动写状态、topic 或关系。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Topic 歧义、路径 containment 与历史证据修复 | 已实施 operational closure | P1 |
| Phase 2 | 中文冲突与 resolver-backed 指标修复 | Phase 1 | P1 |
| Phase 3 | 全量兼容验证与真实请求 smoke | Phase 2 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Topic and module-path trust fixes | Phase 1 | 1 |
| Multilingual conflict and knowledge-metric correctness | Phase 2-3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 中文轻量归一化仍可能误报 | candidate 噪声 | 保留 candidate/unknown、证据与置信度，不自动阻断 |
| Historical 证据来源不足 | 更多路径降级 unknown | unknown 优于伪 historical，未来再接 Git 历史 |
| ambiguous 不自动选题增加一步交互 | 工作流略慢 | 输出稳定候选、理由和明确选择命令 |
| resolver 计算增加读取成本 | Brief/Metrics 延迟上升 | 复用 ProjectSnapshot 与 registry，避免逐项重扫 |

## 关联

- based_on: `spec-knowledge-operational-closure-L1`
- references: `spec-knowledge-activation-hardening-L1`
- references: `spec-knowledge-governance-L1`
- references: `critical-ac-readiness-L1`
