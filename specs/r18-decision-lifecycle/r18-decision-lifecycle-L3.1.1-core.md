---
code: r18-decision-lifecycle-L3.1.1-core
level: L3
title: R18 决策生命周期核心修复
topic: r18-decision-lifecycle
parentCode: r18-decision-lifecycle-L2.1
status: implemented
aiSummary: >-
  修改 createDecision 允许 confirmed|implemented L1 建卡，保持 draft/非法状态拒绝和 task
  complete R18 最终门禁；补充 Decision 单元测试、预建卡片普通完成与缺卡事务回滚测试，并同步 Decision CLI、R18
  规则、README 与 impl skill。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: 读取 R18 L3/L2、历史任务、plan 模板与核心文件'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 src/core/decision.ts 允许 confirmed 或 implemented L1 建卡
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 decision.test.ts 覆盖合法与非法 L1 状态
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 task-cascade.test.ts 覆盖 R18 正常闭环与事务回滚
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑 CLI、R18 规则、README 与 impl skill 同步预建卡片流程
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: '验证: 运行 R18 专项测试、全量测试、lint、build、doctor 与 diff 检查'
    status: pending
created: '2026-06-11T01:54:13.918Z'
updated: '2026-06-11T01:58:14.525Z'
changeSummary: 'cascade: task-complete'
---
# R18 决策生命周期核心修复 — 实施规格

## 目标

实施 `r18-decision-lifecycle-L2.1`：允许 confirmed L1 预建决策卡片，保持 draft 拒绝和 Task 完成时的 R18 最终检查，并同步测试与使用指引。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集与文件级分析

- `spec-manager spec show r18-decision-lifecycle-L3.1.1-core --include-content`
- `spec-manager spec show r18-decision-lifecycle-L2.1 --include-content`
- `spec-manager task list --topic r18-decision-lifecycle`
- 读取 `templates/agent-plan.json` 确认 planJson 字段名。
- 读取 `src/core/decision.ts`、`src/core/task.ts`、`src/core/transaction.ts` 与 `src/core/integrity.ts`，确认 R18 创建、完成检查、事务回滚和完整性职责。
- 读取 `src/core/__tests__/decision.test.ts` 与 `src/core/__tests__/task-cascade.test.ts`，确认测试工具与插入位置。
- 读取 `src/cli/decision.ts`、`rules/quality-gate.md`、`README.md` 与 `skill/subskills/impl.md`，确认需要同步的旧指引。
- 完成后 step_report outputJson:
  ```json
  {"summary":"读取 L3/L2、历史任务、plan 模板及 R18 核心、事务、测试与指引文件，确认最小修复范围","files":[]}
  ```

### Step 2 — 修改 createDecision 合法 L1 状态

- 在 `src/core/decision.ts` 的 `createDecision` 中，将状态条件从仅 `implemented` 改为 `confirmed` 或 `implemented`。
- SHALL 保持非 L1 Spec 拒绝。
- SHALL 保持 draft、frozen、archived L1 拒绝。
- SHALL 更新注释与错误信息，明确只允许 confirmed/implemented L1。
- SHALL 不修改 DecisionRecord 数据结构和文件格式。
- 完成后 step_report outputJson:
  ```json
  {"summary":"修改 createDecision 允许 confirmed 或 implemented L1，保持其他状态与非 L1 拒绝","files":["src/core/decision.ts"]}
  ```

### Step 3 — 扩展 Decision 单元测试

- 在 `src/core/__tests__/decision.test.ts` 增加创建 confirmed L1 的测试 helper 或就地准备逻辑。
- SHALL 新增 confirmed L1 可建卡测试。
- SHALL 保留 implemented L1 可建卡测试。
- SHALL 保留 draft L1 不可建卡测试，并断言错误信息包含 confirmed/implemented 允许状态。
- SHOULD 增加 frozen 或 archived L1 拒绝测试，锁定合法状态集合。
- 完成后 step_report outputJson:
  ```json
  {"summary":"扩展 Decision 单元测试，覆盖 confirmed/implemented 成功与 draft/非法状态拒绝","files":["src/core/__tests__/decision.test.ts"]}
  ```

### Step 4 — 增加 R18 Task 闭环与事务回滚测试

