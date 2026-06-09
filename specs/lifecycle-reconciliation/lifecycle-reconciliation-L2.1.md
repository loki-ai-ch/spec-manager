---
code: lifecycle-reconciliation-L2.1
level: L2
title: 分层级联与历史状态对账技术设计
topic: lifecycle-reconciliation
parentCode: lifecycle-reconciliation-L1
status: implemented
aiSummary: >-
  新增统一 lifecycle service，以受控 authority 支持 frozen L3 与 confirmed L2/L1 级联
  implemented；新增 project reconcile 对账 6 个滞留规格、补建 3 个决策，并修正 flow 与 doctor 诊断。
created: '2026-06-09T01:20:11.801Z'
updated: '2026-06-09T01:37:35.711Z'
changeSummary: 'cascade: task-complete'
---
# 分层级联与历史状态对账技术设计

## 方案概述

本设计新增统一的规格生命周期服务，将“是否具备 implemented 条件”“以何种 authority 推进状态”“如何递归处理上游规格”集中到一个模块：

1. `task complete` 只负责完成 Task 并请求生命周期服务从对应 L3 开始级联。
2. 生命周期服务按层级判断合法前置状态：L3 必须为 `frozen`；L2/L1 必须为 `confirmed`；L2/L1 还必须存在直接子规格且全部为 `implemented`。
3. 状态存储层新增受控 transition authority。普通 CLI 和通用 `updateSpec` 调用仍遵循现有状态机；只有生命周期服务可执行 `confirmed L1/L2 → implemented`。
4. 新增 `project reconcile [--dry-run]`，扫描历史滞留规格，生成确定性对账计划，并在事务内按 L2 后 L1 的顺序推进状态及补建 Decision Card。
5. `flow status` 复用生命周期 readiness 判断，区分“没有子规格，需要创建”和“已有子规格且全部完成，需要对账”。

当前仓库对账目标固定为：

- `architecture-hardening-L2.1`、`architecture-hardening-L1`
- `harness-coding-L2.1`、`harness-coding-L1`
- `repository-remediation-L2.1`、`repository-remediation-L1`

对账不会读取 doctor 输出后自动放宽范围，也不会修改任何 Task 文件。

## 技术决策

### TD-1：生命周期服务是受控 implemented 推进的唯一入口

新增 `src/core/lifecycle.ts`，提供：

```ts
type ImplementationAuthority = 'task-complete' | 'project-reconcile';

interface ImplementationReadiness {
  specCode: string;
  ready: boolean;
  expectedStatus: 'frozen' | 'confirmed';
  blockers: string[];
}

assessImplementationReadiness(paths, specCode, authority): ImplementationReadiness
cascadeImplementedHierarchy(options): LifecycleCascadeResult
```

readiness 规则：

- L3：仅 `task-complete` authority 可推进；当前状态必须为 `frozen`。
- L2/L1：当前状态必须为 `confirmed`，必须至少存在一个直接子规格，且全部直接子规格为 `implemented`。
- `draft`、`archived`、已 `implemented`、缺失规格和部分完成层级均不得推进。
- 已 `implemented` 在计划和重复执行中视为幂等 skip，不视为错误。

`cascadeImplementedHierarchy` 先推进起始规格，再在直接子规格全部完成时递归处理上游规格。Task 完成和显式对账调用同一函数，不保留第二套级联实现。

### TD-2：状态存储层使用 transition authority，不开放通用 confirmed → implemented

现有 `src/core/status.ts` 的普通状态机继续拒绝 `confirmed → implemented`，避免 `spec implement` 或任意 `updateSpec` 绕过完成条件。

扩展 `updateSpec` 内部选项：

```ts
interface UpdateSpecOptions {
  auditSink?: AuditSink;
  transitionAuthority?: ImplementationAuthority;
}
```

当且仅当 authority 为 `task-complete` 或 `project-reconcile`、目标为 `implemented`、层级为 L1/L2 且当前状态为 `confirmed` 时，存储层允许该特殊转换。生命周期服务在调用前负责 readiness 校验；其他调用路径仍使用 `assertSpecTransition`。

