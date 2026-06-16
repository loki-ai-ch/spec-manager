---
code: cli-application-boundary-L3.1.4-spec-handlers
level: L3
title: spec CLI handler 与 presenter 垂直切片
topic: cli-application-boundary
parentCode: cli-application-boundary-L2.1
status: implemented
aiSummary: 将 spec update 与状态推进命令迁移到可单测的 handler/presenter/runtime 边界，保持命令、输出、审计和退出码兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 补充 spec update 与状态推进兼容回归测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 spec CLI update 与 transition handlers
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 新增 spec presenters 并瘦身 Commander actions
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证 spec/task CLI 专项、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-12T01:56:36.110Z'
updated: '2026-06-12T02:03:27.839Z'
changeSummary: 'cascade: task-complete'
---
# spec CLI handler 与 presenter 垂直切片

## 目标

将 `src/cli/spec.ts` 中的 `spec update` 与 `spec confirm/freeze/implement` 状态推进链路迁移到独立 handler/presenter/runtime 边界，使 Commander action 主要负责参数注册和接线，同时保持命令 flags、输出关键文本、审计命中、状态语义与 exit code 兼容。

## 代码调查

- `spec update` action 当前直接处理文件/stdin 输入、patch 构建、core 调用、warning/内容校验输出和 Next 提示。
- 状态推进 action 当前直接处理：
  - L3 `confirm` 实际推进到 `frozen`
  - L1/L2 禁止 `draft → frozen`
  - R22 placeholder 阻断
  - 状态机校验
  - R3 手动 implemented 保护
  - R2/R9 audit 命中
  - core 更新与输出
- `cli-application-boundary-L2.1` 明确把 spec update/status transition 定义为下一垂直切片。
- 已实施的 `task-handlers.ts`、`runCliAction`、presenter/runtime 可作为模式，不应重新设计另一套边界。
- 本 L3 不迁移其他 spec 子命令，避免单次修改扩大到所有 CLI 行为。

## 实施步骤

### Step 1 - 补充兼容回归测试

- 锁定 `spec update` 文件输入、stdin 输入、warning、内容校验和 Next 输出。
- 锁定 L3 `confirm` 的 `draft → frozen` 行为与输出。
- 锁定 L1/L2 `draft → frozen`、placeholder、非法状态与 R3 手动 implemented 的 stderr 和 exit code。
- 锁定成功推进的 R2/R9 audit 与状态写入。
- 补充 handler/presenter 单元测试，避免仅依赖 Commander 端到端测试。

### Step 2 - 新增 spec handlers

- 新增 `src/cli/spec-handlers.ts` 或等价模块。
- handler 接收 `CliActionContext`、code、原始 opts，并负责 flags 到 application input 的转换与 core 调用。
- update handler 负责读取 content、构建 patch、调用 `updateSpec`、运行非阻断内容校验并返回结构化结果。
- transition handler 负责计算实际目标、执行 placeholder/R3/状态门禁、记录 R2/R9 audit、调用 `updateSpec` 并返回结构化结果。
- 已知用户输入错误使用稳定错误前缀，由 `runCliAction` 统一映射；未知错误继续抛出。

### Step 3 - 新增 presenter 并瘦身 actions

- presenter 保持 update warnings、内容校验消息、成功文本和 Next 提示。
- transition presenter 保持 `<old> → <new>` 成功文本和 Next 提示。
- `src/cli/spec.ts` 的 update/status Commander actions 仅创建 context、调用 runtime/handler/presenter。
- 保持其他 spec 子命令不变。
- JSON 模式不在本次新增，避免改变命令契约。

### Step 4 - 验证

- 运行 spec handler/spec CLI/common runtime/task handler/architecture smoke 专项测试。
- 运行全量测试、lint、build、installed CLI drift、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/cli/__tests__/spec-handlers.test.ts src/cli/__tests__/spec.test.ts src/cli/__tests__/common.test.ts src/cli/__tests__/task-handlers.test.ts src/cli/__tests__/architecture-smoke.test.ts
npm test
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: `spec update` 的输入转换、core 调用和输出渲染通过 handler/presenter 边界实现，Commander action 不再直接编排该流程。
2. **AC-2**: `spec confirm/freeze/implement` 的目标计算、placeholder/R3/状态门禁、audit 与 core 调用通过 handler 边界实现。
3. **AC-3**: update 与状态推进的成功输出、warning、stderr、exit code、状态写入和 audit 命中保持兼容。
4. **AC-4**: 新增 handler/presenter 单元测试，其他 spec 子命令和 task handler/runtime 行为保持兼容。
5. **AC-5**: 专项测试、全量测试、lint、build、installed CLI drift、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["cli-application-boundary-L3.1.4-spec-handlers"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "补充 spec update 与状态推进兼容回归测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 spec CLI update 与 transition handlers"},
    {"stepNo": 3, "stepType": "tool_action", "name": "新增 spec presenters 并瘦身 Commander actions"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证 spec/task CLI 专项、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：该重构迁移用户可见 spec 命令路径、错误映射和审计调用，需要人工批准。

## 回滚方案

若 handler 接入导致输出、exit code 或审计回归，保留新增回归测试并回退 `spec.ts` 接线与 handler 模块；可缩小为仅迁移 update 或 transition 单一切片后重新实施。
