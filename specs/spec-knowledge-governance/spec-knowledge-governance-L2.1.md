---
code: spec-knowledge-governance-L2.1
level: L2
title: Knowledge Validity and History Disposition Contract
topic: spec-knowledge-governance
parentCode: spec-knowledge-governance-L1
status: implemented
aiSummary: >-
  设计独立于生命周期的知识有效性覆盖层、canonical source ref 与人工写入契约，并以结构化 historyReview 记录
  reuse/change/reject/unknown，新增渐进式 L1/L2 确认门禁、Brief 可选投影和关键 AC 影响追踪；拆分为
  validity registry 与 disposition integration 两个 L3。
relations:
  - type: based_on
    target: spec-knowledge-governance-L1
  - type: references
    target: spec-knowledge-loop-L2.1
  - type: references
    target: critical-ac-readiness-L2.1
created: '2026-07-16T03:19:31.068Z'
updated: '2026-07-16T04:07:11.798Z'
changeSummary: 'cascade: task-complete'
---
# Knowledge Validity and History Disposition Contract — 技术设计

## 方案概述

本 L2 落地 `spec-knowledge-governance-L1` 中知识有效性、历史处置和关键验收标准连续性契约。核心设计是把“工作流状态”和“知识是否仍然可信”拆成两个正交维度：Spec、Decision、Task/Lesson 与 AC 继续使用原有文件和生命周期；新增本地知识覆盖层，以统一来源引用记录 `current`、`historical`、`superseded`、`invalidated` 或 `unknown`，并由读取侧确定性解析最终状态。

新规格通过结构化 `historyReview` 接收 Brief 返回的历史来源，并逐项记录 `reuse`、`change`、`reject` 或 `unknown`。对于进入治理范围的新 L1/L2，确认前必须处置全部已附加来源；缺少相关历史时必须记录原因。历史规格无需迁移，未显式审阅且无法从现有事实安全推导时统一解析为 `unknown`。

```text
[Spec / Decision / Task / Lesson / AC]
                 |
                 v
        [canonical source ref]
                 |
       +---------+----------+
       |                    |
       v                    v
[existing facts]   [knowledge registry]
       |                    |
       +---------+----------+
                 v
       [validity resolver: read-only]
                 |
        +--------+---------+
        |                  |
        v                  v
 [Brief projection] [historyReview gate]
                           |
                           v
               [confirmed L1 / L2]
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 有效性与生命周期关系 | A: 扩展 `SpecStatus`；B: 独立知识覆盖层；C: 仅依赖文字说明 | B（本 L2 提案） | `implemented` 只证明曾经交付，不能证明知识当前正确；正交模型避免破坏现有状态机 |
| 覆盖层存储 | A: 回写每类来源文件；B: 单一版本化本地注册表；C: SQLite | B（本 L2 提案） | 统一处理多类来源、保持源资产不可变，并复用原子 JSON 事务能力 |
| 来源标识 | A: 裸 ID；B: 类型化 canonical source ref；C: 文件路径 | B（本 L2 提案） | Decision ID 可能跨 topic 重复，文件路径又受 store 模式影响；类型化引用稳定且可校验 |
| 未审阅历史的默认值 | A: `current`；B: `historical`；C: `unknown` | C（本 L2 提案） | 缺少证据时不能制造可信结论，`unknown` 能显式推动后续人工审阅 |
| 状态写入权限 | A: 检索自动更新；B: 建议后自动更新；C: 仅显式人工命令写入 | C（本 L2 提案） | 检索和报告保持只读，知识判定必须可追责且不能被相关性评分替代 |
| 历史处置位置 | A: 自由文本；B: Spec frontmatter 结构化字段；C: 只存在 Task | B（本 L2 提案） | 处置与新规格共同评审、可被门禁验证，也能随 Spec 一起版本化 |
| 确认门禁适用范围 | A: 阻断全部历史 Spec；B: 仅阻断带治理标记或已附加来源的新 L1/L2；C: 永不阻断 | B（本 L2 提案） | 可渐进采用，不要求一次性迁移存量，同时保证新治理链路真实闭环 |
| Brief 契约演进 | A: 升级 schema 主版本；B: 在 `agent-brief.v1` 增加可选知识投影；C: 新建平行 Brief | B（本 L2 提案） | 旧消费者继续读取原字段，新消费者获得有效性与处置入口，不产生第二套检索事实源 |
| 关键 AC 连续性 | A: 仅复制文本；B: 用 `ac:<specCode>:<AC-ID>` 建立来源引用并记录影响；C: 仅靠人工记忆 | B（本 L2 提案） | AC 身份稳定、影响可审计，并为后续 readiness 与 Task 验证复用提供统一锚点 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/paths.ts` | 修改 | 为解析后的 write root 增加知识注册表路径 | 默认/store 模式路径单元测试 |
| `src/core/knowledge.ts` | 新增 | canonical source ref、注册表读写、有效性解析和来源存在性校验 | 各来源类型、优先级、失效引用和稳定序列化测试 |
| `src/schemas/spec.ts` | 修改 | 增加可选 `historyReview`、处置枚举和字段校验 | schema 接受/拒绝与旧 frontmatter 回归测试 |
| `src/core/spec-policy.ts` | 修改 | 对进入治理范围的 L1/L2 执行历史处置完整性检查 | 确认门禁、无历史理由和 legacy 兼容测试 |
| `src/core/capability-types.ts` | 修改 | 为 Brief 来源增加可选知识有效性投影 | 类型编译和 JSON 契约测试 |
| `src/core/capability-brief.ts` | 修改 | 批量解析返回来源的知识状态，不执行写入 | 已标注、推导、未知和失效引用测试 |
| `src/cli/knowledge.ts` | 新增 | `knowledge show/set` 命令与参数校验 | CLI 成功、错误、幂等和 store 模式测试 |
| `src/cli/spec.ts` | 修改 | `spec history show/attach/set` 命令及确认前反馈 | CLI 集成和审计记录测试 |
| `src/core/__tests__/knowledge.test.ts` | 新增 | 注册表与 resolver 核心矩阵 | Vitest |
| `src/cli/__tests__/knowledge.test.ts` | 新增 | 用户命令与兼容行为 | CLI 集成测试 |

