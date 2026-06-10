---
name: spec-manager
description: "Spec-driven project iteration workflow — L1 PRD → L2 Design → L3 Impl → Agent Task → Deploy, with human review gates at each layer. Pure local markdown storage, no MCP, no network. Use when the user invokes /spec-manager or asks for: new feature/PRD, technical design, implementation spec, agent task, iteration plan, test plan, release notes, runbook, postmortem, or ADR."
argument-hint: "<需求描述> | run <taskId>"
---

# spec-manager — 本地项目迭代全链路

PRD → Design → Spec → Agent Task → 部署。**纯本地**，所有数据落 markdown + git。

## 用法

- `/spec-manager <需求>` — 从需求开始走完整链路
- `/spec-manager run <taskId>` — 执行已有 Agent Task

## 入口路由

收到 `/spec-manager <用户输入>` 时，按下表匹配子 skill；不确定时用当前工具的用户提问能力澄清。关键词重叠按 # 小者优先。

| # | 关键词 | 子 skill | 产出 |
|---|---|---|---|
| 1 | 修 typo / 改一行 / 改 log level | [subskills/quick.md](subskills/quick.md) | quick |
| 2 | 查 / 看 / 列 / 统计 / 搜索 | [subskills/research.md](subskills/research.md) | (只读) |
| 3 | 需求 / 新功能 / 痛点 / 用户故事 | [subskills/prd.md](subskills/prd.md) | L1 |
| 4 | 技术方案 / 架构 / 接口设计 | [subskills/design.md](subskills/design.md) | L2 |
| 5 | 实施 / 编码 / planJson | [subskills/impl.md](subskills/impl.md) | L3 |
| 6 | 计划 / 里程碑 / 排期 | [subskills/plan.md](subskills/plan.md) | plan |
| 7 | 测试方案 / QA / 测试用例 | [subskills/testplan.md](subskills/testplan.md) | testplan |
| 8 | 发布 / changelog / release | [subskills/release.md](subskills/release.md) | release |
| 9 | 运维手册 / oncall | [subskills/runbook.md](subskills/runbook.md) | runbook |
| 10 | 复盘 / postmortem / RCA | [subskills/postmortem.md](subskills/postmortem.md) | postmortem |
| 11 | ADR / 为什么选 X | [subskills/adr.md](subskills/adr.md) | decision |
| 12 | delta / change / 增量 | [subskills/change.md](subskills/change.md) | change |

**消歧规则**: 关键词重叠时小 # 优先；看不懂意图不要猜，先问用户；2 次仍无法定位则停止走 /spec-manager。

## 方法论

| 层 | 产物 | 核心约束 |
|---|---|---|
| L1 PRD | 需求文档 | 新功能必须先写 |
| L2 Design | 技术设计 | confirmed 才能进实施 |
| L3 Impl | 实施规格 | ≤20 步，frozen 后建 Task |

## Unified Rules

- Feature work MUST go through `spec-manager`.
- New or non-trivial work follows L1 -> L2 -> L3 -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval (an explicit user approval) advances `draft -> frozen`.
- Before code edits, read the frozen L3 spec and create/start an Agent Task.
- planJson `coveredSpecs` MUST include the current L3 specCode.
- Validate L3 markdown plans with `spec-manager spec validate-plan --from-spec <L3-code>`.
- Record execution with `spec-manager task step`; finish with `spec-manager task complete`.
- ALL spec/task operations MUST go through `spec-manager` CLI. Never write raw markdown to spec files or JSON to task files — raw writes bypass status machine, audit hits, and cascade logic.
- Before marking any L3 as implemented, an Agent Task MUST be created and completed via `spec-manager task create/start/step/complete`. Direct `spec implement` is forbidden for L3 (R3).
- After creating any spec, establish relations: `spec-manager spec add-relation <code> --type based_on --target <parentCode>`. L3 MUST have at least `based_on` to its parent L2.

## 规则（24 条，按 applies_to 过滤）

| 主题 | 规则 | 文件 |
|---|---|---|
| 流程控制 | R1-R4 停下审核/状态归用户/frozen 才建 Task | [rules/flow-control.md](../rules/flow-control.md) |
| 质量门禁 | R5/R6/R10/R15/R18 不跳步/planJson 校验 | [rules/quality-gate.md](../rules/quality-gate.md) |
| 文档治理 | R7/R11/R13/R14/R16-R22 层级绑定/aiSummary | [rules/doc-governance.md](../rules/doc-governance.md) |
| 代码纪律 | R8/R9/R12 改代码前自检 | [rules/code-discipline.md](../rules/code-discipline.md) |
| 代码调查 | R23 Spec 前必须基于实际代码 | [rules/codebase-survey.md](../rules/codebase-survey.md) |
| Delta | R24 delta 必须含 proposal | [rules/delta.md](../rules/delta.md) |

## Spec 状态流

```
L1/L2: draft → confirmed
L3:    draft → frozen → implemented
        AI agent  用户批准    task_complete cascade
  ⚠️ L3 没有 `confirmed` 状态。`spec confirm <L3>` 直接进入 `frozen`。
  ⚠️ 禁止绕过 CLI — 直接写文件会跳过 frozen 强制校验。
```

## CLI 概要

`spec-manager <command> --help` 查看完整用法。主要命令组：

- `project init|status` — 初始化/总览
- `spec new|list|show|update|confirm|freeze|implement|validate|add-relation` — Spec CRUD
- `task create|start|step|complete|fail|wait|show|list` — Agent Task
- `decision create|list|show|update|set-partial|supersede` — 决策卡片
- `change new|archive|list|show` — Delta spec
- `incident new|list` — 事故记录
- `audit hit|report|show` — 规则审计

### Relations 工作流

创建 spec 后立即建立关联：
```bash
spec-manager spec add-relation <code> --type based_on --target <parentCode>
spec-manager spec add-relation <code> --type references --target <relatedCode>  # 若有跨 spec 引用
```
L3 必须有至少一条 `based_on` 关联指向父 L2。L1/L2 关联可选但推荐。

## 数据布局

```
<project>/
├── .spec-manager/                # config + audit + incidents
├── specs/<topic>/                # spec 平铺（点分编号自文档化层级）
│   ├── <topic>-L1.md            # 如 auth-L1.md
│   ├── <topic>-L2.1.md          # 如 auth-L2.1.md
│   ├── <topic>-L3.1.1[-desc].md # 如 auth-L3.1.1-jwt.md
│   ├── decisions/               # 决策卡片（topic 级别）
│   └── tasks/                   # Agent Task（topic 级别）
│       └── <specCode>-<taskId>.json
├── changes/<name>/              # delta 提案
└── archive/<name>/              # 已合并 change
```

**文件命名规则**：`<topic>-L<level>[.<序号>][.<序号>][-desc].md`，点分编号自文档化层级关系，topic 前缀必填。必须通过 CLI 命令创建，不要用 Write 工具直接写文件。

违反任一规则视为流程事故，参照 `.spec-manager/incidents/_TEMPLATE.md` 记录。
