---
code: critical-ac-readiness-L2.1
level: L2
title: 关键 AC Readiness 报告与修复建议设计
topic: critical-ac-readiness
parentCode: critical-ac-readiness-L1
status: implemented
aiSummary: >-
  设计只读 critical AC readiness 报告：扫描 active L3，分类 missing/empty/unknown/ready，支持
  topic/json，输出修复建议和 governed 升级判断，并明确不自动伪造关键 AC。
created: '2026-06-16T08:09:52.046Z'
updated: '2026-06-16T08:25:58.913Z'
changeSummary: 'cascade: task-complete'
---
# 关键 AC Readiness 报告与修复建议设计

## 方案概述

本设计为 `critical-ac-readiness-L1` 提供一条只读、可审计、可过滤的 readiness 报告路径。

核心思路是复用现有 spec 读取与关键 AC 解析能力，对 active L3 做统一投影：

```text
[ProjectSnapshot / Active L3 Specs]
        │
        ▼
[Critical AC Readiness Projection]
        │
        ├─ missing critical section
        ├─ empty critical section
        ├─ unknown critical AC ids
        └─ ready
        │
        ▼
[CLI: project readiness critical --topic <topic> --json]

[Readiness Summary + Repair Suggestions]
        │
        └─ governed upgrade guidance / next steps
```

该报告只揭示缺口和建议，不自动补写历史 L3，不自动生成关键 AC 文本，不把 readiness warning 变成硬门禁。

## 技术决策

| 问题 | 候选选项 | 选定方案 | 理由 |
|---|---|---|---|
| 命令位置 | A: `project readiness critical` B: `project profile readiness` C: `doctor` | A | readiness 属于项目级审计报告，和 profile metrics / workflow preview 形成清晰分工 |
| 输入范围 | A: 全仓库 B: active L3 C: 全部 specs | B | 只需要治理当前可执行规格，避免历史归档噪声 |
| 缺口分类 | A: 仅 count B: missing / empty / unknown / ready C: missing / unknown | B | 与 L1 问题定义一致，便于修复与审计 |
| 修复建议 | A: 自动改写 B: checklist + 人工确认边界 C: 无建议 | B | 必须保留语义真实性，不伪造验收标准 |
| 输出格式 | A: 仅 text B: text + json C: only json | B | 兼顾人类审阅和 CI / report 集成 |
| governed 升级判断 | A: 不输出 B: 输出 readiness ratio 和条件提示 C: 自动切换 default profile | B | 提供治理依据，但不越权写配置 |
| L3 拆分 | A: 一个 L3 全做 B: 报告核心 / 修复建议同步分两片 | B | 报告核心与入口同步可分阶段交付，降低变更半径 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| Critical AC readiness core | 新增 | 扫描 active L3、分类缺口、生成 summary / ratio / examples | fixture、边界、unknown ID、空段测试 |
| Project CLI | 新增 | `project readiness critical [--topic <topic>] [--json]` | text/json、参数校验、只读测试 |
| Spec section parsing | 复用/轻改 | 读取 `## 关键验收标准`、识别 unknown AC 引用 | 单元测试复用既有解析 fixture |
| 方法论/Agent 资产 | 修改 | 说明不得自动伪造关键 AC，补充修复边界 | contract / skill / README 同步测试 |
| Public API | 修改 | 导出 readiness projection 类型 | smoke + 类型测试 |

## 数据模型

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

`missing` 表示不存在 `## 关键验收标准` 段；`empty` 表示存在该段但没有有效条目；`unknown` 表示存在关键 AC 引用但引用了不存在的 AC ID。`ready` 表示至少有一条有效关键 AC 且无 unknown 引用。

## 接口契约

### Core API

```typescript
buildCriticalReadinessReport(paths: ProjectPaths, opts?: {
  topic?: string;
}): CriticalReadinessReport
```

错误契约：

| 错误码 | 触发条件 |
|---|---|
| `INVALID_CRITICAL_READINESS_TOPIC` | topic 含非法路径字符 |
| `CRITICAL_READINESS_UNAVAILABLE` | 项目索引或 spec 读取失败 |

### CLI: `project readiness critical`

```text
spec-manager project readiness critical [--topic <topic>] [--json]
```

行为：

- text 输出 totals、readiness ratio、各 spec 状态、修复建议和 governed 升级提示。
- JSON 输出 `critical-readiness.experimental.v1`。
- `--topic` 仅统计该 topic 的 active L3。
- 该命令始终只读，默认 exit code 0；输入错误 exit code 2。

## 规则

### readiness 分类

| 状态 | 判定 |
|---|---|
| missing | `## 关键验收标准` 段不存在 |
| empty | 该段存在，但没有有效关键 AC 引用 |
| unknown | 该段存在，且至少一个关键 AC 引用不存在 |
| ready | 该段存在，且所有关键 AC 引用有效 |

### 修复建议

- missing: 先读取 L3 上下文，补上真实关键 AC，再重新审阅。
- empty: 确认该 L3 是否真的需要 governed 范围；若需要，则补充真实关键 AC。
- unknown: 修正引用的 AC ID，确保指向同一 L3 的真实验收条目。
- ready: 如 ready L3 充足，可重新运行 adoption preview 评估 governed default。

### governed 升级判断

- 仅当所有 active L3 均 ready 时，才提示可考虑 governed default。
- 仍然只给建议，不直接修改 workflow config。

## 容错与降级

| 场景 | 行为 |
|---|---|
| 项目没有 active L3 | 输出空清单和明确说明，不报错 |
| topic 不存在 | 返回空结果或明确错误，取决于参数是否非法 |
| 只存在 missing/empty/unknown | 保持 text/json 结构稳定，不中断输出 |
| 单个 spec 解析失败 | 该项标为 unknown/invalid，并在 summary 中提示 |

## 向后兼容

- 不修改历史 spec 内容。
- 不修改 Task JSON。
- 不改变 `project profile metrics` 或 `project workflow preview` 既有契约。
- 新命令只读，不引入新的状态机转移。

## 关键流程

```text
project readiness critical
  ├─ list active L3 specs
  ├─ filter by topic if present
  ├─ parse critical AC sections
  ├─ classify missing / empty / unknown / ready
  ├─ compute summary and readiness ratio
  └─ print text/json report
```

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| critical-ac-readiness-L3.1.1-core | readiness core、分类、summary、json schema | `critical-ac-readiness-L2.1` confirmed |
| critical-ac-readiness-L3.1.2-cli | CLI、topic 过滤、修复建议、方法论/Agent 入口同步 | `critical-ac-readiness-L3.1.1-core` frozen/implemented |

## 关联

- parent: `critical-ac-readiness-L1`
- based_on: `adaptive-workflow-adoption-L3.1.1-preview`
- based_on: `adaptive-evidence-workflow-L3.1.1-profile`
- based_on: `adaptive-profile-intelligence-L3.1.2-metrics`
- code_ref: `src/core/spec-sections.ts`
- code_ref: `src/core/adaptive-workflow-adoption.ts`
- code_ref: `src/core/profile-metrics.ts`
- code_ref: `src/cli/project.ts`
