---
code: spec-knowledge-loop-L2.1
level: L2
title: Cross-Topic History Retrieval and Context Pack
topic: spec-knowledge-loop
parentCode: spec-knowledge-loop-L1
status: implemented
aiSummary: >-
  设计 Phase 1 跨 topic 历史召回：复用项目快照，以确定性本地分词、字段评分、一跳关系扩展和 topic 多样性生成 Top 5 Spec
  约束包；显式 topic 保持严格过滤，Brief v1 仅增量增加 retrieval/match 解释字段，并拆为 retrieval core 与
  Brief 集成两个 L3。
relations:
  - type: based_on
    target: spec-knowledge-loop-L1
  - type: references
    target: guided-assist-workflow-L2.1
  - type: references
    target: workflow-surface-simplification-L2.4
created: '2026-07-15T13:18:12.414Z'
updated: '2026-07-16T02:39:26.850Z'
changeSummary: 'cascade: task-complete'
---
# Cross-Topic History Retrieval and Context Pack — 技术设计

## 方案概述

本 L2 落地 `spec-knowledge-loop-L1` 的 Phase 1，以现有 Agent Brief 为唯一用户入口，在不改变 Spec 存储格式和工作流状态机的前提下增加全库历史召回层。显式 topic 仍是严格范围过滤；未显式指定 topic 时，推断 topic 只用于下一步建议，不能再限制历史候选集。

召回层只读取 Spec 元数据与 `aiSummary`、Decision 的 what/why、失败经验摘要和 Task 元数据，不默认读取 Spec 正文。它对请求和候选文本做确定性归一化与分词，生成直接匹配分数，再沿 Spec 关系做最多一跳的上下文扩展，最后以稳定排序和 topic 多样性约束生成最多 5 份 Spec 摘要，并为每个结果附上匹配理由、命中词和置信等级。

