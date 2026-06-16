---
code: cli-application-boundary-L3.1.1-runtime
level: L3
title: CLI runtime 与 presenter 基础边界
topic: cli-application-boundary
parentCode: cli-application-boundary-L2.1
status: implemented
aiSummary: >-
  本 L3 规定 CLI runtime 基础边界：扩展 src/cli/common.ts，新增可注入 action
  context、CSV/JSON/presenter helper 和 runCliAction 已知错误映射，并新增 common.test.ts
  锁定行为，为后续 task/spec CLI handler 迁移做准备。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取
      cli-application-boundary-L3.1.1-runtime、cli-application-boundary-L2.1、历史任务、agent-plan
      和 CLI 锚点源码测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/cli/common.ts 新增 CLI action context 和默认 context
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/cli/common.ts 新增 CSV、JSON 和 presenter helper
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/common.ts 新增 runCliAction 已知错误映射 helper
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 src/cli/__tests__/common.test.ts 覆盖 runtime helper 行为
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      验证: npm test -- src/cli/__tests__/common.test.ts
      src/cli/__tests__/task.test.ts src/cli/__tests__/spec.test.ts
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证: npm run lint && spec-manager project doctor && npm test --
      src/cli/__tests__/architecture-smoke.test.ts
    status: pending
created: '2026-06-11T08:40:36.111Z'
updated: '2026-06-11T08:46:23.759Z'
changeSummary: 'cascade: task-complete'
---
# CLI runtime 与 presenter 基础边界 — 实施规格

## 目标

为 `cli-application-boundary-L2.1` 的后续 task/spec handler 迁移建立最小 CLI runtime 基础。此 L3 只扩展 `src/cli/common.ts` 并新增聚焦测试，不迁移 `src/cli/task.ts` 或 `src/cli/spec.ts` 的命令实现，确保后续 L3 可以复用统一的输出、错误映射、CSV 参数解析和 JSON/text presenter 边界。

## 代码调查

- `src/cli/common.ts` 当前只有 `fail`、`requireInitialized`、`printPathGroup`，直接依赖 `console.error` 和 `process.exit`，缺少可注入 context。
- `src/cli/task.ts` 内部重复存在 `splitCsv`、`JSON.stringify(result, null, 2)`、`console.log`、已知错误前缀映射和 `process.exit(2)`。
- `src/cli/spec.ts` 内部使用 `fail`、`console.log`、`console.warn` 和状态推进输出，后续迁移需要稳定 presenter/runtime 基础。
- `src/cli/__tests__/task.test.ts`、`src/cli/__tests__/spec.test.ts` 依赖 console/process spies，说明 runtime helper 必须保持默认全局输出行为兼容，同时允许单元测试注入 sink。
- `cli-application-boundary-L2.1` 明确本 L3 范围是扩展 `src/cli/common.ts`，提供轻量 runtime/presenter 基础类型、错误映射 helper、CSV/JSON flags helper，并以小测试锁定行为。

## 实施步骤

> **RFC 2119 关键字指引**:
> - **SHALL** (必须) — 不执行则任务不可完成
> - **MUST** (应当) — 强烈建议，例外需说明理由
> - **SHOULD** (推荐) — 最佳实践，可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show cli-application-boundary-L3.1.1-runtime --include-content`。
- SHALL 执行 `spec-manager spec show cli-application-boundary-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic cli-application-boundary`。
- SHALL 读取 `templates/agent-plan.json`。
- SHALL 读取实现锚点：`src/cli/common.ts`、`src/cli/task.ts`、`src/cli/spec.ts`、`src/cli/__tests__/task.test.ts`、`src/cli/__tests__/spec.test.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 cli-application-boundary-L3.1.1-runtime、cli-application-boundary-L2.1、历史任务、agent-plan 和 CLI 锚点源码测试分析","files":[]}
  ```

### Step 2 — 扩展 CLI runtime 基础类型与默认 context

- SHALL 修改 `src/cli/common.ts`，新增可复用类型或等价结构：
  - `CliActionContext`
  - `CliKnownError`
  - `CliTextPresenter<T>` 或等价 presenter 类型
- SHALL 新增 `createDefaultCliActionContext()`，默认行为保持：
  - `log(message)` 调用 `console.log(message)`
  - `error(message)` 调用 `console.error(message)`
  - `write(message)` 或 `stdout.write(message)` 调用 `process.stdout.write(message)`
  - `exit(code)` 调用 `process.exit(code)`
  - `paths` 默认来自 `getPaths()`
- SHALL 保留现有 `fail`、`requireInitialized`、`printPathGroup` 的导出和行为。
- SHOULD 避免让 common.ts 依赖 task/spec 具体模块，保持基础层无循环依赖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"扩展 CLI 默认 context 和基础类型，保留既有 common.ts API 行为","files":["src/cli/common.ts"]}
  ```

### Step 3 — 增加 CSV/JSON/presenter helper

- SHALL 在 `src/cli/common.ts` 新增 `splitCsv(value?: string): string[] | undefined` 或等价 helper，并让空字符串返回空数组或 undefined 的行为在测试中明确。
- SHALL 新增 `renderJson(value: unknown): string` 或等价 helper，输出 `JSON.stringify(value, null, 2)`。
- SHALL 新增 `printPresentedResult` 或等价 helper，支持：
  - `json=true` 时输出 presenter 的 JSON 值或原始值
  - `json=false` 时逐行输出 text lines
  - warnings 可通过 context 的 error/log 兼容输出，具体行为需测试锁定
