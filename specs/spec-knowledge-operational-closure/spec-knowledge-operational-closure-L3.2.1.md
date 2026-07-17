---
code: spec-knowledge-operational-closure-L3.2.1
level: L3
title: Lifecycle Candidates and Constraint Trust
topic: spec-knowledge-operational-closure
parentCode: spec-knowledge-operational-closure-L2.2
status: implemented
aiSummary: 实现统一生命周期/冲突候选、Constraint Package 子项信任元数据与模块路径三态，候选全程可解释、只读且 legacy 兼容。
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
    name: 修改 capability-types.ts 定义候选与 ConstraintTrust 类型
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 knowledge-activation.ts 实现结构化模块提取和路径三态
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 capability-brief.ts 构建可解释 conflict candidates
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 重构 buildConstraintPackage 为全部子项补齐信任元数据
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 knowledge-activation 和 capability-brief 候选路径测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build、全量测试和 Brief CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-operational-closure-L2.2
  - type: references
    target: spec-knowledge-operational-closure-L3.1.2
  - type: references
    target: spec-knowledge-activation-hardening-L3.1.2
created: '2026-07-16T09:48:35.001Z'
updated: '2026-07-16T10:37:30.657Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-operational-closure-L2.2'
    - 'spec:spec-knowledge-operational-closure-L3.1.2'
    - 'spec:spec-knowledge-activation-hardening-L3.1.2'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-operational-closure-L2.2'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-operational-closure-L3.1.2'
      action: reuse
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L3.1.2'
      action: change
      reason: >-
        Extend package-level provenance into per-item trust metadata, path
        states, and explainable conflict candidates.
  reviewedAt: '2026-07-16T09:54:46.942Z'
scopePlan:
  mode: fixed
  leaf: true
  updatedAt: '2026-07-16T09:54:24.010Z'
deliveryLearning: true
---
# Lifecycle Candidates and Constraint Trust - 实施规格

## 目标

实施 `spec-knowledge-operational-closure-L2.2` 的生命周期/冲突候选、逐项信任元数据和模块路径三态。

**前置依赖**: `spec-knowledge-operational-closure-L3.1.2` 已 implemented

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-operational-closure-L2.2`、前序 L3、历史 Task 与 plan 模板，复核 knowledge resolution、Decision、historyReview、Constraint Package 和模块提取基线。

### Step 2 - 定义候选与信任类型
- 修改 `src/core/capability-types.ts`，新增 `ConstraintTrust`、`ModuleConstraint`、`ConflictCandidate` 与统一 lifecycle candidate envelope。
- 新字段 **SHALL** 是兼容扩展；legacy 项规范化为 unknown/低置信，不得导致读取失败。

### Step 3 - 实现结构化模块提取与路径验证
- 修改 `src/core/knowledge-activation.ts`，优先从 frontmatter、relations、verification 和代码块提取路径，正文正则降为 fallback。
- 使用项目根和允许代码目录验证，输出 current-path、historical-path 或 unknown-path，并携带 detection、sourceRefs、confidence、knowledgeState。

### Step 4 - 构建可解释冲突候选
- 修改 `src/core/capability-brief.ts`，比较请求与 current Decision、关键 AC、RFC 2119 约束及 reuse/change/reject disposition。
- candidate **SHALL** 包含双方来源、命中片段、reasonCodes、confidence 与 verdict；仅关键词重叠最多为 unknown，不得阻断工作流。

### Step 5 - 为 Constraint Package 子项补齐信任元数据
- 重构 `buildConstraintPackage`，使 AC、Lesson、module、conflict 每项均具有 canonical sourceRefs、confidence 与 knowledgeState。
- approved-only Delivery Knowledge 和包级 unknownDimensions 行为必须保持兼容。

### Step 6 - 增加候选与路径测试
- 扩展 `src/core/__tests__/knowledge-activation.test.ts`、`src/core/__tests__/capability-brief.test.ts` 和类型消费者测试，覆盖结构化优先、三态路径、candidate/unknown/no-conflict 与 legacy schema。

### Step 7 - 验证
- 运行定向 Vitest、lint、build、全量测试和 Brief CLI smoke。

## 验证命令

```bash
npm test -- --run src/core/__tests__/knowledge-activation.test.ts src/core/__tests__/capability-brief.test.ts src/core/__tests__/knowledge.test.ts
npm run lint
npm run build
npm test
node dist/cli/index.js brief "change current knowledge constraints" --json
```

预期：所有 Constraint Package 子项带来源、置信度和状态；真实、历史、伪路径分别输出三态；冲突只输出 candidate 或 unknown，不改变任何事实文件。

## 验收标准

1. **AC-1**: lifecycle 与 conflict candidate **SHALL** 包含 canonical sources、reasonCodes、confidence、knowledgeState 和建议人工动作。
2. **AC-2**: AC、Lesson、module 与 conflict 子项 **SHALL** 逐项携带 sourceRefs、confidence 和 knowledgeState。
3. **AC-3**: 所有模块项 **SHALL** 标记 current-path、historical-path 或 unknown-path，并公开检测依据。
4. **AC-4**: candidate 生成 **SHALL NOT** 改变 validity、Decision、relations、historyReview、Task 或 audit facts。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4

## Delivery Learning

启用。Task 应沉淀误报样本、路径判定边界和候选置信度校准证据。

## step_report 模板

```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)

```json
{"coveredSpecs":["spec-knowledge-operational-closure-L3.2.1"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、spec-knowledge-operational-closure-L2.2、前序 L3、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 capability-types.ts 定义候选与 ConstraintTrust 类型"},{"stepNo":3,"stepType":"tool_action","name":"修改 knowledge-activation.ts 实现结构化模块提取和路径三态"},{"stepNo":4,"stepType":"tool_action","name":"修改 capability-brief.ts 构建可解释 conflict candidates"},{"stepNo":5,"stepType":"tool_action","name":"重构 buildConstraintPackage 为全部子项补齐信任元数据"},{"stepNo":6,"stepType":"tool_action","name":"扩展 knowledge-activation 和 capability-brief 候选路径测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build、全量测试和 Brief CLI smoke"}]}
```

autoConfirm: false；冲突与生命周期输出会影响后续人工判断，需评审误报证据。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 新 schema 破坏消费者 | 保留旧字段并移除新增 presenter 使用 | < 10 min |
| 路径误分类 | 回退 structured extractor，所有不确定项降为 unknown-path | < 10 min |
| 冲突误报过多 | 禁用词法候选，仅保留结构化 disposition 信号 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 工作树状态影响 current-path | 记录检测依据并用临时 fixture 隔离测试 |
| disposition 语义被过度解释 | 仅提高 candidate 置信度，不产生确定裁决 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-operational-closure-L2.2 | 技术设计 |
| references | spec-knowledge-operational-closure-L3.1.2 | 前序学习闭环 |
| references | spec-knowledge-activation-hardening-L3.1.2 | 既有 Constraint Package 基线 |
