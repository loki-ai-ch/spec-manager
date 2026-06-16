---
code: adaptive-evidence-workflow-L3.1.2-evidence
level: L3
title: 验收证据投影与完成门禁
topic: adaptive-evidence-workflow
parentCode: adaptive-evidence-workflow-L2.1
status: implemented
aiSummary: >-
  实施 Evidence 投影、task evidence CLI、governed 完成覆盖门禁、standard
  warning、doctor/integrity 诊断与方法论/Agent 资产同步；依赖 L3.1.1 Profile 快照和关键 AC 解析。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取
      adaptive-evidence-workflow-L3.1.1-profile、adaptive-evidence-workflow-L2.1
      和完成链路基线
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 Evidence 投影核心模块与公开导出
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 接入 task complete evidence coverage gate
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 新增 task evidence CLI 与 text/json presenter
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 同步完成输出与 Harness evidence 上下文
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 补充 doctor、integrity 与 audit 诊断
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 同步方法论、模板与 Agent managed 资产
    status: pending
  - stepNo: 8
    stepType: mcp_tool
    name: 验证 Evidence 聚焦测试、全量测试、lint、build、installed CLI 和 project doctor
    status: pending
created: '2026-06-15T10:07:32.630Z'
updated: '2026-06-16T01:30:08.275Z'
changeSummary: 'cascade: task-complete'
---
# 验收证据投影与完成门禁 — 实施规格

## 目标

实施 `adaptive-evidence-workflow-L2.1` 的第二个模块边界：基于已落地的 Task Profile 快照、L3 关键验收标准解析和 verification 记录，提供统一 Evidence 投影、`task evidence` CLI、`task complete` 关键 AC 覆盖门禁、诊断与方法论同步。

**前置依赖**: `adaptive-evidence-workflow-L3.1.1-profile` implemented。

## 实施步骤

### Step 1 — 读取前置实现与完成链路基线

- Read `adaptive-evidence-workflow-L3.1.2-evidence`、父 `adaptive-evidence-workflow-L2.1` 与 implemented 的 `adaptive-evidence-workflow-L3.1.1-profile`。
- Read `src/core/workflow-profile.ts`、`src/core/spec-sections.ts`、`src/core/task.ts`，确认 Profile 快照、关键 AC 校验和 verification 记录事实源。
- Read `src/core/task-completion.ts`，确认完成门禁顺序、事务边界、gate result 结构和 audit hit 记录方式。
- Read `src/cli/task.ts` 与 `src/cli/task-handlers.ts`，确认新增 `task evidence` 的 CLI 注册、错误映射和 presenter 风格。
- Read `src/core/usability.ts`、`src/core/integrity.ts`、`src/core/audit.ts`，确认 doctor/integrity/audit 可复用边界。
- Read 相关测试：`src/core/__tests__/task-completion.test.ts`、`src/core/__tests__/task-cascade.test.ts`、`src/cli/__tests__/task.test.ts`、`src/core/__tests__/usability.test.ts`、`src/core/__tests__/methodology-contract.test.ts`。
- 运行聚焦基线测试，记录实施前状态。

### Step 2 — 新增 Evidence 投影核心模块

- 新增 `src/core/task-evidence.ts`，定义并导出：
  - `EvidenceCoverageStatus = 'covered' | 'failed' | 'uncovered' | 'not-required'`
  - `TaskEvidence`
  - `TaskEvidenceCriterion`
  - `TaskEvidenceSummary`
  - `buildTaskEvidence(paths, taskId, specCode?)`
  - `evaluateEvidenceCoverage(evidence)`
- `buildTaskEvidence()` SHALL 从 Task JSON、L3 spec content 和 `TaskVerificationRecord[]` 动态构建投影，不新增持久化 evidence 文件。
- `profile` SHALL 按 Task 快照读取；旧 Task 缺少 profile 字段时解释为 `legacy`，`profileSource` 解释为 `legacy`。
- 关键 AC SHALL 来自 `validateCriticalAcceptanceCriteria(spec.content).criticalCriteria`；unknown 关键 AC SHALL 抛出 `UNKNOWN_CRITICAL_AC`。
- 每个关键 AC 的状态判定 SHALL 遵循：
  - 至少一条 `coversAc` 引用该 AC 且 `exitCode=0`：`covered`
  - 有 verification 引用该 AC 但没有成功记录：`failed`
  - 没有 verification 引用该 AC：`uncovered`
