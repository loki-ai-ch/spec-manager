---
code: adaptive-profile-intelligence-L3.1.1-recommend
level: L3
title: Profile 推荐规则与 CLI
topic: adaptive-profile-intelligence
parentCode: adaptive-profile-intelligence-L2.1
status: implemented
aiSummary: >-
  实施本地确定性 Profile 推荐规则、profile-recommendation Core API、project profile recommend
  CLI、text/json 输出和推荐边界文档/Agent 资产同步；不实现 metrics 聚合。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 读取 adaptive-profile-intelligence-L2.1、workflow-profile 与 project CLI 基线
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 Profile 推荐核心模块与公开导出
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 实现 governed/standard/quick 确定性推荐规则
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 新增 project profile recommend CLI text/json 输出
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 同步方法论、skill 和 Agent 入口推荐规则
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 验证推荐聚焦测试、全量测试、lint、build、installed CLI 和 project doctor
    status: pending
created: '2026-06-16T06:30:43.784Z'
updated: '2026-06-16T06:40:43.841Z'
changeSummary: 'cascade: task-complete'
---
# Profile 推荐规则与 CLI — 实施规格

## 目标

实施 `adaptive-profile-intelligence-L2.1` 的第一个 L3 切片：本地确定性 Profile 推荐规则、Core API、`project profile recommend` CLI、text/json 输出和推荐边界文档同步。

**前置依赖**: `adaptive-profile-intelligence-L2.1` confirmed；`adaptive-evidence-workflow-L3.1.1-profile` implemented。

## 实施步骤

### Step 1 — 上下文收集与基线确认

- Read `adaptive-profile-intelligence-L3.1.1-recommend`、`adaptive-profile-intelligence-L2.1` 和 `adaptive-profile-intelligence-L1`。
- Read `src/core/workflow-profile.ts`，确认 adaptive workflow config 读取和 Profile 类型。
- Read `src/cli/project.ts`，确认 `project workflow` 子命令结构和 presenter 风格。
- Read `src/core/__tests__/workflow-profile.test.ts`、`src/cli/__tests__/project-workflow.test.ts`、`src/core/__tests__/methodology-contract.test.ts`，确认测试 fixture 与断言模式。
- Read `src/index.ts`，确认 Public API 导出位置。
- 运行现有 profile/workflow/project CLI 聚焦测试，记录基线。

### Step 2 — 新增 Profile 推荐核心模块

- 新增 `src/core/profile-recommendation.ts`，定义并导出：
  - `RecommendedWorkflowProfile = 'quick' | 'standard' | 'governed'`
  - `RiskFactorSeverity = 'low' | 'medium' | 'high'`
  - `ProfileRiskFactor`
  - `ProfileRecommendation`
  - `ProfileRecommendationInput`
  - `recommendWorkflowProfile(input)`
- `recommendWorkflowProfile()` SHALL 调用 `readAdaptiveWorkflowConfig(paths)`，并在输出中包含 `adaptiveWorkflow.enabled/defaultProfile/note`。
- 空 request 或全空白 request SHALL 抛出 `PROFILE_RECOMMENDATION_REQUEST_REQUIRED`。
- `files` SHALL 支持可选字符串数组；空字符串项 SHALL 忽略；路径匹配只做本地字符串规则，不访问文件系统。
- 输出 `schemaVersion` SHALL 固定为 `profile-recommendation.experimental.v1`。
- 从 `src/index.ts` 导出该模块。

### Step 3 — 实现确定性推荐规则

- 实现本地规则表，按 governed > standard > quick 优先级决策。
- governed risk factors SHALL 覆盖至少：
  - `schema_or_migration`: request/files 命中 schema、migration、database、数据迁移、DDL、`src/core/spec-policy.ts` 等。
  - `security_or_permission`: auth、security、permission、token、权限、认证、登录、支付等。
  - `production_or_deploy`: deploy、production、release、rollback、上线、生产等。
  - `workflow_core`: `src/core/task-completion.ts`、`src/core/integrity.ts`、`src/core/workflow-profile.ts`、`src/core/task-evidence.ts`、`src/core/spec-policy.ts` 等治理核心路径。
- standard risk factors SHALL 覆盖至少：
  - `multi_file`: files 非空且数量大于 1。
  - `feature_or_refactor`: feature、refactor、CLI、test、docs+code、功能、重构、测试等。
  - `spec_workflow`: spec、L1、L2、L3、Task、workflow 等。
- quick risk factors SHALL 覆盖至少：
  - `small_text_change`: typo、format、comment、copy、文案、注释、格式。
- 如果没有任何 risk factor，SHALL 推荐 `standard`，理由为“默认非 quick 工作使用完整规格流程”。
- 同一输入 SHALL 输出同一推荐顺序和 reasons 顺序。
- quick 推荐 SHALL 在 `override.guidance` 或 reasons 中明确 quick 仅适用于受限轻量例外，非平凡工作仍需 L1/L2/L3/Task。

### Step 4 — 新增 `project profile recommend` CLI

- 在 `src/cli/project.ts` 新增 `project profile` 子命令分组。
- 注册：
  - `spec-manager project profile recommend --request <text> [--files <a,b>] [--json]`
- text 输出 SHALL 展示：
  - Recommended Profile
  - Adaptive Workflow 当前 enabled/defaultProfile 和 legacy compatibility note
  - Risk Factors 列表
  - Reasons 列表
  - Override guidance
- JSON 输出 SHALL 直接输出 `ProfileRecommendation`。
- `PROFILE_RECOMMENDATION_REQUEST_REQUIRED` SHALL 映射为稳定 stderr 和 exit code 2。
- CLI 不得写 `.spec-manager/config.yaml`、Task JSON 或 audit 文件。

