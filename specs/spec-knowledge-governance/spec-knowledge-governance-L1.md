---
code: spec-knowledge-governance-L1
level: L1
title: Spec Knowledge Governance and Learning Loop
topic: spec-knowledge-governance
parentCode: null
status: implemented
aiSummary: >-
  承接跨 topic 召回后的知识治理：分离实施状态与知识有效性，要求 L1/L2 对关键历史声明
  reuse/change/reject/unknown，将继承约束接入 L3 AC 和 evidence，增加计划子级完整性以防上位规格提前完成，并把
  Task 结果反馈为经审核、可检索的交付知识与治理指标。
relations:
  - type: based_on
    target: spec-knowledge-loop-L1
  - type: references
    target: critical-ac-readiness-L1
  - type: references
    target: delivery-summary-L1
  - type: references
    target: adaptive-profile-intelligence-L1
created: '2026-07-16T02:49:23.835Z'
updated: '2026-07-16T04:07:11.805Z'
changeSummary: 'cascade: task-complete'
---
# Spec Knowledge Governance and Learning Loop — 需求文档

## 背景

`spec-knowledge-loop-L1` 已完成 Phase 1：跨 topic 历史召回能够从当前 200 份 Spec 中返回 Top 5 相关结果，并提供匹配理由、置信度和来源。但“找到历史”只是知识复用的入口，系统仍无法稳定回答三类后续问题：这条历史现在是否有效、新迭代如何处理这条历史、交付结果如何改变未来判断。

当前项目的知识有效性仍与实施状态混合：Spec 状态只有 draft/confirmed/frozen/implemented/archived，implemented 只能证明曾经交付，不能证明结论仍然适用；已有 Decision 支持 active/superseded/partial，但 31 个 topic 的历史决策没有统一进入 Spec 推荐结果的有效性判断。项目关键 AC readiness 当前为 21/128，91 份 active L3 缯少关键 AC 章节，16 份章节为空，说明历史行为约束尚不能稳定进入新的验证链路。

上一轮还暴露出范围完整性问题：原 L1 明确预估两个 L2，但只创建并完成 L2.1 后，状态机因为“所有已存在子级完成”便将整个 L1 级联为 implemented，尚未创建的知识有效性、继承和反馈范围无法参与完成判断。这说明未来闭环不能只记录已有子级，还必须显式声明本轮范围是否已经建齐。

如果不继续治理，跨 topic 召回会把越来越多“曾经正确”的内容交给 Agent，却无法防止过期约束传播、隐式覆盖历史决策、关键 AC 丢失和重复踩坑。Spec 数量会继续增长，但复用价值无法审计。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| Knowledge validity | implemented 与“当前仍有效”混为一谈 | P1 | Spec 状态模型没有独立知识有效性 |
| History disposition | 新 L1/L2 没有统一声明复用、修改、拒绝或待验证 | P1 | 当前模板和审批门禁没有历史处理契约 |
| Acceptance continuity | 关键历史约束无法稳定进入新 L3 和 evidence | P1 | 仅 21/128 active L3 critical AC ready |
| Scope completeness | 未创建的计划子级不参与完成级联 | P1 | 原 L1 预估 2 个 L2，只完成 1 个便成为 implemented |
| Delivery learning | Task 完成结果没有形成可检索的验证/失效结论 | P2 | 召回主要依赖 Spec、Decision 和失败记录 |
| Value measurement | 无法衡量历史复用、覆盖与失效治理效果 | P2 | 现有指标以 Task/Profile 完成为主 |

## 用户故事

### Must have

- As an AI agent, I want 每条历史建议都标明当前有效性和依据, so that 我不会把历史实现状态误认为当前约束。
- As a spec author, I want 对召回的关键历史逐条声明复用、修改、拒绝或待验证, so that 新迭代与历史的关系可以审计。
- As an implementer, I want 被继承的关键行为约束进入 L3 AC 和 verification evidence, so that 兼容性不会只停留在文档描述。
- As a maintainer, I want 在父规格完成前证明计划子级已经建齐, so that 未建范围不会被状态级联静默遗漏。
- As a maintainer, I want Task 完成后记录被验证、失效和新增的知识, so that 实践结果能够改善后续召回。

### Should have

- As a reviewer, I want 审批界面明确提示历史冲突、待确认有效性和缺失处理声明, so that 覆盖旧决策必须是显式选择。
- As a product owner, I want 查看知识复用率、修改率、失效率、关键 AC 连续性和范围完整性, so that Spec 价值可以持续衡量。
- As a legacy project owner, I want 新治理规则默认向前生效, so that 不必先批量改写全部历史资产。

