---
code: adaptive-workflow-adoption-L3.1.1-preview
level: L3
title: Adaptive Workflow Adoption Preview
topic: adaptive-workflow-adoption
parentCode: adaptive-workflow-adoption-L2.1
status: implemented
aiSummary: >-
  实现 adaptive workflow adoption preview：只读汇总 workflow 状态、profile metrics、active
  L3 governed readiness、推荐默认 Profile 和历史不改写策略，并增强 workflow enable/disable 反馈与
  Agent 文档提示。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取本 L3、adaptive-workflow-adoption-L2.1 与 workflow/profile metrics/spec
      sections/project CLI 基线
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 adoption preview core API 与公开导出
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: >-
      实现 governed readiness、history policy、default profile recommendation 与 core
      测试
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 新增 project workflow preview CLI 并增强 enable/disable 输出
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 同步方法论、skill 与 Agent managed assets
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证聚焦、全量、构建、安装版 CLI 和 spec-manager 自检
    status: pending
created: '2026-06-16T07:12:33.720Z'
updated: '2026-06-16T07:24:04.820Z'
changeSummary: 'cascade: task-complete'
---
# Adaptive Workflow Adoption Preview

## 背景

parent: `adaptive-workflow-adoption-L2.1`

本项目当前 `project profile metrics` 显示所有历史 Task 均为 legacy，因此 preview 必须清楚说明历史数据不会被改写，也不构成新治理违规。

## 目标

### 做

- 新增 `buildAdaptiveWorkflowAdoptionPreview()` core API 和公开导出。
- 新增 `spec-manager project workflow preview [--json]`。
- 复用 `buildProfileMetrics()` 汇总 Task Profile 状态。
- 使用 `validateCriticalAcceptanceCriteria()` 汇总 active L3 的关键 AC readiness。
- 按 readiness 确定推荐 defaultProfile：缺口时 standard，全部具备时 governed。
- 增强 `project workflow enable/disable` 输出，明确只影响后续 Task、历史 snapshot 不改写，并提示 metrics 审计。
- 同步方法论、skill、Agent managed assets 和契约测试。

### 不做

- 不自动启用 adaptive workflow。
- 不自动修改历史 Task profile。
- 不把 preview warning 变成 hard gate。
- 不批量补写 L3 关键 AC。
- 不新增 CI 强制检查。

## 实施步骤

1. 读取本 L3、`adaptive-workflow-adoption-L2.1`、workflow/profile metrics/spec sections/project CLI 基线，确认复用点和输出位置。
2. 新增 adoption preview core API、类型和 public export。
3. 实现 active L3 governed readiness、legacy history policy、推荐默认 Profile 和 core 测试。
4. 新增 `project workflow preview` CLI text/json 输出，并增强 enable/disable 输出与 CLI 测试。
5. 同步方法论、skill、Agent managed assets 与契约测试。
6. 运行聚焦测试、全量测试、lint、build、installed CLI smoke、project doctor、spec validate 和 plan validate，并记录 verification evidence。

## 受影响文件

| 路径 | 变更 |
|---|---|
| `src/core/adaptive-workflow-adoption.ts` | 新增 preview core API 和类型 |
| `src/index.ts` | 导出 adoption preview API |
| `src/cli/project.ts` | 新增 workflow preview，增强 enable/disable 输出 |
| `src/core/__tests__/adaptive-workflow-adoption.test.ts` | 新增 core readiness/recommendation 测试 |
| `src/cli/__tests__/project-workflow.test.ts` | 扩展 workflow CLI 测试 |
| `src/core/__tests__/methodology-contract.test.ts` | 增加 adoption preview 文档契约 |
| `docs/methodology.md` | 说明启用前 preview 和历史不改写 |
| `skill/SKILL.md` 与 `templates/agents/*` | 加入启用前 preview 提示 |
| `.claude/skills/spec-manager/*`、`.codebuddy/skills/spec-manager/*` | managed sync 更新 |

## 数据契约

```typescript
interface AdaptiveWorkflowAdoptionPreview {
  schemaVersion: 'adaptive-workflow-adoption-preview.experimental.v1';
  generatedAt: string;
  adaptiveWorkflow: {
    enabled: boolean;
    defaultProfile: 'standard' | 'governed';
    note: string;
  };
  taskProfileMetrics: {
    totalTasks: number;
    legacyTasks: number;
    standardTasks: number;
    governedTasks: number;
  };
  governedReadiness: {
    activeL3Specs: number;
    withCriticalAcceptanceCriteria: number;
    withoutCriticalAcceptanceCriteria: number;
    examplesWithoutCriticalAcceptanceCriteria: string[];
    readyForGovernedDefault: boolean;
  };
  recommendation: {
    recommendedDefaultProfile: 'standard' | 'governed';
    reasons: string[];
    warnings: string[];
    nextSteps: string[];
  };
  historyPolicy: {
    mutatesHistoricalTasks: false;
    note: string;
  };
}
```