```text
[brief / guided assist]
          |
          v
[Agent Brief Orchestrator]
          |
          +---- explicit topic? ---- yes ---> [topic-scoped candidates]
          |                          no  ---> [project-wide snapshot]
          v
[History Retrieval]
  normalize -> tokenize -> field score -> one-hop relation expansion
          |
          v
[stable rank + per-topic diversity + limits]
          |
          v
[existing Brief fields + additive match/retrieval metadata]
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 首期召回技术 | A: 本地确定性词法评分；B: 本地向量索引；C: 远程 embedding | A（本 L2 提案） | 符合 `spec-knowledge-loop-L1` 的纯本地、可解释和向前治理原则；当前 196 份 Spec 无需索引基础设施即可全量评分 |
| 候选事实源 | A: 分别多次扫描各类文件；B: 复用项目快照统一装载 | B（本 L2 提案） | 项目快照已统一装载 Spec、Task、Decision、Incident 和关系索引，避免重复解析与口径漂移 |
| topic 语义 | A: 推断 topic 始终过滤；B: 显式 topic 严格过滤，推断 topic 仅作排序信号；C: 永远全库 | B（本 L2 提案） | 修复假阴性的同时保持显式 `--topic` 兼容性；自然语言推断不能冒充用户范围选择 |
| 默认检索文本 | A: 全文；B: 标题、topic、code、摘要与结构化短文本；C: 仅标题 | B（本 L2 提案） | 满足渐进式上下文，避免正文长度支配评分，并利用已覆盖 196/196 Spec 的 `aiSummary` |
| 关系扩展深度 | A: 不扩展；B: 一跳；C: 递归全图 | B（本 L2 提案） | 一跳可以带出父子与相关设计，同时避免循环、远距离噪音和不可预测的上下文膨胀 |
| 输出契约演进 | A: 替换为新 schema；B: 保留现有字段并增加可选元数据；C: 新增平行命令 | B（本 L2 提案） | 现有 CLI、测试和 Agent 调用继续读取原字段，新消费者可以使用匹配解释；避免形成第二个 Brief 入口 |
| 无历史判定 | A: topic 无精确结果即为空；B: 全库评分后无正向匹配才为空；C: 永不返回空 | B（本 L2 提案） | 消除已观察的假“无历史”，同时不以低分噪音伪造相关结果 |
| 排序稳定性 | A: 依赖文件遍历顺序；B: 分数、有效状态、层级、code/id 固定次序 | B（本 L2 提案） | 同一仓库快照与请求必须可复现，便于测试、审计和指标对比 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/capability-brief.ts` | 修改 | 将候选选择从精确 topic 过滤改为检索编排；保留 Profile、Design Context、next command 行为 | 单元测试覆盖显式 topic、全库召回、空结果和兼容字段 |
| `src/core/capability-types.ts` | 修改 | 为 Spec、Decision、Task、Lesson 引用增加可选匹配解释，为 Brief 增加检索元数据 | 类型编译与 JSON 契约快照 |
| `src/core/project-snapshot.ts` | 复用/小幅修改 | 提供一次性全库候选和关系索引；仅在缺少必要索引时增量扩展 | 快照范围与索引单元测试 |
| `src/core/lessons.ts` | 修改 | 复用统一分词和评分语义，未显式 topic 时允许跨 topic 经验参与排序 | Decision、失败 Task、Incident 跨 topic 测试 |
| `src/core/guided-assist.ts` | 修改 | 推断 topic 不再阻断 Brief 的全库召回；命令路由仍保持现有阶段语义 | 引导阶段和显式 topic 回归测试 |
| `src/cli/brief-presenter.ts` | 修改 | 文本模式显示匹配理由、置信度和检索范围，JSON 原字段保持可读 | CLI 文本与 JSON 输出测试 |
| `src/core/__tests__/capability-brief.test.ts` | 修改 | 增加真实假阴性、中文/英文混合、稳定排序、多样性与上限用例 | Vitest |
| `src/cli/__tests__/capability.test.ts` | 修改 | 验证命令输出兼容和新增解释字段 | CLI 集成测试 |

## 数据模型

本 L2 不新增持久化文件，也不迁移现有 Markdown/JSON。以下模型只存在于只读 Brief 投影中，并作为现有响应的可选增量字段。

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| HistoryMatch | score | number | 新增 | 无匹配时不生成结果 | 是 |
| HistoryMatch | confidence | high/medium/low | 新增 | 由固定阈值推导 | 是 |
| HistoryMatch | reasons | string[] | 新增 | 至少 1 条 | 是 |
| HistoryMatch | matchedTerms | string[] | 新增 | 空数组 | 是 |
| Brief item | match | HistoryMatch? | 新增 | undefined | 是 |
| RetrievalMeta | scope | project/topic | 新增 | project（无显式 topic） | 是 |
| RetrievalMeta | explicitTopic | string/null | 新增 | null | 是 |
| RetrievalMeta | inferredTopic | string/null | 新增 | null | 是 |
| RetrievalMeta | candidateCount | number | 新增 | 0 | 是 |
| RetrievalMeta | resultLimit | number | 新增 | 5 | 是 |
| AgentBrief | retrieval | RetrievalMeta? | 新增 | undefined（旧生产者） | 是 |

### 归一化与分词规则

1. 所有文本执行 Unicode NFKC、转小写、空白折叠和去重。
2. 英文、数字和 kebab-case 保留完整 token，同时把 kebab-case 拆为子 token。
3. 中文连续文本产生 2–4 字符片段；单字不参与评分，避免高频噪音。
4. 请求 token 去重；候选文本只使用 topic、code、title、`aiSummary` 或对应结构化短摘要。
5. 空请求继续使用现有稳定错误；没有有效 token 时返回可解释 finding，不伪造推荐。

### 评分与排序

