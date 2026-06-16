---
code: critical-ac-readiness-L3.1.3-topic-scope
level: L3
title: Critical Readiness Topic Upgrade Scope Fix
topic: critical-ac-readiness
parentCode: critical-ac-readiness-L2.1
status: implemented
aiSummary: >-
  修复 project readiness critical --topic 将局部 topic ready 误表达为项目级 governed default
  ready 的问题；topic 报告只给 scoped readiness，不给全局升级肯定结论。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取本 L3、critical readiness core 和 project readiness CLI 测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修正 topic 过滤时 governed upgrade note 和 readyForGovernedDefault 语义
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 更新 core/CLI 测试覆盖 topic 局部 ready 但项目未全局 ready
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行 vitest、build、spec validate 和 plan validate
    status: pending
created: '2026-06-16T08:40:21.713Z'
updated: '2026-06-16T08:55:42.986Z'
changeSummary: 'cascade: task-complete'
---
# Critical Readiness Topic Upgrade Scope Fix

## 背景

`critical-ac-readiness-L3.1.2-cli` 引入 `project readiness critical --topic <topic>`。当前实现用过滤后的 `items` 计算 `governedUpgrade.readyForGovernedDefault`，导致某个 topic 全 ready 时，即使项目其他 active L3 仍缺关键 AC，也会输出可考虑 governed default 的肯定提示。

这是范围语义错误：`--topic` 是分阶段修复视图，不能代表项目级 defaultProfile 升级条件。

## 目标

### 做

- 修正 `buildCriticalReadinessReport(paths, { topic })` 的 governed upgrade 语义。
- topic 过滤报告仍保留局部 totals、readinessRatio、items 和 recommendations。
- topic 过滤报告不得把局部 ready 表达为项目级 governed default ready。
- 增加 core/CLI 回归测试：included topic ready、excluded topic missing 时，topic report 的 governed upgrade 不为 true，且 note 明确需要运行全项目 readiness 或 adoption preview。

### 不做

- 不改变无 topic 的全项目 readiness 行为。
- 不改变 `project workflow preview`。
- 不新增 CLI 参数。
- 不修改方法论或 Agent 入口文案。

## 实施步骤

1. 读取本 L3、`src/core/critical-readiness.ts`、`src/core/__tests__/critical-readiness.test.ts`、`src/cli/__tests__/project-readiness.test.ts` 和 `src/cli/project.ts`。
2. 修改 core report 的 governed upgrade 计算：无 topic 时按全项目 totals；有 topic 时不得返回项目级 ready true，并在 note 中说明 topic report 仅代表 scoped readiness。
3. 更新 core/CLI 测试，覆盖 topic 局部 ready 但项目未全局 ready 的场景。
4. 运行聚焦 vitest、build、`spec-manager spec validate` 和 `spec-manager spec validate-plan`。

## 受影响文件

| 路径 | 变更 |
|---|---|
| `src/core/critical-readiness.ts` | 修正 topic scoped report 的 governed upgrade 语义 |
| `src/core/__tests__/critical-readiness.test.ts` | 增加/调整 topic scoped readiness 测试 |
| `src/cli/__tests__/project-readiness.test.ts` | 调整 JSON topic 测试预期 |

## 验收标准

1. **AC-1**: Given 项目存在 topic A ready、topic B missing, When 调用 `buildCriticalReadinessReport(paths, { topic: 'A' })`, Then `totals` SHALL 只统计 topic A。
2. **AC-2**: Given 项目存在 topic A ready、topic B missing, When 调用 topic report, Then `governedUpgrade.readyForGovernedDefault` SHALL NOT 为 `true`。
3. **AC-3**: Given topic report, When 查看 `governedUpgrade.note`, Then note SHALL 明确 topic report 不能代表项目级 governed default readiness。
4. **AC-4**: Given 不传 topic 且所有 active L3 ready, When 调用 full project report, Then `governedUpgrade.readyForGovernedDefault` SHALL 仍为 `true`。
5. **AC-5**: Given CLI JSON topic report, When included topic ready but excluded topic missing, Then JSON SHALL 保留 scoped totals 但不输出项目级 governed default ready。
6. **AC-6**: Given 修复完成, When 运行聚焦测试和 build, Then critical readiness core/CLI behavior SHALL pass.

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-5
- AC-6

## 验证命令

- `npx vitest run src/core/__tests__/critical-readiness.test.ts src/cli/__tests__/project-readiness.test.ts --reporter=dot`
- `npm run build`
- `spec-manager spec validate critical-ac-readiness-L3.1.3-topic-scope`
- `spec-manager spec validate-plan --from-spec critical-ac-readiness-L3.1.3-topic-scope`

## planJson (final)

```json
{
  "schemaVersion": "spec-manager.plan.v1",
  "spec": "critical-ac-readiness-L3.1.3-topic-scope",
  "coveredSpecs": ["critical-ac-readiness-L3.1.3-topic-scope"],
  "profile": "standard",
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取本 L3、critical readiness core 和 project readiness CLI 测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "修正 topic 过滤时 governed upgrade note 和 readyForGovernedDefault 语义"},
    {"stepNo": 3, "stepType": "tool_action", "name": "更新 core/CLI 测试覆盖 topic 局部 ready 但项目未全局 ready"},
    {"stepNo": 4, "stepType": "tool_action", "name": "运行 vitest、build、spec validate 和 plan validate"}
  ]
}
```

## 回滚方案

若修复导致 readiness report 回归，回退 `src/core/critical-readiness.ts` 与相关测试变更，恢复 topic report 原行为；无 topic 全项目 report 不应受影响。
