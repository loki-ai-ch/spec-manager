---
code: spec-knowledge-governance-L3.2.1-scope
level: L3
title: Scope Plan and Lifecycle Completeness Gate
topic: spec-knowledge-governance
parentCode: spec-knowledge-governance-L2.2
status: implemented
aiSummary: >-
  实施 scopePlan schema、scope readiness、implemented ancestor drift 检测与 lifecycle
  cascade 完整性门禁；open、missing、incomplete 阻断级联，legacy 保持兼容，并固定已观察提前完成事故回归。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3/L2、历史 Task、agent-plan 和 lifecycle 调用链'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 spec schema 并新增 scopePlan 更新服务
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 新增 scope readiness 核心投影
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 lifecycle.ts 接入计划子级完整性门禁
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 spec-policy.ts 检测 implemented ancestor scope drift
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 新增 scope CLI、生命周期、readiness 和兼容回归测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行 scope 定向测试、npm run build 和全量 Vitest'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-governance-L2.2
  - type: references
    target: spec-knowledge-governance-L2.1
created: '2026-07-16T05:45:18.138Z'
updated: '2026-07-16T05:56:21.680Z'
changeSummary: 'cascade: task-complete'
---
# Scope Plan and Lifecycle Completeness Gate — 实施规格

## 目标

实施 `spec-knowledge-governance-L2.2` 的 scopePlan、scope readiness、implemented ancestor drift 检测与生命周期级联门禁，覆盖 AC-6。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集
- **SHALL** 读取本 L3、`spec-knowledge-governance-L2.2`、历史 Task 和 agent-plan 模板。
- **SHALL** 复核 `src/schemas/spec.ts`、`src/core/spec-io.ts`、`src/core/spec-policy.ts`、`src/core/lifecycle.ts`、`src/core/task-completion.ts` 及相关测试。

### Step 2 — 增加 scopePlan schema 与更新服务
- **SHALL** 定义 open/fixed、plannedChildren、reason、updatedAt；校验 code 唯一、直接子级层级和 open reason。
- **SHALL** 保持无 scopePlan 的 legacy frontmatter 可读且不补写字段。
- **SHALL** 实现 scope set/show 核心服务，fixed 允许显式 leaf，所有更新走 `updateSpec`。

### Step 3 — 实现 scope readiness
- **SHALL** 新增只读 readiness 投影，逐项返回 ready/blocked/legacy、missingChildren、incompleteChildren 和修复建议。
- **SHALL** 提供 project/topic 两种范围和稳定排序；不得创建或修改 Spec。

### Step 4 — 接入生命周期级联门禁
- **SHALL** 在 `cascadeImplementedHierarchy` 判断实际子级之前检查 scopePlan。
- **SHALL** open、required missing、required/已创建 optional incomplete 分别产生稳定 skipped reason，保持声明者状态不变。
- **SHALL** 无字段继续使用现有实际子级语义。

### Step 5 — 阻止 implemented ancestor scope drift
- **SHALL** 在创建子 Spec 和修改 scopePlan 时检测 implemented ancestor，默认返回 `LIFECYCLE_SCOPE_DRIFT`。
- **SHALL** 不自动逆转 implemented；显式 remediation 只记录修复事实和建议，不静默改历史。

### Step 6 — 增加 CLI 与回归测试
- **SHALL** 挂载 `spec scope set/show` 与 `project readiness scope [--topic] [--json]`。
- **SHALL** 覆盖 open、missing、incomplete、ready、legacy、store-aware、零写入和 drift。
- **SHALL** 固定 `spec-knowledge-governance-L1` 在第二个 L2 未创建时提前完成的等价夹具。

### Step 7 — 验证
- **SHALL** 运行 scope 定向测试、TypeScript build 和全量 Vitest。

## 验证命令
```bash
npm test -- --run src/core/__tests__/lifecycle.test.ts src/core/__tests__/task-cascade.test.ts src/core/__tests__/spec-policy.test.ts src/core/__tests__/scope-readiness.test.ts src/cli/__tests__/project-readiness.test.ts src/cli/__tests__/spec.test.ts
# 预期: Test Files 与 Tests 全部 passed
npm run build
# 预期: tsc 退出码 0
npm test -- --run
# 预期: 全部 passed
npm test -- --run src/core/__tests__/scope-readiness.test.ts -t "blocks open scope|reports missing planned child|keeps legacy behavior|detects observed premature cascade"
# 预期: 4 个目标用例 passed
```

## 验收标准
1. **AC-6**: open 或计划子级 missing/incomplete 时，上位 Spec 不得级联 implemented，并返回精确缺口。
2. **AC-10**: legacy Spec 无 scopePlan 时保持现有读取与级联语义。
3. **AC-9**: readiness 只读，drift 检测不自动逆转或修改状态。

## 关键验收标准
- AC-6
- AC-9
- AC-10

## step_report 模板
```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)
```json
{"coveredSpecs":["spec-knowledge-governance-L3.2.1-scope"],"steps":[
{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3/L2、历史 Task、agent-plan 和 lifecycle 调用链"},
{"stepNo":2,"stepType":"tool_action","name":"修改 spec schema 并新增 scopePlan 更新服务"},
{"stepNo":3,"stepType":"tool_action","name":"新增 scope readiness 核心投影"},
{"stepNo":4,"stepType":"tool_action","name":"修改 lifecycle.ts 接入计划子级完整性门禁"},
{"stepNo":5,"stepType":"tool_action","name":"修改 spec-policy.ts 检测 implemented ancestor scope drift"},
{"stepNo":6,"stepType":"tool_action","name":"新增 scope CLI、生命周期、readiness 和兼容回归测试"},
{"stepNo":7,"stepType":"tool_action","name":"验证: 运行 scope 定向测试、npm run build 和全量 Vitest"}
]}
```

`autoConfirm` 为 false：范围收敛和 drift 修复需要人工确认。

## 回滚方案
| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 门禁误阻断 | 回退 scope gate，保留可选 frontmatter | < 10 min |
| schema 回归 | 回退 scopePlan schema；legacy 不受影响 | < 5 min |

## 执行风险
| 风险 | 应对 |
|---|---|
| 计划 code 与自动编号冲突 | 创建前按同一 `generateSpecCode` 规则校验 |
| 历史 implemented 漂移无法降级 | 报告并走显式 remediation，不篡改审计 |

## 关联
| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-governance-L2.2 | 实施 scope completeness |
| references | spec-knowledge-governance-L2.1 | 复用兼容治理原则 |