| 信号 | 分值/规则 | 理由 |
|---|---|---|
| topic 完整命中 | +30 | topic 是最强领域标识，但只有显式 topic 才作为硬过滤 |
| code 完整或子 token 命中 | +20 / +8 | code 可直接定位资产，子 token 支持跨 topic |
| title token 命中 | 每个 +12 | 标题是高密度主题描述 |
| `aiSummary` token 命中 | 每个 +8 | 摘要覆盖完整且适合低成本召回 |
| Decision what/why 命中 | 每个 +10 / +6 | 决策语义比普通元数据更强 |
| Lesson title/detail 命中 | 每个 +10 / +6 | 失败与事故经验需要进入后续迭代 |
| 一跳关系邻居 | 最高 +6 | 只补充上下文，不应压过直接匹配 |
| 无直接或关系命中 | 排除 | 防止用低相关资产填满 Top 5 |

最终排序依次使用：总分降序、直接匹配优先、当前可用状态优先、L1/L2 优先于 L3、code/id 字典序。Spec 结果默认每个 topic 最多 2 份；当全库不足 5 个相关 topic 时允许回填剩余高分结果。所有阈值和权重必须集中定义并由测试固定，不散落在调用方。

## 接口契约

### Agent Brief 输入

```json
{
  "request": "让 L0 L1 L2 角色 Agent 协作",
  "topic": null
}
```

- `request`：必填，去空白后不得为空。
- `topic`：可选；提供时表示用户明确要求严格限定 topic。

### Agent Brief 增量响应

```json
{
  "schemaVersion": "agent-brief.v1",
  "request": "让 L0 L1 L2 角色 Agent 协作",
  "topic": "agent",
  "retrieval": {
    "scope": "project",
    "explicitTopic": null,
    "inferredTopic": "agent",
    "candidateCount": 196,
    "resultLimit": 5
  },
  "relevantSpecs": [
    {
      "code": "agent-install-surface-L1",
      "level": "L1",
      "status": "implemented",
      "title": "Graphify-style Agent Install Commands",
      "match": {
        "score": 78,
        "confidence": "high",
        "reasons": ["request term matched topic and summary"],
        "matchedTerms": ["agent"]
      },
      "sourceRef": {
        "kind": "spec",
        "id": "agent-install-surface-L1"
      }
    }
  ]
}
```

示例中的 `score` 仅用于说明响应形态，实际值由集中权重计算；调用方不得依赖某个具体绝对分数，只能依赖排序、置信等级和理由。

### 错误与 finding

| 条件 | 行为 | 兼容性 |
|---|---|---|
| request 为空 | 保持 `AGENT_BRIEF_REQUEST_REQUIRED` 错误 | 不变 |
| 显式 topic 不存在或没有相关历史 | 返回 topic 范围的空结果与 `brief.history.none` | 不变 |
| 无显式 topic 且全库无正向匹配 | 返回项目范围空结果与 `brief.history.none` | 消除原先仅查推断 topic 的假阴性 |
| topic 无法推断但存在全库匹配 | 返回结果，并保留 topic unresolved finding | 增量行为 |
| 单个候选摘要缺失 | 回退 title；不读取正文补偿 | 不变 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| 请求只有停用词或无法产生有效 token | 无法可靠评分 | 返回 unresolved/no-match finding，不随机推荐 | 用户补充主题或显式 topic |
| 个别 Spec 无 `aiSummary` | 召回信号减少 | 使用 topic、code、title；不读取全文 | 后续通过现有治理补摘要 |
| 关系目标不存在 | 无法扩展该邻居 | 忽略失效边并产生 advisory finding | 使用完整性治理修复关系 |
| 候选集包含大量同 topic L3 | Top 5 被单一迭代占满 | 每 topic 上限 2，优先 L1/L2 | 用户显式 topic 时查看完整 topic 流 |
| 中文片段产生误报 | 结果噪音增加 | 要求多字段或多 token 命中，高频片段进入固定停用集合 | 更新本地规则和评测集 |
| 新解释字段未被旧消费者识别 | 旧消费者忽略增量信息 | 保留所有原字段和 schemaVersion | 新消费者逐步采用可选字段 |

