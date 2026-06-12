---
code: cli-application-boundary-L2.1
level: L2
title: CLI 应用边界设计
topic: cli-application-boundary
parentCode: cli-application-boundary-L1
status: implemented
aiSummary: >-
  本 L2 设计 CLI 应用边界瘦身方案：建立 Commander action、CLI handler、core/application use
  case、presenter/runtime 的分层模型，优先以 task/spec 垂直切片迁移，保持命令、输出、JSON shape、exit
  code、存储格式和测试基线兼容。
created: '2026-06-11T08:33:13.938Z'
updated: '2026-06-11T08:46:23.764Z'
changeSummary: 'cascade: task-complete'
---
# CLI 应用边界设计 — 技术设计

## 方案概述

本设计承接 `cli-application-boundary-L1`，目标是在不改变 CLI 命令、flags、输出关键文本、JSON shape、exit code 和 core 行为的前提下，将 CLI 层拆成更薄的适配边界：

```
[Commander registration]
      │
      ▼
[CLI handler: flags -> application input]
      │
      ▼
[Core / application use case]
      │
      ▼
[Presenter: result/error -> stdout/stderr/json/exit]
```

本轮不替换 Commander，不重写所有命令。迁移策略是先建立小型通用运行时 helper，再对 `task` 和 `spec` 两个热点做垂直切片，让后续 CLI 命令可以按同一模式渐进迁移。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| CLI 分层粒度 | A: 只拆 helper 函数, B: handler/presenter/runtime 三段边界 | B | L1 的核心问题是 action 过厚，三段边界能分别测试参数转换、业务调用和输出兼容 |
| 迁移范围 | A: 一次性迁移所有 CLI 文件, B: 先迁移 task/spec 热点垂直切片 | B | 小步迁移可降低输出回归风险，优先处理最大复杂度来源 |
| 输出兼容策略 | A: 顺带统一文案, B: 保留现有关键输出并增加 presenter 测试 | B | 当前 CLI 可能被脚本依赖，架构收益不能以输出变化为代价 |
| 错误处理方式 | A: 每个命令继续 catch, B: 通用 `runCliAction` 处理已知错误映射 | B | 可减少重复 `console.error` / `process.exit`，并统一 exit code 行为 |
| JSON 输出 | A: 直接在 action 内 `JSON.stringify`, B: presenter 负责 JSON/text 两种模式 | B | 使 machine-readable 输出和文本输出都可单测 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/cli/common.ts` | 修改 | 扩展通用 CLI runtime、错误映射、CSV 解析或 presenter 基础类型 | CLI 单测 + 类型检查 |
| `src/cli/task.ts` | 修改 | 将 `report/verify/show` 等高重复命令的 payload 转换和输出渲染迁出 action | `src/cli/__tests__/task.test.ts` + 新 handler/presenter 测试 |
| `src/cli/spec.ts` | 修改 | 将 `update/confirm/freeze/implement/validate-plan` 中的状态推进输出和错误映射逐步迁出 | `src/cli/__tests__/spec.test.ts` + 新 handler/presenter 测试 |
| `src/cli/__tests__/task*.test.ts` | 新增/修改 | 锁定 task CLI handler/presenter 行为 | 聚焦测试 + 既有 CLI 回归 |
| `src/cli/__tests__/spec*.test.ts` | 新增/修改 | 锁定 spec CLI handler/presenter 行为 | 聚焦测试 + 既有 CLI 回归 |
| `src/cli/__tests__/architecture-smoke.test.ts` | 复用 | 作为跨命令兼容 smoke | 全链路回归 |

## 边界模型

### CliActionContext

```ts
interface CliActionContext {
  paths: ProjectPaths;
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  log: (message: string) => void;
  error: (message: string) => void;
  exit: (code: number) => never;
}
```

用途：让 handler/presenter 可在测试中注入输出 sink，减少对全局 `console` 和 `process.exit` 的直接依赖。初始实现可以保持 `console.log/error/process.exit` 默认行为，测试逐步迁移到注入式 context。

### CliResult

```ts
type CliResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error; exitCode: number; stderr: string };
```

用途：可选地表达 handler 结果。对于现有同步抛错 core API，第一阶段不强制所有 handler 返回 Result；`runCliAction` 可以捕获已知错误并映射输出。

### Presenter

```ts
interface Presenter<T> {
  renderText(value: T): string[];
  renderJson?(value: T): unknown;
}
```

用途：将“如何展示”从“如何调用 core”中拆出。现有命令中 JSON shape 已被用户依赖时，presenter 的 `renderJson` 必须返回与现有输出等价的对象。

## 接口契约

### CLI runtime: runCliAction

**请求**:
```json
{
  "json": false,
  "knownErrors": [
    {"prefix": "INVALID_REPORT:", "exitCode": 2},
    {"prefix": "TASK_NOT_FOUND:", "exitCode": 2}
  ],
  "action": "async function"
}
```

**成功响应**:
```json
{
  "exitCode": 0,
  "stdout": ["..."],
  "stderr": []
}
```

**错误响应**:

| 错误码/前缀 | exit code | 行为 |
|---|---:|---|
| known prefix | 2 | stderr 输出 `✗ <message>` 或保持现有格式 |
| unknown error | throw | 保持测试可见的失败，不吞掉未知 bug |

### Task CLI handler: report/verify

**请求**:
```json
{
  "taskId": "T-001",
  "specCode": "auth-L3.1.1-login",
  "opts": {
    "summary": "Implemented report command",
    "files": "src/core/harness.ts,src/cli/task.ts",
    "json": false
  }
}
```

**成功响应**:
```json
{
  "taskId": "T-001",
  "stepNo": 1,
  "warnings": [],
  "taskStatus": "running"
}
```

### Spec CLI handler: status transition

**请求**:
```json
{
  "code": "auth-L3.1.1-login",
  "command": "confirm",
  "force": false
}
```

**成功响应**:
```json
{
  "code": "auth-L3.1.1-login",
  "oldStatus": "draft",
  "newStatus": "frozen",
  "next": "spec-manager task create ..."
}
```

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| handler 抛出未知错误 | 可能是真实 bug | 不吞错，继续 throw，让测试失败 | 修复 bug 后补已知错误映射 |
| presenter 输出与旧测试不一致 | 可能破坏用户脚本 | 保留旧测试断言，调整 presenter 兼容输出 | 通过 CLI 单测回归 |
| context 注入影响全局 spy 测试 | 现有测试可能不适配 | 初期默认仍使用 `console.*`，逐步迁移测试 | 分 L3 小步调整 |
| JSON 输出 shape 漂移 | 破坏机器消费 | presenter JSON 输出必须复用现有结果对象 | 增加 JSON 快照式断言 |

## 向后兼容

- **命令兼容**: 不改命令名、参数名、默认值或必填选项。
- **输出兼容**: 保持现有测试覆盖的关键文本，例如 `Task T-001 report written`、`verification V-001 recorded`、`draft → frozen`。
- **错误兼容**: 已知错误继续映射到当前 exit code；未知错误继续抛出。
- **数据兼容**: 不改变 specs、tasks、decisions、changes 或 `.spec-manager` 的磁盘格式。
- **公共 API**: 不要求新 handler 成为包级公共 API，除非后续 L3 明确需要测试导出；优先模块内导出供测试使用。

## 关键交互流程

### task report / verify

```
Commander action
  │
  ├─ parse raw opts
  ▼
