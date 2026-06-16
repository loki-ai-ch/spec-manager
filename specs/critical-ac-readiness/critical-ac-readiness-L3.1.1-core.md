---
code: critical-ac-readiness-L3.1.1-core
level: L3
title: Critical AC Readiness Core
topic: critical-ac-readiness
parentCode: critical-ac-readiness-L2.1
status: implemented
aiSummary: >-
  实现 critical AC readiness core/API：扫描 active L3，按 missing/empty/unknown/ready
  分类关键 AC 状态，生成 totals、readiness ratio、governed upgrade 建议和稳定 JSON schema。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取本 L3、critical-ac-readiness-L2.1、spec section/parser、adoption preview 和
      profile metrics 基线
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 critical readiness core 类型和 buildCriticalReadinessReport API
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 实现 active L3 扫描、topic 过滤和 missing/empty/unknown/ready 分类
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 实现 summary、recommendations、governed upgrade 和 public export
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 补充 core 单元测试与 schema 断言
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 运行 vitest、build、spec validate 和 plan validate
    status: pending
created: '2026-06-16T08:13:20.642Z'
updated: '2026-06-16T08:25:58.906Z'
changeSummary: 'cascade: task-complete'
---
# Critical AC Readiness Core

## 背景

parent: `critical-ac-readiness-L2.1`

`project workflow preview` 已能给出 governed readiness 的概要和前 10 个缺口示例，但缺少完整清单、细分原因和可复用 core projection。本 L3 先交付只读 core/API，为后续 CLI 和文档同步提供稳定数据契约。

## 目标

### 做

- 新增 `buildCriticalReadinessReport()` core API。
- 扫描 active L3 specs，支持可选 topic 过滤。
- 对每个 L3 分类为 `missing`、`empty`、`unknown` 或 `ready`。
- 输出 totals、readiness ratio、summary、recommendations 和 governed upgrade 判断。
- 导出 public API 类型和函数。
- 增加 core 单元测试，覆盖主要分类和 JSON schema 核心字段。

### 不做

- 不新增 CLI 命令；CLI 留给 `critical-ac-readiness-L3.1.2-cli`。
- 不修改历史 spec。
- 不自动生成或插入关键 AC。
- 不改变 `task create`、`task complete`、`project workflow preview`、`project profile metrics` 的既有行为。
- 不同步方法论、skill 或 Agent 入口。

## 实施步骤

1. 读取本 L3、`critical-ac-readiness-L2.1`、`src/core/spec-sections.ts`、`src/core/adaptive-workflow-adoption.ts`、`src/core/profile-metrics.ts` 和 public export 基线。
2. 新增 `src/core/critical-readiness.ts`，定义 `CriticalReadinessStatus`、`CriticalReadinessItem`、`CriticalReadinessReport` 和 `buildCriticalReadinessReport()`。
3. 实现 active L3 扫描、topic 过滤、关键 AC 段检测和 missing/empty/unknown/ready 分类。
4. 实现 totals、readiness ratio、summary、recommendations、governed upgrade 计算，并在 `src/index.ts` 导出。
5. 增加 `src/core/__tests__/critical-readiness.test.ts`，覆盖有/无 active L3、topic 过滤、missing、empty、unknown、ready、ratio 和 schemaVersion。
6. 运行聚焦测试、build、`spec-manager spec validate` 和 `spec-manager spec validate-plan`。

## 受影响文件

| 路径 | 变更 |
|---|---|
| `src/core/critical-readiness.ts` | 新增 readiness projection core API 和类型 |
| `src/index.ts` | 导出 critical readiness API |
| `src/core/__tests__/critical-readiness.test.ts` | 新增 core 测试 |

## 数据契约

```typescript
type CriticalReadinessStatus = 'missing' | 'empty' | 'unknown' | 'ready';

interface CriticalReadinessItem {
  specCode: string;
  topic: string;
  status: CriticalReadinessStatus;
  missingSection: boolean;
  emptySection: boolean;
  unknownCriticalIds: string[];
  criticalCount: number;
  reason: string;
  suggestion: string;
}

interface CriticalReadinessReport {
  schemaVersion: 'critical-readiness.experimental.v1';
  generatedAt: string;
  topic?: string;
  totals: {
    activeL3: number;
    ready: number;
    missing: number;
    empty: number;
    unknown: number;
  };
  readinessRatio: number;
  items: CriticalReadinessItem[];
  summary: string;
  recommendations: string[];
  governedUpgrade: {
    readyForGovernedDefault: boolean;
    note: string;
  };
}
```

