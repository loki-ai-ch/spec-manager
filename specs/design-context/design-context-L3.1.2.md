---
code: design-context-L3.1.2
level: L3
title: Agent Brief Design Context Projection
topic: design-context
parentCode: design-context-L2.1
status: implemented
aiSummary: >-
  实施规格：将 design-context core 报告注入 Agent Brief，扩展 AgentBrief 类型、brief builder、CLI
  presenter，并补充 core/CLI 测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.1.2 + design-context-L2.1
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      文件级分析: 读取 capability-types.ts + capability-brief.ts + cli/capability.ts +
      design-context.ts + brief 测试
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 扩展 src/core/capability-types.ts AgentBrief designContext 字段
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      更新 src/core/capability-brief.ts 注入 DESIGN.md designContext 和
      suggestedReads
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 更新 src/cli/capability.ts renderBriefText 展示 Design Context
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 新增 src/core/__tests__/capability-brief.test.ts designContext 单元测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 新增 src/cli/__tests__/capability.test.ts assist brief JSON/text 输出测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: >-
      验证: npm test -- --run capability-brief.test.ts capability.test.ts + npm
      test + npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.1
  - type: references
    target: design-context-L3.1.1
  - type: implements
    target: design-context-L2.1
created: '2026-06-26T02:49:35.554Z'
updated: '2026-06-26T02:58:19.451Z'
changeSummary: 'cascade: task-complete'
---
# Agent Brief Design Context Projection — 实施规格

## 目标

实施 `design-context-L2.1` 的 L3.1.2：将已实现的 `design-context` core 报告注入 Agent Brief，使 UI/视觉相关请求在存在 `DESIGN.md` 时获得设计摘要、source ref、JSON 输出和文本 presenter 展示。

