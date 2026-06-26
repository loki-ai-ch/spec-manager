---
code: design-context-L3.2.1
level: L3
title: Design Token Schema Lint
topic: design-context
parentCode: design-context-L2.2
status: implemented
aiSummary: >-
  实施规格：增强 DESIGN.md token schema lint，覆盖
  colors、spacing、rounded、typography、components 和 reference target 约束，并补充
  core/verify 测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.2.1 + design-context-L2.2
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      代码调查: 读取 design-context.ts + design-context.test.ts + verify.test.ts 并搜索
      design-lint
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 增加 token schema lint helper
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/__tests__/design-context.test.ts 增加 schema lint 测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/__tests__/verify.test.ts 增加 invalid schema design-lint 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      验证: npm test -- --run design-context.test.ts verify.test.ts + npm test +
      npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.2
  - type: references
    target: design-context-L3.1.1
  - type: references
    target: design-context-L3.1.3
  - type: implements
    target: design-context-L2.2
created: '2026-06-26T08:19:32.240Z'
updated: '2026-06-26T08:29:49.994Z'
changeSummary: 'cascade: task-complete'
---
# Design Token Schema Lint — 实施规格

## 目标

实施 `design-context-L2.2` 的第一段：在 `src/core/design-context.ts` 中增强 DESIGN.md token schema lint，覆盖 token group 类型、颜色、dimension、typography、component 属性，以及 token reference 的 primitive/composite 约束。公共 `DesignContextReport` API 保持不变。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.2.1 --include-content`
- `spec-manager spec show design-context-L2.2 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`。

### Step 2 — 代码调查

- 读取 `src/core/design-context.ts`，确认 parser、section lint、reference lint 和 summary 位置。
- 读取 `src/core/__tests__/design-context.test.ts`，确认 fixture 写法。
- 读取 `src/core/__tests__/verify.test.ts`，确认 `design-lint` 执行断言。
- 搜索 `rg -n "design-lint|DesignContextReport|lintToken" src/core src/cli`，确认影响面。

### Step 3 — 扩展 design-context core schema lint

- 在 `src/core/design-context.ts` 中新增内部 schema lint helper：
  - token group 必须为 object。
  - colors 值支持 hex、rgb/rgba、hsl/hsla、常见 named colors、`transparent`、`currentColor`；CSS wide-gamut/mix 函数 warning-pass。
  - spacing/rounded 值支持 number 或 `px/em/rem` dimension 字符串。
  - typography token 必须为 object，常见属性按 `design-context-L2.2` 检查。
  - components token 必须为 object，未知 component property 为 warning。
  - 非 component 引用 composite group 为 error；component typography 可引用 composite typography token。
- 保持 `DesignContextReport` 结构不变。
- step_report outputJson:
  ```json
  {"summary":"增强 design-context core schema lint","files":["src/core/design-context.ts"]}
  ```

### Step 4 — 增加 core schema lint 测试

- 在 `src/core/__tests__/design-context.test.ts` 增加：
  - valid schema 不产生 error。
  - invalid color/dimension/typography/component group 产生 error。
  - unknown component property 产生 warning。
  - component typography 引用 composite token 通过。
  - 非 component 引用 composite token 失败。
- step_report outputJson:
  ```json
  {"summary":"增加 DESIGN.md schema lint 单元测试","files":["src/core/__tests__/design-context.test.ts"]}
  ```

### Step 5 — 增加 design-lint verification 覆盖

- 在 `src/core/__tests__/verify.test.ts` 增加 invalid schema fixture。
- 断言 `executeVerifyRules([{ type: 'design-lint', path: 'DESIGN.md' }])` 返回 `passed=false`，message 包含 `errors=` 和 schema finding 摘要。
- step_report outputJson:
  ```json
  {"summary":"增加 design-lint invalid schema verification 测试","files":["src/core/__tests__/verify.test.ts"]}
  ```

### Step 6 — 验证

- 运行 `npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts`。
- 运行 `npm test`。
- 运行 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 Design Token Schema Lint 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts
# 预期输出包含: design-context.test.ts
# 预期输出包含: verify.test.ts

npm test
# 预期输出包含: Test Files
# 预期输出不包含: failed

npm run lint
# 预期输出不包含: error TS
```

## 关键验收标准

- AC-1
- AC-2
- AC-3

## 验收标准

1. **AC-1**: **Given** DESIGN.md 包含 invalid color、dimension、typography 或 component schema，**When** 调用 `buildDesignContextReport`，**Then** report **SHALL** 返回结构化 error finding 且 `result.errors > 0`。
2. **AC-2**: **Given** DESIGN.md 包含未知 component property，**When** 调用 `buildDesignContextReport`，**Then** report **SHALL** 返回 warning finding 且不因该属性产生 error。
3. **AC-3**: **Given** L3 使用 design-lint verify directive，**When** DESIGN.md schema invalid，**Then** verification **SHALL** 失败并在 message 中包含 schema finding 摘要。

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
  "coveredSpecs": ["design-context-L3.2.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.2.1 + design-context-L2.2 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "代码调查: 读取 design-context.ts + design-context.test.ts + verify.test.ts 并搜索 design-lint"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 增加 token schema lint helper"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/__tests__/design-context.test.ts 增加 schema lint 测试"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/__tests__/verify.test.ts 增加 invalid schema design-lint 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: npm test -- --run design-context.test.ts verify.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 仅增强本地 lint 规则和测试，不涉及外部服务、数据迁移或破坏性操作。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| lint 过严导致回归 | revert 本 L3 的 schema lint helper 和对应测试 | < 10 min |
| finding 文案影响 CLI 断言 | 调整测试为更稳定的 severity/path 断言 | < 5 min |
| TypeScript 复杂度过高 | 将 helper 拆分为更小内部函数，不改公共 API | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 颜色解析范围膨胀 | 只实现明确子集，复杂 CSS 函数 warning-pass |
| 新 error 影响既有 valid fixture | 先补 valid schema fixture，确保常见 DESIGN.md 不回归 |
| reference 约束误伤 component typography | 单独测试 component typography composite 引用 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.2 | 引用父 L2 |
| references | design-context-L3.1.1 | 扩展 core parser/lint |
| references | design-context-L3.1.3 | 复用 design-lint verification |
| implements | design-context-L2.2 | 实现 schema lint slice |
