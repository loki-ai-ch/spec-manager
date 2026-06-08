---
code: workflow-hardening-L3.1.2-hints
level: L3
title: 流程提示与展示修正
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
created: '2026-06-08T01:23:30.881Z'
updated: '2026-06-08T02:14:21.131Z'
aiSummary: >-
  实施流程提示与展示修正：guide blocking/advisory 分层、L3 上游 frozen 状态提示、task show
  shownSteps/totalSteps 文案和数据修正，并补充 usability/task CLI 测试
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取 workflow-hardening-L3.1.2-hints 与 workflow-hardening-L2.1 并检查
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 src/core/usability.ts 增加 DoctorCheck blocking 分层
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 src/cli/usability.ts 输出 guide advisory
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 src/core/usability.ts 增加 upstream frozen advice
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑 src/core/task.ts 与 src/cli/task.ts 修正 task show shownSteps totalSteps
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 编辑 usability core 和 CLI 测试补充 guide advisory 与 upstream advice
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 编辑 task core 和 CLI 测试补充 shown total 断言
    status: pending
  - stepNo: 8
    stepType: mcp_tool
    name: 验证 npm test targeted、npm run build、guide advisory 和 task show smoke
    status: pending
---
# 流程提示与展示修正 — 实施规格

## 目标

实施 `workflow-hardening-L2.1` 的第二项交付物：修正 guide blocking/advisory 分层、L3 上游 frozen 状态提示、`task show` 的 shown/total 文案。

**前置依赖**: `workflow-hardening-L3.1.1-cli` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show workflow-hardening-L3.1.2-hints --include-content` 和 `spec-manager spec show workflow-hardening-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/usability.ts`，确认 `runProjectDoctor`、`suggestNextActionForTopic`、`suggestAfterSpecCommand` 和 rich guide 渲染逻辑。
  - 读取 `src/cli/usability.ts`，确认 default guide 当前对第一个 warn/fail 直接 blocking。
  - 读取 `src/core/task.ts`，确认 `showTask` 当前只返回 `steps` 和 `truncated`。
  - 读取 `src/cli/task.ts`，确认 `task show` 当前输出 `steps: N (totalSteps: N, truncated)`。
  - 读取 `src/core/__tests__/usability.test.ts`、`src/cli/__tests__/usability.test.ts`、`src/core/__tests__/task-cascade.test.ts`，确认测试扩展点。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/agent-plan 与 usability/task/CLI 测试基线读取","files":[]}
  ```

### Step 2 — 为 doctor check 增加 blocking 分层

- 编辑 `src/core/usability.ts`：
  - 为 `DoctorCheck` 增加可选字段 `blocking?: boolean`。
  - 初始化、config、audit、specs/changes/archive 目录等关键 fail SHALL 标记 `blocking: true`。
  - AI agent instructions、Claude/CodeBuddy skill bundled、placeholder content SHALL 标记为 `blocking: false` 或保持 undefined 后由 helper 判断为 advisory。
  - 新增 `isBlockingDoctorCheck(check: DoctorCheck): boolean`，语义为 `check.blocking === true || check.status === 'fail' && isCoreProjectCheckLabel(check.label)`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"DoctorCheck 增加 blocking/advisory 分层 helper","files":["src/core/usability.ts"]}
  ```

### Step 3 — 调整 default guide blocking/advisory 输出

- 编辑 `src/cli/usability.ts`：
  - default text guide 只因 `isBlockingDoctorCheck` 且有 action 的检查停止。
  - 非 blocking warn/fail 不覆盖 request nextAction；在 `Request`/`Next` 后输出 `Advisory:` 列表，每条含 label 和 action。
  - rich guide 本 L3 不改输出结构；若复用 doctor，不能阻断 rich 输出。
- 完成后 step_report outputJson:
  ```json
  {"summary":"default guide 改为关键检查 blocking、非关键检查 advisory","files":["src/cli/usability.ts"]}
  ```

### Step 4 — 增加上游 frozen 状态提示

- 编辑 `src/core/usability.ts`：
  - 新增 `getUpstreamFreezeAdvice(paths: ProjectPaths, spec: SpecRecord): string[]`。
  - 对 L3 spec，沿 `parentCode` 查 L2/L1；若上游 spec 存在且 status 不是 `frozen` 或 `implemented`，返回提示：`Upstream <code> is <status>; task complete will not cascade it unless it is frozen.`
  - 在 `suggestAfterSpecCommand` 对 L3 `confirmed` 和 `frozen` 的返回中附加 advice 文本，保持第一行 Next command 可复制。
  - `suggestNextActionForTopic` 在选中 confirmed/frozen L3 时复用同一 advice。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 L3 上游 frozen 状态提示并接入下一步建议","files":["src/core/usability.ts"]}
  ```

### Step 5 — 修正 task show shown/total 数据与文案

