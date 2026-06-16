---
code: roadmap-openspec-L3.1.1-guide
level: L3
title: rich guide 与 Project Context 注入
topic: roadmap-openspec
parentCode: roadmap-openspec-L2.1
status: implemented
created: '2026-06-06T02:43:22.471Z'
updated: '2026-06-06T02:50:14.375Z'
aiSummary: >-
  实施 guide --format rich 与 config.yaml context 注入：导出 REQUIRED_SECTIONS，新增
  readProjectContext/renderRichGuide，CLI 保持默认 text，补充 core/CLI 测试与 build/smoke
  验证
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 roadmap-openspec-L3.1.1-guide 与 roadmap-openspec-L2.1 并检查
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/validate.ts 导出 REQUIRED_SECTIONS
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/usability.ts 新增 readProjectContext
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/usability.ts 新增 renderRichGuide
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/cli/usability.ts 接入 guide --format text|rich
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/usability.test.ts 补充 rich guide 测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 src/cli/__tests__/usability.test.ts 补充 guide format CLI 测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 验证 npm test targeted、npm run build、node dist/cli/index.js guide smoke
    status: pending
---
# rich guide 与 Project Context 注入 — 实施规格

## 目标

实施 `roadmap-openspec-L2.1` 的第一项交付物：为 `spec-manager guide` 增加 `--format rich` 输出，并从 `.spec-manager/config.yaml` 注入可选 `context`。

**前置依赖**: `roadmap-openspec-L2.1` 已 confirmed。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show roadmap-openspec-L3.1.1-guide --include-content` 和 `spec-manager spec show roadmap-openspec-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/usability.ts`，确认 `runProjectDoctor`、`getFlowStatus`、`suggestNextActionForTopic`、`renderTemplate` 的当前契约。
  - 读取 `src/cli/usability.ts`，确认 `guide [request...]` 当前只输出 `Request` 和 `Next`。
  - 读取 `src/core/validate.ts`，确认 `REQUIRED_SECTIONS` 当前未导出。
  - 读取 `src/core/spec-io.ts`，确认 `findSpecByCode`、`listAllSpecs` 可用于匹配 spec 和读取 `aiSummary`。
  - 读取 `src/core/__tests__/usability.test.ts` 与 `src/cli/__tests__/usability.test.ts`，确认测试 fixture 和 CLI 输出捕获方式。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3 + L2 + agent-plan + usability/validate/spec-io 测试基线读取","files":[]}
  ```

### Step 2 — 导出必填段定义

- 编辑 `src/core/validate.ts`：
  - 将 `REQUIRED_SECTIONS` 改为 `export const REQUIRED_SECTIONS: Record<SpecLevel, string[]>`。
  - 保持 `validateSpecContent` 原行为不变。
- 完成后 step_report outputJson:
  ```json
  {"summary":"导出 REQUIRED_SECTIONS 供 rich guide 渲染必填段","files":["src/core/validate.ts"]}
  ```

### Step 3 — 实现 config context 读取

- 编辑 `src/core/usability.ts`：
  - 从 `yaml` 引入 `parse`。
  - 新增 `readProjectContext(paths: ProjectPaths): string`，读取 `paths.configFile`，解析 YAML 后返回字符串类型 `context`；缺失、非字符串或读取失败时返回空字符串。
  - 不改变 `runProjectDoctor` 和 `getFlowStatus` 的返回结构。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 readProjectContext 从 config.yaml 读取可选 context","files":["src/core/usability.ts"]}
  ```

### Step 4 — 实现 rich guide 渲染器

- 编辑 `src/core/usability.ts`：
  - 新增类型 `GuideFormat = 'text' | 'rich'`。
  - 新增 `renderRichGuide(paths: ProjectPaths, packageRoot: string, request: string): string`。
  - 在 `renderRichGuide` 内使用 `findSpecByCode(paths, request)` 优先匹配 spec code；若未匹配，则复用 `inferTopic` 等价逻辑推断 topic 并读取 `getFlowStatus`。
  - 对已匹配 spec：
    - `<task>` 输出“为 <code> 编写/推进 <level> spec”。
    - `<parent_context>` 输出 parent spec code、title、status、aiSummary；没有 parent spec 时输出 `(none)`。
    - `<required_sections>` 使用 `REQUIRED_SECTIONS[spec.fm.level]`。
    - `<template>` 使用 `renderTemplate(packageRoot, spec.fm.level, spec.fm.title)`。
    - `<next_command>` 使用 `suggestAfterSpecCommand(spec)`。
  - `<rules>` 固定输出 R1/R2/R22/R13 的简短规则摘要，强调写完 spec 停止等待审核、confirm/freeze 是用户行为、占位内容必须更新、正文更新必须带 aiSummary。
  - `<project_context>` 输出 `readProjectContext(paths)`，为空时输出 `(none)`。
  - 输出段顺序 MUST 为 `task`、`project_context`、`parent_context`、`rules`、`required_sections`、`template`、`next_command`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 renderRichGuide 输出结构化 AI prompt 段","files":["src/core/usability.ts"]}
  ```

