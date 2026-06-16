# Spec-Driven Development Methodology

> spec-manager 的方法论核心。Spec 优先编程，回答“为什么做、做什么、怎么做、谁来做”，并明确哪些约束由系统保证、哪些依赖人工判断。

## 核心理念

**先设计后编码** — 新功能和非平凡改动在实现前先形成规格说明。规格不是文档负担，而是减少返工、锁定边界和跨会话恢复上下文的工程手段。

**约束闭环** — 质量不是模型一次生成出来的，而是通过分阶段注入约束、逐层审核、执行留痕和验证证据逐步收敛。闭环强度取决于可执行门禁，不取决于口号。

**三层人类门控** — L1/L2/L3 各自独立审核，避免从需求直接跳到实现。AI 负责调研、起草、对比和执行；人负责批准、取舍与最终验收。

**事实优先于宣传** — 方法论只把当前可证明的行为称为系统保证。warning、人工审核和目标能力必须与 hard gate 明确区分。

## 规范性契约

### 工作路径

新功能和非平凡工作遵循：

```text
L1 PRD → L2 Design → L3 Impl → Agent Task
```

- L1 回答为什么做、做成什么样。
- L2 回答采用什么技术方案、模块如何协作。
- L3 是实施规格或实施契约，回答具体如何改、如何验证。
- Agent Task 是执行记录，保存步骤状态、step_report 与 verification。

quick 是受限例外：仅适用于 ≤5 步、单文件、不涉及 schema、API 契约或跨模块的微调。quick 不需要建立完整 L1/L2/L3 链路，`git diff` 是其主要审计记录。

adaptive workflow 是显式启用的风险分级能力。未在 `.spec-manager/config.yaml` 启用时，项目保持 legacy 行为，现有 Task 完成语义不自动加严。启用后，完整 Task 可使用 `standard` 或 `governed` Profile；Profile 在 Task 创建时写入快照，后续项目默认值变化不改写历史 Task。

- `quick`: 受限轻量例外，不创建完整 L1/L2/L3/Task 链路。
- `standard`: 继续使用完整 L1/L2/L3/Task 路径，关键 AC 覆盖缺口会在完成与 evidence 报告中作为 warning 提示。
- `governed`: 创建 Task 前，frozen L3 必须在 `## 关键验收标准` 中引用至少一条自身 `## 验收标准` 的 AC ID；完成前所有关键 AC 必须有 `exitCode=0` verification evidence 覆盖。

当前已实现的是 Profile 配置、Task Profile 快照、关键 AC 解析、`task evidence` 动态投影、standard coverage warning 和 governed 关键 AC 成功 verification 全覆盖完成门禁。`task evidence` 是从 L3、Task 与 verification 生成的只读投影，不是新的事实源。

Profile 推荐是本地确定性建议，可通过 `spec-manager project profile recommend --request "<work>"` 获取 quick、standard 或 governed 推荐、risk factors、reasons 和 override guidance。推荐不会自动启用 adaptive workflow，不会自动创建 Task，也不是 hidden gate；用户可以覆盖推荐，最终硬门禁仍由 Task Profile 快照和 evidence coverage gate 决定。

Profile metrics 是只读治理效果报告，可通过 `spec-manager project profile metrics [--topic <topic>] [--json]` 汇总 legacy、standard、governed Task 状态、governed coverage 缺口、standard warnings 和 explicit overrides。metrics 不会自动修改配置或历史 Task，不替代 doctor 或 task complete 门禁；standard warning 只作为报告项，不计为完成违规。

Critical AC readiness 是只读修复清单，可通过 `spec-manager project readiness critical [--topic <topic>] [--json]` 汇总 active L3 的 `missing`、`empty`、`unknown` 和 `ready` 状态。readiness report 只提供修复建议和 governed 升级判断，不会自动修改 L3，不会自动生成或插入关键 AC；修复 missing/empty/unknown 前必须读取 L3 上下文并人工确认真实关键 AC。

