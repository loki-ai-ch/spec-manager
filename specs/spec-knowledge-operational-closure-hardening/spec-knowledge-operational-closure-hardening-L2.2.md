---
code: spec-knowledge-operational-closure-hardening-L2.2
level: L2
title: Multilingual Conflict and Resolver Metrics Correctness
topic: spec-knowledge-operational-closure-hardening
parentCode: spec-knowledge-operational-closure-hardening-L1
status: implemented
aiSummary: >-
  设计本地确定性的中文约束 normalization、对象重叠与极性判断，并以共享 resolver/snapshot 修正
  currentKnowledgeCount 和 stale annotation invalidProjections。
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-hardening-L1
  - type: references
    target: spec-knowledge-operational-closure-L3.1.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.2
created: '2026-07-16T12:20:33.343Z'
updated: '2026-07-17T02:10:53.517Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-hardening-L1'
    - 'spec:spec-knowledge-operational-closure-L3.1.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-hardening-L1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.1.1'
      action: change
      reason: >-
        Validate all annotation sources instead of parse-only handling for
        non-eligible records.
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.1'
      action: change
      reason: >-
        Add deterministic CJK overlap and polarity signals while retaining
        explainable candidate semantics.
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.2'
      action: change
      reason: >-
        Count resolver current state rather than non-archived lifecycle state in
        topic strength.
  reviewedAt: '2026-07-16T12:23:26.555Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-operational-closure-hardening-L3.2.1
      title: Multilingual Conflict and Resolver Metrics
      required: true
  leaf: false
  updatedAt: '2026-07-17T00:51:36.782Z'
---
# Multilingual Conflict and Resolver Metrics Correctness - 技术设计

## 方案概述

本设计覆盖 `spec-knowledge-operational-closure-hardening-L1` 的 AC-4、AC-5、AC-6 与 AC-7。中文冲突检测复用 retrieval normalization 的语言无关基础，再增加本地、确定性的 CJK 字符 n-gram 与动作/否定规范化，使“禁止自动批准知识”和“系统不得自动批准知识记录”能共享对象信号，同时用对象重叠、极性相反和最小证据阈值控制误报。