## 接口契约

### Core API

```typescript
buildAdaptiveWorkflowAdoptionPreview(paths: ProjectPaths, opts?: {
  now?: Date;
}): AdaptiveWorkflowAdoptionPreview
```

### CLI

```text
spec-manager project workflow preview [--json]
```

Text 输出必须包含：

- schemaVersion/generatedAt。
- Adaptive Workflow enabled/defaultProfile/note。
- Task Profile metrics total/legacy/standard/governed。
- governed readiness active L3/with critical AC/without critical AC/examples。
- recommended default profile。
- warnings、next steps。
- 历史 Task 不被修改的说明。

JSON 输出必须是 `AdaptiveWorkflowAdoptionPreview`。

### enable/disable 输出

`project workflow enable` 成功后必须提示：

- Future tasks will record standard/governed profile snapshots.
- Historical tasks are not modified.
- Audit adoption with `spec-manager project profile metrics`.

`project workflow disable` 成功后必须提示：

- Only future task profile resolution changes.
- Existing task profile snapshots remain unchanged.

## 验收标准

1. **AC-1**: Given adaptive workflow disabled, When 运行 preview, Then 输出 disabled 状态、legacy Task 数量和历史 Task 不改写说明。
2. **AC-2**: Given 项目存在 L3 specs, When 运行 preview, Then 汇总 active L3、with critical AC、without critical AC 和缺口示例。
3. **AC-3**: Given `--json`, When 运行 preview, Then 输出 `adaptive-workflow-adoption-preview.experimental.v1`。
4. **AC-4**: Given 存在 governed readiness 缺口, When 运行 preview, Then 推荐 defaultProfile 为 `standard` 并输出 warning。
5. **AC-5**: Given 所有 active L3 均具备关键 AC, When 运行 preview, Then 推荐 defaultProfile 为 `governed` 或说明可升级 governed。
6. **AC-6**: Given 用户启用 adaptive workflow, When enable 完成, Then 输出 future Task profile snapshot 和 profile metrics 审计提示。
7. **AC-7**: Given 用户禁用 adaptive workflow, When disable 完成, Then 输出只影响后续 Task、历史 snapshots 保持不变。
8. **AC-8**: Given 方法论和 Agent 入口同步, When 运行契约测试和 project doctor, Then preview 提示在文档和 managed assets 中一致。

## 验证命令

- `npx vitest run src/core/__tests__/adaptive-workflow-adoption.test.ts --reporter=dot`
- `npx vitest run src/cli/__tests__/project-workflow.test.ts --reporter=dot`
- `npx vitest run src/core/__tests__/methodology-contract.test.ts --reporter=dot`
- `npm test -- --reporter=dot`
- `npm run lint`
- `npm run build`
- `npm run verify:installed-cli`
- `spec-manager project doctor`
- `spec-manager spec validate adaptive-workflow-adoption-L3.1.1-preview`
- `spec-manager spec validate-plan --from-spec adaptive-workflow-adoption-L3.1.1-preview`

## planJson (final)

```json
{
  "schemaVersion": "spec-manager.plan.v1",
  "spec": "adaptive-workflow-adoption-L3.1.1-preview",
  "coveredSpecs": ["adaptive-workflow-adoption-L3.1.1-preview"],
  "profile": "standard",
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取本 L3、adaptive-workflow-adoption-L2.1 与 workflow/profile metrics/spec sections/project CLI 基线"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 adoption preview core API 与公开导出"},
    {"stepNo": 3, "stepType": "tool_action", "name": "实现 governed readiness、history policy、default profile recommendation 与 core 测试"},
    {"stepNo": 4, "stepType": "tool_action", "name": "新增 project workflow preview CLI 并增强 enable/disable 输出"},
    {"stepNo": 5, "stepType": "tool_action", "name": "同步方法论、skill 与 Agent managed assets"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证聚焦、全量、构建、安装版 CLI 和 spec-manager 自检"}
  ]
}
```

## 回滚方案

若 preview 逻辑或输出造成回归，回退 `src/core/adaptive-workflow-adoption.ts`、`src/cli/project.ts` 中 preview/提示相关改动、相关测试和文档同步；已有 workflow enable/disable 配置读写语义保持不变。
