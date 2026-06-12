---
code: cli-application-boundary-L3.1.3-task-output-compatibility
level: L3
title: Task CLI 输出与错误兼容修复
topic: cli-application-boundary
parentCode: cli-application-boundary-L2.1
status: implemented
aiSummary: 恢复 task report/verify handler 抽取前的 warning 流、JSON 单一输出和前置校验 stderr 文本兼容性。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充 task CLI warning、JSON 与 stderr 精确兼容测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 增加 CLI warning presenter 通道并保护 JSON 输出
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 恢复 task report/verify 前置校验 stderr 文本
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证 task CLI 专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:25:43.121Z'
updated: '2026-06-11T09:30:39.740Z'
changeSummary: 'cascade: task-complete'
---
# Task CLI 输出与错误兼容修复

## 目标

修复 task report/verify handler 抽取后的用户可见输出兼容回归：

1. `task report` 文本模式 warnings 原本通过 `console.warn` 输出；当前 `printPresentedResult` 使用 `context.error`，错误地移入 stderr。
2. `task report --json` 原本输出 JSON 后立即返回，不输出 warnings；当前 presenter 在 JSON 后仍输出 warnings，破坏机器可解析输出边界。
3. report/verify 的 action 前置校验错误原本不带 `INVALID_REPORT:` / `INVALID_VERIFICATION:` 前缀；handler 抽取后 stderr 文本发生变化。

保持 handler 内部结构化错误、退出码 2、成功文本、JSON shape 和 task 数据行为兼容。

## 代码调查

- 原 `task report` 成功文本后使用 `console.warn(\`⚠ ${w}\`)`；JSON 分支提前 return。
- `CliActionContext` 当前只有 `log`、`error`、`stdout.write`、`exit`，没有 warning 通道。
- `printPresentedResult` 无论 text/json 都在最后通过 `context.error` 输出 warnings。
- handler 为 input/flags 混用和非法 layer 新增 `INVALID_*` 前缀，runtime 将完整 message 写入 stderr。
- L3.1.2 规格明确要求保持 stderr、warning 输出和 JSON shape 兼容。

## 实施步骤

### Step 1 - 补充真实 CLI 输出兼容测试

- report 文本模式产生 warning 时断言调用 `console.warn`，且 stderr 为空。
- report `--json` 产生 warning 时断言输出仍为单一可解析 JSON，且不输出 warning。
- report input/flags 混用 stderr 精确保持旧文本。
- verify 非法 layer 和 input/flags 混用 stderr 精确保持旧文本。

### Step 2 - 增加 warning presenter 通道

- `CliActionContext` 增加 warning 输出函数，默认映射到 `console.warn`。
- `printPresentedResult` 仅在文本模式输出 warnings，并使用 warning 通道。
- 更新 common runtime 测试。

### Step 3 - 恢复 task 预校验错误文本

- handler 可继续抛结构化错误用于 runtime 映射退出码。
- 为 input/flags 混用和非法 layer 提供用户可见 message 映射，恢复重构前 stderr 文本。
- normalize/harness 返回的真实 `INVALID_REPORT` / `INVALID_VERIFICATION` 错误保持现有前缀。

### Step 4 - 验证

- 运行 task handler/task/common CLI 专项测试、全量测试、lint 和 project doctor。

## 验证命令

```bash
npm test -- src/cli/__tests__/task-handlers.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/common.test.ts
npm test
npm run lint
spec-manager project doctor
```

## 验收标准

1. **AC-1**: report 文本 warnings 使用 warning 通道，不进入 stderr。
2. **AC-2**: report `--json` 只输出可解析 JSON，不附加 warning 输出。
3. **AC-3**: report/verify 前置校验 stderr 文本与重构前保持一致，退出码仍为 2。
4. **AC-4**: normalize/harness 的结构化 `INVALID_*` 错误、成功文本和 JSON shape 保持兼容。
5. **AC-5**: 专项测试、全量测试、lint 和 project doctor 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["cli-application-boundary-L3.1.3-task-output-compatibility"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充 task CLI warning、JSON 与 stderr 精确兼容测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "增加 CLI warning presenter 通道并保护 JSON 输出"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "恢复 task report/verify 前置校验 stderr 文本"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证 task CLI 专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改 CLI 用户可见输出和错误映射，需要人工审批。

## 回滚方案

若公共 context 类型兼容受影响，将 warning 字段改为可选并在 presenter 中回退 `context.error`；若错误映射过度复杂，保留 handler 错误码并为 `CliKnownError` 增加可选 message transform。