- legacy 或无关键 AC 时 summary SHALL 稳定返回 required/covered/failed/uncovered，且 `evaluateEvidenceCoverage()` 不阻断。
- artifacts SHALL 汇总所有 verification artifact，去重并保持首次出现顺序。
- 从 `src/index.ts` 导出公开 Evidence API 与类型。

### Step 3 — 将 evidence coverage gate 接入 task complete

- 扩展 `CompletionGateName`，新增 `evidence-coverage`。
- 在 `runTaskCompletionUnlocked()` 中将 coverage gate 插入到 `verify-rules` 之后、写 Task completed 与 lifecycle cascade 之前：
  - `bypass → task status → L3 status → steps → successful verification → verification commands → @verify rules → evidence coverage → lifecycle cascade → R18`
- 新增 `runEvidenceCoverageGate(input, task)` 或等价函数，调用 `buildTaskEvidence()` 与 `evaluateEvidenceCoverage()`。
- legacy profile SHALL 返回 passed/skipped 语义兼容结果，不改变现有完成行为。
- standard profile 存在 failed/uncovered 关键 AC 时 SHALL 不阻断完成，但 gate result metadata SHALL 列出缺口，CLI 文本 SHALL 输出 warning。
- governed profile 存在 failed/uncovered 关键 AC 时 SHALL 在 Task 写 completed 之前抛出稳定错误 `EVIDENCE_COVERAGE_REQUIRED`，并保持 Task 状态与 L3 状态不变。
- governed coverage gate SHALL 不受 `--skip-verification` 或 `--skip-verify` 影响；本 L3 不新增普通 skip 参数。
- coverage gate metadata SHALL 至少包含 `required`、`covered`、`failed`、`uncovered`、`blockingCriteria`。
- 完成失败时 SHALL 记录 audit hit，ruleId 可复用 R10 或新增明确 metadata，不能造成事务外部分完成。

### Step 4 — 新增 `task evidence` CLI

- 在 `src/cli/task.ts` 注册：
  - `spec-manager task evidence <taskId> --spec <specCode> [--format text|json]`
- `--spec` SHALL 支持限定查找范围，避免跨 spec 的 `T-001` 冲突；未传时沿用 Task 全局扫描兼容路径。
- `--format` 仅允许 `text` 或 `json`，非法值 exit code 2。
- JSON 输出 SHALL 使用 `schemaVersion: 'task-evidence.experimental.v1'`，并包含 `adaptive-evidence-workflow-L2.1` 定义的 profile、criticalCriteria、verifications、artifacts、summary 字段；首版允许追加字段但不得缺失核心字段。
- 文本输出 SHALL 展示 Task、Spec、Profile、覆盖摘要、关键 AC 明细、verification id 和 artifacts。
- `TASK_NOT_FOUND`、`SPEC_NOT_FOUND`、`UNKNOWN_CRITICAL_AC`、非法 format SHALL 映射为稳定错误输出和 exit code 2。
- 增加 CLI 测试覆盖 text/json、跨 spec taskId、缺失 Task、unknown 关键 AC 和非法 format。

### Step 5 — 完成结果展示与 Harness 上下文同步

- 更新 task complete CLI 输出：
  - evidence gate passed 时展示 `✓ evidence coverage` 摘要。
  - standard 未覆盖时展示 warning，并列出 failed/uncovered AC。
  - governed 阻断时展示稳定错误和待补 AC。
- 保持 `task complete --json` 现有顶层结构兼容，只在 `gateResults` metadata 中追加 evidence coverage 信息。
- 扩展 `HarnessTaskContext` 的 evidence 信息：
  - 保留已存在的 `workflowProfile` 与 `criticalAcceptanceCriteria`。
  - 在可获得 Task 时可追加 `evidenceSummary` 或 `evidenceCoverage`，不得破坏 `harness-context.experimental.v1` 现有字段语义。
- 更新 Harness 文本渲染，展示关键 AC 覆盖提示但避免把 standard warning 表述成阻断。
- 增加 Harness 回归测试，覆盖无 Task、standard Task、governed Task 三种场景。

