---
code: spec-knowledge-operational-closure-L3.1.1
level: L3
title: Metrics Set Semantics
topic: spec-knowledge-operational-closure
parentCode: spec-knowledge-operational-closure-L2.1
status: implemented
aiSummary: >-
  实施 eligible knowledge source 集合、validity unknown、Task-based delivery coverage
  与指标 CLI 口径，保证集合恒等式和 coverage 数学不变量。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.1、历史 Task 和 plan 模板'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 knowledge-metrics.ts 建立 eligible 集合与 coverage 不变量
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 knowledge-metrics.ts 投影 validity unknown 与 invalidProjections
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 knowledge-metrics.ts 按 completed learning Task 计算 delivery coverage
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 project-snapshot.ts 和 project.ts 呈现集合口径
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 knowledge-metrics 和 project-snapshot 测试覆盖集合恒等式
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build、全量测试和 metrics CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-L2.1
  - type: references
    target: spec-knowledge-activation-hardening-L3.2.2
created: '2026-07-16T09:48:34.605Z'
updated: '2026-07-16T10:21:20.601Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-L2.1'
    - 'spec:spec-knowledge-activation-hardening-L3.2.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-L2.1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L3.2.2'
      action: change
      reason: >-
        Correct validity eligible sets and delivery coverage denominators while
        retaining Metrics v2 compatibility.
  reviewedAt: '2026-07-16T09:54:45.207Z'
scopePlan:
  mode: fixed
  leaf: true
  updatedAt: '2026-07-16T09:54:23.190Z'
deliveryLearning: true
---
# Metrics Set Semantics - 实施规格

## 目标

实施 `spec-knowledge-operational-closure-L2.1` 的 eligible source set、validity unknown 和 Task-based Delivery Knowledge coverage。

**前置依赖**: 无

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-operational-closure-L2.1`、历史 Task 与 `templates/agent-plan.json`，复核 `buildKnowledgeMetrics`、`buildProjectSnapshot`、Delivery Knowledge registry 和 CLI presenter。

### Step 2 - 建立指标集合类型与不变量
- 修改 `src/core/knowledge-metrics.ts`，新增 eligible source set 与带 `unit`、`eligibility` 的 coverage 构造器。
- coverage 构造器 **SHALL** 拒绝或规范化 `numerator > denominator`；0 分母必须输出 `0/0/null`。

### Step 3 - 修正 validity 状态投影
- 在 `buildKnowledgeMetrics` 中从 scope 内 eligible Spec、Decision、Task 与 Delivery Knowledge 来源构造集合，并通过 `resolveKnowledge` 投影互斥状态。
- 未标注且无派生状态的来源 **SHALL** 进入 `unknown`；单项解析失败进入 `invalidProjections`，不得破坏整份报告。

### Step 4 - 修正 Delivery Knowledge coverage
- 从 completed Task 与其关联 L3 的 `deliveryLearning` 声明构造 eligible Task 集合。
- 按 `specCode/taskId` 去重当前知识记录，计算 declaration 与 approval coverage；状态分布保持独立且不能抬高 Task 分子。

### Step 5 - 更新快照与 CLI 投影
- 按需扩展 `src/core/project-snapshot.ts`，向指标提供 Task、L3 与知识记录的稳定关联。
- 修改 `src/cli/project.ts` 的 metrics human/JSON 输出，公开集合口径并保持现有命令入口与退出码。

### Step 6 - 增加指标测试
- 扩展 `src/core/__tests__/knowledge-metrics.test.ts`、`src/core/__tests__/project-snapshot.test.ts` 与相关 CLI 测试，覆盖未标注来源、topic 过滤、0 分母、重复记录、legacy 字段和所有 coverage 不变量。

### Step 7 - 验证
- 运行定向 Vitest、lint、build、全量测试和 metrics CLI smoke。

## 验证命令

```bash
npm test -- --run src/core/__tests__/knowledge-metrics.test.ts src/core/__tests__/project-snapshot.test.ts src/cli/__tests__/project-profile.test.ts
npm run lint
npm run build
npm test
node dist/cli/index.js project knowledge metrics --json
```

预期：定向与全量测试退出码为 0；JSON 中 validity 各状态之和等于 eligible，所有 coverage 的 numerator 不大于 denominator，空集合 ratio 为 null。

## 验收标准

1. **AC-1**: scope 内全部 eligible knowledge source **SHALL** 恰好进入 current、historical、superseded、invalidated 或 unknown 之一。
2. **AC-2**: 所有 coverage **SHALL** 满足 `0 <= numerator <= denominator`，0 分母输出 `0/0/null`。
3. **AC-3**: Delivery declaration coverage **SHALL** 以 completed learning-enabled Task 为单位，并按 Task 去重。
4. **AC-4**: topic、legacy 与 CLI 兼容行为 **SHALL** 保持可读且不写事实文件。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4

## Delivery Learning

启用。Task 完成后应沉淀指标集合定义、legacy 兼容差异和验证证据，供后续指标扩展复用。

## step_report 模板

```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)

```json
{"coveredSpecs":["spec-knowledge-operational-closure-L3.1.1"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.1、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 knowledge-metrics.ts 建立 eligible 集合与 coverage 不变量"},{"stepNo":3,"stepType":"tool_action","name":"修改 knowledge-metrics.ts 投影 validity unknown 与 invalidProjections"},{"stepNo":4,"stepType":"tool_action","name":"修改 knowledge-metrics.ts 按 completed learning Task 计算 delivery coverage"},{"stepNo":5,"stepType":"tool_action","name":"修改 project-snapshot.ts 和 project.ts 呈现集合口径"},{"stepNo":6,"stepType":"tool_action","name":"扩展 knowledge-metrics 和 project-snapshot 测试覆盖集合恒等式"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build、全量测试和 metrics CLI smoke"}]}
```

autoConfirm: false；指标语义变化必须经 Task evidence 验证后完成。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 指标 schema 兼容失败 | 回退新增可选字段与 presenter，恢复 v2 既有字段 | < 10 min |
| eligible 集合误计 | 回退集合构造函数并保留失败 fixture | < 10 min |
| CLI 输出异常 | 回退 `src/cli/project.ts` 的 human presenter | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| legacy unknown 数量显著上升 | 用来源类型与 topic 分组解释，不隐藏未治理来源 |
| 同一 Task 多条记录选择不稳定 | 定义当前记录排序与 Task key 去重测试 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-operational-closure-L2.1 | 技术设计 |
| references | spec-knowledge-activation-hardening-L3.2.2 | 既有 Metrics v2 基线 |
