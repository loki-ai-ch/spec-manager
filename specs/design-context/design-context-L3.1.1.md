---
code: design-context-L3.1.1
level: L3
title: DESIGN.md Core Parser and Lint
topic: design-context
parentCode: design-context-L2.1
status: implemented
aiSummary: >-
  实施规格：新增 design-context core parser/lint/summary，默认读取 DESIGN.md，输出结构化 findings
  与摘要，并导出公共 API 和 core 单元测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: spec-manager spec show design-context-L3.1.1 + design-context-L2.1
      + task list + 读 templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      文件级分析: 读取 src/core/paths.ts + src/core/__tests__/project-fixture.ts +
      src/index.ts 并搜索 report 命名
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 新增 src/core/design-context.ts 报告类型和文件发现入口
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 实现 src/core/design-context.ts Markdown 与 YAML frontmatter 解析
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 实现 src/core/design-context.ts lint findings 与摘要投影
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 导出 src/index.ts design-context core API
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 新增 src/core/__tests__/design-context.test.ts core 单元测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: >-
      验证: npm test -- --run src/core/__tests__/design-context.test.ts + npm test
      + npm run lint
    status: pending
relations:
  - type: based_on
    target: design-context-L2.1
  - type: implements
    target: design-context-L2.1
created: '2026-06-26T02:36:40.152Z'
updated: '2026-06-26T02:47:53.950Z'
changeSummary: 'cascade: task-complete'
---
# DESIGN.md Core Parser and Lint — 实施规格

## 目标

实施 `design-context-L2.1` 的 L3.1.1：新增 spec-manager 原生 `design-context` core 模块，支持发现项目根目录 `DESIGN.md`、解析 frontmatter 与 H2 sections、输出设计上下文摘要和 lint findings，并导出公共 API。

**前置依赖**: `design-context-L2.1` 已 confirmed。

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- `spec-manager spec show design-context-L3.1.1 --include-content` + `spec-manager spec show design-context-L2.1 --include-content`
- `spec-manager task list --topic design-context`
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/paths.ts`，确认 `ProjectPaths.root` 可作为默认 `DESIGN.md` 搜索根。
  - 读取 `src/core/__tests__/project-fixture.ts`，确认测试项目可写 root fixture 文件。
  - 读取 `src/index.ts`，确认新增 core API 应从公共入口导出。
  - 参考 `/Users/loki/code/github/design.md/packages/cli/src/linter/lint.ts` 的输入/输出形状，但 SHALL 重写实现，不直接复制外部 CLI。

### Step 2 — 文件级分析与实现边界确认

- 读取 `src/core/paths.ts` 中的 `resolveWithin`、`ProjectPaths`、`getPaths`，确认路径解析策略。
- 读取 `src/core/__tests__/project-fixture.ts`，确认测试 fixture 创建和清理方式。
- 读取 `src/index.ts`，确认公共 API 导出位置。
- 搜索 `rg -n "summary:|findings:|schemaVersion" src/core src/cli`，对齐既有报告命名习惯。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 design-context core 文件级分析和实现边界确认","files":["src/core/paths.ts","src/core/__tests__/project-fixture.ts","src/index.ts"]}
  ```

### Step 3 — 新增 core 类型与报告构建

- 在 `src/core/design-context.ts` 新增以下导出类型：
  - `DesignFindingSeverity`
  - `DesignContextFinding`
  - `DesignContextSummary`
  - `DesignContextReport`
  - `BuildDesignContextInput`
- 新增 `buildDesignContextReport(input: BuildDesignContextInput): DesignContextReport`：
  - SHALL 默认读取 `join(input.paths.root, 'DESIGN.md')`。
  - SHALL 支持 `input.filePath` 覆盖默认路径，但解析相对路径时必须限制在项目根目录内。
  - SHALL 在文件不存在时返回 `exists: false`、`summary: null`、一条 warning finding，不抛异常。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 design-context core 报告类型和文件发现入口","files":["src/core/design-context.ts"]}
  ```

### Step 4 — 实现 Markdown 与 YAML frontmatter 解析

- 在 `src/core/design-context.ts` 内实现纯函数解析逻辑：
  - `extractFrontmatter(content: string)`：识别文件开头 `---` frontmatter。
  - `parseDesignYaml(yamlText: string)`：使用现有 `yaml` 依赖解析 frontmatter。
  - `extractH2Sections(content: string)`：收集 H2 heading 与段落正文。
- SHALL 支持 token groups：`colors`、`typography`、`spacing`、`rounded`、`components`。
- SHALL 不引入 `unified`、`remark-*`、`citty`、Bun runtime 等新增依赖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 DESIGN.md frontmatter 和 H2 section 解析","files":["src/core/design-context.ts"]}
  ```

### Step 5 — 实现 lint findings 与摘要投影

- 在 `src/core/design-context.ts` 中实现 lint 规则：
  - missing YAML/frontmatter: warning。
  - YAML parse failure: error。
  - missing `name`: warning。
  - broken token reference `{group.token}`: error。
  - duplicate H2 section heading: error。
  - section order mismatch for known sections: warning。
- 实现 `DesignContextSummary`：
  - `name` / `description`
  - `sections`
  - `tokenCounts`
  - `proseSummary`: 最多 5 条来自 Overview/Colors/Typography/Layout/Components/Do's and Don'ts 的简短摘要。
  - `tokenSummary`: 最多 8 条关键 token 摘要。
