# Spec-Driven Development Methodology

> spec-manager 的方法论核心。Spec 优先编程，回答"为什么做、做什么、怎么做、谁来做"。

## 核心理念

**先设计后编码** — 任何功能实现前必须先写规格说明。规格不是文档负担，是减少返工和减少失忆的工程实践。

**三层人类门控** — L1/L2/L3 各自独立审核，避免"一口气写完"。

**人工 vs AI 的边界** — AI 负责起草、对比、查重；人负责批准、推进、决定。

## 核心原则

1. **Spec 是单一真相源** — L1/L2/L3 三层文档是"为什么 / 怎么做 / 做什么"的独立档案，跨会话 AI 通过 `spec show` 读 Spec 而不是凭记忆。R12 禁止凭记忆写代码，R14 跨层引用只写 code 不复述。
2. **每层独立审核** — L1 confirmed 才能写 L2，L2 confirmed 才能写 L3，L3 frozen 才能建 Agent Task。R1 写完必停，R2 状态推进归用户，R4 每层独立 STOP。AI 不能自行推进。
3. **代码变更必经 Agent Task** — R8：任何 Edit/Write 都必须在 running Agent Task 内，绑定 frozen L3 spec（或 quick 文档）。执行中每步 step_report 留痕，R15 要求 outputJson 必含 summary。
4. **决策必落库** — R18：L1 implemented 后必须创建 ≥1 张决策卡片（what/why），沉淀到 decisions/ 目录。下次同 topic 创建 L1 时先查历史决策，杜绝无视历史。
5. **RESOLVER 路由意图** — 用户说"需求 / 计划 / 测试 / 复盘 / 修 typo / 查历史"时，SKILL.md 路由表自动匹配到 12 种路径（10 种 doc.type + quick + research），不再强套 spec 三层。

## 四层漏斗

把业务需求可靠地交付为上线功能，按四层拆解：需求 → 设计 → 实施 → 连续性。每层有明确的交付物和审核门禁。

| 层 | 名称 | 交付物 | 审核门禁 |
|---|---|---|---|
| 1 | 需求层 | PRD + L1 Spec | 明确技术边界和验收标准，用户 confirmed |
| 2 | 设计层 | L2 Spec | 数据模型、API、状态机，用户 confirmed |
| 3 | 实施层 | L3 Spec + Agent Task | ≤20 步原子任务，用户 frozen |
| 4 | 连续性层 | 决策卡片 + 历史任务 | Agent Task 执行前先读历史任务，避免重复踩坑 |

**第四层 · 连续性**是容易被忽略的一层：每个 Agent Task 开始前先 `spec-manager task list --topic <topic>` 查同主题历史任务，了解已有实现模式，复用成功的步骤顺序。L1 implemented 后必须建决策卡片（R18），下次同 topic 创建 L1 时先查决策历史。

## 层级

```
L0  愿景/路线图       季度级     1
L1  需求文档 (PRD)    周级       1-3 per L0
L2  技术设计          模块级     1-2 per L1
L3  实施规格          单次任务   2-8 per L2
Task  执行            小时-天级  1 per L3
```

| 层 | 产物 | 时间跨度 | 读者 | 必含什么 |
|---|---|---|---|---|
| L1 | 业务档案 | ≥1 年 | 产品/业务方 | 背景/用户故事/AC/范围边界/度量指标 |
| L2 | 技术契约 | 模块演进 | L3 写作者 | 方案概述/技术决策/受影响模块/接口契约 |
| L3 | 执行日志 | 实施完成 | AI agent / 代码审核者 | 目标/实施步骤/验证命令/planJson/回滚 |
| Task | 操作记录 | 单次 | 审计 | step 列表 + step_report 上报 |

## 状态机

```
draft → confirmed → frozen → implemented
  ↑        ↑         ↑          ↑
AI agent  用户      用户     task complete
```

**规则：状态推进是用户行为，不是 AI 行为**。AI 拥有上下文≠有权跳过流程。

## 24 条规则（按主题分组）

### 流程控制（R1-R4）

- **R1** 写内容后必须停下等审核
- **R2** 状态推进是用户行为
- **R3** 创建 Agent Task 前必须 spec 已 frozen
- **R4** 每层 Spec 都是独立审核点

### 质量门禁（R5/R6/R10/R15/R18）

- **R5** 执行期间不得跳步
- **R6** task_complete 后校验 implemented
- **R10** planJson 最后一步必须是验证
- **R15** step_report outputJson 必含 summary
- **R18** L1 implemented 后必须建决策卡片

### 文档治理（R7/R11/R13/R14/R16/R17/R19/R20/R21/R22）

- **R7** L2/L3 必须绑定父 Spec
- **R11** Agent Task ≤20 步
- **R13** 写完 contentTemplate 后必须 aiSummary
- **R14** 跨层引用用 code 不复述
- **R16** L1 创建前必须搜索去重
- **R17** L2 是架构拆解不是 todolist
- **R19** 研究期优先读 aiSummary
- **R20** scope-split L2 必须批量建齐子 L3
- **R21** aiSummary ≤300 字符
- **R22** spec 创建后必须立即写正文