## 数据模型

### Knowledge Registry

注册表位于解析后的项目 write root，schemaVersion 固定为 `knowledge-registry.v1`。键必须是 canonical source ref；写入通过现有事务层原子替换，不允许调用方直接修改 JSON。

```json
{
  "schemaVersion": "knowledge-registry.v1",
  "annotations": {
    "spec:spec-knowledge-loop-L1": {
      "state": "current",
      "reason": "2026-07-16 review: retrieval contract remains applicable",
      "reviewedAt": "2026-07-16T08:00:00.000Z",
      "reviewedBy": "human"
    },
    "ac:spec-knowledge-governance-L1:AC-4": {
      "state": "superseded",
      "reason": "criterion is replaced by a narrower measurable contract",
      "replacementRef": "ac:spec-knowledge-governance-L2.1:AC-4",
      "reviewedAt": "2026-07-16T08:05:00.000Z",
      "reviewedBy": "human"
    }
  }
}
```

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| KnowledgeRegistry | schemaVersion | `knowledge-registry.v1` | 新增 | 固定值 | 是 |
| KnowledgeRegistry | annotations | Record<SourceRef, KnowledgeAnnotation> | 新增 | `{}` | 是 |
| KnowledgeAnnotation | state | current/historical/superseded/invalidated/unknown | 新增 | 必填 | 是 |
| KnowledgeAnnotation | reason | non-empty string | 新增 | 必填 | 是 |
| KnowledgeAnnotation | replacementRef | SourceRef? | 新增 | undefined | 是 |
| KnowledgeAnnotation | reviewedAt | ISO datetime | 新增 | 写入时生成 | 是 |
| KnowledgeAnnotation | reviewedBy | string | 新增 | `human` | 是 |
| SpecFrontmatter | historyReview | HistoryReview? | 新增 | undefined | 是 |
| HistoryReview | sources | SourceRef[] | 新增 | `[]` | 是 |
| HistoryReview | dispositions | HistoryDisposition[] | 新增 | `[]` | 是 |
| HistoryReview | noRelevantHistoryReason | string? | 新增 | undefined | 是 |
| HistoryReview | reviewedAt | ISO datetime? | 新增 | undefined | 是 |
| HistoryDisposition | sourceRef | SourceRef | 新增 | 必填 | 是 |
| HistoryDisposition | action | reuse/change/reject/unknown | 新增 | 必填 | 是 |
| HistoryDisposition | reason | string? | 新增 | `reuse` 可省略，其余必填 | 是 |
| HistoryDisposition | affectedCriteria | string[] | 新增 | `[]` | 是 |

### Canonical source ref

| 来源 | 格式 | 唯一性规则 |
|---|---|---|
| Spec | `spec:<specCode>` | code 全局唯一 |
| Decision | `decision:<topic>:<decisionId>` | topic 与 id 联合唯一 |
| Task | `task:<specCode>:<taskId>` | Spec code 与 task id 联合唯一 |
| Lesson | `lesson:<sourceKind>:<sourceIdentity>` | identity 必须包含可回查原始来源的完整复合键 |
| AC | `ac:<specCode>:<AC-ID>` | Spec code 与 AC ID 联合唯一 |

