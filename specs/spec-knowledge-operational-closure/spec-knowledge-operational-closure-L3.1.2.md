---
code: spec-knowledge-operational-closure-L3.1.2
level: L3
title: Automatic Delivery Learning Draft
topic: spec-knowledge-operational-closure
parentCode: spec-knowledge-operational-closure-L2.1
status: implemented
aiSummary: >-
  在 Task completion 外层事务内自动创建或复用带 evidence/AC 来源的 Delivery Knowledge
  draft，保持失败回滚、人工 approve 与 approved-only 召回。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.1、前序 L3、历史 Task 和 plan
      模板
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 delivery-knowledge.ts 新增确定性 ensureDeliveryKnowledgeDraft
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 task-completion.ts 在外层事务内暂存自动 draft
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 runDeliveryKnowledgeGate 接入 ensure 语义和稳定错误
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 核对 delivery-knowledge.ts 与 capability-brief.ts 保持 approved-only 召回
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 delivery-knowledge、task-completion 和 capability-brief 事务测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build 和全量测试'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-L2.1
  - type: references
    target: spec-knowledge-operational-closure-L3.1.1
  - type: references
    target: spec-knowledge-activation-hardening-L3.2.2
created: '2026-07-16T09:48:34.803Z'
updated: '2026-07-16T10:31:29.046Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-L2.1'
    - 'spec:spec-knowledge-operational-closure-L3.1.1'
    - 'spec:spec-knowledge-activation-hardening-L3.2.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-L2.1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.1.1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L3.2.2'
      action: change
      reason: >-
        Replace manual-only delivery declaration with transactional automatic
        draft creation while retaining approve revalidation.
  reviewedAt: '2026-07-16T09:54:46.055Z'
scopePlan:
  mode: fixed
  leaf: true
  updatedAt: '2026-07-16T09:54:23.618Z'
deliveryLearning: true
---
# Automatic Delivery Learning Draft - 实施规格

## 目标

实施 `spec-knowledge-operational-closure-L2.1` 的 Task completion 同事务自动 Delivery Knowledge draft、来源复验和 approved-only 隔离。

**前置依赖**: `spec-knowledge-operational-closure-L3.1.1` 已 implemented

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-operational-closure-L2.1`、前序 L3、历史 Task 与 plan 模板，复核 completion 外层事务、Task evidence、Delivery Knowledge 写入和召回过滤。

### Step 2 - 抽取确定性 draft 构造器
- 修改 `src/core/delivery-knowledge.ts`，新增 `ensureDeliveryKnowledgeDraft` 与纯函数 draft payload builder。
- builder **SHALL** 仅使用 Task、成功 verification IDs、critical AC IDs 和关联 Spec；人工 draft 优先，approved/rejected 记录不可覆盖。

### Step 3 - 复用 completion 外层事务
- 修改 `src/core/task-completion.ts` 的 `runTaskCompletionUnlocked`，在所有 evidence gate 成功后、Task completed 写入前调用 ensure-draft。
- ensure 路径 **MUST** 使用当前 `withProjectTransaction` 上下文或可暂存写接口，禁止嵌套独立提交；后续失败必须同时回滚 draft、Task 与 cascade。

### Step 4 - 替换 manual-only gate
- 调整 `runDeliveryKnowledgeGate`：learning 未启用时 skipped；启用时验证已有记录或触发 ensure 结果，不再仅因事前无 declaration 而失败。
- 缺少成功 evidence 或 critical AC 来源时 **SHALL** 返回稳定错误并保持 Task 未完成。

### Step 5 - 保持审批与召回隔离
- 复用 `validateDeliveryKnowledgeSources` 做 draft 与 approve 来源复验。
- 检查 `listApprovedDeliveryKnowledge`、Brief 与 Lessons 调用，确保自动 draft 未批准前不可召回。

### Step 6 - 增加事务与集成测试
- 扩展 `src/core/__tests__/delivery-knowledge.test.ts`、`src/core/__tests__/task-completion.test.ts`、`src/core/__tests__/capability-brief.test.ts`，覆盖创建、复用、不可变记录、失败回滚、approved-only 与 legacy learning=false。

### Step 7 - 验证
- 运行定向 Vitest、lint、build 和全量测试。

## 验证命令

```bash
npm test -- --run src/core/__tests__/delivery-knowledge.test.ts src/core/__tests__/task-completion.test.ts src/core/__tests__/capability-brief.test.ts
npm run lint
npm run build
npm test
```

预期：learning-enabled Task 完成后产生一个 draft；故障注入后 Task 与知识 registry 均保持原值；draft 不出现在 Brief/Lessons，approve 复验成功后才可召回。

## 验收标准

1. **AC-1**: learning-enabled Task 完成 **SHALL** 在同一项目事务内创建或复用一个带 Task、成功 evidence 和 critical AC 来源的 draft。
2. **AC-2**: draft 创建或后续 completion 失败 **SHALL** 回滚知识记录、Task 状态与规格链级联。
3. **AC-3**: 自动记录 **SHALL** 保持 draft，人工 approve 前不得进入 Brief 或 Lessons。
4. **AC-4**: 人工 draft、不可变历史记录、approve 来源复验和 learning=false legacy 路径 **SHALL** 保持兼容。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4

## Delivery Learning

启用。该 Task 自身必须通过新自动流程生成 Delivery Knowledge draft，形成端到端验证证据。

## step_report 模板

```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)

```json
{"coveredSpecs":["spec-knowledge-operational-closure-L3.1.2"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.1、前序 L3、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 delivery-knowledge.ts 新增确定性 ensureDeliveryKnowledgeDraft"},{"stepNo":3,"stepType":"tool_action","name":"修改 task-completion.ts 在外层事务内暂存自动 draft"},{"stepNo":4,"stepType":"tool_action","name":"修改 runDeliveryKnowledgeGate 接入 ensure 语义和稳定错误"},{"stepNo":5,"stepType":"tool_action","name":"核对 delivery-knowledge.ts 与 capability-brief.ts 保持 approved-only 召回"},{"stepNo":6,"stepType":"tool_action","name":"扩展 delivery-knowledge、task-completion 和 capability-brief 事务测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build 和全量测试"}]}
```

autoConfirm: false；自动 draft 首次贯穿 completion 事务，需要人工评审 Task 证据。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| completion 被误阻断 | 回退 ensure 调用并恢复既有 declaration gate | < 10 min |
| 出现部分写入 | 禁用自动 draft 路径并恢复事务快照 | < 5 min |
| draft 泄漏到召回 | 保留 approved-only filter 并回退新增读取路径 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 嵌套事务提前提交 | 传递现有 transaction writer，并用失败注入验证原子性 |
| 自动摘要过度推断 | 只拼装结构化成功事实，保持可编辑 draft |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-operational-closure-L2.1 | 技术设计 |
| references | spec-knowledge-operational-closure-L3.1.1 | 前序指标集合语义 |
| references | spec-knowledge-activation-hardening-L3.2.2 | 既有来源复验基线 |
