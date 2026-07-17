---
code: spec-knowledge-operational-closure-hardening-L3.2.1
level: L3
title: Multilingual Conflict and Resolver Metrics
topic: spec-knowledge-operational-closure-hardening
parentCode: spec-knowledge-operational-closure-hardening-L2.2
status: implemented
aiSummary: >-
  实施本地确定性的 CJK 对象信号与多语言 conflict 极性判断，使用共享 resolver 修正
  currentKnowledgeCount，并让所有失效 annotation 进入 invalidProjections。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取 L3、spec-knowledge-operational-closure-hardening-L2.2、前序 L3、历史
      Task 和 plan 模板
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 retrieval/normalization.ts 增加确定性 CJK 对象信号
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 capability-brief.ts 重构多语言 conflict signal
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 knowledge-activation.ts 使用 resolver 计算 topic knowledge stats
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 knowledge-metrics.ts 校验全部 annotation 来源并报告 unscoped invalid
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 normalization、Brief、activation、Metrics 和 migration 正反测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build、全量测试和中文 CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-hardening-L2.2
  - type: references
    target: spec-knowledge-operational-closure-hardening-L3.1.1
  - type: references
    target: spec-knowledge-operational-closure-L3.1.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.2
created: '2026-07-17T00:51:37.223Z'
updated: '2026-07-17T02:10:53.506Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-hardening-L2.2'
    - 'spec:spec-knowledge-operational-closure-hardening-L3.1.1'
    - 'spec:spec-knowledge-operational-closure-L3.1.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-hardening-L2.2'
      action: reuse
      affectedCriteria:
        - AC-1
        - AC-2
        - AC-3
        - AC-4
    - sourceRef: 'spec:spec-knowledge-operational-closure-hardening-L3.1.1'
      action: reuse
      affectedCriteria:
        - AC-4
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.1.1'
      action: change
      reason: >-
        Validate all annotation sources and expose stale canonical refs as
        invalid projections.
      affectedCriteria:
        - AC-3
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.1'
      action: change
      reason: >-
        Add deterministic CJK object overlap and polarity signals while
        retaining candidate-only behavior.
      affectedCriteria:
        - AC-1
        - AC-2
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.2'
      action: change
      reason: >-
        Compute current topic strength from resolved knowledge state instead of
        lifecycle proxy.
      affectedCriteria:
        - AC-3
        - AC-4
  reviewedAt: '2026-07-17T00:54:49.730Z'
scopePlan:
  mode: fixed
  leaf: true
  updatedAt: '2026-07-17T00:54:57.588Z'
deliveryLearning: true
---
# Multilingual Conflict and Resolver Metrics - 实施规格

## 目标

实施 `spec-knowledge-operational-closure-hardening-L2.2` 的中文 conflict normalization、resolver-backed topic strength 和 stale annotation invalid projection。

