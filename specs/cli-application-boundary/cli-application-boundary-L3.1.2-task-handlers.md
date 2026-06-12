---
code: cli-application-boundary-L3.1.2-task-handlers
level: L3
title: task CLI handler 与 presenter 垂直切片
topic: cli-application-boundary
parentCode: cli-application-boundary-L2.1
status: implemented
aiSummary: >-
  本 L3 规定 task CLI 的 report/verify 垂直切片迁移：新增 task-handlers.ts 承载 flags/input 到
  harness payload 的转换、core 调用和 presenter，改造 task.ts 的 report/verify action 只做
  runtime/handler/presenter 接线，并新增 task-handlers.test.ts 保持输出、JSON、错误和既有 task
  CLI 行为兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      上下文收集: 读取
      cli-application-boundary-L3.1.2-task-handlers、cli-application-boundary-L2.1、历史任务、agent-plan
      和 task CLI 锚点源码测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 src/cli/task-handlers.ts 实现 task report/verify handler
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 src/cli/task-handlers.ts 新增 task report/verify presenter
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 src/cli/task.ts 接入 task report/verify handler 和 presenter
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 新增 src/cli/__tests__/task-handlers.test.ts 覆盖 task handler 和 presenter
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: >-
      验证: npm test -- src/cli/__tests__/task-handlers.test.ts
      src/cli/__tests__/task.test.ts src/cli/__tests__/common.test.ts && npm
      test -- src/cli/__tests__/architecture-smoke.test.ts
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: >-
      验证: npm run lint && spec-manager project doctor && npm test --
      src/cli/__tests__/spec.test.ts
    status: pending
created: '2026-06-11T08:47:19.170Z'
updated: '2026-06-11T08:55:04.485Z'
changeSummary: 'cascade: task-complete'
---
# task CLI handler 与 presenter 垂直切片 — 实施规格

## 目标

承接 `cli-application-boundary-L3.1.1-runtime` 已落地的 CLI runtime 基础，将 `src/cli/task.ts` 中重复度最高且最适合垂直切片的 `task report` 与 `task verify` 命令迁移到独立 handler/presenter 边界。迁移后 Commander action 应主要负责注册参数并调用 handler/presenter，保持命令 flags、文本输出、JSON shape、stderr、exit code、task 存储和既有测试行为兼容。

本 L3 不迁移 `task create/start/step/complete/fail/wait/show/list/context/batch`，避免单次改动过大；`show` 可在后续或验证阶段继续评估。

## 代码调查

- `src/cli/task.ts` 当前约 477 行，`report` 与 `verify` action 都包含：
  - flags/input 文件互斥判断
  - CSV flags 解析
  - payload normalize 调用
  - core/harness 调用
  - JSON 输出或文本输出
  - 已知错误前缀 catch + `console.error` + `process.exit(2)`
- `src/cli/common.ts` 已提供 `CliActionContext`、`createDefaultCliActionContext`、`splitCsv`、`renderJson`、`printPresentedResult`、`runCliAction`，可作为本 L3 复用基础。
- `src/cli/__tests__/task.test.ts` 已覆盖 `task report` flags/input/json/error 路径和 `task verify` flags 路径，应保持通过。
- `src/core/harness.ts` 已提供 `normalizeHarnessTaskReportPayload`、`reportHarnessTaskStep`、`normalizeHarnessTaskVerificationPayload`、`recordHarnessTaskVerification`，handler 不应复制 harness 规则。
- `cli-application-boundary-L2.1` 明确 task CLI 的 `report/verify/show` 属于优先迁移范围；本 L3 选择 `report/verify` 作为最小安全切片。

## 实施步骤

