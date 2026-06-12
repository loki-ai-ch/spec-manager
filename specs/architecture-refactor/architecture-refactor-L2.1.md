---
code: architecture-refactor-L2.1
level: L2
title: 核心分层架构设计
topic: architecture-refactor
parentCode: architecture-refactor-L1
status: implemented
aiSummary: >-
  本 L2 设计核心分层架构：保持现有存储格式、CLI
  行为和公共入口兼容，新增或收敛仓储层、领域策略层、用例编排层、项目只读快照层，并按任务完成、规格策略、项目快照、归档计划、兼容验证拆分后续 L3。
created: '2026-06-11T07:06:42.474Z'
updated: '2026-06-11T07:22:11.322Z'
changeSummary: 'cascade: task-complete'
---
# 核心分层架构设计 — 技术设计

## 方案概述

本设计承接 architecture-refactor-L1，将现有核心代码从“过程函数直接串联规则与 I/O”演进为分层架构：仓储层只负责本地 markdown/json/yaml 读写，领域策略层承载状态机与门禁判断，用例编排层负责事务和副作用顺序，只读快照层为诊断和展示提供一致数据视图，CLI 层仅做参数解析与展示。

```
[CLI Commands]
      │
      ▼
[Use Cases / Application Services]
      │              ┌───────────────┐
      │              │ Domain Policy │
      ▼              └───────────────┘
[Repositories]  ──>  [Project Snapshot]
      │
      ▼
[Local Files: specs / tasks / decisions / changes / .spec-manager]
```

核心策略是保持当前存储格式、命令语义和公共行为不变，通过内部边界抽离降低新增规则的修改半径。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 分层方式 | A: 直接按现有文件拆小函数, B: 引入仓储/领域策略/用例/快照/CLI 适配分层 | B | L1 的主要问题是职责边界不清，按架构职责拆分能直接降低规则与 I/O 耦合 |
| 行为兼容策略 | A: 重构时顺带调整 CLI 行为, B: 保持命令语义、存储格式、状态流转兼容 | B | L1 明确要求用户工作流兼容，架构收益不能以行为变化为代价 |
| 项目只读数据模型 | A: 各模块继续自行读取, B: 建立 ProjectSnapshot 或等价只读索引 | B | doctor、flow、integrity、lifecycle 需要一致口径，统一快照能减少重复扫描和判断分叉 |
| 任务完成链路拆分粒度 | A: 只拆出 helper 函数, B: 拆出具名 gate 与 completion use case | B | L1 要求每类门禁能独立定位、描述输入输出和失败原因 |
| 规格规则归属 | A: 保留在 spec 持久化能力内, B: 移入领域策略或规格服务能力 | B | 仓储层不应承担审批、状态授权、摘要约束和审计命中判断 |
| 归档链路推进方式 | A: 本轮完整重构归档, B: 先设计计划/应用边界，作为后续 L3 可选推进 | B | 归档复杂但优先级低于 task/spec/snapshot，分阶段更可控 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| src/core/task.ts | 修改 | 任务生命周期 API 保持，内部完成链路迁出门禁与编排细节 | 单元测试 + CLI task 回归 |
| src/core/spec-io.ts | 修改 | 保留兼容导出，逐步收窄为 spec 持久化与兼容 facade | 单元测试 + spec CLI 回归 |
| src/core/lifecycle.ts | 修改 | 复用领域策略与快照索引判断级联可实施性 | 生命周期单元测试 |
| src/core/integrity.ts | 修改 | 接入项目只读快照或等价索引 | 完整性单元测试 + doctor 回归 |
| src/core/usability.ts | 修改 | flow、doctor、guide 读取统一项目视图 | usability 单元测试 + CLI project doctor |
| src/core/view.ts | 修改 | 基于统一只读模型构建 view model | view 单元测试 + CLI view 回归 |
| src/core/archive.ts | 修改 | 明确归档计划、引用迁移、应用边界；本阶段保留兼容入口 | archive 单元测试 |
| src/core/harness.ts | 修改 | 继续调用 task 兼容 API，避免直接依赖内部门禁细节 | harness 单元测试 |
| src/index.ts | 修改 | 保持现有公共导出兼容，必要时补充新边界导出 | 类型检查 + installed CLI 验证 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| SpecRecord | fm/content/filePath | 现有结构 | 不变 | 现有值 | 是 |
| TaskRecord | id/specCode/status/steps/verifications 等 | 现有结构 | 不变 | 现有值 | 是 |
| DecisionRecord | id/fm/content/filePath | 现有结构 | 不变 | 现有值 | 是 |
| ProjectSnapshot | specs/tasks/decisions/incidents/changes/indexes | 只读内存模型 | 新增 | 单次读取构建 | 是 |
| CompletionGateResult | gate/status/message/metadata | 内部结果模型 | 新增 | 由 gate 返回 | 是 |
| ArchivePlan | entries/referenceUpdates/fileMoves | 内部计划模型 | 新增 | 由归档预检生成 | 是 |

