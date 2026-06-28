---
code: workflow-usability-hardening-L3.1.1
level: L3
title: PlanJson Actionable Diagnostics
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L2.1
status: implemented
aiSummary: >-
  实施规格：为 task create planJson 错误增加字段级 actionable diagnostics，保留现有 contract 与
  R10/R12 行为。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey planJson validation and task create code
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement actionable planJson diagnostics
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update core and CLI tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
relations:
  - type: based_on
    target: workflow-usability-hardening-L2.1
created: '2026-06-27T13:58:17.801Z'
updated: '2026-06-27T14:04:16.815Z'
changeSummary: 'cascade: task-complete'
---
# PlanJson Actionable Diagnostics — 实施规格

## 目标

改进 `spec-manager task create <specCode> --plan <file>` 的 planJson 错误提示。当 planJson 使用旧字段或缺字段时，CLI 应输出字段路径、具体问题、建议字段和最小示例，而不是只输出 `Invalid input; Required`。

## 范围

包含：

- 新增 planJson diagnostic builder。
- 在 `createTask` schema parse 失败时输出 actionable diagnostics。
- 保持 `stepNo/stepType/name` 作为正式 contract，不自动接受 `no/type/desc`。
- 更新 CLI 错误捕获，让 `task create` 对 planJson 问题以 exit code 2 输出友好错误。
- 增加 core/CLI 测试覆盖旧字段、缺字段、无效 stepType、R10/R12 兼容。

不包含：

- `task step` 并发安全。
- `task step-batch`。
- spec 段名 alias。
- docs/package check。

## 关键验收标准

1. **AC-1**: `task create` MUST 在 `steps[0].no` / `steps[0].type` / `steps[0].desc` 输入下输出对应 `stepNo` / `stepType` / `name` 修复建议。
2. **AC-2**: `task create` MUST 保持错误输入不创建 task 文件、不修改 L3 spec frontmatter steps。
3. **AC-3**: `task create` MUST 对缺失 `coveredSpecs` 继续输出现有 R12 示例，不退化。
4. **AC-4**: `task create` MUST 对末步缺少验证语义继续触发 R10，不退化。
5. **AC-5**: `spec-manager spec validate-plan <file>` SHOULD 复用同一字段诊断语义或保持等价提示。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/validate.ts` | 新增 `buildPlanJsonDiagnostics`，复用/增强现有 `validatePlanJson` 字段提示 |
| `src/core/task.ts` | schema parse 失败时抛出包含 diagnostics 的 `PLAN_JSON_INVALID` 错误 |
| `src/cli/task.ts` | 捕获 `PLAN_JSON_INVALID` 并以 exit code 2 输出友好文本 |
| `src/cli/spec.ts` | 可选：`validate-plan` 输出字段 suggestion |
| `src/core/__tests__/validate.test.ts` | 覆盖 diagnostic builder |
| `src/core/__tests__/task.test.ts` | 覆盖 createTask 不写入副作用 |
| `src/cli/__tests__/task.test.ts` | 覆盖 CLI 文案和 exit code |

## 实施步骤

1. 读取 `src/core/validate.ts`、`src/core/task.ts`、`src/cli/task.ts`、相关测试，确认当前错误路径。
2. 在 `src/core/validate.ts` 新增 `PlanJsonDiagnostic` 与 `buildPlanJsonDiagnostics(plan, specCode?)`。
3. 调整 `createTask`：`PlanJsonSchema.safeParse` 失败时组合 diagnostics 和 Zod issue，抛出稳定前缀 `PLAN_JSON_INVALID:`。
4. 调整 `task create` CLI：识别 `PLAN_JSON_INVALID:`，输出多行可读错误并 `process.exit(2)`。
5. 更新 `spec validate-plan` 输出，使字段错误提示含 suggested replacement。
6. 增加 core/CLI 测试覆盖 AC-1 至 AC-5。
7. 运行聚焦测试与全量验证。

## 验证命令

```bash
npm test -- --run src/core/__tests__/validate.test.ts src/core/__tests__/task.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/spec.test.ts
npm test
npm run lint
npm run build
```

## 回滚策略

若新诊断影响 CLI 兼容性，回滚 `PLAN_JSON_INVALID` 文案拼接和 CLI 捕获即可；schema contract 与 task 文件格式不变。
