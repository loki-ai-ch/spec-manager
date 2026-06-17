---
code: task-complete-delivery-hint-L1
level: L1
title: Task 完成交付提示
topic: task-complete-delivery-hint
parentCode: null
status: implemented
aiSummary: 新增 task complete 成功后的交付提示：提醒用户下一步可运行 assist delivery，但不改完成门禁或状态机。
relations:
  - type: references
    target: delivery-summary-L3.1.2
  - type: references
    target: delivery-guide-routing-L3.1.1
created: '2026-06-17T08:20:27.524Z'
updated: '2026-06-17T08:42:27.520Z'
changeSummary: 'cascade: task-complete'
---
# Task 完成交付提示 — PRD

## 背景

`assist delivery` 已经存在，`assist guide` 也能把 completed task 的交付意图路由到 `assist delivery`。但 `spec-manager task complete` 的完成输出仍主要强调验证、证据覆盖和 cascade，弱 Agent 在完成 Task 后仍需要自己想起下一步应该生成交付摘要。

这会让最后一公里的交付动作留在记忆里，而不是留在工具输出里。

## 用户故事

- 作为较弱 AI Agent，我希望在 `task complete` 成功后，输出里直接提醒我下一步可运行 `assist delivery`。
- 作为用户，我希望完成 Task 后能立即看到交付摘要入口，而不是只看到 completed 和 cascade。
- 作为维护者，我希望这只是提示，不改变完成门禁、不改变 Task 状态、不改变 verification 规则。

## 验收标准

1. **AC-1**: Given `task complete` 成功完成，When CLI 输出完成结果，Then SHALL 包含一条指向 `spec-manager assist delivery <taskId> --spec <specCode>` 的提示。
2. **AC-2**: Given Task 完成输出，Then SHALL 继续保留现有 verification、cascade、R18 决策卡结果，不减少原有信息。
3. **AC-3**: Given `--json`，Then completion result JSON SHALL 包含可用于提示 delivery 的字段或同等信息，不破坏既有 schema。
4. **AC-4**: Given Task 未通过完成门禁，Then SHALL 不显示 delivery 提示为最终成功入口。
5. **AC-5**: Given 该增强，Then SHALL 不改变 task complete 的状态机、verification 执行、audit 规则或 cascade 逻辑。

## 范围边界

本轮包含：

- 在 task complete 成功输出中增加 delivery summary 提示。
- 必要时补 completion result / CLI tests。
- 轻量更新文档中的完成后建议。

本轮不包含：

- 不改变 `assist delivery`。
- 不改变 `assist guide`。
- 不改变 completion 的验证门禁或 cascade 逻辑。
- 不新增新的 task 状态或 verification 类型。

## 度量指标

- 完成一个 Task 后，用户可以直接从输出里看到 delivery summary 命令。
- completion / CLI tests 覆盖成功完成、门禁失败和 JSON 输出。
- build 与全量测试通过。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 输出里重复太多提示 | 噪音增加 | 只加一行简短 next step |
| JSON schema 兼容风险 | 破坏现有消费者 | 优先在已有 completion result 上扩字段，不改旧字段语义 |
| 误导未完成任务 | 让用户误以为可直接交付 | 仅在完成成功路径提示 delivery |

## 关联

- references: `delivery-summary-L3.1.2`
- references: `delivery-guide-routing-L3.1.1`
