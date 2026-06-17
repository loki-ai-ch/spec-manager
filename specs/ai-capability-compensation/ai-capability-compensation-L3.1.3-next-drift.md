---
code: ai-capability-compensation-L3.1.3-next-drift
level: L3
title: Task Next 与 Drift Check
topic: ai-capability-compensation
parentCode: ai-capability-compensation-L2.1
status: implemented
aiSummary: >-
  实施第三片能力补偿层：新增 assist next 与 assist drift 的 Task 下一步导航和路径范围偏差投影，复用 task
  evidence、task 状态和 git 变更读取，输出只读 advisory/report。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 frozen L3 task evidence task APIs 和 assist CLI'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/capability-types.ts 新增 TaskNextReport DriftCheckReport 类型
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/task-next.ts 新增 task next projection
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/drift-check.ts 新增 drift check projection
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 新增 assist next drift 命令
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 core CLI tests 覆盖 task next drift check
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 README readme_zh 增加 assist next drift 示例
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: >-
      验证: npm test -- src/core/__tests__/task-next.test.ts
      src/core/__tests__/drift-check.test.ts
      src/cli/__tests__/capability.test.ts
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: >-
      验证: npm run build && npm test && spec-manager spec validate
      ai-capability-compensation-L3.1.3-next-drift
    status: pending
relations:
  - type: based_on
    target: ai-capability-compensation-L2.1
created: '2026-06-17T05:17:24.743Z'
updated: '2026-06-17T05:28:07.176Z'
changeSummary: 'cascade: task-complete'
---
# Task Next 与 Drift Check — 实施规格

## 背景

`ai-capability-compensation-L2.1` 将 Task Next 和 Drift Check 定义为能力补偿层第三片：

- `assist next` 让 running Task 的下一步、失败摘要、未完成步骤和 evidence 可见。
- `assist drift` 让工作区实际变更与 frozen L3 声明范围进行路径级对账。

`ai-capability-compensation-L3.1.1` 和 `ai-capability-compensation-L3.1.2-critic` 已分别实现 brief/lessons 和 critique。本片继续复用共享 `AssistFinding` / `AssistSourceRef` / `SpecCritiqueReport` 之外的能力，聚焦 Task 续跑与偏差提示。

## 目标

1. 提供 `TaskNextReport` JSON/text projection。
2. 提供 `DriftCheckReport` JSON/text projection。
3. 让 running task 的下一步可由系统确定性提示，而不是由 Agent 自行猜测。
4. 让 frozen L3 声明范围和实际 git diff 的偏差可见。
5. 通过 `spec-manager assist next` 与 `spec-manager assist drift` 暴露只读能力。
6. 保持无写入副作用、无状态机变化、无 hard gate。

## 方案概述

新增两个只读 projection：

```text
TaskId + SpecCode + local task state + evidence
  -> TaskNextReport
  -> assist next text/json presenter

TaskId + SpecCode + git worktree + declared L3 scope
  -> DriftCheckReport
  -> assist drift text/json presenter
```

本 L3 只覆盖：

- `TaskNextReport` / `DriftCheckReport` 类型。
- Task 下一步和未完成步骤提取。
- failure/evidence 注入。
- declared scope 与 git diff 的路径级比较。
- `assist next` / `assist drift` CLI。
- core 与 CLI 测试。

本 L3 不实现 `assist acceptance`。

## 技术决策

### 决策 1：Task Next 只给确定性下一步，不尝试自动修复

`assist next` 只提示当前任务的下一步和风险，不自动重新执行、不自动 patch。

理由：

- 继续执行和修复必须由 Agent 或人决定。
- 该命令目标是减少记忆负担，不是调度器。
- 可与现有 `task step` / `task report` / `task verify` 组合使用。

### 决策 2：Drift Check 首版只做路径范围对账

只判断 `changedFiles` 是否落在 declared scope，不判断语义漂移。

理由：

- 与 L2 设计保持一致。
- 路径级漂移已经能捕捉很多误改范围的问题。
- 语义漂移留给后续更大范围能力或人工审查。

### 决策 3：declared scope 采用保守解析

先从 L3 的 `文件级改动` / `实施步骤` / `影响文件` / `Implementation Plan` 以及 planJson 中的 file/path 读取 scope；未命中则 advisory。

理由：

- 避免过拟合 markdown 布局。
- 不伪造对范围的理解。
- 保持本地可复现。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/core/task-next.ts` | 新增 | Task 下一步导航 projection |
| `src/core/drift-check.ts` | 新增 | git diff 与 L3 declared scope 偏差 projection |
| `src/core/capability-types.ts` | 修改 | 增加 TaskNextReport / DriftCheckReport 类型 |
| `src/cli/capability.ts` | 修改 | 注册 `assist next` 与 `assist drift` 命令和 presenter |
| `src/core/__tests__/task-next.test.ts` | 新增 | Task Next core fixture 测试 |
| `src/core/__tests__/drift-check.test.ts` | 新增 | Drift Check core fixture 测试 |
| `src/cli/__tests__/capability.test.ts` | 修改 | next/drift CLI JSON/text/错误测试 |
| `README.md` / `readme_zh.md` | 可选修改 | 增加 next/drift 示例 |

## 接口契约

### Core 类型

```ts
export interface TaskNextReport {
  schemaVersion: 'task-next.v1';
  taskId: string;
  specCode: string;
  taskStatus: string;
  currentStep: number | null;
  nextAction: string;
  incompleteSteps: TaskStepSummary[];
  lastFailure: string | null;
  evidenceSummary: TaskEvidenceSummary | null;
  findings: AssistFinding[];
}

