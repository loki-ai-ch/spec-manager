---
code: design-context-L3.3.2
level: L3
title: Design Diff Verification and Docs
topic: design-context
parentCode: design-context-L2.3
status: implemented
aiSummary: >-
  实施规格：新增 design-diff(before, after) verification、task completion 覆盖与
  README/readme_zh/skill 文档，引入 DESIGN.md diff regression evidence。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec show L3.3.2 + L2.3 + L3.3.1 + task list +
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: '代码与文档调查: verify.ts + verify/task-complete tests + README/readme_zh/skill'
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/verify.ts 扩展 design-diff rule 解析
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/verify.ts 实现 design-diff verification 执行
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 verify.test.ts 和 task-complete-verify.test.ts 增加 design-diff 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 更新 README/readme_zh/skill design-diff 文档
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证: npm test -- --run verify.test.ts task-complete-verify.test.ts + npm
      test + npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.3
  - type: references
    target: design-context-L3.3.1
  - type: references
    target: design-context-L3.1.3
  - type: implements
    target: design-context-L2.3
created: '2026-06-26T12:53:57.010Z'
updated: '2026-06-26T13:12:03.130Z'
changeSummary: 'cascade: task-complete'
---
# Design Diff Verification and Docs — 实施规格

## 目标

实施 `design-context-L2.3` 的第二段：将 `buildDesignContextDiffReport` 接入 `@verify: design-diff(before, after)`，让 DESIGN.md diff regression 可以作为 verification evidence 被 task completion 执行和记录；同时更新 README、readme_zh 与 spec-manager skill 指引，说明 review 用法和第一版边界。

