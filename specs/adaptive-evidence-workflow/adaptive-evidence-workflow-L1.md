---
code: adaptive-evidence-workflow-L1
level: L1
title: 风险自适应工作流与验收证据图
topic: adaptive-evidence-workflow
parentCode: null
status: implemented
aiSummary: >-
  定义 quick、standard、governed 三档风险 Profile；显式启用以保持兼容；governed 强制关键 AC
  成功证据全覆盖，standard 仅提示，并提供统一交付证据报告与可覆盖的 Profile 推荐。
created: '2026-06-15T09:58:09.164Z'
updated: '2026-06-16T01:30:08.283Z'
changeSummary: 'cascade: task-complete'
---
# 风险自适应工作流与验收证据图 — 需求文档

## 背景

spec-manager 当前对新功能和非平凡工作采用 L1 PRD → L2 Design → L3 Impl → Agent Task 的完整治理路径，并对 Task 步骤、验证命令、成功 verification、决策卡片和状态级联提供完成门禁。项目当前已有 90 条 Spec，其中 89 条 implemented、1 条 frozen；已有 60 个 completed Agent Task；自动化测试基线为 46 个测试文件、572 个测试全部通过，项目诊断为 ok。

现有能力证明完整治理路径能够提供可靠的执行留痕，但也暴露出两个相反的问题：

1. **治理强度与变更风险未分级**：除受限 quick 例外外，常规功能与高风险功能使用同一条完整路径。中等风险工作需要承担完整三层审核成本，而高风险工作又只满足相同的最低完成门禁。
2. **验收证据存在但无法证明完整覆盖**：verification 已支持记录 `coversAc`，当前完成条件只要求至少一条成功 verification，不强制关键验收标准全部被证据覆盖。因此“任务完成”能够证明执行过验证，但不能证明所有关键业务结果均已验证。
3. **完成证据分散**：Spec、Task、步骤、verification、artifact 和决策均已存在，但用户缺少一份面向验收和交付的统一证据视图。
4. **兼容性约束要求渐进采用**：项目已经发布多个版本并支持多种 Agent 工具。若新门禁自动作用于所有既有项目和任务，将造成已有合法工作流突然失败。

外部 SDD 实践也显示，固定重量的流程容易对小型和中型改动造成审查负担，而可靠 Agent 工程需要把关键意图连接到可执行验证和反馈证据。下一阶段应在不削弱现有治理能力的前提下，让工作流强度随风险变化，并将关键验收标准与交付证据形成闭环。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 流程适配 | quick 与完整三层流程之间没有中间治理档位 | P1 | 当前方法论仅定义 quick 例外和完整 L1/L2/L3 路径 |
| 验收可信度 | `coversAc` 可记录但关键 AC 完整覆盖属于目标能力，未形成完成门禁 | P1 | `docs/methodology.md` 门禁能力矩阵 |
| 交付可读性 | 完成证据分布在多个对象中，缺少统一验收视图 | P1 | 当前 Spec、Task、verification、decision 分离展示 |
| 渐进采用 | 新门禁若默认启用，会破坏现有项目和自动化脚本 | P1 | 已发布 v0.4.1，支持多 Agent 和既有项目 |
| 风险判断 | 用户缺少一致标准判断工作应采用何种治理强度 | P2 | 当前主要依赖 quick 边界和人工判断 |

## 用户故事

### Must have

- As a **项目维护者**, I want **为工作显式选择 quick、standard 或 governed Profile**, so that **治理投入与变更风险相匹配**
- As a **高风险功能负责人**, I want **governed 工作只有在全部关键 AC 具有成功验证证据时才能完成**, so that **完成状态能够证明关键业务结果已被验证**
- As a **验收者**, I want **查看一份连接 Spec、Task、关键 AC、verification 和 artifact 的证据报告**, so that **我可以快速判断交付是否满足验收要求**
- As a **现有项目用户**, I want **未显式启用 Profile 时保持当前行为**, so that **升级不会导致已有合法工作流和脚本突然失败**

### Should have

- As a **工作发起者**, I want **根据变更特征获得 Profile 推荐和推荐理由**, so that **我可以用一致标准选择治理强度**
- As a **standard 工作执行者**, I want **看到未覆盖关键 AC 的提示但仍可按现有门禁完成**, so that **常规工作获得更强反馈而不承担 governed 的强制成本**
- As a **审计者**, I want **证据报告明确区分已覆盖、未覆盖、失败和未要求的 AC**, so that **报告不会把“存在验证”误表达为“完成覆盖”**