export interface DriftCheckReport {
  schemaVersion: 'drift-check.v1';
  taskId: string;
  specCode: string;
  changedFiles: DriftFile[];
  declaredFiles: string[];
  undeclaredFiles: string[];
  findings: AssistFinding[];
}
```

### CLI 契约

```text
spec-manager assist next <taskId> --spec <specCode> [--json]
spec-manager assist drift <taskId> --spec <specCode> [--json]
```

行为：

- spec/task 不存在：使用现有 exit 1/2 语义。
- text 输出稳定标题 `Task Next` / `Drift Check`。
- JSON 输出 `schemaVersion`、`taskId`、`specCode`、`findings` 等固定字段。
- `assist drift` 在 git 不可用或无 declared scope 时仍返回 report，并附 advisory。

## 实施步骤

1. 修改 `src/core/capability-types.ts`，增加 `TaskNextReport`、`DriftCheckReport` 与相关子类型。
2. 新增 `src/core/task-next.ts`，从 Task、step、verification、evidence 生成下一步导航报告。
3. 新增 `src/core/drift-check.ts`，读取 git diff 和 declared scope，生成路径范围漂移报告。
4. 修改 `src/cli/capability.ts`，增加 `assist next` 和 `assist drift` 命令和 text presenter。
5. 新增 `src/core/__tests__/task-next.test.ts`。
6. 新增 `src/core/__tests__/drift-check.test.ts`。
7. 扩展 `src/cli/__tests__/capability.test.ts`。
8. 可选更新 README / readme_zh 示例。

## 实现细节

### Task Next 规则

1. 读取 task 记录及其 steps。
2. 若 task 非 running，nextAction 提示可用状态操作或说明当前不可续跑。
3. 若 task running：
   - currentStep 指向第一个 pending/running 步骤。
   - incompleteSteps 列出 pending/running/failed 步骤。
   - lastFailure 注入 `lastFailedOutput` 或最近 failed step 的 summary。
   - evidenceSummary 复用 task evidence 的 summary。
4. 若有 failed step，findings 增加 warning/advisory，提示需要先修复失败步骤。
5. 若无 verification，findings 增加 advisory，提示补充验证。

### Drift Check 规则

1. 读取 task 和对应 spec。
2. 解析 declared scope：
   - `## 文件级改动`
   - `## 影响文件`
   - `## 实施步骤`
   - `## Implementation Plan`
   - planJson 中的 file/path 字段（若存在）
3. 读取 changedFiles：优先通过 git status / diff name-only。
4. 计算 undeclaredFiles = changedFiles - declaredFiles。
5. 若 declaredFiles 为空，输出 advisory：declared scope unavailable。
6. 若 undeclaredFiles 非空，输出 warning。
7. 首版只比较路径，不比较语义。

### SourceRefs

- Task Next 的 findings 至少引用 task / spec / verification / audit。
- Drift Check 的 findings 至少引用 git / spec / task。

## 验证命令

### Core

```bash
npm test -- src/core/__tests__/task-next.test.ts src/core/__tests__/drift-check.test.ts
```

### CLI

```bash
npm test -- src/cli/__tests__/capability.test.ts
```

### 全量回归

```bash
npm test
npm run build
spec-manager spec validate ai-capability-compensation-L3.1.3-next-drift
```

验收标准：

- running task 返回确定性 `nextAction`。
- failed step 会出现在 `findings` 或 `lastFailure` 中。
- 无 verification 时输出 advisory。
- `assist drift` 能列出 undeclaredFiles。
- 无 declared scope 时输出 advisory，不伪造判断。
- `assist next` / `assist drift` JSON 输出稳定。

## 状态流与门禁

- 本 L3 由用户确认后 `draft -> frozen`。
- 实现必须通过 Agent Task 创建、启动、step、verify、complete。
- `assist next` 与 `assist drift` 只读，不写 audit/spec/task。
- findings 只作为 report/advisory，不作为 hard gate。

## L3 裂变计划

| 子切片 | 范围 | 交付 |
|---|---|---|
| task next | task 状态与下一步 | `TaskNextReport`、`assist next` |
| drift check | 路径范围对账 | `DriftCheckReport`、`assist drift` |
| tests | core + CLI fixture | 回归测试 |

本次仅实现上述子切片，不扩展到 acceptance。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| nextAction 过于模板化 | 仍需人工判断 | 保持报告简短并带上 failure / evidence / pending steps |
| drift 误报 | 开发者被噪声打扰 | 首版仅做路径判断并在无 scope 时 advisory |
| declared scope 解析不足 | 报告覆盖不全 | 明确 scope 来源优先级，无法判断时不伪造 |
| 与 task show 重复 | 用户困惑 | `assist next` 强调“下一步导航”，不是全量 task 视图 |

## 关联

- based_on: `ai-capability-compensation-L2.1`
- references: `ai-capability-compensation-L3.1.1`
- references: `ai-capability-compensation-L3.1.2-critic`
- references: `methodology-hardening-L1`
