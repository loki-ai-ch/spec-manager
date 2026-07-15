---
code: workflow-surface-simplification-L2.1
level: L2
title: Core Quick Path and Workflow Surface Design
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L1
status: implemented
aiSummary: >-
  设计第一阶段 workflow surface：新增 next、brief、dashboard 三个只读/短路径入口，收敛
  guide/assist/flow/view 的高频职责，复用现有状态机和 Agent Brief 能力，不改变 spec/task 数据模型。
relations:
  - type: based_on
    target: workflow-surface-simplification-L1
created: '2026-07-15T02:18:07.850Z'
updated: '2026-07-15T02:29:47.312Z'
changeSummary: 'cascade: task-complete'
---
# Core Quick Path and Workflow Surface Design

## 背景

`workflow-surface-simplification-L1` 要求在不削弱治理门禁的前提下降低 spec-manager 的上手门槛。当前入口已经覆盖完整能力，但用户和 Agent 需要在 `guide`、`assist guide`、`flow status`、`view`、`project status`、`spec`、`task` 之间判断应该用哪一个。这个设计聚焦第一阶段：不改变数据模型和状态机，先建立一个更短、更稳定的核心入口层。

本设计不处理 external specs root/store。该方向需要独立处理路径解析和写入边界，后续应拆成单独设计。

## 目标

- 提供一个 core quick path 命令面，作为新用户和 Agent 的默认入口。
- 将 `guide`、`assist guide`、`flow status`、`view` 的高频职责收敛到更少的概念。
- 保持现有命令兼容，避免破坏已有 README、agent assets 和用户脚本。
- 让快捷入口输出可解释的下一步，并暴露底层真实命令。
- 为后续 external specs root/store 和 UX profile 预留输出结构。

## 范围边界

本设计覆盖 CLI 命令面、core 输出模型、text/json presenter、agent guidance 和 README 入口。它不改变 spec 文件格式、Task JSON 格式、审核状态机、verification 规则或 adaptive workflow 语义。

旧命令不删除；新入口优先作为 alias/facade 调用既有 core 能力。后续版本可以在文档中降低旧命令显著程度，但不能在本阶段移除。

## 方案概述

新增一个轻量的 workflow surface 层，提供三个核心动作：

- `spec-manager next [request...]`: 读取项目状态、可选请求文本和 topic，输出当前最安全下一步。
- `spec-manager brief [request...]`: 生成面向 Agent 的上下文 brief，作为 `assist brief` 的短别名和更清晰入口。
- `spec-manager dashboard`: 输出项目级/主题级摘要，作为 `flow status` 与非交互 `view` 的统一首屏。

保留现有命令：

- `spec-manager guide` 继续存在，但 README 和 agent guidance 推荐 `next`。
- `spec-manager assist guide` 继续作为高级上下文入口，内部可以复用 `next` 的输出模型。
- `spec-manager flow status` 继续作为按 topic 展示完整链路的 advanced 命令。
- `spec-manager view` 继续保留交互式浏览定位。

## 技术决策

- 新增命令采用 facade 方式接入 CLI，底层复用现有 `getFlowStatus`、`runProjectDoctor`、`renderRichGuide`、Agent Brief 和 view model 能力。
- 新增 core projection 必须是只读函数，不写入 spec、task、audit 或 config。
- text presenter 面向人读，json presenter 面向 Agent 读；二者基于同一 core projection，避免输出语义分叉。
- `brief` 优先复用现有 Agent Brief 逻辑，不复制 Design Context、lessons、acceptance 相关规则。
- `dashboard` 只提供摘要和阻塞点，不替代 `flow status` 的完整链路输出和 `view` 的交互浏览。

## 受影响模块

- `src/cli/usability.ts`: 可承载 `next`、`brief`、`dashboard` 命令注册，或拆出新的 workflow-surface CLI 文件后在入口注册。
- `src/core/usability.ts`: 当前已有 flow、guide、doctor 和 next action 推断，可抽取共享 projection。
- `src/cli/capability.ts`: `assist brief` 的实现应被 `brief` 复用，避免双写。
- `src/core/guided-assist.ts` 与相关 brief 能力：作为 `brief` 的底层上下文来源。
- `src/core/view.ts`: dashboard 可复用 topic/task summary 聚合。
- `templates/agents/*` 与 `.agents/skills/spec-manager/SKILL.md`: 默认 guidance 应推荐 core quick path。
- `README.md`、`readme_en.md` 和相关 docs：onboarding 入口需要同步更新。

## 接口契约

新增 CLI 命令契约：

- `spec-manager next [request...] [--topic <topic>] [--json]`
- `spec-manager brief [request...] [--json]`
- `spec-manager dashboard [--topic <topic>] [--json]`

`next --json` 必须输出单个 JSON 对象，不混入其它 stdout 文本。建议字段：

- `projectRoot`: resolved project root。
- `request`: 用户输入请求；无输入时为空字符串。
- `topic`: 推断或显式 topic；无法推断时为 null 或 `<topic>`，具体由实施规格固定。
- `status`: 机器可读状态，例如 `not_initialized`、`blocked_by_doctor`、`needs_l1`、`needs_spec_update`、`needs_user_approval`、`ready_for_task`、`task_running`。
- `blockingReason`: 可选阻塞原因。
- `nextAction`: 推荐下一条命令或说明。
- `suggestedCommands`: 辅助命令数组。
- `warnings`: 非阻塞提示数组。

所有新增命令默认不得执行写操作。若未来引入可写快捷命令，必须另开规格并重新定义审核边界。

## 命令设计

### next

`spec-manager next [request...] [--topic <topic>] [--json]`

职责：

