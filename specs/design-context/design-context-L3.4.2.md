---
code: design-context-L3.4.2
level: L3
title: Design Export CLI and Docs
topic: design-context
parentCode: design-context-L2.4
status: implemented
aiSummary: >-
  实施规格：新增 assist design-export/design-template CLI 入口，覆盖 stdout/out 文件输出、starter
  DESIGN.md 生成，以及 README/readme_zh/skill 文档。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec show L3.4.2 + L2.4 + L3.4.1 + task list +
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      CLI 与文档调查: 读取 capability.ts + capability.test.ts + design-context.ts +
      README/readme_zh/skill
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 新增 assist design-export 命令
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 新增 assist design-template 命令
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/cli/__tests__/capability.test.ts 增加 design export/template CLI 测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 更新 README/readme_zh/skill design export/template 文档
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证: npm test -- --run capability.test.ts design-context.test.ts + npm test
      + npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.4
  - type: references
    target: design-context-L3.4.1
  - type: references
    target: design-context-L3.1.4
  - type: implements
    target: design-context-L2.4
created: '2026-06-26T13:31:10.835Z'
updated: '2026-06-26T13:41:05.383Z'
changeSummary: 'cascade: task-complete'
---
# Design Export CLI and Docs — 实施规格

## 目标

实施 `design-context-L2.4` 的第二段：把 `buildDesignContextExportReport` 和 `buildDesignContextTemplate` 接入本地 CLI/assist 入口，让用户可以通过 spec-manager 命令导出 DESIGN.md tokens 或生成 starter DESIGN.md，并补充 README、readme_zh 与 spec-manager skill 指引。

