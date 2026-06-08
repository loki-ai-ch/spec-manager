---
code: l3-approval-L2.1
level: L2
title: 技术方案：L3 单次批准冻结流程
topic: l3-approval
parentCode: l3-approval-L1
status: implemented
created: '2026-06-08T02:48:53.916Z'
updated: '2026-06-08T03:12:20.967Z'
aiSummary: >-
  通过 L3 draft 直接进入 frozen 实现单次批准；保留 confirmed 状态和历史 confirmed L3 兼容，同步
  CLI、flow、规则、文档和 agent 入口
changeSummary: frozen → implemented
---
# 技术方案：L3 单次批准冻结流程 — 技术设计

## 方案概述

本方案把“用户批准 L3”从两步状态推进改为一步：当 L3 处于 `draft` 时，用户批准入口直接把目标状态设置为 `frozen`；L1/L2 仍保持 `draft -> confirmed`。底层状态枚举保留 `confirmed`，用于历史 L3 兼容、重审回退和显式冻结入口。

```
[user approval signal]
  ├─ L1/L2 draft ──> confirmed ──> create child spec
  ├─ L3 draft  ────> frozen ─────> task create
  └─ L3 confirmed ─> frozen ─────> task create

[docs/rules/templates] ──sync──> one-approval L3 guidance
[tests] ────────────────verify─> CLI + flow + agent entry consistency
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| L3 单次批准落点 | A: L3 `draft -> frozen` B: L3 `draft -> confirmed` 后自动 freeze C: task create 接受 confirmed | A | 目标是一次批准后可执行；不放宽 R3，也不制造隐藏二次状态变更 |
| 状态机变更范围 | A: 允许 `draft -> frozen` 转换 B: 删除 confirmed 状态 C: 新增 approved 状态 | A | 最小改动，保留历史 confirmed L3 与现有 frozen/implemented 语义 |
| CLI 主入口 | A: `spec confirm <L3>` 和快捷 `approve <L3>` 都直接 frozen B: 只改 approve C: 新增 `spec approve` | A | 用户批准信号在两个现有入口中都应一致，避免继续产生新的 confirmed L3 |
| 历史 confirmed L3 | A: 保留 `spec freeze` 与 `approve` 到 frozen B: 自动批量冻结 C: 迁移为 draft | A | 兼容且不替用户做审核结论 |
| 文档同步方式 | A: 更新规则、README、skill、agent templates B: 只改 CLI help C: 只改 AGENTS.md | A | 该项目依赖多工具入口，流程规则必须一致 |
| L3 裂变方式 | A: 单个 L3 覆盖行为、文档、测试 B: 拆两个 L3 C: 直接并入 workflow-hardening | A | 范围集中，跨模块但同一流程目标，适合一个 L3 执行 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/status.ts` | 修改 | 允许 `draft -> frozen` 状态转换；注释更新为 L3 单次批准语义 | 单元测试覆盖 draft 到 frozen 可达 |
| `src/cli/spec.ts` | 修改 | `spec confirm <L3 draft>` 解析为目标 frozen；L1/L2 仍 confirmed；placeholder 检查覆盖 frozen | CLI 测试覆盖 L3 confirm 一步 frozen 和 L1/L2 confirm |
| `src/cli/usability.ts` | 修改 | `approve <L3 draft>` 目标改为 frozen；描述文案更新 | CLI 测试或核心测试覆盖 approve 目标状态 |
| `src/core/usability.ts` | 修改 | flow/guide 对 draft L3 的 next action 表达为一次批准后 frozen；confirmed L3 仍提示兼容 freeze | usability 测试覆盖 next action |
| `rules/flow-control.md` | 修改 | R2/R3/R4 文案改为 L3 一次人工批准后 frozen | 模板包含性测试 |
| `README.md` | 修改 | 快速流程、命令表、示例中的 L3 双批准描述更新 | 文档包含性测试或 rg 检查 |
| `skill/SKILL.md` 与 `skill/subskills/impl.md` | 修改 | skill 流程改为 L3 一次批准冻结 | 模板包含性测试 |
| `templates/agents/*` | 修改 | Claude/Codex/OpenCode/CodeBuddy/Cursor/Windsurf 入口规则同步 | agents 测试覆盖关键语句 |
| `src/core/__tests__/status.test.ts` | 修改 | 状态机期望更新 | 单元测试 |
| `src/cli/__tests__/*`、`src/core/__tests__/usability.test.ts` | 修改 | 覆盖新批准流程与历史 confirmed L3 兼容 | CLI/core 测试 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| SpecStatus | `draft` | enum state | 允许新增目标 `frozen` | 无 | 是 |
| SpecStatus | `confirmed` | enum state | 保留，用于 L1/L2、历史 L3、重审 | 无 | 是 |
| SpecStatus | `frozen` | enum state | 作为 L3 一次批准后的执行态 | 无 | 是 |
| Audit hit | R2/R9 | existing record | 状态推进仍记录审核与状态命中 | 无 | 是 |

