---
code: design-context-L3.1.3
level: L3
title: Design Lint Verification and Evidence
topic: design-context
parentCode: design-context-L2.1
status: implemented
aiSummary: >-
  实施规格：扩展 @verify 支持 design-lint(DESIGN.md)，复用 design-context report 执行 lint，并验证
  task evidence/acceptance 可展示覆盖证据。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.1.3 + design-context-L2.1
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      文件级分析: 读取 verify.ts + design-context.ts + task-evidence.ts +
      acceptance-report.ts + verify/evidence 测试
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 扩展 src/core/verify.ts VerifyRule 和 parseVerifyRules 支持 design-lint
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 实现 src/core/verify.ts design-lint 执行逻辑复用 design-context report
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 src/core/__tests__/verify.test.ts design-lint parser/executor 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 新增 src/core/__tests__/task-evidence.test.ts design-lint evidence 覆盖测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证: npm test -- --run verify.test.ts task-evidence.test.ts + npm test +
      npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.1
  - type: references
    target: design-context-L3.1.1
  - type: implements
    target: design-context-L2.1
created: '2026-06-26T03:01:40.938Z'
updated: '2026-06-26T03:11:22.979Z'
changeSummary: 'cascade: task-complete'
---
# Design Lint Verification and Evidence — 实施规格

## 目标

实施 `design-context-L2.1` 的 L3.1.3：扩展 `@verify` 支持 `design-lint(DESIGN.md)`，让 L3/Task 可以将 DESIGN.md lint 作为结构化 verification evidence 记录，并被现有 task evidence / acceptance report 投影读取。

