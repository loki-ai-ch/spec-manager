---
code: workflow-surface-simplification-L3.1.3
level: L3
title: Brief Alias and Agent Guidance
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.1
status: implemented
aiSummary: >-
  新增顶层 brief alias 并更新 Agent guidance：brief 复用 assist brief 能力，同时附带 workflow
  next action；保持 assist brief、Design Context 和旧命令兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and existing assist brief implementation
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement top-level brief alias with next projection
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update agent guidance templates for next and brief entrypoints
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted capability usability and workflow surface tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.1
created: '2026-07-15T02:46:00.034Z'
updated: '2026-07-15T02:53:57.732Z'
changeSummary: 'cascade: task-complete'
---
# Brief Alias and Agent Guidance

## 背景

`workflow-surface-simplification-L3.1.1` 和 `workflow-surface-simplification-L3.1.2` 已经提供 workflow surface projection 以及 `next` / `dashboard` CLI。下一步需要把 Agent 常用的上下文入口缩短为 `spec-manager brief "<request>"`，并让生成的 Agent guidance 默认推荐 `next` / `brief`，降低新用户和 Agent 面对 `assist guide`、`assist brief`、`flow status` 的入口选择成本。

本规格只处理 `brief` 顶层 alias 和 Agent guidance 文案；不改 Agent Brief 的核心语义，不改 Design Context 解析，不改 README 主文档。

## 目标

- 新增 `spec-manager brief [request...] [--json]` 顶层命令。
- `brief` MUST 复用现有 `assist brief --request` 底层能力，避免复制 Agent Brief、Design Context 和 lessons 规则。
- `brief` 输出 MUST 包含当前 workflow next action，帮助 Agent 在阅读 brief 后知道安全下一步。
- 更新生成型 agent guidance，使默认入口从 `assist guide` 优先调整为 `next` / `brief`。
- 保持 `spec-manager assist brief --request "<request>"` 兼容。

## 非目标

- 不改变 `assist brief` 原有命令行为。
- 不修改 Design Context parser/lint/export。
- 不新增 external specs root/store。
- 不重写 README；README surface refresh 后续单独处理。
- 不执行任何写入规格或任务状态的快捷行为。

## 涉及文件

- `src/cli/capability.ts`: 当前 `assist brief` 命令实现位置；需要抽取或复用 presenter/handler。
- `src/cli/usability.ts`: 可注册顶层 `brief`，或新建 workflow surface CLI 注册文件。
- `src/core/guided-assist.ts`: 如已有 Agent Brief core，继续复用。
- `src/core/workflow-surface.ts`: 读取 next projection 并注入 brief 输出。
- `src/cli/__tests__/usability.test.ts` 或 `src/cli/__tests__/capability.test.ts`: 增加 `brief` alias 测试。
- `templates/agents/*`、`.agents/skills/spec-manager/SKILL.md`: 更新默认 guidance。

## 实施步骤

1. 阅读 `assist brief` 当前 CLI 和 core 实现，找到可复用的函数边界。
2. 新增顶层 `spec-manager brief [request...] [--json]`。
3. 让 `brief` 输出包含 Agent Brief 内容和 workflow next action。
4. 保持 `assist brief` 行为不变，必要时把共享逻辑抽成 helper。
5. 更新 agent guidance 模板，把新需求默认入口改为 `spec-manager next "<work>"` 或 `spec-manager brief "<work>"`。
6. 增加 CLI 和模板测试。

## 接口契约

### brief

```bash
spec-manager brief "optimize login page"
spec-manager brief "optimize login page" --json
```

text 输出必须包含：

- Agent Brief 现有核心内容。
- `Next:` section，内容来自 `buildWorkflowNextProjection`。

json 输出必须是单个 JSON 对象，建议结构：

```json
{
  "brief": { "...": "existing brief projection" },
  "next": { "...": "WorkflowNextProjection" }
}
```

若现有 Agent Brief 没有稳定 JSON projection，本规格 MAY 先让 `--json` 输出 `{ "text": "...", "next": ... }`，但必须保持单对象 stdout。

## 验收标准

1. **AC-1**: `spec-manager brief "<request>"` MUST 输出现有 Agent Brief 的主要内容。
2. **AC-2**: `spec-manager brief "<request>"` MUST 包含来自 workflow surface projection 的 `Next:` 信息。
3. **AC-3**: `spec-manager brief "<request>" --json` MUST 输出单个 JSON 对象，并包含 `next.nextAction`。
4. **AC-4**: `spec-manager assist brief --request "<request>"` MUST 保持兼容。
5. **AC-5**: Agent guidance templates MUST 推荐 `spec-manager next "<work>"` 或 `spec-manager brief "<work>"` 作为新需求入口。
6. **AC-6**: 新命令 MUST NOT 写入 spec、task、audit 或 config 文件。
7. **AC-7**: UI/design 请求 MUST 继续触发现有 Design Context brief guidance。

## 验证命令

```bash
npm test -- src/cli/__tests__/usability.test.ts src/cli/__tests__/capability.test.ts src/core/__tests__/workflow-surface.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：如果 `brief` 复制 `assist brief` 逻辑，会造成两个入口漂移。实施必须优先抽取共享 helper。
- 风险：Agent guidance 改动过大可能影响多工具入口。应只改默认建议，不删除完整规则。
- 回滚：删除顶层 `brief` 注册和 guidance 文案改动，保留 `assist brief` 原命令。
