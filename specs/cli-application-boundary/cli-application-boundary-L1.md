---
code: cli-application-boundary-L1
level: L1
title: CLI 应用边界瘦身
topic: cli-application-boundary
parentCode: null
status: implemented
aiSummary: >-
  本 L1 定义下一阶段 CLI 应用边界瘦身：在核心分层已完成的基础上，优先拆解 task/spec CLI 热点，将 Commander
  action、handler、presenter、错误映射分层，保持命令、输出、JSON shape、exit code 和测试基线兼容。
created: '2026-06-11T08:29:24.019Z'
updated: '2026-06-11T08:46:23.766Z'
changeSummary: 'cascade: task-complete'
---
# CLI 应用边界瘦身 — 需求文档

## 背景

上一轮 `architecture-refactor` 已完成核心层分层：任务完成门禁、规格策略、项目快照、归档计划和发布验证都已经有独立边界，且全量测试基线提升到 514/514 通过。核心层现在比重构前更可维护，但 CLI 层仍是下一处主要复杂度集中点。

当前走读发现，CLI 命令文件仍承担过多职责：

- `src/cli/task.ts` 约 477 行，同时负责 Commander 注册、参数互斥校验、payload 归一化、错误分类、核心用例调用、文本/JSON 输出和部分业务提示。
- `src/cli/spec.ts` 约 334 行，同时负责创建规则前置检查、状态推进策略、内容更新、计划校验、迁移命令和输出文案。
- 多个 CLI 文件重复处理 `console.log`、`console.error`、`process.exit`、JSON 输出、逗号分隔参数、错误前缀映射等适配逻辑。
- 现有测试能覆盖行为，但很多测试必须穿透 CLI 文件本身，导致后续增加命令或调整输出时修改半径较大。

这些问题不影响当前功能正确性，但会影响下一阶段扩展：例如继续增加 machine-readable 输出、批量执行、安全恢复、dry-run 报告或插件式命令时，CLI 文件会继续变成规则和展示的聚合点。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| CLI 适配层过厚 | Commander action 内混合参数解析、业务调用、错误映射和渲染 | P1 | `src/cli/task.ts`、`src/cli/spec.ts` 走读 |
| 输出渲染重复 | 文本输出、JSON 输出、stderr 和 exit code 处理分散在各命令 | P1 | 多个 `src/cli/*.ts` 重复 `console.*` / `process.exit` |
| 命令 payload 缺少边界 | flags 到 core input 的转换散落在 action 内，难以单独测试 | P2 | `task report/verify`、`spec update/confirm` |
| 错误分类不统一 | 部分命令捕获前缀错误并 exit，部分直接 throw | P2 | `task context/report/verify` 与其他命令差异 |

## 用户故事

### Must have

- As a 维护者, I want CLI action 只负责连接 Commander 与应用服务, so that 新增命令时不需要复制错误处理和输出模式。
- As a 维护者, I want flags 到 use case input 的转换可以单独测试, so that 参数兼容性不依赖完整 CLI 执行路径。
- As a 使用 CLI 的开发者, I want 重构后命令输出、exit code、JSON 模式和错误语义保持兼容, so that 现有脚本不会中断。
- As a 维护者, I want 命令输出渲染有统一边界, so that 未来增加 machine-readable 输出或调整文案时修改范围可控。

### Should have

- As a 维护者, I want task/spec 两个最大 CLI 文件优先瘦身, so that 最大复杂度热点先被拆解。
- As a 维护者, I want CLI 错误映射以可复用 helper 表达, so that `process.exit` 和 stderr 行为一致。

### Could have

- As a 维护者, I want 后续所有 CLI 子命令都逐步迁移到统一 command handler 模式, so that CLI 层形成稳定扩展模板。

## 功能目标

| 能力 | 现状 | 目标 |
|---|---|---|
| CLI action 职责 | action 内混合解析、校验、调用、渲染、错误处理 | action 主要调用 handler/presenter，业务输入转换可独立定位 |
| 输出模式 | 文本和 JSON 输出分散在命令实现 | 至少 task/spec 热点命令使用统一 presenter 或 response renderer |
| 错误处理 | 命令间 `throw`、`console.error`、`process.exit` 策略不一致 | 高风险命令通过统一错误映射保持 exit code 兼容 |
| 行为兼容 | 当前 CLI 测试和 smoke 测试通过 | 重构后全部 CLI 测试、架构 smoke、全量测试继续通过 |

## 验收标准