**前置依赖**: `design-context-L3.1.1` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.1.3 --include-content`
- `spec-manager spec show design-context-L2.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`，确认 planJson 字段名。

### Step 2 — 文件级分析与现有证据链确认

- 读取 `src/core/verify.ts`，确认 `VerifyRule` union、`VERIFY_TYPE_ARITY`、`parseVerifyRules` 和 `executeOne` 扩展点。
- 读取 `src/core/design-context.ts`，确认 `buildDesignContextReport` 结果和 errors/warnings/infos 语义。
- 读取 `src/core/__tests__/verify.test.ts`，确认 parser/executor fixture 模式。
- 读取 `src/core/task-evidence.ts` 与 `src/core/acceptance-report.ts`，确认 task evidence 已读取 `TaskVerificationRecord`，本 L3 无需改变 evidence projection 算法。
- 读取 `src/core/__tests__/task-evidence.test.ts` 或 `acceptance-report.test.ts`，确认记录 verification 后即可覆盖 AC。

### Step 3 — 扩展 VerifyRule 类型与解析

- 在 `src/core/verify.ts` 扩展 union：
  ```ts
  | { type: 'design-lint'; path: string }
  ```
- 在 `VERIFY_TYPE_ARITY` 增加 `'design-lint': 1`。
- 在 `parseVerifyRules` 中支持 `@verify: design-lint(DESIGN.md)`。
- step_report outputJson:
  ```json
  {"summary":"扩展 verify 规则解析以支持 design-lint(path)","files":["src/core/verify.ts"]}
  ```

### Step 4 — 实现 design-lint 执行逻辑

- 在 `src/core/verify.ts` 引入 `buildDesignContextReport`，在 `executeOne` 中新增 `design-lint` 分支。
- 执行语义：
  - 调用 `buildDesignContextReport({ paths: getPaths(projectRoot), filePath: rule.path })` 或等价方式以 projectRoot 为根。
  - `report.exists === false`：`passed=false`，message 包含 `DESIGN.md not found`。
  - `report.result.errors > 0`：`passed=false`，message 包含 `errors=<n>, warnings=<n>, infos=<n>`。
  - `errors === 0`：`passed=true`，message 包含 lint summary；warnings/info 不阻塞。
- SHALL 使用现有路径安全逻辑，不允许绝对路径越过 projectRoot。
- step_report outputJson:
  ```json
  {"summary":"实现 design-lint verify 执行逻辑并复用 design-context report","files":["src/core/verify.ts"]}
  ```

### Step 5 — 增加 verify 单元测试

- 更新 `src/core/__tests__/verify.test.ts`：
  - parser 能解析 `design-lint(DESIGN.md)`。
  - valid DESIGN.md 执行通过。
  - missing DESIGN.md 执行失败。
  - broken token reference 执行失败并输出 summary。
  - warning-only DESIGN.md 执行通过。
- step_report outputJson:
  ```json
  {"summary":"新增 design-lint verify parser/executor 单元测试","files":["src/core/__tests__/verify.test.ts"]}
  ```

### Step 6 — 增加 evidence/acceptance 兼容测试

- 在 `src/core/__tests__/task-evidence.test.ts` 或 `acceptance-report.test.ts` 新增一个轻量测试：
  - 创建带关键 AC 的 L3 task。
  - 记录一条 command 为 `@verify design-lint(DESIGN.md)` 或 `design-lint(DESIGN.md)` 的 successful verification，`coversAc: ['AC-1']`。
  - 断言 `buildTaskEvidence` 或 `buildAcceptanceReport` 将 AC 标记为 covered，并展示 verification。
- 不修改 task evidence core 算法。
- step_report outputJson:
  ```json
  {"summary":"新增 design-lint verification 可被 task evidence 投影覆盖 AC 的测试","files":["src/core/__tests__/task-evidence.test.ts"]}
  ```

### Step 7 — 验证

- 运行定向 verify/evidence 测试、全量测试和类型检查。
- step_report outputJson:
  ```json
  {"summary":"完成 design-lint verification/evidence 验证","commands":["npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-evidence.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-evidence.test.ts
# 预期输出包含: verify.test.ts
# 预期输出包含: task-evidence.test.ts

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

1. **AC-1**: **Given** L3 验收标准段包含 design-lint verify directive，**When** 调用 `parseVerifyRules`，**Then** 规则 **SHALL** 被解析为 `{ type: 'design-lint', path: 'DESIGN.md' }`。
2. **AC-2**: **Given** 项目根存在 valid / missing / broken DESIGN.md，**When** 执行 `executeVerifyRules`，**Then** `design-lint` **SHALL** 分别返回 pass / fail / fail，并在 message 中包含 lint summary。
3. **AC-3**: **Given** Task 记录 successful design-lint verification 且覆盖 AC，**When** 构建 task evidence 或 acceptance report，**Then** 对应 AC **SHALL** 显示 covered 且关联 verification id。

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
  "coveredSpecs": ["design-context-L3.1.3"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.1.3 + design-context-L2.1 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "文件级分析: 读取 verify.ts + design-context.ts + task-evidence.ts + acceptance-report.ts + verify/evidence 测试"},
    {"stepNo": 3, "stepType": "tool_action", "name": "扩展 src/core/verify.ts VerifyRule 和 parseVerifyRules 支持 design-lint"},
    {"stepNo": 4, "stepType": "tool_action", "name": "实现 src/core/verify.ts design-lint 执行逻辑复用 design-context report"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 src/core/__tests__/verify.test.ts design-lint parser/executor 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "新增 src/core/__tests__/task-evidence.test.ts design-lint evidence 覆盖测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: npm test -- --run verify.test.ts task-evidence.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 修改本地 verify core 与单元测试，不涉及外部服务、数据迁移或破坏性操作。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| verify 解析兼容性问题 | revert 本 L3 对 `src/core/verify.ts` 和测试的改动 | < 5 min |
| design-lint 误阻塞 | 保留 parser，临时将 executor 中 warning-only pass 逻辑收窄到 errors-only fail | < 5 min |
| evidence 测试暴露旧模型约束 | 不改 evidence core，调整测试为直接记录 TaskVerificationRecord 覆盖 AC | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `getPaths(projectRoot)` 与测试临时目录初始化状态不一致 | design-lint 只需要 root 路径；测试创建 `.spec-manager` fixture |
| 路径安全与现有 verify path.resolve 风格不一致 | design-lint 分支复用 `buildDesignContextReport` 的 `resolveWithin` 逻辑 |
| message 断言过脆 | 测试只断言关键片段：`errors=`, `warnings=`, `not found` |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.1 | 引用父 L2 |
| references | design-context-L3.1.1 | 依赖 design-context core API |
| implements | design-context-L2.1 | 实现 L2 的 Verification/Evidence Bridge slice |
