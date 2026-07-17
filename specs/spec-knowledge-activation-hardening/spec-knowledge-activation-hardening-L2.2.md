---
code: spec-knowledge-activation-hardening-L2.2
level: L2
title: Governance Adoption Review Integrity and Migration Metrics
topic: spec-knowledge-activation-hardening
parentCode: spec-knowledge-activation-hardening-L1
status: implemented
aiSummary: >-
  设计项目知识治理 adoption baseline：新 L1/L2 强制 history/scope，新 L3 显式 learning
  策略；Delivery Knowledge approve 重新验证来源，metrics v2 补齐覆盖率与
  invalidProjections，并提供零写入历史迁移预览。
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L1
  - type: references
    target: spec-knowledge-governance-L2.1
  - type: references
    target: spec-knowledge-governance-L2.2
  - type: references
    target: adaptive-profile-intelligence-L2.1
created: '2026-07-16T08:05:05.438Z'
updated: '2026-07-16T09:11:57.028Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-activation-hardening-L1'
    - 'spec:spec-knowledge-governance-L2.1'
    - 'spec:spec-knowledge-governance-L2.2'
    - 'spec:adaptive-profile-intelligence-L2.1'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-governance-L2.1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-governance-L2.2'
      action: change
      reason: >-
        Complete the designed approve revalidation and governance metrics
        coverage that the implemented slice only partially delivered.
    - sourceRef: 'spec:adaptive-profile-intelligence-L2.1'
      action: reuse
  reviewedAt: '2026-07-16T08:06:04.143Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-activation-hardening-L3.2.1
      title: Governance Adoption Gates
      required: true
    - code: spec-knowledge-activation-hardening-L3.2.2
      title: Review Revalidation Metrics and Migration Preview
      required: true
  leaf: false
  updatedAt: '2026-07-16T08:15:23.514Z'
---
# Governance Adoption, Review Integrity, and Migration Metrics - 技术设计

## 方案概述

本设计承接 `spec-knowledge-activation-hardening-L1` 的 AC-2、AC-3、AC-4、AC-5、AC-7、AC-8 与 AC-9。方案在既有可选 schema 之上增加“治理策略声明”，以项目 adoption baseline 区分新资产与 legacy：启用后的新 L1/L2 在 confirmed 前必须完成 historyReview，并在生命周期完成前具有 scopePlan；新 L3 在 frozen 前必须显式声明 delivery learning 为 enabled 或 disabled-with-reason。Delivery Knowledge approve 复用声明阶段校验器重新验证 Task、evidence 和 AC。治理指标扩展为容错聚合，并提供只读 migration preview，不自动写入历史结论。

```text
[project adoption policy + activation baseline]
       |                 |                  |
       v                 v                  v
 [L1/L2 confirm]    [L3 freeze]       [legacy assets]
 history required   learning choice    preview only
 scope declared     reason if off      no writes
       |                 |
       +---------> [Task + Delivery Knowledge]
                            |
                    approve revalidation
                            |
                            v
                 [metrics + approved retrieval]
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 新旧资产边界 | A: 所有缺字段资产立即阻断；B: 项目 adoption baseline；C: 按当前日期硬编码 | B | 可审计、可配置，并避免历史资产升级后失效 |
| history 默认治理 | A: 继续完全可选；B: baseline 后 confirmed 强制；C: 自动写 reuse | B | 新流程达到 100% 覆盖，同时保留人工判断 |
| scope 声明时机 | A: 创建时强制 fixed；B: 允许 open，完成前必须收敛；C: 从子级反推 | B | 允许设计渐进展开，但不允许提前完成 |
| learning 表达 | A: boolean；B: enabled/disabled + reason；C: 全部强制 enabled | B | 明确例外，避免 false 同时表示“未考虑”和“不适用” |
| approve 校验 | A: 信任 draft；B: 复用统一来源校验器；C: 复制声明逻辑 | B | 防止校验漂移，并保证失败时事务保持 draft |
| metrics 错误处理 | A: 任一错误整份失败；B: invalidProjections 隔离；C: 静默跳过 | B | 保留可用指标且暴露数据问题，沿用现有 profile metrics 模式 |
| 历史迁移 | A: 自动写状态；B: 只读候选批次；C: 不提供工具 | B | 提升治理效率但不把相关性误当有效性 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/schemas/spec.ts` | 修改 | governance adoption metadata、learning policy 兼容解析 | schema、legacy、enabled/disabled reason 测试 |
| `src/core/spec-policy.ts` | 修改 | baseline 后 L1/L2 confirm 和 L3 freeze 门禁 | 新旧资产、empty history、learning choice 反向测试 |
| `src/cli/spec-handlers.ts` | 修改 | transition 前统一治理校验 | CLI 错误码与状态不变测试 |
| `src/core/lifecycle.ts` | 修改 | 新资产 scopePlan 必需，legacy 保持旧行为 | open/missing/incomplete/legacy cascade 测试 |
| `src/core/delivery-knowledge.ts` | 修改 | 抽取统一来源校验并在 approve 复验 | evidence 删除/失败、AC 漂移、事务回滚测试 |
| `src/core/task-completion.ts` | 修改 | 消费显式 learning policy | enabled/disabled/legacy 门禁测试 |
| `src/core/knowledge-metrics.ts` | 修改 | 完整覆盖率、topic 过滤、invalid projections | project/topic、空项目、损坏来源测试 |
| `src/core/knowledge-migration.ts` | 新增 | 只读候选排序和批次预览 | 零写入、稳定排序、limit/topic 测试 |
| `src/cli/project.ts` | 修改 | metrics v2 与 migration preview 命令 | JSON/text、store-aware、只读测试 |
| `src/core/profile-metrics.ts` | 复用 | invalid projection 与 evidence 聚合模式 | 兼容回归 |

