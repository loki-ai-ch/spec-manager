---
code: spec-manager-ai-ux-L3.1.4-batch
level: L3
title: CLI task batch 命令
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: 新增 task batch 子命令，一条命令完成 create→start→step×N→complete
created: '2026-06-05T04:30:23.856Z'
updated: '2026-06-05T17:55:22+08:00'
changeSummary: 同步方法论 R12：planJson coveredSpecs 使用 canonical specCode
---
# CLI task batch 命令 — 实施规格

## 目标

实施 spec-manager-ai-ux-L2.1 的 CLI task batch：新增 `task batch` 子命令，一条命令完成 create→start→step×N→complete。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- Read `src/cli/task.ts` — 确认现有 task 命令结构
- Read `src/core/task.ts` — 确认 createTask/startTask/reportStep/completeTask 接口
- Read `src/core/__tests__/task-cascade.test.ts` — 确认测试模式

### Step 2 — 在 task.ts 新增 batch 子命令

- **文件**: `src/cli/task.ts`
- **位置**: 在 `task` 命令组中新增 `batch` 子命令
- **接口**: `task batch <specCode> --plan <file> [--auto-confirm]`
- **逻辑**:
  1. 调用 `createTask()` 创建 task
  2. 调用 `startTask()` 启动
  3. 遍历 planJson.steps，对每个 step 调用 `reportStep()`（status=succeeded）
  4. 调用 `completeTask()` 完成
  5. 输出每步结果 + cascade 结果
- **错误处理**: 任一步骤失败时停止，task 状态为 failed
- 完成后 step_report outputJson:
  ```json
  {"summary": "task batch 子命令实现", "files": ["src/cli/task.ts"]}
  ```

### Step 3 — 编写 batch 测试

- **文件**: `src/core/__tests__/task-batch.test.ts`（新增）
- **用例**:
  - 正常 batch：4 步全部成功 → task completed + cascade
  - 中间失败：第 2 步失败 → task failed + 已上报步骤保留
- 完成后 step_report outputJson:
  ```json
  {"summary": "task-batch.test.ts 测试编写", "files": ["src/core/__tests__/task-batch.test.ts"]}
  ```

### Step 4 — 验证

- `pnpm test` 全部通过
- 手动测试 batch 命令

## 验证命令

```bash
# 正向验证: batch 命令存在
node dist/cli/index.js task batch --help
# 预期: 显示 batch 命令帮助

# 正向验证: 测试通过
pnpm test src/core/__tests__/task-batch.test.ts
# 预期: all tests pass
```

## planJson (final)

```json
{
  "coveredSpecs": ["spec-manager-ai-ux-L3.1.4-batch"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: task.ts CLI + core/task.ts + task-cascade.test.ts"},
    {"stepNo": 2, "stepType": "tool_action", "name": "在 src/cli/task.ts 新增 batch 子命令"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编写 task-batch.test.ts 测试"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证: pnpm test + 手动测试 batch"}
  ]
}
```

autoConfirm: true — 新增命令，不破坏现有功能。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 实现有 bug | `git revert <commit>` | < 2 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| batch 中 step report 的 outputJson 校验(R15) | batch 模式自动生成含 summary 的 outputJson |
