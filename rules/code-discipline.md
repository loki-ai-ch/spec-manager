# 代码纪律规则

> 本文件管辖:R8 R9 R12
> 主题:改代码前自检、批准必须走 spec-manager 入口、禁凭记忆

## R8 — 改代码前必须调研

---
id: R8
title: 改代码前必须调研
added: 0.1.0
applies_to: [pre_code_change, L3_write]
---

改代码前必须先：
1. `spec-manager spec show <相关 spec code>` 确认 spec 已 frozen
2. Read 相关源文件确认路径存在(R12)
3. grep/Read 了解调用链
4. 识别测试文件

**禁止**：凭记忆写文件路径 / 函数名。

## R9 — 批准必须走 spec-manager 入口，不能凭上下文

---
id: R9
title: 批准必须走 spec-manager 入口，不能凭上下文
added: 0.1.0
applies_to: [user_approve]
---

当用户在迭代上下文中说出"批准"/"已确认"/"通过"等信号时，AI agent **必须**重新进入 spec-manager workflow（skill、`AGENTS.md` 指令入口或同等项目指令），由该入口触发后续状态推进。

**禁止**：凭上下文理解直接调用 `spec-manager spec confirm` / `freeze` / `implement`。

## R12 — 禁止凭记忆写 planJson，必须从模板读

---
id: R12
title: 禁止凭记忆写 planJson，必须从模板读
added: 0.1.0
applies_to: [doc_write, task_write, L3_write]
---

写 L3 spec 的 planJson 前，**必须**先 Read 本仓库 `templates/agent-plan.json` 确认字段名（`stepNo` / `stepType` / `name`）。

**禁止字段名**：`no` / `type` / `desc` / `description`（INC-005 教训）。