- 检查是否 initialized。
- 检查 blocking doctor 项。
- 推断或读取 topic。
- 汇总当前 topic 的规格、任务和阻塞点。
- 输出一个 primary next action，以及可选 suggested commands。

text 输出建议：

```text
Project: spec-manager
Root: /path/to/repo
Request: add auth
Topic: auth
Status: blocked_by_draft_spec
Next:
  spec-manager spec update auth-L1 --content ./draft.md --ai-summary "..." --change-summary "..."
Why:
  auth-L1 is draft with placeholder content.
```

json 输出建议：

```json
{
  "projectRoot": "/path/to/repo",
  "request": "add auth",
  "topic": "auth",
  "status": "blocked_by_draft_spec",
  "blockingReason": "auth-L1 has placeholder content",
  "nextAction": "spec-manager spec update auth-L1 --content ./draft.md --ai-summary \"...\" --change-summary \"...\"",
  "suggestedCommands": [
    "spec-manager flow status --topic auth",
    "spec-manager spec show auth-L1"
  ]
}
```

### brief

`spec-manager brief [request...] [--json]`

职责：

- 为 Agent 生成实施前上下文。
- 默认复用 `assist brief --request` 的核心能力。
- 对 UI 请求继续注入 Design Context。
- 在输出中包含 `next` 的 primary action，避免 Agent 看完 brief 后不知道下一步。

兼容策略：

- `spec-manager assist brief --request "<request>"` 保持可用。
- `spec-manager brief "<request>"` 是推荐入口。

### dashboard

`spec-manager dashboard [--topic <topic>] [--json]`

职责：

- 输出项目级状态摘要。
- 汇总 active topics、draft specs、frozen specs without task、running tasks、failed/waiting tasks、doctor warnings。
- 对单 topic 展示当前链路和 next action。

兼容策略：

- `flow status` 保持完整链路输出。
- `view` 保持交互式浏览。
- `dashboard` 面向快速判断和 Agent 读取。

## Core 模型

建议新增或抽取 `src/core/workflow-surface.ts`，定义稳定的只读 projection：

```ts
interface WorkflowNextAction {
  projectRoot: string;
  request: string;
  topic: string | null;
  status: string;
  blockingReason?: string;
  nextAction: string;
  suggestedCommands: string[];
  warnings: string[];
}

interface WorkflowDashboard {
  projectRoot: string;
  initialized: boolean;
  topics: WorkflowTopicSummary[];
  activeTaskCount: number;
  draftSpecCount: number;
  warnings: string[];
}
```

该模型只读，不写 spec/task/audit。写操作仍由现有 `spec`、`task`、`project` 命令执行。

## 映射关系

- 未初始化：`next` 指向 `spec-manager project init --name <project-name>`。
- doctor blocking：`next` 指向对应修复命令。
- 无 topic：从 request 推断 topic；无法推断时返回占位 `<topic>` 和创建 L1 的建议。
- topic 无规格：指向创建 L1。
- draft 占位规格：指向 `spec update`。
- draft 非占位规格：指向等待用户确认和 `spec confirm`。
- 已确认规格缺少后续规格：指向创建下一层规格。
- frozen 实施规格无任务：指向 `task create`。
- running task：指向 `task step` 或 `assist next`。
- waiting/failed task：输出阻塞原因和恢复建议。
- 已完成链路：输出 `No immediate action` 和 dashboard/decision 建议。

## Agent Guidance

Agent 入口文件应把默认路径改为：

1. 对新需求先运行 `spec-manager next "<request>"` 或 `spec-manager brief "<request>"`。
2. 如果需要写 spec，按 next action 创建/更新 spec，写完停下等用户确认。
3. 如果进入执行，必须读取 frozen 实施规格并创建/启动任务。
4. 最终交付前仍使用 acceptance/delivery 能力。

这样可以减少 Agent 直接从用户请求跳到完整手写命令链的概率。

## 兼容性

- 新命令不改变现有 command behavior。
- `guide`、`assist guide`、`assist brief`、`flow status`、`view` 不删除。
- README 可以把旧命令放到 advanced 区域。
- `--json` 输出应保持单对象 stdout，方便 Agent 消费。

## 验收标准

1. **AC-1**: 用户 MUST 能通过 `spec-manager next "<request>"` 获得一个 primary next action 和原因说明。
2. **AC-2**: `next --json` MUST 输出包含 `projectRoot`、`topic`、`status`、`nextAction` 和 `suggestedCommands` 的单个 JSON 对象。
3. **AC-3**: `brief` MUST 复用现有 Agent Brief 能力，并在输出中包含当前 next action。
4. **AC-4**: `dashboard` MUST 汇总项目或 topic 状态，并能暴露阻塞点和下一步。
5. **AC-5**: 新入口 MUST NOT 创建、确认、冻结或完成任何规格/任务；它们只读或委托用户显式执行现有写命令。
6. **AC-6**: README 和 agent templates MUST 推荐 core quick path，同时保留 advanced 命令说明。
7. **AC-7**: 现有 `guide`、`assist guide`、`flow status` 和 `view` 行为 MUST 保持兼容。

## 风险

- 如果 `next` 只是包装旧提示而没有统一模型，会继续造成入口分裂。
- 如果 `dashboard` 太详细，会变成另一个 `flow status`；应保持摘要化。
- 如果 `brief` 和 `assist brief` 输出不一致，Agent 会困惑；应尽量共享 core。
- 后续 external specs root/store 会影响 `projectRoot` 字段语义，因此输出模型要预留 root 类型扩展。

## L3 裂变计划

- L3.1.1: Workflow Surface Core Projection
- L3.1.2: next / dashboard CLI
- L3.1.3: brief Alias and Agent Guidance
- L3.1.4: README Onboarding Surface Refresh
