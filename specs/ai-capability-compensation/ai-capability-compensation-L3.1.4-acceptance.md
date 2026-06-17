---
code: ai-capability-compensation-L3.1.4-acceptance
level: L3
title: Acceptance Report 与 Agent 指令一致性
topic: ai-capability-compensation
parentCode: ai-capability-compensation-L2.1
status: implemented
aiSummary: >-
  实施第四片能力补偿层：新增 assist acceptance 验收报告 projection，并把 agent
  templates/skill/README 的引导统一为先生成 brief 再用 acceptance 查看证据，不改变状态机。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 ai-capability-compensation-L3.1.4-acceptance 与相关 evidence/CLI 测试上下文
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      编辑 src/core/capability-types.ts 和 src/core/acceptance-report.ts 新增
      AcceptanceReport projection
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 注册 assist acceptance 命令与文本输出
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      编辑 README.md readme_zh.md skill/SKILL.md templates/agents/* 补齐 brief 到
      acceptance 引导
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: >-
      编辑 src/core/__tests__/acceptance-report.test.ts 和
      src/cli/__tests__/capability.test.ts 覆盖 core/CLI 行为
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      运行 npm test -- src/core/__tests__/acceptance-report.test.ts 与 npm test --
      src/cli/__tests__/capability.test.ts
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      运行 npm test npm run build spec-manager spec validate
      ai-capability-compensation-L3.1.4-acceptance 和 assist acceptance smoke
    status: pending
relations:
  - type: based_on
    target: ai-capability-compensation-L2.1
created: '2026-06-17T05:28:58.431Z'
updated: '2026-06-17T05:40:50.462Z'
changeSummary: 'cascade: task-complete'
---
# Acceptance Report 与 Agent 指令一致性 — 实施规格

## 背景

`ai-capability-compensation-L2.1` 将 Acceptance Report 定义为能力补偿层第四片：把 task evidence、verifications、artifact、人工验收项和残余风险汇总成用户可读的交付报告。

同时，L2 也要求 agent 指令与能力补偿入口保持一致：非平凡工作先生成 `assist brief`，执行阶段用 `assist next` / `assist drift`，验收阶段再用 `assist acceptance`。

`ai-capability-compensation-L3.1.1`、`L3.1.2-critic`、`L3.1.3-next-drift` 已完成前置补偿能力。本片补齐验收报告和 agent/README 的最后一环。

## 目标

1. 提供 `AcceptanceReport` JSON/text projection。
2. 从 task evidence 与 verifications 生成面向用户的验收报告。
3. 区分 machine evidence、human acceptance 和 residual risk。
4. 统一 agent templates / skill / README 中的指引，明确先 brief 后 acceptance 的工作路径。
5. 通过 `spec-manager assist acceptance <taskId> --spec <specCode>` 暴露只读能力。
6. 保持无写入副作用、无状态机变化、无 hard gate。

## 方案概述

新增验收报告 projection：

```text
TaskId + SpecCode + task evidence + verifications + artifacts + critical AC
  -> AcceptanceReport
  -> assist acceptance text/json presenter
```

同时更新 agent templates 和 skill 文本，让它们优先引导：

1. `assist brief` 先收集上下文。
2. `assist critique` / `assist next` / `assist drift` 辅助推进。
3. `assist acceptance` 作为验收汇总入口。

本 L3 只覆盖：

- `AcceptanceReport` 类型。
- `assist acceptance` CLI。
- 由 `buildTaskEvidence` 扩展的验收展示。
- agent templates / skill / README 的短引导一致性。
- core 与 CLI 测试。

本 L3 不实现任何 metrics / profile 统计。

## 技术决策

### 决策 1：Acceptance Report 只做汇总，不替代人工验收

报告明确 machine evidence、human acceptance 和 residual risk 分区，避免把验证成功误解为业务完成。

理由：

- 与 methodology 中的“证据不夸大”一致。
- 维持 hard gate 与 advisory/report 分离。
- 适合在交付前给人和 Agent 同一份事实。

### 决策 2：Agent 指令只提供短引导

更新 skill / agent templates / README 时，只增加 brief/acceptance 的短引导，不复制长规则。

理由：

- 避免入口文件膨胀。
- 真正的详细信息由 CLI projection 提供。
- 保持多 Agent 入口一致。

### 决策 3：Acceptance 报告复用 task evidence

基于 `buildTaskEvidence`，对 covered / failed / uncovered / not-required、verification、artifact、critical AC 继续做 deterministic 投影。

理由：

- 避免重复实现 evidence 逻辑。
- 与 governed / standard profile 行为保持兼容。
- 结果可被 JSON / CLI / future harness 稳定消费。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/core/acceptance-report.ts` | 新增 | Acceptance Report projection |
| `src/core/capability-types.ts` | 修改 | 增加 AcceptanceReport / AcceptanceCriterionReport 类型 |
| `src/cli/capability.ts` | 修改 | 注册 `assist acceptance` 命令和 presenter |
| `templates/agents/*` | 修改 | 短引导统一为 brief -> acceptance 路径 |
| `skill/SKILL.md` | 修改 | 添加 acceptance 入口说明 |
| `README.md` / `readme_zh.md` | 修改 | 增加 acceptance 示例 |
| `src/core/__tests__/acceptance-report.test.ts` | 新增 | core fixture 测试 |
| `src/cli/__tests__/capability.test.ts` | 修改 | acceptance CLI JSON/text/错误测试 |

## 接口契约

### Core 类型

```ts
export interface AcceptanceCriterionReport {
  id: string;
  text: string;
  status: 'covered' | 'failed' | 'uncovered' | 'not-required';
  verificationIds: string[];
}

export interface AcceptanceReport {
  schemaVersion: 'acceptance-report.v1';
  taskId: string;
  specCode: string;
  profile: WorkflowProfile;
  criteria: AcceptanceCriterionReport[];
  verifications: TaskVerificationRecord[];
  artifacts: string[];
  humanAcceptance: AssistFinding[];
  residualRisk: AssistFinding[];
  summary: TaskEvidenceSummary;
}
```

### CLI 契约

```text
spec-manager assist acceptance <taskId> --spec <specCode> [--json]
```

行为：

- spec/task 不存在：使用现有 exit 1/2 语义。
- text 输出稳定标题 `Acceptance Report`，以及 profile、summary、criteria、verifications、artifact、human acceptance、residual risk。
- JSON 输出 `schemaVersion`、`taskId`、`specCode`、`profile`、`summary` 等固定字段。
- 若无 critical AC，仍返回 report，并在 humanAcceptance 或 residualRisk 中提示需要人工确认。

## 实施步骤

1. 修改 `src/core/capability-types.ts`，增加 `AcceptanceReport` / `AcceptanceCriterionReport` 类型。
2. 新增 `src/core/acceptance-report.ts`，基于 task evidence 构建验收报告。
3. 修改 `src/cli/capability.ts`，增加 `assist acceptance` 命令和 text presenter。
4. 更新 agent templates / skill / README 的短引导，使 acceptance 路径与 brief 一致。
5. 新增 `src/core/__tests__/acceptance-report.test.ts`。
6. 扩展 `src/cli/__tests__/capability.test.ts`。
7. 运行 core / CLI / 全量测试。

## 实现细节

### Acceptance 报告结构

1. `criteria` 直接从 task evidence 的 critical criteria 投影。
2. `verifications` 直接取 task 的 verification records。
3. `artifacts` 去重聚合 verification artifacts。
4. `humanAcceptance`：
   - 当 criteria 为空时，提示没有 critical AC 并不等于无需人工验收。
   - 当存在 uncovered/failed criteria 时，提示需要人工或环境验收。
5. `residualRisk`：
   - 记录未覆盖但不一定阻断的剩余风险。
6. `summary` 复用 task evidence summary。

### 输出原则

- 不宣称“业务已通过”，只说明证据覆盖情况。
- machine evidence、human acceptance、residual risk 三者分开显示。
- findings 仍是 advisory/report，不是 hard gate。

### Agent 指令一致性

更新模板/skill 文本时，只加入以下短引导：

- 非平凡工作先 `assist brief`。
- 执行阶段用 `assist next` / `assist drift`。
- 验收前用 `assist acceptance`。

## 验证命令

### Core

```bash
npm test -- src/core/__tests__/acceptance-report.test.ts
```

### CLI

```bash
npm test -- src/cli/__tests__/capability.test.ts
```

### 全量回归

```bash
npm test
npm run build
spec-manager spec validate ai-capability-compensation-L3.1.4-acceptance
```

验收标准：

- `assist acceptance --json` 输出稳定 schema。
- criteria、verifications、artifacts、humanAcceptance、residualRisk 均可见。
- 无 critical AC 仍能生成 report，但会有人工验收提示。
- agent templates/skill/README 均有 brief -> acceptance 的一致引导。

## 状态流与门禁

- 本 L3 由用户确认后 `draft -> frozen`。
- 实现必须通过 Agent Task 创建、启动、step、verify、complete。
- `assist acceptance` 只读，不写 audit/spec/task。
- acceptance findings 不作为 hard gate。

## L3 裂变计划

| 子切片 | 范围 | 交付 |
|---|---|---|
| acceptance report | 证据汇总 | `AcceptanceReport`、`assist acceptance` |
| agent guidance | brief -> acceptance 引导 | templates / skill / README |
| tests | core + CLI fixture | 回归测试 |

本次仅实现上述子切片，不扩展到 metrics。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 报告过长 | 用户不愿阅读 | 保持分区清晰，criteria / verifications / humanAcceptance 分段展示 |
| 误把 evidence 当验收 | 业务风险 | 强制分离 machine evidence 与 human acceptance |
| 指令膨胀 | 入口文件变重 | 只加短引导，详细内容交给 CLI projection |
| 与 task evidence 重复 | 用户困惑 | 说明 acceptance 是证据汇总视图，而不是新的事实源 |

## 关联

- based_on: `ai-capability-compensation-L2.1`
- references: `ai-capability-compensation-L3.1.1`
- references: `ai-capability-compensation-L3.1.2-critic`
- references: `ai-capability-compensation-L3.1.3-next-drift`
- references: `methodology-hardening-L1`