### Step 6 — doctor/integrity/audit 诊断同步

- 更新 `project doctor` 或底层 integrity 检查：
  - adaptive workflow config 仍按 L3.1.1 规则检查。
  - 对 completed governed Task，若其 L3 关键 AC 未被成功 verification 全覆盖，SHALL 报 fail 或 high-severity issue。
  - 对 completed standard Task，若关键 AC 未覆盖，SHALL 报 warning 或 informational issue，不阻断 doctor ok 以保持 standard 语义。
  - legacy Task SHALL 不因缺少 critical AC coverage 报错。
- 诊断 SHALL 基于动态 Evidence 投影，不写入或修复 Task 文件。
- 如 existing audit compliance 已检查 completed task verification evidence，补充 governed coverage 缺口摘要；不得把历史 legacy Task 作为违规。
- 增加 doctor/integrity/audit 聚焦测试。

### Step 7 — 文档、模板与 Agent 资产同步

- 更新 `docs/methodology.md`：
  - 删除“evidence 完成门禁尚未实现”的临时说明。
  - 明确 `standard` 是提示闭环，`governed` 是关键 AC 成功 evidence 覆盖 hard gate。
  - 明确 `task evidence` 是动态投影，不是新的事实源。
- 更新 `skill/SKILL.md`、`templates/agents/`、项目根 `AGENTS.md` / `CLAUDE.md` / `CODEBUDDY.md` 及托管 `.claude/.codebuddy` 资产中的 managed 区域。
- 更新 `templates/L3-impl.md`，保留 `## 关键验收标准` 指引，并增加“governed 完成前必须用 successful verification 覆盖关键 AC”的说明。
- 运行 `spec-manager project agents --provider claude,codebuddy --sync-managed` 同步托管资产。
- 更新方法论契约测试，确保文档不再声明 evidence 门禁未交付。

### Step 8 — 全链路验证与交付收口

- 运行 Evidence 投影、completion gate、CLI、doctor/integrity、Harness、方法论契约聚焦测试。
- 运行全量测试、lint、build、installed CLI verification 与 project doctor。
- 使用 installed CLI 在临时 fixture 中验证：
  - legacy Task completion 不受 evidence coverage gate 影响。
  - standard Task 缺少关键 AC 覆盖时 complete 成功并输出 warning。
  - governed Task 缺少关键 AC 覆盖时 complete 失败，Task 仍为 running，L3 仍为 frozen。
  - governed Task 关键 AC 全部有成功 verification 覆盖后 complete 成功并 cascade。
  - `task evidence --format json` 输出 `task-evidence.experimental.v1`。
- 检查 git diff，确认未实现 Profile 推荐、请求自动分类或方法论度量系统。

## 验收标准

1. **AC-1**: 系统 SHALL 提供动态 `TaskEvidence` 投影，能从 Task verification、L3 关键 AC 和 Task Profile 快照计算 covered/failed/uncovered 覆盖状态。
2. **AC-2**: `spec-manager task evidence <taskId> --spec <specCode> --format text|json` SHALL 输出稳定证据报告，JSON schemaVersion SHALL 为 `task-evidence.experimental.v1`。
3. **AC-3**: legacy Task 完成行为 SHALL 与当前版本兼容，不因缺少关键 AC 或 evidence 投影新增阻断。
4. **AC-4**: standard Task 在关键 AC 缺少成功 verification 覆盖时 SHALL 允许完成，并在 completion gate result 与 CLI 输出中给出明确 warning。
5. **AC-5**: governed Task 在任一关键 AC 未被成功 verification 覆盖时 SHALL 拒绝完成，并保持 Task 与 L3 状态不被部分推进。
6. **AC-6**: governed Task 的全部关键 AC 均被 `exitCode=0` verification 覆盖后 SHALL 可以完成，并继续执行现有 lifecycle cascade 与 R18 gate。
7. **AC-7**: project doctor/integrity SHALL 能识别 completed governed Task 的关键 AC 覆盖缺口，且不得把 legacy 历史 Task 缺口判为违规。
8. **AC-8**: Harness、方法论文档、模板和已支持 Agent 入口 SHALL 同步展示 evidence coverage 规则，并不得引入 Profile 推荐或度量系统承诺。

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-5
- AC-6
- AC-7