该 authority 是内部执行上下文，不新增 CLI 参数，不允许用户通过 `spec implement --force` 模拟对账。

### TD-3：Task 完成事务复用统一生命周期级联

`src/core/task.ts` 删除当前只接受 `frozen` 的私有 `cascadeImplemented`，改为调用生命周期服务：

```ts
cascadeImplementedHierarchy({
  paths,
  startSpecCode: task.specCode,
  authority: 'task-complete',
  auditSink,
});
```

Task 完成前仍要求关联 L3 为 `frozen`、所有步骤成功且存在成功 verification。生命周期服务返回统一的 `cascadedSpecs` 和 `skippedSpecs`，保持 CLI 输出契约。

### TD-4：显式对账使用动态 readiness + 固定 Decision 摘要

新增 `src/core/reconciliation.ts`：

```ts
planLifecycleReconciliation(options): LifecycleReconciliationPlan
applyLifecycleReconciliation(options): LifecycleReconciliationReport
```

计划器动态扫描全部 confirmed L1/L2，并使用生命周期 readiness 判定可对账状态；不会把未完成或无直接子规格的 confirmed 规格列为可推进项。

Decision Card 仅为当前三个明确目标提供固定、人工审阅后的摘要：

- `architecture-hardening-L1`：以领域不变量、完整性扫描和项目事务强化跨文件一致性与审计可信度。
- `harness-coding-L1`：将 frozen L3 到任务上下文、执行回写、验证证据和变更闭环纳入 coding harness 控制层。
- `repository-remediation-L1`：通过固定迁移、严格历史豁免和 merge-missing 资产补齐修复历史一致性。

如果动态扫描发现清单外的可对账 L1/L2，计划将其列为 conflict，要求单独审阅，避免一次执行静默推进未来历史数据。

### TD-5：对账按依赖顺序事务执行并验证幂等

`project reconcile --dry-run` 输出：

- `implement`：将由 confirmed 推进至 implemented 的 L2/L1。
- `decision`：将创建或跳过的 Decision Card。
- `blocked`：状态、子规格或固定范围冲突。

真实执行使用 `withProjectTransaction`：

1. 记录全部目标 spec、Decision 目标和 Task 文件摘要。
2. 按深度从 L2 到 L1 调用 lifecycle service。
3. 为新进入 implemented 的三个 L1 创建 Decision Card。
4. 重新计划，要求全部目标为 skip 且无 conflict。

执行器不得写 Task 文件。测试和当前仓库执行均对全部 completed Task 做字节级前后比较。

### TD-6：Flow 建议基于子规格存在性和 readiness

`suggestNextActionForTopic` 与 `suggestAfterSpecCommand` 使用共享辅助函数判断：

- confirmed L1 无 L2 子规格：建议创建 L2。
- confirmed L2 无 L3 子规格：建议创建 L3。
- confirmed L1/L2 有未完成子规格：由现有 draft/frozen/task 分支给出下一步；不建议重复创建同层子规格。
- confirmed L1/L2 的直接子规格全部 implemented：建议 `spec-manager project reconcile --dry-run`。
- 层级树全部 implemented：返回无立即操作。

`getUpstreamFreezeAdvice` 改为描述真实级联条件：confirmed L1/L2 会在全部直接子规格 implemented 后自动级联，不再错误提示必须 frozen。

### TD-7：完整性扫描报告滞留的 confirmed 上游规格

`src/core/integrity.ts` 新增 `stale-confirmed-parent`：

- confirmed L1/L2 存在直接子规格且全部 implemented 时报告。
- 无直接子规格或部分完成时不报告。
- remediation 指向 `spec-manager project reconcile --dry-run`。

这样新出现的级联遗漏会由 doctor 暴露；完成当前对账后 doctor 恢复为 ok。

## 受影响模块

