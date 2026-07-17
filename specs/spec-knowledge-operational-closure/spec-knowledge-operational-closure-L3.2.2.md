---
code: spec-knowledge-operational-closure-L3.2.2
level: L3
title: Migration Dimensions and Canonical Topic
topic: spec-knowledge-operational-closure
parentCode: spec-knowledge-operational-closure-L2.2
status: implemented
aiSummary: >-
  实现五维只读迁移预览、可选模拟指标和 canonical topic 排序推荐，统一 Brief/Next 呈现并保留
  ambiguous/create-new 人工选择。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.2、前序 L3、历史 Task 和 plan
      模板
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 knowledge-migration.ts 生成五维稳定治理批次
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 knowledge-migration.ts 增加只读 simulatedMetricsDelta
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 knowledge-activation.ts 构建 canonical topic 推荐器
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 capability-brief.ts、workflow-surface.ts 和 CLI 统一 topic 候选呈现
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 migration、workflow、brief、readiness 和 CLI 只读排序测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build、全量测试和 migration/next CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-L2.2
  - type: references
    target: spec-knowledge-operational-closure-L3.2.1
  - type: references
    target: spec-knowledge-activation-hardening-L3.2.2
  - type: references
    target: critical-ac-readiness-L3.1.1-core
created: '2026-07-16T09:48:35.200Z'
updated: '2026-07-16T11:44:00.575Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-L2.2'
    - 'spec:spec-knowledge-operational-closure-L3.2.1'
    - 'spec:spec-knowledge-activation-hardening-L3.2.2'
    - 'spec:critical-ac-readiness-L3.1.1-core'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-L2.2'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.1'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L3.2.2'
      action: change
      reason: >-
        Expand validity-only migration preview and inferred topic into five
        dimensions and ranked canonical topic candidates.
    - sourceRef: 'spec:critical-ac-readiness-L3.1.1-core'
      action: reuse
  reviewedAt: '2026-07-16T09:54:48.080Z'
scopePlan:
  mode: fixed
  leaf: true
  updatedAt: '2026-07-16T09:54:24.405Z'
deliveryLearning: true
---
# Migration Dimensions and Canonical Topic - 实施规格

## 目标

实施 `spec-knowledge-operational-closure-L2.2` 的五维只读迁移预览、可选指标模拟和 canonical topic 推荐。