- 编辑 `src/core/task.ts`：
  - `showTask` 返回值新增 `shownSteps: number`、`totalSteps: number`。
  - `totalSteps` SHALL 等于全量排序后的 step 数，`shownSteps` SHALL 等于返回的 `steps.length`。
  - JSON 输出保持新增字段，不删除 `steps` 和 `truncated`。
- 编辑 `src/cli/task.ts`：
  - 文案改为：
    ```text
    steps:
      shownSteps: 5
      totalSteps: 8
      truncated: true
    ```
  - full 模式下 `shownSteps === totalSteps` 且 `truncated: false`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"task show 返回并输出 shownSteps/totalSteps/truncated","files":["src/core/task.ts","src/cli/task.ts"]}
  ```

### Step 6 — 补充 usability 测试

- 编辑 `src/core/__tests__/usability.test.ts`：
  - 增加 `getUpstreamFreezeAdvice` 或 `suggestAfterSpecCommand` 测试：L3 confirmed、上游 L2 confirmed 时，输出包含上游 L2 code 和 `will not cascade`。
  - 增加上游 L2 frozen 时无 advice 测试。
- 编辑 `src/cli/__tests__/usability.test.ts`：
  - 构造已初始化项目且缺 Claude skill rules/templates 的 fixture，执行 `guide auth`，断言仍输出 `Request: auth` 和 spec nextAction，同时包含 `Advisory:`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 upstream advice 与 guide advisory 测试","files":["src/core/__tests__/usability.test.ts","src/cli/__tests__/usability.test.ts"]}
  ```

### Step 7 — 补充 task show 测试

- 编辑 `src/core/__tests__/task-cascade.test.ts`：
  - 创建 8 步 task，调用 `showTask(paths, task.id)`，断言 `shownSteps=5`、`totalSteps=8`、`truncated=true`。
  - 调用 `showTask(..., { full: true })`，断言 `shownSteps=8`、`totalSteps=8`、`truncated=false`。
- 若已有 CLI task 测试不足，新增或扩展 CLI 测试，断言 `task show` 文本包含 `shownSteps` 和 `totalSteps`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 task show shown/total core 和 CLI 测试","files":["src/core/__tests__/task-cascade.test.ts","src/cli/__tests__/<task-test-file>.ts"]}
  ```

### Step 8 — 验证

- 运行 `npm test -- --run src/core/__tests__/usability.test.ts src/cli/__tests__/usability.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__`。
- 运行 `npm run build`。
- 运行 smoke：
  - `node dist/cli/index.js guide workflow-hardening`
  - `node dist/cli/index.js task show T-001 --spec workflow-hardening-L3.1.1-cli`
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 targeted tests、build、guide advisory 和 task show smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: targeted tests
npm test -- --run src/core/__tests__/usability.test.ts src/cli/__tests__/usability.test.ts src/core/__tests__/task-cascade.test.ts src/cli/__tests__
# 预期输出包含:
# Test Files

# 正向验证: TypeScript build
npm run build
# 预期输出: exit code 0

# 正向验证: guide 不被非关键 warning 阻断
node dist/cli/index.js guide workflow-hardening
# 预期输出包含:
# Request: workflow-hardening
# Next:

# 正向验证: task show shown/total
node dist/cli/index.js task show T-001 --spec workflow-hardening-L3.1.1-cli
# 预期输出包含:
# shownSteps:
# totalSteps:
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
  "coveredSpecs": ["workflow-hardening-L3.1.2-hints"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 workflow-hardening-L3.1.2-hints 与 workflow-hardening-L2.1 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 src/core/usability.ts 增加 DoctorCheck blocking 分层"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 src/cli/usability.ts 输出 guide advisory"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 src/core/usability.ts 增加 upstream frozen advice"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 src/core/task.ts 与 src/cli/task.ts 修正 task show shownSteps totalSteps"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "编辑 usability core 和 CLI 测试补充 guide advisory 与 upstream advice"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "编辑 task core 和 CLI 测试补充 shown total 断言"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "验证 npm test targeted、npm run build、guide advisory 和 task show smoke"}
  ]
}
```

autoConfirm: `false`。理由：本任务修改 CLI 输出和流程提示，需要逐步验证。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| guide advisory 输出噪声过多 | revert `src/cli/usability.ts` advisory 输出，保留 core helper | < 5 min |
| upstream advice 文案影响脚本解析 | 将 advice 放到第二行并保留第一行 Next command；必要时 revert advice 接入 | < 5 min |
| task show 文案破坏外部解析 | 保留 JSON 输出新增字段，文本文案可临时恢复旧格式 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| doctor blocking 分类遗漏关键 fail | helper 只把 core project checks 设为 blocking，测试初始化失败路径 |
| suggestNextActionForTopic 返回多行影响 UI | 第一行保持原命令，advice 放后续行 |
| CLI task show 测试夹带旧任务状态 | 用临时项目 fixture 创建独立 task |
