---
code: ai-capability-compensation-L3.1.1
level: L3
title: Agent Brief 与 Lessons 注入
topic: ai-capability-compensation
parentCode: ai-capability-compensation-L2.1
status: implemented
aiSummary: >-
  实施第一片能力补偿层：新增 assist brief 与 assist lessons 的共享类型、lessons 聚合、Agent Brief
  projection、CLI 入口和模板引导，保持只读/advisory，不改变现有状态机。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 frozen L3 父 L2 历史任务与相关 core CLI 文件'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/capability-types.ts 新增 assist shared schemas
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/lessons.ts 新增 lessons aggregation projection
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/capability-brief.ts 新增 agent brief projection
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 和 src/cli/index.ts 新增 assist CLI
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 agent templates skill README 增加 brief 引导
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 core CLI tests 覆盖 lessons brief assist 输出
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: >-
      验证: npm test -- src/core/__tests__/lessons.test.ts
      src/core/__tests__/capability-brief.test.ts
      src/cli/__tests__/capability.test.ts
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: >-
      验证: npm run build && spec-manager spec validate
      ai-capability-compensation-L3.1.1
    status: pending
relations:
  - type: based_on
    target: ai-capability-compensation-L2.1
created: '2026-06-17T03:46:35.460Z'
updated: '2026-06-17T04:00:00.507Z'
changeSummary: 'cascade: task-complete'
---
# Agent Brief 与 Lessons 注入 — 实施规格

## 背景

`ai-capability-compensation-L2.1` 定义了能力补偿层技术设计，首轮需要先落地 `assist brief` 和 `assist lessons`。这两项是整个能力补偿层的入口：

- `assist brief` 为 Agent 开工提供稳定任务启动包。
- `assist lessons` 从 decision、incident、failed task 中聚合项目经验。

这一片必须先落地，因为后续 `assist critique`、`assist next`、`assist drift`、`assist acceptance` 都会复用共享 capability types、source refs、finding、lessons 和 brief 结构。

## 目标

1. 提供稳定的 `AgentBrief` JSON/text projection。
2. 提供 `Lesson` 聚合 projection。
3. 复用现有 `recommendWorkflowProfile` 注入 profile 建议。
4. 通过 `assist brief` / `assist lessons` CLI 暴露只读能力。
5. 更新 agent templates / skill，让非平凡工作优先读取 brief。
6. 保持无写入副作用、无状态机变化、无 hard gate。

## 方案概述

实现一条只读 projection 链路：

```text
request/topic + project local facts
  -> lessons aggregation
  -> profile recommendation
  -> brief projection
  -> CLI presenter (text/json)
```

本 L3 只覆盖：

- 共享能力类型定义。
- lessons 聚合。
- Agent Brief projection。
- `assist brief` / `assist lessons` CLI。
- agent template / skill 引导更新。
- 核心与 CLI 测试。

本 L3 不实现 `assist critique`、`assist next`、`assist drift`、`assist acceptance`，这些由后续 L3 独立冻结和实现。

## 技术决策

### 决策 1：共享类型单独抽成 `capability-types.ts`

所有能力补偿 projection 共享 `AssistSeverity`、`AssistSourceRef`、`AssistFinding`、`Lesson` 和 brief 结构中的基础类型。

理由：

- 让后续 L3 垂直切片复用统一 schema。
- 减少 CLI 与 core 间类型漂移。
- 便于 JSON contract 测试。

### 决策 2：lessons 以本地 deterministic 规则聚合

首版 lessons 只从本地 decision、incident、failed task 中提取，不使用语义索引或模型 embedding。

理由：

- 保持本地可复现。
- 避免引入额外依赖和隐式评分。
- 与 L2 的 advisory-only 定位一致。

### 决策 3：Agent Brief 复用 Profile Recommendation

brief 中的 `profileRecommendation` 直接复用现有 `recommendWorkflowProfile`。

理由：

