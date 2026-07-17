---
code: spec-knowledge-governance-L2.2
level: L2
title: 'Scope Completeness, Delivery Learning, and Governance Metrics'
topic: spec-knowledge-governance
parentCode: spec-knowledge-governance-L1
status: implemented
aiSummary: >-
  设计 Phase 3：以可选 scopePlan 阻断 open/missing/incomplete 计划子级的生命周期级联；以人工审核的
  Delivery Knowledge 连接 Task、verification、Lessons 与 Brief；并提供只读 scope、处置、交付和
  evidence 治理指标。
relations:
  - type: based_on
    target: spec-knowledge-governance-L1
  - type: references
    target: spec-knowledge-governance-L2.1
  - type: references
    target: delivery-summary-L2.1
  - type: references
    target: adaptive-profile-intelligence-L2.1
created: '2026-07-16T05:34:22.474Z'
updated: '2026-07-16T07:30:19.866Z'
changeSummary: 'cascade: task-complete'
---
# Scope Completeness, Delivery Learning, and Governance Metrics — 技术设计

## 方案概述

本 L2 补齐 `spec-knowledge-governance-L1` 的 Phase 3。第一条链路在 L1/L2 frontmatter 中增加可选 `scopePlan`，区分范围尚未收敛与固定子级清单；生命周期级联只有在固定清单中的子级全部存在且完成后才可推进。第二条链路把 Task 交付结论保存为带 Task、verification 来源的 Delivery Knowledge 草稿，必须经过显式人工审批才进入 Brief/Lessons 检索。第三条链路复用项目快照输出只读治理指标。

现有 `spec-knowledge-governance-L1` 曾在只创建 `spec-knowledge-governance-L2.1` 时被级联为 implemented，而交付物分解仍声明第二个 L2；该事实作为 scopePlan 门禁的回归夹具，不通过静默改写历史状态掩盖。

```text
[L1/L2 scopePlan]
  open -----------------------------> cascade blocked: scope unresolved
  fixed + planned children
              |
              v
   [existence + completion gate] ---> lifecycle cascade

[Task + verification evidence]
              |
              v
 [delivery knowledge draft / none]
              |
       explicit human review
              v
 [approved knowledge registry] ---> Brief / Lessons retrieval
              |
              v
 [read-only governance metrics]
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 计划子级表达 | A: 从现有子级反推；B: 上位 Spec 显式 `scopePlan`；C: 独立数据库 | B（本 L2 提案） | 未创建的范围无法从文件树反推，必须在完成前成为版本化事实 |
| 范围未定语义 | A: 允许级联；B: `open` 明确阻断 implemented；C: 自动猜测子级 | B（本 L2 提案） | “尚未决定”不能等价于“全部完成”，同时允许渐进设计继续处于 confirmed |
| legacy 兼容 | A: 无 scopePlan 全部阻断；B: 无字段沿用旧行为，新治理规格显式采用；C: 批量迁移 | B（本 L2 提案） | 不破坏历史工作流，向前消除相同事故 |
| 已 implemented 规格新增子级 | A: 静默接受；B: 默认拒绝并报告 lifecycle drift；C: 自动降级状态 | B（本 L2 提案） | 自动逆转状态会破坏审计；新增范围必须走显式修复流程 |
| 交付知识存储 | A: 写回 Task 摘要；B: 版本化 Delivery Knowledge 注册表；C: 直接生成 Decision | B（本 L2 提案） | 原 Task/evidence 保持不可变，知识审核状态与交付状态正交 |
| Task 完成门禁 | A: 所有历史 Task 强制补录；B: 新治理 Task 要求结论或显式 none；C: 完成后异步补录 | B（本 L2 提案） | 新任务闭环完整且不阻塞 legacy；“无新增知识”也是可审计结论 |
| 知识进入召回 | A: Task 完成自动发布；B: 人工 approve 后进入候选；C: 所有 draft 低权重进入 | B（本 L2 提案） | 防止自动提炼错误经验污染后续迭代，符合 AC-8/AC-9 |
| 指标持久化 | A: 每次写统计快照；B: 基于事实文件只读计算；C: 远程遥测 | B（本 L2 提案） | 避免统计漂移和隐式写入，保持纯本地、可复现 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/schemas/spec.ts` | 修改 | 可选 scopePlan、范围模式和计划子级 schema | schema、去重、层级与 legacy 回归 |
| `src/core/lifecycle.ts` | 修改 | 级联前校验 open/fixed、计划子级存在性与完成状态 | 缺失子级、未完成子级、完整清单、legacy 测试 |
| `src/core/spec-policy.ts` | 修改 | 创建子级时检测 implemented ancestor drift；更新 scopePlan 的策略校验 | 拒绝新增范围与显式修复路径测试 |
| `src/core/task-completion.ts` | 修改 | 新治理 Task 增加 delivery knowledge declaration gate | declaration/none、事务回滚与 legacy 测试 |
| `src/core/delivery-knowledge.ts` | 新增 | 注册表、Task/evidence 来源校验、草稿/审批/拒绝与投影 | 状态、来源、原子写入和审核权限测试 |
| `src/core/delivery-summary.ts` | 修改 | 显示交付知识结论、审核状态和下一步 | 报告兼容与 finding 测试 |
| `src/core/lessons.ts` | 修改 | 仅将 approved Delivery Knowledge 投影为 Lesson 候选 | 排序、来源解释和 draft 排除测试 |
| `src/core/capability-brief.ts` | 修改 | 在既有检索中合并 approved delivery candidates | `agent-brief.v1` 兼容、topic 与上限测试 |
| `src/core/knowledge.ts` | 修改 | 扩展 `lesson:delivery:<id>` canonical source ref | parse/validate/resolve 测试 |
| `src/core/knowledge-metrics.ts` | 新增 | 聚合 scope、validity、disposition、delivery 和 evidence 指标 | topic/project、空项目与确定性测试 |
| `src/cli/project.ts` | 修改 | scope readiness 和 knowledge metrics 只读命令 | 文本/JSON 与 store-aware 测试 |
| `src/cli/task.ts` | 修改 | delivery knowledge declare/none/review 命令 | CLI 状态、错误码和人工门禁测试 |

