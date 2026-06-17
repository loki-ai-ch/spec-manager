---
code: ai-capability-compensation-L1
level: L1
title: AI 能力补偿层
topic: ai-capability-compensation
parentCode: null
status: implemented
aiSummary: >-
  将 spec-manager 从流程治理工具升级为 AI 能力补偿层：通过 Agent Brief、Spec Critic、Task Next/Drift
  与 Acceptance Report 抹平不同模型的工程交付差距。
created: '2026-06-17T03:37:21.776Z'
updated: '2026-06-17T04:00:00.516Z'
changeSummary: 'cascade: task-complete'
---
# AI 能力补偿层 — 需求文档

## 背景

spec-manager 当前已经提供本地优先的规格驱动开发流程：L1 PRD、L2 Design、L3 Impl、Agent Task、Decision、Audit、Verification、Evidence 和多 Agent 入口分发。已有能力能把 AI 编码从一次性提示推进为有状态、有门禁、有证据的工程流程。

但项目的下一阶段价值不应只停留在“让 Agent 遵守流程”。用户真正需要的是：无论使用 Claude Code、Codex、CodeBuddy、Cursor、Windsurf、MiMo-Code，或者不同能力等级的大模型，都能在同一项目中获得接近的工程交付质量。

不同模型之间的差距通常表现为：

1. **上下文能力差距**：弱模型更容易漏读历史 spec、decision、task、失败记录和相关源码入口，导致重复决策或偏离项目约束。
2. **计划能力差距**：弱模型更容易直接进入实现，或者写出缺少验收、边界、风险、回滚和验证命令的 L2/L3。
3. **执行能力差距**：执行过程中容易忘记 frozen L3、失败后盲改、跳过未完成步骤，或者让实际 diff 偏离实施契约。
4. **验收能力差距**：模型常把“测试跑过”表达为“功能完成”，但用户仍无法判断 AC 是否被真实证据覆盖，哪些仍需要人工验收。
5. **经验迁移差距**：新会话、新模型和新成员难以继承项目历史失败、决策理由和已验证模式。

因此，spec-manager 下一阶段应被定位为 **AI 能力补偿层**：把优秀工程师或强模型通常会隐式完成的上下文整理、方案审查、执行导航、偏差检测、证据验收和经验复用，产品化为本地确定性的 CLI 能力。系统不宣称提升模型本身能力，而是通过外部脚手架降低模型能力差异对交付结果的影响。

## 问题归类

| 类别 | 问题描述 | 优先级 | 现有基础 |
|---|---|---|---|
| 上下文补偿 | rich guide 已能输出结构化信息，但还不能稳定打包相关历史、源码入口、失败记录和约束摘要 | P1 | `guide --format rich`、ProjectSnapshot、decision/task/spec 读取能力 |
| 计划补偿 | L1/L2/L3 有模板和 validate，但缺少面向质量的 spec critique，无法系统指出冻结前缺口 | P1 | spec validate、critical readiness、模板 |
| 执行补偿 | Task 有步骤和 verification，但缺少 `task next` 式导航和 actual diff 对 L3 的偏差检查 | P1 | task context/report/verify、change propose、task evidence |
| 验收补偿 | evidence 能投影关键 AC 覆盖，但尚未形成面向用户的完整 acceptance report 和人工验收边界 | P1 | task evidence、governed coverage gate、verification artifacts |
| 经验补偿 | decision、incident、failed task 存在，但没有形成 lesson 聚合和 guide 注入 | P2 | decision、incident、audit、task history |
| 跨 Agent 一致性 | 多 Agent 入口已分发，但不同 Agent 消费到的任务启动上下文仍可能不一致 | P2 | project agents、AGENTS/skill 模板 |

## 用户故事

### Must have

- As a **使用不同 AI 编码工具的开发者**, I want **spec-manager 为同一请求生成稳定的 Agent Brief**, so that **不同模型都能拿到相同的关键上下文、约束、历史和下一步**。
- As a **项目维护者**, I want **在 L1/L2/L3 冻结或确认前获得结构化 critique**, so that **低质量 spec 不会只因格式正确而进入执行阶段**。
- As a **执行中的 Agent**, I want **通过 `task next` 获取当前任务的下一步、未完成步骤、失败摘要和未覆盖 AC**, so that **我不依赖记忆也能继续正确执行**。
- As a **验收者**, I want **查看面向交付的 Acceptance Report**, so that **我能区分已机器验证、失败、未覆盖和需要人工验收的部分**。

### Should have

