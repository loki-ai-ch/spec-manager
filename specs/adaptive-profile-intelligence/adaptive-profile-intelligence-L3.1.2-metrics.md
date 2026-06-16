---
code: adaptive-profile-intelligence-L3.1.2-metrics
level: L3
title: Profile 度量聚合与覆盖审计 CLI
topic: adaptive-profile-intelligence
parentCode: adaptive-profile-intelligence-L2.1
status: implemented
aiSummary: >-
  实现 Profile metrics 聚合与 project profile metrics CLI：按 Profile 汇总 Task
  状态、governed coverage、standard warnings、explicit overrides、topic 过滤和 JSON/text
  输出，保持 legacy 兼容且不改变完成门禁。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 读取 L2、Task/Evidence/Profile 现有实现和 CLI 基线
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 Profile metrics core API 与类型导出
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 实现 coverage、standard warning、invalid projection 和 topic 过滤规则
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 新增 project profile metrics CLI text/json 输出与错误处理
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 同步方法论、skill 与 Agent managed assets
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 验证聚焦、全量、构建、安装版 CLI 和 spec-manager 自检
    status: pending
created: '2026-06-16T06:56:17.371Z'
updated: '2026-06-16T07:07:21.119Z'
changeSummary: 'cascade: task-complete'
---
# Profile 度量聚合与覆盖审计 CLI

## 背景

`adaptive-profile-intelligence-L3.1.1-recommend` 已交付本地确定性 Profile 推荐和 `project profile recommend` CLI。`adaptive-profile-intelligence-L2.1` 仍要求交付 Profile metrics 聚合、覆盖审计视图和 `project profile metrics` CLI，用于回答：

- 各 Profile 下 Task 的采用、完成、失败和运行中分布。
- governed Task 的关键 AC evidence coverage 是否存在缺口。
- standard Task 的关键 AC 缺口是否以 warning 统计，而不是变成完成违规。
- explicit Profile 覆盖理由是否能被审计查看。

本 L3 只实现只读报告能力，不改变 `task create`、`task complete`、`task evidence` 和 adaptive workflow 配置语义。

## 目标

### 做

- 新增 Profile metrics core API，基于本地 spec/task/evidence 数据生成聚合报告。
- 新增 `spec-manager project profile metrics [--topic <topic>] [--json]`。
- 汇总 totals、byProfile、governed evidence coverage、standard warnings、explicit overrides。
- 对旧 Task 缺少 profile 的情况归入 `legacy`。
- 未启用 adaptive workflow 时仍可运行，并在输出中说明 legacy compatibility。
- 输出稳定 `schemaVersion: profile-metrics.experimental.v1`。
- 补充单元测试、CLI 测试、方法论契约和 Agent/skill 入口说明。

### 不做

- 不新增远端遥测、数据库或长期 metrics log。
- 不自动修改历史 Task、Spec、audit 或 workflow config。
- 不把 metrics 报告变成新的完成门禁。
- 不实现基于历史数据自动调参。
- 不要求推荐 ID 持久化；首版 overrides 只汇总现有 `profileSource/profileOverrideReason`。

## 实施步骤

1. 读取 `adaptive-profile-intelligence-L2.1`、`src/core/task.ts`、`src/core/task-evidence.ts`、`src/core/workflow-profile.ts` 和 `src/cli/project.ts`，确认 Task、Evidence、Profile 与 project profile CLI 的现有契约。
2. 新增 `src/core/profile-metrics.ts`，实现 `buildProfileMetrics()`、metrics 类型、topic 校验和 legacy compatibility 输出。
3. 复用现有 Task/Evidence 事实源实现 Profile 分桶、状态统计、governed coverage、standard warning、invalid projection 和 explicit overrides 聚合。
4. 扩展 `project profile` 子命令，新增 `metrics [--topic <topic>] [--json]` text/json 输出和 `INVALID_PROFILE_METRICS_TOPIC` 错误映射。
5. 补充 core/CLI/methodology 测试，并同步 `docs/methodology.md`、`skill/SKILL.md`、`templates/agents/*` 与 managed assets。
6. 运行聚焦测试、全量测试、lint、build、installed CLI 校验、project doctor、spec validate 和 plan validate，并把结果写入 Task verification evidence。

