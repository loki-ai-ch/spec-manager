---
code: adaptive-workflow-adoption-L2.1
level: L2
title: Adaptive Workflow 采用预检技术设计
topic: adaptive-workflow-adoption
parentCode: adaptive-workflow-adoption-L1
status: implemented
aiSummary: >-
  设计 adaptive workflow adoption preview：复用 profile metrics 和关键 AC 解析，输出 workflow
  状态、legacy 历史解释、governed readiness、推荐默认 Profile、next steps，并增强 workflow
  enable/disable 反馈。
created: '2026-06-16T07:10:38.784Z'
updated: '2026-06-16T07:24:04.825Z'
changeSummary: 'cascade: task-complete'
---
# Adaptive Workflow 采用预检技术设计

## 方案概述

本设计为 `adaptive-workflow-adoption-L1` 提供一条本地、只读、可审计的 adaptive workflow 采用路径：

```text
[Project Config] + [Profile Metrics] + [Active L3 Specs]
        │
        ▼
[Adoption Preview Projection]
        │
        ├─ current workflow status
        ├─ legacy task explanation
        ├─ governed readiness summary
        ├─ recommended default profile
        └─ next steps / warnings
        │
        ▼
[CLI: project workflow preview --json/text]

[CLI: project workflow enable/disable]
        │
        └─ clearer post-action guidance; no historical task mutation
```

Preview 不写配置，不迁移历史 Task，不阻断 `project workflow enable`。它复用 `buildProfileMetrics()` 和关键 AC 解析，只负责把“是否适合启用、默认 Profile 如何选、历史 legacy 如何解释”投影成决策辅助报告。

## 技术决策

| 问题 | 候选选项 | 选定方案 | 理由 |
|---|---|---|---|
| 命令位置 | A: `project workflow preview` B: `project profile adoption` C: `doctor` | A | adoption 属于 workflow 配置启用前决策，和 enable/disable 放在同组最直观 |
| 数据来源 | A: 直接扫文件 B: 复用 profile metrics + specs C: audit | B | metrics 已稳定聚合 Task/Profile；specs 用于 readiness |
| readiness 判断 | A: evidence 全覆盖 B: L3 关键 AC 声明覆盖 C: AI 评估 | B | 启用前主要判断 governed 创建/完成条件是否具备，不声称业务正确 |
| 默认 Profile 建议 | A: 永远 standard B: 全部 L3 有关键 AC 时 governed C: 根据 task 历史训练 | B | 保守且确定性；有缺口时 standard，准备齐全时提示可升级 governed |
| preview warning | A: hard gate B: warning-only C: 自动修复 | B | 采用必须显式；preview 不应阻断或修改 |
| enable 输出 | A: 保持原样 B: 增加下一步提示 C: 强制先 preview | B | 降低摩擦，不把 preview 变成隐藏门禁 |
| JSON schema | A: 无版本 B: experimental.v1 C: stable v1 | B | 首版允许追加字段，核心字段不改义 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| Adoption preview core | 新增 | `buildAdaptiveWorkflowAdoptionPreview()`、类型、readiness 聚合 | fixture 测试 disabled/enabled、关键 AC 覆盖、推荐默认 Profile |
| Project CLI | 修改 | `project workflow preview [--json]`；增强 enable/disable 输出 | CLI text/json 与 no-write 测试 |
| Profile metrics | 复用 | 读取 legacy/standard/governed task counts | core 测试中断言继承 metrics 数据 |
| Spec sections | 复用 | `validateCriticalAcceptanceCriteria()` | L3 有/无关键 AC fixture |
| 方法论/Agent 资产 | 修改 | 启用前 preview 提示 | methodology contract + managed asset doctor |
| Public API | 修改 | 导出 preview 类型/函数 | public API smoke |

## 数据模型

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

### Core API

```typescript
buildAdaptiveWorkflowAdoptionPreview(paths: ProjectPaths, opts?: {
  now?: Date;
}): AdaptiveWorkflowAdoptionPreview
```

