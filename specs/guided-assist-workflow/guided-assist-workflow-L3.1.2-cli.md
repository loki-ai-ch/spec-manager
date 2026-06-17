---
code: guided-assist-workflow-L3.1.2-cli
level: L3
title: Guided Assist CLI 与文档引导
topic: guided-assist-workflow
parentCode: guided-assist-workflow-L2.1
status: implemented
aiSummary: >-
  完善 assist guide CLI 与文档引导：补齐错误语义、CLI 测试、completion 发现，并把
  README/skill/templates 默认路径改为先 assist guide。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 guided-assist-workflow-L3.1.2-cli 与 capability/completion/documentation
      上下文
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 完善 assist guide 错误处理和 presenter
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/cli/__tests__/capability.test.ts 覆盖 assist guide CLI 错误和输出
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      编辑 src/core/completion.ts 和 src/core/__tests__/completion.test.ts 增加
      assist guide completion
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: >-
      编辑 README.md readme_zh.md skill/SKILL.md templates/agents/* 默认引导到 assist
      guide
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 运行 targeted tests build full tests spec validate 和 assist guide smoke
    status: pending
relations:
  - type: based_on
    target: guided-assist-workflow-L2.1
  - type: references
    target: guided-assist-workflow-L3.1.1-core
  - type: references
    target: ai-capability-compensation-L3.1.1
  - type: references
    target: ai-capability-compensation-L3.1.2-critic
  - type: references
    target: ai-capability-compensation-L3.1.3-next-drift
  - type: references
    target: ai-capability-compensation-L3.1.4-acceptance
created: '2026-06-17T06:25:32.974Z'
updated: '2026-06-17T06:57:44.640Z'
changeSummary: 'cascade: task-complete'
---
# Guided Assist CLI 与文档引导 — 实施规格

## 背景

`guided-assist-workflow-L3.1.1-core` 已实现 `buildGuidedAssistReport`，并提供最薄的 `assist guide` CLI 入口用于 smoke。L2 原计划中的第二片仍需要完成：

- 把 `assist guide` 作为 README / skill / agent templates 的默认入口。
- 补齐 CLI 错误语义与 JSON/text presenter 测试。
- 更新 shell completion / 命令发现相关资产，确保用户能发现该入口。

这片不修改 core stage 规则，只做 CLI polish 和文档导流。

## 目标

1. 完善 `assist guide` CLI text/json presenter 的测试覆盖。
2. 明确 `--request` 空值、`--task` 缺 `--spec`、缺失 spec/task 的退出语义。
3. 更新 README / readme_zh / skill / agent templates，把默认 assist 路径改为先 `assist guide`。
4. 更新 completion 中的 assist 子命令发现。
5. 保持只读，不写 spec/task/audit，不改变状态机。

## 方案概述

```text
buildGuidedAssistReport
  -> assist guide CLI
  -> README / skill / templates default entry
  -> completion discoverability
```

用户默认路径：

```bash
spec-manager assist guide --request "add user authentication"
```

高级用户仍可直达：

```bash
spec-manager assist brief --request "..."
spec-manager assist critique <specCode>
spec-manager assist next <taskId> --spec <specCode>
spec-manager assist drift <taskId> --spec <specCode>
spec-manager assist acceptance <taskId> --spec <specCode>
```

## 技术决策

### 决策 1：README 展示默认入口，保留直达命令

文档中将 `assist guide` 放在 assist 命令列表第一位，其他子命令作为常用直达入口保留。

理由：

- 降低新用户记忆成本。
- 不影响熟练用户直达具体报告。

### 决策 2：CLI 错误使用现有 exit 语义

- 缺 request 或 task 缺 spec：exit 2。
- spec/task 不存在：exit 1。

理由：

- 与当前 CLI 参数错误 / 资源错误习惯一致。
- 便于 Agent 做 deterministic recovery。

### 决策 3：文档只放短引导

templates 和 skill 只加入一条短引导，不复制 stage 规则表。

理由：

- 避免入口文件膨胀。
- 详细规则由 `assist guide --json` 和 spec 保持。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/cli/capability.ts` | 修改 | 完善 `assist guide` 错误处理和 presenter |
| `src/cli/__tests__/capability.test.ts` | 修改 | 增加 request/task/spec 错误与 text/json tests |
| `src/core/completion.ts` | 修改 | completion 包含 assist 子命令提示 |
| `README.md` / `readme_zh.md` | 修改 | 默认 assist 路径改为 `assist guide` |
| `skill/SKILL.md` | 修改 | 引导 Agent 优先调用 `assist guide` |
| `templates/agents/*` | 修改 | 多 Agent 入口同步短引导 |

## 接口契约

CLI：

```bash
spec-manager assist guide --request "<work>" [--topic <topic>] [--spec <specCode>] [--task <taskId>] [--json]
```

text 输出：

```text
Guided Assist
Request: ...
Topic: ...
Spec: ...
Task: ...
Stage: ...
Next: ...
Reason: ...
Alternatives:
Findings:
```

JSON 输出复用 `GuidedAssistReport`。

## 实施步骤

1. 检查 `src/cli/capability.ts` 当前 `assist guide` 实现，补齐空 request / task 缺 spec 的 exit 2。
2. 扩展 `src/cli/__tests__/capability.test.ts`，覆盖 JSON、text、empty request、task without spec、missing spec/task。
3. 更新 `README.md` / `readme_zh.md` 的 “When You Want More Control / 想自己控制流程时” 示例。
4. 更新 `skill/SKILL.md` 和 `templates/agents/*` 的短引导。
5. 更新 `src/core/completion.ts`，确保 completion 发现 `assist guide`。
6. 运行 targeted tests、build、full tests、spec validate 和 CLI smoke。

## 验证命令

```bash
npm test -- src/cli/__tests__/capability.test.ts
npm test -- src/core/__tests__/completion.test.ts
npm test
npm run build
spec-manager spec validate guided-assist-workflow-L3.1.2-cli
node dist/cli/index.js assist guide --request "add auth" --topic auth --json
```

验收标准：

- `assist guide --json` 输出稳定 `guided-assist.v1`。
- text 输出包含 `Guided Assist`、`Stage`、`Next`、`Reason`。
- 空 request / task 缺 spec 返回 exit 2。
- missing spec/task 返回 exit 1。
- README / skill / templates 默认路径均提到先 `assist guide`。
- completion 覆盖 `assist guide`。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 文档入口过多 | 新用户困惑 | 默认展示 `assist guide`，直达命令作为补充 |
| CLI 错误与 core needs-input 重叠 | 行为不一致 | CLI 参数错误优先 exit 2，core needs-input 保留给 JSON 报告 |
| completion 范围扩大 | 测试脆弱 | 只增加 assist 子命令静态项，不做动态补全 |

## 关联

- based_on: `guided-assist-workflow-L2.1`
- references: `guided-assist-workflow-L3.1.1-core`
- references: `ai-capability-compensation-L3.1.1`
- references: `ai-capability-compensation-L3.1.2-critic`
- references: `ai-capability-compensation-L3.1.3-next-drift`
- references: `ai-capability-compensation-L3.1.4-acceptance`