> **RFC 2119 关键字指引**:
> - **SHALL** (必须) — 不执行则任务不可完成
> - **MUST** (应当) — 强烈建议，例外需说明理由
> - **SHOULD** (推荐) — 最佳实践，可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show cli-application-boundary-L3.1.2-task-handlers --include-content`。
- SHALL 执行 `spec-manager spec show cli-application-boundary-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic cli-application-boundary`，确认 `cli-application-boundary-L3.1.1-runtime` 的 task 已 completed。
- SHALL 读取 `templates/agent-plan.json`。
- SHALL 读取实现锚点：`src/cli/task.ts`、`src/cli/common.ts`、`src/core/harness.ts`、`src/cli/__tests__/task.test.ts`、`src/cli/__tests__/common.test.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 cli-application-boundary-L3.1.2-task-handlers、cli-application-boundary-L2.1、历史任务、agent-plan 和 task CLI 锚点源码测试分析","files":[]}
  ```

### Step 2 — 新增 task CLI handler/presenter 模块

- SHALL 新增 `src/cli/task-handlers.ts`。
- SHALL 定义 `TaskReportOptions`、`TaskVerifyOptions` 或等价输入类型，使 Commander opts 到 handler input 的边界可单独测试。
- SHALL 新增 `runTaskReportCommand(input)` 或等价 handler：
  - 接收 `CliActionContext`、`taskId`、`opts`
  - 处理 `--input` 与 flags 混用校验
  - 从 JSON 文件读取 input payload 或从 flags 构造 payload
  - 复用 `splitCsv`
  - 调用 `normalizeHarnessTaskReportPayload` 与 `reportHarnessTaskStep`
  - 返回适合 presenter 的结果对象
- SHALL 新增 `runTaskVerifyCommand(input)` 或等价 handler：
  - 校验 `layer` 是否属于 `VERIFICATION_LAYER_ORDER`
  - 处理 `--input` 与 flags 混用校验
  - 从 JSON 文件读取 verification payload 或从 flags 构造 payload
  - 复用 `splitCsv`
  - 调用 `normalizeHarnessTaskVerificationPayload` 与 `recordHarnessTaskVerification`
  - 返回适合 presenter 的结果对象
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 task report/verify handler，拆出 flags 到 harness payload 与 core 调用边界","files":["src/cli/task-handlers.ts"]}
  ```

### Step 3 — 新增 task report/verify presenter

- SHALL 在 `src/cli/task-handlers.ts` 或相邻模块中新增 presenter：
  - report 文本输出保持：
    - `✓ Task <taskId> report written`
    - `  step: <stepNo>`
    - warnings 输出格式保持 `⚠ <warning>`
  - verify 文本输出保持：
    - `✓ Task <taskId> verification <id> recorded`
    - `  exitCode: <exitCode>`
    - `  taskStatus: <status>`
  - JSON 输出保持现有行为：
    - report `--json` 输出 `reportHarnessTaskStep` 的原结果对象
    - verify `--json` 输出 `recordHarnessTaskVerification` 的原结果对象
- SHOULD 复用 `printPresentedResult` 和 `renderJson`，但若 warning 输出需要保留 `console.warn` 行为，可以在 presenter input 中显式记录。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 task report/verify presenter，保持文本输出和 JSON shape 兼容","files":["src/cli/task-handlers.ts"]}
  ```

### Step 4 — 接入 `src/cli/task.ts`

- SHALL 修改 `src/cli/task.ts` 的 `report` action，改为：
  - 创建默认 `CliActionContext`
  - 调用 `runCliAction` 或等价错误映射 helper
  - 调用 `runTaskReportCommand`
  - 调用 report presenter 输出
- SHALL 修改 `src/cli/task.ts` 的 `verify` action，改为同样模式。
- SHALL 移除或停止使用 `task.ts` 局部 `splitCsv`，避免与 `common.ts` 重复。
- SHALL 保持其他 task 子命令不变。
- 完成后 step_report outputJson:
  ```json
  {"summary":"将 task report/verify action 接入 handler/presenter/runtime，保留其他 task 命令不变","files":["src/cli/task.ts","src/cli/task-handlers.ts"]}
  ```

### Step 5 — 新增 task handler 单元测试

- SHALL 新增 `src/cli/__tests__/task-handlers.test.ts`。
- SHALL 使用临时项目 fixture 或现有 task 测试 helper 模式，覆盖：
  - report flags 成功路径，验证 step 状态和 outputJson files/tests
  - report input JSON 成功路径，验证返回 stepNo
  - report input 与 flags 混用错误为 `INVALID_REPORT` 或保持现有错误语义
  - verify flags 成功路径，验证 verification id、exitCode、layer
  - verify 非法 layer 错误保持 `process.exit:2` 等价语义或 handler 明确错误前缀
  - presenter text/json 输出保持现有关键字段
- SHOULD 尽量测试 handler/presenter，不重复完整 Commander 覆盖；完整 CLI 继续由 `task.test.ts` 覆盖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 task handler/presenter 单元测试覆盖 report/verify 成功、错误和输出路径","files":["src/cli/__tests__/task-handlers.test.ts"]}
  ```

### Step 6 — 运行 task CLI 专项验证

