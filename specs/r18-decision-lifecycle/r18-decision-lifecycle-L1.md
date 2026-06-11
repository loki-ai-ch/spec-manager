---
code: r18-decision-lifecycle-L1
level: L1
title: R18 决策卡片生命周期闭环修复
topic: r18-decision-lifecycle
parentCode: null
status: implemented
aiSummary: >-
  修复 R18 循环依赖：允许已批准的 confirmed L1 预建决策卡片，使最后一个 Task 可在不使用 --force 的情况下完成；保持
  draft L1 禁止建卡、implemented L1 必须有卡片的最终不变量，并同步测试与指引。
created: '2026-06-11T01:49:00.751Z'
updated: '2026-06-11T01:58:14.532Z'
changeSummary: 'cascade: task-complete'
---
# R18 决策卡片生命周期闭环修复 — 需求文档

## 背景

R18 的目标是保证 L1 进入 `implemented` 后至少存在一张决策卡片。但当前两个门禁组合后形成循环依赖：

1. `task complete` 在最后一个 L3 完成并级联 L1 后检查决策卡片；缺失时拒绝完成并通过事务回滚级联。
2. `decision create` 只允许关联已经 `implemented` 的 L1。

因此正常路径中，使用者既不能在 Task 完成前创建决策卡片，也不能在缺少决策卡片时完成 Task。唯一可行路径是使用 `task complete --force` 跳过 R18，再补建决策卡片。该路径把正常流程变成了紧急绕过，并削弱了门禁语义。

本问题已在 `methodology-hardening-L3.1.1-doc-contract` 完成时复现：所有步骤和验证通过后，预建决策卡片被拒绝；普通完成会被 R18 拒绝，只能使用 `--force` 完成级联后补建。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 生命周期死锁 | 决策卡片前置状态与 Task 完成门禁互相依赖 | P0 | `methodology-hardening` Task T-001 执行记录 |
| 安全绕过 | 正常交付被迫使用 `--force` | P0 | CLI 实际执行结果 |
| 规则语义 | “implemented 后创建”与“完成前必须存在”无法同时满足 | P1 | R18 规则与实现对照 |
| 使用指引 | README 与 skill 对 R18 正常路径描述不一致 | P1 | 文档与实现对照 |

## 用户故事

### Must have

- As a Agent Task 执行者, I want 在已批准的 L1 上预先创建决策卡片, so that 最后一个 Task 可以在不使用 `--force` 的情况下通过 R18。
- As a 项目维护者, I want R18 继续保证 implemented L1 至少有一张决策卡片, so that 修复循环依赖不会降低审计要求。
- As a 规格审核者, I want draft L1 仍然不能建立正式决策卡片, so that 未批准需求不会沉淀为有效决策。
- As a CLI 使用者, I want 错误信息和使用指引描述可执行的正常路径, so that 我不需要依赖紧急绕过。

### Should have

- As a 规则维护者, I want 自动化测试覆盖预建卡片、正常完成与缺失卡片拒绝三条路径, so that R18 生命周期不会再次形成死锁。

### Could have

- As a 审计者, I want 能区分决策卡片创建时间与 L1 implemented 时间, so that 可以复盘决策是在实施前还是实施后记录。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| 无 `--force` 完成最后一个 Task | 决策缺失场景不可完成 | confirmed L1 预建卡片后可正常完成 |
| R18 最终不变量 | implemented L1 必须有卡片 | 保持不变 |
| 未批准需求保护 | draft L1 禁止建卡 | 保持不变 |
| 生命周期测试 | 缺少完整闭环用例 | 覆盖至少 3 条关键路径 |

## 验收标准

1. **AC-1**: **Given** L1 已经用户批准并处于 `confirmed`, **When** 用户创建关联该 L1 的决策卡片, **Then** 系统 **SHALL** 创建成功。
2. **AC-2**: **Given** L1 仍处于 `draft`, **When** 用户创建关联该 L1 的决策卡片, **Then** 系统 **SHALL** 拒绝创建。
3. **AC-3**: **Given** confirmed L1 已预建至少一张决策卡片且最后一个 L3 Task 满足完成条件, **When** 执行普通 `task complete`, **Then** 系统 **SHALL** 完成 Task 并级联 L3/L2/L1，不需要 `--force`。
4. **AC-4**: **Given** 最后一个 L3 Task 满足其他完成条件但 L1 没有决策卡片, **When** 执行普通 `task complete`, **Then** 系统 **SHALL** 拒绝完成并保持 Task 与 Spec 状态一致。
5. **AC-5**: **Given** L1 已处于 `implemented`, **When** 用户补充创建决策卡片, **Then** 系统 **SHALL** 继续允许创建。
6. **AC-6**: **Given** 使用者阅读 R18 规则和使用指引, **When** 执行正常交付流程, **Then** 文档 **SHALL** 指引在最后一个 Task 完成前为 confirmed L1 创建决策卡片，并将 `--force` 保留为异常恢复手段。
7. **AC-7**: **Given** 修复完成, **When** 运行项目验证, **Then** 全量测试、lint、build、项目完整性检查和 diff 检查 **SHALL** 通过。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 正常 R18 闭环是否需要 `--force` | 需要 | 不需要 | 集成测试 |
| R18 最终不变量保持率 | 100% | 100% | 缺卡完成拒绝测试 |
| 关键生命周期测试覆盖 | 不完整 | ≥3 条关键路径 | 测试用例计数 |

## 范围边界

- **做**:
  - 允许 confirmed L1 创建决策卡片。
  - 保持 implemented L1 可创建决策卡片。
  - 保持 draft L1 与非 L1 Spec 禁止创建决策卡片。
  - 覆盖 R18 预建卡片与 Task 完成闭环测试。
  - 同步 R18 规则和正常流程指引。
- **不做**:
  - 不自动生成决策卡片内容。
  - 不取消 Task 完成时的 R18 检查。
  - 不允许 draft L1 创建有效决策卡片。
  - 不改变其他 Spec 或 Task 状态转换。
- **推迟**:
  - 为决策卡片增加独立的 proposed/active 生命周期。
  - 自动分析决策卡片是否完整覆盖关键 AC。

## 设计原则

1. **消除正常路径中的强制绕过** — 正常交付不得依赖 `--force`。违反判断：满足全部业务条件后仍必须跳过门禁才能完成。
2. **保持最终不变量** — implemented L1 必须至少有一张决策卡片。违反判断：无卡片 L1 可以通过普通 Task 完成进入 implemented。
3. **批准后才可沉淀正式决策** — confirmed 是创建决策卡片的最早合法状态。违反判断：draft L1 可以创建卡片。
4. **最小生命周期扩展** — 只放宽决策卡片创建前置状态，不改变 Task 与 Spec 的其他状态行为。违反判断：修复引入新的状态转换或自动内容生成。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | 修复决策卡片创建前置状态与闭环测试 | 无 | P0 |
| Phase 2 | 同步 R18 规则和使用指引 | Phase 1 完成 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| R18 决策生命周期与 Task 完成闭环 | Phase 1-2 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| confirmed 后实施方案仍可能调整 | 预建决策可能需要更新 | 保留 decision update、partial 与 supersede 能力 |
| 现有文档将 `--force` 描述为常规补建流程 | 修复后用户仍可能绕过正常路径 | 同步规则、README 与 skill 指引 |
| 工作树存在其他未提交实现改动 | 验证失败来源可能混杂 | 限定变更范围并区分既有失败 |

## 关联

- based_on: `architecture-hardening-L1`
- based_on: `lifecycle-reconciliation-L1`
- discovered_by: `methodology-hardening-L3.1.1-doc-contract`
