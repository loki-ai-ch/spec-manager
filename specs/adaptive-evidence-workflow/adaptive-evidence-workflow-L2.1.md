---
code: adaptive-evidence-workflow-L2.1
level: L2
title: Profile 准入与验收证据闭环设计
topic: adaptive-evidence-workflow
parentCode: adaptive-evidence-workflow-L1
status: implemented
aiSummary: >-
  设计项目显式启用与 Task Profile 快照；从 frozen L3 关键验收标准段提取关键 AC；governed
  完成强制成功证据覆盖，standard 仅提示；动态生成统一 task evidence 投影。
created: '2026-06-15T10:03:32.805Z'
updated: '2026-06-16T01:30:08.280Z'
changeSummary: 'cascade: task-complete'
---
# Profile 准入与验收证据闭环设计 — 技术设计

## 方案概述

本设计覆盖 `adaptive-evidence-workflow-L1` 的 P1 范围：Profile 显式启用与 Task 快照、关键 AC 结构化提取、governed 完成门禁、standard 完成提示，以及统一证据报告。Profile 推荐与方法论度量留给后续 L2。

设计采用“项目策略 + Task 不可变快照 + L3 批准内容 + 统一证据投影”四层结构：

```text
[.spec-manager/config.yaml]
  adaptiveWorkflow.enabled / defaultProfile
                 │
                 ▼
[task create --profile] ──> [TaskRecord.profile 快照]
                 │                    │
                 │                    ▼
[L3 关键验收标准引用] ──> [Evidence Projection]
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
          [task complete coverage gate]        [task evidence text/json]
          governed: block                      统一展示覆盖状态
          standard: warning
```

Profile 不改变现有 L1/L2/L3 状态机。首版中：

- `quick` 继续使用现有受限例外，不创建 Agent Task。
- `standard` 与 `governed` 都沿用完整 L1 → L2 → L3 → Task 路径。
- 两者差异集中在关键 AC 证据覆盖门禁，避免首版同时重写规格生命周期。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 新能力启用方式 | A: 升级后默认启用 B: 项目配置显式启用 C: 全局环境变量 | B | 满足旧项目默认兼容，配置随仓库版本化且本地可见 |
| Profile 归属 | A: 每次完成时读取项目默认值 B: Task 创建时保存实际 Profile 快照 C: 写入 L3 frontmatter | B | Task 执行期间项目默认值可能变化；快照可保证历史可解释且终态不可变 |
| Task 未显式传 Profile 时的行为 | A: 强制报错 B: 使用启用项目的 defaultProfile C: 始终 standard | B | 保持常用路径简洁，同时允许通过配置明确团队默认值 |
| 未启用项目的 Task Profile | A: 推断为 standard 并应用提示 B: 记录 legacy 且保持当前语义 C: 拒绝创建 | B | 任何新字段都不能静默改变旧项目完成行为 |
| 关键 AC 的事实源 | A: Agent Task 创建时传入 B: verification 首次引用即成为关键 C: frozen L3 正文中的显式“关键验收标准”引用 | C | 关键范围应在人工批准的实施契约中确定，不能由执行 Agent 临时缩小 |
| 关键 AC 表达 | A: 重复完整 AC 文本 B: `## 关键验收标准` 段列出 AC ID C: frontmatter 数组 | B | 避免复制正文；Markdown 可审阅；可通过稳定 ID 确定性解析 |
| 覆盖成功定义 | A: 任意 verification 引用 AC B: 至少一个 `exitCode=0` verification 引用 AC C: 所有引用均成功 | B | 与现有成功 verification 语义一致，允许失败后补充成功证据 |
| standard 未覆盖反馈位置 | A: `task complete` 成功结果 warning B: project doctor C: audit report | A | 用户在完成动作时最需要看到缺口；同时不新增阻断 |
| 证据报告实现 | A: 新建持久化报告文件 B: 从 ProjectSnapshot/Task/L3 动态投影 C: 写入 TaskRecord 冗余快照 | B | 避免多份事实漂移；现有本地数据已经足够形成报告 |
| 完成门禁实现位置 | A: CLI action B: `task-completion` 应用用例 C: `task.ts` facade | B | Core API 与 CLI 必须共享同一门禁，符合当前架构边界 |
| L1 全部范围拆分 | A: 单 L2 一次完成 B: 本 L2 完成 P1，推荐与度量另建 L2 | B | 保持本轮 L3 可按两个模块边界拆分，降低变更半径 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| 项目工作流配置核心 | 新增 | 解析、校验 adaptive workflow 启用状态与默认 Profile | 配置缺失、禁用、合法值、非法值单元测试 |
| Task 领域模型与创建用例 | 修改 | 保存 Profile 快照与可选覆盖理由；保持旧 Task 可读 | 创建矩阵、旧 JSON 兼容、终态不可变测试 |
| Spec 段解析能力 | 修改 | 从 L3 验收标准与关键验收标准段提取 AC ID | 合法引用、重复、未知 AC、空段测试 |
| Task completion 用例 | 修改 | 根据 Task Profile 执行覆盖门禁或产生 warning | legacy/standard/governed 完成矩阵测试 |
| Evidence 投影服务 | 新增 | 聚合 Profile、Spec、Task、AC、verification、artifact 状态 | 覆盖状态和 JSON 契约单元测试 |
| Task CLI handler/presenter | 修改 | task create Profile 输入、complete warning、evidence text/json | CLI 参数、错误映射、文本与 JSON 兼容测试 |
| Harness context | 修改 | 输出 Task Profile、关键 AC 与覆盖提示 | context JSON/text 回归测试 |
| 项目诊断与完整性 | 修改 | 检测非法配置、governed 完成历史缺少关键 AC 证据 | doctor/integrity 聚焦测试 |
| 方法论与 Agent 分发资产 | 修改 | 同步三档 Profile 和 governed 门禁规则 | 方法论契约与托管资产一致性测试 |

