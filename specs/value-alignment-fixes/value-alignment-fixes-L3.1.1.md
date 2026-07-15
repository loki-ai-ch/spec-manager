---
code: value-alignment-fixes-L3.1.1
level: L3
title: Review Finding Fix Implementation
topic: value-alignment-fixes
parentCode: value-alignment-fixes-L2.1
status: implemented
aiSummary: >-
  实现 verify diagnostics hard fail、Design rgb lint、duplicate feature shortcut 和
  init YAML 序列化，并补充测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Implement verify diagnostics and completion hard fail
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement strict rgb/rgba design color lint
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Fix duplicate feature shortcut and project init YAML serialization
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Add focused regression tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
relations:
  - type: based_on
    target: value-alignment-fixes-L2.1
created: '2026-07-15T01:52:18.868Z'
updated: '2026-07-15T02:01:55.518Z'
changeSummary: 'cascade: task-complete'
---
# Review Finding Value Alignment Fixes Implementation

## 背景

本 L3 修复代码走读发现的四个价值一致性问题，防止验收假阳性和 CLI 行为误导。

## 目标

- completion 阶段不再静默忽略无效 `@verify`。
- Design Context lint 能拒绝明显无效 `rgb()` / `rgba()`。
- `new feature --allow-duplicate-topic` 与 CLI 文案一致。
- `project init` 输出 YAML 对特殊字符项目名稳健。
- focused tests 与全量验证通过。

## 涉及文件

- `src/core/verify.ts`
- `src/core/task-completion.ts`
- `src/core/design-context.ts`
- `src/cli/usability.ts`
- `src/cli/project.ts`
- `src/core/__tests__/verify.test.ts`
- `src/core/__tests__/task-completion.test.ts`
- `src/core/__tests__/design-context.test.ts`
- `src/cli/__tests__/usability.test.ts`
- `src/cli/__tests__/project-workflow.test.ts`

## 实施步骤

1. 在 `verify.ts` 增加 `parseVerifyRulesWithDiagnostics()`，并让 `parseVerifyRules()` 复用它。
2. 在 `task-completion.ts` 的 verify-rules gate 中对 invalid diagnostics hard fail。
3. 在 `design-context.ts` 中严格校验 `rgb()` / `rgba()`，让无效通道报 error。
4. 修复 `new feature --allow-duplicate-topic` 的 L1 code 生成逻辑。
5. 将 `project init` 初始配置改为 YAML 序列化。
6. 增补对应测试。

## 验收标准

- **AC-1**: malformed/unknown/arity mismatch `@verify` 在 completion 阶段失败。
  - @verify: command(npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-completion.test.ts)
- **AC-2**: invalid `rgb()` / `rgba()` Design Context lint 报 error。
  - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
- **AC-3**: duplicate topic shortcut 行为与 `--allow-duplicate-topic` 一致。
  - @verify: command(npm test -- --run src/cli/__tests__/usability.test.ts)
- **AC-4**: project init YAML 对特殊名称合法。
  - @verify: command(npm test -- --run src/cli/__tests__/project-workflow.test.ts)
- **AC-5**: 全量验证通过。
  - @verify: command(npm run lint)
  - @verify: command(npm test)
  - @verify: command(npm run build)

## 关键验收标准

- AC-1
- AC-2
- AC-3
- AC-4
- AC-5

## 验证命令

- npm run lint
- npm test
- npm run build

## 回滚

如出现兼容性问题，回滚本 L3 相关提交；已完成 task evidence 保留为审计记录。
