# 质量门禁规则

> 本文件管辖:R5 R6 R10 R15 R18
> 主题:执行可观测、task 后状态校验、step 必含 summary

## R5 — 执行期间不得跳步

---
id: R5
title: 执行期间不得跳步
added: 0.1.0
applies_to: [agent_step_report]
---

每个 planJson 的 step **必须**通过 `spec-manager task step` 单独上报，禁止跳号。

**错误**：planJson 有 10 步但只上报 step 1、5、10，然后调用 `task complete`。

## R6 — task_complete 后校验 implemented

---
id: R6
title: task_complete 后校验 implemented
added: 0.1.0
applies_to: [agent_task_complete]
---

调用 `spec-manager task complete` 后，**必须立即** `spec-manager spec show <L3 code>` 校验 status 是否已自动 cascade 到 `implemented`。未级联则手动 `spec-manager spec implement <L3 code>`。

**原因**：避免 INC-20260424-001 — L3-A implemented → 级联误判 L2 完成，而 L3-B 还没建。

## R10 — planJson 最后一步必须是验证

---
id: R10
title: planJson 最后一步必须是验证
added: 0.1.0
applies_to: [agent_task_create]
---

`spec-manager spec validate-plan` 校验时，末步 name 应含 "验证"/"verify"/"test"/"check"/"curl"/"gradle"/"mvn"/"pytest"/"vitest" 等关键字。`spec validate-plan` 输出 `R10` warning 需用户确认。

**原因**：避免"实施完成但无验证" — 无法证明功能真工作。

## R15 — step_report outputJson 必含 summary

---
id: R15
title: step_report outputJson 必含 summary
added: 0.1.0
applies_to: [agent_step_report]
---

每次 `spec-manager task step` 调用，`--output-json` 必须是合法 JSON 且含 `summary` 字段（≤500 字）。files 字段如有也应给出。

**原因**：summary 是步骤可读的"工作内容"，无 summary 等于审计不可用。

## R18 — L1 implemented 后必须建决策卡片

---
id: R18
title: L1 implemented 后必须建决策卡片
added: 0.1.0
applies_to: [L1_implemented]
---

L1 spec 状态推进到 `implemented`（通常通过 L3 cascade）后，**必须**至少创建 1 张决策卡片：

```bash
spec-manager decision create <L1 code> --topic <topic> --what "..." --why "..." --criteria AC-1,AC-2
```

**执行机制**：`task complete` 在 cascade 到 L1 implemented 后自动检查决策卡片存在性，缺失则抛出 R18 错误拒绝完成。`--force` 可跳过检查（用于历史补建场景）。R18 已纳入合规基线（`audit show` 检查）。

新 L1 创建前（PRE-WRITE Q4）必须 `spec-manager decision list --topic <topic>` 查询历史决策。
