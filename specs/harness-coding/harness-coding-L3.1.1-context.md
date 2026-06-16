---
code: harness-coding-L3.1.1-context
level: L3
title: task context 输出
topic: harness-coding
parentCode: harness-coding-L2.1
status: implemented
created: '2026-06-08T07:38:59.465Z'
updated: '2026-06-08T08:13:32.113Z'
aiSummary: >-
  实施 task context <l3-code>：新增 core harness context 构建器和 text/json renderer，CLI
  接入 task context 子命令，强制 L3 frozen/implemented 准入并补充 core/CLI 测试与 build/smoke 验证
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取
      harness-coding-L3.1.1-context、harness-coding-L2.1、templates/agent-plan.json
      并检查 spec-io/task/decision/CLI task 测试基线
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      新增 src/core/harness.ts 定义
      HarnessTaskContext、buildHarnessTaskContext、renderHarnessTaskContextText
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 实现 L3 frozen/implemented 准入、summary、关联 spec 与 decision 读取
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      实现 objectives、nonGoals、acceptanceCriteria、suggestedVerification 的 markdown
      提取
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 实现 task context text/json 输出格式和 nextCommands
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/cli/task.ts 接入 task context <l3Code> --format text|json
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 新增 src/core/__tests__/harness.test.ts 覆盖 context 构建与 renderer
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 编辑 src/cli/__tests__/task.test.ts 覆盖 task context CLI text/json/错误场景
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: 验证 targeted tests、npm run build、dist CLI text/json smoke
    status: pending
---
# task context 输出

# task context 输出 — 实施规格

## 目标

实施 `harness-coding-L2.1` 的第一项交付物：新增 `spec-manager task context <l3-code>`，从 frozen/implemented L3 生成 coding harness 可直接消费的 task context，支持默认 text 输出和 experimental JSON 输出。

本 L3 只实现 context 生成与准入检查，不实现 task report、verification 记录、change proposal 或 schema 稳定化。

**前置依赖**: `harness-coding-L2.1` 已 confirmed。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show harness-coding-L3.1.1-context --include-content` 和 `spec-manager spec show harness-coding-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，且 `coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/spec-io.ts`，确认 `findSpecByCode`、`listAllSpecs`、frontmatter 字段结构。
  - 读取 `src/core/task.ts`，确认 task 子命令与 task 文件模型，避免本 L3 修改 task 生命周期。
  - 读取 `src/cli/task.ts`，确认 `registerTaskCommands` 当前命令结构与错误处理方式。
  - 读取 `src/core/decision.ts`，确认 decision 查询函数和返回结构。
  - 读取 `src/cli/__tests__/task.test.ts` 与 `src/core/__tests__/task-cascade.test.ts`，确认测试 fixture 和 CLI 捕获方式。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2、agent-plan 与 spec-io/task/decision/CLI task 测试基线读取","files":[]}
  ```

### Step 2 — 新增 harness context 核心模型

- 新增 `src/core/harness.ts`：
  - 导出类型 `HarnessContextFormat = 'text' | 'json'`。
  - 导出接口 `HarnessTaskContext`，字段包含：
    - `schemaVersion: 'harness-context.experimental.v1'`
    - `specCode`
    - `topic`
    - `title`
    - `statusGate: { level: string; status: string; allowed: boolean; reason?: string }`
    - `summary`
    - `objectives: string[]`
    - `nonGoals: string[]`
    - `acceptanceCriteria: string[]`
    - `decisions: Array<{ code?: string; title: string; summary: string }>`
    - `suggestedVerification: string[]`
    - `nextCommands: string[]`
    - `warnings: string[]`
  - 导出 `buildHarnessTaskContext(paths: ProjectPaths, l3Code: string): HarnessTaskContext`。
  - 导出 `renderHarnessTaskContextText(context: HarnessTaskContext): string`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 harness task context 类型、构建器和 text renderer 骨架","files":["src/core/harness.ts"]}
  ```

### Step 3 — 实现 L3 准入与关联数据读取

