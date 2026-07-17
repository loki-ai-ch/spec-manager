---
code: spec-knowledge-activation-hardening-L2.1
level: L2
title: Knowledge Activation Routing and Constraint Package
topic: spec-knowledge-activation-hardening
parentCode: spec-knowledge-activation-hardening-L1
status: implemented
aiSummary: >-
  设计共享 Knowledge Activation Projection，让 Brief、Next 与 Guide 消费同一跨 topic
  历史判断；增量输出含 Spec、Decision、关键 AC、Lessons、代码模块、冲突、来源与置信度的约束包，并保持 agent-brief.v1
  与显式 topic 兼容。
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L1
  - type: references
    target: spec-knowledge-loop-L2.1
  - type: references
    target: spec-knowledge-governance-L2.1
created: '2026-07-16T08:05:05.034Z'
updated: '2026-07-16T08:36:21.711Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-activation-hardening-L1'
    - 'spec:spec-knowledge-loop-L2.1'
    - 'spec:spec-knowledge-governance-L2.1'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-loop-L2.1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-governance-L2.1'
      action: reuse
  reviewedAt: '2026-07-16T08:06:03.944Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-activation-hardening-L3.1.1
      title: Shared Activation Routing
      required: true
    - code: spec-knowledge-activation-hardening-L3.1.2
      title: Constraint Package Projection
      required: true
  leaf: false
  updatedAt: '2026-07-16T08:15:23.292Z'
---
# Knowledge Activation Routing and Constraint Package - 技术设计

## 方案概述

本设计承接 `spec-knowledge-activation-hardening-L1` 的 AC-1、AC-6 与 AC-9。核心方案是新增共享的 Knowledge Activation Projection：一次执行跨 topic 检索并生成可复用的历史判断，Agent Brief 和 workflow next 共同消费该投影，不再分别以“相关历史”和“精确 topic 是否存在”作出互相矛盾的判断。在现有 `agent-brief.v1` 上增量增加 constraintPackage，保留原数组、topic 和 nextCommand 兼容字段。

```text
[request + optional explicit topic]
              |
              v
[shared activation projection]
  retrieval + knowledge validity + source refs
       |                         |
       v                         v
[Agent Brief]             [Workflow Next]
       |                         |
       +------ same history -----+
              |
              v
[constraint package: specs, decisions, AC, lessons, modules, conflicts]
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| Brief 与 Next 一致性 | A: 两边继续独立检索；B: 共享激活投影；C: Next 直接解析 Brief JSON | B | 共享领域投影避免 CLI 间接依赖，并让 Core API 与 CLI 获得相同行为 |
| inferred topic 语义 | A: 等同显式 topic；B: 只作为建议标签；C: 完全删除 | B | inferred topic 不足以排除跨 topic 历史，但仍可用于新 topic 命名建议 |
| 正文召回 | A: 全文全部进入评分；B: 提取受控章节信号；C: 仅 aiSummary | B | 兼顾召回质量、性能和小上下文，避免长正文支配评分 |
| 代码影响面 | A: 扫描整个代码仓库；B: 从规格路径、复用清单、Task 产物提取；C: 不提供 | B | 使用已有本地证据，保持确定性且不引入昂贵全仓语义分析 |
| 冲突判断 | A: 自动裁决；B: 基于状态和处置生成 candidate/unknown；C: 不显示 | B | 相关性不等于冲突，缺少人工证据时必须保留 unknown |
| 输出版本 | A: 发布 agent-brief.v2；B: v1 增量可选字段；C: 替换旧字段 | B | 保持现有脚本和兼容测试，不要求调用方同步迁移 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/knowledge-activation.ts` | 新增 | 共享 activation projection、历史存在性和建议动作 | 单元测试：显式/推断 topic、无结果、跨 topic 结果 |
| `src/core/retrieval/` | 修改 | 支持受控正文信号、模块信号及字段解释 | scoring、排序、diversity、relation expansion 回归 |
| `src/core/capability-brief.ts` | 修改 | 消费共享投影并组装 constraintPackage | Brief 契约、上限、unknown 和只读测试 |
| `src/core/capability-types.ts` | 修改 | 增量定义 activation 与 constraint package 类型 | 类型与 compatibility 测试 |
| `src/core/workflow-surface.ts` | 修改 | 在 inferred topic 无精确 Spec 时消费相关历史判断 | “召回成功但 needs_l1”反向回归 |
| `src/core/guided-assist.ts` | 修改 | 使用一致的 history-aware 下一步 | brief/flow 路由集成测试 |
| `src/core/project-snapshot.ts` | 复用/修改 | 一次快照提供 Spec、Decision、Task 与关系索引 | topic/project 范围和确定性测试 |
| `src/cli/brief-presenter.ts` | 修改 | 文本展示约束包摘要与 unknown | 文本快照和 JSON 不变性测试 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| ActivationProjection | request/topic/retrieval | object | 新增 | 必填 | 是 |
| ActivationProjection | hasRelatedHistory | boolean | 新增 | false | 是 |
| ActivationProjection | suggestedTopic | string/null | 新增 | null | 是 |
| ActivationProjection | candidates | ActivationCandidate[] | 新增 | `[]` | 是 |
| AgentBrief | constraintPackage | ConstraintPackage? | 新增 | undefined | 是 |
| ConstraintPackage | specs | source ref[] | 新增 | `[]`，上限 5 | 是 |
| ConstraintPackage | decisions | constraint[] | 新增 | `[]` | 是 |
| ConstraintPackage | acceptanceCriteria | constraint[] | 新增 | `[]` | 是 |
| ConstraintPackage | lessons | constraint[] | 新增 | `[]` | 是 |
| ConstraintPackage | codeModules | module ref[] | 新增 | `[]` | 是 |
| ConstraintPackage | conflicts | conflict[] | 新增 | `[]` | 是 |
| Constraint item | confidence/knowledge/sourceRefs | object | 新增 | unknown + refs | 是 |

