---
code: value-alignment-fixes-L2.1
level: L2
title: Review Finding Fix Design
topic: value-alignment-fixes
parentCode: value-alignment-fixes-L1
status: implemented
aiSummary: 通过 verify diagnostics、Design color lint、快捷入口与 init YAML 输出修复四个 review finding。
relations:
  - type: based_on
    target: value-alignment-fixes-L1
created: '2026-07-15T01:51:20.209Z'
updated: '2026-07-15T02:01:55.523Z'
changeSummary: 'cascade: task-complete'
---
# Review Finding Value Alignment Fixes Design

## 背景

四个 finding 分布在 `src/core/verify.ts`、`src/core/design-context.ts`、`src/cli/usability.ts`、`src/cli/project.ts`。共同风险是让用户以为流程被系统保护，但实际存在静默放过或文案与行为不一致。

## 方案概述

本设计以“修复假阳性和误导入口”为中心，不扩大产品边界。实现上保持既有模块分层：核心规则在 `src/core/*`，CLI 入口只做参数和渲染，测试覆盖集中在对应 core/cli test。

## 技术决策

### @verify 解析诊断

在 `verify.ts` 中增加结构化解析诊断函数，保留 `parseVerifyRules()` 的兼容返回值，同时提供 completion gate 可使用的诊断：

- 正常规则继续返回 `VerifyRule[]`。
- 包含 `@verify:` 但格式不合法、未知类型或参数数量不匹配的行返回 diagnostic。
- `runVerifyRuleGate()` 在执行前检查 diagnostics；存在 invalid diagnostic 时 hard fail。

### Design Context 颜色校验

保持轻量解析边界：

- `rgb()` / `rgba()` 进行通道解析，支持逗号和空格分隔、百分比、可选 alpha。
- 明显非法函数值报 error。
- `hsl()` / `hsla()` 可继续按轻量函数接收或 warning，不作为本次完整解析范围。

### new feature duplicate topic

复用现有 `generateSpecCode(topic, 'L1', undefined, siblingCount, desc)` 能力，允许 duplicate topic 时生成额外 L1 code，例如 `topic-L1-2` 或描述后缀对应的安全 code。若不允许 duplicate，仍保持当前防重复提示。

### project init YAML

使用 `yaml` 序列化初始 config，避免手写字符串导致特殊字符破坏 YAML。保持字段和默认语义不变。

## 受影响模块

- `src/core/verify.ts`: 新增解析诊断并复用既有 parser。
- `src/core/task-completion.ts`: completion verify-rules gate 消费诊断。
- `src/core/design-context.ts`: rgb/rgba 颜色校验。
- `src/cli/usability.ts`: duplicate topic 快捷入口。
- `src/cli/project.ts`: project init YAML 输出。
- `src/core/__tests__/*` 与 `src/cli/__tests__/*`: 回归测试。

## 接口契约

- `parseVerifyRules(content, sectionName)` 继续返回 `VerifyRule[]`，保持公开兼容。
- 新增 `parseVerifyRulesWithDiagnostics(content, sectionName)`，返回 `{ rules, diagnostics }`。
- diagnostics 至少包含 `line`、`message`、`type?`，供 completion gate 生成错误。
- `spec-manager new feature --allow-duplicate-topic` 保持 CLI 参数名不变。
- `project init` 输出字段保持 `project_name`、`specWorkflow`、`rulesAppliesTo`、`created`。

## L3 裂变计划

- `value-alignment-fixes-L3.1.1`: 一次性修复四个 review finding，并增加聚焦测试和全量验证。

## 风险

- `@verify` hard fail 会让此前含拼写错误的 L3 在 completion 阶段更严格，这是符合价值承诺的行为变化。
- Design lint 对无效 rgb 从通过变失败，属于 bug fix。
- duplicate L1 code 需要满足现有 `SPEC_CODE_RE`。

## 验证

- 增加 verify parser diagnostics 测试。
- 增加 malformed `@verify` completion gate 测试。
- 增加 invalid rgb/rgba Design Context 测试。
- 增加 duplicate feature shortcut 测试。
- 增加 project init YAML 特殊字符测试。
