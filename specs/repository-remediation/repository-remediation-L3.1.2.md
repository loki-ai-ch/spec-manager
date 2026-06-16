---
code: repository-remediation-L3.1.2
level: L3
title: 显式仓库修复迁移命令
topic: repository-remediation
parentCode: repository-remediation-L2.1
status: implemented
aiSummary: 实现固定 repository-remediation-v1 清单、计划器、dry-run、事务化决策与豁免迁移及显式 CLI。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 收集迁移上下文并记录历史 Task 字节摘要
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 remediation.ts 固定清单与计划器
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 实现事务化决策与豁免迁移执行器
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 新增 project remediate CLI 与公共导出
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增迁移核心与 CLI 自动化测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证测试构建并确认当前仓库未真实迁移
    status: pending
created: '2026-06-08T09:57:38.644Z'
updated: '2026-06-08T10:07:26.241Z'
changeSummary: 'cascade: task complete'
---
# 显式仓库修复迁移命令 — 实施规格

## 目标

实施 `repository-remediation-L2.1` 的 TD-3、TD-4、TD-6：提供固定版本、可预览、事务化且幂等的仓库修复迁移命令。

**前置依赖**: `repository-remediation-L3.1.1` 已 implemented

## 实施步骤

### Step 1 — 上下文收集

- SHALL 读取 `repository-remediation-L3.1.2`、`repository-remediation-L2.1`、`repository-remediation-L3.1.1`、`templates/agent-plan.json`。
- SHALL 分析 `src/core/decision.ts`、`src/core/transaction.ts`、`src/core/integrity-exemptions.ts`、`src/cli/project.ts` 和相关测试。
- SHALL 读取四个目标 L1 及当前完整性问题，核对固定迁移清单。
- SHALL 记录 16 个历史 Task 文件的原始字节摘要。

### Step 2 — 实现固定迁移清单与计划器

- SHALL 新建 `src/core/remediation.ts`，定义唯一支持的迁移 ID `repository-remediation-v1`。
- SHALL 固定列出 4 个 Decision Card 输入和 16 个 `legacy-missing-verification` 豁免键，不得从 doctor 输出自动生成。
- SHALL 实现 `planRepositoryRemediation(options)`，将决策和豁免分类为 `create`、`skip` 或 conflict。
- SHALL 以 Decision `docCode` 和豁免双重键判断幂等；语义冲突必须阻止执行。

### Step 3 — 实现事务化迁移执行

- SHALL 实现 `applyRepositoryRemediation(options)`，执行前重新计划并拒绝任何 conflict。
- SHALL 在 `withProjectTransaction` 内调用 `createDecision` 并写入豁免登记。
- SHALL 不修改任何 Task 文件、spec 状态或 audit。
- SHALL 执行后重新计划，确保决策和豁免均为 `skip`。

### Step 4 — 增加 CLI 与公共导出

- SHALL 在 `src/cli/project.ts` 增加 `project remediate --migration <id> [--dry-run]`。
- SHALL 要求显式迁移 ID；未知 ID 以非零退出并给出支持列表。
- SHALL dry-run 只输出计划，不写项目文件；真实执行输出 created、skipped、conflicts。
- SHALL 在 `src/index.ts` 导出迁移计划和执行接口。

### Step 5 — 增加迁移测试

- SHALL 新建 `src/core/__tests__/remediation.test.ts`，覆盖固定范围、dry-run 零写入、幂等、冲突拒绝、事务回滚和 Task 字节不变。
- SHALL 新建或扩展 `src/cli/__tests__/project-remediate.test.ts`，覆盖缺失/未知迁移 ID、dry-run 和成功输出。

### Step 6 — 验证

- SHALL 运行定向测试、完整测试、lint、build 和 `git diff --check`。
- SHALL 不在当前仓库执行真实迁移；真实迁移留给依赖资产补齐后的 L3.1.3。

## 验证命令

```bash
# 正向验证：dry-run 与幂等迁移
npx vitest run src/core/__tests__/remediation.test.ts src/cli/__tests__/project-remediate.test.ts
# 预期：所有测试 passed

# 反向验证：未知 migration 与冲突计划拒绝写入
npm test
# 预期：所有测试 passed

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
  "coveredSpecs": ["repository-remediation-L3.1.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集迁移上下文并记录历史 Task 字节摘要"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 remediation.ts 固定清单与计划器"},
    {"stepNo": 3, "stepType": "tool_action", "name": "实现事务化决策与豁免迁移执行器"},
    {"stepNo": 4, "stepType": "tool_action", "name": "新增 project remediate CLI 与公共导出"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增迁移核心与 CLI 自动化测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "运行测试构建并确认当前仓库未真实迁移"}
  ]
}
```

`autoConfirm=false`：迁移会创建审计数据，必须人工确认。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 计划器范围错误 | 回退 `remediation.ts`、CLI 与测试，不执行真实迁移 | < 10 min |
| 事务执行中断 | 依赖 `withProjectTransaction` 自动恢复；检查 write lock 与测试快照 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| Decision ID 受现有数据影响 | 以 `docCode` 判重，由 `createDecision` 分配 topic 内 ID |
| dry-run 与 apply 状态漂移 | apply 开始时强制重新生成计划 |