### Could have

- As a maintainer, I want 按价值和使用频率获得历史治理修复建议, so that 高影响知识优先补齐有效性。
- As a portfolio owner, I want 查看能力、决策、验收和交付结论之间的关系视图, so that 跨 topic 治理更加直观。

### Won't have

- 本轮不建设 L0/L1/L2 角色 Agent；未来角色共享本闭环输出。
- 本轮不引入远程知识服务、远程遥测或自动生成业务决策。

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| 历史有效性 | 推荐结果只有实施状态，没有独立有效性依据 | 纳入新治理的推荐结果 100% 提供有效性、依据和更新时间 |
| 替代/失效追踪 | Spec 没有统一知识状态；历史替代覆盖待测量 | 被明确替代或失效的知识 100% 指向替代来源或原因 |
| 历史处理声明 | 当前无统一四态契约 | 有相关历史的新 standard/governed L1/L2 100% 声明处理结果 |
| 关键 AC 连续性 | 21/128 active L3 ready | 新 governed L3 100% 声明有效关键 AC 并覆盖 evidence |
| 范围完整性 | 已观察 1 次上位规格提前 implemented | 声明多子级计划的新增父规格不得在子级未建齐时 implemented |
| 交付学习 | 新 Task 结论覆盖率待测量 | 纳入闭环的新完成 Task 100% 记录知识结论或“无新增知识” |
| 治理价值报告 | 当前没有复用/修改/拒绝/失效指标 | 每个纳入闭环的 topic 可输出统一治理指标 |
| Phase 1 兼容 | 81 个测试文件、972 个测试通过 | 后续治理保持全量回归通过和原 Brief 字段兼容 |

## 验收标准

1. **AC-1**: **Given** 一条历史 Spec、Decision、Lesson 或验收约束进入推荐结果, **When** 用户查看历史上下文, **Then** 系统 **SHALL** 展示其知识有效性、判断依据、更新时间和来源。
2. **AC-2**: **Given** 一条知识被标记为 superseded、invalidated 或 historical, **When** 系统保存该状态, **Then** 记录 **SHALL** 包含替代来源或可审计原因，且原始历史不得被删除。
3. **AC-3**: **Given** 新 L1/L2 获得关键历史推荐, **When** 规格进入人工审批, **Then** 每项关键历史 **SHALL** 具有 reuse、change、reject 或 unknown 之一，并保留来源。
4. **AC-4**: **Given** 历史处理声明为 change 或 reject, **When** 审批者查看规格, **Then** 系统 **SHALL** 显示变更原因和可能受影响的 Decision/AC。
5. **AC-5**: **Given** 新 L3 继承关键历史约束, **When** 创建 governed Task, **Then** 该约束 **SHALL** 成为可追溯的关键 AC，并由成功 verification evidence 覆盖后才能完成。
6. **AC-6**: **Given** 父规格声明应产生多个子规格, **When** 已存在子级全部完成但计划子级尚未建齐, **Then** 系统 **SHALL NOT** 将父规格级联为 implemented，并应给出缺失范围提示。
7. **AC-7**: **Given** 纳入闭环的 Task 完成, **When** 生成交付结果, **Then** 系统 **SHALL** 记录被验证、被否定、新发现的知识，或者明确声明没有新增知识。
8. **AC-8**: **Given** 新的交付知识完成审核, **When** 后续请求进行历史召回, **Then** 该知识 **SHALL** 能作为可解释候选参与排序，并保留原 Task/verification 来源。
9. **AC-9**: **Given** 系统建议知识失效、替代或历史处理方式, **When** 用户尚未确认, **Then** 系统 **SHALL NOT** 自动修改知识状态、Decision、Spec 或验收约束。
10. **AC-10**: **Given** legacy Spec 没有新治理字段, **When** 项目采用本能力, **Then** 系统 **SHALL** 保持其可读和可检索，不得要求批量迁移才能继续工作。
11. **AC-11**: **Given** Phase 1 的 Brief 和 Guided Assist 调用方, **When** 本能力上线, **Then** 现有输入、稳定字段、显式 topic 语义和人工门禁 **SHALL** 保持兼容。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 有效性解释覆盖率 | 0% 独立知识有效性 | 新治理结果 100% | 检查有效性、依据、时间和来源字段 |
| 历史处理声明覆盖率 | 0% 统一契约 | 新 standard/governed L1/L2 100% | 按审批规格统计四态声明 |
| 关键 AC readiness | 项目 21/128 | 新 governed L3 100% | readiness 与 evidence 报告 |
| 上位规格提前完成事故 | 已观察 1 次 | 新治理规格为 0 | 比较声明子级与实际子级、级联结果 |
| 交付知识结论覆盖率 | 待测量 | 新完成 Task 100% | 检查结论或无新增知识声明 |
| 替代/失效可追溯率 | 待测量 | 100% | 检查替代来源或原因 |
| Phase 1 回归 | 81 个文件、972 个测试通过 | 不低于基线 | 全量回归和 CLI smoke |