## 接口契约

### CLI: `spec-manager spec confirm <code>`

**请求**:
```bash
spec-manager spec confirm auth-L3.1.1-login
```

**成功输出**:
```text
✓ auth-L3.1.1-login: draft → frozen
Next: spec-manager task create auth-L3.1.1-login --plan ./plan.json
```

**层级规则**:

| 输入状态 | 层级 | 目标状态 |
|---|---|---|
| draft | L1/L2 | confirmed |
| draft | L3 | frozen |
| confirmed | L3 | frozen |

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 1 | SPEC_NOT_FOUND | code 不存在 |
| 2 | PLACEHOLDER_CONTENT | 正文仍是占位 |
| 2 | INVALID_TRANSITION | 当前状态不能进入目标状态 |

### CLI: `spec-manager approve <code>`

**请求**:
```bash
spec-manager approve auth-L3.1.1-login
```

**成功输出**: 与 `spec confirm` 的目标状态规则一致；L3 draft 直接进入 frozen。

### CLI: `spec-manager spec freeze <code>`

**请求**:
```bash
spec-manager spec freeze auth-L3.1.1-login
```

**成功输出**: 保留用于历史 confirmed L3；draft L3 推荐使用 `spec confirm` 或 `approve`，是否允许 `freeze` 直接处理 draft 由 L3 实施时按兼容策略确定，但不得绕过 placeholder 校验。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| 历史 L3 已是 confirmed | 仍不能创建 task | `approve` 或 `spec freeze` 推进到 frozen | 用户执行一次状态推进 |
| L3 正文仍是 placeholder | 不能冻结 | R22 继续阻断并提示 update | 写入正文后重试 |
| 用户误用 `spec freeze` 处理 draft L1/L2 | 状态语义错误 | 保持状态机限制，仅 L3 可进入 frozen | 改用 `spec confirm` |
| 文档残留双批准描述 | AI 继续按旧流程操作 | 增加关键短语测试和 rg 检查 | 同步模板后重跑测试 |

## 向后兼容

- **CLI**: `spec validate`、`task create`、`task complete` 行为不放宽；`spec freeze <confirmed L3>` 保留。
- **数据**: 不迁移历史 spec 文件；已有 `confirmed` L3 可继续推进。
- **规则**: 人工审核门禁保留，只减少 L3 对同一正文的重复批准。
- **任务**: Agent Task 仍只接受 frozen L3。

## 关键交互流程

### 新 L3 批准

```
用户审核 L3 正文
  └─ 明确批准
      └─ spec confirm / approve
          ├─ 校验正文非 placeholder
          ├─ level=L3 且 status=draft
          └─ update status=frozen
```

### 历史 confirmed L3 收尾

```
flow status 发现 confirmed L3
  └─ Next: spec freeze 或 approve
      └─ update status=frozen
```

### L1/L2 不变

```
用户审核 L1/L2
  └─ spec confirm / approve
      └─ update status=confirmed
```

## 可观测性

- **日志**: 状态推进输出必须显示真实转换，例如 `draft → frozen`。
- **指标**: 无 telemetry；通过 `spec list --level L3 --status confirmed` 观察历史停留数量。
- **告警**: 不新增运行时告警；R22 和状态非法错误继续使用 CLI 错误输出。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| 状态机 | `src/core/status.ts` | `canTransition`、`nextStatuses` | 允许 L3 单次批准目标 |
| Spec 写入 | `src/core/spec-io.ts` | `updateSpec`、`findSpecByCode`、`isPlaceholderContent` | 状态推进与 R22 校验 |
| 流程建议 | `src/core/usability.ts` | `suggestAfterSpecCommand`、`suggestNextActionForTopic` | 输出新 next action |
| 快捷批准 | `src/cli/usability.ts` | `approve` command | 统一批准入口 |
| Spec CLI | `src/cli/spec.ts` | `confirm`、`freeze` command | 主状态推进入口 |
| Agent 模板元数据 | `src/core/agents.ts` | `AGENT_PROVIDER_INFO` | 模板覆盖测试入口 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `l3-approval-L3.1.1-single-freeze` | CLI 状态推进、flow/guide 提示、规则/README/skill/agent 入口同步、测试覆盖 | `l3-approval-L2.1` frozen |

## 关联

- 父 L1: `l3-approval-L1`（L3 一次人工批准后直接进入 frozen）