启用 adaptive workflow 前先运行 `spec-manager project workflow preview [--json]`。preview 是只读采用预检，会汇总当前 workflow 状态、legacy Task 数量、active L3 关键 AC readiness、推荐 defaultProfile 和 next steps；preview 不会写配置、不迁移历史 Task，也不是 enable 的 hidden gate。

R8 是代码调查规则：改代码前必须确认相关 Spec、文件路径、调用链和测试位置。它不等同于“所有 Edit/Write 都必须绑定 Agent Task”；是否需要 Agent Task 由工作路径和 quick 边界决定。

### 分层状态流

不同对象具有不同的正常生命周期，不能用一条统一状态机概括。

```text
L1/L2: draft → confirmed → implemented
          用户批准       全部直接子规格完成后受控级联

L3:    draft → frozen → implemented
          用户批准      Agent Task complete

Task:  draft → running ↔ waiting → completed | failed
```

- 用户负责 L1/L2 的 `draft → confirmed` 与 L3 的 `draft → frozen`。
- Agent 不得在没有明确批准时自行推进审核状态。
- `task complete` 推进 frozen L3，并在子规格全部完成时受控级联 confirmed L2/L1。
- `project reconcile` 只用于显式审阅后的历史状态对账，不是通用状态绕过。
- Task 的 `completed` 和 `failed` 是不可变终态；需要修正时创建新 Task 或 change proposal。

### 门禁能力矩阵

| 分类 | 含义 | 失败影响 |
|---|---|---|
| hard gate | CLI 或核心逻辑直接拒绝当前操作 | 阻止状态推进或完成 |
| warning | 系统检测并提示，但不阻止操作 | 需要人工判断和处理 |
| human gate | 必须由用户明确审核或批准 | Agent 不得自行推进 |
| target capability | 期望达到但当前未由系统强制的能力 | 不构成当前系统保证 |

| 检查项 | 当前分类 | 当前行为 |
|---|---|---|
| L1/L2/L3 独立批准 | human gate | 写完 Spec 后停止，等待用户批准 |
| 占位正文 R22 | hard gate | 正文仍为占位时阻止 confirm/freeze |
| 必填段、RFC 2119、R17 todolist、R20 裂变计划 | warning | `spec validate` 报告问题，但通常不阻止批准 |
| planJson 字段、步数与末步验证 | hard gate / warning 混合 | Task 创建校验关键结构，计划校验同时提供提示 |
| Task 仅在 running 状态可写步骤和 verification | hard gate | 非 running Task 拒绝写入 |
| 全部计划步骤 succeeded | hard gate | 未完成步骤会阻止 `task complete` |
| L3 验证命令与 `@verify` | hard gate | 默认在 `task complete` 时执行，失败则拒绝完成 |
| 至少一条成功 verification | hard gate | 没有 `exitCode=0` 证据则拒绝完成 |
| verification 覆盖全部关键 AC | governed: hard gate / standard: warning | `task evidence` 动态投影关键 AC 覆盖；governed 未覆盖时拒绝完成 |
| 真实环境冷启动与人工使用验收 | human gate / target capability | 应按风险执行，当前不由统一门禁强制 |

机器可验不等于应用可用。编译、测试或某条 verification 成功只能证明对应检查通过；不能自动证明完整用户流程可用。高风险交付仍应执行功能验证、smoke 验证和真实环境人工验收。

### 完成定义

一个 Agent Task 能够完成，至少需要：

1. 绑定 frozen L3。
2. 所有计划步骤均为 `succeeded`。
3. L3 中可执行的验证命令和 `@verify` 规则通过。
4. 至少一条结构化 verification 的 `exitCode=0`。
5. Task 完成后 L3 成功级联为 `implemented`。
6. L1 被级联为 `implemented` 时已有至少一张决策卡片。

上述条件是当前系统保证的最低完成标准。关键 AC 全覆盖在 governed Profile 中属于系统门禁；真实环境可用和业务指标达标仍需按项目风险补充验收。

## 运行机制

### 四层漏斗

把业务需求可靠地交付为上线功能，按需求、设计、实施、连续性四层拆解。

