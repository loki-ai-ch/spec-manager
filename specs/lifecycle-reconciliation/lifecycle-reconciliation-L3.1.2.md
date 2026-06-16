---
code: lifecycle-reconciliation-L3.1.2
level: L3
title: Flow 提示与滞留状态诊断
topic: lifecycle-reconciliation
parentCode: lifecycle-reconciliation-L2.1
status: implemented
aiSummary: >-
  让 flow、upstream advice 与 doctor 复用 lifecycle readiness，正确提示待对账 confirmed L1/L2
  并诊断 stale-confirmed-parent。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 收集 flow、guide、doctor 与 readiness 调用上下文
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 usability.ts 修正 flow 下一步判断
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 usability.ts 修正 upstream advice
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 integrity.ts 新增滞留 confirmed 诊断
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 flow、doctor 与完整性只读测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证测试构建与只读命令零写入
    status: pending
created: '2026-06-09T01:23:51.622Z'
updated: '2026-06-09T01:33:02.705Z'
changeSummary: 'cascade: task-complete'
---
# Flow 提示与滞留状态诊断 — 实施规格

## 目标

实施 `lifecycle-reconciliation-L2.1` 的 TD-6、TD-7：让 flow 和 doctor 基于统一 readiness 正确识别已完成但待对账的 confirmed L1/L2。

**前置依赖**: `lifecycle-reconciliation-L3.1.1` 已 implemented

## 实施步骤

### Step 1 — 上下文收集

- SHALL 读取 `lifecycle-reconciliation-L3.1.2`、`lifecycle-reconciliation-L2.1`、`lifecycle-reconciliation-L3.1.1`、`templates/agent-plan.json`。
- SHALL 分析 `src/core/usability.ts`、`src/core/integrity.ts`、flow/guide/doctor CLI 与对应测试。

### Step 2 — 修正 flow 下一步判断

- SHALL 修改 `suggestNextActionForTopic`，仅在 confirmed L1/L2 无直接子规格时建议创建下一层。
- SHALL 在 confirmed L1/L2 直接子规格全部 implemented 时建议 `spec-manager project reconcile --dry-run`。
- SHALL 在存在未完成子规格时优先返回现有 draft/frozen/task 下一步，不重复建议创建同层子规格。
- SHALL 修改 `suggestAfterSpecCommand`，对 confirmed L1/L2 使用同样的子规格存在性/readiness 判断。

### Step 3 — 修正 upstream advice

- SHALL 修改 `getUpstreamFreezeAdviceForSpecs` 的文案与判断：confirmed L1/L2 是合法上游状态，会在全部直接子规格 implemented 后级联。
- SHALL 仅对真正阻止级联的 draft、archived、缺失或异常状态给出警告。

### Step 4 — 增加滞留状态完整性诊断

- SHALL 在 `src/core/integrity.ts` 增加 `stale-confirmed-parent`。
- SHALL 仅对 confirmed L1/L2 且存在直接子规格、全部直接子规格 implemented 的规格报告问题。
- SHALL remediation 指向 `spec-manager project reconcile --dry-run`。

### Step 5 — 增加只读行为测试

- SHALL 扩展 `src/core/__tests__/usability.test.ts`，覆盖无子规格、部分完成、全部完成、全树 implemented 和 upstream advice。
- SHALL 扩展 `src/core/__tests__/integrity.test.ts`，覆盖 stale-confirmed-parent 正向与反向场景。
- SHALL 扩展 CLI flow/doctor 测试，确认输出建议准确且只读命令不修改 spec/Task。

### Step 6 — 验证

- SHALL 运行定向测试、全量测试、lint、build 和 `git diff --check`。

## 验证命令

```bash
npx vitest run src/core/__tests__/usability.test.ts src/core/__tests__/integrity.test.ts src/cli/__tests__/usability.test.ts
# 预期：flow、upstream advice 和 stale-confirmed-parent 测试全部 passed

npm test
npm run lint
npm run build
git diff --check
# 预期：均退出码 0
```

## step_report 模板

```json
{"taskId":"<task id>","stepNo":<stepNo>,"stepType":"tool_action","status":"succeeded","toolName":"<实际工具>","latencyMs":"<实际耗时>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"}
```

## planJson (final)

```json
{
  "coveredSpecs": ["lifecycle-reconciliation-L3.1.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集 flow、guide、doctor 与 readiness 调用上下文"},
    {"stepNo": 2, "stepType": "tool_action", "name": "修改 usability.ts 修正 flow 下一步判断"},
    {"stepNo": 3, "stepType": "tool_action", "name": "修改 usability.ts 修正 upstream advice"},
    {"stepNo": 4, "stepType": "tool_action", "name": "修改 integrity.ts 新增滞留 confirmed 诊断"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 flow、doctor 与完整性只读测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证测试构建与只读命令零写入"}
  ]
}
```

`autoConfirm=false`：用户下一步提示和 doctor 诊断变化需要人工核验。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| flow 建议回归 | 回退 usability 与测试变更，保留生命周期服务 | < 10 min |
| doctor 误报 | 回退 stale-confirmed-parent 分支与对应测试 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 新诊断把无子规格 confirmed 误判为滞留 | 必须要求直接子规格数量大于 0 |
| flow 选择错误优先级 | 保留 draft/frozen/running task 分支优先于 reconcile 建议 |
