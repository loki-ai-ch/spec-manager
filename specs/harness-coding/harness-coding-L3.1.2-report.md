---
code: harness-coding-L3.1.2-report
level: L3
title: task report 回写
topic: harness-coding
parentCode: harness-coding-L2.1
status: implemented
created: '2026-06-08T08:15:43.544Z'
updated: '2026-06-08T08:22:52.203Z'
aiSummary: >-
  实施 task report <task-code>：新增 HarnessTaskReportPayload 校验和
  reportHarnessTaskStep 适配层，CLI 支持 flags 与 --input JSON 回写 task step，并补充
  core/CLI 测试与 build/smoke 验证
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取
      harness-coding-L3.1.2-report、harness-coding-L2.1、harness-coding-L3.1.1-context、templates/agent-plan.json
      并检查 harness/task/CLI task 测试基线
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      编辑 src/core/harness.ts 新增 HarnessTaskReportPayload/Input 和
      normalizeHarnessTaskReportPayload
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/harness.ts 新增 reportHarnessTaskStep 写入下一个 task step
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/task.ts 接入 task report <taskId> flags/input/json 子命令
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: >-
      编辑 src/core/__tests__/harness.test.ts 补充 report payload 与
      reportHarnessTaskStep 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      编辑 src/cli/__tests__/task.test.ts 补充 task report CLI
      flags/input/json/错误场景测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 验证 npm test targeted、npm run build、dist CLI task report smoke
    status: pending
---
# task report 回写

# task report 回写 — 实施规格

## 目标

实施 `harness-coding-L2.1` 的第二项交付物：新增 `spec-manager task report <task-code>`，让 coding harness 用一个结构化 report payload 回写当前 Agent Task 的执行步骤。

本 L3 只实现 report 到 task step 的适配层：

- 支持 CLI flags 和 `--input <json-file>` 两种输入。
- report payload 包含 `summary` 必填，`files`、`tests`、`risks` 可选。
- 复用现有 `reportStep()` 和 task JSON 存储，不引入新实体。
- 不实现 `task verify`、verification evidence、change proposal 或 schema 稳定化。

**前置依赖**: `harness-coding-L3.1.1-context` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show harness-coding-L3.1.2-report --include-content` 和 `spec-manager spec show harness-coding-L2.1 --include-content`。
- 执行 `spec-manager spec show harness-coding-L3.1.1-context --include-content`，确认已实现的 harness core/CLI 风格。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，且 `coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/harness.ts`，确认 context 类型和 helper 风格。
  - 读取 `src/core/task.ts`，确认 `reportStep()` 入参、R15 warning、task step 更新行为。
  - 读取 `src/cli/task.ts`，确认 `context` 子命令、`step` 子命令和错误处理方式。
  - 读取 `src/cli/__tests__/task.test.ts` 与 `src/core/__tests__/harness.test.ts`，确认测试 fixture 和 stdout/stderr 捕获方式。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/context L3、agent-plan 与 harness/task/CLI task 测试基线读取","files":[]}
  ```

### Step 2 — 新增 report payload 核心类型与校验

- 编辑 `src/core/harness.ts`：
  - 导出接口 `HarnessTaskReportPayload`：
    - `summary: string`
    - `stepNo?: number | string`
    - `files?: string[]`
    - `tests?: string[]`
    - `risks?: string[]`
  - 导出接口 `HarnessTaskReportInput`：
    - `paths: ProjectPaths`
    - `taskId: string`
    - `specCode?: string`
    - `payload: HarnessTaskReportPayload`
  - 导出 `normalizeHarnessTaskReportPayload(raw: unknown): HarnessTaskReportPayload`。
  - 校验规则：
    - `summary` MUST 是非空字符串。
    - `stepNo` 可选；若提供，必须是非空 string 或 number。
    - `files/tests/risks` 可选；若提供，必须是 string array。
    - unknown fields 初期忽略，不阻断。
  - 失败时抛出 `INVALID_REPORT: <reason>`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 HarnessTaskReportPayload/Input 和 normalizeHarnessTaskReportPayload 校验","files":["src/core/harness.ts"]}
  ```

### Step 3 — 实现 report 到 task step 的适配

- 编辑 `src/core/harness.ts`：
  - 导入 `showTask` 与 `reportStep`。
  - 新增 `reportHarnessTaskStep(input: HarnessTaskReportInput)`。
  - stepNo 选择规则：
    - payload 指定 `stepNo` 时使用该值。
    - payload 未指定时，选择 task 中第一个 `pending` 或 `running` step。
    - 如果没有 pending/running step，抛出 `NO_REPORTABLE_STEP: <task-id>`。
  - 输出到 `reportStep()`：
    - `status: 'succeeded'`
    - `outputJson` 为 `JSON.stringify({ summary, files, tests, risks })`
  - 返回 `{ task, stepNo, warnings }`，其中 warnings 透传 `reportStep()` 的 R15 warnings。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 reportHarnessTaskStep 将 report payload 写入下一个 task step","files":["src/core/harness.ts"]}
  ```

### Step 4 — 接入 CLI task report 子命令

- 编辑 `src/cli/task.ts`：
  - 在 `registerTaskCommands` 中新增 `report <taskId>` 子命令。
  - 支持参数：
    - `--spec <specCode>`：限定查找范围，沿用现有 T-001 冲突处理。
    - `--step <stepNo>`：可选，指定回写步骤。
    - `--summary <summary>`：flags 模式必填。
    - `--files <files>`：逗号分隔或可重复输入，L3 可选择实现简单逗号分隔。
    - `--tests <tests>`：逗号分隔。
    - `--risks <risks>`：逗号分隔。
    - `--input <file>`：从 JSON 文件读取 payload。
    - `--json`：输出机器可读结果。
  - 当同时提供 `--input` 和 `--summary/--files/--tests/--risks/--step` 时，系统 MUST 失败并提示二选一。
  - 错误处理：
    - `INVALID_REPORT`、`NO_REPORTABLE_STEP`、task not found 以 exit code 2 退出。