- 在 `buildHarnessTaskContext` 中：
  - 使用 `findSpecByCode(paths, l3Code)` 查找 spec；不存在时抛出 `SPEC_NOT_FOUND: <code>`。
  - 校验 `spec.fm.level === 'L3'`；否则抛出 `SPEC_NOT_L3: <code>`。
  - 只允许 `status` 为 `frozen` 或 `implemented`；否则抛出 `L3_NOT_FROZEN: <code>`。
  - `statusGate.allowed` 对允许状态为 `true`。
  - `summary` 优先使用 `aiSummary`，缺失时使用 title。
  - 通过 `listAllSpecs(paths)` 找到 parent chain 中可用的 L2/L1，仅用于后续摘要和 warning，不在本 L3 输出完整正文。
  - 读取同 topic decisions；如果现有 decision API 不支持精确 topic 查询，使用最小适配函数并保持无 decision 时返回 `[]`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 L3 frozen/implemented 准入、summary、关联 spec 与 decision 读取","files":["src/core/harness.ts"]}
  ```

### Step 4 — 实现正文提取规则

- 在 `src/core/harness.ts` 中实现轻量 markdown 提取函数：
  - `acceptanceCriteria`: 提取 `## 验收标准` 下的编号列表或 bullet，保留 `AC-1` 等编号文本。
  - `objectives`: 优先提取 `## 目标` 下的 bullet；若没有 bullet，则提取首段非空文本。
  - `nonGoals`: 提取 `## 范围边界` 中“不做/显式排除” bullet；若没有则返回 `[]`。
  - `suggestedVerification`: 提取 `## 验证命令` 下 fenced code block 中的命令行，忽略注释行和空行。
  - 对无法提取的非关键字段返回 `[]`，并为 `acceptanceCriteria` 或 `suggestedVerification` 缺失添加 warning。
- 约束：
  - 不引入 markdown parser 依赖。
  - 不解析任意业务代码。
  - 不把 L1/L2 正文复述进 context。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现目标、非目标、验收标准和验证命令的 markdown 提取规则","files":["src/core/harness.ts"]}
  ```

### Step 5 — 实现 text/json 输出

- `renderHarnessTaskContextText` 输出顺序 MUST 为：
  1. `Task Context`
  2. `Status Gate`
  3. `Summary`
  4. `Objectives`
  5. `Non Goals`
  6. `Acceptance Criteria`
  7. `Decisions`
  8. `Suggested Verification`
  9. `Warnings`
  10. `Next`
- `nextCommands` MUST 至少包含：
  - `spec-manager task create <l3-code> --plan ./plan.json`
- JSON 输出 MUST 使用 `JSON.stringify(context, null, 2)`，字段名与 `HarnessTaskContext` 保持一致。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 task context text/json 输出格式和 nextCommands","files":["src/core/harness.ts"]}
  ```

### Step 6 — 接入 CLI task context 子命令

- 编辑 `src/cli/task.ts`：
  - 在 `registerTaskCommands` 中新增 `context <l3Code>` 子命令。
  - 增加 `.option('--format <format>', 'text | json', 'text')`。
  - format 为 `text` 时输出 `renderHarnessTaskContextText(context)`。
  - format 为 `json` 时输出 pretty JSON。
  - format 非 `text/json` 时以 exit code 2 失败，并提示 `task context --format 必须是 text 或 json`。
  - 捕获核心错误：
    - `SPEC_NOT_FOUND`
    - `SPEC_NOT_L3`
    - `L3_NOT_FROZEN`
  - 错误保持用户可读，并以 exit code 2 退出。
- 完成后 step_report outputJson:
  ```json
  {"summary":"为 CLI task 新增 context <l3Code> --format text|json 子命令","files":["src/cli/task.ts"]}
  ```

### Step 7 — 补充 core 单元测试

- 新增或编辑 `src/core/__tests__/harness.test.ts`：
  - 创建 L1 confirmed、L2 confirmed、L3 frozen fixture，断言 `buildHarnessTaskContext` 返回 `allowed: true`、specCode、summary、AC、验证命令和 nextCommands。
  - 创建 L3 draft fixture，断言抛出 `L3_NOT_FROZEN`。
  - 使用 L2 code 调用，断言抛出 `SPEC_NOT_L3`。
  - 使用不存在 code 调用，断言抛出 `SPEC_NOT_FOUND`。
  - 测试 `renderHarnessTaskContextText` 包含 `Task Context`、`Status Gate`、`Acceptance Criteria`、`Next`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 harness context core 测试覆盖准入、提取和 text renderer","files":["src/core/__tests__/harness.test.ts"]}
  ```

### Step 8 — 补充 CLI 单元测试

- 编辑 `src/cli/__tests__/task.test.ts`：
  - 增加 `task context <frozen-l3>` 默认 text 输出测试，断言包含 `Task Context` 和 `Status Gate`。
  - 增加 `task context <frozen-l3> --format json` 测试，解析 JSON 并断言 `schemaVersion`、`specCode`、`statusGate.allowed`。
  - 增加 draft L3 反向测试，断言 exit code 2 或错误消息包含 `L3_NOT_FROZEN`。
  - 增加非法 format 反向测试。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 task context CLI text/json 与错误场景测试","files":["src/cli/__tests__/task.test.ts"]}
  ```