**前置依赖**: `spec-knowledge-operational-closure-L3.2.1` 已 implemented

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-operational-closure-L2.2`、前序 L3、历史 Task 与 plan 模板，复核 migration v1、critical readiness、retrieval 分数、workflow next 与 CLI 输出。

### Step 2 - 扩展五维 migration preview
- 修改 `src/core/knowledge-migration.ts`，输出 spec-validity、decision-lifecycle、supersedes-relation、history-disposition、critical-ac-readiness 五个稳定批次；需求来源为 `spec-knowledge-operational-closure-L2.2`。
- 每个 batch **SHALL** 存在，即使为空；候选复用统一 envelope，保持 deterministic limit 与排序。

### Step 3 - 增加只读模拟指标
- 复用 `buildKnowledgeMetrics` 口径计算可选 `simulatedMetricsDelta`，清楚标记 simulation。
- preview **SHALL NOT** 调用 annotation、Decision、relation、history 或 AC 写接口；不可计算时省略 delta 并返回原因。

### Step 4 - 构建 canonical topic 推荐器
- 在 `src/core/knowledge-activation.ts` 或独立核心模块聚合 retrieval results，按相关性、current knowledge、Decision/关键 AC 强度与历史使用量生成稳定候选。
- 多候选接近时返回 ambiguous；低置信时保留 create-new，不得创建、合并或重命名 topic。

### Step 5 - 统一 Brief 与 workflow surface
- 修改 `src/core/capability-brief.ts` 和 `src/core/workflow-surface.ts` 复用同一推荐器，使 next、Brief 和创建建议呈现候选、理由及显式 create-new 选择。
- 更新 `src/cli/project.ts`、`src/cli/capability.ts` 的 human/JSON presenter，保持既有入口。

### Step 6 - 增加只读与推荐测试
- 扩展 `src/core/__tests__/knowledge-migration.test.ts`、`src/core/__tests__/workflow-surface.test.ts`、`src/core/__tests__/capability-brief.test.ts`、`src/core/__tests__/critical-readiness.test.ts` 及 CLI 测试，覆盖五维空批次、哈希不变、稳定排序、ambiguous/create-new 和 topic scope。

### Step 7 - 验证
- 运行定向 Vitest、lint、build、全量测试和 migration/next CLI smoke。

## 验证命令

```bash
npm test -- --run src/core/__tests__/knowledge-migration.test.ts src/core/__tests__/workflow-surface.test.ts src/core/__tests__/capability-brief.test.ts src/core/__tests__/critical-readiness.test.ts src/cli/__tests__/project-workflow.test.ts
npm run lint
npm run build
npm test
node dist/cli/index.js project knowledge migration preview --json
node dist/cli/index.js next "coordinate L0 L1 L2 agents with existing workflow knowledge" --json
```

预期：preview 始终返回五个 batch 且 writes/readOnly 标识为只读；相同请求排序稳定；高置信历史 topic 优先，接近时 ambiguous，并始终保留 create-new。

## 验收标准

1. **AC-1**: migration preview **SHALL** 覆盖五个治理维度、稳定排序、来源、理由、置信度和建议人工动作。
2. **AC-2**: preview 与 simulated delta **SHALL NOT** 修改 config、Spec、Decision、relations、historyReview、Task、knowledge registry 或 audit facts。
3. **AC-3**: canonical topic recommendation **SHALL** 返回排序候选、分数理由、ambiguous/create-new 状态，且不自动创建或切换 topic。
4. **AC-4**: project/topic、legacy 与 human/JSON CLI 行为 **SHALL** 保持兼容。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4

## Delivery Learning

启用。Task 应沉淀迁移候选噪声、topic 排序边界与只读哈希证据。

## step_report 模板

```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)

```json
{"coveredSpecs":["spec-knowledge-operational-closure-L3.2.2"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.2、前序 L3、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 knowledge-migration.ts 生成五维稳定治理批次"},{"stepNo":3,"stepType":"tool_action","name":"修改 knowledge-migration.ts 增加只读 simulatedMetricsDelta"},{"stepNo":4,"stepType":"tool_action","name":"修改 knowledge-activation.ts 构建 canonical topic 推荐器"},{"stepNo":5,"stepType":"tool_action","name":"修改 capability-brief.ts、workflow-surface.ts 和 CLI 统一 topic 候选呈现"},{"stepNo":6,"stepType":"tool_action","name":"扩展 migration、workflow、brief、readiness 和 CLI 只读排序测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build、全量测试和 migration/next CLI smoke"}]}
```

autoConfirm: false；topic 推荐与治理候选只提供建议，必须保留人工选择。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| preview schema 兼容失败 | 保留 v1 items 并把五维 batches 降为可选字段 | < 10 min |
| topic 推荐误导工作流 | 回退 workflow 接入，保留独立只读推荐器 | < 10 min |
| 发现任何写入 | 立即禁用 preview CLI 注册并回退写路径 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 候选量过大拖慢 CLI | 每维应用确定性 limit，并复用项目快照 |
| 历史数量压过请求相关性 | 对相关性设最低门槛，接近分数返回 ambiguous |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-operational-closure-L2.2 | 技术设计 |
| references | spec-knowledge-operational-closure-L3.2.1 | 前序 candidate envelope 与 trust 类型 |
| references | spec-knowledge-activation-hardening-L3.2.2 | 既有 migration v1 基线 |
| references | critical-ac-readiness-L3.1.1-core | critical readiness 数据来源 |
