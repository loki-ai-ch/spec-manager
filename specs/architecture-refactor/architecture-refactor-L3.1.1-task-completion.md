---
code: architecture-refactor-L3.1.1-task-completion
level: L3
title: 任务完成用例拆分
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  本 L3 规定任务完成用例拆分：新增 task-completion 模块与 runTaskCompletion，抽出具名完成门禁，保留
  completeTask、CLI 参数、结果字段和错误关键词兼容，并补充 task-completion 专项测试、全量测试、类型检查和 doctor
  验证。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      收集 task completion 上下文: 读取
      architecture-refactor-L3.1.1-task-completion、architecture-refactor-L2.1、历史任务、agent-plan
      和相关源码测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: '新增 task completion gate 模块: 编辑 src/core/task-completion.ts'
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: >-
      委托 completeTask 到 runTaskCompletion: 编辑 src/core/task.ts 和
      src/core/task-completion.ts
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      收口 completion 依赖导出: 检查
      src/core/task.ts、src/core/task-completion.ts、src/index.ts
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: '新增 task completion 单元测试: 编辑 src/core/__tests__/task-completion.test.ts'
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: '回归 CLI 和 harness 调用路径: 检查 src/cli/task.ts 和 src/core/harness.ts'
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证 task completion 重构: 运行 npm test、npm run lint、spec-manager project
      doctor
    status: pending
relations:
  - type: references
    target: lifecycle-guidance-sync-L3.1.1-runtime
  - type: based_on
    target: architecture-refactor-L2.1
  - type: references
    target: architecture-hardening-L3.1.1-task
created: '2026-06-11T07:11:09.157Z'
updated: '2026-06-11T07:22:11.318Z'
changeSummary: 'cascade: task-complete'
---
# 任务完成用例拆分 — 实施规格

## 目标

实施 architecture-refactor-L2.1 的任务完成用例拆分交付物：将 `completeTask` 的完成门禁和编排逻辑从 `src/core/task.ts` 拆出为具名 completion use case 与 gate，保持现有 `completeTask` API、CLI 行为、task/spec 存储格式兼容。

**前置依赖**: architecture-refactor-L2.1 已 confirmed。

## 代码调查

- `src/core/task.ts:375` 的 `completeTask` 当前包裹 `withProjectTransaction`，并在 `completeTaskUnlocked` 中串联状态检查、bypass reason、步骤完成检查、verification evidence、验证命令执行、`@verify` 执行、task JSON 写入、生命周期级联、R18 决策门禁和审计记录。
- `src/core/invariants.ts:19` 已提供 `assertTaskHasSuccessfulVerification`，可被 verification evidence gate 复用。
- `src/core/verify.ts:38`、`src/core/verify.ts:72`、`src/core/verify.ts:126` 已提供 `parseVerifyRules`、`executeVerifyRules`、`runCommand`，应迁入 verification gate 使用。
- `src/core/spec-sections.ts` 已提供 `extractVerificationCommands`、`truncateWithEllipsis`，其中验证命令提取继续由 gate 复用。
- `src/core/lifecycle.ts` 已提供 `cascadeImplementedHierarchy`，completion use case 继续调用并保持结果字段兼容。
- `src/cli/task.ts:292` 的 `task complete` 只依赖 `completeTask` 返回的 `task`、`cascadedSpecs`、`skippedSpecs`、`cascadedL1Specs`，本 L3 不改变 CLI 参数和输出语义。
- `src/core/__tests__/task-cascade.test.ts` 覆盖 R5、R18、回滚、bypass、终态等核心行为。
- `src/core/__tests__/task-complete-verify.test.ts` 覆盖验证命令和 `@verify` 正反向行为。

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show architecture-refactor-L3.1.1-task-completion --include-content`。
- SHALL 执行 `spec-manager spec show architecture-refactor-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic architecture-refactor`，确认同主题历史任务。
- SHALL 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `coveredSpecs`、`steps`、`stepNo`、`stepType`、`name`。
- SHALL 读取以下文件并记录实现锚点：`src/core/task.ts`、`src/core/invariants.ts`、`src/core/verify.ts`、`src/core/spec-sections.ts`、`src/core/lifecycle.ts`、`src/cli/task.ts`、`src/core/__tests__/task-cascade.test.ts`、`src/core/__tests__/task-complete-verify.test.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 architecture-refactor-L3.1.1-task-completion、architecture-refactor-L2.1、历史任务、planJson 和任务完成相关文件级分析","files":[]}
  ```

### Step 2 — 新增 completion gate 模块

- SHALL 新增 `src/core/task-completion.ts`。
- SHALL 在 `src/core/task-completion.ts` 中定义并导出 `CompletionGateName`、`CompletionGateResult`、`TaskCompletionInput`、`TaskCompletionResult`。
- SHALL 在 `src/core/task-completion.ts` 中实现具名 gate：
  - `validateCompletionBypass`
  - `runTaskStatusGate`
  - `runStepCompletionGate`
  - `runVerificationEvidenceGate`
  - `runVerificationCommandGate`
  - `runVerifyRuleGate`
  - `runDecisionGate`
- SHALL 保持 gate 失败时的用户可见错误信息兼容现有测试断言：`BYPASS_REASON_REQUIRED`、`R5`、`VERIFICATION_REQUIRED`、`验证命令失败`、`@verify 规则失败`、`R18`。
- SHOULD 让每个 gate 返回 `CompletionGateResult`，成功路径由 completion use case 聚合；失败路径可以继续抛出兼容错误。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 task completion gate 模块并迁入完成门禁判断","files":["src/core/task-completion.ts"]}
  ```