### Step 9 — 验证

- 运行 `npm test -- --run src/core/__tests__/harness.test.ts src/cli/__tests__/task.test.ts`。
- 运行 `npm run build`。
- 运行手动 smoke：
  - `node dist/cli/index.js task context <任一 frozen L3> --format text`
  - `node dist/cli/index.js task context <任一 frozen L3> --format json`
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 harness context targeted tests、build 和 text/json smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: core + CLI task context 测试
npm test -- --run src/core/__tests__/harness.test.ts src/cli/__tests__/task.test.ts
# 预期输出包含:
# Test Files  2 passed

# 正向验证: TypeScript 构建
npm run build
# 预期输出: 命令 exit code 0

# 正向验证: text smoke
node dist/cli/index.js task context roadmap-openspec-L3.1.1-guide --format text
# 预期输出包含:
# Task Context
# Status Gate
# Next

# 正向验证: json smoke
node dist/cli/index.js task context roadmap-openspec-L3.1.1-guide --format json
# 预期输出可被 JSON.parse 解析，且包含:
# "schemaVersion": "harness-context.experimental.v1"

# 反向验证: 非 frozen L3
node dist/cli/index.js task context harness-coding-L3.1.1-context
# 在本 L3 freeze 前预期输出包含:
# L3_NOT_FROZEN
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
  "coveredSpecs": ["harness-coding-L3.1.1-context"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 harness-coding-L3.1.1-context、harness-coding-L2.1、templates/agent-plan.json 并检查 spec-io/task/decision/CLI task 测试基线"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 src/core/harness.ts 定义 HarnessTaskContext、buildHarnessTaskContext、renderHarnessTaskContextText"},
    {"stepNo": 3, "stepType": "tool_action", "name": "实现 L3 frozen/implemented 准入、summary、关联 spec 与 decision 读取"},
    {"stepNo": 4, "stepType": "tool_action", "name": "实现 objectives、nonGoals、acceptanceCriteria、suggestedVerification 的 markdown 提取"},
    {"stepNo": 5, "stepType": "tool_action", "name": "实现 task context text/json 输出格式和 nextCommands"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/cli/task.ts 接入 task context <l3Code> --format text|json"},
    {"stepNo": 7, "stepType": "tool_action", "name": "新增 src/core/__tests__/harness.test.ts 覆盖 context 构建与 renderer"},
    {"stepNo": 8, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/task.test.ts 覆盖 task context CLI text/json/错误场景"},
    {"stepNo": 9, "stepType": "tool_action", "name": "验证 targeted tests、npm run build、dist CLI text/json smoke"}
  ]
}
```

autoConfirm: `false`。理由：本 L3 冻结后会允许实现代码修改，需要用户显式批准后才能进入 Agent Task。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| task context 输出破坏 task CLI | revert `src/cli/task.ts` 中 context 子命令注册 | < 5 min |
| harness core 提取逻辑不稳定 | revert `src/core/harness.ts` 与相关测试 | < 5 min |
| JSON 输出字段需要调整 | 在 experimental 阶段修改 `HarnessTaskContext` 字段并同步测试 | < 10 min |
| build 因类型冲突失败 | 移除新增导入和命令分支，恢复 task CLI 原行为 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| markdown 提取规则漏掉非标准标题 | 初期返回 warning，不阻断 context 输出；后续 L3 可引入更强 parser |
| decision API 无法按 topic 精确查询 | 本 L3 允许 decisions 为空或做最小适配，不影响核心 context |
| JSON schema 后续变化 | 使用 `harness-context.experimental.v1` 标记，Phase 5 再稳定 |
| CLI task 测试已有 stdout 捕获模式不一致 | 优先沿用 `src/cli/__tests__/task.test.ts` 现有 helper，不做快照测试 |