- As a **项目维护者**, I want **检测 actual diff 是否偏离 frozen L3**, so that **Agent 不会在执行中悄悄扩大范围或修改未授权文件**。
- As a **新会话或新模型**, I want **自动获得相关 lessons**, so that **我能继承历史失败、决策理由和项目习惯**。
- As a **团队负责人**, I want **比较启用能力补偿前后的缺口数量、验证覆盖和返工情况**, so that **能判断这套流程是否真的降低模型能力差距**。

### Could have

- As a **高级用户**, I want **把 Agent Brief、Critique、Acceptance Report 输出为 JSON**, so that **外部 harness 或 CI 能稳定消费这些结果**。
- As a **团队负责人**, I want **为不同风险 Profile 配置不同 critique 强度**, so that **低风险工作保持轻量，高风险工作接受更严格审查**。

## 功能目标

| 能力 | 现状 | 目标 |
|---|---|---|
| Agent Brief | rich guide 提供通用上下文，但不保证覆盖相关历史与源码入口 | 单一命令输出任务启动包，包含 spec、decision、task、lesson、源码入口、风险和下一步 |
| Spec Critic | validate 偏格式与规则提示，readiness 聚焦关键 AC | 对 L1/L2/L3 分层输出质量缺口、风险缺口、验收缺口和冻结阻塞建议 |
| Task Next | task 状态可查，但下一步由 Agent 自己推断 | 输出确定性下一动作、未完成计划、失败摘要、未覆盖 AC 和建议验证 |
| Drift Check | change propose 可表达偏差，但缺少执行期 diff 对 L3 的直接检查 | 检查实际改动路径、行为和验证是否偏离 frozen L3 的实施契约 |
| Acceptance Report | task evidence 偏结构化证据投影 | 面向用户生成验收报告，明确机器证据、人工验收项和剩余风险 |
| Lessons | 历史 task/decision/incident 分散查看 | 聚合相关经验并注入 guide/brief，帮助新模型继承项目记忆 |

## 验收标准

1. **AC-1**: **Given** 一个已初始化且存在历史 spec/decision/task 的项目，**When** 用户为请求生成 Agent Brief，**Then** 系统 **SHALL** 输出请求摘要、推荐 topic/profile、相关 spec、相关 decision、相关 task、风险提示、建议读取文件和下一条命令。
2. **AC-2**: **Given** 一个 L1/L2/L3 draft spec，**When** 用户运行 Spec Critic，**Then** 系统 **SHALL** 按层级输出缺失或薄弱的目标、边界、接口、风险、验收、验证和回滚信息，并区分 blocking、warning 与 advisory。
3. **AC-3**: **Given** 一个 running Task，**When** 用户运行 Task Next，**Then** 系统 **SHALL** 输出当前状态、下一计划步骤、未完成步骤、最近失败摘要、未覆盖关键 AC 和建议 verification。
4. **AC-4**: **Given** 一个绑定 frozen L3 的 Task 且工作区存在代码变更，**When** 用户运行 Drift Check，**Then** 系统 **SHALL** 报告变更文件是否落在 L3 声明范围内，并对未声明路径或无法关联的行为给出风险提示。
5. **AC-5**: **Given** 一个存在 verification 的 Task，**When** 用户生成 Acceptance Report，**Then** 系统 **SHALL** 展示每个关键 AC 的覆盖状态、成功/失败 verification、artifact、未覆盖项和需要人工验收的事项。
6. **AC-6**: **Given** 同一项目中存在 decision、incident 或 failed task，**When** 用户生成 Agent Brief，**Then** 系统 **SHOULD** 注入与当前 topic 或请求相关的 lessons，并明确这些 lessons 的来源。
7. **AC-7**: **Given** 用户使用任一受支持 Agent 入口，**When** agent 指令要求开始非平凡工作，**Then** 指令 **SHOULD** 引导优先生成或读取 Agent Brief，而不是只依赖模型自行搜索。
8. **AC-8**: **Given** 能力补偿命令无法可靠判断语义相关性，**When** 输出结果，**Then** 系统 **MUST** 明确标记为 advisory，不得伪装成 hard gate。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| Agent 开工前手动读取次数 | 当前依赖 Agent 自行读取 README、skill、spec、decision、task | Agent Brief 场景减少到 ≤2 次额外读取 | 记录一次标准功能流程中的 CLI/文件读取次数 |
| Spec 冻结前质量缺口可见率 | 缺口主要靠人工审阅发现 | Critic 对 L1/L2/L3 必填质量维度 100% 给出结果 | 单元测试 fixture + 人工抽样 |
| Task 续跑正确性 | 续跑依赖 Agent 记忆和 task show | Task Next 能覆盖当前状态、失败摘要、未完成步骤和未覆盖 AC | CLI 测试断言输出字段 |
| Drift 风险可见率 | 当前没有执行期统一报告 | 未声明路径变更 100% 出现在 drift 报告中 | 临时 git fixture 测试 |
| 验收可读性 | 用户需分别读取 task evidence/spec/task | Acceptance Report 单份报告覆盖 AC、verification、artifact、人工项 | CLI 测试和 README 示例 |
| 历史经验复用 | 需手动查 decision/incident/task | 相关 lesson 在 brief 中可见并带来源 | fixture 测试 |