Task CLI handler
  │
  ├─ validate mutually exclusive flags
  ├─ normalize payload
  └─ call harness/core task use case
  ▼
Task presenter
  │
  ├─ render json if --json
  └─ render text output and warnings
```

### spec confirm / freeze / implement

```
Commander action
  │
  ▼
Spec transition handler
  │
  ├─ load spec
  ├─ compute actual target
  ├─ validate placeholder/status/R3 gates
  └─ call updateSpec or fail
  ▼
Spec transition presenter
  │
  └─ render old → new and Next suggestion
```

## 可观测性

- CLI 层保持现有 stdout/stderr 输出为主要可观测面。
- handler 单元测试记录输入 payload 与输出模型，降低只靠 console spy 的调试成本。
- task/spec CLI 回归测试继续作为行为兼容信号。

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `cli-application-boundary-L3.1.1-runtime` | 扩展 `src/cli/common.ts`，提供轻量 runtime/presenter 基础类型、错误映射 helper、CSV/JSON flags helper，并以小测试锁定行为 | `cli-application-boundary-L2.1` confirmed |
| `cli-application-boundary-L3.1.2-task-handlers` | 迁移 task CLI 的 report/verify/show 或相邻高重复切片到 handler/presenter，保持 task CLI 测试兼容 | L3.1.1 implemented |
| `cli-application-boundary-L3.1.3-spec-handlers` | 迁移 spec CLI 的 update/status transition/validate-plan 中一组高风险切片到 handler/presenter，保持 spec CLI 测试兼容 | L3.1.2 implemented |
| `cli-application-boundary-L3.1.4-verification` | 运行 CLI 专项、architecture smoke、全量测试、lint、doctor，补必要兼容测试 | L3.1.3 implemented |

## 验证策略

每个 L3 至少执行：

```bash
npm test -- src/cli/__tests__/task.test.ts src/cli/__tests__/spec.test.ts
npm test -- src/cli/__tests__/architecture-smoke.test.ts
npm run lint
```

最终 L3 还必须执行：

```bash
npm test
spec-manager project doctor
```

## 关联

- parent: `cli-application-boundary-L1`
- based_on: `architecture-refactor-L3.1.5-verification`