## 验证命令

```bash
# 正向验证：Evidence、完成门禁、CLI 与诊断聚焦回归
npx vitest run src/core/__tests__/task-evidence.test.ts src/core/__tests__/task-completion.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__/task.test.ts src/core/__tests__/usability.test.ts src/core/__tests__/integrity.test.ts src/core/__tests__/harness.test.ts src/core/__tests__/methodology-contract.test.ts --reporter=dot
npm test -- --reporter=dot
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor

# 规格与计划验证
spec-manager spec validate adaptive-evidence-workflow-L3.1.2-evidence
spec-manager spec validate-plan --from-spec adaptive-evidence-workflow-L3.1.2-evidence
```

预期：

- 聚焦测试和全量测试 exit code 均为 0。
- lint、build、installed CLI verification exit code 均为 0。
- `project doctor` 输出 `Project doctor: ok`。
- Spec validate 输出所有必填段齐全且无关键 AC unknown warning。
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
  "coveredSpecs": ["adaptive-evidence-workflow-L3.1.2-evidence"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 adaptive-evidence-workflow-L3.1.1-profile、adaptive-evidence-workflow-L2.1 和完成链路基线"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 Evidence 投影核心模块与公开导出"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "接入 task complete evidence coverage gate"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "新增 task evidence CLI 与 text/json presenter"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "同步完成输出与 Harness evidence 上下文"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "补充 doctor、integrity 与 audit 诊断"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "同步方法论、模板与 Agent managed 资产"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "验证 Evidence 聚焦测试、全量测试、lint、build、installed CLI 和 project doctor"}
  ]
}
```

`autoConfirm=false`。本 L3 会新增 governed 完成 hard gate，必须经过人工批准后才能冻结和实施。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| Evidence 投影状态误判 | 回退 `task-evidence` 核心模块和调用点；保留 Task verification 原始记录 | < 15 min |
| governed 完成门禁造成误阻断 | 回退 `evidence-coverage` gate 接入；Task/Profile/verification 数据保持可读 | < 15 min |
| `task evidence` CLI 输出契约不合适 | 回退 CLI 命令与 presenter；核心投影可继续供内部测试使用 | < 10 min |
| doctor/integrity 对历史数据误报 | 回退诊断新增规则；不修改历史 Task 文件 | < 10 min |
| Agent 资产同步错误 | 回退模板/方法论文档并重新执行托管资产同步 | < 15 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `coversAc` 中 AC ID 格式或大小写不一致导致覆盖误判 | 首版仅接受规范 `AC-<number>`，CLI/文档明确格式；测试覆盖非关键 AC 不计入 required coverage |
| standard warning 被用户误认为阻断 | CLI 文案和 gate status 明确区分 warning 与 governed block；JSON metadata 保留机器可读 summary |
| completion 事务中先写 Task 再发现 coverage 缺口 | coverage gate 必须放在写 completed 和 cascade 前；测试断言失败后 Task/L3 状态不变 |
| doctor 扫描所有 Task 造成性能问题 | 复用 topic meta file 扫描和动态投影，首版仅对 completed governed Task 做完整覆盖校验 |
| JSON schema experimental 后续演进破坏用户脚本 | 首版只承诺不删除或改义核心字段，新增字段允许；文档明确 experimental 语义 |
| 与现有 `--skip-verification`/`--skip-verify` 产生绕过歧义 | governed evidence coverage 不受这两个 skip 影响，避免新 hard gate 被间接绕过 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | adaptive-evidence-workflow-L2.1 | 实现 Evidence 投影与完成门禁模块 |
| depends_on | adaptive-evidence-workflow-L3.1.1-profile | 依赖 Profile 快照与关键 AC 解析事实源 |
| references | constraint-closed-loop-L3.1.2-hooks | 复用 Task complete gate 与 verification evidence |
| references | harness-coding-L3.1.3-verification | 复用 task verify 结构化证据记录 |
| references | lifecycle-guidance-sync-L3.1.2-distribution | 复用 Agent 方法论资产同步约束 |
