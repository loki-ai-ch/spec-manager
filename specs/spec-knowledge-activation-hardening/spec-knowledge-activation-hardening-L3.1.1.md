---
code: spec-knowledge-activation-hardening-L3.1.1
level: L3
title: Shared Activation Routing
topic: spec-knowledge-activation-hardening
parentCode: spec-knowledge-activation-hardening-L2.1
status: implemented
aiSummary: >-
  实施共享 Knowledge Activation Projection，让 Brief、Next、Guide 对跨 topic
  历史使用同一判断，修复召回成功却报告无历史的矛盾，并保持显式 topic 与 agent-brief.v1 兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3、父 L2、历史 Task 和 agent-plan 模板'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 src/core/knowledge-activation.ts 实现共享激活投影
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 src/core/capability-brief.ts 消费共享激活投影
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 src/core/workflow-surface.ts 输出 history-aware 下一步
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 src/core/guided-assist.ts 统一引导路由
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 补充 Brief、Workflow Surface 和 Guided Assist 回归测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、npm run lint 和全量 npm test'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L2.1
  - type: references
    target: spec-knowledge-loop-L3.1.1
created: '2026-07-16T08:12:01.801Z'
updated: '2026-07-16T08:30:26.254Z'
changeSummary: 'cascade: task-complete'
---
# Shared Activation Routing - 实施规格

## 目标

实施 `spec-knowledge-activation-hardening-L2.1` 的共享激活投影与 Brief/Next/Guide 一致路由。

**前置依赖**: 无

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、父级 `spec-knowledge-activation-hardening-L2.1`、历史 Task、`templates/agent-plan.json`，复核 `capability-brief.ts`、`workflow-surface.ts`、`guided-assist.ts` 和对应测试。

### Step 2 - 新增共享激活投影
- 新增 `src/core/knowledge-activation.ts`，实现 request、explicit/inferred topic、候选结果与 `hasRelatedHistory` 的确定性投影。

### Step 3 - Brief 消费共享投影
- 修改 `src/core/capability-brief.ts`，移除重复的 Spec 选择入口并保留 `agent-brief.v1` 现有字段与上限。

### Step 4 - Next 消费共享历史判断
- 修改 `src/core/workflow-surface.ts`，为“无精确 topic Spec 但存在跨 topic 历史”输出 history-aware blockingReason 和 nextAction。

### Step 5 - Guide 路由保持一致
- 修改 `src/core/guided-assist.ts` 与 CLI 组合入口，确保 Brief、Next、Guide 对相同请求使用相同激活事实。

### Step 6 - 补充单元与集成回归
- 修改 `src/core/__tests__/capability-brief.test.ts`、`workflow-surface.test.ts`、`guided-assist.test.ts`，新增真实中文请求反向夹具和显式 topic 兼容测试。

### Step 7 - 验证
- 运行定向 Vitest、`npm run lint` 和全量 `npm test`，确认召回成功时不再同时报告无历史。

## 验证命令

```bash
npm test -- --run src/core/__tests__/capability-brief.test.ts src/core/__tests__/workflow-surface.test.ts src/core/__tests__/guided-assist.test.ts
npm run lint
npm test
```

## 验收标准

1. **AC-1**: 相同 request 的 Brief 与 Next **SHALL** 共享同一 `hasRelatedHistory` 判断。
2. **AC-2**: 无精确 topic Spec 但有跨 topic 候选时，Next **SHALL** 提示先复核历史，不得声称没有历史。
3. **AC-3**: 显式 topic、无结果和现有 `agent-brief.v1` 字段 **SHALL** 保持兼容。
4. **AC-4**: 投影 **SHALL** 只读且相同快照与请求结果稳定。

## 关键验收标准
- AC-1
- AC-2
- AC-3
- AC-4

## step_report 模板
```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)
```json
{"coveredSpecs":["spec-knowledge-activation-hardening-L3.1.1"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、父 L2、历史 Task 和 agent-plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"新增 src/core/knowledge-activation.ts 实现共享激活投影"},{"stepNo":3,"stepType":"tool_action","name":"修改 src/core/capability-brief.ts 消费共享激活投影"},{"stepNo":4,"stepType":"tool_action","name":"修改 src/core/workflow-surface.ts 输出 history-aware 下一步"},{"stepNo":5,"stepType":"tool_action","name":"修改 src/core/guided-assist.ts 统一引导路由"},{"stepNo":6,"stepType":"tool_action","name":"补充 Brief、Workflow Surface 和 Guided Assist 回归测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、npm run lint 和全量 npm test"}]}
```

autoConfirm: false，任务步骤均可自动执行，但验证证据需完整记录。

## 回滚方案
| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 路由行为回归 | 回退共享投影接线，恢复原 Brief 与 Next 实现 | < 10 min |
| 输出兼容失败 | 移除新增可选字段并恢复兼容测试基线 | < 10 min |

## 执行风险
| 风险 | 应对 |
|---|---|
| 共享投影引入循环依赖 | 保持 core projection 不依赖 CLI 或 presenter |
| needs_l1 语义被误改 | 保留状态枚举，仅细化 reason/action |

## 关联
| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-activation-hardening-L2.1 | 父技术设计 |
| references | spec-knowledge-loop-L3.1.1 | 复用跨 topic retrieval |