- 在 `src/core/__tests__/task-cascade.test.ts` 导入并复用 `createDecision`。
- SHALL 新增测试：confirmed L1 预建卡片后，最后一个 Task 使用普通 `completeTask` 成功，Task completed 且 L3/L2/L1 implemented。
- SHALL 新增测试：缺少卡片时普通 `completeTask` 抛出 R18，并确认 Task 仍 running、L3 frozen、L2/L1 confirmed。
- SHALL 不使用 `skipR18Check` 验证正常路径。
- SHOULD 断言成功路径记录 R18 audit hit。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 R18 预建卡片普通完成与缺卡事务回滚集成测试","files":["src/core/__tests__/task-cascade.test.ts"]}
  ```

### Step 5 — 同步 CLI、规则和使用指引

- 更新 `src/cli/decision.ts` 的 decision 命令描述，说明 confirmed/implemented L1 均可创建卡片。
- 更新 `rules/quality-gate.md`：
  - R18 最终不变量仍是 implemented L1 至少有一张卡片。
  - 正常流程是在最后一个 Task complete 前为 confirmed L1 预建卡片。
  - `--force` 仅用于异常或历史恢复。
- 更新 `README.md` 的 R18 教程，将创建决策卡片移动到最后一个 Task 完成前的正常路径说明，并删除会形成循环依赖的完成后补建主流程。
- 更新 `skill/subskills/impl.md`，要求最后一个 Task 完成前检查并预建决策卡片；保留 `--force` 为异常恢复说明。
- 完成后 step_report outputJson:
  ```json
  {"summary":"同步 Decision CLI 描述、R18 规则、README 与 impl skill 的预建卡片正常流程","files":["src/cli/decision.ts","rules/quality-gate.md","README.md","skill/subskills/impl.md"]}
  ```

### Step 6 — 验证 R18 闭环与项目基线

- 运行 Decision 与 Task cascade 专项测试。
- 运行全量测试、lint、build、`project doctor` 和 `git diff --check`。
- 检查变更 diff，确认 Task 完成核心逻辑和 Decision 数据模型未被修改。
- 完成后 step_report outputJson:
  ```json
  {"summary":"R18 专项测试、全量测试、lint、build、project doctor 与 diff 检查通过","files":["src/core/decision.ts","src/core/__tests__/decision.test.ts","src/core/__tests__/task-cascade.test.ts","src/cli/decision.ts","rules/quality-gate.md","README.md","skill/subskills/impl.md"]}
  ```

## 验证命令

```bash
# 正向验证: confirmed L1 预建卡片与普通 Task 完成闭环
npx vitest run src/core/__tests__/decision.test.ts src/core/__tests__/task-cascade.test.ts
npm test
npm run lint
npm run build
spec-manager project doctor
git diff --check

# 反向验证: draft L1 与缺卡 Task 完成仍被拒绝
npx vitest run src/core/__tests__/decision.test.ts -t 'draft L1 不可建决策'
npx vitest run src/core/__tests__/task-cascade.test.ts -t '缺少决策卡片'

# 范围验证
git diff -- src/core/decision.ts src/core/__tests__/decision.test.ts src/core/__tests__/task-cascade.test.ts src/cli/decision.ts rules/quality-gate.md README.md skill/subskills/impl.md
```

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
  "coveredSpecs": ["r18-decision-lifecycle-L3.1.1-core"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取 R18 L3/L2、历史任务、plan 模板与核心文件"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 src/core/decision.ts 允许 confirmed 或 implemented L1 建卡"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 decision.test.ts 覆盖合法与非法 L1 状态"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 task-cascade.test.ts 覆盖 R18 正常闭环与事务回滚"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 CLI、R18 规则、README 与 impl skill 同步预建卡片流程"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "验证: 运行 R18 专项测试、全量测试、lint、build、doctor 与 diff 检查"}
  ]
}
```

`autoConfirm: false`，原因：本修复改变决策卡片的合法创建状态并影响 R18 正常交付流程，需要用户审核后执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| confirmed 预建卡片引入非预期行为 | 回退 `src/core/decision.ts` 状态条件与对应测试/指引 | < 10 min |
| Task 闭环测试暴露事务问题 | 保留失败测试证据，停止发布并回退核心修改 | < 10 min |
| 文档指引与实现不一致 | 以通过的核心测试为准修正文档，不改变 Task 完成逻辑 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 工作树中相关测试文件已有未提交改动 | 基于当前内容增量编辑，不覆盖其他测试 |
| confirmed 后决策变化导致预建卡片过时 | 保留 decision update/partial/supersede 流程，并在完成前复核 |
| 错误地削弱 Task complete R18 门禁 | 不修改 `completeTaskUnlocked` 的 R18 检查，专项测试锁定缺卡回滚 |
| CLI 使用的构建产物与源码不同步 | 验证时执行 build，并以源码测试和构建结果为准 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | `r18-decision-lifecycle-L2.1` | 父技术设计 |
| implements | `r18-decision-lifecycle-L2.1` | 实施 R18 生命周期闭环修复 |
| references | `architecture-hardening-L1` | 复用事务回滚不变量 |
| references | `lifecycle-reconciliation-L1` | 复用分层级联语义 |