| 层 | 名称 | 交付物 | 审核门禁 |
|---|---|---|---|
| 1 | 需求层 | PRD + L1 Spec | 用户确认目标、边界与验收标准 |
| 2 | 设计层 | L2 Spec | 用户确认技术方案、接口契约与模块边界 |
| 3 | 实施层 | L3 Spec + Agent Task | 用户冻结 L3；Task 按计划执行并验证 |
| 4 | 连续性层 | 决策卡片 + 历史任务 | 执行前读取历史，实施后沉淀关键决策 |

连续性层避免跨会话和跨人员失忆：创建 L1 前查询同 topic 的历史决策；开始 Agent Task 前查询历史任务，了解已有实现模式和失败记录。

### 分阶段注入约束

| 阶段 | 约束重点 | 主要产物 |
|---|---|---|
| L1 PRD | 目标、范围边界、用户故事、验收标准 | 业务档案 |
| L2 Design | 技术决策、数据模型、接口契约、模块拆解 | 技术契约 |
| L3 Impl | 文件级实施规则、步骤、验证命令、planJson、回滚 | 实施契约 |
| Agent Task | 逐步执行、结构化上报、verification 与完成门禁 | 执行记录 |

约束逐层翻译，使 Agent 不需要只凭一段需求描述推测实现方案。R14 要求跨层引用使用 spec code，避免复制上层正文造成多份真相。

### 失败处理与继续执行

当前系统提供的是“阻止错误完成 + 保留失败上下文 + 支持继续处理”，不是自动 retry 调度器。

- step 上报为 failed 且提供 outputJson 时，系统保存 `lastFailedOutput`。
- 后续同 Task 的 step_report 或 harness context 会在 warnings 中显示截断后的失败摘要。
- verification 或 L3 验证命令失败时，`task complete` 拒绝完成并返回错误信息。
- Task 可从已有步骤状态继续执行，不需要重建全部上下文。
- 修复、重试、选择下一步和处理完整错误上下文仍由 Agent 或人负责。

因此，“带错纠正”表示失败证据不会静默丢失，并能成为后续决策输入；它不表示失败会被自动重试，也不保证流程必然收敛。

### 三层判定

| 层 | 判定方式 | 示例 |
|---|---|---|
| 编排层 | CLI 退出码、状态和参数校验 | 非 frozen L3 无法创建 Task |
| 产物层 | 检查文件、Spec、Task 和级联结果 | Task 完成后 L3 必须为 implemented |
| 证据层 | verification、验证命令与 `@verify` | 记录命令、exitCode、summary 和可选 AC 覆盖 |

自然语言摘要用于审计与理解，退出码和结构化状态用于硬门禁。两者不能互相替代。

### 24 条规则

| 主题 | 规则 | 重点 |
|---|---|---|
| 流程控制 | R1-R4 | 独立审核、状态推进权、frozen 后建 Task |
| 质量门禁 | R5/R6/R10/R15/R18 | 步骤完整、验证、级联与决策卡片 |
| 文档治理 | R7/R11/R13/R14/R16/R17/R19/R20/R21/R22 | 层级、粒度、摘要、引用与正文治理 |
| 代码纪律 | R8/R9/R12 | 代码调查、批准入口、planJson 模板 |
| 代码调查 | R23 | Spec 写作前基于实际代码 |
| Delta Spec | R24 | delta change 的 proposal 与 delta spec 完整性 |

规则并非全部是 hard gate。每条规则的执行机制应以规则文件和当前 CLI 行为为准；方法论文档只提供导航与边界说明。

### 规则审计

规则审计记录在本地 `.spec-manager/audit.json`，`audit report` 将 pending 记录归档到本地 audit archive。

- **最低合规基线**：R1(≥1) + R4(≥1) + R13(≥1) + R18(≥1) + R22(≥1)
- **异常绕过可追溯**：完成门禁只能按能力使用 `--skip-r18`、`--skip-verification`、`--skip-verify`，并必须提供原因；旧 `--force` 不再执行。
- **R18 当前有效性**：只有 active 决策卡片满足 R18，superseded 或 partial 卡片仅保留历史价值。
- **完整合规**：需要结合本次工作 applicable rules 判断，不能简单要求所有规则都命中。

