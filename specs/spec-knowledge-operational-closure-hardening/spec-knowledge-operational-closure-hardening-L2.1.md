---
code: spec-knowledge-operational-closure-hardening-L2.1
level: L2
title: Topic Selection and Module Path Trust
topic: spec-knowledge-operational-closure-hardening
parentCode: spec-knowledge-operational-closure-hardening-L1
status: implemented
aiSummary: >-
  设计 topic recommendation 与 selected topic 分离的选择门、项目根 containment 和基于来源知识状态的
  historical 路径证据，ambiguous/create-new 不再隐式采用 inferred token。
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-hardening-L1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.2
created: '2026-07-16T12:20:33.135Z'
updated: '2026-07-17T02:02:17.560Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-hardening-L1'
    - 'spec:spec-knowledge-operational-closure-L3.2.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-hardening-L1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.1'
      action: change
      reason: >-
        Require root containment and evidence-backed historical path states
        instead of syntax-only classification.
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.2'
      action: change
      reason: >-
        Separate ambiguous recommendation from selected topic and prevent
        inferred-token fallback.
  reviewedAt: '2026-07-16T12:23:25.193Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-operational-closure-hardening-L3.1.1
      title: Topic Selection and Path Containment
      required: true
  leaf: false
  updatedAt: '2026-07-17T00:51:36.584Z'
---
# Topic Selection and Module Path Trust - 技术设计

## 方案概述

本设计覆盖 `spec-knowledge-operational-closure-hardening-L1` 的 AC-1、AC-2、AC-3 与 AC-7。方案把 topic recommendation 与 selected topic 分成两个状态：candidate 允许选择首位 canonical topic，ambiguous 保持未选择并要求显式用户动作，create-new 只表达可创建而不隐式采用 inferred token。

模块路径采用“语法规范化 → containment → 存在性 → 历史证据”的顺序。只有规范化后仍位于项目根内的路径才允许访问文件系统；当前存在则为 current-path，当前不存在时仅在来源知识为 historical/superseded/invalidated 或存在显式历史证据时为 historical-path，其余统一 unknown-path。

```text
Request -> Retrieval -> TopicRecommendation -> Selection Gate -> Workflow
Spec text -> Path syntax -> Root containment -> Exists? -> History evidence -> PathState
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| ambiguous 后续 topic | A: inferred token；B: null + selection gate | B | 避免系统用偶然 token 替用户决策 |
| create-new 表达 | A: 直接选 inferred；B: 显式 action | B | create-new 是选择权，不是已选择结果 |
| 路径安全 | A: resolve 后 exists；B: containment 后 exists | B | 禁止探测项目根外路径 |
| historical 依据 | A: inline/code-block；B: 来源状态或显式证据 | B | “结构化出现”不能证明历史存在 |
| 根外路径状态 | A: unknown-path；B: rejected/unknown 并公开 reason | B | 保留候选可解释性但禁止 exists 检查 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/knowledge-activation.ts` | 修改 | topic selection、路径规范化与证据判定 | 单元测试 |
| `src/core/capability-types.ts` | 修改 | selected topic、selection reason、path reason schema | 类型与兼容测试 |
| `src/core/capability-brief.ts` | 修改 | 未选择 topic 与模块约束投影 | Brief 集成测试 |
| `src/core/workflow-surface.ts` | 修改 | topic selection gate 与下一步 | Workflow 测试 |
| `src/cli/usability.ts`、`src/cli/brief-presenter.ts` | 修改 | human/JSON 候选选择提示 | CLI 测试 |
| `src/core/__tests__/knowledge-activation.test.ts` | 修改 | ambiguous、traversal、proposed/historical fixtures | 正反测试 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| KnowledgeActivationProjection | selectedTopic | string/null | 新增 | null | 是 |
| TopicRecommendation | selection | candidate/ambiguous/create-new | 保留并强化语义 | create-new | 是 |
| TopicRecommendation | selectionRequired | boolean | 新增 | false | 是 |
| ModuleConstraint | pathState | current/historical/unknown | 语义收紧 | unknown | 是 |
| ModuleConstraint | pathReason | string | 新增 | unknown | 是 |
| ModuleConstraint | contained | boolean | 新增 | false | 是 |

## 接口契约

### Topic selection projection

```ts
interface TopicSelectionProjection {
  inferredTopic: string | null;
  recommendation: TopicRecommendation;
  selectedTopic: string | null;
  selectionRequired: boolean;
}
```

- explicit topic 始终成为 selectedTopic。
- recommendation=candidate 时首位 canonical topic 可成为 selectedTopic。
- ambiguous 时 selectedTopic 必须为 null，selectionRequired=true。
- create-new 时 selectedTopic 必须为 null，直到调用方显式选择新 topic。

### Path trust projection

```ts
interface PathTrustProjection {
  path: string;
  contained: boolean;
  pathState: "current-path" | "historical-path" | "unknown-path";
  reasonCode: "current-exists" | "historical-source" | "outside-root" | "missing-no-history" | "invalid-path";
}
```

路径解析不得在 `contained=false` 时调用 exists/read/stat。符号链接解析后的 real path 若越出项目根，同样不得成为 current-path。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| ambiguous 无用户选择 | 无法进入 topic flow | 返回 selectionRequired 和候选命令 | 用户显式选择 |
| 路径含 traversal | 不检查存在性 | unknown-path/outside-root | 修正规范路径 |
| 当前路径不存在 | 无法确认状态 | 无历史证据为 unknown | 补充历史来源 |
| 历史来源解析失败 | historical 不可信 | unknown-path | 修复 knowledge source |

## 向后兼容

- **API**: 保留 inferredTopic、suggestedTopic 和 recommendation 字段；suggestedTopic 在未选择时返回 null。
- **数据**: 不迁移 Spec 内容，不写路径状态。
- **CLI**: JSON 只新增字段；human 输出在需要选择时增加候选，不自动执行。

## 关键交互流程

```text
新请求 -> 召回 topics -> candidate? -> selectedTopic -> flow
                    -> ambiguous -> null -> 用户选择
模块文本 -> normalize -> contained? no -> unknown/outside-root
                           yes -> exists? yes -> current
                                      no -> historical evidence? yes historical : unknown
```

## 可观测性

- **日志**: 不新增持久日志；projection 输出 reasonCode。
- **指标**: ambiguous selectionRequired 数、outside-root 数、unknown-path 数。
- **告警**: 不自动告警，Brief finding 对根外路径给 warning。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Retrieval | `src/core/retrieval/index.ts` | `executeRetrieval` | canonical topic 候选 |
| Knowledge resolver | `src/core/knowledge.ts` | `resolveKnowledge` | 来源历史状态证据 |
| Project paths | `src/core/paths.ts` | `ProjectPaths` | 项目根边界 |
| Workflow projection | `src/core/workflow-surface.ts` | `buildWorkflowNextProjection` | selection gate 消费者 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `spec-knowledge-operational-closure-hardening-L3.1.1` | topic selection state、路径 containment、历史证据与 CLI/测试 | 无 |

## 关联

- based_on: `spec-knowledge-operational-closure-hardening-L1`
- references: `spec-knowledge-operational-closure-L3.2.1`
- references: `spec-knowledge-operational-closure-L3.2.2`
