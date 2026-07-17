---
code: spec-knowledge-operational-closure-L1
level: L1
title: Spec Knowledge Operational Closure
topic: spec-knowledge-operational-closure
parentCode: null
status: implemented
aiSummary: >-
  定义 Spec 知识运行闭环需求：修正 validity/delivery 指标集合与分母，Task 完成自动生成带证据的学习
  draft，扩展过期/替代/冲突候选、约束包子项可信度、多维迁移预览和 canonical topic 推荐，坚持人工审批、纯本地与 legacy 兼容。
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L1
  - type: based_on
    target: spec-knowledge-governance-L1
  - type: references
    target: critical-ac-readiness-L1
  - type: references
    target: adaptive-profile-intelligence-L1
created: '2026-07-16T09:32:04.615Z'
updated: '2026-07-16T11:44:00.596Z'
changeSummary: 'cascade: task-complete'
historyReview:
  sources:
    - 'spec:spec-knowledge-activation-hardening-L1'
    - 'spec:spec-knowledge-governance-L1'
    - 'spec:critical-ac-readiness-L1'
    - 'spec:adaptive-profile-intelligence-L1'
  dispositions:
    - sourceRef: 'spec:spec-knowledge-activation-hardening-L1'
      action: change
      reason: >-
        Complete metrics semantics, automatic learning drafts, lifecycle
        candidates, constraint confidence, migration breadth, and canonical
        topic guidance.
    - sourceRef: 'spec:spec-knowledge-governance-L1'
      action: reuse
    - sourceRef: 'spec:critical-ac-readiness-L1'
      action: reuse
    - sourceRef: 'spec:adaptive-profile-intelligence-L1'
      action: reuse
  reviewedAt: '2026-07-16T09:33:05.832Z'
scopePlan:
  mode: fixed
  plannedChildren:
    - code: spec-knowledge-operational-closure-L2.1
      title: Metrics Correctness and Automatic Delivery Learning
      required: true
    - code: spec-knowledge-operational-closure-L2.2
      title: Knowledge Lifecycle Constraint Trust and Migration Guidance
      required: true
  leaf: false
  updatedAt: '2026-07-16T09:36:46.971Z'
---
# Spec Knowledge Operational Closure - 需求文档

## 背景

项目已拥有 214 份 implemented Spec、136 个 completed Task、34 张 active Decision，并完成跨 topic 召回、历史约束包、知识治理采用门禁、Delivery Knowledge 审批复验、Metrics v2 和迁移预览。真实请求已经能够召回相关 Spec、Decision、AC、Lessons 与代码模块。

但知识闭环仍未完整：214 份 Spec 只有 1 条有效性 annotation，指标却报告 unknown 为 0；Delivery Knowledge 共 5 条、eligible denominator 为 0，却出现 declaration numerator 为 5；只有 3 份 Spec 具有 historyReview、3 份具有 scopePlan，没有 L3 显式启用 delivery learning；34 张 Decision 全部 active，236 条关系中替代型关系为 0；关键 AC readiness 为 29/136，即 21.3%。此外，Task 完成后仍需人工执行知识声明，约束包的模块提取会出现非真实路径，子项缺少独立置信度，冲突判断只识别已标记失效项，迁移预览只覆盖 Spec validity。

如果不继续收口，系统会“看起来有指标和知识包”，但无法准确回答未治理资产规模、哪些知识过期、哪些决策不可重复，也无法在交付完成时稳定沉淀经验。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 指标可信度 | validity unknown 漏计未标注资产，delivery coverage 出现 numerator 大于 denominator | P1 | Knowledge Metrics v2 实际输出 |
| 学习断点 | Task 完成不会自动产生知识候选，依赖后续人工声明 | P1 | 5 条 Delivery Knowledge 与 136 个 completed Task 对比 |
| 失效缺失 | 34 张 Decision 全 active、替代型关系为 0，无法识别过期知识 | P1 | Decision 与 relations 统计 |
| 冲突判断弱 | 只识别已标记失效状态，未比较新请求与 current 约束 | P1 | Constraint Package 实际输出 |
| 约束包质量 | 模块路径存在误识别，AC、模块、冲突子项没有独立置信度 | P2 | 真实 Brief 输出 |
| 迁移覆盖不足 | 预览只列 Spec validity，不含 Decision、替代关系、history disposition 和 AC readiness | P2 | Migration preview 输出 |
| Topic 收敛不足 | 能承认跨 topic 历史，但仍可能建议由单个英文 token 创建新 topic | P2 | Next 真实请求输出 |

## 用户故事

### Must have

