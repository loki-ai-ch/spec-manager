---
code: delivery-summary-L3.1.2
level: L3
title: 交付摘要 CLI 与文档
topic: delivery-summary
parentCode: delivery-summary-L2.1
status: implemented
aiSummary: 实现交付摘要 CLI 与文档：新增 assist delivery text/json 输出、CLI 测试和交付前文档提示。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 delivery-summary-L3.1.2 与现有 CLI/文档，确认实现边界
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 assist delivery CLI 与 text/json 渲染
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 新增 CLI tests 覆盖 text/json/error/只读性
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 更新 README、readme_zh、skill 和 templates 的交付提示
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行 targeted tests、full tests、build 与 spec validate
    status: pending
created: '2026-06-17T07:44:28.699Z'
updated: '2026-06-17T07:54:24.898Z'
changeSummary: 'cascade: task-complete'
---
# 交付摘要 CLI 与文档 — L3 Impl

## 背景

`delivery-summary-L3.1.1` 已实现只读 core projection `buildDeliverySummary`。本片把该 projection 暴露到 CLI，并把交付前生成 delivery summary 的建议写入用户/Agent 文档。

本片不修改 core projection 口径，不改变 `assist guide` 路由，不自动完成 Task，不写 spec/task/audit。

## 目标

- 新增 `spec-manager assist delivery <taskId> --spec <specCode> [--json]`。
- text 输出覆盖 L2 要求的所有块：Delivery Summary、Task、Spec、Status、Summary、Steps、Verifications、Artifacts、Human Acceptance、Residual Risk、Next Action。
- JSON 输出直接返回 `DeliverySummaryReport`，schemaVersion 为 `delivery-summary.v1`。
- missing spec/task 使用现有 `handleTaskSpecError`。
- README、readme_zh、skill、templates 中增加交付前可运行 delivery summary 的短提示。
- 保持命令只读，不触发 task verify/task complete/task step。

## 实现范围

新增/修改：

- `src/cli/capability.ts`
  - import `buildDeliverySummary`
  - 新增 `assist delivery <taskId>` 命令
  - 新增 `renderDeliverySummaryText`
- `src/cli/__tests__/capability.test.ts`
  - 新增 JSON contract 测试
  - 新增 text 输出测试
  - missing resource 测试覆盖 delivery
- `README.md`
- `readme_zh.md`
- `skill/SKILL.md`
- `templates/agents/AGENTS.md`
- `templates/agents/CLAUDE.md`
- `templates/agents/CODEBUDDY.md`
- `templates/agents/CURSOR.md`
- `templates/agents/WINDSURF.md`
- `templates/agents/codebuddy-skill/SKILL.md`

不包含：

- 不修改 `buildDeliverySummary` 行为，除非测试暴露直接 bug。
- 不修改 `assist guide` stage 推荐。
- 不新增 completion 子命令，除非现有 completion 测试要求显式同步。
- 不执行或记录外部验证命令。

## 接口契约

### CLI

```bash
spec-manager assist delivery <taskId> --spec <specCode>
spec-manager assist delivery <taskId> --spec <specCode> --json
```

参数：

- `<taskId>`：必填。
- `--spec <specCode>`：必填，限定 task 所属 L3 spec。
- `--json`：可选，输出完整 `DeliverySummaryReport`。

错误：

- spec 不存在：stderr `✗ SPEC_NOT_FOUND: <specCode>`，exit 1。
- task 不存在：stderr `✗ TASK_NOT_FOUND: <taskId> (in <specCode>)`，exit 1。
- unknown critical AC：沿用 existing assist behavior，exit 2。

### Text 输出

默认 text 输出结构：