解析器先读取显式 annotation；没有显式 annotation 时，只允许从稳定事实推导：archived Spec 为 `historical`，存在有效替代关系的来源为 `superseded`，active Decision 为 `current`，superseded Decision 为 `superseded`，partial Decision 为 `unknown`。其余来源，包括无审阅记录的 implemented Spec，一律为 `unknown`。响应同时返回 `basis: explicit|derived|default`，使消费者知道结论强度。

## 接口契约

### `spec-manager knowledge show <sourceRef> [--json]`

成功 JSON：

```json
{
  "sourceRef": "spec:spec-knowledge-loop-L1",
  "state": "current",
  "basis": "explicit",
  "reason": "2026-07-16 review: retrieval contract remains applicable",
  "replacementRef": null,
  "reviewedAt": "2026-07-16T08:00:00.000Z"
}
```

### `spec-manager knowledge set <sourceRef> --state <state> --reason <text> [--replacement <sourceRef>]`

- 命令校验来源存在；`superseded` 必须提供可解析且不同于自身的 replacement。
- 成功后原子写入注册表并返回最终 annotation。
- 相同内容重复写入保持语义幂等；审计仍记录显式用户操作。

### `spec-manager spec history attach <code> --sources <sourceRef,...>`

- 去重后把来源附加到 `historyReview.sources`，不自动生成 disposition。
- 来源不存在时整个操作失败，不产生部分写入。
- Brief 调用方可把 `relevantSpecs`、Decision、Task、Lesson 与关键 AC 的 `sourceRef` 显式传入本命令。

### `spec-manager spec history set <code> --source <sourceRef> --action <action> [--reason <text>] [--criteria <AC-ID,...>]`

- source 必须已在 `historyReview.sources` 中。
- `change`、`reject`、`unknown` 必须提供非空 reason。
- `affectedCriteria` 必须引用目标 Spec 中存在的 AC；未知 AC 拒绝写入。
- 每个 source 只保留一条当前 disposition，更新通过 Spec 事务完成。

### `spec-manager spec history show <code> [--json]`

返回来源、解析后的知识状态、处置、未处置来源和关键 AC 影响。只读，不补写默认值。

### Agent Brief 增量响应

```json
{
  "schemaVersion": "agent-brief.v1",
  "relevantSpecs": [
    {
      "code": "spec-knowledge-loop-L1",
      "sourceRef": { "kind": "spec", "id": "spec-knowledge-loop-L1" },
      "knowledge": {
        "state": "current",
        "basis": "explicit",
        "reason": "2026-07-16 review: retrieval contract remains applicable"
      }
    }
  ]
}
```

### 错误契约

| 错误码 | 触发条件 | 是否写入 |
|---|---|---|
| `KNOWLEDGE_SOURCE_REF_INVALID` | 引用格式不合法 | 否 |
| `KNOWLEDGE_SOURCE_NOT_FOUND` | 引用无法回查原始资产 | 否 |
| `KNOWLEDGE_REPLACEMENT_REQUIRED` | superseded 缺少 replacement | 否 |
| `KNOWLEDGE_REPLACEMENT_CYCLE` | replacement 形成直接或传递循环 | 否 |
| `HISTORY_SOURCE_NOT_ATTACHED` | 处置未附加的来源 | 否 |
| `HISTORY_REASON_REQUIRED` | change/reject/unknown 缺少理由 | 否 |
| `HISTORY_AC_NOT_FOUND` | affectedCriteria 引用不存在的 AC | 否 |
| `HISTORY_REVIEW_INCOMPLETE` | 受治理 L1/L2 确认时仍有未处置来源，或空来源无理由 | 否 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| 注册表不存在 | 无显式 annotation | 视为空注册表，按稳定事实推导，否则 `unknown` | 首次 `knowledge set` 原子创建 |
| 注册表 JSON 损坏 | 无法可信解析状态 | 命令返回稳定错误，不把全部来源假定为 current | 用户修复或从版本控制恢复 |
| annotation 指向已删除来源 | 产生悬空知识 | show/report 标记 invalid reference；写命令拒绝新增同类引用 | 修复来源或删除 annotation |
| replacement 链目标失效 | superseded 链不可完整追踪 | 保留当前 superseded，但返回 replacement warning | 更新 replacementRef |
| Brief 无法解析单个来源 | 单项缺少知识解释 | 单项投影为 `unknown`，其他结果正常返回 | 修复源引用后重试 |
| legacy Spec 没有 historyReview | 无法证明做过历史处置 | 保持原有读取、更新和确认行为；报告为未采用治理 | 后续显式 attach 后进入门禁 |
| 事务写入中断 | 可能污染注册表或 Spec | 使用临时文件和原子替换，失败不提交 | 清理临时文件并重试 |