`now` 只用于测试固定时间，CLI 不暴露。

## 规则

### L3 readiness

- 只统计 active specs，即非 archived L3。
- 对每个 L3 使用 `validateCriticalAcceptanceCriteria(spec.content)`。
- `criticalCriteria.length > 0` 计为具备关键 AC 声明。
- `unknown.length > 0` 计为缺口，原因归入 warnings，并将 spec code 纳入示例。
- 示例数量限制为 10，避免大型项目输出过长。

### 默认 Profile 推荐

| 条件 | 推荐 |
|---|---|
| `governedReadiness.readyForGovernedDefault === true` 且 active L3 数量 > 0 | `governed` |
| 其他情况 | `standard` |

即使推荐 governed，也只表示“可以考虑把项目 defaultProfile 设置为 governed”；用户仍需显式 `project workflow enable --default-profile governed`。

### 历史 Task 解释

- preview 必须明确历史 Task 不会被改写。
- legacy task 数量来自 `buildProfileMetrics()`。
- legacy 数量不进入 readiness 失败，也不作为违规。

## 接口契约

### CLI: workflow preview

```text
spec-manager project workflow preview [--json]
```

Text 输出必须包含：

- 当前 adaptive workflow enabled/defaultProfile。
- Task Profile metrics：total/legacy/standard/governed。
- governed readiness：active L3、with critical AC、without critical AC、示例。
- recommended default profile。
- warnings 和 next steps。
- 历史 Task 不被修改的说明。

JSON 输出必须为 `AdaptiveWorkflowAdoptionPreview`。

### CLI: workflow enable 输出增强

启用成功后追加：

- “Future tasks will record standard/governed profile snapshots.”
- “Historical tasks are not modified.”
- “Audit adoption with `spec-manager project profile metrics`.”

### CLI: workflow disable 输出增强

禁用成功后追加：

- “Only future task profile resolution changes.”
- “Existing task profile snapshots remain unchanged.”

## 容错与降级

| 场景 | 行为 |
|---|---|
| 没有 L3 spec | 推荐 standard，warning 说明没有 governed readiness 样本 |
| L3 关键 AC 引用未知 AC | 计为 readiness 缺口，warning 标明 spec code |
| metrics 读取成功但全部 legacy | 输出 legacy 历史解释，不认为失败 |
| adaptive workflow 已启用 | preview 仍可运行，用于检查当前采用状态 |

## 向后兼容

- 新增命令只读，默认 exit code 0。
- enable/disable 只增加文本行，不改变 JSON 契约，因为这两个命令当前没有 JSON 输出。
- 不修改历史 Task JSON。
- 不修改 `task create`、`task complete`、`task evidence` 语义。

## 关键流程

### Preview

```text
project workflow preview
  ├─ readAdaptiveWorkflowConfig
  ├─ buildProfileMetrics
  ├─ listAllSpecs(L3)
  ├─ validateCriticalAcceptanceCriteria per L3
  ├─ derive readiness and recommendation
  └─ print text/json
```

### Enable Guidance

```text
project workflow enable
  ├─ existing config validation/write
  └─ print snapshot/history/metrics guidance
```

## 可观测性

- preview 显示 generatedAt 和 schemaVersion。
- readiness 显示缺口示例，不静默吞掉未知关键 AC。
- nextSteps 给出具体命令：`project workflow enable --default-profile ...`、`project profile metrics`。

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| adaptive-workflow-adoption-L3.1.1-preview | Adoption preview core/API/CLI、enable/disable 输出增强、方法论和 Agent 入口同步 | 本 L2 confirmed |

## 关联

- parent: `adaptive-workflow-adoption-L1`
- based_on: `adaptive-evidence-workflow-L3.1.1-profile`
- based_on: `adaptive-profile-intelligence-L3.1.2-metrics`
- code_ref: `src/core/workflow-profile.ts`
- code_ref: `src/core/profile-metrics.ts`
- code_ref: `src/core/spec-sections.ts`
- code_ref: `src/cli/project.ts`
