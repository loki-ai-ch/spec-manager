---
code: harness-coding-L3.1.3-verification
level: L3
title: task verify 结构化验证记录
topic: harness-coding
parentCode: harness-coding-L2.1
status: implemented
created: '2026-06-08T08:41:17.598Z'
updated: '2026-06-08T08:50:48.858Z'
aiSummary: >-
  实施 task verify <task-code>：扩展 task verifications[] evidence，新增 verification
  payload 校验和 recordHarnessTaskVerification，CLI 支持 flags/input/json，task show
  展示验证摘要，并补充 audit warning 与测试
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取
      harness-coding-L3.1.3-verification、harness-coding-L2.1、harness-coding-L3.1.2-report、templates/agent-plan.json
      并检查 harness/task/audit/CLI 测试基线
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: '编辑 src/core/task.ts 扩展 TaskRecord verifications[] 并新增 addTaskVerification'
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: >-
      编辑 src/core/harness.ts 新增 HarnessTaskVerificationPayload/Input 和
      normalizeHarnessTaskVerificationPayload
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: >-
      编辑 src/core/harness.ts 新增 recordHarnessTaskVerification 写入 task
      verification evidence
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑 src/cli/task.ts 接入 task verify <taskId> flags/input/json 子命令
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: >-
      编辑 src/core/task.ts、src/cli/task.ts、src/core/audit.ts 展示 verification 并增加
      audit warning
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: >-
      编辑 src/core/__tests__/harness.test.ts 和
      src/core/__tests__/task-cascade.test.ts 补充 verification core 测试
    status: pending
  - stepNo: 8
    stepType: mcp_tool
    name: >-
      编辑 src/cli/__tests__/task.test.ts 和 src/core/__tests__/audit.test.ts 补充
      task verify CLI/audit 测试
    status: pending
  - stepNo: 9
    stepType: mcp_tool
    name: 验证 npm test targeted、npm run build、dist CLI task verify smoke
    status: pending
---
# task verify 结构化验证记录

# task verify 结构化验证记录 — 实施规格

## 目标

实施 `harness-coding-L2.1` 的第三项交付物：新增 `spec-manager task verify <task-code>`，将 coding harness 的验证结果以结构化 evidence 写入 Agent Task。

本 L3 只实现 verification 记录和基础 audit warning：

- 支持 CLI flags 和 `--input <json-file>` 两种输入。
- verification payload 包含 `command`、`exitCode`、`summary` 必填，`artifacts`、`coversAc` 可选。
- verification 作为 task JSON 内嵌 `verifications[]` evidence 存储。
- `task show --json` 可返回 verification evidence；text `task show` 展示 verification 数量和最近一次结果摘要。
- audit 对已 completed 但无 verification 的 task 输出 warning。
- 不实现 `change propose`、schema 稳定化或自动执行验证命令。

**前置依赖**: `harness-coding-L3.1.2-report` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show harness-coding-L3.1.3-verification --include-content` 和 `spec-manager spec show harness-coding-L2.1 --include-content`。
- 执行 `spec-manager spec show harness-coding-L3.1.2-report --include-content`，确认 report payload/CLI 适配风格。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，且 `coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/harness.ts`，确认 report payload normalization 与 helper 风格。
  - 读取 `src/core/task.ts`，确认 `TaskRecord`、task JSON 写入、`showTask()` 返回结构。
  - 读取 `src/cli/task.ts`，确认 `report`、`show` 和错误处理方式。
  - 读取 `src/core/audit.ts` 与 `src/cli/audit.ts`，确认 audit warning 的现有输出结构。
  - 读取 `src/core/__tests__/harness.test.ts`、`src/cli/__tests__/task.test.ts`、`src/core/__tests__/audit.test.ts`，确认测试 fixture。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/report L3、agent-plan 与 harness/task/audit/CLI 测试基线读取","files":[]}
  ```

### Step 2 — 扩展 TaskRecord verification 数据模型

- 编辑 `src/core/task.ts`：
  - 导出接口 `TaskVerificationRecord`：
    - `id: string`
    - `command: string`
    - `exitCode: number`
    - `summary: string`
    - `artifacts: string[]`
    - `coversAc: string[]`
    - `created: string`
  - 在 `TaskRecord` 中新增可选字段 `verifications?: TaskVerificationRecord[]`。
  - 保持旧 task JSON 兼容：读取旧文件时 `verifications` 可为 `undefined`。
  - 新增 `addTaskVerification(input)`：
    - 查找 task。
    - 生成递增 id，如 `V-001`。
    - append 到 `verifications[]`。
    - 写回 task JSON。
    - 返回更新后的 task 和 verification。
- 完成后 step_report outputJson:
  ```json
  {"summary":"扩展 TaskRecord verifications[] 并新增 addTaskVerification 写入 task evidence","files":["src/core/task.ts"]}
  ```

### Step 3 — 新增 verification payload 核心类型与校验