## 向后兼容

- **API**: 保留 `agent-brief.v1`、现有输入、原有数组和 sourceRef；只添加可选 `retrieval` 与 `match`。
- **CLI**: 显式 `--topic` 仍严格限定；文本输出增加解释行但保留既有标题和 Next 行。
- **数据**: 不修改历史 Spec、Task、Decision、Incident 或配置格式。
- **排序**: 显式 topic 内从原 code/status 排序升级为相关性排序；无匹配词时使用原状态/code 次序作为兼容回退。
- **工作流**: next command、Profile 推荐、Design Context 和人工审批门禁不由本 L2 改变。

## 关键交互流程

```text
用户请求 Brief
  -> 校验 request
  -> 区分 explicitTopic 与 inferredTopic
  -> 构建一次项目快照
  -> explicitTopic ? 过滤候选 : 保留全库候选
  -> 归一化并评分直接命中
  -> 对高分 Spec 做一跳关系扩展
  -> 去重、稳定排序、topic 多样性裁剪
  -> 分别投影 Spec / Decision / Task / Lesson
  -> 合并 suggestedReads 与 findings
  -> 输出 JSON 或文本
```

异常分支：只有在全库评分后仍不存在正向匹配时，才产生项目范围的 `brief.history.none`；显式 topic 的空结果继续按 topic 语义处理。

## 可观测性

- **日志**: 默认不新增持久日志；解释信息直接进入只读响应，避免产生隐式遥测。
- **指标**: 在测试/评测报告中计算 query success@5、假无历史率、候选数、返回数和 topic 多样性；本 L2 不写运行时统计文件。
- **告警**: 无运行时告警；关系损坏、摘要缺失和无法分词以 advisory finding 呈现。
- **隐私**: 不向仓库外发送请求、摘要、正文、文件路径或评分数据。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Agent Brief 编排 | `src/core/capability-brief.ts` | `buildAgentBrief` | 保留唯一 Brief 聚合入口、Profile 与 Design Context 行为 |
| 项目快照 | `src/core/project-snapshot.ts` | `buildProjectSnapshot`、快照索引 | 一次读取全库资产和 Spec 关系 |
| Spec 读取 | `src/core/spec-io.ts` | `listAllSpecs` | 复用缓存、frontmatter 校验与稳定 Spec 记录 |
| 历史经验 | `src/core/lessons.ts` | `buildLessonsReport` | 复用 Decision、失败 Task、Incident 的经验投影 |
| Guided Assist | `src/core/guided-assist.ts` | 本地历史 topic 推断与 Brief 路由 | 保持现有引导入口和阶段选择 |
| Brief 文本输出 | `src/cli/brief-presenter.ts` | `renderBriefTextLines` | 在原有文本契约上展示解释信息 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| spec-knowledge-loop-L3.1.1-retrieval | 统一归一化、分词、候选评分、一跳关系扩展、稳定排序、多样性裁剪与核心单元测试 | 本 L2 frozen |
| spec-knowledge-loop-L3.1.2-brief | Agent Brief、Lessons、Guided Assist、文本/JSON 输出集成，固定评测集与兼容回归 | L3.1.1 implemented |

在首个 L3 进入 frozen 前，两个 L3 必须同时创建并写入非空正文，以满足 scope-split 完整性要求。

## 关联

- based_on: `spec-knowledge-loop-L1` — 本 L2 仅实现 Phase 1 的跨 topic 历史召回和精简约束包。
- references: `guided-assist-workflow-L2.1` — 复用只读 Assist 编排与稳定下一步推荐原则。
- references: `workflow-surface-simplification-L2.4` — 保持 Brief 核心短路径和本地事实源兼容。
