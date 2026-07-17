---
code: spec-knowledge-governance-L3.1.2-disposition
level: L3
title: 'History Disposition, Approval Gate, and Brief Projection'
topic: spec-knowledge-governance
parentCode: spec-knowledge-governance-L2.1
status: implemented
aiSummary: >-
  实施可选 historyReview schema、历史来源 attach/set/show、渐进式 L1/L2 确认门禁、agent-brief.v1
  可选知识投影与 canonical AC 连续性，并覆盖 legacy、只读、topic 和 governed evidence 兼容回归。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3/L2/L3.1.1、历史 Task、agent-plan 模板和 Spec/Brief 调用链'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 src/schemas/spec.ts 和 src/core/spec-io.ts 增加 historyReview schema
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 新增 historyReview 核心服务实现 attach、set 和 report
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 src/core/spec-policy.ts 和 transition handler 增加渐进式确认门禁
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 src/cli/spec.ts 挂载 history show、attach 和 set 命令
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 修改 capability-types.ts 和 capability-brief.ts 增加只读 knowledge 投影
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 连接 affectedCriteria、canonical AC ref 与 critical readiness 连续性
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 补充 Spec policy、CLI、Brief、legacy 和 governed AC 回归测试
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: '验证: 运行定向 Vitest、npm run build、全量 Vitest 和确认门禁反向 smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-governance-L2.1
  - type: references
    target: spec-knowledge-governance-L3.1.1-validity
  - type: references
    target: spec-knowledge-loop-L2.1
  - type: references
    target: critical-ac-readiness-L2.1
created: '2026-07-16T03:25:01.362Z'
updated: '2026-07-16T04:07:11.790Z'
changeSummary: 'cascade: task-complete'
---
# History Disposition, Approval Gate, and Brief Projection — 实施规格

## 目标

实施 `spec-knowledge-governance-L2.1` 的结构化 historyReview、`spec history` 命令、渐进式确认门禁、Brief 知识投影与关键 AC 影响追踪，使关键历史在 L1/L2 审批和 governed L3/Task 之间保持可审计连续性。

**前置依赖**: `spec-knowledge-governance-L3.1.1-validity` 已 implemented

## 实施步骤

### Step 1 — 上下文收集

- **SHALL** 读取本 L3、`spec-knowledge-governance-L2.1`、已实现的 `spec-knowledge-governance-L3.1.1-validity` 和本 topic 历史 Task。
- **SHALL** 复核 `src/schemas/spec.ts`、`src/core/spec-io.ts`、`src/core/spec-policy.ts`、`src/cli/spec.ts`、`src/cli/spec-handlers.ts`、`src/core/capability-types.ts`、`src/core/capability-brief.ts`、`src/core/critical-readiness.ts` 及对应测试。
- **SHALL** 读取 `.agents/skills/spec-manager/templates/agent-plan.json` 确认 planJson 字段。

### Step 2 — 扩展 Spec historyReview schema

- **SHALL** 在 `src/schemas/spec.ts` 定义 `HistoryDispositionActionSchema`、`HistoryDispositionSchema` 和 `HistoryReviewSchema`，并以可选 `historyReview` 扩展 `SpecFrontmatterSchema`。
- **SHALL** 同步 `src/core/spec-io.ts` 的 TypeScript 接口，保留旧 frontmatter 可解析且不补写默认字段。
- **SHALL** 校验 sourceRef 去重、每个 source 至多一个 disposition，以及 change/reject/unknown 必须有 reason。

### Step 3 — 实现 historyReview 更新服务

- **SHALL** 在独立核心模块中实现 `attachHistorySources`、`setHistoryDisposition`、`buildHistoryReviewReport`，并通过 `updateSpec`/事务能力持久化，不由 CLI 直接写 Markdown。
- **SHALL** 使用 L3.1.1 的 source validator 与 resolver 校验来源并投影知识状态。
- **SHALL** 校验 `affectedCriteria` 引用目标 Spec 正文中真实存在的 AC ID；未知 AC 返回 `HISTORY_AC_NOT_FOUND`。
- **SHALL** attach 批量失败时零写入；set 更新同一 source 时替换当前 disposition，不保留重复项。

### Step 4 — 接入渐进式确认门禁