- summary `result.errors/warnings/infos` SHALL 与 findings 数量一致。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 DESIGN.md lint 规则和摘要投影","files":["src/core/design-context.ts"]}
  ```

### Step 6 — 导出公共 API

- 在 `src/index.ts` 增加：
  ```ts
  export * from './core/design-context.js';
  ```
- 完成后 step_report outputJson:
  ```json
  {"summary":"从公共入口导出 design-context core API","files":["src/index.ts"]}
  ```

### Step 7 — 增加 core 单元测试

- 新增 `src/core/__tests__/design-context.test.ts`。
- SHALL 覆盖：
  - valid DESIGN.md 返回 `exists: true`、summary name、tokenCounts、sections。
  - missing file 返回 `exists: false` 和 warning。
  - missing YAML 返回 warning 且仍提取 sections。
  - broken token reference 返回 error。
  - duplicate section heading 返回 error。
  - section order mismatch 返回 warning。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 design-context core 单元测试覆盖正反向场景","files":["src/core/__tests__/design-context.test.ts"]}
  ```

### Step 8 — 验证

- 运行验证命令中的 core 定向测试、全量测试和类型检查。
- 预期定向测试通过，`npm test` 通过，`npm run lint` 通过。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 design-context core 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts","npm test","npm run lint"]}
  ```

## 验证命令

```bash
# 正向验证: design-context core fixture 测试通过
npm test -- --run src/core/__tests__/design-context.test.ts
# 预期输出包含: src/core/__tests__/design-context.test.ts
# 预期输出包含: Test Files  1 passed

# 回归验证: 全量测试通过
npm test
# 预期输出包含: Test Files
# 预期输出不包含: failed

# 类型验证: TypeScript 编译检查通过
npm run lint
# 预期输出不包含: error TS
```

## 关键验收标准

- AC-1
- AC-2
- AC-3

## 验收标准

1. **AC-1**: **Given** 项目根目录存在有效 DESIGN.md，**When** 调用 `buildDesignContextReport({ paths })`，**Then** 报告 **SHALL** 返回 `exists: true`、设计名称、section 列表、token counts 和空 error summary。
2. **AC-2**: **Given** DESIGN.md 缺失、缺少 YAML、YAML 解析失败、broken token reference 或重复 H2 heading，**When** 调用 `buildDesignContextReport`，**Then** 报告 **SHALL** 返回结构化 findings 且 `result` 计数正确。
3. **AC-3**: **Given** 下游 L3 需要复用设计上下文能力，**When** 从包公共入口导入，**Then** `buildDesignContextReport` 与相关类型 **SHALL** 可从 `src/index.ts` 导出。

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
  "coveredSpecs": ["design-context-L3.1.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: spec-manager spec show design-context-L3.1.1 + design-context-L2.1 + task list + 读 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "文件级分析: 读取 src/core/paths.ts + src/core/__tests__/project-fixture.ts + src/index.ts 并搜索 report 命名"},
    {"stepNo": 3, "stepType": "tool_action", "name": "新增 src/core/design-context.ts 报告类型和文件发现入口"},
    {"stepNo": 4, "stepType": "tool_action", "name": "实现 src/core/design-context.ts Markdown 与 YAML frontmatter 解析"},
    {"stepNo": 5, "stepType": "tool_action", "name": "实现 src/core/design-context.ts lint findings 与摘要投影"},
    {"stepNo": 6, "stepType": "tool_action", "name": "导出 src/index.ts design-context core API"},
    {"stepNo": 7, "stepType": "tool_action", "name": "新增 src/core/__tests__/design-context.test.ts core 单元测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证: npm test -- --run src/core/__tests__/design-context.test.ts + npm test + npm run lint"}
  ]
}
```

autoConfirm: true。理由：该 L3 修改范围为本地 core 模块、公共导出和单元测试，不涉及外部服务、数据迁移、发布或破坏性操作；执行前仍需用户批准 L3 进入 frozen。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| core 实现导致测试失败 | revert 本 L3 对 `src/core/design-context.ts`、`src/core/__tests__/design-context.test.ts`、`src/index.ts` 的修改 | < 5 min |
| API 命名不合适 | 在同一 L3 task 内调整导出名称并更新测试；若已提交则 git revert 后重做 | < 10 min |
| lint 规则误报过多 | 将争议规则降级为 warning 或移出本 L3，保留 parser 与 summary 基础能力 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| YAML 值类型复杂导致解析分支过多 | 只对 L2 声明的 token groups 做浅层计数和引用检查，未知结构保留但不深度解释 |
| section 摘要过长影响 brief 后续展示 | core 层先限制 proseSummary/tokenSummary 数量，brief L3 再控制 presenter 输出 |
| 路径覆盖可能越界 | 使用 `resolveWithin(paths.root, filePath)` 处理相对路径，拒绝绝对路径或项目外路径 |
| 外部 design.md 语法覆盖不完整 | 本 L3 明确是最小原生子集；完整 CSS Color 4 和 export/diff 延后 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.1 | 必填：引用父 L2 |
| implements | design-context-L2.1 | 实现 L2 的 core parser/lint/summary slice |