Topic 历史强度与 Metrics invalid projection 统一使用 Knowledge resolver 事实。推荐器在同一个 ProjectSnapshot/registry 上解析每个 Spec，只有 state=current 才进入 currentKnowledgeCount。Metrics 对 registry 全部 annotation 执行语法加来源校验；格式合法但来源失效的记录进入 invalidProjections，包括无法归属 topic 的 unscoped invalid 项。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 中文匹配 | A: 完整连续串；B: 本地 normalization + CJK n-gram | B | 支持部分重叠且不引入外部依赖 |
| 冲突成立条件 | A: 任一重叠；B: 对象阈值 + 极性相反 | B | 降低中文 n-gram 误报 |
| current 计数 | A: lifecycle proxy；B: resolveKnowledge state | B | 指标名称与知识事实一致 |
| stale annotation | A: parse-only；B: validate source | B | 合法格式不代表来源存在 |
| topic 无法归属的 invalid | A: 丢弃；B: unscoped 仍报告 | B | 未知优于静默遗漏 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/capability-brief.ts` | 修改 | 多语言 terms、极性与 conflict candidate | 参数化测试 |
| `src/core/retrieval/normalization.ts` | 修改/复用 | CJK normalization/n-gram helper | 单元测试 |
| `src/core/knowledge-activation.ts` | 修改 | resolver-backed topic strength | 推荐测试 |
| `src/core/knowledge-metrics.ts` | 修改 | annotation source validation | Metrics 测试 |
| `src/core/knowledge.ts` | 复用/小改 | snapshot-aware validate/resolve | resolver 测试 |
| `src/core/__tests__/capability-brief.test.ts` | 修改 | 中文 candidate/unknown/none | 集成测试 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| ConflictCandidate | matchedTerms | string[] | 新增 | [] | 是 |
| ConflictCandidate | polarity | request/historical | 新增 | unknown | 是 |
| CanonicalTopicCandidate | currentKnowledgeCount | number | 语义修正 | 0 | 是 |
| InvalidProjection | scope | topic/unscoped | 新增 | unscoped | 是 |
| InvalidProjection | error | string | 保留并稳定错误码 | - | 是 |

## 接口契约

### Multilingual conflict signal

```ts
interface ConflictSignal {
  objectTerms: string[];
  requestPolarity: "positive" | "negative" | "unknown";
  historicalPolarity: "positive" | "negative" | "unknown";
  verdict: "candidate" | "unknown" | "none";
  reasonCodes: string[];
}
```

- candidate 要求对象信号达到阈值且双方极性相反。
- 只有弱对象信号时为 unknown，不得升级 candidate。
- 无对象重叠或极性一致时为 none。
- 输出 matchedTerms 必须来自可展示的规范化信号。

### Resolver-backed topic stats

```ts
interface TopicKnowledgeStats {
  current: number;
  unknown: number;
  historical: number;
  superseded: number;
  invalidated: number;
  invalidProjections: Array<{ sourceRef: string; error: string }>;
}
```

各状态互斥；currentKnowledgeCount 等于 stats.current，不能从 Spec lifecycle 推导。

### Annotation validation

Metrics 必须遍历 registry annotations，并用共享 snapshot 验证 canonical source。来源不存在、AC 已删除、Task 不存在或 approved lesson 漂移均进入 invalidProjections。topic 无法确定时 scope=unscoped，并在 project 和 topic 报告中可见。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| 中文对象信号不足 | 无法确认冲突 | unknown 或 none | 人工审核 |
| 单项 resolver 失败 | topic 统计不完整 | 记录 invalidProjection，继续其余项 | 修复来源 |
| registry 整体损坏 | 无法可靠统计 | 保持现有显式错误/Brief warning | 修复 registry |
| legacy 英文请求 | 不需要 CJK | 保留现有 token 行为 | 无 |

## 向后兼容

- **API**: 保留现有 ConflictCandidate、CanonicalTopicCandidate 与 Metrics v2 字段，只增加解释字段并修正语义。
- **数据**: 不改 annotation schema，不自动删除 stale annotation。
- **迁移**: Migration Preview 可消费 invalidProjections，但本轮不执行写迁移。

## 关键交互流程

```text
Request/AC -> normalize -> CJK n-gram/word terms -> object overlap -> polarity -> verdict
Topic specs -> shared snapshot/registry -> resolve each -> state counts -> recommendation
Annotations -> parse -> validate source -> valid state | invalidProjection
```

## 可观测性

- **日志**: candidate reasonCodes 与 matchedTerms。
- **指标**: 中文 fixture candidate/unknown/none 分布、unscoped invalid 数。
- **告警**: invalidProjections 继续作为只读报告，不自动修改 registry。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Normalizer | `src/core/retrieval/normalization.ts` | normalization helpers | 英中统一基础 |
| Knowledge resolver | `src/core/knowledge.ts` | `resolveKnowledge` | current state 统计 |
| Source validator | `src/core/knowledge.ts` | `validateKnowledgeSource` | stale annotation 检测 |
| Snapshot | `src/core/project-snapshot.ts` | `buildProjectSnapshot` | 避免重复扫描 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `spec-knowledge-operational-closure-hardening-L3.2.1` | 中文 conflict normalization、resolver topic stats、stale annotation projection 与回归 | `spec-knowledge-operational-closure-hardening-L3.1.1` implemented |

## 关联

- based_on: `spec-knowledge-operational-closure-hardening-L1`
- references: `spec-knowledge-operational-closure-L3.1.1`
- references: `spec-knowledge-operational-closure-L3.2.1`
- references: `spec-knowledge-operational-closure-L3.2.2`