## 范围边界

- **做**:
  - 建立独立于实施状态的知识有效性及其依据。
  - 建立 reuse/change/reject/unknown 历史处理声明和审批提示。
  - 将关键历史约束连接到 L3 AC 与 verification evidence。
  - 建立父规格计划子级完整性，防止未建范围被提前级联。
  - 将 Task 结果沉淀为可审核、可检索的交付知识。
  - 提供有效性、继承、AC、范围完整性和反馈价值指标。
- **不做**:
  - 不删除或静默重写历史 Spec、Decision、Task 和 evidence。
  - 不批量伪造所有 legacy 资产的有效性与处理声明。
  - 不允许系统自动确认知识失效、替代或业务冲突决策。
  - 不改变 Phase 1 的纯本地和确定性原则。
  - 不引入角色 Agent、远程服务或必须联网的索引。
- **推迟**:
  - 本地语义索引与混合召回。
  - 能力知识图谱与可视化治理界面。
  - 历史资产的辅助批量迁移。
  - 多角色 Agent 消费同一知识上下文。

## 设计原则

1. **有效性与实施分离** — delivered 不等于 current。违反判断:系统仅凭 implemented 判断知识仍有效。
2. **历史不可抹除** — 失效和替代通过追加状态与来源表达。违反判断:治理操作删除或覆盖原始结论。
3. **处理声明可验证** — 四态声明必须影响设计、AC 或交付结果。违反判断:声明只用于填表，后续无任何引用或验证。
4. **范围先建模后完成** — 计划子级必须在上位规格完成前可机器判断。违反判断:未创建的计划范围不参与级联门禁。
5. **人工掌握语义变化** — 系统只建议，不自行改变知识含义。违反判断:Task 完成或检索自动标记历史失效。
6. **向前治理优先** — legacy 默认兼容，新资产先达到完整闭环。违反判断:启用能力前强制批量修改全部历史。
7. **沿用 Phase 1 入口** — 不创建第二套 Brief 或平行知识库。违反判断:用户必须在多个历史入口间选择。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Knowledge State：有效性、依据、替代/失效来源和兼容投影 | `spec-knowledge-loop-L1` implemented | P1 |
| Phase 2 | History Disposition：四态处理声明、审批冲突与关键 AC 继承 | Phase 1 | P1 |
| Phase 3 | Delivery Learning：范围完整性、交付知识反馈和治理指标 | Phase 2 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| 知识有效性与历史处理契约 | Phase 1–2 | 1 |
| 范围完整性、交付学习与治理度量 | Phase 3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 有效性成为第二套复杂状态机 | 用户难以理解或状态冲突 | 明确与实施状态正交，保持少量状态和来源依据 |
| 四态声明增加审批成本 | 用户形式化填写或绕过 | 只要求处理 Top 5 中的关键历史，提供建议但保留人工确认 |
| 自动提炼交付知识产生错误结论 | 错误经验被后续复用 | 结论进入召回前必须审核，始终保留 Task/evidence 来源 |
| 子级完整性要求与渐进设计冲突 | 用户尚未知道全部子级时无法推进 | 允许显式声明范围未定，但不得声称上位规格全部完成 |
| legacy 缺少治理字段 | 初期覆盖率偏低 | 向前治理并按使用频率修复，不阻塞读取和检索 |
| 与 Decision、Profile、Delivery 能力重复 | 形成平行模型 | 复用现有状态、evidence 和报告，只补缺失契约 |

## 关联

- based_on: `spec-knowledge-loop-L1` — 承接已完成跨 topic 召回之后的知识治理闭环。
- references: `critical-ac-readiness-L1` — 复用关键 AC readiness 与修复建议原则。
- references: `delivery-summary-L1` — 复用交付事实、verification 和残余风险摘要。
- references: `adaptive-profile-intelligence-L1` — 复用本地治理度量与可解释推荐。