### Could have

- As a **团队负责人**, I want **按 Profile 汇总任务数量、完成率和证据覆盖率**, so that **我可以评估不同治理强度的实际效果**

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| 工作流分级 | 仅 quick 例外与完整三层路径 2 类 | 提供 quick、standard、governed 3 个显式 Profile |
| Profile 采用兼容性 | 无 Profile 配置，所有现有流程按当前规则运行 | 未显式启用时 100% 保持当前完成语义 |
| 关键 AC 证据覆盖 | `coversAc` 可选记录，完整覆盖不强制 | governed Task 完成时 100% 关键 AC 具有成功 verification 覆盖 |
| 常规工作反馈 | standard Profile 不存在 | standard Task 完成前报告未覆盖关键 AC，但不新增强制阻断 |
| 统一交付证据 | 需分别读取多个对象 | 单一证据报告展示 Profile、关键 AC 覆盖、验证结果、artifact、Task 与 Spec 状态 |
| Profile 推荐 | 无统一推荐结果 | 对每次推荐输出一个 Profile 和至少一条可读理由 |

## 验收标准

1. **AC-1**: **Given** 一个已显式启用风险自适应工作流的项目, **When** 用户为新工作选择治理方式, **Then** 系统 **SHALL** 支持 quick、standard、governed 三个 Profile，并清楚说明每个 Profile 的审核与验收强度。
2. **AC-2**: **Given** 一个 governed Task 存在一个或多个关键 AC, **When** 用户尝试完成 Task, **Then** 系统 **SHALL** 在任一关键 AC 没有成功 verification 证据覆盖时阻止完成，并列出未覆盖项。
3. **AC-3**: **Given** 一个 governed Task 的全部关键 AC 均有成功 verification 证据覆盖且其他既有完成条件满足, **When** 用户完成 Task, **Then** 系统 **SHALL** 允许完成并保留覆盖关系。
4. **AC-4**: **Given** 一个 standard Task 存在未覆盖的关键 AC, **When** 用户完成 Task, **Then** 系统 **SHALL** 明确提示未覆盖项，但 **MUST** 不因证据覆盖不完整而新增阻断。
5. **AC-5**: **Given** 一个 quick 工作, **When** 用户执行和完成该工作, **Then** 系统 **SHALL** 保持 quick 的受限轻量边界，且 **MUST** 不要求创建完整 L1/L2/L3 链路。
6. **AC-6**: **Given** 一个已产生 verification 的 Task, **When** 用户查看交付证据, **Then** 系统 **SHALL** 展示关联 Profile、Spec、Task、关键 AC 的覆盖状态、verification 结果和 artifact，并区分成功、失败、未覆盖与未要求状态。
7. **AC-7**: **Given** 一个未显式启用风险自适应工作流的现有项目, **When** 用户升级并继续执行既有工作流, **Then** 系统 **SHALL** 保持当前状态流转和 Task 完成语义，不自动应用 governed 证据覆盖门禁。
8. **AC-8**: **Given** 用户请求 Profile 推荐, **When** 系统完成风险判断, **Then** 系统 **SHOULD** 返回一个推荐 Profile、影响判断的风险特征和可由用户覆盖的说明。
9. **AC-9**: **Given** 用户显式覆盖系统推荐的 Profile, **When** 工作继续推进, **Then** 系统 **SHALL** 使用用户选择的 Profile，并保留覆盖选择及理由供后续审计。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| governed 关键 AC 成功证据覆盖率 | 当前不强制，待测量 | 已完成 governed Task 为 100% | 汇总已完成 Task 的关键 AC 与成功 verification 关系 |
| standard 未覆盖 AC 可见率 | 当前无统一提示 | 100% standard Task 完成结果报告未覆盖关键 AC | 检查完成结果与证据报告 |
| 旧项目升级兼容率 | 当前行为基线为现有测试与合法工作流 | 未启用 Profile 的既有兼容测试 100% 通过 | 兼容测试与已安装 CLI 验证 |
| 证据报告对象覆盖 | 当前需分别读取至少 Spec、Task、verification | 单份报告覆盖 Profile、Spec、Task、AC、verification、artifact 6 类信息 | 证据报告验收测试 |
| Profile 推荐采纳率 | 待测量 | 上线后持续测量，不设首版硬目标 | 对比推荐 Profile 与最终选择 |
| 各 Profile 完成耗时与失败率 | 待测量 | 建立可比较基线 | 按 Profile 汇总 Task 周期和失败状态 |

