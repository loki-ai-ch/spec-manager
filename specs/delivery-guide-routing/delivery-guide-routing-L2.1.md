---
code: delivery-guide-routing-L2.1
level: L2
title: 交付意图路由设计
topic: delivery-guide-routing
parentCode: delivery-guide-routing-L1
status: implemented
aiSummary: >-
  设计 assist guide 的交付意图路由：completed task + 交付意图推荐 assist delivery，证据/验收意图保留
  assist acceptance。
created: '2026-06-17T07:59:37.216Z'
updated: '2026-06-17T08:15:59.912Z'
changeSummary: 'cascade: task-complete'
---
# 交付意图路由设计 — L2 Design

## 背景

`assist delivery` 已能生成面向用户的最终交付摘要；`assist guide` 已能根据 request/spec/task 推荐下一步命令。当前断点是：completed task 下的 handoff/deliver/交付意图仍会被 `assist acceptance` 捕获，弱 Agent 需要自己记住 delivery 命令。

本设计只增强 guided assist 的路由层，让最终交付意图进入 delivery summary，同时保留 evidence/AC/验收覆盖等证据审查意图到 acceptance。

## 方案概述

在 `buildGuidedAssistReport` 的 task-bound 路由中增加 delivery stage：

1. 如果绑定 task 非 completed，继续按现有 task-next / drift 规则处理。
2. 如果绑定 completed task 且 request 是 delivery intent，推荐 `assist delivery`。
3. 如果绑定 task 且 request 是 acceptance/evidence intent，推荐 `assist acceptance`。
4. 如果绑定 completed task 但 request 没有明确 delivery/evidence 意图，继续推荐 `assist acceptance`，保持默认行为稳定。

## 目标

- 扩展 `GuidedAssistStage`，增加 `delivery`。
- 新增 `deliveryCommand(taskId, specCode)`。
- 拆分意图识别：
  - delivery intent: handoff / deliver / delivery / final / summary / 交付 / 总结 / 最终回复
  - evidence intent: acceptance / evidence / AC / coverage / 验收 / 证据 / 覆盖
- CLI text/json 通过现有 `assist guide` 输出 delivery stage。
- 测试覆盖 completed delivery、completed evidence、running delivery 三类核心路由。

## 非目标

- 不改变 `assist delivery` schema 或 text 输出。
- 不改变 `assist acceptance` 输出。
- 不引入远端模型或复杂语义分类器。
- 不自动完成 Task，不写 spec/task/audit。

## 技术决策

1. 使用正则关键词保持确定性，符合当前 `guided-assist.ts` 的实现风格。
2. delivery intent 只在 completed task 上优先于 acceptance，否则非 completed task 继续 task-next。
3. evidence/acceptance intent 优先保留给 acceptance，防止用户想看证据时被送到交付摘要。
4. `guided-assist.v1` schemaVersion 不变，只扩展 stage 枚举，避免无谓 schema churn。
5. `alternativesFor('delivery')` 提供 acceptance 和 task show，便于用户回看证据或任务明细。

## 接口契约

### Core

修改 `src/core/capability-types.ts`：

```ts
export type GuidedAssistStage =
  | 'brief'
  | 'critique'
  | 'task-next'
  | 'drift'
  | 'acceptance'
  | 'delivery'
  | 'flow'
  | 'needs-input';
```

修改 `src/core/guided-assist.ts`：

- 新增 `isDeliveryIntent(request)`。
- 将当前 `isAcceptanceIntent` 收窄为 evidence/acceptance 语义。
- 新增 `deliveryCommand(taskId, specCode)`。
- 在 `buildReportForContext` 中加入 completed task + delivery intent 路由。

### CLI

`assist guide` 不新增参数。现有 text 输出会自然显示：

```text
Stage: delivery
Next: spec-manager assist delivery T-001 --spec auth-L3.1.1
Reason: ...
```

`--json` 输出 `stage: "delivery"` 与 delivery nextCommand。

## 受影响模块

- `src/core/capability-types.ts`
- `src/core/guided-assist.ts`
- `src/core/__tests__/guided-assist.test.ts`
- `src/cli/__tests__/capability.test.ts`
- 文档如需提及 guide 会推荐 delivery，保持最小增量

## 核心流程

1. resolve request/spec/task 与当前上下文。
2. 如果 task 存在且 request 是 drift intent，保持 drift 优先。
3. 如果 task 存在且 task status 非 completed，保持 task-next。
4. 如果 task completed 且 request 是 delivery intent，返回 delivery stage。
5. 如果 task 存在且 request 是 evidence/acceptance intent，返回 acceptance stage。
6. 如果 task completed 且没有更具体 intent，保持 acceptance default。
7. 其他场景保持原 flow/brief/critique 逻辑。

## L3 裂变计划

### L3.1.1 Delivery Stage Routing

范围：

- 扩展 stage 枚举。
- 实现 delivery intent 路由。
- 补 core 和 CLI tests。
- 轻量更新文档（如必要）。

验收：

- 满足 L1 AC-1 到 AC-6。
- 全量测试与 build 通过。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| delivery 抢走 acceptance | evidence/AC/coverage 关键词优先 acceptance |
| running task 被推荐 delivery | 非 completed task 优先 task-next |
| stage 枚举扩展影响测试 | core/CLI JSON contract 测试覆盖 delivery stage |

## 备注

本设计不把 delivery 作为 completed task 的默认推荐，默认仍是 acceptance；只有明确交付/总结/最终回复意图才进入 delivery。
