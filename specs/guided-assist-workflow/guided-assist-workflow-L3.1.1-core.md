---
code: guided-assist-workflow-L3.1.1-core
level: L3
title: Guided Assist Core 推荐器
topic: guided-assist-workflow
parentCode: guided-assist-workflow-L2.1
status: implemented
aiSummary: >-
  实现引导式 Assist 工作流的核心推荐器：基于 request/topic/spec/task/git 的固定优先级规则，返回只读
  GuidedAssistReport。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 guided-assist-workflow-L3.1.1-core 与相关 core API 测试上下文
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/capability-types.ts 增加 GuidedAssistReport 类型
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/guided-assist.ts 实现 stage 判定与推荐规则
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      编辑 src/core/__tests__/guided-assist.test.ts 覆盖 request spec task drift
      acceptance 场景
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行 npm test -- src/core/__tests__/guided-assist.test.ts
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      运行 npm test npm run build spec-manager spec validate
      guided-assist-workflow-L3.1.1-core
    status: pending
relations:
  - type: based_on
    target: guided-assist-workflow-L2.1
  - type: references
    target: ai-capability-compensation-L2.1
  - type: references
    target: ai-capability-compensation-L3.1.1
  - type: references
    target: ai-capability-compensation-L3.1.2-critic
  - type: references
    target: ai-capability-compensation-L3.1.3-next-drift
  - type: references
    target: ai-capability-compensation-L3.1.4-acceptance
  - type: based_on
    target: guided-assist-workflow-L2.1
created: '2026-06-17T05:59:45.892Z'
updated: '2026-06-17T06:16:10.030Z'
changeSummary: 'cascade: task-complete'
---
# Guided Assist Core 推荐器 — 实施规格

## 背景

`guided-assist-workflow-L1` / `L2.1` 已经把问题定义清楚：`assist brief`、`assist critique`、`assist next`、`assist drift`、`assist acceptance` 这些能力都已经存在，但用户和较弱 Agent 仍然需要记住该在什么阶段调用哪一个命令。

这片只做核心推荐器，不改 CLI 外壳和文档。目标是把 request / topic / spec / task / git 状态投影成确定性的下一步推荐。

## 目标

1. 提供 `GuidedAssistReport` JSON/text projection。
2. 根据 request、topic、spec、task、git changed files 推断阶段。
3. 复用现有 `assist` 投影，不重复实现 brief / critique / next / drift / acceptance。
4. 输出可解释的 `reason`、`alternatives`、`findings` 和 `sourceRefs`。
5. 保持只读，不写 spec/task/audit，不改变状态机。

## 方案概述

```text
request + optional topic/spec/task + local specs/tasks/git
  -> buildGuidedAssistReport
  -> GuidedAssistReport
```

推荐器的职责只限于“决定下一条现有命令是什么”：

- `brief`
- `critique`
- `task-next`
- `drift`
- `acceptance`
- `flow`
- `needs-input`

不会自动执行任何命令。

## 技术决策

### 决策 1：固定优先级规则

stage 判定按固定优先级顺序执行，不引入评分、模型调用或 hidden heuristic。

理由：

- 可测试。
- 可解释。
- 与本地确定性原则一致。

### 决策 2：acceptance 优先于 task-next

当 request 明确包含验收/交付含义，或者 task 已 completed 时，优先推荐 `assist acceptance`。

理由：

- 已完成任务的下一步通常是交付汇总，而不是继续续跑。
- 让用户更快到达 handoff 视图。

### 决策 3：drift 只在意图明确时前置

只有 request 明确提到 drift/偏差/范围/改动，或者作为 task-next 的 alternative 时，才把 `assist drift` 放到主推荐。

理由：

- 避免 running task 的默认路径被 drift 噪音干扰。
- 保留 drift 作为 scope 校验工具。

### 决策 4：topic 不确定时保守降级

topic 无法推断或冲突时，不猜；返回 `needs-input` 或 `brief`，并建议用户补 `--topic`。

理由：