本设计不改变磁盘数据格式；新增模型均为运行期内部结构。

## 接口契约

### Core: buildProjectSnapshot

**请求**:
```json
{
  "paths": "ProjectPaths",
  "include": ["specs", "tasks", "decisions", "incidents", "changes"]
}
```

**成功响应**:
```json
{
  "specs": "SpecRecord[]",
  "tasks": "TaskRecord[]",
  "indexes": {
    "specByCode": "Map<string, SpecRecord>",
    "tasksBySpec": "Map<string, TaskRecord[]>",
    "childrenByParent": "Map<string, SpecRecord[]>"
  }
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| N/A | SNAPSHOT_READ_FAILED | 任一必要本地数据读取或解析失败 |
| N/A | SNAPSHOT_INVALID_REFERENCE | 快照构建期间发现基础引用无法建立 |

### Core: runTaskCompletion

**请求**:
```json
{
  "paths": "ProjectPaths",
  "taskId": "T-001",
  "specCode": "architecture-refactor-L3.1.1",
  "options": {
    "skipR18Check": false,
    "skipVerification": false,
    "skipVerify": false,
    "bypassReason": null
  }
}
```

**成功响应**:
```json
{
  "task": "TaskRecord",
  "gateResults": "CompletionGateResult[]",
  "cascadedSpecs": [],
  "skippedSpecs": []
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| N/A | TASK_TRANSITION_INVALID | task 状态不能进入 completed |
| N/A | COMPLETION_GATE_FAILED | 任一完成门禁失败 |
| N/A | BYPASS_REASON_REQUIRED | 跳过门禁但未提供原因 |
| N/A | CASCADE_FAILED | 完成后规格未达到期望状态 |

### Core: updateSpecWithPolicy

**请求**:
```json
{
  "paths": "ProjectPaths",
  "code": "architecture-refactor-L2.1",
  "patch": {
    "content": "...",
    "aiSummary": "...",
    "status": "confirmed"
  },
  "authority": null
}
```

**成功响应**:
```json
{
  "record": "SpecRecord",
  "warnings": []
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| N/A | SPEC_NOT_FOUND | 目标 spec 不存在 |
| N/A | SPEC_POLICY_VIOLATION | 内容、摘要、层级或状态规则不满足 |
| N/A | RELATION_TARGET_NOT_FOUND | relation 指向不存在的 spec |

### Core: planArchiveChange

**请求**:
```json
{
  "paths": "ProjectPaths",
  "changeName": "example-change"
}
```

**成功响应**:
```json
{
  "plan": "ArchivePlan",
  "warnings": []
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| N/A | CHANGE_NOT_FOUND | change 目录不存在 |
| N/A | CHANGE_PROPOSAL_INVALID | proposal 或 delta 不满足归档要求 |
| N/A | ARCHIVE_PREFLIGHT_FAILED | 计划中存在无法应用的操作 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| ProjectSnapshot 构建失败 | doctor、flow、integrity 无法获得一致视图 | 返回明确错误，不回退到多套读取口径 | 修复损坏文件或引用后重新运行 |
| 完成门禁失败 | task 不能完成 | 保持 task 与 spec 原状态，输出具体 gate 失败原因 | 修复失败条件后重新运行完成命令 |
| 仓储写入失败 | spec/task 等对象无法持久化 | 依赖现有原子写与事务回滚能力 | 修复文件权限或磁盘问题后重试 |
| 归档计划预检失败 | change 不进入 archive | 输出无法应用的 entry 和原因，不修改主数据 | 修复 change 内容后重新计划 |

## 向后兼容

- **API**: 保留现有公共入口和 CLI 调用路径；新增分层能力优先作为内部实现，公共导出采用兼容 facade。
- **数据**: 不改变 specs、tasks、decisions、changes、archive、.spec-manager 的磁盘格式。
- **迁移**: 不需要数据迁移；如后续阶段新增内部结构，仅在运行时构建。

## 关键交互流程

### task complete

```
CLI task complete
  │
  ▼
Task Completion Use Case
  │
  ├─ load task/spec snapshot
  ├─ run task state gate
  ├─ run step completion gate
  ├─ run verification gate
  ├─ run lifecycle cascade
  ├─ run decision gate
  └─ persist task/spec/audit changes in transaction
```

异常分支：任一 gate 失败时，用例返回具名失败原因；事务应保持 task、spec 和审计状态一致。

### spec update

```
CLI spec update
  │
  ▼
Spec Policy Service
  │
  ├─ validate content and summary policy
  ├─ validate status transition policy
  ├─ validate relation policy
  └─ call Spec Repository to persist
```

异常分支：策略失败时不写入 spec；仓储失败时保留原文件状态。

### project doctor / flow / integrity

```
Command
  │
  ▼
Build ProjectSnapshot
  │
  ├─ derive indexes
  └─ pass same snapshot into checks/renderers
```

异常分支：快照构建失败时停止本轮只读判断，输出读取或解析错误。

## 可观测性

- **日志**: CLI 保持现有错误输出；核心用例错误应包含具名错误码或 gate 名称。
- **指标**: 保持测试通过率、project doctor 状态、完成链路 gate 失败数量作为验收指标。
- **告警**: 本地 CLI 项目不引入运行时告警；通过 doctor 和测试失败暴露问题。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| 路径解析 | src/core/paths.ts | getPaths、resolveWithin、listSpecFiles | 保持路径安全和项目布局发现 |
| frontmatter I/O | src/core/frontmatter.ts | readFrontmatter、writeFrontmatter、writeAtomic | 继续使用原子写和 markdown frontmatter 序列化 |
| 状态机 | src/core/status.ts | assertSpecTransition、assertTaskTransition、isAuthorizedImplementationTransition | 作为领域策略层的基础状态约束 |
| 规格读写 | src/core/spec-io.ts | readSpec、writeSpec、listAllSpecs、findSpecByCode | 先作为兼容仓储入口，逐步收窄职责 |
| 任务能力 | src/core/task.ts | listTasks、findTask、completeTask | 保持兼容 API，内部迁出完成链路细节 |
| 生命周期 | src/core/lifecycle.ts | assessImplementationReadiness、cascadeImplementedHierarchy | 复用级联实现，接入快照或策略边界 |
| 完整性检查 | src/core/integrity.ts | inspectProjectIntegrity | 作为快照接入的主要只读消费者 |
| 可用性展示 | src/core/usability.ts | runProjectDoctor、getFlowStatus、suggestAfterSpecCommand | 作为快照接入的只读展示消费者 |
| 验证规则 | src/core/verify.ts | parseVerifyRules、executeVerifyRules、runCommand | 迁入 verification gate 后继续复用 |
| 规格章节工具 | src/core/spec-sections.ts | extractVerificationCommands、truncateWithEllipsis | 迁入 gate 后继续复用 |
| 事务 | src/core/transaction.ts | withProjectTransaction | 用例编排层的事务边界 |
| 归档 | src/core/archive.ts | archiveChange | 保持兼容入口，后续拆分计划与应用 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| architecture-refactor-L3.1.1-task-completion | 任务完成用例拆分：completion use case、具名 gate、兼容 completeTask 入口 | architecture-refactor-L2.1 confirmed |
| architecture-refactor-L3.1.2-spec-policy | 规格仓储与规格业务策略边界拆分，保持 spec API 和 CLI 行为兼容 | architecture-refactor-L3.1.1-task-completion implemented |
| architecture-refactor-L3.1.3-project-snapshot | 项目只读快照与索引模型，接入 doctor、flow、integrity、view/lifecycle 的只读路径 | architecture-refactor-L3.1.2-spec-policy implemented |
| architecture-refactor-L3.1.4-archive-plan | 变更归档计划与应用边界拆分，保留 archiveChange 兼容入口 | architecture-refactor-L3.1.3-project-snapshot implemented |
| architecture-refactor-L3.1.5-verification | 全链路兼容验证、公共导出检查、installed CLI 验证和回归补强 | architecture-refactor-L3.1.4-archive-plan implemented |

## 关联

- parent: architecture-refactor-L1 — 核心架构分层重构的产品目标和验收边界。
