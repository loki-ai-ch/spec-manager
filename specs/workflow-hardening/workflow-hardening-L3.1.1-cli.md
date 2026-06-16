---
code: workflow-hardening-L3.1.1-cli
level: L3
title: CLI 流程校验硬化
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
created: '2026-06-06T03:05:18.773Z'
updated: '2026-06-08T01:22:30.455Z'
aiSummary: >-
  实施 CLI 校验硬化：新增从 L3 markdown 抽取 planJson 的 validate-plan --from-spec、spec
  validate placeholder_marker warning、coveredSpecs 必填模板与 R12 错误示例统一，并补充 core/CLI
  测试
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 workflow-hardening-L3.1.1-cli 与 workflow-hardening-L2.1 并检查
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/validate.ts 新增 extractPlanJsonFromSpecContent
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/validate.ts 新增 placeholder_marker warning
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/spec.ts 接入 validate-plan --from-spec
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: >-
      编辑 src/core/task.ts 与 templates/L3-impl.md 和 templates/agent-plan.json 统一
      coveredSpecs
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/validate.test.ts 补充 planJson 抽取和 placeholder 测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      编辑 src/core/__tests__/task-cascade.test.ts 与 CLI 测试补充 coveredSpecs 和
      validate-plan 测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 验证 npm test targeted、npm run build、validate-plan from-spec 和 R12 smoke
    status: pending
---
# CLI 流程校验硬化 — 实施规格

## 目标

实施 `workflow-hardening-L2.1` 的第一项交付物：CLI 流程校验硬化，包括 `spec validate-plan --from-spec`、placeholder validate warning、`coveredSpecs` 模板与 R12 错误消息统一。

**前置依赖**: `workflow-hardening-L2.1` 已 confirmed。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show workflow-hardening-L3.1.1-cli --include-content` 和 `spec-manager spec show workflow-hardening-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，且本 L3 要把 `coveredSpecs` 明确为必填。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/validate.ts`，确认 `validateSpecContent`、`validatePlanJson` 和 `ValidationWarning` 结构。
  - 读取 `src/cli/spec.ts`，确认 `spec validate` 和 `spec validate-plan <file>` 当前入口。
  - 读取 `src/core/task.ts`，确认 `createTask` 当前 R12 `coveredSpecs` 检查。
  - 读取 `templates/L3-impl.md` 和 `templates/agent-plan.json`，确认旧模板仍表达“单条则省略”。
  - 读取 `src/core/__tests__/validate.test.ts`、`src/core/__tests__/task-cascade.test.ts`，确认新增测试位置。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/agent-plan 与 validate/spec/task/template 测试基线读取","files":[]}
  ```

### Step 2 — 实现 L3 markdown planJson 抽取

- 编辑 `src/core/validate.ts`：
  - 新增 `extractPlanJsonFromSpecContent(content: string): unknown`。
  - 函数 SHALL 定位 `## planJson (final)` 段，抽取该段之后第一个 ````json` fenced block。
  - 未找到 heading 或 JSON block 时 SHALL throw `PLAN_JSON_MISSING` 风格错误消息。
  - JSON parse 失败时 SHALL throw 包含 `PLAN_JSON_INVALID` 的错误消息。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 extractPlanJsonFromSpecContent 从 L3 markdown 抽取 planJson","files":["src/core/validate.ts"]}
  ```

### Step 3 — 增加 placeholder validate warning

- 编辑 `src/core/validate.ts`：
  - 在 `validateSpecContent` 开头检测正文包含 `<!-- 在此粘贴正文 -->`。
  - 命中时追加 warning：`rule: "placeholder_marker"`，message 包含 `spec-manager spec update <code> --content <file> --ai-summary "..."` 的泛化修复提示。
  - 保持 `spec validate` warning-only 契约。
- 完成后 step_report outputJson:
  ```json
  {"summary":"validateSpecContent 新增 placeholder_marker warning","files":["src/core/validate.ts"]}
  ```

### Step 4 — 接入 `spec validate-plan --from-spec`

- 编辑 `src/cli/spec.ts`：
  - 将 `validate-plan <file>` 改为参数可选：`validate-plan [file]`。
  - 增加 `.option('--from-spec <code>', '从 L3 spec markdown 的 planJson (final) 代码块抽取并校验')`。
  - 若传 `--from-spec`，使用 `findSpecByCode` 读取 spec，校验 spec 存在且 level 为 L3，再调用 `extractPlanJsonFromSpecContent(rec.content)`。
  - 若未传 `--from-spec` 且无 file，exit 2 并提示二选一。
  - 保持原 `validate-plan <file>` 行为不变。
- 完成后 step_report outputJson:
  ```json
  {"summary":"spec validate-plan 支持 --from-spec 并保留文件模式","files":["src/cli/spec.ts"]}
  ```

### Step 5 — 统一 coveredSpecs 模板和错误消息

- 编辑 `src/core/task.ts`：
  - 抽取或内联增强 R12 错误消息，包含当前 L3 code 和可复制 JSON 示例：
    `{"coveredSpecs":["<specCode>"],"steps":[...]}`
  - 保持 `createTask` 必须包含当前 L3 code 的强校验。
- 编辑 `templates/L3-impl.md`：
  - 将 `coveredSpecs` 说明改为“必须包含当前 L3 specCode；若覆盖多条 L3，列出所有 code”。
  - planJson 示例中 `coveredSpecs` 使用 `<本 L3 specCode>`，不再写“单条则省略”。
