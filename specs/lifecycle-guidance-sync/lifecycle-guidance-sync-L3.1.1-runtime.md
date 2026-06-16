---
code: lifecycle-guidance-sync-L3.1.1-runtime
level: L3
title: 完成绕过审计与 R18 活跃决策门禁
topic: lifecycle-guidance-sync
parentCode: lifecycle-guidance-sync-L2.1
status: implemented
aiSummary: 拆分 Task complete 异常绕过、强制原因与审计，并让 R18 只接受当前有效决策。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取运行时 L3/L2、历史任务、plan 模板与 Task/Decision/Audit 实现'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 Decision、Task 与 Integrity Core 共用活跃决策判定
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 Task complete CLI/Core 拆分跳过参数并拒绝旧 force
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 Audit 事件记录 Task complete 绕过能力与原因
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑运行时测试覆盖活跃决策、独立绕过、原因和审计
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: '验证: 运行运行时专项测试、全量测试、lint、build 与 diff 检查'
    status: pending
created: '2026-06-11T02:17:01.153Z'
updated: '2026-06-11T02:28:25.615Z'
changeSummary: 'cascade: task-complete'
---
# 完成绕过审计与 R18 活跃决策门禁

## 目标

收紧 Task complete 异常路径：拆分绕过能力、强制记录原因和审计，并让 R18 只接受当前有效决策。

## 实施步骤

### Step 1 — 收集运行时上下文

- SHALL 读取本 L3、父 L2、历史相关任务、`templates/agent-plan.json`。
- SHALL 读取 Task complete CLI/Core、Decision、Integrity、Audit 实现及相关测试。

### Step 2 — 提取活跃决策判定

- SHALL 在 Decision Core 提供共享活跃判定，排除 `superseded` 与 `partial`。
- SHALL 让 Task complete 与 Integrity 共用该判定。
- SHALL 保持历史决策查询和展示不变。

### Step 3 — 拆分完成绕过能力

- SHALL 将 CLI 异常参数拆分为 `--skip-r18` 与 `--skip-verification`。
- SHALL 要求任一跳过参数同时提供非空 `--reason`。
- SHALL 让旧 `--force` 明确失败并输出迁移指引。
- SHALL 在 Core 中使用独立选项，正常完成行为 MUST 保持不变。

### Step 4 — 写入绕过审计

- SHALL 新增结构化 Task complete bypass 审计事件。
- SHALL 记录 taskId、specCode、bypassedChecks 和 reason。
- SHALL 确保事务失败时不遗留成功绕过审计。

### Step 5 — 增加运行时回归测试

- SHALL 覆盖活跃决策成功、只有 superseded/partial 失败、正常完成不变。
- SHALL 覆盖独立跳过、组合跳过、空原因失败、旧 force 失败和审计 payload。

### Step 6 — 验证运行时门禁

- SHALL 运行专项测试、全量测试、lint、build 和 `git diff --check`。

## 验证命令

```bash
npx vitest run src/core/__tests__/decision.test.ts src/core/__tests__/task-cascade.test.ts src/core/__tests__/integrity.test.ts src/core/__tests__/task-complete-verify.test.ts src/cli/__tests__/task.test.ts
npm test
npm run lint
npm run build
git diff --check
```

## planJson (final)

```json
{
  "coveredSpecs": ["lifecycle-guidance-sync-L3.1.1-runtime"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取运行时 L3/L2、历史任务、plan 模板与 Task/Decision/Audit 实现"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 Decision、Task 与 Integrity Core 共用活跃决策判定"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 Task complete CLI/Core 拆分跳过参数并拒绝旧 force"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 Audit 事件记录 Task complete 绕过能力与原因"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑运行时测试覆盖活跃决策、独立绕过、原因和审计"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: 运行运行时专项测试、全量测试、lint、build 与 diff 检查"}
  ]
}
```

## 回滚方案

| 场景 | 回滚操作 |
|---|---|
| 共享活跃判定影响历史查询 | 仅在 R18 gate 使用 predicate，恢复查询路径 |
| 新参数破坏正常完成 | 保留正常路径，回退异常参数映射并修正测试 |
| 审计写入破坏事务 | 将事件写入移入既有事务边界并增加回滚测试 |

## 执行风险

| 风险 | 应对 |
|---|---|
| 当前工作树已有 Task 改动 | 增量编辑并逐段核对，不回退已有修改 |
| 旧自动化依赖 force | 返回明确迁移指引并同步公开文档 |
| partial 的业务定义不清 | 仅将完整且未 superseded 的决策视为 R18 活跃卡片 |