保持既有 `design-lint(DESIGN.md)`、`command(...)`、`file-exists(...)`、`export-exists(...)` verification 行为不变。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.3.2 --include-content`
- `spec-manager spec show design-context-L2.3 --include-content`
- `spec-manager spec show design-context-L3.3.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`。

### Step 2 — 代码与文档调查

- 读取 `src/core/verify.ts`，确认 `VerifyRule`、`parseVerifyRules` 和 `executeVerifyRules` 扩展点。
- 读取 `src/core/__tests__/verify.test.ts`，确认 verification parser/executor fixture 写法。
- 读取 `src/core/__tests__/task-complete-verify.test.ts`，确认 task completion 自动执行 `@verify` 的覆盖方式。
- 搜索 README、readme_zh、skill 中的 DESIGN.md / design-lint / verify 文案。

### Step 3 — 扩展 verify rule 解析

- 在 `src/core/verify.ts` 扩展 `VerifyRule` 支持：
  - `{ type: 'design-diff'; beforePath: string; afterPath: string }`
- 在 `parseVerifyRules` 中解析：
  - `design-diff(DESIGN.before.md, DESIGN.md)` verify directive
- 保持 `splitArgs` 对逗号分隔参数的现有语义。
- step_report outputJson:
  ```json
  {"summary":"扩展 @verify 解析支持 design-diff(before, after)","files":["src/core/verify.ts"]}
  ```

### Step 4 — 实现 design-diff verification 执行

- 在 `src/core/verify.ts` 中调用 `buildDesignContextDiffReport`。
- 执行语义：
  - before 或 after 不存在时 `passed=false`。
  - after errors/warnings 增加时 `passed=false`。
  - 任意 token group removed 非空时 `passed=false`。
  - added/modified token 或 section 变化不单独失败，但 message 中给出摘要。
- message 应包含：
  - before/after 路径。
  - `errors/warnings` delta。
  - removed token group 摘要。
  - section added/removed/modified 摘要。
- step_report outputJson:
  ```json
  {"summary":"实现 design-diff verification 执行和摘要输出","files":["src/core/verify.ts"]}
  ```

### Step 5 — 增加 verification 测试

- 在 `src/core/__tests__/verify.test.ts` 增加：
  - `design-diff` parser 测试。
  - valid diff 无 regression 时通过。
  - removed token 导致失败。
  - after lint warning/error 增加导致失败。
  - before/after 缺失导致失败。
- 在 `src/core/__tests__/task-complete-verify.test.ts` 增加 task completion 执行 `@verify: design-diff(...)` 的成功/失败覆盖，确保 evidence gate 使用同一执行路径。
- step_report outputJson:
  ```json
  {"summary":"增加 design-diff verification 与 task completion 测试","files":["src/core/__tests__/verify.test.ts","src/core/__tests__/task-complete-verify.test.ts"]}
  ```

### Step 6 — 更新文档与 skill 指引

- 更新 `README.md`：补充 `design-diff(DESIGN.before.md, DESIGN.md)` verify directive review 示例和 regression 语义。
- 更新 `readme_zh.md`：补充中文用法。
- 更新 `.agents/skills/spec-manager/SKILL.md` 或对应模板 skill：说明涉及设计上下文 review 的 L3 可声明 `design-diff` verification。
- step_report outputJson:
  ```json
  {"summary":"更新 design-diff verification 文档和 skill 指引","files":["README.md","readme_zh.md",".agents/skills/spec-manager/SKILL.md"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-complete-verify.test.ts`。
- 运行 `npm test`。
- 运行 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 Design Diff Verification and Docs 验证","commands":["npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-complete-verify.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-complete-verify.test.ts
# 预期输出包含: verify.test.ts 与 task-complete-verify.test.ts

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

1. **AC-1**: **Given** L3 验收标准中声明 `design-diff(DESIGN.before.md, DESIGN.md)` verify directive，**When** 解析 verify rules，**Then** parser **SHALL** 返回包含 before/after 路径的 `design-diff` rule。
2. **AC-2**: **Given** before/after DESIGN.md 没有 lint regression 且没有 removed token，**When** 执行 `design-diff` verification，**Then** result **SHALL** `passed=true` 并在 message 中展示 diff 摘要。
3. **AC-3**: **Given** after DESIGN.md lint errors/warnings 增加或任意 token removed，**When** 执行 `design-diff` verification，**Then** result **SHALL** `passed=false` 并说明 regression 原因。
4. **AC-4**: **Given** 用户查阅 README/readme_zh/skill，**When** 搜索 design-diff 或 DESIGN.md review，**Then** 文档 **SHALL** 说明 `design-diff(before, after)` 用法、failure 语义和第一版结构 diff 边界。

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
  "coveredSpecs": ["design-context-L3.3.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec show L3.3.2 + L2.3 + L3.3.1 + task list + templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "代码与文档调查: verify.ts + verify/task-complete tests + README/readme_zh/skill"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/verify.ts 扩展 design-diff rule 解析"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/verify.ts 实现 design-diff verification 执行"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 verify.test.ts 和 task-complete-verify.test.ts 增加 design-diff 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "更新 README/readme_zh/skill design-diff 文档"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: npm test -- --run verify.test.ts task-complete-verify.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只新增本地 verification rule、测试与文档，不改变既有 verify rule contract，也不把 design-diff 设为默认门禁。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| `design-diff` rule 行为不合适 | revert verify.ts 中新增 rule 分支和相关测试/文档 | < 10 min |
| failure 语义过严 | 调整 `design-diff` executor 的 regression 判断，core diff API 不变 | < 10 min |
| 文档表达引发误解 | 修改 README/readme_zh/skill 中 regression 与结构 diff 边界说明 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `verify.ts` rule 类型膨胀 | 只新增一个局部分支；后续若继续增加 design rules 再拆 dispatcher |
| removed token 阻塞误伤 | 文档明确只在显式声明 `design-diff` 时作为 verification failure |
| section/prose diff 被误解为语义质量判断 | message 和文档说明第一版是结构/value diff，不做美学或语义相似度判断 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.3 | 引用父 L2 |
| references | design-context-L3.3.1 | 复用 diff core API |
| references | design-context-L3.1.3 | 复用 @verify execution 和 task evidence 路径 |
| implements | design-context-L2.3 | 实现 diff verification/docs slice |