- **SHALL** 在 `src/core/spec-policy.ts` 或 transition handler 的确认路径增加 `validateHistoryReviewForConfirmation`。
- **SHALL** 仅在 L1/L2 显式存在 historyReview 时启用阻断：sources 非空则每项必须有 disposition；sources 为空则 `noRelevantHistoryReason` 必须非空。
- **SHALL** legacy Spec 无 historyReview 时维持原确认行为，并返回可观测的未采用治理信息而非批量迁移要求。
- **SHALL** 对未处置来源返回 `HISTORY_REVIEW_INCOMPLETE`，状态和文件保持原值。

### Step 5 — 实现 `spec history` CLI

- **SHALL** 在 `src/cli/spec.ts` 挂载 `history show/attach/set` 子命令，业务逻辑放在可测试 handler/core 层。
- **SHALL** 支持 `attach <code> --sources <csv>`、`set <code> --source --action [--reason] [--criteria <csv>]` 和 `show <code> [--json]`。
- **SHALL** 文本与 JSON 输出展示来源、resolved knowledge、disposition、未处置项和 affectedCriteria；show 保持只读。

### Step 6 — 增加 Agent Brief 知识投影

- **SHALL** 在 `src/core/capability-types.ts` 为 Brief Spec/Decision/Task/Lesson 项增加可选 `knowledge`，保留 `agent-brief.v1` 和原字段。
- **SHALL** 在 `buildAgentBrief` 完成既有检索后批量调用 resolver 附加 state、basis、reason、replacementRef、reviewedAt，不改变显式 topic、排序、上限和 nextCommand。
- **SHALL** resolver 单项失败时只把该项投影为 unknown 并增加 finding，不得阻断其他历史结果或写入状态。

### Step 7 — 连接关键 AC 连续性

- **SHALL** 允许 history disposition 的 `affectedCriteria` 指向当前 Spec 的 AC，并在 history report 中按 AC 聚合来源及 reuse/change/reject/unknown。
- **SHALL** 为 L3/governed Task 提供 canonical `ac:<specCode>:<AC-ID>` 来源引用，使现有 critical readiness 和 verification evidence 可以使用同一 AC ID。
- **SHALL** 不自动把 disposition 或检索建议转换成 critical AC；缺少明确 AC 映射时保持 unknown 并提示人工补充。

### Step 8 — 增加兼容与门禁测试

- **SHALL** 修改 `src/core/__tests__/spec-policy.test.ts`、`src/core/__tests__/spec-io.test.ts`，覆盖 schema、完整处置、空历史理由、legacy 兼容和确认失败零写入。
- **SHALL** 修改 `src/cli/__tests__/spec.test.ts`、`src/cli/__tests__/spec-handlers.test.ts`，覆盖 history 命令和稳定错误。
- **SHALL** 修改 `src/core/__tests__/capability-brief.test.ts`、`src/cli/__tests__/capability.test.ts`，覆盖可选 knowledge、原字段/排序/topic 兼容和只读行为。
- **SHALL** 增加 governed critical AC 连续性测试，证明关键 AC 可被 readiness 读取且仍需成功 verification evidence。

### Step 9 — 构建与验证

- **SHALL** 运行定向 Vitest、TypeScript build、全量测试和真实 CLI smoke。
- **SHALL** 验证未处置 historyReview 无法 confirm、完整处置可以 confirm、legacy L1/L2 保持可确认、Brief 前后不会改变任何知识或 Spec 文件。

## 验证命令

```bash
# 正向验证: schema、门禁、CLI、Brief 与 AC 连续性
npm test -- --run src/core/__tests__/spec-policy.test.ts src/core/__tests__/spec-io.test.ts src/core/__tests__/capability-brief.test.ts src/cli/__tests__/spec.test.ts src/cli/__tests__/spec-handlers.test.ts src/cli/__tests__/capability.test.ts
# 预期: Test Files 全部 passed，Tests 全部 passed

npm run build
# 预期: tsc 退出码 0

npm test -- --run
# 预期: Test Files 全部 passed，Tests 全部 passed，既有 Brief 兼容用例通过

# 反向验证: 确认门禁与只读行为
npm test -- --run src/core/__tests__/spec-policy.test.ts src/core/__tests__/capability-brief.test.ts -t "rejects incomplete history review|keeps legacy confirmation compatible|does not write during brief"
# 预期: 3 个目标用例 passed；不完整处置错误含 HISTORY_REVIEW_INCOMPLETE，legacy 可确认，Brief 文件 hash 不变
```

