---
code: harness-coding-L3.1.4-change
level: L3
title: change propose 实现偏差闭环
topic: harness-coding
parentCode: harness-coding-L2.1
status: implemented
created: '2026-06-08T08:59:32.544Z'
updated: '2026-06-08T09:12:57.076Z'
aiSummary: >-
  实施 change propose：新增 task-linked change proposal frontmatter 与
  create/list/resolve 核心函数，CLI 支持 propose/resolve 并扩展 list/show，audit 对
  unresolved proposal 输出 warning
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取
      harness-coding-L3.1.4-change、harness-coding-L2.1、harness-coding-L3.1.2-report、harness-coding-L3.1.3-verification、templates/agent-plan.json
      并检查 delta/change/task/audit 测试基线
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/delta.ts 扩展 task-linked proposal frontmatter 类型
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/delta.ts 新增 create/list/resolve task-linked change proposal
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/change.ts 接入 change propose/resolve 并扩展 list/show
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/audit.ts 增加 unresolved task-linked proposal warning
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/delta.test.ts 补充 task-linked proposal core 测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      编辑 src/cli/__tests__/change.test.ts 和 src/core/__tests__/audit.test.ts 补充
      CLI/audit 测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 验证 npm test targeted、npm run build、dist CLI change propose smoke
    status: pending
---
# change propose 实现偏差闭环

# change propose 实现偏差闭环 — 实施规格

## 目标

实施 `harness-coding-L2.1` 的第四项交付物：新增 task-linked `spec-manager change propose`，让 coding harness 在 frozen L3 实施中发现范围、接口或代码现实冲突时，能记录明确的 change proposal，而不是直接扩大实现范围。

本 L3 只实现 proposal 记录和基础闭环能力：

- `change propose --task --spec --reason --impact` 创建与 task/L3 关联的 proposal。
- proposal 存储在现有 `changes/` 体系下，避免新增顶层数据目录。
- proposal 有 `unresolved/resolved` 状态。
- `change list/show` 能展示 task-linked proposal 的状态、taskCode、specCode。
- audit 对 unresolved task-linked proposal 输出 warning。
- 不实现自动 amend L3、不自动创建 decision、不自动应用 delta。

**前置依赖**: `harness-coding-L3.1.2-report` 已 implemented；`harness-coding-L3.1.3-verification` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show harness-coding-L3.1.4-change --include-content` 和 `spec-manager spec show harness-coding-L2.1 --include-content`。
- 执行 `spec-manager spec show harness-coding-L3.1.2-report --include-content` 与 `spec-manager spec show harness-coding-L3.1.3-verification --include-content`，确认 task-linked harness 命令风格。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，且 `coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/delta.ts`，确认 `createChange()`、`listChanges()`、`getChangeDir()`、proposal frontmatter 结构。
  - 读取 `src/cli/change.ts`，确认现有 `new/list/show/archive` 命令风格。
  - 读取 `src/core/task.ts`，确认 task 查找和 task JSON 路径规则。
  - 读取 `src/core/spec-io.ts`，确认 L3 spec 查找与状态字段。
  - 读取 `src/core/audit.ts`，确认 warning 输出模式。
  - 读取 `src/core/__tests__/delta.test.ts`、`src/cli/__tests__` 现有测试风格。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/report/verification、agent-plan 与 delta/change/task/audit 测试基线读取","files":[]}
  ```

### Step 2 — 扩展 change proposal 数据模型

- 编辑 `src/core/delta.ts`：
  - 新增类型 `TaskLinkedChangeStatus = 'unresolved' | 'resolved'`。
  - 新增接口 `TaskLinkedChangeProposal`，字段包含：
    - `name`
    - `taskCode`
    - `specCode`
    - `topic`
    - `reason`
    - `impact`
    - `status`
    - `created`
    - `updated`
  - 扩展 proposal frontmatter 可选字段：
    - `taskCode?: string`
    - `specCode?: string`
    - `topic?: string`
    - `reason?: string`
    - `impact?: string`
    - `status?: 'unresolved' | 'resolved'`
    - `proposalType?: 'task-linked'`
  - 保持现有 `createChange()`、`archiveChange()` 兼容；已有 proposal 无这些字段时不受影响。
