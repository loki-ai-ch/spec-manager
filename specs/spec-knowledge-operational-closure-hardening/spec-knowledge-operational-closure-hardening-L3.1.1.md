---
code: spec-knowledge-operational-closure-hardening-L3.1.1
level: L3
title: Topic Selection and Path Containment
topic: spec-knowledge-operational-closure-hardening
parentCode: spec-knowledge-operational-closure-hardening-L2.1
status: implemented
aiSummary: >-
  实施 topic recommendation 与 selected topic 分离、Brief/Workflow 选择门、项目根
  lexical/real-path containment 和 evidence-backed historical 路径状态，并补齐 CLI 与回归测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取 L3、spec-knowledge-operational-closure-hardening-L2.1、历史 Task 和
      plan 模板
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 capability-types.ts 和 knowledge-activation.ts 分离推荐与 selectedTopic
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 capability-brief.ts、workflow-surface.ts 和 CLI 接入 topic selection gate
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 extractModuleConstraints 增加项目根 lexical 和 real-path containment
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改模块路径状态判定要求 historical knowledge evidence
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 activation、Brief、Workflow 和 CLI topic/path 回归测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build、全量测试和角色 Agent CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-hardening-L2.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.1
  - type: references
    target: spec-knowledge-operational-closure-L3.2.2
created: '2026-07-17T00:51:37.007Z'
updated: '2026-07-17T02:02:17.550Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-hardening-L2.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.1'
    - 'spec:spec-knowledge-operational-closure-L3.2.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-hardening-L2.1'
      action: reuse
      affectedCriteria:
        - AC-1
        - AC-2
        - AC-3
        - AC-4
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.1'
      action: change
      reason: >-
        Require root containment and evidence-backed historical state instead of
        treating structured syntax as history.
      affectedCriteria:
        - AC-2
        - AC-3
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.2.2'
      action: change
      reason: >-
        Keep ambiguous and create-new recommendations unselected until an
        explicit user choice.
      affectedCriteria:
        - AC-1
        - AC-4
  reviewedAt: '2026-07-17T00:54:48.336Z'
scopePlan:
  mode: fixed
  leaf: true
  updatedAt: '2026-07-17T00:54:57.048Z'
deliveryLearning: true
---
# Topic Selection and Path Containment - 实施规格

## 目标

实施 `spec-knowledge-operational-closure-hardening-L2.1` 的 topic selection gate、项目根 containment 和 evidence-backed path state。

**前置依赖**: 无

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-operational-closure-hardening-L2.1`、历史 Task 与 plan 模板，复核 activation、Brief、Workflow、path projection 和 CLI presenter。

### Step 2 - 分离推荐与已选择 topic
- 修改 `src/core/capability-types.ts` 与 `src/core/knowledge-activation.ts`，新增 selectedTopic/selectionRequired；ambiguous/create-new **SHALL** 返回 selectedTopic=null，candidate/explicit 才能选择 topic。

### Step 3 - 接入 Brief 与 Workflow selection gate
- 修改 `src/core/capability-brief.ts`、`src/core/workflow-surface.ts`，禁止未选择状态进入 inferred topic flow；输出候选、理由和显式 create-new 命令。
- 修改 `src/cli/usability.ts`、`src/cli/brief-presenter.ts` 保持 JSON 扩展兼容并呈现选择提示。

### Step 4 - 增加路径 containment
- 重构 `extractModuleConstraints`，在任何 exists/stat 前规范化路径并验证 lexical/real-path containment；根外或非法路径输出 unknown-path 与稳定 reasonCode。

### Step 5 - 收紧 historical 证据
- 只有来源 Knowledge state 为 historical/superseded/invalidated 或存在显式历史证据时，当前不存在路径才标 historical-path；current/unknown 来源中的缺失路径标 unknown-path。

### Step 6 - 增加回归测试
- 扩展 activation、Brief、Workflow 与 CLI 测试，覆盖 ambiguous 最终路由、create-new、`..` traversal、sibling/symlink escape、current、proposed 和 historical 路径。

### Step 7 - 验证
- 运行定向 Vitest、lint、build、全量测试与原始角色 Agent 请求 CLI smoke。

## 验证命令

```bash
npm test -- --run src/core/__tests__/knowledge-activation.test.ts src/core/__tests__/workflow-surface.test.ts src/core/__tests__/capability-brief.test.ts src/cli/__tests__/usability.test.ts src/cli/__tests__/capability.test.ts
npm run lint
npm run build
npm test
node dist/cli/index.js next "让 L0 L1 L2 角色 Agent 协作" --json
```

预期：candidate 仍选择 `agent-install-surface`；ambiguous fixture 的 selectedTopic/topic 为 null；根外路径绝不成为 current，缺失且无历史证据路径为 unknown。

## 验收标准

1. **AC-1**: ambiguous/create-new recommendation **SHALL** 保持 selectedTopic=null，Brief/Workflow 不得采用 inferred token。
2. **AC-2**: traversal、sibling 或 symlink escape 路径 **SHALL NOT** 触发项目根外存在性读取或标为 current-path。
3. **AC-3**: 当前缺失路径 **SHALL** 仅在可解释历史来源状态下标 historical-path，否则为 unknown-path。
4. **AC-4**: candidate、explicit topic、合法项目内路径及现有 CLI/schema **SHALL** 保持兼容和确定性。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4

## Delivery Learning

启用。Task 应沉淀 topic selection 与路径 containment 的失败样本、reasonCode 和回归证据。

## step_report 模板

```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)

```json
{"coveredSpecs":["spec-knowledge-operational-closure-hardening-L3.1.1"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、spec-knowledge-operational-closure-hardening-L2.1、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 capability-types.ts 和 knowledge-activation.ts 分离推荐与 selectedTopic"},{"stepNo":3,"stepType":"tool_action","name":"修改 capability-brief.ts、workflow-surface.ts 和 CLI 接入 topic selection gate"},{"stepNo":4,"stepType":"tool_action","name":"修改 extractModuleConstraints 增加项目根 lexical 和 real-path containment"},{"stepNo":5,"stepType":"tool_action","name":"修改模块路径状态判定要求 historical knowledge evidence"},{"stepNo":6,"stepType":"tool_action","name":"扩展 activation、Brief、Workflow 和 CLI topic/path 回归测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build、全量测试和角色 Agent CLI smoke"}]}
```

autoConfirm: false；topic 路由和路径安全行为需要 governed evidence。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| Workflow 无法路由 | 回退 selection gate 消费，保留 recommendation 字段 | < 10 min |
| 合法路径被拒绝 | 回退 containment helper 并保留 failing fixture | < 10 min |
| CLI 兼容失败 | 回退 human presenter，保留 JSON 可选字段 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| symlink 平台差异 | 临时目录创建真实 symlink fixture，失败时降级 lexical containment |
| ambiguous 增加交互 | 输出可直接执行的候选命令 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-operational-closure-hardening-L2.1 | 技术设计 |
| references | spec-knowledge-operational-closure-L3.2.1 | 路径 trust 基线 |
| references | spec-knowledge-operational-closure-L3.2.2 | topic recommendation 基线 |
