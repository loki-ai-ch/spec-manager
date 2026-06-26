---
code: design-context-L3.1.4
level: L3
title: Documentation and Usage Guidance
topic: design-context
parentCode: design-context-L2.1
status: implemented
aiSummary: >-
  实施规格：补充 DESIGN.md 设计上下文文档与 skill 指引，说明 assist brief 注入、design-lint
  verification、范围边界和中英文用法。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.1.4 + design-context-L2.1
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      文档落点分析: 读取 README.md + readme_zh.md + skill/SKILL.md 并搜索 DESIGN.md 和
      assist brief
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 更新 README.md DESIGN.md 设计上下文使用说明
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 更新 readme_zh.md DESIGN.md 设计上下文使用说明
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 更新 skill/SKILL.md DESIGN.md brief 和 design-lint 指引
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      验证: npm test -- --run methodology-contract.test.ts design-context.test.ts
      verify.test.ts + npm test + npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.1
  - type: references
    target: design-context-L3.1.1
  - type: references
    target: design-context-L3.1.2
  - type: references
    target: design-context-L3.1.3
  - type: implements
    target: design-context-L2.1
created: '2026-06-26T07:39:47.767Z'
updated: '2026-06-26T07:50:12.720Z'
changeSummary: 'cascade: task-complete'
---
# Documentation and Usage Guidance — 实施规格

## 目标

实施 `design-context-L2.1` 的 L3.1.4：补充 DESIGN.md 设计上下文的用户文档和 Agent 指引，说明如何创建 `DESIGN.md`、如何通过 `assist brief` 自动注入设计上下文、如何用 `@verify: design-lint(DESIGN.md)` 记录验收证据，以及第一版不做自动 UI 生成/外部 CLI 硬依赖。

**前置依赖**: `design-context-L3.1.1`、`design-context-L3.1.2`、`design-context-L3.1.3` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.1.4 --include-content`
- `spec-manager spec show design-context-L2.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`，确认 planJson 字段名。

### Step 2 — 文档落点分析

- 读取 `README.md`，确认英文用户入口位置。
- 读取 `readme_zh.md`，确认中文用户入口位置。
- 读取 `skill/SKILL.md`，确认 Agent workflow 指引位置。
- 搜索 `rg -n "assist brief|@verify|DESIGN.md|Verification|Agent Brief" README.md readme_zh.md skill templates rules docs`，确认不重复引入冲突内容。

### Step 3 — 更新 README DESIGN.md 使用说明

- 在 `README.md` 中新增简短 section，说明：
  - 项目根目录可放 `DESIGN.md`。
  - UI/视觉相关 `assist brief` 会自动包含 Design Context。
  - L3 可用 `@verify: design-lint(DESIGN.md)` 把设计 lint 作为 verification evidence。
  - 第一版不自动生成或修改 UI。
- step_report outputJson:
  ```json
  {"summary":"更新 README DESIGN.md 设计上下文使用说明","files":["README.md"]}
  ```

### Step 4 — 更新中文 README 使用说明

- 在 `readme_zh.md` 中同步中文说明，覆盖同样四点。
- step_report outputJson:
  ```json
  {"summary":"更新中文 README DESIGN.md 设计上下文使用说明","files":["readme_zh.md"]}
  ```

### Step 5 — 更新 skill 指引

- 在 `skill/SKILL.md` 的 assist / 执行阶段说明中补充：
  - UI/视觉任务先使用 `spec-manager assist brief --request "<需求>"` 查看 DESIGN.md 上下文。
  - 涉及设计约束验收的 L3 可声明 `@verify: design-lint(DESIGN.md)`。
  - 不把 DESIGN.md 能力误认为 L2 Design 技术设计。
- step_report outputJson:
  ```json
  {"summary":"更新 skill 指引补充 DESIGN.md brief 和 design-lint 用法","files":["skill/SKILL.md"]}
  ```

### Step 6 — 文档验证

- 运行 `npm test -- --run src/core/__tests__/methodology-contract.test.ts src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts`。
- 运行 `npm test` 和 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 DESIGN.md docs guidance 验证","commands":["npm test -- --run src/core/__tests__/methodology-contract.test.ts src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/core/__tests__/methodology-contract.test.ts src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts
# 预期输出包含: methodology-contract.test.ts
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

1. **AC-1**: **Given** 用户阅读 README，**When** 查找 DESIGN.md 支持，**Then** 文档 **SHALL** 说明根目录 DESIGN.md、assist brief 注入、design-lint verification 和第一版不做自动 UI 生成。
2. **AC-2**: **Given** Agent 使用 `skill/SKILL.md` 执行 UI/视觉任务，**When** 需要设计上下文，**Then** 指引 **SHALL** 提示使用 `assist brief` 并区分 DESIGN.md 与 L2 Design。
3. **AC-3**: **Given** L3 需要验证设计约束，**When** 用户查阅文档或 skill，**Then** 文档 **SHALL** 提供 design-lint verify directive 示例。

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
  "coveredSpecs": ["design-context-L3.1.4"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.1.4 + design-context-L2.1 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "文档落点分析: 读取 README.md + readme_zh.md + skill/SKILL.md 并搜索 DESIGN.md 和 assist brief"},
    {"stepNo": 3, "stepType": "tool_action", "name": "更新 README.md DESIGN.md 设计上下文使用说明"},
    {"stepNo": 4, "stepType": "tool_action", "name": "更新 readme_zh.md DESIGN.md 设计上下文使用说明"},
    {"stepNo": 5, "stepType": "tool_action", "name": "更新 skill/SKILL.md DESIGN.md brief 和 design-lint 指引"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证: npm test -- --run methodology-contract.test.ts design-context.test.ts verify.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只修改文档与 Agent 指引，不涉及运行时代码、外部服务、数据迁移或破坏性操作。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 文档位置不合适 | revert 本 L3 对 README/readme_zh/skill 的改动后重新放置 | < 5 min |
| 指引表述造成误解 | 调整相关段落，不影响已实现代码能力 | < 5 min |
| methodology contract 失败 | 按失败快照调整 skill/README 文案，保留 DESIGN.md 核心说明 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 文档过长影响 onboarding | 采用短 section + 示例命令，不展开 DESIGN.md 完整规范 |
| 混淆 L2 Design 与 DESIGN.md | 文档显式说明 DESIGN.md 是 visual/design context，不是 L2 technical design |
| 中英文内容不一致 | README 与 readme_zh 同步同样能力边界和命令示例 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.1 | 引用父 L2 |
| references | design-context-L3.1.1 | DESIGN.md core |
| references | design-context-L3.1.2 | Agent Brief 注入 |
| references | design-context-L3.1.3 | design-lint verification |
| implements | design-context-L2.1 | 实现 L2 的 docs guidance slice |
