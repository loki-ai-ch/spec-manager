---
code: design-context-L3.4.1
level: L3
title: Design Context Export Core
topic: design-context
parentCode: design-context-L2.4
status: implemented
aiSummary: >-
  实施规格：新增 Design Context export core API，支持 tokens-json、DTCG 子集、starter
  DESIGN.md template builder，并补充公共导出测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec show L3.4.1 + L2.4 + L3.3.1 + task list +
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      代码调查: 读取 design-context.ts + design-context.test.ts + index.ts 并搜索 export
      API
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 新增 export core 类型和 API
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 tokens-json 和 dtcg-json mapper
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 DESIGN.md starter template builder
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/design-context.test.ts 增加 export core 测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: npm test -- --run design-context.test.ts + npm test + npm run lint'
    status: pending
relations:
  - type: based_on
    target: design-context-L2.4
  - type: references
    target: design-context-L3.1.1
  - type: references
    target: design-context-L3.2.1
  - type: implements
    target: design-context-L2.4
created: '2026-06-26T13:20:32.540Z'
updated: '2026-06-26T13:29:07.886Z'
changeSummary: 'cascade: task-complete'
---
# Design Context Export Core — 实施规格

## 目标

实施 `design-context-L2.4` 的第一段：新增 Design Context export core API，将有效 `DESIGN.md` 的 token groups 输出为稳定 JSON，并提供最小可 lint 的 starter DESIGN.md template builder。第一版只做 core 层和单元测试，不新增 CLI。

