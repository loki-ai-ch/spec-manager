---
name: constraint-closed-loop-l3-1-2-hooks-t-001-proposal
proposalType: task-linked
taskCode: T-001
specCode: constraint-closed-loop-L3.1.2-hooks
topic: constraint-closed-loop
reason: >-
  完成后最终一致性审查发现已实现架构与冻结规格存在文档漂移：完成门禁已拆到 src/core/task-completion.ts，验证在 R5 和
  verification evidence 后、生命周期级联前执行；父 L2 仍描述 --force 逃生口和旧失败上下文模型。
impact: >-
  需要后续规格对账：更新 L2/L3 的模块路径、门禁顺序、scoped skip + reason 契约和 lastFailedOutput
  数据模型描述；当前运行时代码与测试无需回退。
status: resolved
why: >-
  完成后最终一致性审查发现已实现架构与冻结规格存在文档漂移：完成门禁已拆到 src/core/task-completion.ts，验证在 R5 和
  verification evidence 后、生命周期级联前执行；父 L2 仍描述 --force 逃生口和旧失败上下文模型。
scope: >-
  需要后续规格对账：更新 L2/L3 的模块路径、门禁顺序、scoped skip + reason 契约和 lastFailedOutput
  数据模型描述；当前运行时代码与测试无需回退。
created: '2026-06-15T09:31:59.115Z'
updated: '2026-06-15T09:43:46.711Z'
---
# constraint-closed-loop-l3-1-2-hooks-t-001-proposal

> Task-linked implementation change proposal. Status: **unresolved**.

## 关联

- task: T-001
- spec: constraint-closed-loop-L3.1.2-hooks

## Reason

完成后最终一致性审查发现已实现架构与冻结规格存在文档漂移：完成门禁已拆到 src/core/task-completion.ts，验证在 R5 和 verification evidence 后、生命周期级联前执行；父 L2 仍描述 --force 逃生口和旧失败上下文模型。

## Impact

需要后续规格对账：更新 L2/L3 的模块路径、门禁顺序、scoped skip + reason 契约和 lastFailedOutput 数据模型描述；当前运行时代码与测试无需回退。

## Next Options

- Amend the L3 spec and freeze it again.
- Record a decision if the implementation direction is now intentional.
- Split follow-up work into a new task.
- Resolve this proposal once the scope decision is handled.