```text
Delivery Summary
Task: T-001
Spec: example-L3.1.1
Status: completed
Headline: Delivery summary for example-L3.1.1 / T-001

Summary:
  - ...

Steps:
  - [succeeded] 1: Read spec

Verifications:
  - V-001 passed layer=functional
    npm test
    all tests passed

Artifacts:
  - coverage/index.html

Human Acceptance:
  - [advisory] acceptance.no-critical-ac: No critical AC declared
    ...

Residual Risk:
  - [advisory] acceptance.residual-risk.no-artifacts: No verification artifacts
    ...

Findings:
  - [advisory] delivery.residual-risk.present: Residual risk present
    ...

Next Action:
  Share this delivery summary with the user for final confirmation.
```

文案约束：

- 不使用“业务已通过”“完全完成”等超出机器证据的断言。
- 对空列表输出 `  - none`。
- verification 显示 passed/failed、layer、command、summary。

## 实施步骤

1. 读取冻结 L3、`capability.ts`、CLI tests、README/skill/templates 现状。
2. 在 `src/cli/capability.ts` 接入 `buildDeliverySummary`，实现 `assist delivery` 和 text renderer。
3. 在 CLI tests 中构造 frozen L3 + task + verification，覆盖 text/json 和 missing resource。
4. 更新 README/readme_zh/skill/templates 的交付提示，建议在最终回复前运行 `spec-manager assist delivery <taskId> --spec <specCode>`。
5. 运行 targeted CLI tests、full tests、build、spec validate。
6. 记录 Task steps 和 verification evidence，完成 Task。

## 关键验收标准

- **AC-1**: Given 已存在 task 和 spec，When 执行 `assist delivery <taskId> --spec <specCode>`，Then text 输出包含 Delivery Summary、Task、Spec、Status、Summary、Steps、Verifications、Artifacts、Human Acceptance、Residual Risk、Next Action。
- **AC-2**: Given `--json`，When 执行 delivery 命令，Then 输出 JSON `schemaVersion=delivery-summary.v1`，并包含 taskId、specCode、summary、verifications、artifacts、humanAcceptance、residualRisk、nextAction。
- **AC-3**: Given missing spec/task，When 执行 delivery 命令，Then 使用现有 assist resource error 语义，exit 1。
- **AC-4**: Given 运行 delivery 命令，Then 不改变 task 状态，不新增 task steps，不新增 verification，不完成 task。
- **AC-5**: Given 文档/模板，Then 交付前建议包含 `spec-manager assist delivery <taskId> --spec <specCode>` 或同义说明。

## 测试计划

CLI tests：

1. `prints delivery summary JSON contract`
2. `prints delivery summary text output`
3. `rejects missing task for next, drift, acceptance, delivery`
4. `does not mutate task state when rendering delivery summary`

回归验证：

- `npm test -- src/cli/__tests__/capability.test.ts`
- `npm test`
- `npm run build`
- `spec-manager spec validate delivery-summary-L3.1.2`

## Agent Task Plan

```json
{
  "coveredSpecs": ["delivery-summary-L3.1.2"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "读取 delivery-summary-L3.1.2 与现有 CLI/文档，确认实现边界"
    },
    {
      "stepNo": 2,
      "stepType": "tool_action",
      "name": "新增 assist delivery CLI 与 text/json 渲染"
    },
    {
      "stepNo": 3,
      "stepType": "tool_action",
      "name": "新增 CLI tests 覆盖 text/json/error/只读性"
    },
    {
      "stepNo": 4,
      "stepType": "tool_action",
      "name": "更新 README、readme_zh、skill 和 templates 的交付提示"
    },
    {
      "stepNo": 5,
      "stepType": "tool_action",
      "name": "运行 targeted tests、full tests、build 与 spec validate"
    }
  ]
}
```

## 验证命令

- `npm test -- src/cli/__tests__/capability.test.ts`
- `npm test`
- `npm run build`
- `spec-manager spec validate delivery-summary-L3.1.2`

## 风险与约束

- CLI text 必须只表达记录事实，不能声称业务已经验收。
- 文档改动保持短提示，不重写整套 workflow 文档。
- 本片不改变 `assist guide`，避免扩大路由行为面。