保持既有 `buildDesignContextReport`、`buildDesignContextDiffReport`、`design-lint`、`design-diff` 行为和 JSON contract 不变。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.4.1 --include-content`
- `spec-manager spec show design-context-L2.4 --include-content`
- `spec-manager spec show design-context-L3.3.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`。

### Step 2 — 代码调查

- 读取 `src/core/design-context.ts`，确认 raw token 读取、lint result 和 helper 复用点。
- 读取 `src/core/__tests__/design-context.test.ts`，确认 DESIGN.md fixture 写法。
- 读取 `src/index.ts`，确认 public export 方式。
- 搜索 `rg -n "buildDesignContextExport|DesignContextExport|buildDesignContextTemplate|buildDesignContextReport" src`，确认无既有 export API 冲突。

### Step 3 — 新增 export core 类型和 API

- 在 `src/core/design-context.ts` 或新 `src/core/design-context-export.ts` 新增导出类型：
  - `DesignContextExportFormat = 'tokens-json' | 'dtcg-json'`
  - `BuildDesignContextExportInput`
  - `DesignContextExportReport`
- 新增导出函数：
  - `buildDesignContextExportReport(input)`
  - `buildDesignContextTemplate()`
- `DesignContextExportReport` 包含：
  - `schemaVersion: 'design-context-export.v1'`
  - `source: DesignContextReport`
  - `format`
  - `output`
- step_report outputJson:
  ```json
  {"summary":"新增 Design Context export core 类型和 API","files":["src/core/design-context.ts"]}
  ```

### Step 4 — 实现 tokens-json 和 dtcg-json mapper

- `tokens-json` 输出稳定 token object，只包含当前支持的 groups：
  - `colors`
  - `typography`
  - `spacing`
  - `rounded`
  - `components`
- `dtcg-json` 输出当前 schema 的 DTCG 子集：
  - colors -> `{ "$type": "color", "$value": value }`
  - spacing / rounded -> `{ "$type": "dimension", "$value": value }`
  - typography object -> `{ "$type": "typography", "$value": object }`
  - components object -> `{ "$type": "component", "$value": object }`
- 当 DESIGN.md 缺失或存在 lint error 时，report 仍返回 source 和 output，但 output 应为空 object，避免 core 抛错。
- 对 object key 做稳定排序，保证快照和 JSON 输出 deterministic。
- step_report outputJson:
  ```json
  {"summary":"实现 tokens-json 和 dtcg-json export mapper","files":["src/core/design-context.ts"]}
  ```

### Step 5 — 实现 starter template builder

- `buildDesignContextTemplate()` 返回一个完整 `DESIGN.md` 字符串。
- template 应包含 YAML frontmatter：
  - `name`
  - `description`
  - `colors.primary`
  - `typography.body`
  - `spacing.sm`
  - `rounded.sm`
  - `components.button-primary`
- template 应包含 H2 sections：
  - `Overview`
  - `Colors`
  - `Typography`
  - `Components`
- template 写入根目录 `DESIGN.md` 后，`buildDesignContextReport` 应返回 `exists=true` 且 `result.errors=0`。
- step_report outputJson:
  ```json
  {"summary":"实现 DESIGN.md starter template builder","files":["src/core/design-context.ts"]}
  ```

### Step 6 — 增加 core 测试

- 在 `src/core/__tests__/design-context.test.ts` 增加：
  - valid DESIGN.md 的 `tokens-json` export 测试。
  - valid DESIGN.md 的 `dtcg-json` export 测试。
  - invalid DESIGN.md lint error 时 output 为空且 source result 保留错误计数。
  - template builder 写入 DESIGN.md 后 lint 通过。
  - public entrypoint 导出 `buildDesignContextExportReport` 和 `buildDesignContextTemplate`。
- step_report outputJson:
  ```json
  {"summary":"增加 Design Context export core 测试","files":["src/core/__tests__/design-context.test.ts"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/core/__tests__/design-context.test.ts`。
- 运行 `npm test`。
- 运行 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 Design Context Export Core 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/design-context.test.ts
# 预期输出包含: design-context.test.ts

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
- AC-4

## 验收标准

1. **AC-1**: **Given** 有效 DESIGN.md 包含 colors、typography、spacing、rounded 和 components token，**When** 调用 `buildDesignContextExportReport` 且 format 为 `tokens-json`，**Then** report **SHALL** 返回稳定排序的 token JSON object 和 `schemaVersion='design-context-export.v1'`。
2. **AC-2**: **Given** 有效 DESIGN.md 包含当前支持 token groups，**When** 调用 `buildDesignContextExportReport` 且 format 为 `dtcg-json`，**Then** report **SHALL** 返回 DTCG 子集 `$type` / `$value` 结构。
3. **AC-3**: **Given** DESIGN.md 缺失或 lint error 大于 0，**When** 调用 `buildDesignContextExportReport`，**Then** report **SHALL** 保留 source lint result 且返回空 output object。
4. **AC-4**: **Given** 调用 `buildDesignContextTemplate()` 并写入根目录 DESIGN.md，**When** 调用 `buildDesignContextReport`，**Then** report **SHALL** `exists=true` 且 `result.errors=0`。

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
  "coveredSpecs": ["design-context-L3.4.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec show L3.4.1 + L2.4 + L3.3.1 + task list + templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "代码调查: 读取 design-context.ts + design-context.test.ts + index.ts 并搜索 export API"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 新增 export core 类型和 API"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 tokens-json 和 dtcg-json mapper"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 DESIGN.md starter template builder"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/design-context.test.ts 增加 export core 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: npm test -- --run design-context.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只新增本地 core API 和测试，不改变既有 DESIGN.md report/diff/verification contract，也不新增 CLI 行为。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| export API shape 不合适 | revert export 类型/API 和对应测试 | < 10 min |
| DTCG 子集映射有误 | 调整 mapper；`tokens-json` 和既有 parser 不受影响 | < 10 min |
| template lint 不稳定 | 修正 template token 或 section，不影响 parser/lint contract | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `design-context.ts` 文件继续变大 | 若实现超过局部 helper 范围，可新建 `design-context-export.ts` 并通过 `src/index.ts` 导出 |
| DTCG 子集被误认为完整规范 | 类型和后续文档明确这是当前 DESIGN.md schema 的最小子集 |
| invalid DESIGN.md export 行为过于宽松 | core report 保留 source errors；CLI L3 再决定 exit 非 0 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.4 | 引用父 L2 |
| references | design-context-L3.1.1 | 复用 core parser/lint |
| references | design-context-L3.2.1 | 复用 schema lint |
| implements | design-context-L2.4 | 实现 export core slice |
