---
code: architecture-hardening-L3.1.1-task
level: L3
title: Task 生命周期与流程绕过修复
topic: architecture-hardening
parentCode: architecture-hardening-L2.1
status: implemented
aiSummary: 收紧 Task 生命周期：活动任务唯一、完成前成功 verification、终态不可变，并弃用 batch 自动成功。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 Task 生命周期实现与现有测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 创建 Task 领域守卫模块
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 收紧 Task create report verify complete
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 弃用 task batch 自动成功路径
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 补充 Task 生命周期回归测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证 Task 测试与类型检查
    status: pending
created: '2026-06-08T09:35:15.004Z'
updated: '2026-06-08T09:48:15.927Z'
changeSummary: 'cascade: task complete'
---
# Task 生命周期与流程绕过修复

## 目标

落实 `architecture-hardening-L2.1` 的 Task 生命周期约束，阻断自动伪造成功、冲突活动任务、完成后历史改写和无成功 verification 完成任务。

## 实施步骤

1. 在 `src/core/invariants.ts` 新增 Task 领域守卫与稳定错误码。
2. 在 `src/core/task.ts` 的 create/report/verify/complete 路径调用守卫。
3. 限制 stepNo 必须存在于原始计划，禁止运行期追加未计划步骤。
4. 要求 complete 前至少存在一条 `exitCode=0` verification。
5. 在 `src/cli/task.ts` 将 `task batch` 改为弃用错误，不再自动生成 succeeded 记录。
6. 更新 `src/core/__tests__/task-cascade.test.ts` 与 `src/cli/__tests__/task.test.ts`，覆盖全部新增门禁。

## 验收标准

- 对应 `architecture-hardening-L1` 的 AC-1、AC-2、AC-7、AC-8。
- completed/failed Task 的 step 和 verification 不可被普通 API 修改。
- 同一 L3 只能存在一个活动 Task。
- 无成功 verification 时 `completeTask` 必须失败。
- `task batch` 不得推进 Task 或 Spec 状态。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-hardening-L3.1.1-task"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 Task 生命周期实现与现有测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "创建 Task 领域守卫模块"},
    {"stepNo": 3, "stepType": "tool_action", "name": "收紧 Task create report verify complete"},
    {"stepNo": 4, "stepType": "tool_action", "name": "弃用 task batch 自动成功路径"},
    {"stepNo": 5, "stepType": "tool_action", "name": "补充 Task 生命周期回归测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证 Task 测试与类型检查"}
  ]
}
```

## 验证命令

```bash
npm test -- --run src/core/__tests__/task-cascade.test.ts src/cli/__tests__/task.test.ts
npm run lint
```

## 回滚

回滚 `src/core/invariants.ts` 中 Task 守卫、`src/core/task.ts` 与 `src/cli/task.ts` 的调用，以及对应测试。不得通过恢复自动成功行为解决兼容问题。