- 完成后 step_report outputJson:
  ```json
  {"summary":"扩展 change proposal frontmatter 类型以支持 task-linked proposal","files":["src/core/delta.ts"]}
  ```

### Step 3 — 实现 create/list/resolve task-linked proposal

- 编辑 `src/core/delta.ts`：
  - 新增 `createTaskLinkedChangeProposal(input)`：
    - 入参：`paths`、`taskCode`、`specCode`、`reason`、`impact`。
    - 校验 reason/impact 非空，否则抛出 `INVALID_CHANGE`。
    - 校验 spec 存在且为 L3，否则抛出 `SPEC_NOT_FOUND` 或 `SPEC_NOT_L3`。
    - 校验 task 存在于该 spec，否则抛出 `TASK_NOT_FOUND`。
    - 生成 change name：`<specCode>-<taskCode>-proposal`，如冲突则追加递增后缀。
    - 创建 `changes/<name>/proposal.md`，frontmatter 写入 task-linked 字段，正文包含 reason、impact、next options。
    - 创建空 `deltas/` 目录，但不强制写 delta 文件。
  - 新增 `listTaskLinkedChangeProposals(paths, opts?)`。
  - 新增 `resolveTaskLinkedChangeProposal(paths, name)`，将 status 改为 `resolved` 并更新 updated。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 task-linked change proposal 创建、列表和 resolve 核心函数","files":["src/core/delta.ts"]}
  ```

### Step 4 — 接入 CLI change propose/resolve/list/show

- 编辑 `src/cli/change.ts`：
  - 新增 `change propose` 子命令：
    - `--task <taskCode>` 必填。
    - `--spec <specCode>` 必填。
    - `--reason <reason>` 必填。
    - `--impact <impact>` 必填。
    - `--json` 可选。
  - 新增 `change resolve <name>` 子命令：
    - 将 task-linked proposal 标记为 resolved。
    - `--json` 可选。
  - 修改 `change list`：
    - 对 task-linked proposal 展示 status、taskCode、specCode。
    - `--json` 继续输出完整结构。
  - 修改 `change show`：
    - text 输出 task-linked metadata。
    - json 输出包含 proposal frontmatter 和 delta entries。
  - 错误处理：
    - `INVALID_CHANGE`、`SPEC_NOT_FOUND`、`SPEC_NOT_L3`、`TASK_NOT_FOUND`、`CHANGE_NOT_FOUND` 以 exit code 2 退出。
- 完成后 step_report outputJson:
  ```json
  {"summary":"接入 change propose/resolve 并扩展 list/show 展示 task-linked metadata","files":["src/cli/change.ts"]}
  ```

### Step 5 — audit warning 接入

- 编辑 `src/core/audit.ts`：
  - `collectAuditWarnings()` 增加 unresolved task-linked proposal 检查。
  - warning 文案包含 change name、taskCode、specCode。
  - 提示命令：`spec-manager change resolve <name>`。
  - 不改变现有 rules 计数语义。
- 完成后 step_report outputJson:
  ```json
  {"summary":"为 unresolved task-linked change proposal 增加 audit warning","files":["src/core/audit.ts"]}
  ```

### Step 6 — 补充 core 单元测试

- 编辑 `src/core/__tests__/delta.test.ts`：
  - 增加 `createTaskLinkedChangeProposal` 正向测试：
    - 创建 L1/L2/L3 frozen + task。
    - 创建 proposal。
    - 断言 proposal frontmatter 含 taskCode/specCode/reason/impact/status。
  - 增加 name 冲突递增测试。
  - 增加 reason/impact 缺失、非 L3 spec、task 不存在反向测试。
  - 增加 `resolveTaskLinkedChangeProposal` 测试。
  - 增加 `listTaskLinkedChangeProposals` 只返回 task-linked proposal 测试。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 task-linked change proposal 核心函数测试","files":["src/core/__tests__/delta.test.ts"]}
  ```