## 数据模型

### Project adoption policy

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| ProjectConfig | knowledgeGovernance | object? | 新增 | undefined | 是 |
| KnowledgeGovernance | enabledAt | ISO datetime | 新增 | 启用时写入 | 是 |
| KnowledgeGovernance | requireHistoryReview | boolean | 新增 | true | 是 |
| KnowledgeGovernance | requireScopePlan | boolean | 新增 | true | 是 |
| KnowledgeGovernance | requireLearningPolicy | boolean | 新增 | true | 是 |

缺少 policy 的项目保持 legacy 行为。policy 不追溯修改 enabledAt 前创建的资产；显式采用治理字段的 legacy 资产仍执行对应字段现有校验。

### L3 learning policy

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| SpecFrontmatter | deliveryLearning | boolean? | 保留兼容 | undefined | 是 |
| SpecFrontmatter | deliveryLearningReason | string? | 新增 | undefined | 是 |

`true` 表示 enabled；`false` 必须有 reason；undefined 对 baseline 前资产表示 legacy，对 baseline 后 L3 表示门禁不完整。

### Knowledge metrics v2

| 字段 | 类型 | 含义 |
|---|---|---|
| validity | counts + coverage | topic 正确过滤后的显式/推导/unknown 状态 |
| dispositions | counts + coverage | 已处置来源/全部附加来源 |
| scope | ready/blocked/legacy + coverage | L1/L2 范围采用率 |
| delivery | states + declaration/approval coverage | eligible Task 的结论覆盖 |
| retrieval | package/approved coverage | 召回和 approved 知识进入约束包比例 |
| evidence | critical AC coverage | 关键 AC 的成功 verification 覆盖 |
| invalidProjections | item[] | 单项解析错误，不中断其他聚合 |

## 接口契约

### Project governance adoption

提供 preview 与 enable 两步接口。preview 只显示将受约束的新资产规则和历史资产数量；enable 是显式人工写操作，记录 enabledAt，不迁移历史记录。

### L1/L2 confirm gate

baseline 后的新 L1/L2 缺少 historyReview 时返回 `HISTORY_REVIEW_REQUIRED`。有来源但处置不完整沿用 `HISTORY_REVIEW_INCOMPLETE`。scopePlan 可以为 open，但必须存在；缺少时返回 `SCOPE_PLAN_REQUIRED`。

### L3 freeze gate

baseline 后的新 L3 缺少 deliveryLearning 时返回 `DELIVERY_LEARNING_POLICY_REQUIRED`；显式 false 缺 reason 返回 `DELIVERY_LEARNING_REASON_REQUIRED`。true 时 Task completion 继续使用现有 declaration gate。

### Delivery Knowledge review

approve 前必须在同一事务中重新读取 Spec 和 Task，校验 Task 归属、每个 evidence 仍存在且成功、每个 affected AC 仍存在。失败返回既有稳定错误码并保持 status=draft；reject 不要求有效来源，但仍要求 reason。

### `spec-manager project knowledge metrics [--topic <topic>] [--json]`

保持命令路径，schemaVersion 升级并保留 v1 顶层计数字段。topic 过滤必须同时作用于 Spec、annotation、Decision、Task、Delivery Knowledge 和 evidence。

### `spec-manager project knowledge migration preview [--topic <topic>] [--limit <n>] [--json]`

输出候选 sourceRef、当前解析状态、活跃度/关系/风险得分、缺失治理项、建议人工命令和分批标识。命令不得创建或修改 knowledge registry、Spec、Decision、Task、audit 或 config。

### 错误契约