- 错误推荐比补参更难恢复。
- `assist guide` 应该减少误导，不制造更多上下文幻觉。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/core/guided-assist.ts` | 新增 | stage 判定与 report 构建 |
| `src/core/capability-types.ts` | 修改 | 增加 GuidedAssistReport 类型 |
| `src/core/__tests__/guided-assist.test.ts` | 新增 | stage / recommendation fixture tests |

## 接口契约

### Core 输入

```ts
export interface BuildGuidedAssistInput {
  paths: ProjectPaths;
  request: string;
  topic?: string;
  specCode?: string;
  taskId?: string;
  gitReader?: GitChangedFilesReader;
}
```

### Core 输出

```ts
export type GuidedAssistStage =
  | 'brief'
  | 'critique'
  | 'task-next'
  | 'drift'
  | 'acceptance'
  | 'flow'
  | 'needs-input';

export interface GuidedAssistAlternative {
  command: string;
  reason: string;
}

export interface GuidedAssistReport {
  schemaVersion: 'guided-assist.v1';
  request: string;
  topic: string | null;
  specCode: string | null;
  taskId: string | null;
  stage: GuidedAssistStage;
  nextCommand: string;
  reason: string;
  alternatives: GuidedAssistAlternative[];
  findings: AssistFinding[];
  sourceRefs: AssistSourceRef[];
}
```

## 阶段规则

按以下顺序判断：

1. `acceptance`：request 含验收/交付词汇，或 task status 为 `completed`。
2. `drift`：request 含 drift/偏差/范围/改动词汇，且 task/spec 已绑定。
3. `task-next`：task status 为 `draft` / `running` / `waiting` / `failed`。
4. `critique`：specCode 存在，且请求围绕 spec 审查、确认、冻结、设计、实现。
5. `flow`：能推断 topic，且 topic 下已有可浏览的 specs/tasks。
6. `brief`：只有 request，但还没有明确 spec/task。
7. `needs-input`：request 为空、topic 冲突，或无法形成稳定建议。

补充规则：

- `critique` 对 draft spec 应偏向“确认前检查”。
- `flow` 不是失败，而是保守 fallback。
- `brief` 是默认开工入口。

## 输出原则

- `nextCommand` 必须是当前建议执行的现有命令。
- `alternatives` 只提供备选命令，不执行。
- `reason` 必须解释为什么是这个 stage。
- `findings` 用于描述不确定性、缺失 topic、缺失 spec/task、git 读取失败等。

## 验证命令

```bash
npm test -- src/core/__tests__/guided-assist.test.ts
npm test
npm run build
spec-manager spec validate guided-assist-workflow-L3.1.1-core
```

验收标准：

- request-only 场景推荐 `brief`。
- draft spec 场景推荐 `critique`。
- running task 场景推荐 `task-next`。
- completed task / acceptance 意图场景推荐 `acceptance`。
- topic 不确定时给出明确补参建议。

## 实施步骤

1. 新增 `src/core/capability-types.ts` 中的 `GuidedAssistReport`、`GuidedAssistAlternative`、`GuidedAssistStage` 类型。
2. 新增 `src/core/guided-assist.ts`，实现 `buildGuidedAssistReport` 与 stage 判定规则。
3. 新增 `src/core/__tests__/guided-assist.test.ts`，覆盖 request/topic/spec/task/git 场景。
4. 运行 core targeted tests、`npm test`、`npm run build`、`spec-manager spec validate guided-assist-workflow-L3.1.1-core`。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 规则太硬 | 推荐不够灵活 | 保持 text reason 和 alternatives，优先保守降级 |
| topic 推断偏差 | 错误命令推荐 | 多源冲突时返回 needs-input |
| task/spec 缺失 | 用户误解 | findings 明确提示缺失对象 |
| git 读取失败 | drift 场景不稳定 | 失败时只降级 alternative，不阻断 report |

## 关联

- based_on: `guided-assist-workflow-L2.1`
- references: `ai-capability-compensation-L2.1`
- references: `ai-capability-compensation-L3.1.1`
- references: `ai-capability-compensation-L3.1.2-critic`
- references: `ai-capability-compensation-L3.1.3-next-drift`
- references: `ai-capability-compensation-L3.1.4-acceptance`
