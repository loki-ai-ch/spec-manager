---
code: workflow-usability-hardening-L3.2.2
level: L3
title: Generated Agent Asset Boundary Guidance
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L2.2
status: implemented
aiSummary: 实施规格：增强 project docs check 的生成型 Agent 资产边界提示，覆盖本地输出目录与 package files 发布风险。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取规格并调查 docs check 现有实现
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 实现 generated asset 边界 findings
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 增加 generated asset core 和 CLI 测试
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 更新 README 与 agent guidance 边界说明
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
relations:
  - type: based_on
    target: workflow-usability-hardening-L2.2
created: '2026-06-28T01:21:06.934Z'
updated: '2026-06-28T01:29:52.229Z'
changeSummary: 'cascade: task-complete'
---
# Generated Agent Asset Boundary Guidance — 实施规格

## 目标

增强 `project docs check` 对生成型 Agent 资产的边界提示，让维护者在提交、发布或公开交付前清楚区分源码/模板资产与本地生成输出，避免误把 `.agents/`、`.claude/`、`.codebuddy/`、`.codex/` 等目录混入发布或代码提交。

## 范围

包含：

- 在 docs consistency report 中新增 generated agent asset findings。
- 检查 `.agents/`、`.claude/`、`.codebuddy/`、`.codex/`、`.cursor/`、`.windsurf/` 等本地 Agent 输出目录是否存在。
- 对存在但未纳入 `package.json.files` 的生成资产输出 info，提示“本地输出，不应提交/发布，除非明确 vendoring”。
- 对被 `package.json.files` 显式包含的生成资产输出 warning，提示发布边界风险。
- 在 `project docs check` text/json 输出中复用现有 findings 模型。
- 补充 README/英文 README/skill/template guidance，说明提交前可用 docs check 检查生成资产边界。
- 增加 core/CLI 测试覆盖未跟踪/存在目录提示与 package files 风险。

不包含：

- 运行 `git status` 或依赖 git 命令判断 tracked/untracked。
- 自动修改 `.gitignore`、`package.json` 或删除任何目录。
- 对 Agent 安装资产做 drift 对账；该能力仍属于 `project doctor` / agents 检查。
- 发布命令或 release notes 风险检查。

## 关键验收标准

1. **AC-1**: 当常见生成资产目录存在时，`project docs check` MUST 输出 `docs.generated-assets.present` info，并说明其为本地 Agent 输出边界。
2. **AC-2**: 当 `package.json.files` 包含生成资产目录时，report MUST 输出 warning，提示不应发布生成输出。
3. **AC-3**: generated asset 检查 MUST 不依赖 git 命令或网络，保持只读、确定性。
4. **AC-4**: text/json CLI 输出 MUST 使用现有 `DocsConsistencyReport` schema，不新增第二套输出模型。
5. **AC-5**: README、英文 README、skill/template guidance MUST 提到 docs check 可用于提交/发布前检查生成资产边界。
6. **AC-6**: 聚焦测试、全量测试、lint、build MUST 通过。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/docs-consistency.ts` | 增加 generated asset 目录检测和 package files 风险 |
| `src/core/__tests__/docs-consistency.test.ts` | 覆盖 generated asset info/warning |
| `src/cli/__tests__/project-docs.test.ts` | 覆盖 CLI text/json 中 generated asset findings |
| `README.md` / `readme_en.md` | 补充提交/发布前生成资产边界提示 |
| `skill/SKILL.md` / `templates/agents/codebuddy-skill/SKILL.md` | 补充 Agent handoff 前运行 docs check 的边界说明 |

## 实施步骤

1. 读取 `src/core/docs-consistency.ts`、`src/cli/project.ts`、README 与 skill/template guidance，确认现有 docs check 输出模型。
2. 在 docs consistency core 中定义 generated asset 目录清单和 package files 覆盖判断。
3. 对存在的生成资产目录输出 info；对被 package files 包含的目录输出 warning。
4. 增加 core 和 CLI 测试，覆盖 `.agents/` 存在、`.agents` 被 package files 包含、JSON 输出。
5. 更新 README/英文 README/skill/template guidance，说明 generated asset boundary。
6. 运行聚焦测试与全量验证。

## 验证命令

```bash
npm test -- --run src/core/__tests__/docs-consistency.test.ts src/cli/__tests__/project-docs.test.ts
npm test
npm run lint
npm run build
node dist/cli/index.js project docs check --json
```

## 回滚策略

若 generated asset 边界提示噪音过高，回滚相关 finding、测试和文档提示；该能力只读，不涉及数据迁移。
