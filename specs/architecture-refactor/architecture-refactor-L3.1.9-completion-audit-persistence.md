---
code: architecture-refactor-L3.1.9-completion-audit-persistence
level: L3
title: Task Completion 失败门禁审计持久化
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 确保 task completion 的 R5、R6、R18 失败门禁在 task/spec 回滚后仍持久化一次审计事件。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充 R5、R6、R18 失败 audit 持久化回归测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 建立 completion 失败审计事件边界
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 在事务回滚后持久化失败规则 audit
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证 task completion 专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:21:24.015Z'
updated: '2026-06-11T09:24:52.745Z'
changeSummary: 'cascade: task-complete'
---
# Task Completion 失败门禁审计持久化

## 目标

修复 task completion 失败门禁审计被事务回滚的问题。当前 R5、R6、R18 gate 在 `withProjectTransaction` 内调用默认 `writeAuditSink`，随后抛错导致 task/spec 与 audit 一起回滚。结果是用户收到规则错误，但 `.spec-manager/audit.json` 没有对应 hit。

要求保持：

- task/spec/cascade 在失败时完整回滚；
- R5、R6、R18 失败事件在回滚完成后持久化；
- 成功 R18 与 bypass audit 行为不变；
- 显式自定义/collecting sink 不重复接收事件。

## 代码调查

- `runTaskCompletion` 整体包裹 `withProjectTransaction`。
- `runStepCompletionGate` 在抛 R5 前调用 `recordAuditHit`。
- `runL3StatusGate` 和 implemented 后置校验在抛 R6 前调用 `recordAuditHit`。
- `runDecisionGate` 在抛 R18 前调用 `recordAuditHit`。
- 默认 `writeAuditSink` 通过 `hit()` 进入当前 active transaction，因此 gate 抛错后 audit snapshot 被 rollback。
- `CollectingAuditSink` 不写文件，不受 transaction rollback 影响。

## 实施步骤

### Step 1 - 补充失败 audit 回归测试

- R5 pending step 失败后 task 保持 running，同时 audit R5 增加一次。
- R6 非 frozen L3 失败后 task/spec 不变，同时 audit R6 增加一次。
- R18 缺 active decision 失败后 cascade 回滚，同时 audit R18 增加一次。
- 显式 `CollectingAuditSink` 在失败时只收到一次对应事件。

### Step 2 - 建立失败审计事件边界

- completion gate 失败错误携带或可映射到应持久化的 audit event。
- 默认 audit 写入不得在将被回滚的 completion transaction 内完成。
- 非规则错误、验证命令失败、`@verify` 失败和 `BYPASS_REASON_REQUIRED` 不得被误记为 R5/R6/R18。

### Step 3 - 在事务回滚后持久化失败 audit

- `runTaskCompletion` 捕获 completion 失败；待 `withProjectTransaction` 完成 rollback 后记录对应规则事件。
- 自定义 sink 仍保持一次事件语义。
- 成功路径 audit 和 bypass audit 保持现有行为。

### Step 4 - 验证

- 运行 task completion/cascade 专项测试、全量测试、lint 和 project doctor。

## 验证命令

```bash
npm test -- src/core/__tests__/task-completion.test.ts src/core/__tests__/task-cascade.test.ts src/core/__tests__/task-complete-verify.test.ts
npm test
npm run lint
spec-manager project doctor
```

## 验收标准

1. **AC-1**: R5/R6/R18 completion 失败后 task/spec 状态回滚且默认 audit hit 持久化一次。
2. **AC-2**: 自定义 CollectingAuditSink 对失败规则只收到一次事件。
3. **AC-3**: 非 R5/R6/R18 completion 错误不产生错误规则 audit。
4. **AC-4**: 成功 R18、bypass audit 和现有 CLI 错误文本保持兼容。
5. **AC-5**: 专项测试、全量测试、lint 和 project doctor 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.9-completion-audit-persistence"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充 R5、R6、R18 失败 audit 持久化回归测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "建立 completion 失败审计事件边界"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "在事务回滚后持久化失败规则 audit"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证 task completion 专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改失败事务后的审计语义，需要人工审批。

## 回滚方案

若失败审计导致重复记录，回退外层持久化逻辑并保留测试；若错误映射不稳定，使用专用错误类型携带 AuditEvent，避免依赖错误文本解析。
