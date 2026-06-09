---
code: lifecycle-reconciliation-L1
level: L1
title: 上游规格生命周期与状态对账
topic: lifecycle-reconciliation
parentCode: null
status: implemented
aiSummary: >-
  对齐分层生命周期：Task 完成后 frozen L3、confirmed L2/L1 按全部子规格完成条件级联 implemented，并显式对账当前 6
  个滞留上游规格、补建 3 个 Decision Card、修正 flow 提示。
created: '2026-06-09T01:18:08.420Z'
updated: '2026-06-09T01:37:35.714Z'
changeSummary: 'cascade: task-complete'
---
# 上游规格生命周期与状态对账

## 背景

当前工作流规定：

- L1/L2 获得用户批准后由 `draft` 进入 `confirmed`。
- L3 获得用户批准后由 `draft` 直接进入 `frozen`。
- Agent Task 完成后，L3 由 `frozen` 自动进入 `implemented`，并在全部子规格完成时向上游规格递归级联。

但现有级联实现只允许任何层级从 `frozen` 进入 `implemented`。由于 L1/L2 按规则不会进入 `frozen`，已批准且所有子规格均完成的上游规格会永久停留在 `confirmed`。

当前仓库已出现三组该问题：

- `architecture-hardening-L1` / `architecture-hardening-L2.1`
- `harness-coding-L1` / `harness-coding-L2.1`
- `repository-remediation-L1` / `repository-remediation-L2.1`

这还导致 `flow status` 在全部 L3 已实现后错误建议继续创建 L2/L3，并使应在 L1 implemented 后创建的 Decision Card 无法落地。

## 用户故事

1. 作为规格维护者，我希望 L1/L2 在已批准且全部直接子规格 implemented 后自动进入 implemented，使状态与实际完成情况一致。
2. 作为执行 Agent，我希望 Task 完成级联遵循不同层级的合法前置状态，而不是要求所有层级都为 frozen。
3. 作为项目维护者，我希望能预览并显式对账历史上已满足完成条件但滞留在 confirmed 的上游规格。
4. 作为审计人员，我希望状态对账保留明确的变更原因，不修改已完成 Task，也不伪造新的任务执行记录。
5. 作为 CLI 使用者，我希望 `flow status` 在全部子规格已完成时提示对账或无待办，而不是建议重复创建子规格。

## 验收标准

1. **AC-1**: Task 完成级联 MUST 允许 frozen L3 在任务完成后进入 implemented。
2. **AC-2**: 当 L2 的全部直接 L3 子规格均为 implemented 时，级联 MUST 允许 confirmed L2 进入 implemented。
3. **AC-3**: 当 L1 的全部直接 L2 子规格均为 implemented 时，级联 MUST 允许 confirmed L1 进入 implemented。
4. **AC-4**: 级联 MUST 拒绝 draft、archived 或子规格未全部 implemented 的上游规格。
5. **AC-5**: 系统 MUST 提供 dry-run 或等价预览，列出当前仓库中可对账的上游规格状态、待创建 Decision Card 及阻塞原因。
6. **AC-6**: 显式对账 MUST 将当前三组滞留 L1/L2 推进为 implemented，并为三个新进入 implemented 的 L1 创建基于现有规格与实施结果的 Decision Card。
7. **AC-7**: 对账 MUST NOT 修改任何 completed Task 的 status、steps、verifications、时间戳或文件内容。
8. **AC-8**: `flow status` MUST 区分“仍需创建子规格”和“全部子规格已完成但上游规格待对账”，不得建议重复创建 L2/L3。
9. **AC-9**: 对账完成后 `project doctor` MUST 保持 `Repository integrity: No integrity issues`。
10. **AC-10**: 自动化测试 MUST 覆盖 L1/L2/L3 分层级联、非法状态拒绝、部分完成、dry-run、幂等、Decision Card 和 Task 字节不可变。

## 范围边界

### 必须包含

- 对齐 `task complete` 的 L3、L2、L1 分层级联前置状态。
- 检测“全部直接子规格 implemented，但上游规格仍 confirmed”的可对账状态。
- 提供显式、可预览、幂等的当前仓库状态对账。
- 为 `architecture-hardening-L1`、`harness-coding-L1`、`repository-remediation-L1` 补建 Decision Card。
- 修正 `flow status` 对已完成层级树的下一步提示。
- 保持 completed Task 字节级不变。

### 明确不做

- 不引入 L1/L2 的额外 frozen 审批步骤。
- 不通过 `spec implement --force` 绕过层级完成条件。
- 不自动推进 draft、archived 或子规格未全部完成的上游规格。
- 不修改历史 Task 或伪造 verification。
- 不改变 L3 必须由 Task 完成触发 implemented 的规则。

## 成功指标

- 当前 6 个滞留 L1/L2 均通过显式对账进入 implemented。
- 三个新 implemented L1 均可查询对应 Decision Card。
- `architecture-hardening`、`harness-coding`、`repository-remediation` 的 flow 不再建议重复创建子规格。
- `project doctor` 继续为 ok。
- 重复执行状态对账不产生状态变化、重复决策或 Task 文件变化。