| 错误码 | 触发条件 |
|---|---|
| `HISTORY_REVIEW_REQUIRED` | baseline 后 L1/L2 缺 historyReview |
| `SCOPE_PLAN_REQUIRED` | baseline 后 L1/L2 缺 scopePlan |
| `DELIVERY_LEARNING_POLICY_REQUIRED` | baseline 后 L3 未选择 learning 策略 |
| `DELIVERY_LEARNING_REASON_REQUIRED` | 显式禁用但缺少理由 |
| `DELIVERY_EVIDENCE_NOT_FOUND` | approve 时 evidence 不存在或不归属 Task |
| `DELIVERY_EVIDENCE_NOT_SUCCESSFUL` | approve 时 evidence 已失败 |
| `DELIVERY_AC_NOT_FOUND` | approve 时 affected AC 已漂移 |
| `KNOWLEDGE_METRIC_PROJECTION_INVALID` | 单项进入 invalidProjections，不使整份报告失败 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| 项目未启用 adoption | 新资产仍可漏填 | metrics 报告 disabled，不暗中启用 | 人工 preview 后 enable |
| 历史 Spec 无治理字段 | 无法判断有效性 | 标为 legacy/unknown，不阻断读取 | migration preview 分批治理 |
| annotation 无法解析 topic | topic 指标可能失真 | 进入 invalidProjections，不计入分母 | 修复 canonical source |
| approve 来源漂移 | draft 不能发布 | 保持 draft 并返回具体来源错误 | 修复声明或重新生成 draft |
| 单个 Task evidence 损坏 | evidence 覆盖不完整 | 隔离该投影，继续其他聚合 | 修复 Task JSON |
| migration 候选过多 | 人工负担大 | limit + 稳定批次 + topic 过滤 | 分批执行并重跑 |

## 向后兼容

- **Project**: 未配置 knowledgeGovernance 的项目保持现有行为。
- **Spec**: 旧 boolean deliveryLearning 可读；新增 reason 为可选字段。
- **Transition**: 门禁仅约束 enabledAt 后创建的新资产，legacy 不批量失败。
- **Metrics**: v1 顶层计数保留，新增 coverage 和 invalidProjections。
- **Migration**: preview 纯只读，不自动写 config、registry、Spec、Decision 或 Task。
- **Store**: 所有读取和显式写入继续遵循 resolved writeRoot，contextSources 只读。

## 关键交互流程

```text
project knowledge adoption preview
  -> human enable
  -> create L1/L2
       -> attach/set history + set scope
       -> confirm gate passes
  -> create L3
       -> choose learning true/false + reason
       -> freeze gate passes
  -> Task evidence + delivery declaration
       -> complete
       -> human approve
            -> revalidate sources
            -> approved or remain draft
```

```text
knowledge migration preview
  -> read snapshot/registry/metrics
  -> rank candidates
  -> emit batches and suggested commands
  -> zero writes
  -> human applies selected annotations/relations separately
```

## 可观测性

- **审计**: adoption enable、治理字段声明和 review 状态变化记录摘要；preview/metrics 不写审计。
- **指标**: 所有覆盖率同时给出 numerator、denominator 和 ratio，避免只有百分比无法解释。
- **告警**: invalidProjections 保留 sourceRef、阶段和稳定错误，不包含正文。
- **采用状态**: 报告显示 disabled/enabledAt、new governed、legacy 和 explicit override 数量。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Spec schema | `src/schemas/spec.ts` | `HistoryReviewSchema`、`ScopePlanSchema`、`SpecFrontmatterSchema` | 扩展 learning reason 并保持 legacy 解析 |
| Spec 策略 | `src/core/spec-policy.ts` | `validateHistoryReviewForConfirmation`、`applySpecUpdatePolicy` | 组合 baseline 后 transition 门禁 |
| 生命周期 | `src/core/lifecycle.ts` | `assessImplementationReadiness` | 强制新 L1/L2 scope 完整性 |
| Delivery Knowledge | `src/core/delivery-knowledge.ts` | `declareDeliveryKnowledge`、`reviewDeliveryKnowledge` | 抽取并复用来源校验 |
| Task completion | `src/core/task-completion.ts` | `runDeliveryKnowledgeGate` | 消费显式 learning 策略 |
| Scope readiness | `src/core/scope-readiness.ts` | `buildScopeReadinessReport` | 提供采用率和 blocker 输入 |
| Evidence | `src/core/task-evidence.ts` | `buildTaskEvidence`、`evaluateEvidenceCoverage` | 聚合关键 AC evidence 覆盖 |
| Profile metrics | `src/core/profile-metrics.ts` | `buildProfileMetrics` | 复用 invalidProjections 和 topic 聚合模式 |
| Knowledge registry | `src/core/knowledge.ts` | `parseKnowledgeSourceRef`、`resolveKnowledge` | topic 解析和有效性计数 |
| Project snapshot | `src/core/project-snapshot.ts` | `buildProjectSnapshot` | 只读迁移候选与指标快照 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| spec-knowledge-activation-hardening-L3.2.1-adoption | Project adoption policy、L1/L2 confirm、L3 freeze 与 scope/learning 门禁 | 本 L2 confirmed |
| spec-knowledge-activation-hardening-L3.2.2-review-metrics | Delivery approve 复验、metrics v2、migration preview 与兼容测试 | L3.2.1 implemented |

## 关联

- parent: `spec-knowledge-activation-hardening-L1` - 本 L2 落地默认治理、审批可信度和渐进迁移。
- references: `spec-knowledge-governance-L2.1` - 复用 historyReview 与有效性契约。
- references: `spec-knowledge-governance-L2.2` - 补齐 scope、delivery 和 metrics 已定义但未闭环的契约。
- references: `adaptive-profile-intelligence-L2.1` - 复用指标容错和 adoption preview 模式。