- 不重复实现风险判定。
- 让 brief 同时携带工作强度建议。
- 能自然提示 quick/standard/governed 的适用边界。

### 决策 4：CLI 默认 text，`--json` 作为稳定 contract

brief 和 lessons 都应提供 text 与 JSON 两种输出。text 供人和 Agent 读，JSON 供 harness/测试消费。

理由：

- 兼容已有 CLI 风格。
- 保持未来可测试性。
- 避免只靠自然语言解析。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/core/capability-types.ts` | 新增 | 共享类型定义 |
| `src/core/lessons.ts` | 新增 | 聚合 decision / incident / failed task |
| `src/core/capability-brief.ts` | 新增 | 构建 Agent Brief |
| `src/cli/capability.ts` | 新增 | `assist brief` / `assist lessons` 命令 |
| `src/cli/index.ts` | 修改 | 注册 `assist` 命令组 |
| `templates/agents/*` | 修改 | 引导 Agent 优先读取 brief |
| `skill/SKILL.md` | 修改 | 精简入口并指向 brief |
| `README.md` / `readme_zh.md` | 可选修改 | 增加 brief 使用示例 |

## 接口契约

### 共享类型

```ts
export type AssistSeverity = 'blocking' | 'warning' | 'advisory';

export interface AssistSourceRef {
  kind: 'spec' | 'task' | 'decision' | 'incident' | 'audit' | 'git' | 'config' | 'rule';
  id: string;
  path?: string;
  summary?: string;
}

export interface AssistFinding {
  id: string;
  severity: AssistSeverity;
  title: string;
  detail: string;
  sourceRefs: AssistSourceRef[];
  nextCommand?: string;
}

export interface Lesson {
  id: string;
  topic: string | null;
  title: string;
  detail: string;
  sourceRefs: AssistSourceRef[];
  confidence: 'high' | 'medium' | 'low';
}
```

### Agent Brief

```ts
export interface BriefSpecRef {
  code: string;
  level: string;
  status: string;
  title: string;
  sourceRef: AssistSourceRef;
}

export interface BriefDecisionRef {
  id: string;
  status: string;
  title: string;
  sourceRef: AssistSourceRef;
}

export interface BriefTaskRef {
  id: string;
  specCode: string;
  status: string;
  sourceRef: AssistSourceRef;
}

export interface AgentBrief {
  schemaVersion: 'agent-brief.v1';
  request: string;
  topic: string | null;
  profileRecommendation: ProfileRecommendation | null;
  relevantSpecs: BriefSpecRef[];
  relevantDecisions: BriefDecisionRef[];
  relevantTasks: BriefTaskRef[];
  lessons: Lesson[];
  suggestedReads: AssistSourceRef[];
  findings: AssistFinding[];
  nextCommand: string;
}
```

### CLI 契约

```text
spec-manager assist brief --request <text> [--topic <topic>] [--json]
spec-manager assist lessons [--topic <topic>] [--json]
```

输出要求：

- text 输出有稳定标题：`Agent Brief` / `Lessons`。
- JSON 输出包含 `schemaVersion`、`topic`、`lessons`、`findings` 等固定字段。
- 无相关历史时仍返回成功结果，并在 `findings` 中给出 advisory。
- request 为空时 `assist brief` 返回 exit 2，并提示 `--request must be non-empty`。

## 实施步骤

1. 新增共享类型文件 `src/core/capability-types.ts`。
2. 新增 `src/core/lessons.ts`，实现 failed task / incident / decision 的 deterministic 聚合。
3. 新增 `src/core/capability-brief.ts`，组装 `AgentBrief` 并复用 `recommendWorkflowProfile`。
4. 新增 `src/cli/capability.ts`，注册 `assist brief` 与 `assist lessons`。
5. 更新 `src/cli/index.ts`，注册 `assist` 命令组。
6. 更新 agent templates 与 `skill/SKILL.md` 的简短引导。
7. 增加 core 与 CLI 测试，锁定 JSON contract 和 text 输出。

## 实现细节

### lessons 聚合规则

1. 从同 topic failed tasks 提取：失败 step summary、`lastFailedOutput` 摘要、taskId、specCode。
2. 从同 topic incidents 提取：标题、摘要、修复建议或正文摘要。
3. 从同 topic active decision 提取：决策摘要和约束。
4. 排序：same topic > request token match > global；failed/running > completed。
5. confidence：明确同 topic 且状态相关为 `high`；token 匹配为 `medium`；弱相关为 `low`。
6. 默认数量限制：lessons 最多 8 条，brief 内 lessons 最多 5 条。

### brief 组装规则

1. topic：显式 `--topic` 优先，否则从 request 中提取首个 kebab-case/token，仍无法确定则为 `null`。
2. profile：调用 `recommendWorkflowProfile({ paths, request })`。若 request 为空，不创建 brief。
3. relevant specs：同 topic specs，active 状态优先，最多 5 条。
4. relevant decisions：同 topic active decisions 优先，最多 3 条。
5. relevant tasks：同 topic running/waiting/failed tasks 优先，最多 5 条。
6. suggestedReads：由 selected refs 去重生成，优先 spec 和 decision。
7. findings：无相关历史时输出 advisory；topic 无法确定时输出 advisory。
8. nextCommand：若无同 topic L1，建议 `spec-manager spec new L1 ...`；若存在 active flow，建议 `spec-manager flow status --topic <topic>`；否则建议 `spec-manager guide "<request>"`。

### 模板/技能更新

- `skill/SKILL.md` 和 agent templates 只新增短引导，不复制长规则。
- 引导语强调：非平凡工作先生成或读取 `spec-manager assist brief --request "..."`。
- 保持现有 `/spec-manager` 入口兼容，不强制旧流程立刻改写。

## 验证命令

### Core

```bash
npm test -- src/core/__tests__/lessons.test.ts src/core/__tests__/capability-brief.test.ts
```

### CLI

```bash
npm test -- src/cli/__tests__/capability.test.ts
```

### 全量回归

```bash
npm test
npm run build
spec-manager spec validate ai-capability-compensation-L3.1.1
```

验收标准：

- `assist brief --json` 输出稳定 `schemaVersion`、`nextCommand`、`findings`。
- `assist lessons --json` 输出 lessons 数组与来源。
- text 输出包含稳定标题和摘要。
- 无相关历史时输出 advisory，不报错。
- request 为空时返回 exit 2。

## 状态流与门禁

- 本 L3 仅在 `draft -> frozen` 前由用户确认。
- 实现完成后通过 Agent Task `complete` 推进到 `implemented`。
- `assist brief` 和 `assist lessons` 都是只读，不改变任何 spec/task 状态。
- 任何无法确定的相关性一律用 advisory，不允许伪装成 hard gate。

## L3 裂变计划

| 子切片 | 范围 | 交付 |
|---|---|---|
| shared types | capability types | 共享 schema/types |
| lessons | lessons 聚合 | `assist lessons` |
| brief | Agent Brief projection | `assist brief` |
| cli and templates | CLI + agent 引导 | 命令注册和指令更新 |

本次仅冻结并实现上述子切片，不扩展到 critique / next / drift / acceptance。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| brief 太长 | 仍然增加模型负担 | 限制引用数量，完整内容通过 suggestedReads 读取 |
| lessons 噪声 | 误导 Agent | 严格按 topic / 状态 / token 排序并显式标 confidence |
| 共享类型漂移 | 后续切片不一致 | 共享 schema 单独文件并以测试锁定 |
| 模板膨胀 | agent 入口文件变重 | 只加一行短引导，其余交给 CLI brief |

## 关联

- based_on: `ai-capability-compensation-L2.1`
- references: `roadmap-openspec-L1`
- references: `adaptive-evidence-workflow-L1`
- references: `harness-coding-L1`
- references: `methodology-hardening-L1`
