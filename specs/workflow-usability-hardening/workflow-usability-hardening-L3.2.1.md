---
code: workflow-usability-hardening-L3.2.1
level: L3
title: Docs Consistency Core and CLI
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L2.2
status: implemented
aiSummary: >-
  实施规格：新增 project docs check 的 core report 与 CLI，覆盖
  README/package/skill/template 一致性检查。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取规格并调查 project docs 相关代码
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 实现 docs consistency core 与 CLI
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 增加 docs consistency core 和 CLI 测试
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 更新 README 与 agent guidance 文档
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
created: '2026-06-27T14:25:13.658Z'
updated: '2026-06-27T14:39:23.930Z'
changeSummary: 'cascade: task-complete'
---
# Docs Consistency Core and CLI — 实施规格

## 目标

新增只读的 docs consistency 检查能力，让维护者在 README 改造、Agent guidance 同步和 npm 发布前，能用一个稳定命令发现 README 链接、package files、skill/template guidance 的一致性问题。

## 范围

包含：

- 新增 `buildDocsConsistencyReport(paths, options?)` core API。
- 新增 `spec-manager project docs check [--json]` CLI。
- 检查 `README.md` 是否存在、中文 README 是否链接 `readme_en.md`、英文 README 是否反链中文 README。
- 检查 README 链接的公开文档是否进入 `package.json.files`。
- 检查 `skill/SKILL.md` 与 `templates/agents/*/SKILL.md` 是否包含关键 workflow/design guidance。
- 增加 core 与 CLI 测试覆盖 text/json 输出、error exit code、warning/info 统计。

不包含：

- 自动修改 README、package.json 或 skill/template 文件。
- 网络外链可达性检查。
- npm pack 或 npm registry 调用。
- `.agents/` / `.claude/` 等生成资产边界的深度报告，该部分留给 L3.2.2。

## 关键验收标准

1. **AC-1**: `buildDocsConsistencyReport` MUST 返回 `docs-consistency.v1` schema、findings 和 errors/warnings/infos summary。
2. **AC-2**: 缺少 `README.md` 或 README 链接的英文文档目标不存在时，CLI MUST 以 exit code 1 失败。
3. **AC-3**: `package.json.files` 缺少 README 链接的公开文档时，report MUST 输出 warning，但默认 exit code 仍为 0。
4. **AC-4**: skill/template guidance 缺失 MUST 输出 warning，并包含具体文件路径和修复建议。
5. **AC-5**: `project docs check --json` MUST 输出可机器读取的 report，text 模式 MUST 易读展示 severity、id、detail。
6. **AC-6**: 全量测试、lint、build MUST 通过。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/docs-consistency.ts` | 新增 docs consistency report core |
| `src/cli/project.ts` | 增加 `project docs check` 子命令 |
| `src/core/__tests__/docs-consistency.test.ts` | 覆盖 core findings 与 summary |
| `src/cli/__tests__/project-docs.test.ts` | 覆盖 text/json 输出和 exit code |
| `README.md` / `readme_en.md` | 增加发布前 docs check 提示 |
| `skill/SKILL.md` / `templates/agents/codebuddy-skill/SKILL.md` | 补充 docs check guidance |

## 实施步骤

1. 读取 `src/cli/project.ts`、`src/core/usability.ts`、`src/core/agents.ts`、`package.json`、README 与 skill/template 文件，确认现有命令和文件布局。
2. 新增 `src/core/docs-consistency.ts`，实现 report 数据模型、README 链接解析、package files 检查、guidance 关键词检查。
3. 在 `src/cli/project.ts` 增加 `project docs check` 命令，支持 text/json 输出和 error exit code。
4. 增加 core 测试，覆盖 README 缺失、英文目标缺失、package files warning、guidance warning。
5. 增加 CLI 测试，覆盖 text 输出、json schema 和 error exit code。
6. 更新 README/英文 README/skill/template guidance，提示发布前运行 docs check。
7. 运行聚焦测试与全量验证。

## 验证命令

```bash
npm test -- --run src/core/__tests__/docs-consistency.test.ts src/cli/__tests__/project-docs.test.ts
npm test
npm run lint
npm run build
```

## 回滚策略

若 docs check 输出误报过多或 CLI contract 不合适，回滚 `docs-consistency` core、`project docs check` CLI、相关测试和文档提示；该能力只读，不涉及数据迁移。