- 编辑 `src/core/harness.ts`：
  - 导出接口 `HarnessTaskVerificationPayload`：
    - `command: string`
    - `exitCode: number`
    - `summary: string`
    - `artifacts?: string[]`
    - `coversAc?: string[]`
  - 导出接口 `HarnessTaskVerificationInput`：
    - `paths: ProjectPaths`
    - `taskId: string`
    - `specCode?: string`
    - `payload: HarnessTaskVerificationPayload`
  - 导出 `normalizeHarnessTaskVerificationPayload(raw: unknown): HarnessTaskVerificationPayload`。
  - 校验规则：
    - `command` MUST 是非空字符串。
    - `exitCode` MUST 是有限 number。
    - `summary` MUST 是非空字符串。
    - `artifacts/coversAc` 可选，若提供必须是 string array。
    - unknown fields 初期忽略。
  - 失败时抛出 `INVALID_VERIFICATION: <reason>`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 HarnessTaskVerificationPayload/Input 和 normalizeHarnessTaskVerificationPayload 校验","files":["src/core/harness.ts"]}
  ```

### Step 4 — 实现 verification evidence 写入适配

- 编辑 `src/core/harness.ts`：
  - 导入 `addTaskVerification`。
  - 新增 `recordHarnessTaskVerification(input: HarnessTaskVerificationInput)`。
  - 将 payload 归一化为：
    - `command`
    - `exitCode`
    - `summary`
    - `artifacts: []`
    - `coversAc: []`
  - 调用 `addTaskVerification()` 写入 task evidence。
  - 返回 `{ task, verification }`。
  - `exitCode !== 0` MUST 仍然记录成功，不自动 fail task，不自动 complete task。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 recordHarnessTaskVerification 将验证结果写入 task verifications[]","files":["src/core/harness.ts"]}
  ```

### Step 5 — 接入 CLI task verify 子命令

- 编辑 `src/cli/task.ts`：
  - 在 `registerTaskCommands` 中新增 `verify <taskId>` 子命令。
  - 支持参数：
    - `--spec <specCode>`：限定查找范围。
    - `--command <command>`：验证命令。
    - `--exit-code <code>`：验证 exit code，解析为 number。
    - `--summary <summary>`：验证摘要。
    - `--artifacts <paths>`：逗号分隔 artifact 路径。
    - `--covers-ac <items>`：逗号分隔 AC 编号。
    - `--input <file>`：从 JSON 文件读取 payload。
    - `--json`：输出机器可读结果。
  - 当同时提供 `--input` 和 flags 时，系统 MUST 失败并提示二选一。
  - 错误处理：
    - `INVALID_VERIFICATION`、`TASK_NOT_FOUND`、task not found 以 exit code 2 退出。
  - text 输出 MUST 包含 verification id、task id、exitCode。
- 完成后 step_report outputJson:
  ```json
  {"summary":"为 CLI task 新增 verify <taskId> 子命令，支持 flags/input/json","files":["src/cli/task.ts"]}
  ```

### Step 6 — 展示与 audit warning

- 编辑 `src/core/task.ts` 与 `src/cli/task.ts`：
  - `showTask()` 保持返回 task，其中 task 包含 `verifications`。
  - text `task show` 增加：
    - `verifications: <count>`
    - 最近一次 verification 的 `id`、`exitCode`、`summary`
- 编辑 `src/core/audit.ts`：
  - 对 completed task，如果 `verifications` 为空，输出 warning。
  - warning 文案包含 task id 和 specCode，提示使用 `spec-manager task verify <taskId> --spec <specCode> ...`。
  - 该 warning 不阻断 audit，不改变现有 rules 计数语义。
- 完成后 step_report outputJson:
  ```json
  {"summary":"在 task show 展示 verification 摘要，并为 completed task 无 verification 增加 audit warning","files":["src/core/task.ts","src/cli/task.ts","src/core/audit.ts"]}
  ```

### Step 7 — 补充 core 单元测试

- 编辑 `src/core/__tests__/harness.test.ts`：
  - 增加 `normalizeHarnessTaskVerificationPayload` 正向测试。
  - 增加缺 command、exitCode 非 number、artifacts 非数组的反向测试。
  - 增加 `recordHarnessTaskVerification` 测试：
    - 创建 frozen L3 + task。
    - 写入 exitCode 0 verification。
    - 断言 task.verifications[0] 包含 command、exitCode、summary、coversAc。
    - 写入 exitCode 1 verification，断言仍记录成功且不改变 task status。
