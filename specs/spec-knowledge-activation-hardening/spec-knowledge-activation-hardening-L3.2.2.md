---
code: spec-knowledge-activation-hardening-L3.2.2
level: L3
title: Review Revalidation Metrics and Migration Preview
topic: spec-knowledge-activation-hardening
parentCode: spec-knowledge-activation-hardening-L2.2
status: implemented
aiSummary: >-
  实现 Delivery Knowledge approve 来源复验、topic 正确的 metrics v2、critical evidence 与
  invalidProjections，以及零写入历史迁移候选预览。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3、父 L2、前序 L3、历史 Task 和 plan 模板'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 delivery-knowledge.ts 抽取统一来源校验器
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 reviewDeliveryKnowledge 在 approve 事务内重新校验
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 knowledge-metrics.ts 增加完整覆盖率和 invalidProjections
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 knowledge-migration.ts 实现只读候选批次
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 修改 project CLI 扩展 metrics 和 migration preview
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 补充来源漂移、topic 指标和零写入测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build、全量测试和 CLI smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L2.2
  - type: references
    target: spec-knowledge-activation-hardening-L3.2.1
  - type: references
    target: spec-knowledge-governance-L3.2.2-learning
created: '2026-07-16T08:12:02.432Z'
updated: '2026-07-16T09:11:57.019Z'
changeSummary: 'cascade: task-complete'
---
# Review Revalidation Metrics and Migration Preview - 实施规格

## 目标

实施 `spec-knowledge-activation-hardening-L2.2` 的 Delivery Knowledge approve 复验、metrics v2 和零写入历史迁移预览。

**前置依赖**: `spec-knowledge-activation-hardening-L3.2.1` 已 implemented

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、父级 `spec-knowledge-activation-hardening-L2.2`、前序 L3、历史 Task 和 plan 模板，复核 Delivery Knowledge、metrics、evidence、profile metrics 与 CLI 测试。

### Step 2 - 抽取 Delivery 来源校验器
- 修改 `src/core/delivery-knowledge.ts`，建立声明与 approve 共用的 Task/evidence/AC 校验函数；reject 保持只要求 reason。

### Step 3 - approve 事务内重新校验
- 在 `reviewDeliveryKnowledge` 的 approve 分支重新读取来源；失败保持 draft，使用既有稳定错误码。

### Step 4 - 扩展 Knowledge Metrics v2
- 修改 `src/core/knowledge-metrics.ts`，正确过滤 topic，增加 numerator/denominator/ratio、retrieval、critical evidence 和 invalidProjections，同时保留 v1 计数。

### Step 5 - 新增迁移预览
- 新增 `src/core/knowledge-migration.ts`，按活跃度、关系和风险稳定排序候选，输出缺失治理项、批次和建议命令，禁止写入。

### Step 6 - 增加 project CLI
- 修改 `src/cli/project.ts`，扩展 metrics 文本/JSON 并增加 `project knowledge migration preview`。

### Step 7 - 补充来源漂移、指标和零写入测试
- 扩展 Delivery Knowledge、knowledge metrics、project CLI 和 store-aware 测试，校验 evidence 删除/失败、AC 漂移、topic 隔离和文件 hash 不变。

### Step 8 - 验证
- 运行定向测试、lint、build、全量测试及 CLI smoke。

## 验证命令
```bash
npm test -- --run src/core/__tests__/delivery-knowledge.test.ts src/core/__tests__/knowledge-metrics.test.ts src/cli/__tests__/project-profile.test.ts src/cli/__tests__/store-aware-writes.test.ts
npm run lint
npm run build
npm test
node dist/cli/index.js project knowledge metrics --json
```

## 验收标准
1. **AC-1**: approve **SHALL** 重新校验 Task、成功 evidence 和 AC；失败时记录保持 draft。
2. **AC-2**: metrics **SHALL** 提供完整覆盖率、topic 隔离和 invalidProjections，并保留既有顶层计数。
3. **AC-3**: migration preview **SHALL** 稳定排序并保持 config、registry、Spec、Decision、Task 与 audit 零写入。
4. **AC-4**: approved-only Lessons/Brief 与 store-aware 行为 **SHALL** 保持兼容。

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
{"coveredSpecs":["spec-knowledge-activation-hardening-L3.2.2"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、父 L2、前序 L3、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 delivery-knowledge.ts 抽取统一来源校验器"},{"stepNo":3,"stepType":"tool_action","name":"修改 reviewDeliveryKnowledge 在 approve 事务内重新校验"},{"stepNo":4,"stepType":"tool_action","name":"修改 knowledge-metrics.ts 增加完整覆盖率和 invalidProjections"},{"stepNo":5,"stepType":"tool_action","name":"新增 knowledge-migration.ts 实现只读候选批次"},{"stepNo":6,"stepType":"tool_action","name":"修改 project CLI 扩展 metrics 和 migration preview"},{"stepNo":7,"stepType":"tool_action","name":"补充来源漂移、topic 指标和零写入测试"},{"stepNo":8,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build、全量测试和 CLI smoke"}]}
```

autoConfirm: false，迁移预览只读；任何治理写入由后续人工命令执行。

## 回滚方案
| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| approve 误阻断 | 回退 approve 复验调用，保留声明期校验 | < 10 min |
| metrics 兼容失败 | 保留 v1 输出路径并移除新增可选聚合 | < 10 min |
| preview 出现写入 | 禁用 CLI 注册并回退 migration 模块 | < 5 min |

## 执行风险
| 风险 | 应对 |
|---|---|
| topic 解析失败影响整份报告 | 单项捕获进入 invalidProjections |
| 迁移评分被误认为有效性结论 | 输出明确 candidate 和 suggested command，不写 annotation |

## 关联
| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-activation-hardening-L2.2 | 父技术设计 |
| references | spec-knowledge-activation-hardening-L3.2.1 | 依赖 adoption baseline |
| references | spec-knowledge-governance-L3.2.2-learning | 补齐 review 和 metrics 契约 |