## 数据模型

### Scope Plan

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| SpecFrontmatter | scopePlan | ScopePlan? | 新增 | undefined | 是 |
| ScopePlan | mode | open/fixed | 新增 | 必填 | 是 |
| ScopePlan | plannedChildren | PlannedChild[] | 新增 | `[]` | 是 |
| ScopePlan | reason | string? | 新增 | open 时必填 | 是 |
| ScopePlan | updatedAt | ISO datetime | 新增 | 更新时生成 | 是 |
| PlannedChild | code | specCode | 新增 | 必填且唯一 | 是 |
| PlannedChild | title | string | 新增 | 必填 | 是 |
| PlannedChild | required | boolean | 新增 | true | 是 |

`fixed` 的 required 子级必须全部存在、直接指向声明者且为 implemented；可选子级只在已创建时要求完成。`open` 始终阻断声明者进入 implemented。无 scopePlan 的 legacy Spec 沿用现有按实际子级判断的级联语义。

### Delivery Knowledge Registry

注册表 schemaVersion 为 `delivery-knowledge.v1`，位于解析后的 `.spec-manager/delivery-knowledge.json`。

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| DeliveryKnowledge | id | DK-NNN | 新增 | 顺序生成 | 是 |
| DeliveryKnowledge | topic | string | 新增 | 从 Spec 推导 | 是 |
| DeliveryKnowledge | specCode | string | 新增 | 必填 | 是 |
| DeliveryKnowledge | taskId | string | 新增 | 必填 | 是 |
| DeliveryKnowledge | conclusion | validated/invalidated/discovered/none | 新增 | 必填 | 是 |
| DeliveryKnowledge | summary | string | 新增 | none 外必填 | 是 |
| DeliveryKnowledge | evidenceRefs | string[] | 新增 | 非 none 至少 1 条 | 是 |
| DeliveryKnowledge | affectedCriteria | string[] | 新增 | `[]` | 是 |
| DeliveryKnowledge | status | draft/approved/rejected | 新增 | draft | 是 |
| DeliveryKnowledge | reviewReason | string? | 新增 | reject 时必填 | 是 |
| DeliveryKnowledge | createdAt/reviewedAt | ISO datetime | 新增 | reviewedAt 可空 | 是 |

同一 Task 只能存在一个当前 declaration；修改 draft 使用原 ID，approved/rejected 记录不可被静默覆盖。approved 记录通过 `lesson:delivery:<DK-ID>` 参与检索，并保留 `task:<specCode>:<taskId>` 与 verification ID 来源。