保持 core export API、`design-lint`、`design-diff` 和既有 assist brief 行为不变。

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.4.2 --include-content`
- `spec-manager spec show design-context-L2.4 --include-content`
- `spec-manager spec show design-context-L3.4.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`。

### Step 2 — CLI 与文档调查

- 读取 `src/cli/capability.ts`，确认 `assist` 子命令扩展方式、JSON/text 输出约定和项目路径获取方式。
- 读取 `src/cli/__tests__/capability.test.ts`，确认 CLI fixture、stdout/stderr 和文件写入测试方式。
- 读取 `src/core/design-context.ts` 中 export/template public API。
- 搜索 README、readme_zh、`.agents/skills/spec-manager/SKILL.md` 中 DESIGN.md 文档落点。

### Step 3 — 新增 assist design-export 命令

- 在 `src/cli/capability.ts` 的 `assist` command 下新增：
  - `design-export`
  - options:
    - `--format <format>`，支持 `tokens-json` / `dtcg-json`，默认 `tokens-json`
    - `--path <path>`，默认 `DESIGN.md`
    - `--out <path>`，可选，项目内输出文件
    - `--json`，可选，输出完整 report JSON
- 未提供 `--out` 时：
  - `--json` 输出 `DesignContextExportReport`
  - 非 `--json` 输出 `report.output` 的 pretty JSON
- 提供 `--out` 时写入 `report.output` pretty JSON，并输出简短成功消息。
- 当 DESIGN.md 缺失或 `source.result.errors > 0` 时命令失败，stderr/message 包含 source errors/warnings。
- step_report outputJson:
  ```json
  {"summary":"新增 assist design-export CLI 命令","files":["src/cli/capability.ts"]}
  ```

### Step 4 — 新增 assist design-template 命令

- 在 `src/cli/capability.ts` 的 `assist` command 下新增：
  - `design-template`
  - options:
    - `--out <path>`，默认 `DESIGN.md`
    - `--force`，可选覆盖已有文件
    - `--json`，可选输出 `{ path, written, content }`
- 默认不覆盖已有文件；目标已存在且未传 `--force` 时命令失败。
- 写入路径必须解析在项目根目录内，复用现有 path helper 或项目路径约束。
- step_report outputJson:
  ```json
  {"summary":"新增 assist design-template CLI 命令","files":["src/cli/capability.ts"]}
  ```

### Step 5 — 增加 CLI 测试

- 在 `src/cli/__tests__/capability.test.ts` 增加：
  - `assist design-export --format tokens-json --json` 输出完整 report。
  - `assist design-export --format dtcg-json` 输出 DTCG token JSON。
  - `assist design-export --out tokens.json` 写入项目内文件。
  - invalid DESIGN.md 导致 design-export 失败。
  - `assist design-template --out DESIGN.md` 写入 starter template。
  - existing DESIGN.md 未传 `--force` 时 design-template 失败，传 `--force` 成功覆盖。
- step_report outputJson:
  ```json
  {"summary":"增加 design-export 和 design-template CLI 测试","files":["src/cli/__tests__/capability.test.ts"]}
  ```

### Step 6 — 更新文档与 skill 指引

- 更新 `README.md`：
  - 补充 `spec-manager assist design-template --out DESIGN.md`
  - 补充 `spec-manager assist design-export --format tokens-json --path DESIGN.md`
  - 补充 `dtcg-json` 是当前 DESIGN.md schema 的 DTCG 子集。
- 更新 `readme_zh.md` 对应中文说明。
- 更新 `.agents/skills/spec-manager/SKILL.md` 和模板 skill：
  - UI/视觉任务可先用 `assist brief` 读取 DESIGN.md。
  - 需要 starter 时用 `assist design-template`。
  - 需要实现工具消费 token 时用 `assist design-export`。
- step_report outputJson:
  ```json
  {"summary":"更新 design export/template 文档和 skill 指引","files":["README.md","readme_zh.md",".agents/skills/spec-manager/SKILL.md",".agents/skills/spec-manager/templates/agents/codebuddy-skill/SKILL.md"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/cli/__tests__/capability.test.ts src/core/__tests__/design-context.test.ts`。
- 运行 `npm test`。
- 运行 `npm run lint`。
- step_report outputJson:
  ```json
  {"summary":"完成 Design Export CLI and Docs 验证","commands":["npm test -- --run src/cli/__tests__/capability.test.ts src/core/__tests__/design-context.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
npm test -- --run src/cli/__tests__/capability.test.ts src/core/__tests__/design-context.test.ts
# 预期输出包含: capability.test.ts 和 design-context.test.ts

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

1. **AC-1**: **Given** 项目根目录存在有效 DESIGN.md，**When** 用户执行 `spec-manager assist design-export --format tokens-json --json`，**Then** CLI **SHALL** 输出 `design-context-export.v1` report，并包含稳定 token JSON。
2. **AC-2**: **Given** 项目根目录存在有效 DESIGN.md，**When** 用户执行 `spec-manager assist design-export --format dtcg-json --out tokens.dtcg.json`，**Then** CLI **SHALL** 在项目内写入 DTCG 子集 JSON。
3. **AC-3**: **Given** 目标项目没有 DESIGN.md，**When** 用户执行 `spec-manager assist design-template --out DESIGN.md`，**Then** CLI **SHALL** 写入可通过 `buildDesignContextReport` lint 的 starter DESIGN.md，且默认不覆盖已有文件。
4. **AC-4**: **Given** 用户查阅 README/readme_zh/skill，**When** 搜索 DESIGN.md export 或 template，**Then** 文档 **SHALL** 说明 design-template、design-export、format 边界和不依赖外部 design CLI。

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
  "coveredSpecs": ["design-context-L3.4.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec show L3.4.2 + L2.4 + L3.4.1 + task list + templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "CLI 与文档调查: 读取 capability.ts + capability.test.ts + design-context.ts + README/readme_zh/skill"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/cli/capability.ts 新增 assist design-export 命令"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/capability.ts 新增 assist design-template 命令"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/capability.test.ts 增加 design export/template CLI 测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "更新 README/readme_zh/skill design export/template 文档"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: npm test -- --run capability.test.ts design-context.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 只新增本地 assist 子命令、CLI 测试和文档，复用已实现 core API，不改变既有 assist brief、design-lint 或 design-diff contract。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| CLI 命令命名不合适 | revert `assist design-export/design-template` 分支和文档，core API 保留 | < 10 min |
| 文件写入安全边界有问题 | 修正 path resolution 和 overwrite gate，测试覆盖不变 | < 10 min |
| 文档表达过度承诺 DTCG | 调整 README/readme_zh/skill，明确第一版是 DTCG 子集 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| assist command 过多 | 本 L3 只新增两个窄命令；后续可收敛为 design 子命令组 |
| stdout/report contract 混淆 | `--json` 输出完整 report；默认输出 export output，文档明确 |
| out 文件覆盖用户数据 | 默认拒绝覆盖，必须显式 `--force` |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.4 | 引用父 L2 |
| references | design-context-L3.4.1 | 复用 export core API |
| references | design-context-L3.1.4 | 延续 DESIGN.md 文档入口 |
| implements | design-context-L2.4 | 实现 export CLI/docs slice |