| 模块 | 变更 |
|---|---|
| `src/core/lifecycle.ts` | 新增分层 readiness、受控 implemented 推进与递归级联 |
| `src/core/status.ts` | 保持普通状态机不变，补充 authority 类型或受控判断辅助函数 |
| `src/core/spec-io.ts` | 接受内部 transition authority，限制 confirmed L1/L2 → implemented |
| `src/core/task.ts` | 使用生命周期服务替换私有 frozen-only 级联 |
| `src/core/reconciliation.ts` | 新增显式状态对账计划、固定 Decision 摘要和事务执行 |
| `src/core/usability.ts` | 修正 flow 下一步与 upstream advice |
| `src/core/integrity.ts` | 新增 `stale-confirmed-parent` 诊断 |
| `src/cli/project.ts` | 新增 `project reconcile [--dry-run]` |
| `src/index.ts` | 导出生命周期与对账公共类型 |
| `src/core/__tests__/task-cascade.test.ts` | 覆盖 confirmed L2/L1 自动级联和部分完成拒绝 |
| `src/core/__tests__/lifecycle.test.ts` | 覆盖分层 readiness、authority 和非法状态 |
| `src/core/__tests__/reconciliation.test.ts` | 覆盖 dry-run、范围冲突、事务、幂等和 Task 不可变 |
| `src/core/__tests__/usability.test.ts` | 覆盖 flow 与 upstream advice |
| `src/core/__tests__/integrity.test.ts` | 覆盖滞留 confirmed 上游规格诊断 |
| `src/cli/__tests__/project-reconcile.test.ts` | 覆盖对账 CLI 输出与 dry-run |

## 接口契约

### 生命周期 readiness

```ts
interface ImplementationReadiness {
  specCode: string;
  level: 'L1' | 'L2' | 'L3';
  currentStatus: SpecStatus;
  expectedStatus: 'confirmed' | 'frozen';
  ready: boolean;
  blockers: Array<'missing-spec' | 'wrong-status' | 'no-children' | 'children-incomplete' | 'authority-not-allowed'>;
}
```

- L3 readiness 不读取子规格。
- L1/L2 readiness 只检查直接子规格，不跨层跳跃判断。
- readiness 为纯读取操作，不写 audit 或文件。
- 已 implemented 返回幂等状态，由计划器表示为 skip。

### 生命周期级联结果

```ts
interface LifecycleCascadeResult {
  cascadedSpecs: Array<{
    code: string;
    level: 'L1' | 'L2' | 'L3';
    oldStatus: 'confirmed' | 'frozen';
    newStatus: 'implemented';
  }>;
  skippedSpecs: Array<{ code: string; status: string; reason: string }>;
}
```

- `task-complete` 必须从 L3 开始。
- `project-reconcile` 只允许处理固定对账计划中的 L1/L2。
- 每次状态写入必须带 `changeSummary`，说明 authority 与触发源。

### 对账计划

```ts
interface LifecycleReconciliationPlan {
  implementationActions: PlannedAction[];
  decisionActions: PlannedAction[];
  conflicts: ReconciliationConflict[];
}
```

- dry-run 不得写 spec、Decision、Task 或 audit。
- apply 必须在事务内重新生成计划并拒绝 conflict。
- 重复执行时 implementation 与 decision 均为 skip。
- 当前三组目标之外的可对账状态必须成为 conflict，不得自动推进。

### R23 可执行操作映射

| 用户目标 | CLI / API |
|---|---|
| 预览当前状态对账 | `spec-manager project reconcile --dry-run` |
| 执行当前状态对账 | `spec-manager project reconcile` |
| 查看流程下一步 | `spec-manager flow status --topic <topic>` |
| 验证仓库完整性 | `spec-manager project doctor` |
| 查询补建决策 | `spec-manager decision list --topic <topic>` |

## L3 裂变计划

1. **lifecycle-reconciliation-L3.1.1-lifecycle**：实现分层 readiness、transition authority 和 Task 完成级联替换。
2. **lifecycle-reconciliation-L3.1.2-flow**：实现 flow/upstream advice 修正与 stale-confirmed-parent 完整性诊断。
3. **lifecycle-reconciliation-L3.1.3-reconcile**：实现显式对账计划/CLI、固定 Decision Card、当前仓库执行和端到端验证。

实施顺序固定：先建立统一生命周期语义，再修正诊断与提示，最后执行历史状态对账。任何 L3 均不得修改 completed Task 文件。