- SHALL 本 L3 不强制改 `task.ts` 使用新 `splitCsv`；后续 L3 再迁移调用方。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 CSV、JSON 和 presenter 输出 helper，为后续 task/spec handler 迁移提供基础","files":["src/cli/common.ts"]}
  ```

### Step 4 — 增加已知错误映射 runtime helper

- SHALL 新增 `runCliAction` 或等价 helper，支持执行 sync/async action。
- SHALL 对已知错误前缀进行映射：
  - 输入 `knownErrors: [{ prefix, exitCode }]`
  - 若 `Error.message` 以 prefix 开头，输出 `✗ ${message}` 到 stderr 并调用 `exit(exitCode)`
- SHALL 未匹配的错误继续 throw，不吞掉未知 bug。
- SHALL 支持 action 正常返回后由 caller/presenter 控制输出，不强制绑定具体命令。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 runCliAction 已知错误映射 helper，未知错误保持抛出","files":["src/cli/common.ts"]}
  ```

### Step 5 — 新增 common runtime 单元测试

- SHALL 新增 `src/cli/__tests__/common.test.ts`。
- SHALL 测试默认或注入 context 的输出行为，避免必须真实退出进程。
- SHALL 覆盖：
  - `splitCsv` 对 undefined、空字符串、逗号列表、空项的处理
  - `renderJson` 的两空格缩进
  - `printPresentedResult` 的 text/json 输出
  - `runCliAction` 正常返回
  - `runCliAction` 对已知错误映射 stderr 与 exit code
  - `runCliAction` 对未知错误继续 throw
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 common runtime 单元测试覆盖 CSV、JSON、presenter 和错误映射行为","files":["src/cli/__tests__/common.test.ts"]}
  ```

### Step 6 — 运行 CLI runtime 专项验证

- SHALL 执行：
  `npm test -- src/cli/__tests__/common.test.ts`
- SHALL 执行：
  `npm test -- src/cli/__tests__/task.test.ts src/cli/__tests__/spec.test.ts`
- SHALL 预期全部 passed，证明新增 runtime 不破坏现有 task/spec CLI。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 common runtime 专项测试和 task/spec CLI 回归测试","files":[]}
  ```

### Step 7 — 运行类型检查与 project doctor

- SHALL 执行 `npm run lint`。
- SHALL 执行 `spec-manager project doctor`。
- SHOULD 执行 `npm test -- src/cli/__tests__/architecture-smoke.test.ts` 作为额外 smoke。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 lint、project doctor 和 architecture smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: common runtime helper 单元测试通过
npm test -- src/cli/__tests__/common.test.ts
# 预期输出包含: common.test.ts
# 预期输出包含: passed

# 正向验证: 既有 task/spec CLI 行为兼容
npm test -- src/cli/__tests__/task.test.ts src/cli/__tests__/spec.test.ts
# 预期输出包含: task.test.ts
# 预期输出包含: spec.test.ts
# 预期输出包含: passed

# 正向验证: TypeScript 类型检查通过
npm run lint
# 预期输出不包含: error TS

# 正向验证: 项目诊断保持 ok
spec-manager project doctor
# 预期输出包含: Project doctor: ok
```

## 验收标准

1. **AC-1**: `src/cli/common.ts` SHALL 导出可注入的 CLI action context 或等价结构，并保持 `fail`、`requireInitialized`、`printPathGroup` 兼容。
2. **AC-2**: `src/cli/common.ts` SHALL 提供 CSV/JSON/presenter 基础 helper，供后续 task/spec handler 迁移复用。
3. **AC-3**: `runCliAction` 或等价 helper SHALL 对已知错误前缀映射 stderr 与 exit code，未知错误 SHALL 继续抛出。
4. **AC-4**: `src/cli/__tests__/common.test.ts` SHALL 覆盖 runtime/presenter/helper 的正常与错误路径。
5. **AC-5**: `common.test.ts`、`task.test.ts`、`spec.test.ts`、`npm run lint`、`spec-manager project doctor` SHALL 全部通过。

@verify: file-exists(src/cli/__tests__/common.test.ts)
@verify: command(npm test -- src/cli/__tests__/common.test.ts)
@verify: command(npm run lint)

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
  "coveredSpecs": ["cli-application-boundary-L3.1.1-runtime"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 cli-application-boundary-L3.1.1-runtime、cli-application-boundary-L2.1、历史任务、agent-plan 和 CLI 锚点源码测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/cli/common.ts 新增 CLI action context 和默认 context"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/cli/common.ts 新增 CSV、JSON 和 presenter helper"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/common.ts 新增 runCliAction 已知错误映射 helper"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 src/cli/__tests__/common.test.ts 覆盖 runtime helper 行为"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: npm test -- src/cli/__tests__/common.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/spec.test.ts"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: npm run lint && spec-manager project doctor && npm test -- src/cli/__tests__/architecture-smoke.test.ts"}
  ]
}
```

autoConfirm: false。理由：本 L3 引入后续 CLI 迁移公共边界，需人工确认冻结后实施。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| runtime helper 类型设计不合适 | 回退 `src/cli/common.ts` 新增 helper 和 `common.test.ts` | < 5 min |
| 新 helper 影响既有 CLI 测试 | 保留测试，回退 helper 默认行为到 console/process 兼容实现 | < 10 min |
| 错误映射行为不清晰 | 暂缓 runCliAction，仅保留 context/presenter 基础 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 过早抽象导致后续 task/spec 不适配 | helper 保持小而通用，只覆盖已在 task/spec 中重复出现的模式 |
| 默认 context 破坏现有 console spy 测试 | 默认实现继续使用 `console.log`、`console.error`、`process.stdout.write`、`process.exit` |
| helper 被误认为公共包 API | 不从 `src/index.ts` 导出，先作为 CLI 内部模块边界 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| parent | cli-application-boundary-L2.1 | parent |
| references | cli-application-boundary-L1 | references |
| based_on | architecture-refactor-L3.1.5-verification | based_on |
