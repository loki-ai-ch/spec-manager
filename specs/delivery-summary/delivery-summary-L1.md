---
code: delivery-summary-L1
level: L1
title: 用户交付摘要
topic: delivery-summary
parentCode: null
status: implemented
aiSummary: >-
  新增用户交付摘要能力：把 spec/task/verification/acceptance
  事实汇总为可复制给用户的交付说明，区分机器证据、人工验收和残余风险。
relations:
  - type: references
    target: ai-capability-compensation-L3.1.4-acceptance
  - type: references
    target: guided-assist-workflow-L3.1.1-core
  - type: references
    target: guided-assist-workflow-L3.1.2-cli
  - type: references
    target: adaptive-evidence-workflow-L3.1.2-evidence
created: '2026-06-17T06:59:43.779Z'
updated: '2026-06-17T07:42:33.009Z'
changeSummary: 'cascade: task-complete'
---
# 用户交付摘要 — PRD

## 背景

`ai-capability-compensation` 和 `guided-assist-workflow` 已经补齐了开工、审查、续跑、漂移检查、验收报告和下一步推荐能力。用户和较弱 Agent 现在更容易知道“下一步该做什么”。

但一次工作真正交付给用户时，仍然需要人工组织信息：

- 本次实现对应哪个 L1/L2/L3？
- Agent Task 做了哪些步骤？
- 跑了哪些验证？
- 有哪些证据和产物？
- 还有哪些人工验收项或残余风险？
- 下一步建议是什么？

这些信息分散在 spec、task、verification、acceptance report、decision 和 git 状态里。强模型通常能把它们整理成一段清晰交付说明；较弱模型容易漏验证、夸大结果，或把“测试通过”误写成“业务已验收”。

因此需要新增一个只读的“用户交付摘要”能力，把本地事实源压缩成可复制给用户的交付摘要，继续抹平模型能力差距。

## 用户故事

- 作为用户，我希望在一次 Agent Task 完成后，能一键看到“做了什么、验证了什么、还要我确认什么”。
- 作为较弱 AI Agent，我希望用确定性命令生成交付摘要，避免遗漏测试、证据、风险或下一步。
- 作为维护者，我希望交付摘要只基于本地 spec/task/verification/acceptance 事实，不自动改变状态，不替代人工验收。
- 作为高级用户，我希望输出既有人类可读 text，也有 Agent 可消费 JSON。

## 验收标准

1. **AC-1**: Given 一个 taskId 和 specCode，When 执行交付摘要命令，Then 输出 SHALL 包含 spec、task、status、steps summary、verification summary、artifacts、acceptance findings、next action。
2. **AC-2**: Given Task 有 verification records，When 生成摘要，Then 输出 SHALL 区分 passed/failed verification，并列出命令、layer、summary。
3. **AC-3**: Given Task 有 acceptance report findings，When 生成摘要，Then 输出 SHALL 区分 machine evidence、human acceptance、residual risk。
4. **AC-4**: Given Task 没有 verification，When 生成摘要，Then 输出 SHOULD 明确提示证据不足，而不是宣称交付完成。
5. **AC-5**: Given `--json`，Then 输出 SHALL 包含稳定 schemaVersion、taskId、specCode、headline、summary、verifications、artifacts、humanAcceptance、residualRisk、nextAction 字段。
6. **AC-6**: Given spec/task 不存在，Then CLI SHALL 使用现有资源错误语义并给出可执行修复提示。
7. **AC-7**: Given 使用交付摘要命令，Then SHALL 不写 spec/task/audit，不改变状态机，不自动 complete task。

## 范围边界

本轮包含：

- 新增只读交付摘要 projection。
- 复用 `buildAcceptanceReport`、task records、spec metadata 和 verification records。
- CLI text/json 输出。
- README / skill / templates 加短引导：交付前可生成 delivery summary。
- core 与 CLI 测试。

本轮不包含：

- 不自动执行测试。
- 不自动完成 Task。
- 不生成 release notes / changelog。
- 不调用远端模型，不引入网络或遥测。
- 不替代人工验收结论。

## 度量指标

- 用户交付摘要一条命令可生成，无需手动查询 task evidence、acceptance、spec show。
- CLI / core tests 覆盖 completed task、有失败 verification、无 verification、missing resource。
- 文档默认交付路径包含 delivery summary 或 acceptance summary。
- 输出不使用“业务已通过”之类夸大措辞，只描述证据覆盖情况。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 摘要过度承诺 | 用户误以为已业务验收 | 明确区分 machine evidence / human acceptance / residual risk |
| 与 `assist acceptance` 重叠 | 命令职责不清 | delivery summary 面向最终交付文本，acceptance 面向证据报告 |
| 输出过长 | 用户不愿读 | text 输出默认摘要化，JSON 保留结构化细节 |
| 证据不足时仍生成摘要 | 误导 | 输出 warning/advisory，不阻断但明确不足 |

## 关联

- references: `ai-capability-compensation-L3.1.4-acceptance`
- references: `guided-assist-workflow-L3.1.1-core`
- references: `guided-assist-workflow-L3.1.2-cli`
- references: `adaptive-evidence-workflow-L3.1.2-evidence`