## 数据模型

### Project Workflow Config

`.spec-manager/config.yaml` 增加可选配置；字段缺失等同于未启用：

```yaml
adaptiveWorkflow:
  enabled: true
  defaultProfile: standard
```

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| ProjectConfig | `adaptiveWorkflow.enabled` | boolean | 新增可选 | `false` | 是，缺失时保持当前行为 |
| ProjectConfig | `adaptiveWorkflow.defaultProfile` | `standard \| governed` | 新增可选 | `standard` | 是，仅 enabled 时使用 |

`quick` 不作为 Task 默认值，因为 quick 不创建完整 Spec/Task 链路。

### TaskRecord 扩展

| 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| `profile` | `legacy \| standard \| governed` | 新增可选快照 | 旧记录读取为 `legacy` | 是 |
| `profileSource` | `project-default \| explicit \| legacy` | 新增可选 | 旧记录读取为 `legacy` | 是 |
| `profileOverrideReason` | `string \| null` | 新增可选 | `null` | 是 |

`profile` 在 Task 创建后不可由普通 Task 执行命令修改。用户显式指定与项目默认值不同的 Profile 时必须提供非空覆盖理由。

### Evidence Projection

Evidence 是动态只读投影，不新增持久化文件：

```typescript
type EvidenceCoverageStatus = 'covered' | 'failed' | 'uncovered' | 'not-required';

interface TaskEvidence {
  schemaVersion: 'task-evidence.experimental.v1';
  specCode: string;
  taskId: string;
  profile: 'legacy' | 'standard' | 'governed';
  profileSource: 'project-default' | 'explicit' | 'legacy';
  criticalCriteria: Array<{
    id: string;
    text: string;
    status: EvidenceCoverageStatus;
    verificationIds: string[];
  }>;
  verifications: TaskVerificationRecord[];
  artifacts: string[];
  summary: {
    required: number;
    covered: number;
    failed: number;
    uncovered: number;
  };
}
```

状态判定：

