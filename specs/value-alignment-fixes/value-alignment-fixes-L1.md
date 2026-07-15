---
code: value-alignment-fixes-L1
level: L1
title: Review Finding Value Alignment Fixes
topic: value-alignment-fixes
parentCode: null
status: implemented
aiSummary: 修复代码走读发现的四个价值一致性问题，防止验收假阳性和 CLI 行为误导。
created: '2026-07-15T01:50:31.813Z'
updated: '2026-07-15T02:01:55.529Z'
changeSummary: 'cascade: task-complete'
---
# Review Finding Value Alignment Fixes

## 背景

本次代码走读确认 spec-manager 的核心价值仍是本地规格状态机、人类审核门控、Agent Task 执行记录和 verification evidence 闭环。但走读发现若干会削弱该价值承诺的问题：错误 `@verify` 可能被静默忽略、Design Context 可能接受无效颜色、快捷入口存在死选项、project init 配置写入未做 YAML 序列化。

## 目标

- 修复会导致验收门禁假阳性的 `@verify` 解析问题。
- 提升 Design Context lint 对无效 CSS color function 的识别能力。
- 让 `spec-manager new feature --allow-duplicate-topic` 行为与文案一致，或不再暴露无效能力。
- 让 `project init` 写出的配置在特殊项目名下仍是合法 YAML。
- 保持项目价值主线：轻量本地文件、可验证门禁、清晰快捷入口。

## 非目标

- 不改变 L1/L2/L3/Task 生命周期语义。
- 不引入网络、数据库或 MCP 依赖。
- 不重构 CLI presenter 架构。
- 不扩展 Design Context 为完整 CSS 解析器。

## 用户故事

1. As a 维护者, I want malformed `@verify` 在完成阶段失败, so that verification evidence 不会因拼写错误产生假阳性。
2. As a UI/design-context 使用者, I want 明显非法颜色被 lint 拦住, so that Agent 拿到的设计上下文更可信。
3. As a 新手用户, I want 快捷入口选项和实际行为一致, so that 上手路径不会制造困惑。
4. As a 项目初始化用户, I want 特殊项目名也生成合法配置, so that 初始化命令稳定可靠。

## 范围边界

- In scope: verify parser diagnostics、completion verify gate、Design Context rgb/rgba lint、new feature duplicate shortcut、project init YAML 输出。
- Out of scope: 完整 CSS parser、CLI 大重构、agent 资产同步策略、发布流程。

## 验收标准

1. **AC-1**: malformed 或 unknown `@verify` 在 task completion verify-rules gate 中不能被静默忽略。
2. **AC-2**: `rgb(...)`/`rgba(...)` 等明显无效颜色在 Design Context lint 中产生 error。
3. **AC-3**: `spec-manager new feature --allow-duplicate-topic` 能创建额外 L1，或 CLI 不再声明该选项。
4. **AC-4**: `spec-manager project init --name` 对包含 YAML 特殊字符的名称输出合法可读配置。
5. **AC-5**: `npm test`、`npm run lint`、`npm run build` 通过。
