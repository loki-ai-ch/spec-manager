---
code: spec-knowledge-governance-L3.2.2-learning
level: L3
title: Delivery Knowledge Learning and Governance Metrics
topic: spec-knowledge-governance
parentCode: spec-knowledge-governance-L2.2
status: implemented
aiSummary: >-
  实施 Delivery Knowledge 原子注册表、Task declaration 门禁、人工 review、approved-only
  Lessons/Brief/Delivery 投影和只读治理指标，并保持 legacy
  Task、agent-brief.v1、delivery-summary.v1 与 store 模式兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3/L2/L3.2.1、历史 Task、agent-plan 和 delivery 调用链'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 delivery-knowledge.ts 注册表和来源校验
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 task CLI 增加 knowledge declare、none、review 和 show
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 task-completion.ts 接入 delivery declaration 门禁
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 Delivery、Lessons、Brief 和 knowledge source 投影
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 新增 knowledge-metrics.ts 和 project CLI 只读报告
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 新增 delivery learning、兼容、检索和 store-aware 测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: '验证: 检查 Decision 并运行定向测试、npm run build、全量 Vitest 和 CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-governance-L2.2
  - type: references
    target: spec-knowledge-governance-L3.2.1-scope
  - type: references
    target: delivery-summary-L2.1
  - type: references
    target: adaptive-profile-intelligence-L2.1
created: '2026-07-16T05:45:18.932Z'
updated: '2026-07-16T07:30:19.858Z'
changeSummary: 'cascade: task-complete'
---
# Delivery Knowledge Learning and Governance Metrics — 实施规格

## 目标

实施 `spec-knowledge-governance-L2.2` 的 Delivery Knowledge 注册表、Task 完成门禁、人工审核、Brief/Lessons/Delivery 投影和只读治理指标，覆盖 AC-7/8。

**前置依赖**: `spec-knowledge-governance-L3.2.1-scope` 已 implemented

## 实施步骤

### Step 1 — 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-governance-L2.2`、L3.2.1、历史 Task 和 agent-plan 模板。
- **SHALL** 复核 task-completion、task-evidence、delivery-summary、knowledge、lessons、capability-brief、profile-metrics 与 CLI 测试。

### Step 2 — 实现 Delivery Knowledge 注册表
- **SHALL** 增加 store-aware 路径和 `delivery-knowledge.v1` 原子注册表。
- **SHALL** 校验 Task、成功 verification、AC 与结论类型；同一 Task 只保留一个当前 declaration。
- **SHALL** reviewed 记录不可覆盖，原 Task/evidence 不修改。

### Step 3 — 实现声明与人工审核 CLI
- **SHALL** 提供 task knowledge declare/none/review/show；none 必须 reason，reject 必须 review reason。
- **SHALL** approve 前重新校验来源；只有显式 review 改变 draft。

### Step 4 — 接入 Task completion 门禁
- **SHALL** 仅对显式启用 delivery learning 的新 Task 要求 declaration 或 none。
- **SHALL** 将门禁放入 `runTaskCompletion` 状态写入前的同一事务；失败保持 Task running 和 Spec frozen。
- **SHALL** legacy Task 保持现有完成行为。

### Step 5 — 接入 Delivery、Lessons 与 Brief
- **SHALL** 为 `delivery-summary.v1` 增加可选结论和 review nextAction。
- **SHALL** 仅把 approved Delivery Knowledge 作为 Lesson/Brief 候选，保留 Task、verification 与 AC 来源。
- **SHALL** 扩展 `lesson:delivery:<id>` canonical source ref；draft/rejected 不参与召回。

### Step 6 — 实现治理指标
- **SHALL** 聚合 validity、disposition、scope、delivery、retrieval 与 evidence 指标，支持 project/topic 和 JSON。
- **SHALL** 指标只读、稳定排序，并对单项损坏返回 invalidProjections。

### Step 7 — 增加兼容与 store 测试
- **SHALL** 覆盖 declare/none、evidence 错误、review 权限、完成回滚、approved-only retrieval、Brief/Delivery 兼容和 store-aware。

### Step 8 — 决策与全量验证
- **SHALL** 在最终级联前确认 active Decision 覆盖 Phase 3 的范围和交付学习决策。
- **SHALL** 运行定向测试、build、全量 Vitest 与 CLI smoke。

## 验证命令
```bash
npm test -- --run src/core/__tests__/delivery-knowledge.test.ts src/core/__tests__/task-completion.test.ts src/core/__tests__/delivery-summary.test.ts src/core/__tests__/lessons.test.ts src/core/__tests__/capability-brief.test.ts src/core/__tests__/knowledge-metrics.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/project-profile.test.ts
# 预期: 全部 passed
npm run build
# 预期: tsc 退出码 0
npm test -- --run
# 预期: 全部 passed
npm test -- --run src/core/__tests__/delivery-knowledge.test.ts -t "requires declaration|accepts explicit none|excludes draft from retrieval|keeps review human controlled"
# 预期: 4 个目标用例 passed
```

## 验收标准
1. **AC-7**: 新治理 Task 完成前具有交付知识结论或显式 none，并保留 Task/evidence 来源。
2. **AC-8**: 仅 approved 交付知识进入后续召回，且匹配解释可追溯到 Task/verification。
3. **AC-9**: Task 完成、Brief 和指标均不自动 approve、reject 或改变知识状态。
4. **AC-10**: legacy Task 与旧 Delivery/Brief 消费者保持兼容。
5. **AC-11**: `agent-brief.v1` 与 `delivery-summary.v1` 原字段和显式 topic 语义不变。

## 关键验收标准
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11

## step_report 模板
```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)
```json
{"coveredSpecs":["spec-knowledge-governance-L3.2.2-learning"],"steps":[
{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3/L2/L3.2.1、历史 Task、agent-plan 和 delivery 调用链"},
{"stepNo":2,"stepType":"tool_action","name":"新增 delivery-knowledge.ts 注册表和来源校验"},
{"stepNo":3,"stepType":"tool_action","name":"修改 task CLI 增加 knowledge declare、none、review 和 show"},
{"stepNo":4,"stepType":"tool_action","name":"修改 task-completion.ts 接入 delivery declaration 门禁"},
{"stepNo":5,"stepType":"tool_action","name":"修改 Delivery、Lessons、Brief 和 knowledge source 投影"},
{"stepNo":6,"stepType":"tool_action","name":"新增 knowledge-metrics.ts 和 project CLI 只读报告"},
{"stepNo":7,"stepType":"tool_action","name":"新增 delivery learning、兼容、检索和 store-aware 测试"},
{"stepNo":8,"stepType":"tool_action","name":"验证: 检查 Decision 并运行定向测试、npm run build、全量 Vitest 和 CLI smoke"}
]}
```

`autoConfirm` 为 false：交付知识审核必须保持人工控制。

## 回滚方案
| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 完成门禁误阻断 | 回退 opt-in gate，保留 draft registry | < 10 min |
| 召回质量回归 | 停止投影 delivery candidate，不删除审核记录 | < 5 min |

## 执行风险
| 风险 | 应对 |
|---|---|
| 自动摘要被误认为人工结论 | 所有新记录先 draft，只有 review approve 可召回 |
| 指标扫描成本增长 | 复用一次项目快照和注册表批量读取 |

## 关联
| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-governance-L2.2 | 实施 Delivery Learning 与 metrics |
| references | spec-knowledge-governance-L3.2.1-scope | 依赖完整性门禁 |
| references | delivery-summary-L2.1 | 复用交付摘要契约 |
| references | adaptive-profile-intelligence-L2.1 | 复用指标模式 |