- `covered`: 至少一条引用该 AC 的 verification 为 `exitCode=0`
- `failed`: 有 verification 引用该 AC，但没有成功记录
- `uncovered`: 没有 verification 引用该关键 AC
- `not-required`: Profile 不要求覆盖，或 L3 未声明关键 AC

## 接口契约

### L3 关键验收标准表达

L3 的 `## 验收标准` 保留完整 AC 定义，并新增可选段：

```markdown
## 验收标准

1. **AC-1**: ...
2. **AC-2**: ...
3. **AC-3**: ...

## 关键验收标准

- AC-1
- AC-3
```

解析规则：

- `## 关键验收标准` 只允许引用同一 L3 `## 验收标准` 中存在的 AC ID。
- 重复引用去重。
- governed L3 必须至少声明一条关键 AC，否则 Task 创建被拒绝。
- standard L3 可不声明；证据报告将其显示为无强制覆盖项。
- legacy 项目不因缺少该段新增阻断。

### Project Config API

```typescript
type WorkflowProfile = 'legacy' | 'standard' | 'governed';

interface AdaptiveWorkflowConfig {
  enabled: boolean;
  defaultProfile: 'standard' | 'governed';
}

readAdaptiveWorkflowConfig(paths): AdaptiveWorkflowConfig
```

错误契约：

| 错误码 | 触发条件 | 行为 |
|---|---|---|
| `INVALID_ADAPTIVE_WORKFLOW_CONFIG` | enabled/defaultProfile 类型或枚举非法 | doctor 报 fail；依赖该配置的新 Task 创建被拒绝 |

### CLI: `project workflow`

```text
spec-manager project workflow show [--json]
spec-manager project workflow enable [--default-profile standard|governed]
spec-manager project workflow disable
```

行为：

- `show` 展示 enabled、defaultProfile 和兼容说明。
- `enable` 显式写入配置；默认 Profile 为 standard。
- `disable` 只影响后续 Task，不修改已有 Task 的 Profile 快照。
- 配置写入必须保持 config.yaml 中现有项目字段。

### CLI: `task create`

```text
spec-manager task create <specCode> --plan <file>
  [--profile standard|governed]
  [--profile-reason <reason>]
```

Profile 决定顺序：

1. 项目未启用 adaptive workflow：Task 保存为 `legacy`；传 `--profile` 返回错误。
2. 项目已启用且未传 `--profile`：使用 `defaultProfile`，source=`project-default`。
3. 项目已启用且显式 Profile 等于默认值：使用该值，source=`explicit`，理由可选。
4. 项目已启用且显式 Profile 不同于默认值：必须提供 `--profile-reason`，source=`explicit`。
5. governed 且 L3 没有合法关键 AC：返回 `GOVERNED_CRITICAL_AC_REQUIRED`。

错误契约：

| 错误码 | 触发条件 |
|---|---|
| `ADAPTIVE_WORKFLOW_DISABLED` | 未启用项目显式传 Profile |
| `INVALID_WORKFLOW_PROFILE` | Profile 不是 standard/governed |
| `PROFILE_OVERRIDE_REASON_REQUIRED` | 显式 Profile 与默认值不同但无理由 |
| `GOVERNED_CRITICAL_AC_REQUIRED` | governed L3 未声明至少一条合法关键 AC |
| `UNKNOWN_CRITICAL_AC` | 关键 AC 引用了 L3 中不存在的 ID |

### Task Completion Coverage Gate

完成门禁顺序调整为：

```text
bypass → task status → steps → successful verification
→ verification commands → @verify rules
→ evidence coverage policy
→ lifecycle cascade → R18
```

覆盖策略：

| Profile | 关键 AC 未覆盖时 |
|---|---|
| legacy | 不检查，不改变现有结果 |
| standard | 完成成功；在 gate result 与 CLI 输出中列出 failed/uncovered |
| governed | 在 cascade 前拒绝完成，列出 failed/uncovered |

新增 gate：

```typescript
type CompletionGateName = ... | 'evidence-coverage';
```

