---
code: r18-decision-lifecycle-L2.1
level: L2
title: R18 决策卡片生命周期闭环设计
topic: r18-decision-lifecycle
parentCode: r18-decision-lifecycle-L1
status: implemented
aiSummary: >-
  最小修复 R18 循环依赖：createDecision 允许 confirmed|implemented L1，draft 仍拒绝；Task
  complete 的缺卡拒绝、事务回滚和 implemented L1 最终不变量保持不变。补充预建卡片正常完成、缺卡回滚测试，并同步 R18
  规则、CLI、README 与 impl skill。
created: '2026-06-11T01:52:04.032Z'
updated: '2026-06-11T01:58:14.529Z'
changeSummary: 'cascade: task-complete'
---
# R18 决策卡片生命周期闭环设计 — 技术设计

## 方案概述

本设计修复 `r18-decision-lifecycle-L1` 发现的 R18 循环依赖，同时保持“implemented L1 必须有决策卡片”的最终不变量。

核心方案：

```text
L1 draft
  └─ decision create: 拒绝

L1 confirmed
  ├─ decision create: 允许预建
  └─ 最后一个 Task complete
       ├─ 有卡片: 正常级联 L3/L2/L1 → implemented
       └─ 无卡片: R18 拒绝，事务回滚

L1 implemented
  └─ decision create: 允许补充
```

修复仅扩展决策卡片的合法创建时机。Task 完成检查、级联事务和完整性扫描保持现有职责。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 消除循环依赖的方式 | A: 允许 confirmed L1 预建卡片 B: Task complete 自动生成卡片 C: 取消完成前检查 | A | 最小改动，不伪造 what/why，也不降低最终不变量 |
| 最早合法状态 | A: draft B: confirmed C: implemented | B | confirmed 表示用户已批准需求，足以沉淀正式决策；draft 尚未批准 |
| R18 完成检查位置 | A: 保持 Task complete 事务内检查 B: 移到完成后异步检查 | A | 保持缺卡时整体回滚，避免出现无卡 implemented L1 |
| implemented 后补卡 | A: 保留 B: 禁止 | A | 支持补充决策和历史维护 |
| 决策卡片数据模型 | A: 不变 B: 增加 proposed 状态 | A | 当前只需扩展关联 L1 的前置状态，避免引入新生命周期 |
| 正常流程指引 | A: 最后 Task 前预建卡片 B: 继续推荐 `--force` 后补卡 | A | 正常路径不应依赖紧急绕过 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| Decision 核心模块 | 修改 | 放宽决策卡片创建的 L1 状态校验 | 单元测试覆盖 draft/confirmed/implemented/L2 |
| Task 级联测试 | 修改 | 覆盖预建卡片后的普通完成与缺卡事务回滚 | 集成测试 |
| Decision CLI 描述 | 修改 | 描述 confirmed/implemented L1 均可创建 | CLI 帮助文本检查或现有测试 |
| R18 规则与使用指引 | 修改 | 明确预建卡片正常路径，`--force` 仅异常恢复 | 文本复核与全量验证 |

## 数据模型

DecisionRecord 与 Spec/Task 数据模型均不变。

唯一规则变化是 `createDecision` 的 L1 状态前置条件：

| L1 状态 | 当前行为 | 目标行为 |
|---|---|---|
| draft | 拒绝 | 拒绝 |
| confirmed | 拒绝 | 允许 |
| frozen | 拒绝 | 拒绝；L1 正常流程不使用 frozen |
| implemented | 允许 | 允许 |
| archived | 拒绝 | 拒绝 |

## 接口契约

### Decision Core: createDecision

**输入**：现有 CreateDecisionInput，不变。

**成功条件**：

- 关联 Spec 存在。
- 关联 Spec level 为 L1。
- 关联 L1 status 为 `confirmed` 或 `implemented`。
- what/why 长度满足现有限制。

**错误条件**：

