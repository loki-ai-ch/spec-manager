# Spec-Driven Development Methodology

> spec-manager 的方法论核心。Spec 优先编程，回答"为什么做、做什么、怎么做、谁来做"。

## 核心理念

**先设计后编码** — 任何功能实现前必须先写规格说明。规格不是文档负担，是减少返工和减少失忆的工程实践。

**三层人类门控** — L1/L2/L3 各自独立审核，避免"一口气写完"。

**人工 vs AI 的边界** — AI 负责起草、对比、查重；人负责批准、推进、决定。

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
| L3 | 执行日志 | 实施完成 | Claude 自己 | 目标/实施步骤/验证命令/planJson/回滚 |
| Task | 操作记录 | 单次 | 审计 | step 列表 + step_report 上报 |

## 状态机

```
draft → confirmed → frozen → implemented
  ↑        ↑         ↑          ↑
 Claude   用户      用户     task complete
```

**规则：状态推进是用户行为，不是 Claude 行为**。Claude 拥有上下文≠有权跳过流程。

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
2. 方案研究       Claude 读历史决策 + 现有 spec
3. PRE-WRITE Q1-Q4  Claude 问用户 4 个澄清问题
4. 设计文档       写 L1 / L2 / L3 spec
5. 用户确认       用户审核 + 状态推进
6. 实施编码       Agent Task 逐步执行
7. 决策记录       L1 implemented 后建决策卡片
8. 部署           /deploy skill
```

## 与传统开发的差异

| 维度 | 传统开发 | spec-manager |
|---|---|---|
| 需求 → 代码 | 一次对话直写 | L1 → L2 → L3 → Task |
| 设计回溯 | 无 | parentCode + 目录嵌套（一跳跳转父链） |
| 决策记录 | 散落在聊天/PR 评论 | 结构化决策卡片 + topic 查询 |
| 执行追踪 | 无 | step_report + 规则审计 |
| 规则执行 | 团队公约（口头） | 24 条 machine-readable + 事故驱动演进 |
| 上下文管理 | 全量 | R19 优先 aiSummary + 窄视图 |

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
