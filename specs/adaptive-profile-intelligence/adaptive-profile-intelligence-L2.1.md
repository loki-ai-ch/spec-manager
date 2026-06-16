---
code: adaptive-profile-intelligence-L2.1
level: L2
title: Profile 推荐与治理度量设计
topic: adaptive-profile-intelligence
parentCode: adaptive-profile-intelligence-L1
status: implemented
aiSummary: >-
  设计本地确定性 Profile 推荐规则、project profile recommend CLI、Profile metrics 聚合、coverage
  warning/缺口统计和 explicit override 审计视图；拆分 recommend 与 metrics 两个 L3。
created: '2026-06-16T06:27:57.469Z'
updated: '2026-06-16T06:40:43.845Z'
changeSummary: 'cascade: task-complete'
---
# Profile 推荐与治理度量设计 — 技术设计

## 方案概述

本设计覆盖 `adaptive-profile-intelligence-L1` 的 P1 范围：本地确定性 Profile 推荐、推荐覆盖审计、Profile 采用与 evidence coverage 度量汇总。

设计采用“规则引擎 + 推荐结果 + Task 快照事实 + 聚合报告”四层结构：

```text
[用户请求 / 变更特征]
        │
        ▼
[Profile Recommendation Rules]
        │
        ├─ quick / standard / governed
        ├─ riskFactors[]
        └─ reasons[]
        │
        ▼
[CLI text/json: project profile recommend]

[TaskRecord profile/profileOverrideReason] + [TaskEvidence]
        │
        ▼
[Profile Metrics Projection]
        │
        ├─ byProfile task status summary
        ├─ coverage summary
        └─ overrides / warnings
        │
        ▼
[CLI text/json: project profile metrics]
```

推荐只提供确定性建议，不自动启用 adaptive workflow，不自动创建 Task，也不替代用户审批。硬门禁仍由 `adaptive-evidence-workflow-L3.1.1-profile` 和 `adaptive-evidence-workflow-L3.1.2-evidence` 已实现的 Task Profile 与 evidence coverage gate 决定。

## 技术决策

| 问题 | 候选选项 | 选定方案 | 理由 |
|---|---|---|---|
| 推荐规则来源 | A: 远端 AI B: 本地关键词/特征规则 C: 读取历史自动训练 | B | 满足确定性、离线可测和不引入遥测 |
| 推荐命令归属 | A: `task recommend` B: `project profile recommend` C: `spec recommend` | B | Profile 是项目治理策略，不只属于单个 Task |
| 推荐输出 | A: 只输出 Profile B: Profile + riskFactors + reasons + override guidance C: 生成完整 plan | B | 推荐需要可解释和可覆盖，但不代替规格流程 |
| quick 推荐处理 | A: 直接创建 quick Task B: 只提示 quick 适用边界 C: 禁止推荐 quick | B | quick 不创建完整 Task 链路，应保持受限例外 |
| 覆盖审计事实源 | A: 新增 recommendation log 文件 B: TaskRecord 现有 profileSource/profileOverrideReason C: audit pending | B | 首版不新增持久化源，先汇总已有 Task 快照 |
| 推荐与最终 Profile 差异 | A: 必须持久记录推荐 ID B: 用 explicit profile + reason 表示覆盖默认/建议 C: 不记录 | B | 现有 Task 已能保存显式覆盖理由；推荐 ID 留给后续 |
| 度量事实源 | A: 直接扫文件 B: `ProjectSnapshot` + `TaskEvidence` C: audit archive | B | 复用已有只读项目快照与 evidence 投影，避免事实漂移 |
| standard warning 度量 | A: 计为违规 B: 单独计数 C: 忽略 | B | 符合 standard non-blocking 语义 |
| JSON schema | A: 无版本 B: experimental.v1 C: 立即稳定 v1 | B | 首版需要允许追加字段，不删除核心字段 |
| L3 拆分 | A: 一个 L3 全做 B: 推荐/审计 + 度量/文档 两片 | B | 推荐和聚合度量可独立验证，降低变更半径 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| Profile 推荐核心 | 新增 | 本地规则、风险特征、推荐理由、override guidance | 规则优先级、确定性、边界输入单元测试 |
| Profile 度量核心 | 新增 | 从 ProjectSnapshot/TaskEvidence 聚合 Task 状态与 coverage | 多 Profile fixture、legacy 兼容、standard warning、governed 缺口测试 |
| Project CLI | 修改 | 新增 `project profile recommend` 与 `project profile metrics` | text/json、非法参数、未初始化、legacy compatibility 测试 |
| Task/Profile 数据模型 | 复用 | 读取 `profile`、`profileSource`、`profileOverrideReason` | 旧 Task 缺字段归入 legacy |
| Evidence 投影 | 复用 | 对 governed/standard Task 聚合 critical AC coverage | 投影错误降级与 warning 测试 |
| 方法论与 Agent 资产 | 修改 | 推荐使用边界、可覆盖说明、度量不等于质量 | 方法论契约与 managed asset 同步测试 |
| Public API | 修改 | 导出推荐和度量类型/函数 | public API smoke |

