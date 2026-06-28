---
code: workflow-usability-hardening-L2.2
level: L2
title: Docs Package and Agent Asset Consistency Checks
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L1
status: implemented
aiSummary: >-
  技术设计：新增 project docs check，只读检查 README 链接、package files、skill/template
  guidance 与生成资产边界。
relations:
  - type: based_on
    target: workflow-usability-hardening-L1
  - type: references
    target: spec-manager-ai-ux-L1
  - type: references
    target: lifecycle-guidance-sync-L1
created: '2026-06-27T13:55:32.414Z'
updated: '2026-06-27T14:39:23.935Z'
changeSummary: 'cascade: task-complete'
---
# Docs Package and Agent Asset Consistency Checks — 技术设计

## 方案概述

本设计新增项目级只读检查能力，用于在文档改造、agent 资产同步和 npm 发布前发现一致性问题。

核心命令建议：

```bash
spec-manager project docs check
spec-manager project docs check --json
```

第一版聚焦 report-only，不自动改文件。它补齐 `project doctor` 当前不覆盖的 docs/package/release 资产面：

- README 与英文文档互链。
- `package.json.files` 是否包含 README 公开文档。
- `skill/SKILL.md` 与 `templates/agents/*` 是否包含关键 workflow guidance。
- `.agents/` / `.claude/` / `.codebuddy/` 等生成资产是否属于本地输出，不应被误认为发布源。
- release notes 使用内联 shell notes 时的高风险字符提示。

## 背景与代码调查

- `src/core/usability.ts#runProjectDoctor` 已提供 project doctor 和 managed agent asset 检查，但更偏项目初始化/agent 安装健康度。
- `src/core/agents.ts#inspectManagedAgentAssets` 可检查安装后的托管 agent 资产 missing/drift/custom extras。
- `package.json.files` 控制 npm 包内容；本轮 README 改造中新增 `readme_en.md` 需要显式加入 files。
- 当前 README、`skill/SKILL.md`、`templates/agents/codebuddy-skill/SKILL.md` 都会承载 design/workflow guidance，但缺少一致性审计。
- `.agents/` 在当前开发环境中是本地生成/运行资产，未跟踪；提交时需要避免误纳入。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 命令位置 | `project docs check` | 与 project doctor 同属项目健康检查，但范围更窄 |
| 默认行为 | 只读 report，不写文件 | 避免文档治理命令隐式修改用户内容 |
| 输出模型 | `DocsConsistencyReport` + findings | 便于 text/json 双输出和测试 |
| package 检查 | 读取项目根 `package.json.files` | 不依赖 npm pack 网络/缓存，也可在测试中稳定运行 |
| agent 资产边界 | 报告 tracked/untracked generated asset 风险 | 帮助用户知道 `.agents/` 是否应提交 |
| release notes | 第一版只提示风险，不执行 release | 发布自动化后续单独 L3 |

## 接口契约

### Core API

```ts
export type DocsFindingSeverity = 'error' | 'warning' | 'info';

export interface DocsConsistencyFinding {
  id: string;
  severity: DocsFindingSeverity;
  title: string;
  detail: string;
  path?: string;
  suggestion?: string;
}

export interface DocsConsistencyReport {
  schemaVersion: 'docs-consistency.v1';
  findings: DocsConsistencyFinding[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export function buildDocsConsistencyReport(paths: ProjectPaths, options?: {
  packageRoot?: string;
}): DocsConsistencyReport;
```

### CLI

```bash
spec-manager project docs check
spec-manager project docs check --json
```

Text output 示例：

```text
Docs consistency:
  ✓ README links: ok
  ⚠ package.files: readme_en.md is linked from README.md but not included in package.json files
    fix: add "readme_en.md" to package.json files
  ℹ generated assets: .agents/ is untracked local output; do not commit unless intentionally vendoring it
```

Exit code：

- `0`：无 error。
- `1`：存在 error。
- warning/info 不阻塞默认 exit code。

## 检查规则

| ID | Severity | 检查 |
|---|---|---|
| `docs.readme.primary.missing` | error | 缺少 `README.md` |
| `docs.readme.english-link.missing` | warning | 中文 README 未链接 `readme_en.md` |
| `docs.readme.english-target.missing` | error | README 链接英文文档但文件不存在 |
| `docs.readme.backlink.missing` | warning | `readme_en.md` 未链接回 `README.md` |
| `docs.package.files.missing-linked-doc` | warning | README 链接的公开文档未进入 `package.json.files` |
| `docs.skill.guidance.missing` | warning | `skill/SKILL.md` 缺少关键 workflow/design guidance 关键词 |
| `docs.agent-template.guidance.missing` | warning | `templates/agents/*` 缺少关键 guidance |
| `docs.generated-assets.untracked` | info | `.agents/` 等生成资产存在但未跟踪，提示提交边界 |
| `docs.release-notes.inline-risk` | info | 文档提示 release notes 中反引号应使用 notes-file |

第一版先覆盖确定性静态检查，不检查外部链接可达性，不访问网络。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/docs-consistency.ts` | 新增 docs consistency report core |
| `src/cli/project.ts` | 增加 `project docs check` 子命令 |
| `src/core/__tests__/docs-consistency.test.ts` | 新增 core 测试 |
| `src/cli/__tests__/project-docs.test.ts` | 新增 CLI 输出/exit 测试 |
| `README.md` / `readme_en.md` | 说明发布前 docs check |
| `skill/SKILL.md` / `templates/agents/codebuddy-skill/SKILL.md` | 补充 docs check guidance |

## L3 裂变计划

| L3 | 标题 | 范围 |
|---|---|---|
| `workflow-usability-hardening-L3.2.1` | Docs Consistency Core and CLI | 新增 `buildDocsConsistencyReport`、`project docs check`、README/package/skill/template checks |
| `workflow-usability-hardening-L3.2.2` | Generated Agent Asset Boundary Guidance | 增强 generated asset 边界报告、doctor/agents guidance、文档说明 |

## 验证策略

| 场景 | 验证 |
|---|---|
| README 英文链接缺失 | core test 输出 warning |
| 英文目标缺失 | core test 输出 error，CLI exit 1 |
| package files 漏公开文档 | core test 输出 warning |
| skill/template 缺 guidance | core test 输出 warning |
| `.agents/` 未跟踪存在 | core test 输出 info |
| CLI JSON | CLI test 校验 schemaVersion 和 summary |
| 全量回归 | `npm test`、`npm run lint`、`npm run build` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 检查过于武断 | 第一版 warning/info 为主，仅缺核心文件使用 error |
| package files 规则误判 private 项目 | 只在存在 `package.json.files` 时检查 |
| guidance 关键词检查过浅 | 使用稳定关键词集，作为 warning 而非 blocking |
| 与 project doctor 重叠 | docs check 专注文档/发布资产；doctor 可后续展示 docs check 摘要 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | workflow-usability-hardening-L1 | 承接 PRD |
| references | spec-manager-ai-ux-L1 | 文档与 Agent 使用体验 |
| references | lifecycle-guidance-sync-L1 | 分发资产一致性 |
