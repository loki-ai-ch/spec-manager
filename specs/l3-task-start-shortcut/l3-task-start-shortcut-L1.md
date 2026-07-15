---
code: l3-task-start-shortcut-L1
level: L1
title: L3 Confirm and Task Auto-Start Shortcut
topic: l3-task-start-shortcut
parentCode: null
status: implemented
aiSummary: >-
  定义 L3 confirm/create/start 合并体验需求：主路径一条命令完成冻结、创建并启动任务，同时保留 task create draft
  兼容。
relations:
  - type: references
    target: workflow-surface-simplification-L2.4
  - type: references
    target: workflow-surface-simplification-L3.4.2
created: '2026-07-15T09:24:30.350Z'
updated: '2026-07-15T10:07:25.862Z'
changeSummary: 'cascade: task-complete'
---
# L3 Confirm and Task Auto-Start Shortcut — 需求文档

## 背景

当前 L3 执行链路对用户来说仍然偏重复：

```bash
spec-manager spec confirm <L3>
spec-manager task create <L3> --plan ./plan.json
spec-manager task start <taskId> --spec <L3>
```

项目已经实现 `spec-manager task run <L3> --plan ./plan.json`，可组合 L3 confirm/freeze、task create、task start。但从本轮真实对话看，用户仍自然地连续输入 `spec confirm`、`task create`、`task start`，说明快捷入口没有覆盖用户心智：用户想“批准这个 L3 并立刻执行”，不想管理 Task draft/running 的中间状态。

不处理会导致每个 L3 都重复 2-3 个命令，增加上下文噪音和人工确认成本。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| Workflow friction | L3 confirm、task create、task start 对用户是重复动作 | P1 | 本轮对话连续多次手动执行三步 |
| Discoverability | 现有 `task run` 已覆盖能力，但用户仍按旧命令操作 | P1 | 真实使用路径没有自然命中新入口 |
| State ergonomics | `task create` 后停在 draft，需要额外 `task start` | P2 | CLI 当前行为 |

## 用户故事

### Must have

- As a user, I want 确认 L3 后能用一个动作创建并启动任务, so that 我不需要再手动执行 `task create` 和 `task start`。
- As an AI agent, I want 当用户说“确认并执行/创建并执行/继续执行”时有唯一推荐命令, so that 我不会在 `spec confirm`、`task create`、`task start` 之间来回停顿。
- As a maintainer, I want 保留现有显式三步命令, so that 脚本和需要 draft task 的高级用法不被破坏。

### Should have

- As a user, I want `task create` 可选择立即启动, so that 我可以保持命令语义但减少一步。
- As a user, I want CLI 输出直接告诉我下一步执行/验证命令, so that 操作闭环更短。

### Could have

- As a maintainer, I want README 和 Agent templates 用同一套措辞说明快捷路径, so that 后续不会再次漂移。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| L3 确认并执行 | 通常需要 3 条命令；已有 `task run` 但不够显眼 | 主路径 1 条命令完成 freeze/create/start |
| Task 创建后启动 | `task create` 输出 draft，需手动 start | 支持 auto-start 入口，保留 draft 兼容 |
| Agent 指导一致性 | 多处 guidance 已提 `task run`，但用户仍重复三步 | guidance 明确“创建后立即执行”首选路径 |

## 验收标准

1. **AC-1**: **Given** 一个 draft L3 和有效 planJson, **When** 用户执行新的确认并执行入口, **Then** 系统 **SHALL** 将 L3 freeze、创建 Task、启动 Task，并输出 running task id。
2. **AC-2**: **Given** 一个 frozen L3 和有效 planJson, **When** 用户执行 task 创建并执行入口, **Then** 系统 **SHALL** 创建 Task 并立即进入 running，而不要求用户再执行 `task start`。
3. **AC-3**: **Given** 现有脚本依赖 `task create` 只创建 draft, **When** 不传新快捷参数或不使用新入口, **Then** 旧行为 **SHALL** 保持兼容。
4. **AC-4**: **Given** 用户或 Agent 查看 README/Agent guidance, **When** 看到 L3 执行说明, **Then** 文档 **SHALL** 推荐一条主命令完成确认、创建和启动。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 常规 L3 执行命令数 | 3 条手动命令 | 1 条主路径命令 | README/guidance 示例 |
| 兼容性 | 旧 `task create` 生成 draft | 不传新参数仍生成 draft | CLI tests |
| 测试覆盖 | 待测量 | 新增 CLI tests 覆盖 draft L3、frozen L3、兼容 draft create | `npm test -- task docs-guidance` |

## 范围边界

- **做**:
  - 设计并实现 L3 confirm/create/start 的单动作主路径。
  - 让 frozen L3 的 task 创建可立即启动。
  - 更新 README、Agent guidance、测试。
- **不做**:
  - 不移除 `spec confirm`、`task create`、`task start`。
  - 不改变 task complete / evidence 门禁。
  - 不自动生成 planJson。
- **推迟**:
  - 交互式 planJson 生成向导。
  - 多 L3 批量 confirm-and-run。

## 设计原则

1. **主路径一条命令** — 用户表达“确认并执行”时只需要一条命令。违反判断: 仍需要手动 copy task id 再 start。
2. **兼容显式状态机** — 高级用户仍可只创建 draft task。违反判断: 原 `task create` 无法保持 draft 行为。
3. **不伪造执行** — 快捷入口只创建并启动 task，不自动标记 step 成功。违反判断: shortcut 写入未执行的成功记录。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | CLI shortcut + core task start reuse | 本 L1 confirmed | P1 |
| Phase 2 | README/Agent guidance 同步 | Phase 1 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| L3 confirm/create/start shortcut | Phase 1 | 1 |
| 文档与 Agent guidance 更新 | Phase 2 | 0-1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 与现有 `task run` 重叠 | 用户入口更多 | 设计明确推荐唯一主路径，保留 alias/compat |
| 破坏 draft task 用法 | 高级脚本受影响 | 新行为放在新参数或新命令，默认兼容 |
| 自动启动隐藏 task id | 用户无法追踪 | 输出 task id、status、next command |

## 关联

- references: workflow-surface-simplification-L2.4 — 已有 L3 Confirm and Run Shortcut Design。
- references: workflow-surface-simplification-L3.4.1 — Task Run Core and CLI。
- references: workflow-surface-simplification-L3.4.2 — Task Run Guidance and Compatibility。