## 数据模型

### Profile Recommendation

```typescript
type RecommendedWorkflowProfile = 'quick' | 'standard' | 'governed';

interface ProfileRecommendation {
  schemaVersion: 'profile-recommendation.experimental.v1';
  recommendedProfile: RecommendedWorkflowProfile;
  riskFactors: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high';
    matched: string;
    reason: string;
  }>;
  reasons: string[];
  override: {
    allowed: true;
    requiresReason: boolean;
    guidance: string;
  };
  adaptiveWorkflow: {
    enabled: boolean;
    defaultProfile: 'standard' | 'governed';
    note: string;
  };
}
```

首版推荐输入来自 CLI 参数：

```text
spec-manager project profile recommend --request <text> [--files <paths>] [--json]
```

规则优先级：

| 推荐 | 触发条件示例 | 说明 |
|---|---|---|
| governed | schema/API/auth/payment/security/data migration/deploy/permission/production 等高风险关键词；或 `--files` 命中 `src/core/task-completion.ts`、`src/core/integrity.ts`、`src/core/spec-policy.ts` 等治理核心 | 需要关键 AC 与成功 evidence coverage |
| standard | 多文件、测试、CLI、docs+code 混合、feature/refactor 等常规非 quick 工作 | 走完整 L1/L2/L3/Task，但 coverage 缺口只 warning |
| quick | 请求明显是单文件、小文案、格式、注释或 typo，且未命中高风险关键词 | 保持 quick 受限例外，不创建完整 Task 链路 |

若同时命中多个等级，按 governed > standard > quick 选择。

### Profile Metrics

```typescript
interface ProfileMetricsReport {
  schemaVersion: 'profile-metrics.experimental.v1';
  generatedAt: string;
  adaptiveWorkflow: AdaptiveWorkflowConfig;
  totals: {
    tasks: number;
    completed: number;
    failed: number;
    active: number;
  };
  byProfile: Record<'legacy' | 'standard' | 'governed', {
    tasks: number;
    completed: number;
    failed: number;
    active: number;
    completionRate: number | null;
  }>;
  evidence: {
    governed: {
      required: number;
      covered: number;
      failed: number;
      uncovered: number;
      completedWithGaps: Array<{ specCode: string; taskId: string; missing: string[] }>;
    };
    standard: {
      warnings: number;
      missing: Array<{ specCode: string; taskId: string; missing: string[] }>;
    };
  };
  overrides: Array<{
    specCode: string;
    taskId: string;
    profile: 'standard' | 'governed';
    profileSource: 'explicit';
    reason: string;
  }>;
}
```

旧 Task 缺少 `profile` 时归入 `legacy`。Evidence 投影失败时不抛出整个 metrics 命令，而是在对应项中计入 warning/invalidProjection，避免单个历史坏数据阻断汇总。

## 接口契约

### Core API

```typescript
recommendWorkflowProfile(input: {
  paths: ProjectPaths;
  request: string;
  files?: string[];
}): ProfileRecommendation

buildProfileMetrics(paths: ProjectPaths, opts?: {
  topic?: string;
}): ProfileMetricsReport
```

错误契约：

| 错误码 | 触发条件 |
|---|---|
| `PROFILE_RECOMMENDATION_REQUEST_REQUIRED` | request 为空 |
| `INVALID_PROFILE_METRICS_TOPIC` | topic 含非法路径字符 |

### CLI: `project profile recommend`

```text
spec-manager project profile recommend --request <text> [--files <a,b>] [--json]
```

行为：

