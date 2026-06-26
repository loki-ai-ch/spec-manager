---
code: design-context-L3.3.1
level: L3
title: Design Context Diff Core
topic: design-context
parentCode: design-context-L2.3
status: implemented
aiSummary: >-
  实施规格：新增 Design Context diff core API，比较 before/after DESIGN.md 的
  token、section/prose 和 lint summary delta，并补充公共导出测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.3.1 + design-context-L2.3
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      代码调查: 读取 design-context.ts + design-context.test.ts + index.ts 并搜索
      buildDesignContext
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 新增 diff core 类型和 API
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 token section finding diff
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/__tests__/design-context.test.ts 增加 diff core 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: '验证: npm test -- --run design-context.test.ts + npm test + npm run lint'
    status: pending
relations:
  - type: based_on
    target: design-context-L2.3
  - type: references
    target: design-context-L3.2.1
  - type: implements
    target: design-context-L2.3
created: '2026-06-26T12:42:51.535Z'
updated: '2026-06-26T12:52:18.557Z'
changeSummary: 'cascade: task-complete'
---
# Design Context Diff Core — 实施规格

## 目标

实施 `design-context-L2.3` 的第一段：新增 Design Context diff core API，用显式 before/after DESIGN.md 路径生成稳定 JSON diff，覆盖 token groups、H2 sections/prose 和 lint finding summary delta。保持既有 `buildDesignContextReport` 和 `DesignContextReport` JSON contract 不变。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.3.1 --include-content`
- `spec-manager spec show design-context-L2.3 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`。

### Step 2 — 代码调查

- 读取 `src/core/design-context.ts`，确认 parser/lint/summary helper 复用点。
- 读取 `src/core/__tests__/design-context.test.ts`，确认 fixture 写法。
- 读取 `src/index.ts`，确认 public export 方式。
- 搜索 `rg -n "buildDesignContext|DesignContextReport" src/core src/cli src/index.ts`，确认影响面。

### Step 3 — 新增 diff core 类型与 API

- 在 `src/core/design-context.ts` 新增导出类型：
  - `DesignContextDiffSet`
  - `DesignContextDiffReport`
  - `BuildDesignContextDiffInput`
- 新增导出函数 `buildDesignContextDiffReport(input)`。
- 函数内部调用 `buildDesignContextReport` 生成 before/after report。
- step_report outputJson:
  ```json
  {"summary":"新增 Design Context diff core 类型和 API","files":["src/core/design-context.ts"]}
  ```

### Step 4 — 实现 token/section/finding diff

- 在 `src/core/design-context.ts` 中实现内部 helper：
  - `diffRecordKeys(before, after)` 返回 added/removed/modified。
  - token group diff 覆盖 `colors`、`typography`、`spacing`、`rounded`、`components`。
  - section diff 按 canonical heading 对 section content 做 stable string 比较。
  - finding delta 比较 before/after `result`。
  - `regression` 为 after errors/warnings 增加或任意 token removed。
- 为了复用 YAML/section 解析，可在内部新增 `readDesignContextParts`，不改变公共 report contract。
- step_report outputJson:
  ```json
  {"summary":"实现 DESIGN.md token section finding diff 计算","files":["src/core/design-context.ts"]}
  ```

### Step 5 — 增加 diff core 测试

- 在 `src/core/__tests__/design-context.test.ts` 增加：
  - token added/removed/modified diff。
  - section added/removed/modified diff。
  - lint finding delta 和 regression。
  - public entrypoint 导出 `buildDesignContextDiffReport`。
- step_report outputJson:
  ```json
  {"summary":"增加 Design Context diff core 测试","files":["src/core/__tests__/design-context.test.ts"]}
  ```

### Step 6 — 验证

- 运行 `npm test -- --run src/core/__tests__/design-context.test.ts`。
- 运行 `npm test`。
- 运行 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 Design Context Diff Core 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts","npm test","npm run lint"]}
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

## 验收标准

1. **AC-1**: **Given** before/after DESIGN.md token groups 有 added、removed、modified，**When** 调用 `buildDesignContextDiffReport`，**Then** report **SHALL** 在对应 token group 返回稳定 diff set。
2. **AC-2**: **Given** before/after DESIGN.md 的 H2 section prose 有新增、删除或修改，**When** 调用 `buildDesignContextDiffReport`，**Then** report **SHALL** 在 `sections` 返回 added、removed、modified。
3. **AC-3**: **Given** after DESIGN.md lint errors/warnings 增加或 token removed，**When** 调用 `buildDesignContextDiffReport`，**Then** report **SHALL** 标记 `regression=true` 并返回 finding delta。

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
  "coveredSpecs": ["design-context-L3.3.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.3.1 + design-context-L2.3 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "代码调查: 读取 design-context.ts + design-context.test.ts + index.ts 并搜索 buildDesignContext"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 新增 diff core 类型和 API"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 token section finding diff"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/__tests__/design-context.test.ts 增加 diff core 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: npm test -- --run design-context.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只新增本地 core API 和测试，不改变现有 report contract、CLI 行为或外部系统。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| diff API 结构不合适 | revert 本 L3 的 diff 类型/API 和测试 | < 10 min |
| section diff 误判 | 调整 section key/content normalization，不影响已有 parser/lint | < 10 min |
| TypeScript 复杂度过高 | 将 diff helper 拆到内部小函数，公共 API 保持不变 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| design-context.ts 继续变大 | 先以内部 helper 实现；如过长，后续 L3 拆 `design-context-diff.ts` |
| stable compare 对 object key 顺序敏感 | 使用 stable JSON stringify 对 object key 排序 |
| regression 规则误解为强门禁 | core 只报告；后续 verification/docs 再说明使用边界 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.3 | 引用父 L2 |
| references | design-context-L3.2.1 | 复用 schema lint findings |
| implements | design-context-L2.3 | 实现 diff core slice |