**前置依赖**: `design-context-L3.1.1` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.1.2 --include-content`
- `spec-manager spec show design-context-L2.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`，确认 planJson 字段名。

### Step 2 — 文件级分析与契约确认

- 读取 `src/core/capability-types.ts`，确认 `AgentBrief` 与 `AssistSourceRef` 扩展位置。
- 读取 `src/core/capability-brief.ts`，确认 `buildAgentBrief` 构建顺序、`suggestedReads` 去重逻辑。
- 读取 `src/cli/capability.ts`，确认 `renderBriefText` 文本输出结构。
- 读取 `src/core/design-context.ts`，确认 `buildDesignContextReport` 和 `isDesignRelevantRequest` 可复用。
- 读取 `src/core/__tests__/capability-brief.test.ts` 与 `src/cli/__tests__/capability.test.ts`，确认测试 fixture 模式。

### Step 3 — 扩展 Agent Brief 类型

- 在 `src/core/capability-types.ts` 引入 `DesignContextReport` 类型。
- 给 `AgentBrief` 增加可选字段：
  ```ts
  designContext?: DesignContextReport;
  ```
- 如需要 source ref 类型，SHALL 优先复用 `config` 或现有 source kind，避免本 L3 扩散 source kind 枚举。
- step_report outputJson:
  ```json
  {"summary":"扩展 AgentBrief 类型以携带 designContext 报告","files":["src/core/capability-types.ts"]}
  ```

### Step 4 — 在 buildAgentBrief 注入 DESIGN.md 上下文

- 在 `src/core/capability-brief.ts` 引入 `buildDesignContextReport` 和 `isDesignRelevantRequest`。
- 构建逻辑：
  - 当 `isDesignRelevantRequest(request)` 为 true 时调用 `buildDesignContextReport({ paths })`。
  - 仅当 report `exists === true` 时写入 `designContext`。
  - 将 `DESIGN.md` 加入 `suggestedReads`，source ref 使用 `{ kind: 'config', id: 'DESIGN.md', path, summary }`。
  - 若 `DESIGN.md` 不存在，不添加 designContext，也不新增噪音 finding。
- step_report outputJson:
  ```json
  {"summary":"在 Agent Brief 中按 UI/视觉请求注入 DESIGN.md 设计上下文","files":["src/core/capability-brief.ts"]}
  ```

### Step 5 — 更新 CLI Brief 文本 presenter

- 在 `src/cli/capability.ts` 的 `renderBriefText` 中展示：
  - `Design Context: <name 或 DESIGN.md>`
  - lint summary: `errors/warnings/infos`
  - token counts
  - 最多 5 条 prose summary
  - 最多 5 条 error/warning findings
- JSON 输出无需额外 presenter，直接包含 `designContext`。
- step_report outputJson:
  ```json
  {"summary":"更新 assist brief 文本输出展示 Design Context 摘要","files":["src/cli/capability.ts"]}
  ```

### Step 6 — 增加 core brief 单元测试

- 更新 `src/core/__tests__/capability-brief.test.ts`：
  - UI 请求 + `DESIGN.md` 存在时，`brief.designContext` 存在。
  - `suggestedReads` 包含 `config:DESIGN.md`。
  - 非 UI 请求 + `DESIGN.md` 存在时，不注入 `designContext`。
  - UI 请求 + `DESIGN.md` 缺失时，不注入噪音 finding。
- step_report outputJson:
  ```json
  {"summary":"新增 Agent Brief designContext 注入单元测试","files":["src/core/__tests__/capability-brief.test.ts"]}
  ```

### Step 7 — 增加 CLI brief 输出测试

- 更新 `src/cli/__tests__/capability.test.ts`：
  - `assist brief --json` 在 UI 请求下包含 `designContext.schemaVersion`。
  - 文本输出包含 `Design Context`、设计名称和 lint summary。
- step_report outputJson:
  ```json
  {"summary":"新增 assist brief JSON/text designContext 输出测试","files":["src/cli/__tests__/capability.test.ts"]}
  ```

### Step 8 — 验证

- 运行定向 core/CLI brief 测试、全量测试和类型检查。
- step_report outputJson:
  ```json
  {"summary":"完成 Agent Brief design context projection 验证","commands":["npm test -- --run src/core/__tests__/capability-brief.test.ts src/cli/__tests__/capability.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/capability-brief.test.ts src/cli/__tests__/capability.test.ts
# 预期输出包含: capability-brief.test.ts
# 预期输出包含: capability.test.ts

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

1. **AC-1**: **Given** 项目根存在有效 `DESIGN.md` 且请求包含 UI/视觉/样式意图，**When** 调用 `buildAgentBrief`，**Then** brief **SHALL** 包含 `designContext` 报告。
2. **AC-2**: **Given** `designContext` 被注入，**When** 查看 JSON 或文本 brief，**Then** 输出 **SHALL** 包含设计名称、lint summary、token counts 和 source reference。
3. **AC-3**: **Given** 请求不是 UI/视觉相关或项目不存在 `DESIGN.md`，**When** 调用 `buildAgentBrief`，**Then** brief **MUST** 保持当前低噪音行为，不新增 designContext 或缺失文件 finding。

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
  "coveredSpecs": ["design-context-L3.1.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.1.2 + design-context-L2.1 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "文件级分析: 读取 capability-types.ts + capability-brief.ts + cli/capability.ts + design-context.ts + brief 测试"},
    {"stepNo": 3, "stepType": "tool_action", "name": "扩展 src/core/capability-types.ts AgentBrief designContext 字段"},
    {"stepNo": 4, "stepType": "tool_action", "name": "更新 src/core/capability-brief.ts 注入 DESIGN.md designContext 和 suggestedReads"},
    {"stepNo": 5, "stepType": "tool_action", "name": "更新 src/cli/capability.ts renderBriefText 展示 Design Context"},
    {"stepNo": 6, "stepType": "tool_action", "name": "新增 src/core/__tests__/capability-brief.test.ts designContext 单元测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "新增 src/cli/__tests__/capability.test.ts assist brief JSON/text 输出测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证: npm test -- --run capability-brief.test.ts capability.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只修改 brief projection、presenter 和测试，不涉及外部服务、数据迁移或破坏性操作。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| brief 输出噪音过大 | revert 本 L3 对 `capability-brief.ts`、`capability-types.ts`、`cli/capability.ts` 和测试的改动 | < 5 min |
| JSON 合约不合适 | 调整 `AgentBrief.designContext` 字段命名并同步测试 | < 10 min |
| presenter 文本格式不稳定 | 仅回滚文本 presenter，保留 JSON 字段和 core 注入 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 非 UI 请求误注入设计上下文 | 复用 `isDesignRelevantRequest`，并以测试覆盖非 UI 请求 |
| suggestedReads 重复 | 复用现有 `buildSuggestedReads` 去重逻辑，注入前统一合并 refs |
| 缺失 DESIGN.md 产生噪音 | 只在 `exists === true` 时注入，不把 missing-file warning 放进 brief findings |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.1 | 引用父 L2 |
| references | design-context-L3.1.1 | 依赖已实现的 design-context core API |
| implements | design-context-L2.1 | 实现 L2 的 Agent Brief Projection slice |