### 代码纪律（R8/R9/R12）

- **R8** 改代码前必须调研
- **R9** 批准必须走 Skill 不能凭上下文
- **R12** 禁止凭记忆写 planJson

### 代码调查（R23）

- **R23** Spec 写作前必须基于实际代码（Level 1/2/3 三级）

### Delta Spec（R24）

- **R24** delta change 必须含 proposal + delta spec

## 工作流

```
1. 需求理解       用户描述需求
2. 方案研究       AI 读历史决策 + 现有 spec
3. PRE-WRITE Q1-Q4  AI 问用户 4 个澄清问题
4. 设计文档       写 L1 / L2 / L3 spec
5. 用户确认       用户审核 + 状态推进
6. 实施编码       Agent Task 逐步执行
7. 决策记录       L1 implemented 后建决策卡片
8. 部署           /deploy skill
```

## Context 优化

每层 Spec 审核通过（L1 confirmed / L2 confirmed / L3 frozen）后，**建议 `/clear` 开新会话**再进下一层。Spec 已是跨会话 memory store，下一层启动只需 `spec show <code>` 读元数据，不需要把前一层的对话历史带过来。

**为什么要拆会话**：
- 超过临界 token 数后 recall 下降（context rot）
- 20 步 Agent Task 的 tool_result 会线性累积，单会话容易打满
- 跨层信息已落文件，"全流程串在一个 session" 是反模式

**何时必须拆**：
- Agent Task 即将执行 ≥10 步时
- 已连续跨 2 层（L1→L2→L3 全在一个 session）
- 看到剩余 token budget < 30%

## 规则审计合规基线

每次执行 `/spec-manager` 时，规则审计实时记录到本地 `audit.json`。

- **最低合规**：R1(≥1) + R4(≥1) + R13(≥1) + R22(≥1)
- **完整合规**：所有 applicable rules 的计数 > 0

审计记录在 `task complete` 时自动上报。无 Agent Task 场景（research / L0 单独创建）的 hits 写入 pending queue，绑定到后续 Task 后上报。

## 与传统开发的差异

| 维度 | 传统开发 | spec-manager |
|---|---|---|
| 需求 → 代码 | 一次对话直写 | L1 → L2 → L3 → Task |
| 设计回溯 | 无 | parentCode + 目录嵌套（一跳跳转父链） |
| 决策记录 | 散落在聊天/PR 评论 | 结构化决策卡片 + topic 查询 |
| 执行追踪 | 无 | step_report + 规则审计 |
| 规则执行 | 团队公约（口头） | 24 条 machine-readable + 事故驱动演进 |
| 上下文管理 | 全量 | R19 优先 aiSummary + 窄视图 |

## AI 视角的价值

| 价值 | 说明 |
|---|---|
| 跨会话记忆不丢失 | Spec 是持久化到文件的档案，AI 重新会话时 `spec show` 即可还原上下文。不再出现"上次说过的约束，这次 AI 又忘了" |
| 边界锁定不跑偏 | L1 的"范围边界 · 不做"章节明确告诉 AI 什么不能改。R16 去重防止 AI 重新发明轮子 |
| 结构化输入 → 稳定输出 | planJson 字段名（stepNo/stepType/name）+ PRE-WRITE 问答强制 AI 走模板，而不是每次凭直觉写 spec |
| 历史决策自动复用 | decisions/ 目录 + topic 查询。AI 无法绕过过往结论，必须先读决策卡片 |
| 行为全量可审计 | Agent Task 每步 step_report 带 outputJson.summary，异常时能精确定位是哪个 AI 在哪一步改了什么 |

## 开发者视角的价值

| 价值 | 说明 |
|---|---|
| 可预测：知道 AI 在干嘛 | R1 "写完必停"让 AI 每完成一层就等人审。开发者不用守着屏幕，可以异步介入每个审核点 |
| 可追溯：出问题找得到人 | Agent Task 有 specCode / taskId / 每步 latency / error。incident → rule 演进时能反查是哪个决策环节缺了约束 |
| 可协作：多人 / 多 AI 共享 | 所有 Spec 都是 markdown 文件，不依赖特定人的 IDE 或单一 AI 会话。团队成员 + 不同 AI 工具看到同一份真相 |
| 可复盘：事故驱动演进 | incidents/ 目录记录违规事件，"事故 → 规则"是规则演进的单向箭头 —— 无据不加规则 |
| 可量化：度量驱动迭代 | 每个 L1 有度量指标（基线 / 目标 / 测量方式）。上线后直接验证是否达标，不靠"感觉变好了" |

## 适用场景

✅ 适合：
- 中等以上复杂度（5+ 文件 / 多模块 / 跨团队）
- 需要审计追溯（金融/医疗/政府）
- 长期演进的系统
- 多人协作（明确责任分工）

❌ 不适合：
- < 5 步的纯文本修改（走 quick 路径）
- 一次性脚本
- 概念验证 demo