## 验收标准

1. **AC-3**: 带 historyReview 的新 L1/L2 在确认前，每个 attached source 都具有 reuse/change/reject/unknown 之一；空来源具有 noRelevantHistoryReason。
2. **AC-4**: change/reject/unknown 展示非空原因，affectedCriteria 只能引用当前 Spec 中存在的 AC。
3. **AC-5**: L3 关键历史使用 canonical AC ref，并能被 governed Task 的 readiness 与 verification evidence 按相同 AC ID 追踪。
4. **AC-9**: Brief、history show 和门禁检查不自动修改知识状态、Decision、Spec 内容或 AC。
5. **AC-10**: 没有 historyReview 的 legacy Spec 保持可读、可检索和原确认行为。
6. **AC-11**: `agent-brief.v1`、原字段、显式 topic、排序上限和人工审批语义保持兼容。

## 关键验收标准

- AC-3
- AC-4
- AC-5
- AC-9
- AC-10
- AC-11

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["spec-knowledge-governance-L3.1.2-disposition"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3/L2/L3.1.1、历史 Task、agent-plan 模板和 Spec/Brief 调用链"},
    {"stepNo": 2, "stepType": "tool_action", "name": "修改 src/schemas/spec.ts 和 src/core/spec-io.ts 增加 historyReview schema"},
    {"stepNo": 3, "stepType": "tool_action", "name": "新增 historyReview 核心服务实现 attach、set 和 report"},
    {"stepNo": 4, "stepType": "tool_action", "name": "修改 src/core/spec-policy.ts 和 transition handler 增加渐进式确认门禁"},
    {"stepNo": 5, "stepType": "tool_action", "name": "修改 src/cli/spec.ts 挂载 history show、attach 和 set 命令"},
    {"stepNo": 6, "stepType": "tool_action", "name": "修改 capability-types.ts 和 capability-brief.ts 增加只读 knowledge 投影"},
    {"stepNo": 7, "stepType": "tool_action", "name": "连接 affectedCriteria、canonical AC ref 与 critical readiness 连续性"},
    {"stepNo": 8, "stepType": "tool_action", "name": "补充 Spec policy、CLI、Brief、legacy 和 governed AC 回归测试"},
    {"stepNo": 9, "stepType": "tool_action", "name": "验证: 运行定向 Vitest、npm run build、全量 Vitest 和确认门禁反向 smoke"}
  ]
}
```

`autoConfirm` 取 `false`：history disposition 与 AC 影响属于人工审批语义，Task 不得替用户自动确认处置结论。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 确认门禁误阻断 | 回退门禁接入提交；保留可选 historyReview 数据，不影响旧 schema | < 10 min |
| Brief 消费者不兼容 | 回退可选 knowledge 投影；注册表和 historyReview 数据仍可独立使用 | < 5 min |
| frontmatter 序列化异常 | 从版本控制恢复受影响 Spec，并回退 schema/更新服务提交 | < 10 min |
| AC 映射错误 | 回退 affectedCriteria 更新；不删除原始 history source 或 annotation | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 门禁范围过宽导致存量 Spec 无法推进 | 只在显式存在 historyReview 时启用阻断，并固定 legacy 回归测试 |
| CLI 直接修改 Markdown 绕过 policy | CLI 只调用核心服务，核心统一走 updateSpec/事务与 schema 校验 |
| Brief 批量解析拖慢检索 | 单次读取注册表并按结果集解析，不为每项重复扫描项目 |
| disposition 被误当成知识状态 | 类型、命令和输出分栏独立；reuse 不隐式执行 knowledge set |
| AC 文本变化导致引用漂移 | canonical ref 只绑定稳定 AC ID，确认时校验 ID 当前存在，不匹配文本猜测 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-governance-L2.1 | 实施历史处置、门禁、Brief 和 AC 连续性契约 |
| references | spec-knowledge-governance-L3.1.1-validity | 复用来源引用、resolver 和注册表读取能力 |
| references | spec-knowledge-loop-L2.1 | 保持 Phase 1 Brief 检索契约兼容 |
| references | critical-ac-readiness-L2.1 | 复用关键 AC readiness 与 evidence 口径 |