| 错误 | 触发条件 |
|---|---|
| Spec not found | docCode 不存在 |
| Decision card 只能关联 L1 | docCode 指向非 L1 |
| R18 状态错误 | L1 不是 confirmed 或 implemented |
| 长度错误 | what/why 超限 |

### Task Core: completeTask

接口与行为保持不变：

- 最后一个 Task 级联 L1 时，事务内检查关联决策卡片。
- 有预建卡片则正常提交事务。
- 缺卡则抛出 R18 错误，Task 和 Spec 状态全部回滚。
- `skipR18Check` / CLI `--force` 保留为异常恢复入口，不作为正常流程。

### CLI 正常流程

```text
L1 confirmed
  → decision create <L1>
  → 完成最后一个 L3 Task
  → task complete（无需 --force）
  → L1 implemented
```

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| confirmed 后决策内容发生变化 | 预建卡片过时 | 使用 decision update / partial / supersede | 在 Task 完成前更新卡片 |
| 最后 Task 完成前未预建卡片 | 普通完成被 R18 拒绝并回滚 | 根据错误提示创建卡片后重试 | 不需要 `--force` |
| 历史异常状态无法正常补卡 | 历史修复受阻 | 保留 `--force` 和 reconciliation/remediation 路径 | 显式审计后处理 |
| 决策卡片写入失败 | Task 尚未完成 | 不推进最后 Task | 修复文件系统问题后重试 |

## 向后兼容

- **Decision 数据**: 不变。
- **Spec/Task 数据**: 不变。
- **CLI 命令格式**: 不变。
- **现有 implemented L1**: 仍可创建决策卡片。
- **现有 draft L1**: 仍不可创建决策卡片。
- **Task complete**: 最终不变量与事务回滚行为不变。

## 关键交互流程

### 正常闭环

```text
用户批准 L1 → confirmed
  └─ createDecision
       └─ status confirmed: 允许写卡片

最后一个 L3 Task → completeTask
  ├─ 执行验证与步骤门禁
  ├─ 事务内级联 L3/L2/L1
  ├─ 查询 L1 decision
  ├─ 已存在: 提交事务
  └─ L1 implemented
```

### 缺卡保护

```text
最后一个 L3 Task → completeTask
  ├─ 事务内级联
  ├─ 查询 L1 decision: 缺失
  ├─ 抛出 R18
  └─ 事务回滚: Task running、L3 frozen、L2/L1 confirmed
```

## 可观测性

- **错误信息**: decision create 应明确只允许 confirmed/implemented L1。
- **Task 错误**: 缺卡完成错误应提示先为 confirmed L1 创建卡片后重试。
- **审计**: Task 成功完成并级联 L1 时继续记录 R18 audit hit。
- **完整性**: project doctor 继续报告无卡片的 implemented L1。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Decision 创建逻辑 | `src/core/decision.ts` | `createDecision` | 扩展合法 L1 状态 |
| Decision 列表 | `src/core/decision.ts` | `listDecisions` | Task 完成时检查预建卡片 |
| Task 完成事务 | `src/core/task.ts` | `completeTask` / `completeTaskUnlocked` | 保持 R18 最终检查与回滚 |
| 项目事务 | `src/core/transaction.ts` | `withProjectTransaction` | 缺卡时回滚级联 |
| 完整性扫描 | `src/core/integrity.ts` | implemented L1 missing-decision 检查 | 保持最终不变量诊断 |
| Decision 单元测试 | `src/core/__tests__/decision.test.ts` | createDecision 测试组 | 增加 confirmed 状态覆盖 |
| Task 级联测试 | `src/core/__tests__/task-cascade.test.ts` | completeTask cascade 测试组 | 增加正常闭环与回滚测试 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `r18-decision-lifecycle-L3.1.1-core` | 修复 Decision 合法状态、补充 R18 闭环测试、同步规则与使用指引 | 无 |

## 关联

- 父 L1: `r18-decision-lifecycle-L1`
- 复用事务设计: `architecture-hardening-L1`
- 复用级联语义: `lifecycle-reconciliation-L1`