- SHALL 执行：
  `npm test -- src/cli/__tests__/task-handlers.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/common.test.ts`
- SHALL 预期全部 passed。
- SHALL 执行：
  `npm test -- src/cli/__tests__/architecture-smoke.test.ts`
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 task handler、task CLI、common runtime 和 architecture smoke 专项验证","files":[]}
  ```

### Step 7 — 运行类型检查与 project doctor

- SHALL 执行 `npm run lint`。
- SHALL 执行 `spec-manager project doctor`。
- SHOULD 执行 `npm test -- src/cli/__tests__/spec.test.ts`，确认未影响 spec CLI。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 lint、project doctor 和 spec CLI 回归验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: task handler 和 task CLI 行为兼容
npm test -- src/cli/__tests__/task-handlers.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/common.test.ts
# 预期输出包含: task-handlers.test.ts
# 预期输出包含: task.test.ts
# 预期输出包含: common.test.ts
# 预期输出包含: passed

# 正向验证: CLI 架构 smoke 仍通过
npm test -- src/cli/__tests__/architecture-smoke.test.ts
# 预期输出包含: architecture-smoke.test.ts
# 预期输出包含: passed

# 正向验证: TypeScript 类型检查通过
npm run lint
# 预期输出不包含: error TS

# 正向验证: 项目诊断保持 ok
spec-manager project doctor
# 预期输出包含: Project doctor: ok
```

## 验收标准

1. **AC-1**: `src/cli/task-handlers.ts` SHALL 承载 `task report` 和 `task verify` 的 flags/input 到 payload 转换与 core/harness 调用。
2. **AC-2**: `src/cli/task.ts` 的 `report` 和 `verify` Commander action SHALL 变薄，只负责 context/runtime/handler/presenter 接线。
3. **AC-3**: `task report` 与 `task verify` 的文本输出、JSON shape、stderr 和 exit code SHALL 保持既有测试兼容。
4. **AC-4**: `src/cli/__tests__/task-handlers.test.ts` SHALL 覆盖 handler/presenter 的成功、错误和输出路径。
5. **AC-5**: task handler 专项测试、task CLI 测试、common runtime 测试、architecture smoke、lint、project doctor SHALL 全部通过。

@verify: file-exists(src/cli/task-handlers.ts)
@verify: file-exists(src/cli/__tests__/task-handlers.test.ts)
@verify: command(npm test -- src/cli/__tests__/task-handlers.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/common.test.ts)
@verify: command(npm run lint)

## step_report 模板

每步完成后调用 `spec-manager task step`，不得预报。示例：

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["cli-application-boundary-L3.1.2-task-handlers"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取 cli-application-boundary-L3.1.2-task-handlers、cli-application-boundary-L2.1、历史任务、agent-plan 和 task CLI 锚点源码测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 src/cli/task-handlers.ts 实现 task report/verify handler"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 src/cli/task-handlers.ts 新增 task report/verify presenter"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 src/cli/task.ts 接入 task report/verify handler 和 presenter"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "新增 src/cli/__tests__/task-handlers.test.ts 覆盖 task handler 和 presenter"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "验证: npm test -- src/cli/__tests__/task-handlers.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/common.test.ts && npm test -- src/cli/__tests__/architecture-smoke.test.ts"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "验证: npm run lint && spec-manager project doctor && npm test -- src/cli/__tests__/spec.test.ts"}
  ]
}
```

autoConfirm: false。理由：本 L3 迁移 task CLI 用户可见命令路径，需人工确认冻结后实施。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| handler 边界导致输出回归 | 回退 `task.ts` 接入，保留或删除 `task-handlers.ts` 与测试 | < 10 min |
| JSON shape 漂移 | 调整 presenter 直接返回原 core result 对象 | < 5 min |
| 错误映射不兼容 | 回退为原 action catch 分支，保留测试暴露差异 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `task report` / `task verify` 错误路径与现有 CLI spy 测试不一致 | 先保留现有 `task.test.ts` 全量回归，再补 handler 单测 |
| presenter 复用 `printPresentedResult` 后 warning 输出从 `console.warn` 变为 `console.error` | 本 L3 应保持 task report 原 warning 输出语义；如需使用 context，测试必须锁定 |
| 迁移范围扩大到 show/list/complete | 严格限定 report/verify，其他命令不改 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| parent | cli-application-boundary-L2.1 | parent |
| requires | cli-application-boundary-L3.1.1-runtime | requires |
| references | cli-application-boundary-L1 | references |
