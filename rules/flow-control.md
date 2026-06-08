# 流程控制规则

> 本文件管辖:R1 R2 R3 R4
> 主题:何时 STOP、何时推进状态、何时建 Task、审核独立性

## R1 — 写内容后必须停下等审核

---
id: R1
title: 写内容后必须停下等审核
added: 0.1.0
applies_to: [L1_create, L2_create, L3_create]
---

每次 `spec-manager spec update <code> --content` 写入后，**必须停下**，告知用户文件路径，等用户明确说"批准"/"已确认"/"继续"/"通过"等。

**严禁一口气做**：`new L1 → update --content → confirm → new L2 → update → confirm → new L3 → confirm → task create → start`。

## R2 — 状态推进是用户行为,不是 AI 行为

---
id: R2
title: 状态推进是用户行为,不是 AI 行为
added: 0.1.0
applies_to: [L1_confirm, L2_confirm, L3_confirm, L3_freeze, user_approve]
---

L1/L2 的 `draft → confirmed`、L3 的 `draft → frozen`，以及历史 L3 的 `confirmed → frozen` 都是用户审核意见的体现。L3 一次明确批准后直接进入 frozen，不再要求对同一正文重复批准。AI agent **不能**在未获用户明确批准前主动调用 `spec-manager spec confirm` / `freeze`。

**唯一例外**：`frozen → implemented` 由 `spec-manager task complete` 自动触发，允许 AI agent 执行。

**用户批准信号必须通过 spec-manager 入口响应**：当用户在迭代上下文中说出批准信号（"继续"/"已审批"/"通过"/"批准"/"ok"/"确认"等），AI agent **必须重新进入 spec-manager workflow**（Claude/CodeBuddy skill、Codex/OpenCode 的 `AGENTS.md` 指令入口等），不能凭已有上下文自行推进。

**原因**：AI 拥有上下文≠有权跳过流程。上下文只是信息，流程管控的是质量和可追溯性。

```
正确：用户说"已审批" → AI 进入 spec-manager workflow → 执行下一步状态推进
错误：用户说"已审批" → AI 凭上下文直接读文件、建 Task、动代码
```

## R3 — 创建 Agent Task 前必须 spec 已 frozen

---
id: R3
title: 创建 Agent Task 前必须 spec 已 frozen
added: 0.1.0
applies_to: [agent_task_create]
---

只有当用户明确批准并且 L3 spec 状态为 `frozen` 时，才能调用 `spec-manager task create`。

## R4 — 每层 Spec 都是独立审核点

---
id: R4
title: 每层 Spec 都是独立审核点
added: 0.1.0
applies_to: [L1_confirm, L2_confirm, L3_confirm]
---

> 人工审计:本规则依赖人工判断,无法通过系统强制执行,实际执行由人工审核保障。

L1 PRD 审核、L2 Design 审核、L3 Impl 审核是**三个独立的停止点**。不能因为 L1 批准了就连带假设 L2 也批准；L3 自身只需一次明确批准，批准后直接 frozen。

**人工审计说明**：本规则依赖人工判断，无法通过系统强制执行。hooks 作为辅助提醒，实际执行由人工审核保障。
