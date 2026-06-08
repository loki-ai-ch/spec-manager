---
code: roadmap-openspec-L3.1.3-view
level: L3
title: 交互式 view 浏览
topic: roadmap-openspec
parentCode: roadmap-openspec-L2.1
status: implemented
created: '2026-06-08T02:32:46.867Z'
updated: '2026-06-08T02:42:19.843Z'
aiSummary: >-
  实施交互式 view 浏览：新增 core view 展示模型、CLI view 命令、@inquirer/prompts 依赖、命令注册、prompt
  mock 测试与非 TTY fallback smoke
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取 roadmap-openspec-L3.1.3-view 与 roadmap-openspec-L2.1 并检查
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 src/core/view.ts 构建 view 展示模型
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 新增 src/cli/view.ts 实现交互式 view 命令
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 src/cli/index.ts 和 package.json 注册 view 依赖
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 新增 src/core/__tests__/view.test.ts 覆盖 view 模型
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 新增 src/cli/__tests__/view.test.ts 覆盖 prompt mock
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 验证 view targeted tests、npm run build、完整 npm test 和 CLI smoke
    status: pending
---
# 交互式 view 浏览 — 实施规格

## 目标

实施 `roadmap-openspec-L2.1` 的第三项交付物：新增 `spec-manager view` 交互式 topic/spec/task 浏览命令，让用户通过选择器查看 topic 状态、spec 详情、task 详情和下一步建议。

**前置依赖**: `roadmap-openspec-L3.1.1-guide` 已 implemented；`roadmap-openspec-L3.1.2-agents` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show roadmap-openspec-L3.1.3-view --include-content` 和 `spec-manager spec show roadmap-openspec-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，`coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/cli/index.ts`，确认 CLI 注册方式。
  - 读取 `src/core/usability.ts`，确认 `getFlowStatus`、`suggestNextActionForTopic`、`suggestAfterSpecCommand` 可复用。
  - 读取 `src/core/spec-io.ts`，确认 `listAllSpecs`、`findSpecByCode` 返回结构。
  - 读取 `src/core/task.ts`，确认 `listTasks`、`findTask` 或 `showTask` 可用于 task 展示。
  - 读取 `package.json`，确认需新增 `@inquirer/prompts` 依赖。
  - 读取现有 CLI 测试文件，确认 commander 注册和 console mock 方式。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/agent-plan 与 CLI/core/test 基线读取","files":[]}
  ```

### Step 2 — 新增 view 核心展示模型

- 新增 `src/core/view.ts`：
  - 导出 `ViewTopicSummary`、`ViewSpecSummary`、`ViewTaskSummary` 或等价类型。
  - 新增 `buildViewModel(paths: ProjectPaths, opts?: { topic?: string })`。
  - 使用 `listAllSpecs(paths)`、`listTasks(paths, { topic })`、`getFlowStatus(paths, { topic })` 生成：
    - topic 列表。
    - 每个 topic 的 spec 数、task 数、nextAction。
    - spec 摘要：code、level、status、title、parentCode、aiSummary。
    - task 摘要：id、specCode、status、startedAt、finishedAt、step 计数。
  - 如果指定 topic 但没有任何 spec/task，抛出 `TOPIC_NOT_FOUND: <topic>`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 view 核心展示模型","files":["src/core/view.ts"]}
  ```

### Step 3 — 新增交互式 view CLI

- 新增 `src/cli/view.ts`：
  - 导出 `registerViewCommands(program: Command)`。
  - 注册 `view` 命令，支持 `--topic <topic>`。
  - 使用 `@inquirer/prompts` 的 `select` 或等价 API：
    - 第一级选择 topic。
    - 第二级选择 `Specs`、`Tasks`、`Topic summary`。
    - Spec 列表选择后打印详情和 `suggestAfterSpecCommand(spec, paths)`。
    - Task 列表选择后打印 id/spec/status/steps 和最近步骤。
  - 非 TTY 或 prompt 抛错时输出可读错误，提示 `spec-manager flow status --topic <topic>` 或 `spec-manager project status`。
  - 打印格式保持纯文本，不引入彩色依赖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增交互式 view CLI 命令","files":["src/cli/view.ts"]}
  ```

### Step 4 — 注册命令并更新依赖

- 编辑 `src/cli/index.ts`：
  - import `registerViewCommands`。
  - 在现有命令注册列表中调用 `registerViewCommands(program)`。
- 编辑 `package.json`：
  - dependencies 增加 `@inquirer/prompts`。
- 更新 lockfile（若项目已有 `package-lock.json`）：
  - 使用 npm 安装或等价命令确保 lockfile 与依赖一致。
- 完成后 step_report outputJson:
  ```json
  {"summary":"注册 view 命令并新增 inquirer prompts 依赖","files":["src/cli/index.ts","package.json","package-lock.json"]}
  ```

### Step 5 — 补充 view core 单元测试

- 新增 `src/core/__tests__/view.test.ts`：
  - fixture 创建多个 topic/spec/task。
  - 测试 `buildViewModel` 返回 topic/spec/task 摘要。
  - 测试 `--topic` 过滤只返回指定 topic。
  - 测试未知 topic 抛出 `TOPIC_NOT_FOUND`。
  - 测试 nextAction 来自 `getFlowStatus`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 view 核心模型单元测试","files":["src/core/__tests__/view.test.ts"]}
  ```