## 受影响文件

| 路径 | 变更 |
|---|---|
| `src/core/profile-metrics.ts` | 新增 metrics 聚合核心与类型 |
| `src/index.ts` | 导出 metrics API |
| `src/cli/project.ts` | 扩展 `project profile metrics` 子命令 |
| `src/core/__tests__/profile-metrics.test.ts` | 新增 core 聚合测试 |
| `src/cli/__tests__/project-profile.test.ts` | 扩展 project profile CLI 测试 |
| `src/core/__tests__/methodology-contract.test.ts` | 补充 metrics 方法论边界断言 |
| `docs/methodology.md` | 补充 Profile metrics 说明 |
| `skill/SKILL.md` 与 `templates/agents/*` | 同步 Agent 入口规则 |
| `.claude/skills/spec-manager/*`、`.codebuddy/skills/spec-manager/*` | 通过 managed sync 更新 |

## 数据契约

### Core API

```typescript
type MetricsProfileBucket = 'legacy' | 'standard' | 'governed';

interface ProfileMetricsReport {
  schemaVersion: 'profile-metrics.experimental.v1';
  generatedAt: string;
  topic?: string;
  adaptiveWorkflow: {
    enabled: boolean;
    defaultProfile: 'standard' | 'governed';
    note: string;
  };
  totals: {
    tasks: number;
    completed: number;
    failed: number;
    active: number;
  };
  byProfile: Record<MetricsProfileBucket, {
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
    invalidProjections: Array<{ specCode: string; taskId: string; error: string }>;
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

### 函数

```typescript
buildProfileMetrics(paths: ProjectPaths, opts?: {
  topic?: string;
  now?: Date;
}): ProfileMetricsReport
```

`now` 仅用于测试固定 `generatedAt`，CLI 不暴露。

## 聚合规则

1. Task 枚举：
   - 使用项目快照或现有 Task 读取能力扫描 active specs 下的 Task。
   - `--topic <topic>` 只纳入该 topic 的 spec/task。
2. Profile 分桶：
   - `task.profile === 'standard'` 进入 `standard`。
   - `task.profile === 'governed'` 进入 `governed`。
   - 其他缺失或未知值进入 `legacy`，不抛错。
3. 状态统计：
   - `completed` 计入 completed。
   - `failed` 计入 failed。
   - 其他非终态计入 active。
   - `completionRate = completed / tasks`，无 task 时为 `null`。
4. Evidence 汇总：
   - governed/standard Task 尝试复用 `buildTaskEvidence` 与 coverage evaluation。
   - governed 统计 required/covered/failed/uncovered，并列出 completed governed gaps。
   - standard 缺口只进入 warnings/missing，不改变命令 exit code。
   - 单个 projection 失败进入 `invalidProjections`，metrics 命令继续处理其他 Task。
5. Override 审计：
   - 只列出 `profileSource === 'explicit'` 且有 `profileOverrideReason` 的 standard/governed Task。
   - 不推断推荐 Profile 与最终 Profile 的差异；首版只审计显式覆盖事实。

## CLI 契约

```text
spec-manager project profile metrics [--topic <topic>] [--json]
```

Text 输出必须包含：

- schema/rule 版本或报告版本。
- adaptive workflow enabled/defaultProfile/legacy compatibility note。
- totals 和 byProfile。
- governed coverage summary。
- standard warning summary。
- explicit overrides 数量与列表。
- invalid evidence projections warning。

JSON 输出必须是 `ProfileMetricsReport`，不得依赖自然语言解析。

错误：

| 错误码 | 条件 | Exit |
|---|---|---|
| `INVALID_PROFILE_METRICS_TOPIC` | topic 为空、包含 `/`、`\`、`..` 或路径分隔风险字符 | 2 |

## 验收标准

1. **AC-1**: Given 项目存在 legacy、standard、governed Task，When 调用 core metrics，Then 按 Profile 返回 tasks/completed/failed/active/completionRate。
2. **AC-2**: Given governed Task 存在关键 AC evidence 缺口，When 生成 metrics，Then 返回 governed required/covered/failed/uncovered，并列出 completedWithGaps。
3. **AC-3**: Given standard Task 存在关键 AC 缺口，When 生成 metrics，Then 统计 warnings/missing，但 CLI exit code 仍为 0。
4. **AC-4**: Given Task 使用 explicit profile 且有 override reason，When 生成 metrics，Then overrides 列出 specCode/taskId/profile/reason。
5. **AC-5**: Given adaptive workflow 未启用，When 调用 metrics，Then 不写配置、不改变完成语义，并输出 legacy compatibility note。
6. **AC-6**: Given 用户传入 `--topic`，When 调用 metrics，Then 只统计该 topic 的 spec/task。
7. **AC-7**: Given 用户请求 `--json`，When 调用 metrics，Then 输出 `profile-metrics.experimental.v1` 且结构稳定。
8. **AC-8**: Given topic 参数非法，When 调用 CLI，Then 输出 `INVALID_PROFILE_METRICS_TOPIC` 并以 exit code 2 失败。
9. **AC-9**: Given 单个 Task evidence projection 失败，When 生成 metrics，Then 记录 invalidProjections 并继续汇总其他 Task。
10. **AC-10**: Given 方法论和 Agent 入口同步后，When 运行契约测试和 managed asset doctor，Then 推荐/度量边界描述保持一致。

## 验证命令

- `npx vitest run src/core/__tests__/profile-metrics.test.ts --reporter=dot`
- `npx vitest run src/cli/__tests__/project-profile.test.ts --reporter=dot`
- `npx vitest run src/core/__tests__/methodology-contract.test.ts --reporter=dot`
- `npm test -- --reporter=dot`
- `npm run lint`
- `npm run build`
- `npm run verify:installed-cli`
- `spec-manager project doctor`
- `spec-manager spec validate adaptive-profile-intelligence-L3.1.2-metrics`
- `spec-manager spec validate-plan --from-spec adaptive-profile-intelligence-L3.1.2-metrics`

## planJson (final)

```json
{
  "schemaVersion": "spec-manager.plan.v1",
  "spec": "adaptive-profile-intelligence-L3.1.2-metrics",
  "profile": "standard",
  "steps": [
    {
      "stepNo": 1,
      "name": "读取 L2、Task/Evidence/Profile 现有实现和 CLI 基线",
      "stepType": "mcp_tool",
      "status": "pending",
      "evidence": "确认可复用 ProjectSnapshot/TaskRecord/buildTaskEvidence/readAdaptiveWorkflowConfig 与 project profile CLI 结构"
    },
    {
      "stepNo": 2,
      "name": "新增 Profile metrics core API 与类型导出",
      "stepType": "mcp_tool",
      "status": "pending",
      "evidence": "src/core/profile-metrics.ts 与 src/index.ts 支持 profile buckets、totals、evidence、overrides"
    },
    {
      "stepNo": 3,
      "name": "实现 coverage、standard warning、invalid projection 和 topic 过滤规则",
      "stepType": "mcp_tool",
      "status": "pending",
      "evidence": "core 单元测试覆盖 AC-1 到 AC-6、AC-9"
    },
    {
      "stepNo": 4,
      "name": "新增 project profile metrics CLI text/json 输出与错误处理",
      "stepType": "mcp_tool",
      "status": "pending",
      "evidence": "CLI 测试覆盖 --json、--topic、非法 topic、legacy note 和 exit code"
    },
    {
      "stepNo": 5,
      "name": "同步方法论、skill 与 Agent managed assets",
      "stepType": "mcp_tool",
      "status": "pending",
      "evidence": "docs/methodology.md、skill/SKILL.md、templates/agents/* 与 managed assets 更新并通过契约测试"
    },
    {
      "stepNo": 6,
      "name": "验证聚焦、全量、构建、安装版 CLI 和 spec-manager 自检",
      "stepType": "mcp_tool",
      "status": "pending",
      "evidence": "验证计划全部通过，并记录 task verification evidence"
    }
  ]
}
```