1. **AC-1**: **Given** `src/cli/task.ts` 当前承担多类职责, **When** 本主题完成, **Then** task CLI 的至少一个高复杂命令组 **SHALL** 将 flags 转换、核心调用和输出渲染拆到可单独测试的边界。
2. **AC-2**: **Given** `src/cli/spec.ts` 同时处理状态策略与输出, **When** 本主题完成, **Then** spec CLI 的状态推进或更新链路 **SHALL** 通过应用 handler/presenter 边界保持行为兼容。
3. **AC-3**: **Given** 用户依赖现有 CLI 文本和 JSON 输出, **When** 重构完成, **Then** 现有 CLI 单元测试和 architecture smoke 测试 **SHALL** 全部通过。
4. **AC-4**: **Given** CLI 命令失败需要稳定 exit code, **When** handler 抛出已知错误, **Then** CLI 适配层 **MUST** 以统一方式映射 stderr 和 exit code。
5. **AC-5**: **Given** 本项目使用 spec-manager 流程, **When** 每个 L3 实施完成, **Then** `npm test`、`npm run lint`、`spec-manager project doctor` **SHALL** 通过。

## 范围边界

- **做**:
  - 设计 CLI action、application handler、presenter/renderer 的边界。
  - 优先拆解 `task` 和 `spec` 两个 CLI 热点。
  - 保持命令名称、参数、输出关键文本、JSON shape 和 exit code 兼容。
  - 为拆出的 handler/presenter 增加聚焦测试。
- **不做**:
  - 不改变 core 数据模型、spec/task 存储格式或状态机语义。
  - 不重命名现有 CLI 命令或删除既有 flags。
  - 不引入外部 CLI 框架替换 Commander。
  - 不做视觉化 TUI 或交互式体验重写。
- **推迟**:
  - 全量迁移所有 CLI 子命令到统一 handler 模式。
  - 插件式命令注册。
  - 国际化输出或完整机器协议。

## 设计原则

1. **CLI 薄适配** — Commander action 只做参数接线、调用 handler、交给 presenter 输出。违反判断: action 内继续堆叠领域判断和多分支渲染。
2. **输出兼容优先** — 内部 renderer 可重构，但用户可见关键输出必须保持测试覆盖。违反判断: 现有 CLI 测试因无业务收益的文案变更失败。
3. **错误单点映射** — 已知错误码或错误前缀应在统一边界映射 stderr/exit code。违反判断: 每个命令继续手写重复 catch。
4. **小步迁移** — 先迁移 task/spec 热点中的垂直切片，再评估是否推广。违反判断: 单个 L3 同时改动所有 CLI 文件。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | CLI 应用边界设计与迁移模板 | L1 confirmed | P1 |
| Phase 2 | task CLI handler/presenter 垂直切片 | Phase 1 | P1 |
| Phase 3 | spec CLI handler/presenter 垂直切片 | Phase 1 | P1 |
| Phase 4 | 错误映射和输出兼容回归 | Phase 2-3 | P2 |

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 自动化测试通过率 | 514/514 通过 | 100% 通过 | `npm test` |
| 类型检查 | 通过 | 通过 | `npm run lint` |
| 项目诊断 | ok | ok | `spec-manager project doctor` |
| CLI 热点职责 | `task.ts` / `spec.ts` action 内混合多职责 | 至少两个高风险命令链路具备 handler/presenter 边界 | 代码审查与 L3 验收 |
| 回归覆盖 | CLI 子测试 + architecture smoke | 重构后继续覆盖并新增 handler/presenter 单测 | 测试报告 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| CLI 输出被脚本依赖 | 文案变更可能破坏外部自动化 | 只做内部边界重构，保留关键输出断言 |
| handler 抽象过度 | 可能增加层数但不减少复杂度 | 只从重复且高风险的 task/spec 切片开始 |
| 错误映射不一致 | exit code 或 stderr 回归 | 先用测试锁定已知错误路径，再迁移 |
| 与刚完成的核心分层交叠 | 可能误改 core 行为 | 本主题只改 CLI/application adapter，不改变 core 规则 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| CLI 应用边界设计 | Phase 1 | 1 |
| task CLI handler/presenter 迁移 | Phase 2 | 1 |
| spec CLI handler/presenter 迁移 | Phase 3 | 1 |
| CLI 兼容验证与错误映射补强 | Phase 4 | 1 |

## 关联

- based_on: architecture-refactor-L1
- based_on: architecture-refactor-L3.1.5-verification
