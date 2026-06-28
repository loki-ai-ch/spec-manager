---
code: workflow-usability-hardening-L2.1
level: L2
title: Workflow Error Guidance and Safe Step Reporting
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L1
status: implemented
aiSummary: 技术设计：提升 planJson 诊断、task step 并发/批量上报安全、spec 段名 alias 修复建议。
relations:
  - type: based_on
    target: workflow-usability-hardening-L1
  - type: references
    target: workflow-hardening-L1
  - type: references
    target: spec-manager-ai-ux-L1
created: '2026-06-27T13:51:47.861Z'
updated: '2026-06-27T14:04:16.821Z'
changeSummary: 'cascade: task-complete'
---
# Workflow Error Guidance and Safe Step Reporting — 技术设计

## 方案概述

本设计将 spec-manager 的严格工作流门禁转化为更可操作的错误引导，并修复 task step 并行上报可能造成的状态丢失问题。

范围覆盖三条垂直切片：

1. **planJson diagnostics**：让 `task create` 在 schema 失败时输出字段级诊断和修复建议。
2. **safe step reporting**：让 step 上报在并发场景下不丢失不同 step 的状态，或提供官方 batch 入口。
3. **section alias guidance**：让 `实施计划` 等常见 alias 在 spec validate/critic 阶段得到明确修复建议。

本轮不弱化治理规则，不自动放行错误输入；只提升诊断、修复建议和并发写入安全。

## 背景与代码调查

- `src/core/task.ts#createTask` 当前先调用 `PlanJsonSchema.safeParse`；当字段名是 `no/type` 时，Zod 只输出 `Required`，用户看不到 `validatePlanJson` 中已有的 INC-005 字段提示。
- `src/core/validate.ts#validatePlanJson` 已能识别 `no/type/desc` 禁用字段，但当前在 `task create` schema parse 之后才运行。
- `src/core/task.ts#reportStep` 当前读取 task JSON、替换目标 step、再写回文件；多个进程并行执行时，可能基于旧快照覆盖其他 step 更新。
- `src/cli/task.ts#step` 每次只上报一个 step，缺少官方 batch 入口。
- `src/core/spec-sections.ts#sectionBody` 精确匹配 `## 验证命令`、`## 关键验收标准` 等段名。
- `src/core/spec-critic.ts` 已有 section rule 模型，适合承载 alias warning/advisory。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| planJson 诊断 | schema parse 失败时先运行 diagnostic builder，再拼接 Zod issue | 保持强校验，同时输出可读修复建议 |
| 字段 alias | 不在 `task create` 自动接受 `no/type/desc` | 避免隐式迁移导致 planJson contract 模糊 |
| step 并发安全 | 在 `reportStep` 写入前重新读取最新 task 并 merge 当前 step；必要时做 bounded retry | 保持现有 CLI 兼容，不要求用户改调用方式 |
| batch 上报 | 新增 `task step-batch <taskId> --input <json>` | 为 Agent 提供推荐的多 step 上报入口，减少并发进程写入 |
| 段名 alias | validate/critic 输出 warning/advisory，不直接改 markdown | 默认只读，保持用户显式修复 |

## 接口契约

### planJson diagnostics

新增 core helper：

```ts
export interface PlanJsonDiagnostic {
  path: string;
  message: string;
  suggestion?: string;
}

export function buildPlanJsonDiagnostics(plan: unknown): PlanJsonDiagnostic[];
```

`task create` schema 失败时输出：

```text
✗ PLAN_JSON_INVALID
  - steps[0].stepNo is required. Found legacy field "no"; use "stepNo".
  - steps[0].stepType is required. Found legacy field "type"; use "stepType".

Example:
{
  "coveredSpecs": ["<specCode>"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取规格并检查代码"},
    {"stepNo": 2, "stepType": "tool_action", "name": "运行验证 npm test"}
  ]
}
```

JSON 输出模式保留结构化 error message，不改变 exit code。

### safe step reporting

`reportStep` 写入语义调整：

1. 读取 task 当前快照。
2. 基于最新快照替换目标 `stepNo`。
3. 只覆盖当前 step，不用调用开始时读取的旧 `steps` 覆盖整个数组。
4. 对写入前后 mtime 或内容 hash 变化做有限 retry，避免并发冲突。

### task step-batch

新增 CLI：

```bash
spec-manager task step-batch T-001 --spec auth-L3.1.1 --input ./steps.json
```

输入：

```json
{
  "steps": [
    {
      "stepNo": 1,
      "status": "succeeded",
      "outputJson": "{\"summary\":\"...\"}"
    }
  ]
}
```

batch 内按顺序应用每个 step，返回每个 step 的 warning。该命令仍使用现有 `reportStep` 语义，不绕过 R15 warning。

### section alias guidance

新增 alias 表：

```ts
const SECTION_HEADING_ALIASES = {
  "实施计划": "实施步骤",
  "执行计划": "实施步骤",
  "验证方式": "验证命令"
};
```

当缺必填段但存在 alias 段时，输出：

```text
⚠ [section_alias] [L3] 检测到 "## 实施计划"，规范段名应为 "## 实施步骤"
```

critic 也可输出 advisory，帮助 Agent 在确认前修复。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/validate.ts` | 新增 planJson diagnostics、section alias 检查 |
| `src/schemas/spec.ts` | 可选：补充 schema error map 或保留现状 |
| `src/core/task.ts` | 调整 createTask 错误输出；增强 reportStep merge/retry |
| `src/cli/task.ts` | 增加 `task step-batch` 命令 |
| `src/core/spec-critic.ts` | 增加 section alias advisory |
| `src/core/__tests__` | 增加 planJson、task 并发/批量、alias 测试 |
| `src/cli/__tests__` | 增加 CLI error 文案与 batch 测试 |
| `README.md` / `readme_en.md` / `skill/SKILL.md` | 文档说明新诊断与 batch 入口 |

## L3 裂变计划

| L3 | 标题 | 范围 |
|---|---|---|
| `workflow-usability-hardening-L3.1.1` | PlanJson Actionable Diagnostics | `task create` planJson 错误诊断、示例输出、测试 |
| `workflow-usability-hardening-L3.1.2` | Safe and Batch Task Step Reporting | `reportStep` merge/retry、`task step-batch`、并发/批量测试 |
| `workflow-usability-hardening-L3.1.3` | Spec Section Alias Guidance | L3 段名 alias warning/advisory、spec validate/critic 测试 |

## 验证策略

| 场景 | 验证 |
|---|---|
| planJson 错误字段 | 单测覆盖 `no/type/desc` 输出具体修复建议 |
| R10/R12 兼容 | 现有 R10/R12 行为保持 |
| 并发 step | 单测或集成测试模拟两个 step 更新不会丢失 |
| batch step | CLI 测试覆盖 input JSON、多 step warning 和状态更新 |
| section alias | validate/critic 测试覆盖 `实施计划 -> 实施步骤` |
| 全量回归 | `npm test`、`npm run lint`、`npm run build` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 错误文案过长 | text 模式展示摘要 + example；json 模式保留结构化 diagnostics |
| 并发 retry 仍无法完全保证跨文件系统锁 | 推荐 `step-batch`，merge/retry 作为兼容保护 |
| alias 过多导致规范模糊 | 只维护高频 alias，不自动接受，不自动修改 |
| batch 命令绕过单步 warning | batch 内复用 `reportStep`，逐步返回 warnings |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | workflow-usability-hardening-L1 | 承接 PRD |
| references | workflow-hardening-L1 | 延续流程硬化主题 |
| references | spec-manager-ai-ux-L1 | 改善 Agent 使用体验 |