- As a 项目治理者, I want 指标的分母、unknown 和覆盖率符合事实, so that 我能可靠判断知识治理进度。
- As a Task 执行者, I want 启用 learning 的 Task 完成时自动产生带证据的知识草稿, so that 经验沉淀不依赖额外记忆命令。
- As a 未来迭代审核者, I want 看到可能过期或被替代的 Spec/Decision 候选, so that 人工确认后可以淘汰旧知识而不丢失历史。
- As a 新需求发起者, I want 约束包指出新请求与当前约束的潜在冲突, so that 团队不会重复已否决的决策或静默破坏旧行为。
- As a 后续 Agent, I want 每个 AC、模块、冲突和经验都有来源、置信度及有效性, so that 可以判断哪些结论可直接采用、哪些仍需验证。

### Should have

- As a 维护者, I want 迁移预览覆盖 Spec、Decision、替代关系、history disposition 和关键 AC, so that 可以按风险和价值分批治理存量资产。
- As a 规划者, I want 系统优先推荐相关 canonical topic, so that topic 不会因请求中的偶然英文 token 继续分裂。
- As a 代码审核者, I want 模块引用能区分真实路径、历史路径和未知路径, so that 约束包不会把普通文本误认为代码模块。

### Could have

- As a 项目治理者, I want 比较迁移前后的模拟指标变化, so that 可以决定每批治理的优先级。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| Validity 指标 | 214 Spec、1 annotation，但 unknown=0 | 全部 eligible 来源进入分母，未标注来源计入 unknown，计数恒等式成立 |
| Delivery coverage | numerator=5、denominator=0 | 所有 coverage 满足 0 ≤ numerator ≤ denominator；无 eligible 项时为 0/0/null |
| Task 自动学习 | 136 completed Task，5 条知识记录，自动生成率 0% | 新 learning-enabled Task 完成后 draft 或 none 候选生成率 100% |
| 过期知识治理 | 34 Decision 全 active，替代型关系 0 | 提供 Spec/Decision 替代与失效候选；只有人工确认才改变状态 |
| 冲突提示 | 仅识别已失效状态 | 对 current 约束与新请求生成可解释 conflict candidate，缺证据时为 unknown |
| 约束包可信度 | 顶层有置信度，子项缺失；模块存在误识别 | AC、Lesson、模块、冲突子项 100% 带来源、置信度和有效性；路径状态显式 |
| 迁移预览 | 只覆盖 Spec validity | 覆盖 validity、Decision lifecycle、替代关系、history disposition、critical AC 五类 |
| Topic 推荐 | 可能建议 spec 等临时 topic | 高置信相关 topic 存在时先给 canonical 候选和理由，保留创建新 topic 选择 |

## 验收标准

1. **AC-1**: **Given** 项目存在显式 annotation、派生状态和未治理来源，**When** 用户查看 project 或 topic 指标，**Then** 系统 **SHALL** 把全部 eligible 来源计入互斥状态与分母，且每个 coverage 满足 numerator 不大于 denominator。
2. **AC-2**: **Given** 一个新 Task 的 L3 启用了 delivery learning 且具有成功 evidence，**When** Task 完成，**Then** 系统 **SHALL** 在同一事务中自动生成带 Task、evidence、AC 来源的 draft 知识候选；失败必须回滚 Task 完成。
3. **AC-3**: **Given** 自动生成的 Delivery Knowledge draft，**When** 尚未人工 approve，**Then** 它 **SHALL NOT** 进入 Brief 或 Lessons；approve 时仍必须重新验证来源。
4. **AC-4**: **Given** Spec、Decision 或关系可能被新事实替代，**When** 用户运行治理预览，**Then** 系统 **SHALL** 输出替代或失效候选、证据、置信度和建议人工动作，不得自动改变有效性或 Decision 状态。
5. **AC-5**: **Given** 新请求与 current Decision、关键 AC 或 reuse 约束存在词法或结构化冲突信号，**When** 生成历史约束包，**Then** 系统 **SHALL** 输出 conflict candidate、双方来源、触发原因和置信度；证据不足时必须标记 unknown。
6. **AC-6**: **Given** 约束包包含 AC、Lesson、代码模块或冲突项，**When** 用户查看输出，**Then** 每个子项 **SHALL** 包含 canonical source、confidence 和 knowledge state；代码模块必须标记 current-path、historical-path 或 unknown-path。
7. **AC-7**: **Given** 一个请求没有精确 topic 但召回多个相关 topic，**When** 系统建议下一步，**Then** 系统 **SHALL** 按置信度和历史强度给出 canonical topic 候选及理由，并保留创建新 topic 的显式选择。
8. **AC-8**: **Given** 用户请求历史治理迁移预览，**When** 报告生成，**Then** 报告 **SHALL** 覆盖 validity、Decision lifecycle、替代关系、history disposition 和 critical AC 批次，且前后事实文件保持不变。
9. **AC-9**: **Given** 历史项目未启用新能力或旧记录缺少新增字段，**When** 升级并继续使用既有命令，**Then** 系统 **SHALL** 保持纯本地、存储可读、CLI 兼容和人工审批边界。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| Validity 状态闭合率 | 1/214 显式标注，unknown 错报为 0 | eligible 总数 = 各互斥状态之和，100% | Knowledge Metrics 契约检查 |
| Coverage 数学有效率 | 已发现 1 类 numerator > denominator | 所有 coverage 100% 满足不变量 | 指标 schema 与属性测试 |
| Learning 自动草稿率 | 0% | 新 learning-enabled completed Task 100% | Task 与 Delivery Knowledge 关联统计 |
| Draft 审批隔离率 | 当前机制已隔离 | 保持 100% | Brief/Lessons 候选审计 |
| 失效候选可解释率 | 待测量 | 候选 100% 带来源、理由、置信度 | Migration preview 输出 |
| 约束包子项可追溯率 | 顶层可追溯，子项不完整 | AC/Lesson/module/conflict 100% | Constraint Package schema 检查 |
| 模块路径状态覆盖率 | 存在误识别 | 所有模块项 100% 具有三态路径状态 | Brief 报告 |
| 迁移维度覆盖 | 1/5 | 5/5 | Migration preview schema |