- 完成后 step_report outputJson:
  ```json
  {"summary":"为 CLI task 新增 report <taskId> 子命令，支持 flags 与 JSON input","files":["src/cli/task.ts"]}
  ```

### Step 5 — 补充 core 单元测试

- 编辑 `src/core/__tests__/harness.test.ts`：
  - 增加 `normalizeHarnessTaskReportPayload` 正向测试：summary/files/tests/risks/stepNo 正确归一化。
  - 增加 `normalizeHarnessTaskReportPayload` 反向测试：缺 summary、files 非数组时抛出 `INVALID_REPORT`。
  - 增加 `reportHarnessTaskStep` 测试：
    - 创建 frozen L3 + task。
    - 不传 stepNo 时写入第一个 pending step。
    - 指定 stepNo 时写入指定 step。
    - 断言 task step status 为 `succeeded`，outputJson 含 summary/files/tests/risks。
  - 增加无 pending/running step 时抛出 `NO_REPORTABLE_STEP`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 report payload 校验和 reportHarnessTaskStep core 测试","files":["src/core/__tests__/harness.test.ts"]}
  ```

### Step 6 — 补充 CLI 单元测试

- 编辑 `src/cli/__tests__/task.test.ts`：
  - 增加 flags 模式测试：
    - `task report T-001 --spec <l3> --summary "..." --files a.ts,b.ts --tests "npm test"`
    - 断言输出包含 reported step 和 task id。
  - 增加 `--input report.json --json` 测试，解析 JSON 并断言 stepNo/status。
  - 增加缺 summary 反向测试，断言 exit code 2 和 `INVALID_REPORT`。
  - 增加 `--input` 与 flags 混用反向测试。
  - 增加指定 `--step 2` 测试，断言第二步被写入。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 task report CLI flags/input/json 与错误场景测试","files":["src/cli/__tests__/task.test.ts"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/core/__tests__/harness.test.ts src/cli/__tests__/task.test.ts`。
- 运行 `npm run build`。
- 运行手动 smoke：
  - 创建或复用一个 running task。
  - 执行 `node dist/cli/index.js task report <task-id> --spec <l3-code> --summary "smoke report" --files src/core/harness.ts --tests "npm test -- --run src/core/__tests__/harness.test.ts"`。
  - 执行 `node dist/cli/index.js task show <task-id> --spec <l3-code> --full`，预期对应 step 为 `succeeded` 且 outputJson 含 summary。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 task report targeted tests、build 和 CLI smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: core + CLI task report 测试
npm test -- --run src/core/__tests__/harness.test.ts src/cli/__tests__/task.test.ts
# 预期输出包含:
# Test Files  2 passed

# 正向验证: TypeScript 构建
npm run build
# 预期输出: 命令 exit code 0

# 正向验证: CLI smoke
node dist/cli/index.js task report T-001 --spec harness-coding-L3.1.2-report --summary "smoke report" --files src/core/harness.ts --tests "npm test"
# 预期输出包含:
# Task T-001 report written

# 反向验证: 缺 summary
node dist/cli/index.js task report T-001 --spec harness-coding-L3.1.2-report
# 预期输出包含:
# INVALID_REPORT
```

## step_report 模板

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
  "coveredSpecs": ["harness-coding-L3.1.2-report"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 harness-coding-L3.1.2-report、harness-coding-L2.1、harness-coding-L3.1.1-context、templates/agent-plan.json 并检查 harness/task/CLI task 测试基线"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/harness.ts 新增 HarnessTaskReportPayload/Input 和 normalizeHarnessTaskReportPayload"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/harness.ts 新增 reportHarnessTaskStep 写入下一个 task step"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/task.ts 接入 task report <taskId> flags/input/json 子命令"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/__tests__/harness.test.ts 补充 report payload 与 reportHarnessTaskStep 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/task.test.ts 补充 task report CLI flags/input/json/错误场景测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证 npm test targeted、npm run build、dist CLI task report smoke"}
  ]
}
```

autoConfirm: `false`。理由：本 L3 冻结后会修改 task/harness 核心和 CLI，需要用户显式批准后才能进入 Agent Task。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| report payload 校验过严 | 调整 `normalizeHarnessTaskReportPayload` 并同步测试 | < 10 min |
| task report 破坏现有 task CLI | revert `src/cli/task.ts` 中 report 子命令注册 | < 5 min |
| reportStep 适配写错 step | revert `reportHarnessTaskStep` 并保留 `task step` 原命令 | < 5 min |
| CLI input/flags 交互不清晰 | 收紧 `--input` 与 flags 二选一逻辑和错误消息 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 自动选择下一个 pending step 不符合用户预期 | 支持 `--step <stepNo>` 显式覆盖，并在输出中显示实际 stepNo |
| files/tests/risks 的 CLI 分隔规则不够表达复杂文本 | 本 L3 先支持逗号分隔；复杂 payload 使用 `--input` JSON |
| report 与现有 `task step` 能力重复 | report 是 harness-friendly 适配层，底层继续复用 `reportStep()`，不改变现有命令 |
| 并发 report 可能覆盖同一 pending step | 本 L3 不解决并发锁；后续可在 schema/docs 或 workflow hardening 中处理 |