governed 覆盖门禁不提供普通 skip 参数。若未来需要异常恢复，应通过独立 change/迁移规格设计，避免首版引入可轻易绕过的新强门禁。

### CLI: `task evidence`

```text
spec-manager task evidence <taskId> --spec <specCode> [--format text|json]
```

文本输出示例：

```text
Task Evidence: adaptive-evidence-workflow-L3.1.1 / T-001
Profile: governed (project-default)
Coverage: 2/3 critical AC covered

Critical Criteria:
✓ AC-1 covered by V-001
✗ AC-2 failed via V-002
! AC-3 uncovered

Artifacts:
- coverage/index.html
```

JSON 输出使用 `task-evidence.experimental.v1`，首版标记 experimental，后续稳定化前允许追加字段但不删除或改义现有字段。

### Core Evidence API

```typescript
buildTaskEvidence(paths, taskId, specCode?): TaskEvidence
evaluateEvidenceCoverage(taskEvidence): {
  satisfied: boolean;
  blockingCriteria: string[];
}
```

错误契约：

| 错误码 | 触发条件 |
|---|---|
| `TASK_NOT_FOUND` | Task 不存在 |
| `SPEC_NOT_FOUND` | Task 引用的 L3 不存在 |
| `UNKNOWN_CRITICAL_AC` | L3 关键 AC 引用失效 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| config.yaml 无 adaptiveWorkflow | 无法使用新 Profile | 按 legacy 运行，保持当前完成语义 | 用户显式 enable |
| adaptiveWorkflow 配置非法 | 新 Task Profile 无法可靠确定 | doctor fail；拒绝创建新 Task；历史 Task 仍可按其快照读取 | 修复配置 |
| 旧 Task 无 profile 字段 | 无法判断新门禁 | 读取为 legacy，不新增阻断 | 无需迁移；可用后续显式迁移能力处理 |
| governed L3 无关键 AC 段 | 无法建立覆盖门禁 | 拒绝创建 governed Task | 修改 L3 并重新走批准/变更流程 |
| 关键 AC 引用未知 ID | 证据投影不可信 | 拒绝 governed Task 创建或完成；evidence 报错 | 修正 L3 引用 |
| verification 引用非关键 AC | 不影响关键覆盖 | 保留记录并在证据明细展示，不计入 required coverage | 无需恢复 |
| artifact 路径不存在 | 报告无法证明 artifact 可访问 | 首版展示记录值并给 warning，不将存在性作为覆盖成功条件 | 后续验证或补充 artifact |
| standard 存在未覆盖关键 AC | 验收证据不完整 | 完成成功并明确 warning | 后续新 Task 补充证据 |

## 向后兼容

- **项目配置**: 缺少 `adaptiveWorkflow` 时严格等同当前版本；不会自动写入或启用。
- **Task JSON**: 新字段均可选；旧 Task 读取为 legacy；Task 创建后 Profile 快照不受项目配置变化影响。
- **Spec Markdown**: `## 关键验收标准` 为新增可选段；仅 governed Task 创建要求存在。
- **CLI**: 现有命令和参数保持；`task create` 仅增加可选参数；`task complete --json` 保持现有 legacy shape，不强制输出 gateResults。
- **Core API**: `CreateTaskInput` 新字段可选；现有调用在未启用项目中继续产生 legacy Task。
- **完整性**: 不把历史 completed legacy Task 缺少关键 AC 覆盖视为问题。

## 关键交互流程

### 显式启用与 Task Profile 快照

```text
用户 → project workflow enable --default-profile standard
  └─ 保留现有 config 字段并写 adaptiveWorkflow

用户 → task create <L3> --plan ...
  ├─ 读取 adaptiveWorkflow
  ├─ 解析显式 Profile 或 defaultProfile
  ├─ 若显式覆盖默认值，校验 reason
  ├─ governed: 解析并校验 L3 关键 AC
  └─ 写入 TaskRecord.profile/profileSource/profileOverrideReason
```