### Step 6 — 补充 view CLI 测试

- 新增 `src/cli/__tests__/view.test.ts`：
  - mock `@inquirer/prompts` 的 `select`，模拟选择 topic summary，断言输出包含 topic、nextAction。
  - 模拟选择 spec，断言输出包含 spec code、status、aiSummary、Next。
  - 模拟选择 task，断言输出包含 task id、specCode、status、shown/total step 信息。
  - 测试 `--topic missing` 抛出 `TOPIC_NOT_FOUND`。
  - 测试 program help 或命令注册包含 `view`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 view CLI prompt mock 测试","files":["src/cli/__tests__/view.test.ts"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/core/__tests__/view.test.ts src/cli/__tests__/view.test.ts`。
- 运行 `npm run build`。
- 运行完整 `npm test`。
- 运行 smoke：
  - `node dist/cli/index.js --help`
  - `node dist/cli/index.js view --topic roadmap-openspec`
  - 若当前 shell 非 TTY，验证输出包含 fallback 提示或可读错误；若 TTY，可实际选择 topic summary。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 view targeted tests、build、完整 npm test 和 CLI smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: view targeted tests
npm test -- --run src/core/__tests__/view.test.ts src/cli/__tests__/view.test.ts
# 预期输出包含:
# Test Files  2 passed

# 正向验证: TypeScript build
npm run build
# 预期输出: exit code 0

# 正向验证: 完整测试
npm test
# 预期输出包含:
# Test Files

# 正向验证: help 注册 view
node dist/cli/index.js --help
# 预期输出包含:
# view

# 边界验证: 非 TTY view smoke
node dist/cli/index.js view --topic roadmap-openspec
# 预期输出包含以下之一:
# roadmap-openspec
# spec-manager flow status --topic roadmap-openspec
# Project status
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
  "coveredSpecs": ["roadmap-openspec-L3.1.3-view"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 roadmap-openspec-L3.1.3-view 与 roadmap-openspec-L2.1 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 src/core/view.ts 构建 view 展示模型"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "新增 src/cli/view.ts 实现交互式 view 命令"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 src/cli/index.ts 和 package.json 注册 view 依赖"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "新增 src/core/__tests__/view.test.ts 覆盖 view 模型"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "新增 src/cli/__tests__/view.test.ts 覆盖 prompt mock"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "验证 view targeted tests、npm run build、完整 npm test 和 CLI smoke"}
  ]
}
```

autoConfirm: `false`。理由：本任务新增交互式 CLI 与运行时依赖，需要用户确认 L3 后再冻结执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| `@inquirer/prompts` 依赖或 mock 测试不稳定 | revert `src/cli/view.ts`、`src/core/view.ts`、测试和依赖变更 | < 10 min |
| 非 TTY fallback 不符合使用场景 | 调整 `src/cli/view.ts` fallback 文案或增加非交互 summary 模式 | < 10 min |
| view 模型展示字段不足 | 扩展 `src/core/view.ts` 字段并同步测试，不影响已有命令 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| prompt API 在测试环境难以 mock | 将 prompt 调用封装在 `src/cli/view.ts` 小函数内，CLI 测试 mock `@inquirer/prompts` |
| 非 TTY 环境无法交互 | 捕获 prompt 错误并输出 `flow status` 或 `project status` fallback |
| 新依赖需要更新 lockfile | 若存在 lockfile，使用 npm 安装更新；若网络受限，按权限请求执行依赖安装 |