约束项必须保留 canonical sourceRef。没有证据的维度返回 `state: unknown` 和空 items，不得通过猜测补全。

## 接口契约

### Shared activation projection

请求包含 project paths、request 和可选 explicitTopic。响应必须包含 inferredTopic、retrieval scope、候选数量、相关历史布尔值、候选及可解释匹配原因。

当 explicitTopic 存在时保持现有 topic scope；当只有 inferredTopic 时执行 project scope，inferredTopic 仅作为 suggestedTopic，不作为过滤器。

### `spec-manager brief <request> [--topic <topic>] --json`

保留 `agent-brief.v1` 现有字段，新增可选：

```json
{
  "constraintPackage": {
    "specs": [],
    "decisions": [],
    "acceptanceCriteria": [],
    "lessons": [],
    "codeModules": [],
    "conflicts": [],
    "unknownDimensions": []
  }
}
```

### `spec-manager next <request> --json`

若 inferred topic 没有精确 Spec 但 activation 有相关历史，状态仍可表达 `needs_l1`，但 blockingReason 必须说明“没有精确 topic 规格但存在相关历史”，nextAction 必须先要求复核/继承相关来源，再提供创建新 L1 的命令。不得输出绝对的“No specs found”而忽略检索事实。

### 错误与 finding

| 标识 | 触发条件 | 行为 |
|---|---|---|
| `activation.history.related` | 跨 topic 存在相关候选 | advisory，提供来源和下一步 |
| `activation.dimension.unknown` | 约束包维度无可靠证据 | advisory，不阻断 |
| `activation.source.invalid` | 候选来源无法解析 | warning，加入 invalid source，不丢弃其他结果 |
| `activation.conflict.candidate` | current 约束与新请求出现可解释冲突信号 | warning，要求人工判断，不自动 reject |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| Knowledge registry 损坏 | 无法投影有效性 | 候选保留，状态统一 unknown，并输出 warning | 修复注册表后重跑 |
| 正文信号解析失败 | 召回信息减少 | 继续使用 title/topic/code/aiSummary | 修复单份 Spec 内容 |
| 模块信号为空 | 代码影响面缺失 | codeModules 为空并列入 unknownDimensions | 后续 Spec 补充复用清单或 Task 产物 |
| 冲突证据不足 | 可能误判 | 只输出 candidate/unknown，不自动改变流程状态 | 人工 history disposition |
| 无任何历史 | 无约束包 | 保持现有 needs_l1 路径并明确检索范围 | 创建新 L1 |

## 向后兼容

- **Brief**: 保留 `agent-brief.v1` 和既有字段，仅增加可选 constraintPackage。
- **Next**: 保留现有 status 枚举；只细化存在跨 topic 历史时的 reason 和 action。
- **检索**: 显式 `--topic` 继续严格限定；无显式 topic 才使用 project scope。
- **存储**: 本 L2 不新增持久化文件，全部为只读 projection。
- **性能**: 受控章节和模块信号在单次项目快照内提取，不重复读取全仓库。

## 关键交互流程

```text
request -> activation projection
  -> exact topic specs? yes -> normal workflow next
  -> exact topic specs? no
       -> related cross-topic history? no -> needs_l1 / no history
       -> related cross-topic history? yes
            -> needs_l1 + history-aware reason
            -> constraint package
            -> history attach/set before confirmation
```

## 可观测性

- **解释**: 每个候选包含 matchedTerms、matchedFields、score、confidence 和 sourceRef。
- **指标输入**: 记录候选数、结果数、topic 覆盖、约束包维度覆盖和 invalid source 数量，仅在响应中计算。
- **隐私**: 不发送正文或模块信息到仓库外。
- **确定性**: 相同快照与请求的排序和 next action 必须稳定。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Brief 编排 | `src/core/capability-brief.ts` | `buildAgentBrief`、`selectSpecs` | 保留现有上限、知识投影和来源输出 |
| 检索引擎 | `src/core/retrieval/index.ts` | `executeRetrieval` | 复用评分、关系扩展与多 topic diversity |
| 检索评分 | `src/core/retrieval/scoring.ts` | `calculateBatchScores` | 增量加入受控字段权重 |
| 工作流投影 | `src/core/workflow-surface.ts` | `buildWorkflowNextProjection` | 接入 activation history 判断 |
| 引导路由 | `src/core/guided-assist.ts` | `buildGuidedAssistReport` | 保持 guide/brief/flow 一致 |
| 项目快照 | `src/core/project-snapshot.ts` | `buildProjectSnapshot` | 单次读取并复用索引 |
| 有效性解析 | `src/core/knowledge.ts` | `resolveKnowledge` | 为约束项附加 current/unknown 等状态 |
| AC 提取 | `src/core/spec-sections.ts` | `extractAcceptanceCriteria` | 从相关 L3 提取稳定 AC ID |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| spec-knowledge-activation-hardening-L3.1.1-routing | 共享 activation projection、Brief/Next/Guide 一致路由及反向回归 | 本 L2 confirmed |
| spec-knowledge-activation-hardening-L3.1.2-package | 受控正文与模块信号、constraintPackage、AC/冲突/unknown 投影 | L3.1.1 implemented |

## 关联

- parent: `spec-knowledge-activation-hardening-L1` - 本 L2 落地知识激活路由与约束包边界。
- references: `spec-knowledge-loop-L2.1` - 复用跨 topic 检索契约。
- references: `spec-knowledge-governance-L2.1` - 复用知识有效性和历史处置投影。