### governed 完成

```text
task complete
  ├─ 执行现有状态、步骤和验证门禁
  ├─ buildTaskEvidence
  │   ├─ 解析 L3 AC 与关键 AC
  │   ├─ 聚合 verification.coversAc
  │   └─ 计算 covered/failed/uncovered
  ├─ profile=governed 且存在 failed/uncovered?
  │   └─ 拒绝完成，保持 Task running / L3 frozen
  ├─ profile=standard 且存在 failed/uncovered?
  │   └─ 添加 warning，不阻断
  └─ lifecycle cascade + R18
```

### 证据报告

```text
task evidence
  ├─ 加载 ProjectSnapshot 中的 L3 与 Task
  ├─ 解析关键 AC
  ├─ 聚合 verification 与 artifacts
  ├─ 计算覆盖摘要
  └─ presenter 输出 text 或 experimental JSON
```

## 可观测性

- **日志**: Task 创建输出最终 Profile 与来源；完成输出 evidence coverage gate 结果。
- **结构化结果**: completion gate metadata 包含 required、covered、failed、uncovered 和 blockingCriteria。
- **诊断**: project doctor 展示 adaptive workflow 配置有效性；integrity 检测已完成 governed Task 的关键 AC 覆盖缺口，但不修改历史。
- **审计**: 显式 Profile 覆盖默认值时记录 Profile、默认值与理由；标准模式未覆盖仅作为结果元数据，不计为规则违规。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Task 领域模型 | `src/core/task.ts` | `TaskRecord`, `createTask`, `TaskVerificationRecord` | 保存 Profile 快照并复用 `coversAc`、artifact |
| 完成应用用例 | `src/core/task-completion.ts` | `runTaskCompletion`, `CompletionGateResult` | 插入统一 evidence coverage gate |
| Harness 投影 | `src/core/harness.ts` | `buildHarnessTaskContext`, payload normalization | 复用 Task/Spec 聚合模式和稳定 JSON 约定 |
| Markdown 段解析 | `src/core/spec-sections.ts` | `sectionBody` | 解析验收标准和关键验收标准段 |
| 项目只读模型 | `src/core/project-snapshot.ts` | `buildProjectSnapshot`, indexes | 构建证据报告时共享一致视图 |
| 完整性诊断 | `src/core/integrity.ts` | `inspectProjectIntegrity` | 检测 governed 历史覆盖缺口 |
| CLI handler/presenter | `src/cli/task-handlers.ts`, `src/cli/common.ts` | handler/presenter 与 `printPresentedResult` | 新增 evidence 命令和完成 warning 输出 |
| YAML 解析 | `src/core/usability.ts` | 现有 config.yaml 解析模式 | 提取为共享项目配置读取能力 |
| 原子写入 | `src/core/frontmatter.ts` | `writeAtomic` | 保持 config 与 Task 写入安全 |
| Agent 资产同步 | `src/core/agents.ts` | managed asset inspection/install | 同步 Profile 方法论和工具入口规则 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| adaptive-evidence-workflow-L3.1.1-profile | 项目工作流配置、Task Profile 快照、关键 AC 解析与创建准入 | 无 |
| adaptive-evidence-workflow-L3.1.2-evidence | Evidence 投影、完成覆盖门禁、task evidence CLI、诊断与方法论同步 | L3.1.1 implemented |

后续独立 L2 将覆盖 Profile 推荐、用户请求分类和方法论效果度量，不纳入本 L2 的 L3 范围。

## 关联

- parent: `adaptive-evidence-workflow-L1`，落实 P1 的三档 Profile、governed 关键 AC 证据门禁、standard 提示和统一证据报告。
- based_on: `constraint-closed-loop-L2.1`，复用 verification、`coversAc` 和 task completion gate。
- based_on: `harness-coding-L2.1`，复用 Harness JSON 与执行回写契约。
- based_on: `cli-application-boundary-L2.1`，新 CLI 能力继续采用 handler/presenter 边界。