### Step 5 — 文档、模板与 Agent 入口同步

- 更新 `docs/methodology.md`，补充 Profile 推荐能力边界：
  - 推荐是本地确定性建议，不是 hard gate。
  - 推荐不会自动启用 adaptive workflow。
  - 用户可覆盖推荐，最终 hard gate 由 Task Profile 与 evidence coverage 决定。
- 更新 `skill/SKILL.md`、`templates/agents/`、根 `AGENTS.md`/`CLAUDE.md`/`CODEBUDDY.md` 对应规则，加入推荐命令使用建议。
- 运行 `spec-manager project agents --provider claude,codebuddy --sync-managed` 同步托管资产。
- 更新方法论契约测试，确保文档不会把推荐描述成自动选择或隐藏门禁。

### Step 6 — 验证与交付收口

- 增加并运行：
  - `src/core/__tests__/profile-recommendation.test.ts`
  - `src/cli/__tests__/project-profile.test.ts`
  - `src/core/__tests__/methodology-contract.test.ts`
- 运行全量测试、lint、build、installed CLI verification、project doctor。
- 使用 installed CLI 在临时 fixture 中验证：
  - 未启用 adaptive workflow 时推荐命令可运行且提示 legacy compatibility。
  - 高风险 request 推荐 governed。
  - quick 文案修改 request 推荐 quick。
  - 空 request 返回 exit code 2。
- 检查 git diff，确认本 L3 未实现 `project profile metrics` 或 metrics 聚合逻辑。

## 验收标准

1. **AC-1**: `recommendWorkflowProfile()` SHALL 对非空 request 返回 `profile-recommendation.experimental.v1`、推荐 Profile、riskFactors、reasons、override guidance 和 adaptive workflow 状态。
2. **AC-2**: 推荐规则 SHALL 按 governed > standard > quick 的确定性优先级输出；相同 request/files 在相同规则版本下输出一致。
3. **AC-3**: 高风险关键词或治理核心路径 SHALL 推荐 governed，并给出至少一条 high severity risk factor。
4. **AC-4**: 小型文案、注释、格式或 typo 类请求且未命中更高风险时 SHALL 推荐 quick，并提示 quick 受限边界。
5. **AC-5**: 未启用 adaptive workflow 的项目 SHALL 仍可调用推荐命令，且命令不得写配置或改变 Task 语义。
6. **AC-6**: `project profile recommend --json` SHALL 输出可解析 JSON；text 输出 SHALL 包含推荐、风险特征、理由和覆盖说明。
7. **AC-7**: 空 request SHALL 返回稳定错误 `PROFILE_RECOMMENDATION_REQUEST_REQUIRED`，CLI exit code SHALL 为 2。
8. **AC-8**: 方法论、skill 和 Agent 入口 SHALL 明确推荐是可解释建议，不是自动选择或隐藏门禁。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-5
- AC-7

## 验证命令

```bash
# 正向验证：推荐核心、CLI 与方法论契约
npx vitest run src/core/__tests__/profile-recommendation.test.ts src/cli/__tests__/project-profile.test.ts src/core/__tests__/methodology-contract.test.ts --reporter=dot
npm test -- --reporter=dot
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor

# 规格与计划验证
spec-manager spec validate adaptive-profile-intelligence-L3.1.1-recommend
spec-manager spec validate-plan --from-spec adaptive-profile-intelligence-L3.1.1-recommend
```

预期：

- 聚焦测试和全量测试 exit code 均为 0。
- lint、build、installed CLI verification exit code 均为 0。
- `project doctor` 输出 `Project doctor: ok`。
- Spec validate 输出所有必填段齐全且无 RFC 2119 warning。
- validate-plan 不报告 plan 字段、coveredSpecs 或末步验证错误。

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["adaptive-profile-intelligence-L3.1.1-recommend"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 adaptive-profile-intelligence-L2.1、workflow-profile 与 project CLI 基线"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 Profile 推荐核心模块与公开导出"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "实现 governed/standard/quick 确定性推荐规则"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "新增 project profile recommend CLI text/json 输出"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "同步方法论、skill 和 Agent 入口推荐规则"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "验证推荐聚焦测试、全量测试、lint、build、installed CLI 和 project doctor"}
  ]
}
```

`autoConfirm=false`。本 L3 新增用户可见推荐入口和方法论规则，必须经过人工批准后冻结实施。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 推荐规则误导用户 | 回退 `profile-recommendation` 模块和 CLI 子命令；不影响 existing Task/Profile gate | < 15 min |
| CLI 输出契约不合适 | 回退 `project profile recommend` presenter；核心模块可保留或一并回退 | < 10 min |
| 文档误宣称自动门禁 | 回退 docs/skill/Agent 资产并重新同步 managed assets | < 15 min |
| Public API 导出冲突 | 回退 `src/index.ts` 新导出 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 关键词规则过度简单 | 输出 riskFactors/reasons，用户可覆盖；后续 metrics L3 统计覆盖情况 |
| quick 推荐被滥用 | quick reasons/guidance 明确受限边界；非平凡工作仍走 L1/L2/L3/Task |
| 推荐被误读为强制门禁 | 文档、CLI 文案和测试明确推荐不是 hard gate |
| 文件路径规则误报 governed | 只提升治理强度，不自动创建 Task；用户可覆盖并记录理由 |
| 与后续 metrics 混杂 | 本 L3 明确不实现 `project profile metrics`，仅保留后续 L3 范围 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | adaptive-profile-intelligence-L2.1 | 实现推荐规则与 CLI 切片 |
| references | adaptive-evidence-workflow-L3.1.1-profile | 复用 adaptive workflow 配置与 Profile 类型 |
| references | lifecycle-guidance-sync-L3.1.2-distribution | 复用 managed Agent 资产同步约束 |