- 编辑 `templates/agent-plan.json`：
  - `_constraints` 增加 `coveredSpecs 必须包含当前 L3 specCode`。
  - 示例 `coveredSpecs` 使用 `<current-L3-specCode>`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"统一 coveredSpecs 必填规则、L3 模板和 R12 错误示例","files":["src/core/task.ts","templates/L3-impl.md","templates/agent-plan.json"]}
  ```

### Step 6 — 补充 validate 单元测试

- 编辑 `src/core/__tests__/validate.test.ts`：
  - 增加 `extractPlanJsonFromSpecContent` 正向测试：L3 markdown 内有 `## planJson (final)` 和 JSON fenced block，返回对象含 `coveredSpecs` 与 `steps`。
  - 增加缺 planJson 测试，断言抛出 `PLAN_JSON_MISSING`。
  - 增加非法 JSON 测试，断言抛出 `PLAN_JSON_INVALID`。
  - 增加 placeholder warning 测试，断言 `validateSpecContent` 返回 `placeholder_marker`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 planJson 抽取和 placeholder warning 单元测试","files":["src/core/__tests__/validate.test.ts"]}
  ```

### Step 7 — 补充 task/template/CLI 测试

- 编辑 `src/core/__tests__/task-cascade.test.ts`：
  - 增加缺 `coveredSpecs` 或不包含当前 L3 的 `createTask` 测试，断言错误消息包含 `coveredSpecs`、当前 spec code 和 JSON 示例。
- 若现有 CLI 测试结构适合，编辑 `src/cli/__tests__/usability.test.ts` 或新增 CLI spec 测试：
  - 覆盖 `spec validate-plan --from-spec <L3>` 成功输出。
  - 覆盖 `spec validate-plan` 无 file 且无 `--from-spec` 输出错误。
  - 覆盖 `spec validate <code>` 对 placeholder marker 输出 warning。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 coveredSpecs 错误消息与 validate-plan CLI 测试","files":["src/core/__tests__/task-cascade.test.ts","src/cli/__tests__/<spec-test-file>.ts"]}
  ```

### Step 8 — 验证

- 运行 `npm test -- --run src/core/__tests__/validate.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__`。
- 运行 `npm run build`。
- 运行 smoke：
  - `node dist/cli/index.js spec validate-plan --from-spec workflow-hardening-L3.1.1-cli`
  - `node dist/cli/index.js spec validate workflow-hardening-L3.1.1-cli`
  - 创建一个缺 `coveredSpecs` 的临时 plan 并验证 `task create` 错误含 JSON 示例。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 targeted tests、build、validate-plan from-spec 和 R12 smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: targeted tests
npm test -- --run src/core/__tests__/validate.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__
# 预期输出包含:
# Test Files

# 正向验证: TypeScript build
npm run build
# 预期输出: exit code 0

# 正向验证: 从 L3 markdown 校验 planJson
node dist/cli/index.js spec validate-plan --from-spec workflow-hardening-L3.1.1-cli
# 预期输出包含:
# ✓ planJson 校验通过

# 反向验证: validate placeholder warning（若 spec 正文含 marker）
node dist/cli/index.js spec validate <含占位标记的specCode>
# 预期输出包含:
# [placeholder_marker]

# 反向验证: 缺 coveredSpecs 的 task create
node dist/cli/index.js task create workflow-hardening-L3.1.1-cli --plan /tmp/plan-missing-coveredSpecs.json
# 预期输出包含:
# R12: planJson.coveredSpecs 必须包含当前 L3 specCode
# "coveredSpecs": ["workflow-hardening-L3.1.1-cli"]
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
  "coveredSpecs": ["workflow-hardening-L3.1.1-cli"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 workflow-hardening-L3.1.1-cli 与 workflow-hardening-L2.1 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/validate.ts 新增 extractPlanJsonFromSpecContent"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/validate.ts 新增 placeholder_marker warning"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/spec.ts 接入 validate-plan --from-spec"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/task.ts 与 templates/L3-impl.md 和 templates/agent-plan.json 统一 coveredSpecs"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/validate.test.ts 补充 planJson 抽取和 placeholder 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 src/core/__tests__/task-cascade.test.ts 与 CLI 测试补充 coveredSpecs 和 validate-plan 测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证 npm test targeted、npm run build、validate-plan from-spec 和 R12 smoke"}
  ]
}
```

autoConfirm: `false`。理由：本任务会修改 CLI/core/template/test，需要逐步记录和验证。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| validate-plan from-spec 抽取错误 | revert `src/core/validate.ts` 和 `src/cli/spec.ts` 相关提交 | < 5 min |
| placeholder warning 噪声过高 | 临时移除 `placeholder_marker` warning，仅保留 confirm/freeze R22 | < 5 min |
| coveredSpecs 模板影响 agent 输出 | revert `templates/L3-impl.md`、`templates/agent-plan.json` 文案并保留 CLI 强校验 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| markdown 抽取误抓 step_report JSON | 只在 `## planJson (final)` 段内查第一个 JSON fenced block |
| CLI 测试需要新 fixture | 复用现有临时项目 fixture，必要时新增 `src/cli/__tests__/spec.test.ts` |
| smoke 需要缺 coveredSpecs plan 文件 | 使用临时文件，验证后删除 |