### Step 7 — 补充 CLI/audit 单元测试

- 新增或编辑 `src/cli/__tests__/change.test.ts`：
  - 测试 `change propose --task --spec --reason --impact` text 输出。
  - 测试 `change propose --json`。
  - 测试 `change list` 展示 unresolved/task/spec。
  - 测试 `change show` 展示 task-linked metadata。
  - 测试 `change resolve` 后 status 变为 resolved。
  - 测试缺必填字段和 task 不存在错误。
- 编辑 `src/core/__tests__/audit.test.ts`：
  - 增加 unresolved task-linked proposal 时 audit warning。
  - 增加 resolved 后 warning 消失。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 change propose CLI 和 unresolved proposal audit warning 测试","files":["src/cli/__tests__/change.test.ts","src/core/__tests__/audit.test.ts"]}
  ```

### Step 8 — 验证

- 运行 `npm test -- --run src/core/__tests__/delta.test.ts src/cli/__tests__/change.test.ts src/core/__tests__/audit.test.ts`。
- 运行 `npm run build`。
- 运行手动 smoke：
  - `node dist/cli/index.js change propose --task T-001 --spec harness-coding-L3.1.4-change --reason "smoke conflict" --impact "scope clarification required"`
  - `node dist/cli/index.js change list`
  - `node dist/cli/index.js change show <name>`
  - `node dist/cli/index.js change resolve <name>`
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 change propose targeted tests、build 和 CLI smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: core + CLI + audit targeted tests
npm test -- --run src/core/__tests__/delta.test.ts src/cli/__tests__/change.test.ts src/core/__tests__/audit.test.ts
# 预期输出包含:
# Test Files  3 passed

# 正向验证: TypeScript 构建
npm run build
# 预期输出: 命令 exit code 0

# 正向验证: CLI smoke
node dist/cli/index.js change propose --task T-001 --spec harness-coding-L3.1.4-change --reason "smoke conflict" --impact "scope clarification required"
# 预期输出包含:
# Change proposal created

node dist/cli/index.js change list
# 预期输出包含:
# unresolved

node dist/cli/index.js change resolve <name>
# 预期输出包含:
# resolved
```

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
  "coveredSpecs": ["harness-coding-L3.1.4-change"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 harness-coding-L3.1.4-change、harness-coding-L2.1、harness-coding-L3.1.2-report、harness-coding-L3.1.3-verification、templates/agent-plan.json 并检查 delta/change/task/audit 测试基线"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/delta.ts 扩展 task-linked proposal frontmatter 类型"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/delta.ts 新增 create/list/resolve task-linked change proposal"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/change.ts 接入 change propose/resolve 并扩展 list/show"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/audit.ts 增加 unresolved task-linked proposal warning"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/delta.test.ts 补充 task-linked proposal core 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/change.test.ts 和 src/core/__tests__/audit.test.ts 补充 CLI/audit 测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证 npm test targeted、npm run build、dist CLI change propose smoke"}
  ]
}
```

autoConfirm: `false`。理由：本 L3 冻结后会修改 change 核心、CLI 和 audit，需要用户显式批准后才能进入 Agent Task。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| proposal frontmatter 影响 archive | 保持字段可选，必要时 revert task-linked 字段读取逻辑 | < 10 min |
| change list/show 输出破坏脚本 | JSON 输出保持兼容，text 输出回退到原字段 | < 10 min |
| audit warning 噪声过高 | 降级为只统计 unresolved task-linked proposal 数量 | < 10 min |
| change propose 命名冲突 | 调整递增后缀逻辑并同步测试 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 与 OpenSpec delta change 语义混淆 | proposalType 标记为 `task-linked`，且不自动 archive/apply |
| task-linked proposal 没有 delta 文件会违反 archive R24 | 本 L3 不要求立即 archive；archive 仍按原 R24 校验 |
| taskCode 不是全局唯一 | `--spec` 必填，核心按 specCode 限定 task 查找 |
| resolved 状态被误认为已改 spec | 输出提示只表示 proposal 已处理，不表示 delta 已应用 |
