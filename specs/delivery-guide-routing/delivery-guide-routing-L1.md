---
code: delivery-guide-routing-L1
level: L1
title: 交付意图路由
topic: delivery-guide-routing
parentCode: null
status: implemented
aiSummary: >-
  新增交付意图路由：让 assist guide 在 completed task + 交付意图下推荐 assist delivery，同时保留
  acceptance 证据审查场景。
relations:
  - type: references
    target: guided-assist-workflow-L3.1.1-core
  - type: references
    target: guided-assist-workflow-L3.1.2-cli
  - type: references
    target: delivery-summary-L3.1.2
created: '2026-06-17T07:57:04.346Z'
updated: '2026-06-17T08:15:59.916Z'
changeSummary: 'cascade: task-complete'
---
# 交付意图路由 — PRD

## 背景

`delivery-summary` 已经提供 `spec-manager assist delivery <taskId> --spec <L3-code>`，可以把 Task 的 spec、steps、verification、acceptance findings 和 next action 整理成面向用户的交付摘要。

`guided-assist-workflow` 已经提供 `spec-manager assist guide --request "<work>"`，帮助较弱 Agent 根据上下文选择下一条命令。

但目前两者之间还有一个轻微断点：当用户表达“交付、总结、最终回复、handoff、deliver”等意图，并且 Agent 已绑定 completed task 时，`assist guide` 仍倾向推荐 `assist acceptance`，而不是面向最终交付的 `assist delivery`。这要求弱模型记住新命令，降低了能力补偿闭环的效果。

## 用户故事

- 作为较弱 AI Agent，我希望在用户说“交付/总结/最终回复”且我有 task 上下文时，`assist guide` 直接推荐 delivery summary 命令。
- 作为用户，我希望最终交付前能拿到面向人的摘要，而不是只看到证据明细。
- 作为维护者，我希望这只是 guide 路由规则增强，不改变 delivery summary 或 acceptance report 的事实口径。

## 验收标准

1. **AC-1**: Given 一个 completed task 和交付意图请求，When 执行 `assist guide --request <handoff intent> --task <taskId> --spec <specCode>`，Then `stage` SHALL 为 `delivery` 或等价交付阶段，并且 `nextCommand` SHALL 为 `spec-manager assist delivery <taskId> --spec <specCode>`。
2. **AC-2**: Given 一个 completed task 和验收证据意图请求，When 执行 guide，Then 仍 SHOULD 能推荐 `assist acceptance`，避免 delivery 吞掉纯证据审查场景。
3. **AC-3**: Given 非 completed task，When 请求交付，Then guide SHOULD 优先推荐 `assist next` 或现有未完成任务导航，不误导用户交付未完成工作。
4. **AC-4**: Given `--json` 输出，Then guided assist JSON SHALL 包含稳定 stage、nextCommand、reason、alternatives、sourceRefs。
5. **AC-5**: Given CLI text 输出，Then Stage/Next/Reason SHALL 能清楚显示 delivery 路由结果。
6. **AC-6**: Given 该增强，Then SHALL 不改变 `assist delivery` 输出 schema，不改变 task/spec 状态，不写 audit。

## 范围边界

本轮包含：

- 扩展 guided assist stage，增加 delivery 推荐阶段。
- 调整交付意图识别：handoff / deliver / delivery / final / summary / 交付 / 总结 / 最终回复。
- 保留 acceptance 意图识别：acceptance / 验收 / 证据 / evidence / AC 覆盖。
- CLI text/json 测试。
- completion 或文档如需同步，保持最小改动。

本轮不包含：

- 不改变 `buildDeliverySummary`。
- 不改变 `assist delivery` CLI 输出。
- 不引入远端模型或语义分类器。
- 不自动完成 Task。

## 度量指标

- 弱 Agent 可通过一条 `assist guide` 找到 `assist delivery`。
- guide tests 覆盖 completed delivery intent、acceptance evidence intent、non-completed task。
- 全量测试和 build 通过。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| delivery 抢走 acceptance 场景 | 证据审查用户拿到过度摘要 | 将 evidence / AC / 验收覆盖等词保留给 acceptance |
| 未完成 task 被推荐交付 | 用户误以为可交付 | 非 completed task 继续走 task-next |
| stage 扩展破坏 JSON 消费方 | 兼容风险 | schemaVersion 不变，只扩展枚举并补测试 |

## 关联

- references: `guided-assist-workflow-L3.1.1-core`
- references: `guided-assist-workflow-L3.1.2-cli`
- references: `delivery-summary-L3.1.2`
