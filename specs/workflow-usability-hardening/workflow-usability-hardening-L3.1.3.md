---
code: workflow-usability-hardening-L3.1.3
level: L3
title: Spec Section Alias Guidance
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L2.1
status: implemented
aiSummary: 实施规格：为 L3 段名 alias 增加集中诊断和 CLI/critic 修复建议，不放宽规范段名校验。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey section validation and critique code paths
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement centralized section alias diagnostics
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add CLI and core tests for alias guidance
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
created: '2026-06-27T14:16:56.768Z'
updated: '2026-06-27T14:24:40.368Z'
changeSummary: 'cascade: task-complete'
---
# Spec Section Alias Guidance — 实施规格

## 目标

当用户或 Agent 在 L3 spec 中使用常见但非规范的段名时，`spec validate-plan` 和 critic 相关校验应给出明确、可操作的 alias 修复建议，避免用户只看到缺少必填段却不知道已有内容只是段名不匹配。

## 范围

包含：

- 在 core 层集中定义高频 section alias 表。
- 在 spec 内容校验中识别 alias 段名，并输出规范段名建议。
- 在 `spec validate-plan --from-spec <L3>` 输出 alias diagnostic。
- 在 spec critic 或 section rule 路径中复用同一 alias 诊断，避免重复规则分叉。
- 增加 L3 spec 样例测试，覆盖 `实施计划 -> 实施步骤`、`验证方式 -> 验证命令` 等高频场景。

不包含：

- 自动修改 spec markdown。
- 自动接受 alias 作为合法规范段。
- 大规模同义词库或自然语言标题识别。
- 改变 L1/L2/L3 的必填段规则。

## 关键验收标准

1. **AC-1**: 当 L3 缺少规范段名但存在已知 alias 段名时，CLI MUST 输出包含 alias 段名、规范段名和修复建议的 diagnostic。
2. **AC-2**: alias diagnostic MUST 不改变现有校验结果；缺少规范段仍按原规则失败或 warning。
3. **AC-3**: alias 规则 MUST 集中维护，避免 `validate` 和 `critic` 各自硬编码不同映射。
4. **AC-4**: 测试 MUST 覆盖至少两个 alias 场景，并确认规范段名存在时不输出 alias diagnostic。
5. **AC-5**: 全量测试、lint、build MUST 通过。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/spec-sections.ts` | 新增 section alias 常量和 alias 检测 helper |
| `src/core/validate.ts` | 将 alias diagnostic 合入 spec/plan 校验输出 |
| `src/core/spec-critic.ts` | 复用 alias helper 输出 advisory |
| `src/cli/spec.ts` | 在 `validate-plan` 中打印 alias diagnostic |
| `src/core/__tests__` | 增加 alias helper 和 critic/validate 测试 |
| `src/cli/__tests__/spec.test.ts` | 覆盖 CLI alias 输出 |

## 实施步骤

1. 阅读 `src/core/spec-sections.ts`、`src/core/validate.ts`、`src/core/spec-critic.ts` 和 `src/cli/spec.ts` 的 section 校验路径。
2. 在 core 层新增 `SECTION_HEADING_ALIASES` 与 `buildSectionAliasDiagnostics`，返回结构化 diagnostic。
3. 将 alias diagnostic 接入 validate/critic 路径，确保只提示不放行。
4. 更新 `spec validate-plan` 文本输出，包含 `[section_alias]`、当前 alias、目标规范段名和建议。
5. 增加 core 与 CLI 测试，覆盖 alias 命中、规范段不误报、多个 alias 输出。
6. 运行聚焦测试与全量验证。

## 验证命令

```bash
npm test -- --run src/cli/__tests__/spec.test.ts src/core/__tests__/validate.test.ts
npm test
npm run lint
npm run build
```

## 回滚策略

若 alias diagnostic 引入误报或噪音，回滚 alias helper、CLI 打印和对应测试；不涉及数据迁移，现有 spec 文件与状态机不受影响。