## 向后兼容

- **状态机**: 不修改 `SpecStatus`、Decision 状态或 Task 状态；知识状态是额外读取维度。
- **API**: 保留 `agent-brief.v1` 和所有既有字段，只增加可选 `knowledge`。
- **数据**: 旧项目没有知识注册表时按空表读取；旧 Spec 没有 `historyReview` 时 schema 继续通过。
- **门禁**: 只有显式附加 history sources 或带有治理标记的新 L1/L2 才执行完整性阻断；存量规格不会批量失效。
- **迁移**: 不自动扫描并写入历史状态，不把 implemented 批量标成 current；采用过程由人工逐项审阅。
- **store 模式**: 注册表跟随现有 write root，仓库文件模式与 `.spec-manager` store 模式使用同一逻辑契约。

## 关键交互流程

```text
用户请求 Agent Brief
  -> 现有检索返回历史来源
  -> resolver 批量附加 knowledge state/basis
  -> 用户选择来源并执行 spec history attach
  -> 用户逐项执行 spec history set
  -> confirm L1/L2
       -> 没有来源: 校验 noRelevantHistoryReason
       -> 存在来源: 校验一一对应 disposition
       -> 校验 change/reject/unknown 的 reason
       -> 校验 affectedCriteria 仍存在
       -> 全部通过后进入 confirmed
```

```text
用户执行 knowledge set
  -> 解析 canonical source ref
  -> 校验原始来源与 replacement
  -> 检查 replacement cycle
  -> 通过事务写入 knowledge-registry.v1
  -> 追加审计事件
  -> 返回最终 annotation
```

关键异常分支：检索结果不是知识结论；即使高相关来源没有 annotation，也只能显示 `unknown`。`historyReview.action=reuse` 也不会隐式把源知识写成 `current`，两项人工判断必须分别执行和审计。

## 可观测性

- **审计**: 记录 knowledge set、history attach/set、确认门禁结果；包含 sourceRef、旧值摘要、新值摘要和操作者来源，不记录 Spec 正文。
- **只读诊断**: show 与 Brief 返回 `basis`、reason、replacement 和未处置来源，便于解释每个判断来自显式记录、稳定推导或默认未知。
- **指标输入**: 暴露 current/unknown/invalid reference 数量、处置覆盖率和关键 AC 影响数量；聚合与趋势报告由后续 L2 负责，本 L2 不写指标文件。
- **告警**: 注册表损坏、replacement cycle 和确认阻断使用稳定错误码；悬空旧 annotation 使用 warning，不自动删除证据。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| 项目路径 | `src/core/paths.ts` | `resolveProjectPaths`、`ProjectPaths` | 让注册表遵循仓库/store 两种 write root |
| 原子事务 | `src/core/transaction.ts` | 事务暂存、提交与回滚能力 | 原子更新注册表和 Spec frontmatter |
| Spec 仓储 | `src/core/repository.ts` | repository 读写入口 | 保持 Spec 更新、审计和缓存一致性 |
| 项目快照 | `src/core/project-snapshot.ts` | `buildProjectSnapshot` | 校验 Spec、Task、Decision 与关系来源存在性 |
| Spec schema | `src/schemas/spec.ts` | frontmatter schema | 增量增加 historyReview 且兼容旧文件 |
| Spec 策略 | `src/core/spec-policy.ts` | 状态转换与文档门禁 | 在确认动作中组合历史处置校验 |
| Brief 编排 | `src/core/capability-brief.ts` | `buildAgentBrief` | 在既有历史结果上附加只读知识投影 |
| Readiness | `src/core/critical-readiness.ts` | 关键 AC 提取与覆盖判断 | 校验 affectedCriteria，并为后续连续性报告提供同一 AC 口径 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| spec-knowledge-governance-L3.1.1-validity | knowledge registry、canonical source ref、resolver、路径/事务接入、`knowledge show/set` 和核心测试 | 本 L2 frozen |
| spec-knowledge-governance-L3.1.2-disposition | historyReview schema、`spec history` 命令、确认门禁、Brief knowledge 投影、关键 AC 影响与兼容回归 | L3.1.1 implemented |

在首个 L3 进入 frozen 前，两个 L3 必须同时创建并写入非空正文，保证本 L2 的范围没有因先行实施而遗漏。

## 关联

- based_on: `spec-knowledge-governance-L1` — 本 L2 负责知识有效性、历史处置和关键 AC 连续性的底层契约。
- references: `spec-knowledge-loop-L2.1` — 复用跨 topic 检索和 `agent-brief.v1` 增量输出。
- references: `critical-ac-readiness-L2.1` — 复用关键 AC 身份与只读 readiness 口径。
