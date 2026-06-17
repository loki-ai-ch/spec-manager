---
code: guided-assist-workflow-L1
level: L1
title: 引导式 Assist 工作流
topic: guided-assist-workflow
parentCode: null
status: implemented
aiSummary: >-
  新增引导式 Assist 工作流 L1：把已实现的 assist brief/critique/next/drift/acceptance
  串成只读下一步推荐入口，降低用户和较弱 Agent 的命令记忆成本。
relations:
  - type: references
    target: ai-capability-compensation-L1
  - type: references
    target: ai-capability-compensation-L3.1.1
  - type: references
    target: ai-capability-compensation-L3.1.2-critic
  - type: references
    target: ai-capability-compensation-L3.1.3-next-drift
  - type: references
    target: roadmap-openspec-L3.1.1-guide
  - type: references
    target: ai-capability-compensation-L2.1
  - type: references
    target: ai-capability-compensation-L3.1.4-acceptance
created: '2026-06-17T05:42:50.656Z'
updated: '2026-06-17T06:16:10.040Z'
changeSummary: 'cascade: task-complete'
---
# 引导式 Assist 工作流 — PRD

## 背景

`ai-capability-compensation` 已经把强模型/资深工程师常做的隐式动作拆成确定性本地能力：`assist brief`、`assist lessons`、`assist critique`、`assist next`、`assist drift`、`assist acceptance`。

现在的问题从“有没有能力”转为“用户和较弱 Agent 会不会稳定用起来”。README 已列出命令，但实际使用中仍需要用户或 Agent 记住何时调用哪一个 assist 子命令：

- 开工前应该先 brief。
- 写 L1/L2/L3 前应该 critique。
- Task running 时应该 next。
- 代码改动后应该 drift。
- 交付前应该 acceptance。

这仍然依赖模型的流程记忆。为了继续抹平大模型能力差距，需要把这些 assist 能力串成一个引导式入口，让用户输入当前意图或上下文后，得到确定的下一条命令、原因和可选直接执行项。

## 用户故事

- 作为普通用户，我希望只输入“我要继续这个需求”或“这个任务做完了吗”，就能知道下一条该跑什么命令，而不是查 README。
- 作为较弱 AI Agent，我希望通过一个稳定入口获得当前阶段推荐动作，避免漏掉 brief、critique、drift 或 acceptance。
- 作为项目维护者，我希望该能力只读、可测试、可解释，不引入自动状态变更或隐藏门禁。
- 作为高级用户，我希望仍能直接使用现有 `assist *` 子命令，而引导入口只负责推荐和串联。

## 验收标准

1. **AC-1**: Given 用户输入自然语言请求，When 执行引导入口，Then 输出 SHALL 包含当前推荐阶段、下一条 `spec-manager` 命令和推荐原因。
2. **AC-2**: Given 请求未绑定 topic，When 项目已有相关 specs/decisions/tasks，Then 引导入口 SHALL 基于关键词和现有 topic 做可解释推断；无法推断时 SHALL 给出明确补充参数建议。
3. **AC-3**: Given 指定 `--spec <code>`，When spec 为 draft L1/L2/L3，Then 引导入口 SHALL 推荐 `assist critique <code>` 或对应确认前检查。
4. **AC-4**: Given 指定 `--task <id> --spec <code>` 且 task running，When 执行引导入口，Then SHALL 推荐 `assist next`，并在存在 git diff 时 SHOULD 提示可执行 `assist drift`。
5. **AC-5**: Given 指定 `--task <id> --spec <code>` 且 task completed 或用户意图包含验收/交付，When 执行引导入口，Then SHALL 推荐 `assist acceptance`。
6. **AC-6**: Given 输出为 `--json`，Then SHALL 包含稳定 schemaVersion、request、topic、specCode、taskId、stage、nextCommand、alternatives、findings 字段。
7. **AC-7**: Given 使用引导入口，Then SHALL 不写 spec/task/audit，不改变状态机，不替代现有 hard gate。
8. **AC-8**: Given README/skill/agent templates，Then 文档 SHOULD 把“先用引导入口，再按推荐执行 assist 子命令”作为默认路径。

## 范围边界

本轮包含：

- 新增一个只读引导入口，用于串联现有 assist 能力。
- 复用现有 specs/tasks/decisions/git/task evidence 读取能力。
- 输出 text/json 两种格式。
- 更新 README、中文 README、skill、agent templates 的入口指引。
- 覆盖 core 与 CLI 测试。

本轮不包含：

- 不自动执行推荐命令。
- 不新增 MCP、网络、远端模型调用或遥测。
- 不改变 L1/L2/L3/Task 状态机。
- 不把 advisory finding 变成 hard gate。
- 不替代 `guide`、`flow status`、`view`；它只补足 assist 能力链路的“下一步推荐”。

## 度量指标

- 新用户从 README 看到的默认路径从多个 assist 命令列表收敛为一个引导入口加推荐命令。
- CLI 测试覆盖至少 5 种阶段：新请求、draft spec、running task、diff drift、completed task acceptance。
- JSON contract 可被 Agent 稳定消费，字段变化需通过测试保护。
- 引导入口对缺失 topic/spec/task 的错误提示包含下一步可执行命令。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 与 `guide` 命名和职责重叠 | 用户困惑 | L2 明确定位：`guide` 面向 spec 流程，guided assist 面向 assist 子能力串联 |
| 推荐过度自信 | Agent 误操作 | 输出 reason 和 alternatives，保持只读，不自动执行 |
| 阶段判断复杂 | 维护成本上升 | 首版使用简单可解释规则，不做隐藏评分 |
| 文档入口变多 | README 噪音 | 把 assist 子命令列表改为“默认引导入口 + 常用直达命令” |

## 关联

- references: `ai-capability-compensation-L1`
- references: `ai-capability-compensation-L2.1`
- references: `ai-capability-compensation-L3.1.1`
- references: `ai-capability-compensation-L3.1.2-critic`
- references: `ai-capability-compensation-L3.1.3-next-drift`
- references: `ai-capability-compensation-L3.1.4-acceptance`
- references: `roadmap-openspec-L3.1.1-guide`