## 范围边界

- **做**: 修正治理指标集合与分母；Task 完成自动生成知识 draft；扩展替代/失效与冲突候选；增强约束包子项来源、置信度和路径状态；扩展迁移预览；推荐 canonical topic。
- **不做**:
  - 不自动 approve Delivery Knowledge，不自动把历史 Spec/Decision 标记为 current、superseded 或 invalidated。
  - 不自动执行 Decision supersede 或写入替代关系。
  - 不引入向量数据库、远程 embedding、MCP 或外部知识服务。
  - 不在本轮实现 L0/L1/L2 角色 Agent。
- **推迟**: 跨仓库知识图谱、模型驱动语义冲突裁决、自动合并 topic、全量历史资产人工治理执行。

## 设计原则

1. **指标是事实投影** - 分母必须来自明确 eligible 集合。违反判断: 出现 numerator 大于 denominator，或未治理资产未进入 unknown。
2. **自动提炼不等于自动发布** - Task 可以自动生成 draft，但进入召回必须人工 approve。违反判断: 未审核记录出现在 Brief 或 Lessons。
3. **候选不是结论** - 替代、失效、冲突和 topic 均只给候选与证据。违反判断: 系统仅凭相关性自动改变状态或创建关系。
4. **每条结论可追溯** - 子项必须具备来源、置信度和有效性。违反判断: 用户无法定位原始 Spec、Decision、Task、evidence 或 AC。
5. **未知优于伪精确** - 路径、冲突或有效性无法确认时明确 unknown。违反判断: 普通文本被当成真实模块，或无证据冲突被当成确定事实。
6. **Legacy 不追溯阻断** - 新基线向前强制，历史治理通过只读预览分批进行。违反判断: 升级导致 214 份存量 Spec 被自动修改或现有 CLI 失败。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | 指标集合闭合与 Task 自动学习草稿 | 已启用 knowledge governance baseline | P1 |
| Phase 2 | 失效/冲突候选与约束包可信度 | Phase 1 完成 | P1 |
| Phase 3 | 多维迁移预览与 canonical topic 推荐 | Phase 2 完成 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Metrics correctness and automatic delivery learning | Phase 1 | 1 |
| Knowledge lifecycle, constraint trust, and migration guidance | Phase 2-3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 自动草稿无法可靠概括复杂执行差异 | 产生低质量知识候选 | 使用结构化 Task/evidence/AC 事实并保持 draft，允许人工编辑或 reject |
| 冲突词法信号误报 | 审核噪声增加 | 输出 candidate 或 unknown、理由和置信度，不自动阻断 |
| Eligible 集合定义过宽 | 指标被大量 legacy unknown 淹没 | 同时报告 project、topic、baseline 前后和来源类型分组 |
| 路径随版本演进失效 | 模块可信度下降 | 显式 current、historical、unknown 三态，不删除历史来源 |
| 当前存在 4 条未审核 Delivery Knowledge | approval coverage 偏低 | 与功能开发分开进行人工审核，不自动批准 |

## 关联

- based_on: spec-knowledge-activation-hardening-L1 - 补齐指标、自动学习、冲突、迁移和 topic 收敛缺口。
- based_on: spec-knowledge-governance-L1 - 继承有效性独立、人工处置和 approved-only 原则。
- references: critical-ac-readiness-L1 - 复用关键 AC readiness 与人工修复边界。
- references: adaptive-profile-intelligence-L1 - 复用集合分母、覆盖率和 invalid projection 口径。
