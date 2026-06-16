---
code: lifecycle-reconciliation-L3.1.3
level: L3
title: 显式历史状态对账
topic: lifecycle-reconciliation
parentCode: lifecycle-reconciliation-L2.1
status: implemented
aiSummary: >-
  新增 project reconcile 固定范围计划与事务执行，显式推进当前 6 个滞留规格、创建 3 个 Decision，并验证 Task
  不可变与幂等。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 收集对账上下文并记录 completed Task 与目标 spec 摘要
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 reconciliation.ts 固定清单与计划器
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 实现事务化状态与 Decision 对账执行器
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 新增 project reconcile CLI 与自动化测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 预览并执行当前仓库历史状态对账
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证 doctor、flow、幂等与 completed Task 字节不变
    status: pending
created: '2026-06-09T01:23:51.739Z'
updated: '2026-06-09T01:37:35.708Z'
changeSummary: 'cascade: task-complete'
---
# 显式历史状态对账 — 实施规格

## 目标

实施 `lifecycle-reconciliation-L2.1` 的 TD-4、TD-5：提供显式、事务化、幂等的历史状态对账，并完成当前仓库 6 个滞留规格和 3 个 Decision Card 修复。

**前置依赖**: `lifecycle-reconciliation-L3.1.1`、`lifecycle-reconciliation-L3.1.2` 已 implemented

## 实施步骤

### Step 1 — 上下文收集

- SHALL 读取 `lifecycle-reconciliation-L3.1.3`、`lifecycle-reconciliation-L2.1`、前序两个 L3、`templates/agent-plan.json`。
- SHALL 分析 `src/core/lifecycle.ts`、`src/core/remediation.ts`、`src/core/decision.ts`、`src/core/transaction.ts`、`src/cli/project.ts` 和对应测试。
- SHALL 记录全部 completed Task 文件摘要及六个目标 spec 原始内容。

### Step 2 — 实现对账计划器

- SHALL 新建 `src/core/reconciliation.ts`，固定六个状态目标和三个 Decision 输入。
- SHALL 实现 `planLifecycleReconciliation`，使用 lifecycle readiness 分类 implement、decision、skip 和 conflict。
- SHALL 将固定范围外的可对账 confirmed L1/L2 列为 conflict，不自动推进。
- SHALL 保证 dry-run 不写 spec、Decision、Task 或 audit。

### Step 3 — 实现事务化对账执行

- SHALL 实现 `applyLifecycleReconciliation`，执行前重新计划并拒绝 conflict。
- SHALL 在 `withProjectTransaction` 中按 L2 后 L1 顺序调用 lifecycle service。
- SHALL 仅在目标 L1 implemented 后创建固定 Decision Card，并以 docCode 幂等判重。
- SHALL 执行后重新计划，要求全部固定目标与 Decision 为 skip。
- SHALL 不读取或写入 completed Task 文件。

### Step 4 — 增加 CLI 与测试

- SHALL 在 `src/cli/project.ts` 增加 `project reconcile [--dry-run]`，输出 implementations、decisions、blocked。
- SHALL 在 `src/index.ts` 导出对账类型和 API。
- SHALL 新建 `src/core/__tests__/reconciliation.test.ts`，覆盖 dry-run、范围冲突、部分完成、事务、幂等、Decision 和 Task 字节不变。
- SHALL 新建 `src/cli/__tests__/project-reconcile.test.ts`，覆盖预览和执行输出。

### Step 5 — 预览并执行当前仓库对账

- SHALL 先运行 `project reconcile --dry-run`，确认仅包含固定六个状态和三个 Decision，无其他目标。
- SHALL 保存 completed Task 摘要后执行 `project reconcile`。
- SHALL 确认六个目标 spec 为 implemented，三个 Decision 可查询，Task 摘要不变。

### Step 6 — 最终验证

- SHALL 运行 `project doctor`，要求 Repository integrity 无问题。
- SHALL 检查三个 topic 的 flow 不再建议重复创建子规格。
- SHALL 重复 dry-run，所有固定目标和 Decision 必须为 skip，且无 conflict。
- SHALL 运行全量测试、lint、build 和 `git diff --check`。

## 验证命令

```bash
node dist/cli/index.js project reconcile --dry-run
node dist/cli/index.js project reconcile
node dist/cli/index.js project doctor
# 预期：仅修复固定目标；doctor ok

node dist/cli/index.js flow status --topic architecture-hardening
node dist/cli/index.js flow status --topic harness-coding
node dist/cli/index.js flow status --topic repository-remediation
# 预期：不包含 spec new L2 / spec new L3

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
  "coveredSpecs": ["lifecycle-reconciliation-L3.1.3"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集对账上下文并记录 completed Task 与目标 spec 摘要"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 reconciliation.ts 固定清单与计划器"},
    {"stepNo": 3, "stepType": "tool_action", "name": "实现事务化状态与 Decision 对账执行器"},
    {"stepNo": 4, "stepType": "tool_action", "name": "新增 project reconcile CLI 与自动化测试"},
    {"stepNo": 5, "stepType": "tool_action", "name": "预览并执行当前仓库历史状态对账"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证 doctor、flow、幂等与 completed Task 字节不变"}
  ]
}
```

`autoConfirm=false`：真实状态对账与 Decision 创建需要人工复核。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 对账范围错误 | 停止执行，回退 reconciliation 清单与测试 | < 10 min |
| 当前仓库状态误推进 | 恢复事务前六个 spec 快照并删除本次新建 Decision；不得修改 Task | < 15 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 动态 readiness 发现额外历史目标 | 计划器将清单外目标列为 conflict，阻止真实执行 |
| Decision 创建后状态回滚不完整 | Decision 与 spec 写入同一项目事务，并在失败时统一恢复 |