### Step 3 — 新增 completion use case 并保留 completeTask 兼容入口

- SHALL 在 `src/core/task-completion.ts` 中实现 `runTaskCompletion(input: TaskCompletionInput): TaskCompletionResult`。
- SHALL 将事务快照、task 标记 completed、`cascadeImplementedHierarchy`、implemented 后置校验、R18 审计和 bypass 审计保留在 `runTaskCompletion` 的编排内。
- SHALL 使 `runTaskCompletion` 返回兼容字段：`task`、`cascadedSpecs`、`cascadedL1Specs`、`skippedSpecs`；MAY 额外返回 `gateResults`。
- SHALL 修改 `src/core/task.ts`，让 `completeTask(input: CompleteInput): CompleteResult` 委托 `runTaskCompletion(input)`，并删除或停止使用原 `completeTaskUnlocked` 大块逻辑。
- SHALL 保持 `CompleteInput`、`CompleteResult`、`TaskRecord`、`TaskVerificationRecord`、`VerificationLayer` 现有导出不破坏。
- 完成后 step_report outputJson:
  ```json
  {"summary":"将 completeTask 改为兼容 facade，实际委托 runTaskCompletion 编排","files":["src/core/task.ts","src/core/task-completion.ts"]}
  ```

### Step 4 — 调整依赖导出与循环风险

- SHALL 检查 `src/core/task-completion.ts` 与 `src/core/task.ts` 的 import 方向，避免 `task-completion.ts` 从 `task.ts` 导入运行时值导致循环初始化风险。
- SHOULD 将 `TaskRecord`、`TaskVerificationRecord`、`CompleteInput`、`CompleteResult` 这类共享类型以 `import type` 使用。
- SHALL 如需写 task JSON，优先在 `task.ts` 暴露窄口径内部 helper，或在 `task-completion.ts` 内以明确函数实现写入，避免扩大公共 API 面。
- SHALL 如新增公共导出，更新 `src/index.ts`，但不得移除既有导出。
- 完成后 step_report outputJson:
  ```json
  {"summary":"收口 task completion 依赖方向并保持公共导出兼容","files":["src/core/task.ts","src/core/task-completion.ts","src/index.ts"]}
  ```

### Step 5 — 补充 task completion 单元测试

- SHALL 新增 `src/core/__tests__/task-completion.test.ts`。
- SHALL 覆盖成功路径：步骤成功、verification evidence 成功、验证命令成功、跳过 R18 且提供 reason 后 task completed。
- SHALL 覆盖反向路径：缺少 bypass reason 时抛出 `BYPASS_REASON_REQUIRED`。
- SHALL 覆盖反向路径：存在 pending 或 skipped 步骤时抛出 `R5`，且 task 保持 running。
- SHALL 覆盖反向路径：缺少 successful verification evidence 时抛出 `VERIFICATION_REQUIRED`。
- SHALL 覆盖反向路径：`@verify` 失败时抛出 `@verify 规则失败`。
- SHOULD 复用现有测试 fixture 写法，避免引入新的测试框架或外部依赖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 task completion 专项测试覆盖成功和反向门禁","files":["src/core/__tests__/task-completion.test.ts"]}
  ```

### Step 6 — 回归现有 CLI 与 harness 调用路径

- SHALL 确认 `src/cli/task.ts` 仍从 `src/core/task.ts` 导入 `completeTask`，无需改 CLI 命令参数。
- SHALL 确认 `src/core/harness.ts` 不需要感知 `task-completion.ts` 的内部 gate。
- SHOULD 如发现 `completeTask` 返回额外字段，保证现有 CLI JSON 输出仍包含原字段。
- 完成后 step_report outputJson:
  ```json
  {"summary":"确认 CLI 与 harness 继续通过 completeTask 兼容入口工作","files":["src/cli/task.ts","src/core/harness.ts"]}
  ```

### Step 7 — 验证

- SHALL 执行 `npm test`，预期输出包含 `Test Files  38 passed` 或更多 passed，且 `Tests` 全部 passed。
- SHALL 执行 `npm run lint`，预期 TypeScript noEmit 成功。
- SHALL 执行 `spec-manager project doctor`，预期输出包含 `Project doctor: ok`。
- SHALL 执行 `spec-manager spec show architecture-refactor-L3.1.1-task-completion`，预期 status 在任务完成前仍为 `frozen`，任务完成后由 `completeTask` 级联为 `implemented`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成测试、类型检查、doctor 和 spec 状态验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: 全量测试通过
npm test
# 预期输出包含: Test Files
# 预期输出包含: passed

# 正向验证: TypeScript 类型检查通过
npm run lint
# 预期输出不包含: error TS

# 正向验证: 项目诊断保持 ok
spec-manager project doctor
# 预期输出包含: Project doctor: ok

# 反向验证: task completion 专项测试覆盖失败门禁
npm test -- src/core/__tests__/task-completion.test.ts
# 预期输出包含: task-completion.test.ts
# 预期输出包含: passed
```