### Step 5 — 接入 CLI guide format 参数

- 编辑 `src/cli/usability.ts`：
  - 在 `guide [request...]` 命令增加 `.option('--format <format>', 'text | rich', 'text')`。
  - action 参数改为接收 `{ format: string }`。
  - 当 format 为 `rich` 时，计算 `packageRoot` 并调用 `renderRichGuide(paths, packageRoot, request)`，用 `process.stdout.write` 输出。
  - 当 format 为 `text` 时保持当前输出行为。
  - 当 format 不是 `text` 或 `rich` 时调用 `fail('✗ guide --format 必须是 text 或 rich', 2)`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"为 CLI guide 接入 --format text|rich 并保持默认 text 行为","files":["src/cli/usability.ts"]}
  ```

### Step 6 — 补充 core 单元测试

- 编辑 `src/core/__tests__/usability.test.ts`：
  - 增加 `readProjectContext` 测试：config 中有多行 `context` 时返回原内容。
  - 增加 `renderRichGuide` 测试：创建 L1 draft spec，断言输出包含 `<task>`、`<project_context>`、`<rules>`、`<required_sections>`、`<template>`、`<next_command>`。
  - 增加父 spec 摘要测试：创建 L1 confirmed + L2 draft，断言 rich 输出包含父 code 和父 `aiSummary`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 rich guide 与 project context core 测试","files":["src/core/__tests__/usability.test.ts"]}
  ```

### Step 7 — 补充 CLI 单元测试

- 编辑 `src/cli/__tests__/usability.test.ts`：
  - 增加默认 `guide auth` 测试，断言仍包含 `Request:` 和 `Next:`。
  - 增加 `guide <spec-code> --format rich` 测试，断言输出包含 `<task>` 与 `<next_command>`。
  - 增加非法 format 测试，断言 parse 抛出 Commander error 或 exitOverride 捕获退出码 2。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 guide CLI 默认 text、rich 和非法 format 测试","files":["src/cli/__tests__/usability.test.ts"]}
  ```

### Step 8 — 验证

- 运行 `npm test -- --run src/core/__tests__/usability.test.ts src/cli/__tests__/usability.test.ts`。
- 运行 `npm run build`。
- 运行手动 smoke：`node dist/cli/index.js guide roadmap-openspec-L3.1.1-guide --format rich`，预期输出包含 `<project_context>` 和 `<next_command>`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 targeted tests、build 和 rich guide smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: core + CLI usability 测试
npm test -- --run src/core/__tests__/usability.test.ts src/cli/__tests__/usability.test.ts
# 预期输出包含:
# Test Files  2 passed

# 正向验证: TypeScript 构建
npm run build
# 预期输出: 命令 exit code 0

# 正向验证: rich guide smoke
node dist/cli/index.js guide roadmap-openspec-L3.1.1-guide --format rich
# 预期输出包含:
# <project_context>
# <next_command>

# 反向验证: 非法 format
node dist/cli/index.js guide roadmap-openspec-L3.1.1-guide --format json
# 预期输出包含:
# guide --format 必须是 text 或 rich
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
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 roadmap-openspec-L3.1.1-guide 与 roadmap-openspec-L2.1 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/validate.ts 导出 REQUIRED_SECTIONS"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/usability.ts 新增 readProjectContext"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/usability.ts 新增 renderRichGuide"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/cli/usability.ts 接入 guide --format text|rich"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/usability.test.ts 补充 rich guide 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/usability.test.ts 补充 guide format CLI 测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证 npm test targeted、npm run build、node dist/cli/index.js guide smoke"}
  ]
}
```

autoConfirm: `false`。理由：本任务包含实现代码修改和验证，需要按 Agent Task 步骤记录执行，不能自动跳过人工 gate。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| rich guide 输出不符合预期 | revert 涉及 `src/core/usability.ts`、`src/cli/usability.ts`、测试文件的提交 | < 5 min |
| REQUIRED_SECTIONS 导出影响编译 | 将 `export const REQUIRED_SECTIONS` 改回内部 const 并移除 rich guide 引用 | < 5 min |
| CLI format 参数破坏默认 guide | 移除 `--format` 分支，恢复原 action 实现 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| YAML context 解析遇到非字符串字段 | `readProjectContext` 返回空字符串并在测试覆盖 |
| `renderTemplate` 输出过长导致 rich guide 过大 | L3 先按 roadmap 要求注入模板；后续 L3 可增加摘要或截断策略 |
| CLI 测试捕获 `process.stdout.write` 与 `console.log` 顺序不稳定 | 测试只断言包含关键段，不做完整快照 |
