---
code: design-context-L3.6.1
level: L3
title: Managed Specs Design Context Defaults
topic: design-context
parentCode: design-context-L2.6
status: implemented
aiSummary: >-
  实施规格：将 design context 默认入口切换到 specs/DESIGN.md，保留根目录 DESIGN.md fallback，并同步
  brief/template/export/docs/tests。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey design context call sites
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement managed specs default resolver
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update tests for default path behavior
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Update CLI and documentation guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
relations:
  - type: based_on
    target: design-context-L2.6
created: '2026-06-27T09:31:12.197Z'
updated: '2026-06-27T09:41:01.716Z'
changeSummary: 'cascade: task-complete'
---
# Managed Specs Design Context Defaults — 实施规格

## 目标

将 DESIGN.md 默认入口从项目根目录 `DESIGN.md` 调整为 spec-manager 管理面内的 `specs/DESIGN.md`，并保留根目录 `DESIGN.md` 作为兼容 fallback。

## 范围

包含：

- 统一默认 design context path resolver。
- `buildDesignContextReport`、export、brief 的默认读取优先级更新。
- `design-template` 默认输出改为 `specs/DESIGN.md`，并确保父目录存在。
- README、中文 README、agent skill、分发模板文档同步。
- 单测覆盖默认发现、fallback、优先级和显式路径覆盖。

不包含：

- 项目配置项 `designContext.path`。
- `specs/<topic>/DESIGN.md` 自动扫描。
- 自动迁移、复制或删除现有根目录 `DESIGN.md`。
- 改变 verify 显式路径语义。

## 关键验收标准

- **AC-1**：无显式 path 且存在 `specs/DESIGN.md` 时，design context report 和 Agent Brief 默认读取 `specs/DESIGN.md`。
- **AC-2**：仅存在根目录 `DESIGN.md` 时，默认读取仍兼容成功。
- **AC-3**：同时存在 `specs/DESIGN.md` 和根目录 `DESIGN.md` 时，默认优先 `specs/DESIGN.md`。
- **AC-4**：显式传入 `DESIGN.md` 或 `specs/DESIGN.md` 时，不触发 fallback，并继续受项目根目录内相对路径约束保护。
- **AC-5**：`assist design-template` 默认输出路径为 `specs/DESIGN.md`，父目录不存在时可创建成功。
- **AC-6**：README、readme_zh、skill 分发文档将 `specs/DESIGN.md` 说明为 canonical 默认入口，根目录 `DESIGN.md` 说明为 legacy fallback。

## 实施步骤

1. 调查当前 design context resolver、brief、export、template 和 verify 调用点，确认默认 path 分叉位置。
2. 在 `src/core/design-context.ts` 增加默认候选常量与 resolver，统一无显式路径行为。
3. 更新 `buildDesignContextReport` / export / template 默认路径行为，保持显式路径 contract 不变。
4. 更新 `src/core/capability-brief.ts` 相关测试，确保 Agent Brief 自动读取 `specs/DESIGN.md`。
5. 更新 `src/cli/capability.ts` 默认参数与帮助文案，确保 template 默认写入 `specs/DESIGN.md`。
6. 补充或调整 core/CLI 测试，覆盖 AC-1 至 AC-5。
7. 更新 README、readme_zh、`.agents/skills/spec-manager/SKILL.md` 与 `templates/agents/codebuddy-skill/SKILL.md`。
8. 运行聚焦测试：`npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/capability-brief.test.ts src/cli/__tests__/capability.test.ts`。
9. 运行全量验证：`npm test`、`npm run lint`、`npm run build`。

## 预期改动文件

- `src/core/design-context.ts`
- `src/core/capability-brief.ts`
- `src/cli/capability.ts`
- `src/core/__tests__/design-context.test.ts`
- `src/core/__tests__/capability-brief.test.ts`
- `src/cli/__tests__/capability.test.ts`
- `README.md`
- `readme_zh.md`
- `.agents/skills/spec-manager/SKILL.md`
- `.agents/skills/spec-manager/templates/agents/codebuddy-skill/SKILL.md`
- `templates/agents/codebuddy-skill/SKILL.md`

## 验证命令

```bash
npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/capability-brief.test.ts src/cli/__tests__/capability.test.ts
npm test
npm run lint
npm run build
```

## 回滚策略

若默认路径调整引入兼容问题，回滚 resolver 优先级和 CLI 默认值即可；显式路径、verify 语义和根目录 fallback 不涉及数据迁移。