## 接口契约

```typescript
buildCriticalReadinessReport(paths: ProjectPaths, opts?: {
  topic?: string;
  now?: Date;
}): CriticalReadinessReport
```

`now` 仅用于测试固定 `generatedAt`，不由后续 CLI 暴露。

## 分类规则

| 状态 | 判定 | reason |
|---|---|---|
| `missing` | L3 不存在 `## 关键验收标准` 段 | `missing critical acceptance criteria section` |
| `empty` | 段存在，但没有任何可解析关键 AC 引用 | `critical acceptance criteria section is empty` |
| `unknown` | 至少一个关键 AC 引用不存在于同一 L3 的 `## 验收标准` | `critical acceptance criteria reference unknown AC ids` |
| `ready` | 至少一条关键 AC 引用有效，且没有 unknown | `critical acceptance criteria are ready` |

若一个 L3 同时 empty 且 unknown 不应发生；实现以 `unknown` 优先于 `empty`，以便暴露可修复的 ID 错误。

## 验收标准

1. **AC-1**: Given 项目存在 active L3, When 调用 `buildCriticalReadinessReport()`, Then report SHALL 为每个 active L3 输出一条 `items` 记录。
2. **AC-2**: Given L3 缺少 `## 关键验收标准`, When 生成 report, Then item SHALL 标记为 `missing` 且 `missingSection=true`。
3. **AC-3**: Given L3 存在空 `## 关键验收标准`, When 生成 report, Then item SHALL 标记为 `empty` 且 `emptySection=true`。
4. **AC-4**: Given L3 的关键 AC 引用不存在的 AC ID, When 生成 report, Then item SHALL 标记为 `unknown` 并列出 `unknownCriticalIds`。
5. **AC-5**: Given L3 有至少一条有效关键 AC 且无 unknown, When 生成 report, Then item SHALL 标记为 `ready` 并设置 `criticalCount`。
6. **AC-6**: Given opts.topic, When 生成 report, Then report SHALL 只统计该 topic 的 active L3。
7. **AC-7**: Given 所有 active L3 均 ready, When 生成 report, Then `governedUpgrade.readyForGovernedDefault` SHALL 为 `true`。
8. **AC-8**: Given report 生成成功, When 检查数据契约, Then schemaVersion SHALL 为 `critical-readiness.experimental.v1`，且 totals 与 readinessRatio SHALL 可由 items 确定性复算。

## 关键验收标准

- AC-1
- AC-2
- AC-4
- AC-7
- AC-8

## 验证命令

- `npx vitest run src/core/__tests__/critical-readiness.test.ts --reporter=dot`
- `npm run build`
- `spec-manager spec validate critical-ac-readiness-L3.1.1-core`
- `spec-manager spec validate-plan --from-spec critical-ac-readiness-L3.1.1-core`

## planJson (final)

```json
{
  "schemaVersion": "spec-manager.plan.v1",
  "spec": "critical-ac-readiness-L3.1.1-core",
  "coveredSpecs": ["critical-ac-readiness-L3.1.1-core"],
  "profile": "standard",
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取本 L3、critical-ac-readiness-L2.1、spec section/parser、adoption preview 和 profile metrics 基线"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 critical readiness core 类型和 buildCriticalReadinessReport API"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "实现 active L3 扫描、topic 过滤和 missing/empty/unknown/ready 分类"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "实现 summary、recommendations、governed upgrade 和 public export"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "补充 core 单元测试与 schema 断言"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "运行聚焦测试、build、spec validate 和 plan validate"}
  ]
}
```

## 回滚方案

若 core projection 引发构建或测试回归，回退 `src/core/critical-readiness.ts`、`src/core/__tests__/critical-readiness.test.ts` 和 `src/index.ts` 的导出变更；其他 workflow/profile/task 行为不应受影响。