- 编辑 `src/core/__tests__/task-cascade.test.ts` 或新增 task verification 测试：
  - 直接测试 `addTaskVerification()` id 递增和旧 task 无 verifications 时兼容。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 verification payload、recordHarnessTaskVerification 和 addTaskVerification core 测试","files":["src/core/__tests__/harness.test.ts","src/core/__tests__/task-cascade.test.ts"]}
  ```

### Step 8 — 补充 CLI/audit 单元测试

- 编辑 `src/cli/__tests__/task.test.ts`：
  - 增加 flags 模式测试：
    - `task verify T-001 --spec <l3> --command "npm test" --exit-code 0 --summary "passed" --covers-ac AC-1`
    - 断言输出包含 verification id 和 exitCode。
  - 增加 `--input verification.json --json` 测试，解析 JSON 并断言 verification 字段。
  - 增加缺 command/summary 或 invalid exit code 反向测试。
  - 增加 `task show` text 展示 verification count 和最近结果测试。
- 编辑 `src/core/__tests__/audit.test.ts`：
  - 增加 completed task 无 verification 时 audit warning。
  - 增加有 verification 时不输出该 warning。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 task verify CLI flags/input/json/show 和 audit warning 测试","files":["src/cli/__tests__/task.test.ts","src/core/__tests__/audit.test.ts"]}
  ```

### Step 9 — 验证

- 运行 `npm test -- --run src/core/__tests__/harness.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__/task.test.ts src/core/__tests__/audit.test.ts`。
- 运行 `npm run build`。
- 运行手动 smoke：
  - 创建或复用一个 running/completed task。
  - 执行 `node dist/cli/index.js task verify <task-id> --spec <l3-code> --command "npm test" --exit-code 0 --summary "smoke verification" --covers-ac AC-1`。
  - 执行 `node dist/cli/index.js task show <task-id> --spec <l3-code> --full`，预期展示 verification 数量和最近结果。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 task verify targeted tests、build 和 CLI smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: core + CLI + audit targeted tests
npm test -- --run src/core/__tests__/harness.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__/task.test.ts src/core/__tests__/audit.test.ts
# 预期输出包含:
# Test Files  4 passed

# 正向验证: TypeScript 构建
npm run build
# 预期输出: 命令 exit code 0

# 正向验证: CLI smoke
node dist/cli/index.js task verify T-001 --spec harness-coding-L3.1.3-verification --command "npm test" --exit-code 0 --summary "smoke verification" --covers-ac AC-1
# 预期输出包含:
# verification
# exitCode: 0

node dist/cli/index.js task show T-001 --spec harness-coding-L3.1.3-verification --full
# 预期输出包含:
# verifications:

# 反向验证: 缺 command
node dist/cli/index.js task verify T-001 --spec harness-coding-L3.1.3-verification --exit-code 0 --summary "missing command"
# 预期输出包含:
# INVALID_VERIFICATION
```

## step_report 模板

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
  "coveredSpecs": ["harness-coding-L3.1.3-verification"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 harness-coding-L3.1.3-verification、harness-coding-L2.1、harness-coding-L3.1.2-report、templates/agent-plan.json 并检查 harness/task/audit/CLI 测试基线"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 src/core/task.ts 扩展 TaskRecord verifications[] 并新增 addTaskVerification"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 src/core/harness.ts 新增 HarnessTaskVerificationPayload/Input 和 normalizeHarnessTaskVerificationPayload"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 src/core/harness.ts 新增 recordHarnessTaskVerification 写入 task verification evidence"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 src/cli/task.ts 接入 task verify <taskId> flags/input/json 子命令"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "编辑 src/core/task.ts、src/cli/task.ts、src/core/audit.ts 展示 verification 并增加 audit warning"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "编辑 src/core/__tests__/harness.test.ts 和 src/core/__tests__/task-cascade.test.ts 补充 verification core 测试"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "编辑 src/cli/__tests__/task.test.ts 和 src/core/__tests__/audit.test.ts 补充 task verify CLI/audit 测试"},
    {"stepNo": 9, "stepType": "mcp_tool", "name": "验证 npm test targeted、npm run build、dist CLI task verify smoke"}
  ]
}
```

autoConfirm: `false`。理由：本 L3 冻结后会修改 task 数据模型、audit 与 CLI，需要用户显式批准后才能进入 Agent Task。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| verification 数据模型影响旧 task 读取 | 移除 `verifications` 相关写入和展示，旧 task JSON 无需迁移 | < 10 min |
| audit warning 噪声过高 | 将 warning 降级或仅在 harness topic 下启用，并同步测试 | < 10 min |
| task verify CLI 参数设计不清晰 | 保留 `--input` JSON，调整 flags 映射和错误提示 | < 10 min |
| exitCode 非 0 行为引发误解 | 保持只记录不 fail，并在输出中明确 task status unchanged | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| completed task 后补 verification 与流程语义冲突 | verification 是 evidence，可在 running/completed task 上追加；不改变 task status |
| coversAc 与 L3 AC 不一致 | 本 L3 只记录用户提供的 coversAc，不做 AC 存在性校验；后续 schema/docs 可加强 |
| artifact 路径不存在 | 本 L3 不校验路径存在，只记录 harness 提供的证据路径 |
| audit 需要读取所有 task 可能增加开销 | 复用现有 `listTasks`，仅检查 task JSON 的可选数组长度 |
