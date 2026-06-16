---
code: lifecycle-reconciliation-L3.1.1
level: L3
title: 统一分层生命周期级联
topic: lifecycle-reconciliation
parentCode: lifecycle-reconciliation-L2.1
status: implemented
aiSummary: >-
  新增统一 lifecycle readiness 与受控 transition authority，用其替换 Task frozen-only 级联，使
  frozen L3、confirmed L2/L1 按层级条件递归 implemented。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 收集生命周期调用关系并记录 completed Task 摘要
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 lifecycle.ts 分层 readiness 判断
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 spec-io.ts 实现受控 transition authority
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 task.ts 使用统一递归生命周期级联
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增生命周期和 Task 级联自动化测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证测试构建与 completed Task 字节不变
    status: pending
created: '2026-06-09T01:23:46.867Z'
updated: '2026-06-09T01:29:11.968Z'
changeSummary: 'cascade: task-complete'
---
# 统一分层生命周期级联 — 实施规格

## 目标

实施 `lifecycle-reconciliation-L2.1` 的 TD-1、TD-2、TD-3：建立统一分层 readiness 与受控 implemented 级联，并替换 Task 的 frozen-only 级联。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- SHALL 读取 `lifecycle-reconciliation-L3.1.1`、`lifecycle-reconciliation-L2.1`、`templates/agent-plan.json`。
- SHALL 分析 `src/core/status.ts`、`src/core/spec-io.ts`、`src/core/task.ts`、`src/core/transaction.ts` 和 `src/core/__tests__/task-cascade.test.ts` 的调用关系。
- SHALL 记录全部 completed Task 文件摘要，实施期间不得变化。

### Step 2 — 实现生命周期 readiness

- SHALL 新建 `src/core/lifecycle.ts`，定义 `ImplementationAuthority`、`ImplementationReadiness`、`LifecycleCascadeResult`。
- SHALL 实现 `assessImplementationReadiness`：L3 要求 task-complete + frozen；L1/L2 要求 confirmed + 至少一个直接子规格 + 全部直接子规格 implemented。
- SHALL 对 missing、draft、archived、部分完成、无子规格和 authority 不匹配返回结构化 blocker。

### Step 3 — 实现受控状态转换

- SHALL 扩展 `updateSpec` 内部 options，支持 `transitionAuthority`。
- SHALL 仅允许带 lifecycle authority 的 confirmed L1/L2 → implemented 特殊转换。
- SHALL 保持 `canTransition('confirmed', 'implemented')` 为 false，普通 CLI、测试和其他 core 调用不得获得该能力。

### Step 4 — 实现统一递归级联并接入 Task

- SHALL 在 `src/core/lifecycle.ts` 实现 `cascadeImplementedHierarchy`，返回 cascaded/skipped 结果并为每次写入记录 authority changeSummary。
- SHALL 删除 `src/core/task.ts` 私有 `cascadeImplemented` 与重复子规格判断，改为调用 lifecycle service。
- SHALL 保持 Task 完成前 L3 frozen、步骤成功和成功 verification 门禁不变。
- SHALL 保持 `CompleteResult` 和 CLI 输出兼容。

### Step 5 — 增加生命周期与级联测试

- SHALL 新建 `src/core/__tests__/lifecycle.test.ts` 覆盖 L3/L2/L1 readiness、authority、无子规格、部分完成和非法状态。
- SHALL 修改 `src/core/__tests__/task-cascade.test.ts`，使用 confirmed L1/L2 验证完整级联，并证明普通 updateSpec 仍拒绝 confirmed → implemented。
- SHALL 在 `src/index.ts` 导出生命周期公共类型与只读 readiness API。

### Step 6 — 验证

- SHALL 运行定向测试、全量测试、lint、build 和 `git diff --check`。
- SHALL 比较 completed Task 摘要，结果必须一致。

## 验证命令

```bash
npx vitest run src/core/__tests__/lifecycle.test.ts src/core/__tests__/task-cascade.test.ts
# 预期：分层 readiness 与 confirmed L1/L2 级联测试全部 passed

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
  "coveredSpecs": ["lifecycle-reconciliation-L3.1.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集生命周期调用关系并记录 completed Task 摘要"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 lifecycle.ts 分层 readiness 判断"},
    {"stepNo": 3, "stepType": "tool_action", "name": "修改 spec-io.ts 实现受控 transition authority"},
    {"stepNo": 4, "stepType": "tool_action", "name": "修改 task.ts 使用统一递归生命周期级联"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增生命周期和 Task 级联自动化测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证测试构建与 completed Task 字节不变"}
  ]
}
```

`autoConfirm=false`：状态推进语义变化需要人工核验。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 级联误推进 | 回退 lifecycle、spec-io、task 变更并恢复本任务造成的 spec 状态变化 | < 15 min |
| completed Task 变化 | 停止任务并根据实施前摘要恢复本任务引入的变化 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| authority 被其他调用滥用 | authority 不暴露为 CLI 参数，并由 readiness 二次校验 |
| 递归级联形成重复写入 | implemented 作为幂等 skip，递归只沿 parentCode 单向进行 |