## 接口契约

### `spec-manager spec scope set <code> --mode <open|fixed> [--children <code:title,...>] --reason <text>`

- open 必须提供 reason；fixed 必须至少声明一个 required child 或提供“叶节点”显式标记。
- planned code 必须符合目标层级编号，但允许尚未创建。
- 对 implemented Spec 的 scopePlan 修改返回 drift，需要显式 remediation 命令，不自动降级。

### `spec-manager project readiness scope [--topic <topic>] [--json]`

```json
{
  "schemaVersion": "scope-readiness.v1",
  "summary": { "ready": 1, "blocked": 1, "legacy": 200 },
  "items": [{
    "specCode": "spec-knowledge-governance-L1",
    "mode": "fixed",
    "status": "blocked",
    "missingChildren": ["spec-knowledge-governance-L2.2"],
    "incompleteChildren": []
  }]
}
```

### `spec-manager task knowledge declare <taskId> --spec <code> --conclusion <type> --summary <text> --evidence <V-ID,...> [--criteria <AC-ID,...>]`

- Task 和 verification 必须存在且相互归属；非 none 必须引用至少一个成功 evidence。
- `none` 使用 `task knowledge none` 快捷命令并要求简短 reason。
- 新治理 Task 完成前缺少 declaration 返回 `DELIVERY_KNOWLEDGE_REQUIRED`，事务不提交。

### `spec-manager task knowledge review <DK-ID> --decision <approve|reject> [--reason <text>]`

- 仅显式人工命令改变 draft；reject 必须给 reason。
- approve 前重新校验 Task/evidence/AC 来源；失效来源返回错误且保持 draft。
- approve 不修改 Knowledge Annotation、Decision 或原 Task。

### `spec-manager project knowledge metrics [--topic <topic>] [--json]`

响应包含 validity 五态、history disposition 四态及覆盖率、scope ready/blocked/legacy、delivery draft/approved/rejected/none、approved 召回覆盖率、关键 AC evidence 覆盖。该命令只读，不生成或修复记录。

### 错误契约

| 错误码 | 触发条件 |
|---|---|
| `SCOPE_PLAN_OPEN` | 范围尚未收敛却尝试级联 |
| `SCOPE_CHILD_MISSING` | required 计划子级未创建 |
| `SCOPE_CHILD_INCOMPLETE` | required/已创建 optional 子级未完成 |
| `LIFECYCLE_SCOPE_DRIFT` | implemented Spec 下新增或修改范围 |
| `DELIVERY_KNOWLEDGE_REQUIRED` | 新治理 Task 完成前无结论/none |
| `DELIVERY_EVIDENCE_NOT_FOUND` | evidence 不存在或不属于 Task |
| `DELIVERY_EVIDENCE_NOT_SUCCESSFUL` | 非 none 只引用失败 evidence |
| `DELIVERY_REVIEW_REASON_REQUIRED` | reject 缺少理由 |
| `DELIVERY_KNOWLEDGE_IMMUTABLE` | 尝试覆盖已审核记录 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| legacy Spec 无 scopePlan | 无法判断未创建范围 | 保留旧级联语义并在 readiness 标记 legacy | 高频 topic 人工补 scopePlan |
| open scope 长期未收敛 | 上位 Spec 不完成 | 报告 blocker 与 reason，不猜测 child | 人工切换 fixed 并声明清单 |
| planned child code 写错 | 永久 missing | readiness 给出精确 code 与修复命令 | 更新未完成 Spec 的 scopePlan |
| registry 损坏 | 交付知识不可审阅/检索 | 完成门禁失败关闭；只读报告返回稳定错误 | 从版本控制恢复 |
| Task 无新知识 | 形式化成本 | `none + reason` 满足闭环，不制造空知识 | 无需恢复 |
| approved 来源后来失效 | 检索可能误导 | resolver 展示 invalidated/unknown，不删除记录 | 人工更新知识有效性或新增替代 |
| 指标单项解析失败 | 报告不完整 | 收集 invalidProjections，其他项目继续计算 | 修复源文件后重跑 |

## 向后兼容