- text 输出推荐 Profile、风险特征、理由、覆盖说明和当前 adaptive workflow enabled/defaultProfile。
- JSON 输出 `profile-recommendation.experimental.v1`。
- 未启用 adaptive workflow 时仍可推荐，但必须提示“不会自动改变 legacy completion semantics”。
- quick 推荐必须提示 quick 的受限边界和“非平凡工作仍需 L1/L2/L3/Task”。

### CLI: `project profile metrics`

```text
spec-manager project profile metrics [--topic <topic>] [--json]
```

行为：

- text 输出 totals、byProfile、governed coverage、standard warnings、explicit overrides。
- JSON 输出 `profile-metrics.experimental.v1`。
- topic 过滤只影响属于该 topic 的 spec/task。
- standard warning 不使命令 exit 非零。
- completed governed gaps 应清晰列出，但首版 metrics 命令本身仍为报告命令，不替代 doctor hardening。

## 容错与降级

| 场景 | 行为 | 恢复方式 |
|---|---|---|
| 项目未启用 adaptive workflow | recommend/metrics 可读，提示 legacy compatibility，不写 config | 用户显式 `project workflow enable` |
| 旧 Task 无 profile | metrics 归入 legacy | 无需迁移 |
| TaskEvidence 投影失败 | metrics 记录 invalid projection warning，继续处理其他 Task | 修复对应 L3 关键 AC 或 Task 数据 |
| request 为空 | recommend 返回稳定错误 | 提供非空 request |
| files 参数含空项 | 忽略空项并保留非空路径 | 无需恢复 |

## 向后兼容

- 不修改 `.spec-manager/config.yaml`，除非用户显式调用既有 `project workflow enable/disable`。
- 不修改历史 Task JSON。
- 不改变 `task create`、`task complete`、`task evidence` 现有契约。
- 新 CLI 命令只读，默认 exit code 0；输入错误 exit code 2。
- Public API 新增导出，不删除现有导出。

## 关键交互流程

### 推荐

```text
project profile recommend
  ├─ 读取 adaptive workflow config
  ├─ 解析 request + files
  ├─ 按确定性规则收集 riskFactors
  ├─ 按 governed > standard > quick 选择推荐
  └─ 输出 text/json + override guidance
```

### 度量

```text
project profile metrics
  ├─ buildProjectSnapshot(include specs,tasks)
  ├─ 按 Task profile 分桶
  ├─ 对 standard/governed Task 调用 buildTaskEvidence
  ├─ 聚合 governed coverage 和 standard warnings
  ├─ 聚合 explicit overrides
  └─ 输出 text/json
```

## 可观测性

- 推荐结果显示规则版本、命中特征和最终优先级。
- metrics 显示 generatedAt、topic 过滤和 adaptive workflow 状态。
- explicit overrides 列出 task/spec/profile/reason，便于审计。
- invalid evidence projection 以 warning 进入 metrics，不静默吞掉。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| adaptive workflow 配置 | `src/core/workflow-profile.ts` | `readAdaptiveWorkflowConfig`, `WorkflowProfile` | 推荐输出当前配置，metrics 解释 legacy |
| Task 模型 | `src/core/task.ts` | `TaskRecord` | 读取 profile/profileSource/profileOverrideReason |
| Evidence 投影 | `src/core/task-evidence.ts` | `buildTaskEvidence`, `evaluateEvidenceCoverage` | 聚合 coverage |
| 项目快照 | `src/core/project-snapshot.ts` | `buildProjectSnapshot` | metrics 扫描 specs/tasks |
| Project CLI | `src/cli/project.ts` | `registerProject` | 新增 profile 子命令 |
| 方法论契约 | `src/core/__tests__/methodology-contract.test.ts` | 文档断言 | 防止推荐/度量边界漂移 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| adaptive-profile-intelligence-L3.1.1-recommend | Profile 推荐规则、Core API、`project profile recommend` CLI、推荐文档同步 | 本 L2 confirmed |
| adaptive-profile-intelligence-L3.1.2-metrics | Profile metrics 聚合、`project profile metrics` CLI、覆盖审计视图、Agent/methodology 同步 | L3.1.1 implemented |

## 关联

- parent: `adaptive-profile-intelligence-L1`
- based_on: `adaptive-evidence-workflow-L3.1.1-profile`
- based_on: `adaptive-evidence-workflow-L3.1.2-evidence`
- code_ref: `src/core/workflow-profile.ts`
- code_ref: `src/core/task-evidence.ts`
- code_ref: `src/core/project-snapshot.ts`