**前置依赖**: `spec-knowledge-operational-closure-hardening-L3.1.1` 已 implemented

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-operational-closure-hardening-L2.2`、前序 L3、历史 Task 与 plan 模板，复核 retrieval normalization、conflict builder、knowledge resolver、Metrics 和 migration consumers。

### Step 2 - 增加确定性 CJK normalization
- 修改 `src/core/retrieval/normalization.ts`，提供本地 CJK 字符 n-gram/动作对象规范化 helper；保留英文 token 行为和稳定排序。

### Step 3 - 重构 conflict signal
- 修改 `src/core/capability-brief.ts`，用规范化对象重叠、请求/历史极性和阈值生成 candidate/unknown/none；输出 matchedTerms、双方 polarity 和 reasonCodes。

### Step 4 - 修正 topic knowledge stats
- 修改 `src/core/knowledge-activation.ts`，向推荐器传入共享 ProjectSnapshot/registry，并逐项调用 `resolveKnowledge`；currentKnowledgeCount **SHALL** 只统计 state=current，单项失败进入解释信息而不中断排序。

### Step 5 - 校验全部 annotation 来源
- 修改 `src/core/knowledge-metrics.ts`，对 eligible 外 annotation 调用 `validateKnowledgeSource`/`resolveKnowledge`；合法格式但来源失效的记录加入 invalidProjections，无法归属 topic 时标 unscoped 且仍可见。

### Step 6 - 增加正反回归
- 扩展 normalization、Brief、activation、Metrics 和 migration 测试，覆盖中文近义 candidate、弱重叠 unknown、无重叠 none、混合 knowledge states、删除 Spec/AC/Task/lesson annotation 与 legacy 英文行为。

### Step 7 - 验证
- 运行定向 Vitest、lint、build、全量测试以及中文 Brief、Metrics、Migration CLI smoke。

## 验证命令

```bash
npm test -- --run src/core/__tests__/retrieval/normalization.test.ts src/core/__tests__/capability-brief.test.ts src/core/__tests__/knowledge-activation.test.ts src/core/__tests__/knowledge-metrics.test.ts src/core/__tests__/knowledge-migration.test.ts
npm run lint
npm run build
npm test
node dist/cli/index.js brief "禁止自动批准知识记录" --topic spec-knowledge-operational-closure --json
node dist/cli/index.js project knowledge metrics --json
```

预期：中文极性反例输出 candidate/unknown；currentKnowledgeCount 与 resolver 一致；stale sourceRef 出现在 invalidProjections；全量行为只读兼容。

## 验收标准

1. **AC-1**: 中文对象部分重叠且极性相反时 **SHALL** 输出可解释 candidate/unknown，无对象重叠或极性一致时不得 candidate。
2. **AC-2**: currentKnowledgeCount **SHALL** 等于共享 resolver 投影的 current 数，不得使用非 archived proxy。
3. **AC-3**: 格式合法但 Spec/AC/Task/lesson 来源失效的 annotation **SHALL** 进入 invalidProjections，包括 unscoped topic 报告。
4. **AC-4**: 英文冲突、有效 annotation、Migration/Brief/Metrics schema、纯本地只读边界 **SHALL** 保持兼容。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4

## Delivery Learning

启用。Task 应沉淀中文误报/漏报样本、resolver 状态分布与 stale annotation evidence。

## step_report 模板

```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)

```json
{"coveredSpecs":["spec-knowledge-operational-closure-hardening-L3.2.1"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、spec-knowledge-operational-closure-hardening-L2.2、前序 L3、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 retrieval/normalization.ts 增加确定性 CJK 对象信号"},{"stepNo":3,"stepType":"tool_action","name":"修改 capability-brief.ts 重构多语言 conflict signal"},{"stepNo":4,"stepType":"tool_action","name":"修改 knowledge-activation.ts 使用 resolver 计算 topic knowledge stats"},{"stepNo":5,"stepType":"tool_action","name":"修改 knowledge-metrics.ts 校验全部 annotation 来源并报告 unscoped invalid"},{"stepNo":6,"stepType":"tool_action","name":"扩展 normalization、Brief、activation、Metrics 和 migration 正反测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build、全量测试和中文 CLI smoke"}]}
```

autoConfirm: false；中文冲突与治理指标语义需要 governed evidence。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 中文误报过高 | 禁用 CJK candidate 升级，仅保留 unknown | < 10 min |
| 推荐性能回归 | 缓存 snapshot/registry resolver projection | < 10 min |
| Metrics 兼容失败 | 保留 invalidProjections 旧字段并回退 scope 扩展 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| n-gram 常见字误报 | 对象阈值、停用信号、极性组合和参数化反例 |
| unscoped invalid 重复出现 | sourceRef 去重并稳定排序 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-operational-closure-hardening-L2.2 | 技术设计 |
| references | spec-knowledge-operational-closure-hardening-L3.1.1 | 前序 selection/path hardening |
| references | spec-knowledge-operational-closure-L3.1.1 | Metrics baseline |
| references | spec-knowledge-operational-closure-L3.2.1 | conflict baseline |
| references | spec-knowledge-operational-closure-L3.2.2 | topic baseline |