audit 命中表示相关规则被记录，不单独证明产出质量或真实环境可用。

### Context 优化

每层 Spec 审核通过后，可以开启新会话再进入下一层。Spec 是跨会话的持久化上下文，下一阶段优先读取 aiSummary，再按需读取完整正文。

建议拆会话的场景：

- Agent Task 步骤较多，工具结果持续累积。
- 已连续跨越多个审核层级。
- 当前会话已难以稳定召回早期约束。

是否拆会话取决于工具能力和任务复杂度，不应依赖 Agent 不可观测的固定 token 百分比。

## 设计理念与边界

### 硬规则与模糊约束

可字面校验的规则通常比模糊提醒更可靠，但规则强度取决于执行机制，而不是措辞。

| 更可执行的约束 | 模糊约束 |
|---|---|
| planJson 不超过 20 步 | “请控制任务粒度” |
| aiSummary 不超过规定长度 | “请写简洁摘要” |
| Task 完成前所有步骤必须 succeeded | “确认任务都做完了” |
| verification 记录 command、exitCode 与 summary | “记得验证一下” |

字面规则也可能诱导 Agent 只满足关键词。高质量门禁应尽量验证行为结果，并保留人工判断处理系统难以判定的部分。

### 人与 AI 的边界

| AI 适合负责 | 人适合负责 |
|---|---|
| 搜索历史、调研代码、起草 Spec、执行计划、记录证据 | 批准范围、选择方案、接受风险、真实环境验收、业务结果判断 |

系统可以限制状态推进和记录执行证据，但不能替代产品判断、风险接受和最终责任。

### AI 与开发者价值

| 价值 | 说明 |
|---|---|
| 跨会话恢复 | Spec、Task 与 Decision 持久化到文件，后续会话可按需读取 |
| 边界锁定 | L1 明确做与不做，L2/L3 将边界翻译为技术和实施契约 |
| 可预测执行 | Agent Task 按计划步骤执行，未完成步骤不能被静默跳过 |
| 可追溯 | step_report、verification、决策卡片和 audit 提供结构化记录 |
| 可协作 | Markdown、JSON 与 git 允许多人和不同 Agent 共享同一事实来源 |
| 可复盘 | incident、decision 和历史 Task 支持从失败中演进规则 |

### 实践启发

分阶段规划、逐层增加约束、保存失败证据、分层验证和确定性门禁，都是提高 Agent 工程交付可靠性的常见实践。这些实践支持 spec-manager 的设计方向，但不能仅凭相似案例证明本方法论在所有项目中有效。

采用外部案例作为方法论证据时，应提供可追溯来源、实验配置、对照组、成功判据和失败案例；否则只能作为设计启发。

### 当前边界与目标能力

当前系统已经提供：

- Spec 分层与人类审核门控。
- frozen L3 到 Agent Task 的执行约束。
- 步骤完整性、验证命令、`@verify`、成功 verification 与 governed 关键 AC evidence coverage 完成门禁。
- `task evidence` 动态投影，展示 Profile、关键 AC 覆盖、verification 与 artifact。
- 失败摘要保存、任务继续执行、状态级联、决策与审计记录。

仍属于目标能力或项目级人工流程的事项：

- 自动 retry 调度与完整错误上下文自动注入。
- 按风险强制 compile、functional、smoke 多层 verification。
- 统一的真实环境冷启动和人工用户流程验收门禁。
- 业务指标达标后的自动闭环判定。

### 适用场景

适合：

- 中等以上复杂度、多文件、多模块或跨团队工作。
- 需要审计、追溯和长期演进的系统。
- 多人或多 Agent 共享上下文的项目。

不适合完整三层流程的场景：

- 满足 quick 限制的单文件微调。
- 一次性脚本和低风险实验。
- 明确允许快速失败、无需长期维护的概念验证。

即使不走完整三层流程，也应保留与风险相称的调查、验证和变更记录。