## 验收标准

1. **AC-1**: `src/core/task-completion.ts` SHALL 存在，并导出 `runTaskCompletion`。
2. **AC-2**: `src/core/task.ts` SHALL 继续导出 `completeTask`，且 CLI 无需改变调用参数。
3. **AC-3**: `completeTask` 成功结果 SHALL 保持 `task`、`cascadedSpecs`、`cascadedL1Specs`、`skippedSpecs` 字段兼容。
4. **AC-4**: pending/skipped step、缺少 verification、验证命令失败、`@verify` 失败、R18 缺 active 决策、缺 bypass reason 的用户可见错误关键词 MUST 与现有行为兼容。
5. **AC-5**: `npm test`、`npm run lint`、`spec-manager project doctor` SHALL 全部通过。

@verify: file-exists(src/core/task-completion.ts)
@verify: export-exists(src/core/task-completion.ts, runTaskCompletion)
@verify: export-exists(src/core/task.ts, completeTask)
@verify: command(npm test -- src/core/__tests__/task-completion.test.ts)

## step_report 模板

每步完成后调用 `spec-manager task step`，不得预报。示例：

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.1-task-completion"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集 task completion 上下文: 读取 architecture-refactor-L3.1.1-task-completion、architecture-refactor-L2.1、历史任务、agent-plan 和相关源码测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 task completion gate 模块: 编辑 src/core/task-completion.ts"},
    {"stepNo": 3, "stepType": "tool_action", "name": "委托 completeTask 到 runTaskCompletion: 编辑 src/core/task.ts 和 src/core/task-completion.ts"},
    {"stepNo": 4, "stepType": "tool_action", "name": "收口 completion 依赖导出: 检查 src/core/task.ts、src/core/task-completion.ts、src/index.ts"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 task completion 单元测试: 编辑 src/core/__tests__/task-completion.test.ts"},
    {"stepNo": 6, "stepType": "tool_action", "name": "回归 CLI 和 harness 调用路径: 检查 src/cli/task.ts 和 src/core/harness.ts"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证 task completion 重构: 运行 npm test、npm run lint、spec-manager project doctor"}
  ]
}
```

autoConfirm: false。理由：本 L3 涉及核心完成门禁与生命周期级联，task 执行过程中的 human gate 不应自动通过。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| completion use case 拆分导致行为回归 | `git revert <commit>` 后重新运行 `npm test` | < 5 min |
| 新模块引入循环依赖 | 回退 `src/core/task-completion.ts` 与 `src/core/task.ts` 的拆分提交，恢复原 `completeTask` 实现 | < 10 min |
| 测试 fixture 引入错误 | 回退 `src/core/__tests__/task-completion.test.ts`，保留生产代码后重新补测试 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `task-completion.ts` 与 `task.ts` 出现运行时循环依赖 | 使用 `import type` 传递类型；运行时 helper 保持单向依赖 |
| 错误消息细节改变导致既有测试失败 | 优先保留原错误字符串；新增 gate 名称放入结构化结果而不是替换用户可见错误 |
| 事务快照范围遗漏导致 R18 失败不回滚 | 保留当前 `listAllSpecs` 与 topic task 文件快照范围；新增测试断言 task/spec 状态回滚 |
| @verify 命令在任务完成时执行耗时 | 仅使用已有 `runCommand` 机制和现有 30s 超时，不新增慢命令 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | architecture-refactor-L2.1 | 引用父 L2 的任务完成用例拆分设计 |
| references | architecture-hardening-L3.1.1-task | 参考既有 Task 生命周期与流程绕过修复 |
| references | lifecycle-guidance-sync-L3.1.1-runtime | 参考完成绕过审计与 R18 门禁 |