- **Spec**: scopePlan 可选；legacy 生命周期保持当前行为，不批量迁移。
- **Task**: 只有显式启用 delivery learning 的新 Task 执行完成门禁；历史 Task 仍可读。
- **Brief**: 保留 `agent-brief.v1`、显式 topic、原数组与上限；仅增加 approved delivery Lesson 候选和可选解释。
- **Delivery**: `delivery-summary.v1` 只增加可选 deliveryKnowledge，不改变 verification、artifact 和 nextAction 原字段。
- **状态**: 不自动把已 implemented Spec 逆转；历史 scope drift 由 readiness 暴露并走显式 remediation。
- **存储**: 所有新 JSON 跟随解析后的 write root，contextSources 只读。

## 关键交互流程

```text
设计者 set scopePlan(open)
  -> 逐步拆解范围
  -> set scopePlan(fixed + plannedChildren)
  -> 创建全部 required child
  -> 子 Task complete
  -> cascade 校验 planned vs actual
       missing/incomplete -> 上位状态保持不变 + 提示
       complete           -> 正常级联
```

```text
Task 执行 + verification
  -> declare validated/invalidated/discovered 或 none
  -> task complete 校验 declaration
  -> Delivery Knowledge 保持 draft
  -> 人工 review approve/reject
  -> approved 才进入 Lessons/Brief
  -> metrics 从事实文件只读聚合
```

## 可观测性

- **完成反馈**: Task completion 的 skippedSpecs 增加 scope-open、child-missing、child-incomplete 精确原因。
- **审计**: scopePlan 更新、delivery declaration/review 与显式 remediation 记录操作者动作和旧/新摘要。
- **指标**: scope 完整率、交付结论覆盖率、approved 比率、召回覆盖率、处置覆盖率与 evidence 覆盖率。
- **告警**: implemented ancestor 新增 child、approved delivery 来源失效和 registry 损坏为 warning/blocking finding。
- **隐私**: 不向仓库外发送 Task、evidence、知识正文或指标。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| 生命周期级联 | `src/core/lifecycle.ts` | `cascadeImplementedHierarchy` | 在既有子级完成判断前加入 scopePlan 门禁 |
| Task 完成事务 | `src/core/task-completion.ts` | `runTaskCompletion` | 将 declaration 校验纳入状态写入与级联同一事务 |
| Evidence 投影 | `src/core/task-evidence.ts` | `buildTaskEvidence`、`evaluateEvidenceCoverage` | 校验 verification 与 AC 来源 |
| Delivery 报告 | `src/core/delivery-summary.ts` | `buildDeliverySummary` | 增量展示交付知识状态和审核下一步 |
| 项目快照 | `src/core/project-snapshot.ts` | `buildProjectSnapshot` | 一次装载 Spec、Task、Decision 和关系索引 |
| Profile 指标 | `src/core/profile-metrics.ts` | `buildProfileMetrics` | 复用 topic 过滤、空值和 invalid projection 模式 |
| 知识注册表 | `src/core/knowledge.ts` | canonical source ref、resolver | 统一 approved delivery 的有效性和来源解释 |
| Lessons | `src/core/lessons.ts` | `buildLessonsReport` | 把 approved delivery 投影到既有经验入口 |
| 原子事务 | `src/core/transaction.ts` | `withProjectTransaction` | scope、delivery 和 Task completion 失败回滚 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| spec-knowledge-governance-L3.2.1-scope | scopePlan schema、scope readiness、创建 drift 检测和 lifecycle cascade 完整性门禁 | 本 L2 frozen |
| spec-knowledge-governance-L3.2.2-learning | Delivery Knowledge 注册表、Task 完成门禁、人工 review、Delivery/Brief/Lessons 投影与治理 metrics | L3.2.1 implemented |

在首个 L3 进入 frozen 前，两份 L3 必须同时创建并写入非空正文。L3.2.1 必须把本 topic 已观察到的提前完成事实固定为回归用例。

## 关联

- based_on: `spec-knowledge-governance-L1` — 本 L2 负责 Phase 3 的范围完整性、交付学习和治理度量。
- references: `spec-knowledge-governance-L2.1` — 复用有效性、history disposition 和 canonical source ref。
- references: `delivery-summary-L2.1` — 复用 Delivery Summary 与 verification 来源投影。
- references: `adaptive-profile-intelligence-L2.1` — 复用只读本地指标和 topic 过滤模式。
