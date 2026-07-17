---
code: spec-knowledge-activation-hardening-L3.2.1
level: L3
title: Governance Adoption Gates
topic: spec-knowledge-activation-hardening
parentCode: spec-knowledge-activation-hardening-L2.2
status: implemented
aiSummary: >-
  实现项目 knowledge governance adoption baseline，新 L1/L2 history/scope 门禁、新 L3
  learning 策略及 legacy 兼容，并提供只读 preview 与显式 enable。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3、父 L2、历史 Task 和 plan 模板'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 knowledge-governance-adoption.ts 实现 preview/read/enable
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 Spec schema 和 IO 增加 deliveryLearningReason
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 spec policy 和 handler 接入 confirm/freeze 门禁
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 lifecycle.ts 强制新资产 scope 完整性
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 修改 project CLI 增加 adoption preview 和 enable
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 补充 schema、policy、CLI、lifecycle 和 store-aware 测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build 和全量测试'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L2.2
  - type: references
    target: spec-knowledge-governance-L3.1.2-disposition
  - type: references
    target: spec-knowledge-governance-L3.2.1-scope
created: '2026-07-16T08:12:02.233Z'
updated: '2026-07-16T09:03:22.257Z'
changeSummary: 'cascade: task-complete'
---
# Governance Adoption Gates - 实施规格

## 目标

实施 `spec-knowledge-activation-hardening-L2.2` 的项目 adoption baseline、新 L1/L2 confirm 门禁、新 L3 learning policy 和 scope 完整性。

**前置依赖**: 无

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、父级 `spec-knowledge-activation-hardening-L2.2`、历史 Task 和 plan 模板，复核 config、Spec schema/policy、transition handler、lifecycle 与测试。

### Step 2 - 增加 adoption 配置读写
- 新增 `src/core/knowledge-governance-adoption.ts`，复用 YAML config 原子写入，提供 preview/read/enable 和 enabledAt 资产边界。

### Step 3 - 扩展 Spec learning schema
- 修改 `src/schemas/spec.ts`、`src/core/spec-io.ts` 和 policy patch，增加 `deliveryLearningReason`，保持旧 boolean 可读。

### Step 4 - 接入 confirm/freeze 门禁
- 修改 `src/core/spec-policy.ts` 与 `src/cli/spec-handlers.ts`：baseline 后 L1/L2 必须 historyReview + scopePlan，L3 必须 learning choice，false 必须 reason。

### Step 5 - 加固生命周期 scope 门禁
- 修改 `src/core/lifecycle.ts`，baseline 后 L1/L2 无 scopePlan 返回稳定 blocker，legacy 沿用旧行为。

### Step 6 - 增加 adoption CLI
- 修改 `src/cli/project.ts` 与必要 presenter，提供只读 preview 和显式 enable，不迁移历史资产。

### Step 7 - 补充 schema、policy、CLI 和 lifecycle 测试
- 覆盖 baseline 前后、false-with-reason、缺字段阻断、preview 零写入及 store-aware。

### Step 8 - 验证
- 运行定向测试、lint、build 和全量测试。

## 验证命令
```bash
npm test -- --run src/core/__tests__/spec-policy.test.ts src/core/__tests__/lifecycle.test.ts src/cli/__tests__/spec-handlers.test.ts src/cli/__tests__/project-workflow.test.ts
npm run lint
npm run build
npm test
```

## 验收标准
1. **AC-1**: adoption preview **SHALL** 只读，enable **SHALL** 显式记录 enabledAt 且不迁移历史资产。
2. **AC-2**: baseline 后新 L1/L2 缺 historyReview 或 scopePlan 时 **SHALL** 无法 confirmed。
3. **AC-3**: baseline 后新 L3 缺 learning choice，或 false 缺 reason 时 **SHALL** 无法 frozen。
4. **AC-4**: baseline 前资产和未启用项目 **SHALL** 保持现有读取与生命周期兼容。

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
{"coveredSpecs":["spec-knowledge-activation-hardening-L3.2.1"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、父 L2、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"新增 knowledge-governance-adoption.ts 实现 preview/read/enable"},{"stepNo":3,"stepType":"tool_action","name":"修改 Spec schema 和 IO 增加 deliveryLearningReason"},{"stepNo":4,"stepType":"tool_action","name":"修改 spec policy 和 handler 接入 confirm/freeze 门禁"},{"stepNo":5,"stepType":"tool_action","name":"修改 lifecycle.ts 强制新资产 scope 完整性"},{"stepNo":6,"stepType":"tool_action","name":"修改 project CLI 增加 adoption preview 和 enable"},{"stepNo":7,"stepType":"tool_action","name":"补充 schema、policy、CLI、lifecycle 和 store-aware 测试"},{"stepNo":8,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build 和全量测试"}]}
```

autoConfirm: false，enable 命令属于显式治理写操作，不在测试外自动调用。

## 回滚方案
| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 新门禁误伤 legacy | 禁用 knowledgeGovernance 配置并回退门禁接线 | < 10 min |
| schema 兼容失败 | 回退 reason 字段，保留旧 boolean 解析 | < 10 min |

## 执行风险
| 风险 | 应对 |
|---|---|
| 时间边界不稳定 | 使用持久化 enabledAt 与 Spec created 比较并注入测试时间 |
| Core 与 CLI 门禁漂移 | transition handler 只调用统一 policy validator |

## 关联
| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-activation-hardening-L2.2 | 父技术设计 |
| references | spec-knowledge-governance-L3.1.2-disposition | 复用 history gate |
| references | spec-knowledge-governance-L3.2.1-scope | 复用 scope gate |