## 范围边界

- **做**：
  - Agent Brief：面向模型的任务启动包。
  - Spec Critic：面向确认/冻结前的分层质量审查。
  - Task Next：面向执行续跑的确定性下一步导航。
  - Drift Check：面向 frozen L3 与实际 diff 的偏差提示。
  - Acceptance Report：面向用户验收的证据报告。
  - Lessons：从本地 decision、incident、failed task 中提取相关经验并注入 brief。
  - 多 Agent 指令更新：引导 Agent 使用能力补偿命令。

- **不做**：
  - 不引入云服务、遥测、远端数据库或 MCP 依赖。
  - 不使用大模型 API 自动判断 spec 质量或业务正确性。
  - 不把 advisory 结果伪装成 hard gate。
  - 不替代人工产品验收、风险接受和真实环境验证。
  - 不破坏现有 L1/L2/L3/Task 生命周期和已发布 CLI 语义。

- **推迟**：
  - 组织级策略分发。
  - 基于嵌入模型或语义索引的相似历史检索。
  - Web UI 或 TUI 仪表盘。
  - CI 强制执行所有能力补偿检查。

## 设计原则

1. **补偿模型而非信任模型** — 新能力必须把关键判断外显为本地事实、规则、证据或 advisory，不依赖模型自评。
2. **上下文先于执行** — 非平凡工作进入实现前应优先生成或读取 Agent Brief，减少模型自行搜索造成的遗漏。
3. **质量审查分层** — L1、L2、L3 的 critique 维度必须不同，不能用一套通用文案替代分层审查。
4. **证据不夸大** — Acceptance Report 只能说明已记录证据覆盖了什么，不能宣称真实业务结果已自动通过。
5. **兼容优先** — 新命令默认只读或 advisory，除未来明确规格另行定义外，不改变现有完成门禁。
6. **本地可复现** — 所有报告必须只依赖仓库、本地 spec-manager 文件和 git 工作区状态。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Agent Brief 与 Lessons 注入 | 现有 rich guide、spec/task/decision 读取能力 | P1 |
| Phase 2 | Spec Critic | 现有 templates、validate、readiness 能力 | P1 |
| Phase 3 | Task Next 与 Drift Check | 现有 task context/evidence、git diff 读取 | P1 |
| Phase 4 | Acceptance Report 与多 Agent 指令更新 | 现有 task evidence、project agents | P1 |
| Phase 5 | 度量与效果报告 | Phase 1-4 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Agent Brief / Lessons 产品设计 | Phase 1 | 1 |
| Spec Critic 分层审查设计 | Phase 2 | 1 |
| Task Next / Drift Check 执行补偿设计 | Phase 3 | 1 |
| Acceptance Report / Agent 指令一致性设计 | Phase 4 | 1 |
| 能力补偿效果度量设计 | Phase 5 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| Brief 输出过长 | 反而增加模型负担 | 对每类上下文设置摘要和数量上限，完整内容只给读取命令 |
| Critic 变成形式主义 | Agent 只修关键词，不提升质量 | 输出具体缺口和来源，避免只检查标题存在 |
| Drift Check 误报 | 代码变更与 spec 语义关联难以完全机器判断 | 首版只对路径、声明范围和明显未关联变更做 advisory |
| Lessons 相关性不足 | 注入无关历史干扰模型 | 优先按 topic、spec relation、task 状态和显式关键词匹配，标明来源 |
| Acceptance Report 被误解为自动验收 | 用户误以为机器证据等于业务验收 | 报告中强制区分 machine evidence 与 human acceptance |
| 多 Agent 指令膨胀 | 入口文件上下文变重 | 指令只写路由原则，详细内容由 CLI brief 输出 |

## 关联

- 基于: `roadmap-openspec-L1` 已实现 rich guide、Project Context、agent 检测、view、completion。
- 基于: `adaptive-evidence-workflow-L1` 已实现 Profile、关键 AC、task evidence 与 governed coverage gate。
- 基于: `harness-coding-L1` 已实现 task context、report、verification 与 change propose 能力。
- 基于: `methodology-hardening-L1` 已明确系统保证、warning、human gate 与 target capability 边界。
- 基于: `spec-manager-ai-ux-L1` 已完成 README、skill、batch 与 AI 使用体验基础。
