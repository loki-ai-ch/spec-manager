---
code: design-context-L3.2.2
level: L3
title: Design Lint Diagnostics UX
topic: design-context
parentCode: design-context-L2.2
status: implemented
aiSummary: >-
  实施规格：优化 DESIGN.md schema lint 诊断在 design-lint verification、assist brief text
  和文档中的呈现，保持 JSON contract 不变。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.2.2 + design-context-L2.2
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      代码与文档调查: 读取 capability.ts + verify.ts + capability/verify 测试 +
      README/readme_zh/skill
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/verify.ts 优化 design-lint verification message
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 优化 Design Context finding text 展示
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 verify.test.ts 和 capability.test.ts 增加 diagnostics UX 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 README.md readme_zh.md skill/SKILL.md 补充 schema lint diagnostics 文档
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证: npm test -- --run verify.test.ts capability.test.ts + npm test + npm
      run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.2
  - type: references
    target: design-context-L3.2.1
  - type: references
    target: design-context-L3.1.2
  - type: references
    target: design-context-L3.1.3
  - type: implements
    target: design-context-L2.2
created: '2026-06-26T08:30:53.035Z'
updated: '2026-06-26T08:40:13.485Z'
changeSummary: 'cascade: task-complete'
---
# Design Lint Diagnostics UX — 实施规格

## 目标

实施 `design-context-L2.2` 的第二段：优化 DESIGN.md schema lint 诊断在 CLI text brief、design-lint verification message 和文档中的呈现，让 Agent/用户能快速定位 token schema 错误。保持 `DesignContextReport` JSON contract 不变。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.2.2 --include-content`
- `spec-manager spec show design-context-L2.2 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`。

### Step 2 — 代码与文档调查

- 读取 `src/cli/capability.ts` 的 Design Context text rendering。
- 读取 `src/core/verify.ts` 的 `design-lint` message 生成逻辑。
- 读取 `src/cli/__tests__/capability.test.ts` 和 `src/core/__tests__/verify.test.ts` 的现有断言。
- 搜索 README、readme_zh、skill 中的 DESIGN.md / design-lint 文案。

### Step 3 — 优化 design-lint verification message

- 在 `src/core/verify.ts` 中优化 `design-lint` 失败 message：
  - 保留 `errors=` / `warnings=` / `infos=` summary。
  - 对失败结果展示最多 3 条 error finding。
  - 每条 finding 包含 severity、path 和 message。
  - 文件缺失 message 保持稳定。
- 不改变 `VerifyRule` 类型和 `executeVerifyRules` 返回结构。
- step_report outputJson:
  ```json
  {"summary":"优化 design-lint verification message 展示 schema findings","files":["src/core/verify.ts"]}
  ```

### Step 4 — 优化 Agent Brief text diagnostics

- 在 `src/cli/capability.ts` 中将 Design Context findings text 输出调整为更可扫描：
  - 输出最多 5 条非 info finding。
  - 每条包含 severity、path、message。
  - 当 findings 超过展示上限时输出剩余数量提示。
- JSON brief 保持完整 `designContext` 不变。
- step_report outputJson:
  ```json
  {"summary":"优化 assist brief text 的 Design Context finding 展示","files":["src/cli/capability.ts"]}
  ```

### Step 5 — 补充测试

- 在 `src/core/__tests__/verify.test.ts` 中断言 invalid schema verification message 包含 path 和最多多条 finding 摘要。
- 在 `src/cli/__tests__/capability.test.ts` 中增加 visual request + invalid DESIGN.md fixture，断言 brief text 展示 schema finding path/message 和剩余数量提示。
- step_report outputJson:
  ```json
  {"summary":"增加 diagnostics UX 测试","files":["src/core/__tests__/verify.test.ts","src/cli/__tests__/capability.test.ts"]}
  ```

### Step 6 — 补充文档示例

- 在 `README.md` 和 `readme_zh.md` 的 Design Context section 中补充常见 schema lint 示例：
  - invalid color/dimension/component schema 会产生 error。
  - unknown component property 会产生 warning。
  - `design-lint` 可作为 verification evidence。
- 在 `skill/SKILL.md` 中补一句：看到 Design Context findings 时先按 path 修复 DESIGN.md，再继续 UI 实现。
- step_report outputJson:
  ```json
  {"summary":"补充 DESIGN.md schema lint diagnostics 文档","files":["README.md","readme_zh.md","skill/SKILL.md"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/core/__tests__/verify.test.ts src/cli/__tests__/capability.test.ts`。
- 运行 `npm test`。
- 运行 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 Design Lint Diagnostics UX 验证","commands":["npm test -- --run src/core/__tests__/verify.test.ts src/cli/__tests__/capability.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/verify.test.ts src/cli/__tests__/capability.test.ts
# 预期输出包含: verify.test.ts
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

1. **AC-1**: **Given** DESIGN.md schema invalid，**When** 执行 design-lint verification，**Then** message **SHALL** 包含 summary、finding path 和 finding message，且最多展示 3 条 error。
2. **AC-2**: **Given** visual request 的 Agent Brief 包含多个 Design Context findings，**When** 渲染 text brief，**Then** 输出 **SHALL** 展示最多 5 条非 info finding，并在超限时展示剩余数量。
3. **AC-3**: **Given** 用户阅读 README 或 skill，**When** 查找 DESIGN.md schema lint，**Then** 文档 **SHALL** 说明 error/warning 示例和按 path 修复的工作方式。

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
  "coveredSpecs": ["design-context-L3.2.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.2.2 + design-context-L2.2 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "代码与文档调查: 读取 capability.ts + verify.ts + capability/verify 测试 + README/readme_zh/skill"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/verify.ts 优化 design-lint verification message"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/capability.ts 优化 Design Context finding text 展示"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 verify.test.ts 和 capability.test.ts 增加 diagnostics UX 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 README.md readme_zh.md skill/SKILL.md 补充 schema lint diagnostics 文档"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: npm test -- --run verify.test.ts capability.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只优化本地诊断输出、测试和文档，不改变 JSON contract、外部服务或数据模型。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 文案影响现有测试 | 回退 message 文案或调整测试断言为 path/severity 稳定字段 | < 10 min |
| text brief 过长 | 降低展示上限或只展示 error finding | < 5 min |
| 文档示例造成误解 | 调整 Design Context section 示例，不影响运行时代码 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| CLI text 输出变化破坏既有断言 | 只新增 Design Context finding 行，保留既有 summary 行 |
| verification message 过长 | 限制最多 3 条 error finding |
| JSON contract 被误改 | 测试覆盖 JSON brief，代码只改 text rendering |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.2 | 引用父 L2 |
| references | design-context-L3.2.1 | 使用 schema lint findings |
| references | design-context-L3.1.2 | 优化 Agent Brief 展示 |
| references | design-context-L3.1.3 | 优化 design-lint verification |
| implements | design-context-L2.2 | 实现 diagnostics UX slice |