## 范围边界

- **做**:
  - 定义 quick、standard、governed 三档 Profile 及其用户可理解的治理差异
  - 支持项目显式启用风险自适应工作流
  - governed 强制关键 AC 成功证据全覆盖
  - standard 提示关键 AC 未覆盖但不新增阻断
  - 提供统一交付证据报告
  - 提供可覆盖的 Profile 推荐及理由
- **不做**:
  - 不自动迁移或加严未显式启用 Profile 的现有项目
  - 不在首版增加 regulated 第四档 Profile
  - 不引入云端服务、遥测或远端数据库
  - 不使用 AI 自动判定业务结果是否真实正确
  - 不替代人工产品验收和风险接受
- **推迟**:
  - 按行业提供安全、金融或合规模板
  - 团队级 Profile 策略分发和组织仪表盘
  - 基于历史结果自动调整 Profile 推荐
  - Brownfield source fact 与代码漂移检测

## 设计原则

1. **风险匹配而非流程统一** — 治理强度必须随工作风险变化。违反判断: quick、standard、governed 最终使用完全相同的产物和完成门禁。
2. **证据不替代判断** — 系统只证明已记录的验证与 AC 覆盖关系，不宣称自动证明完整业务正确性。违反判断: 仅因 verification 成功就宣称功能已通过人工或真实环境验收。
3. **显式启用与显式覆盖** — Profile 门禁和用户覆盖选择必须可见、可追溯。违反判断: 升级后旧项目被静默加严，或用户选择无法从历史记录中确认。
4. **向后兼容优先** — 未启用新能力的项目继续遵循当前语义。违反判断: 现有合法 Task 因缺少 Profile 或 AC 覆盖数据而无法完成。
5. **本地事实源** — Profile、覆盖关系和证据报告的事实必须保存在本地项目中。违反判断: 无网络时无法判断 Task 是否满足完成条件或查看证据。
6. **确定性门禁** — governed 完成门禁必须依据结构化状态和验证结果，而不是自然语言自评。违反判断: Agent 声称“全部覆盖”即可绕过缺失的成功 verification。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Profile 定义、显式启用与兼容行为 | 现有工作流和项目配置能力 | P1 |
| Phase 2 | 关键 AC 标识与 governed 完成门禁 | Phase 1、现有 verification 能力 | P1 |
| Phase 3 | 统一交付证据报告与 standard 覆盖提示 | Phase 2 | P1 |
| Phase 4 | Profile 推荐、用户覆盖记录与效果度量 | Phase 1-3 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| 风险 Profile 与渐进采用策略 | Phase 1 | 1 |
| 关键 AC 与证据覆盖策略 | Phase 2 | 1 |
| 交付证据视图与覆盖反馈 | Phase 3 | 1 |
| Profile 推荐与方法论度量 | Phase 4 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| Profile 差异不够清晰 | 用户无法稳定选择，最终仍全部使用同一档位 | 为每档定义明确适用边界、必需产物和完成语义 |
| 关键 AC 标识被滥用 | 用户通过少标或不标关键 AC 绕开 governed 门禁 | 在审核阶段明确关键 AC，并在证据报告中展示未标记情况 |
| 证据覆盖形成形式主义 | verification 关联 AC 但未真正验证业务结果 | 保留人工验收边界，报告展示验证内容和 artifact 而不只展示覆盖数量 |
| 新能力破坏既有流程 | 用户升级后合法任务失败 | 默认不启用、提供兼容测试并允许渐进采用 |
| 推荐规则过度自信 | 用户错误依赖系统推荐 | 推荐必须展示理由、允许覆盖并记录最终选择 |

## 关联

- based_on: `constraint-closed-loop-L1` 已实现机器可校验验收、验证层级和完成门禁基础
- based_on: `harness-coding-L1` 已实现 Task context、执行回写、结构化 verification 与偏差闭环
- based_on: `methodology-hardening-L1` 已明确系统保证、人工门禁与目标能力边界
- based_on: `spec-manager-ai-ux-L1` 已定义 quick 与完整工作流的使用体验基础
