---
code: design-context-L2.4
level: L2
title: Design Context Export and Templates
topic: design-context
parentCode: design-context-L1
status: implemented
aiSummary: >-
  技术设计：继续 DESIGN.md Phase 4，新增本地 design-context token export 与 starter
  template，第一版支持 tokens-json、DTCG 子集和后续 CLI/docs 裂变。
relations:
  - type: based_on
    target: design-context-L1
  - type: references
    target: design-context-L2.1
  - type: references
    target: design-context-L2.2
  - type: references
    target: design-context-L2.3
created: '2026-06-26T13:13:24.524Z'
updated: '2026-06-26T13:29:07.892Z'
changeSummary: 'cascade: task-complete'
---
# Design Context Export and Templates — 技术设计

## 方案概述

本方案基于 `design-context-L1` 的 Phase 4，将已落地的 DESIGN.md parser、schema lint、brief、verification 和 diff 能力继续补成可复用的设计上下文工具链：提供本地 token export 与 starter template，让团队可以从同一个 `DESIGN.md` 同时服务 agent 上下文、review evidence 和前端实现工具。

目标：

- 新增 Design Context export core API，将 `DESIGN.md` tokens 输出为稳定 JSON。
- 第一版支持两个轻量目标：
  - `tokens-json`：保留 spec-manager 内部 token group shape 的规范化 JSON。
  - `dtcg-json`：输出 Design Tokens Community Group 风格的 `$type` / `$value` JSON 子集。
- 新增 DESIGN.md starter template 生成能力，给 UI 项目提供最小可 lint 的起始文件。
- 将 export/template 能力接入一个小 CLI 入口或 assist 子能力，便于用户无需外部 `design.md` CLI 即可使用。
- 保持 `buildDesignContextReport`、`buildDesignContextDiffReport`、`design-lint`、`design-diff` 行为不变。

非目标：

- 不实现 Tailwind v3/v4 config 自动写入。
- 不实现 CSS variables、Style Dictionary package、Figma tokens 或设计工具同步。
- 不做自动修复 DESIGN.md。
- 不把 export 作为 task complete 默认门禁。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| export 层级 | core API 先行，CLI 后接 | 复用现有 parser/lint，保持可测试 |
| 输入 | 显式 DESIGN.md path，默认根目录 DESIGN.md | 与现有 report/diff contract 一致 |
| 输出 | 返回结构化 object，由 CLI 决定写文件或 stdout | core 保持纯函数风格，方便测试 |
| DTCG 范围 | colors/spacing/rounded/typography/components 的最小 token 子集 | 覆盖当前 schema，不承诺完整规范 |
| 模板 | 内置最小 DESIGN.md markdown + YAML | 让新项目快速获得 valid lint baseline |

## 受影响模块

| 模块 | 影响 | 说明 |
|---|---|---|
| `src/core/design-context.ts` 或新 `src/core/design-context-export.ts` | 新增 | export report、DTCG mapper、starter template |
| `src/core/__tests__/design-context.test.ts` 或新测试文件 | 新增/修改 | 覆盖 export 稳定性与 template lint |
| `src/cli` assist/capability 命令 | 可选修改 | 提供 `spec-manager assist design-export` 或等价入口 |
| `src/cli/__tests__` | 可选修改 | 覆盖 CLI stdout/file 输出 |
| README / readme_zh / skill docs | 修改 | 补充 template/export 用法与边界 |

## 接口契约

新增 core 类型：

```ts
export type DesignContextExportFormat = 'tokens-json' | 'dtcg-json';

export interface BuildDesignContextExportInput {
  paths: ProjectPaths;
  filePath?: string;
  format: DesignContextExportFormat;
}

export interface DesignContextExportReport {
  schemaVersion: 'design-context-export.v1';
  source: DesignContextReport;
  format: DesignContextExportFormat;
  output: Record<string, unknown>;
}

export function buildDesignContextExportReport(input: BuildDesignContextExportInput): DesignContextExportReport;
export function buildDesignContextTemplate(): string;
```

CLI 草案：

```bash
spec-manager assist design-export --format tokens-json --path DESIGN.md
spec-manager assist design-export --format dtcg-json --path DESIGN.md --out tokens.dtcg.json
spec-manager assist design-template --out DESIGN.md
```

执行语义：

- `design-export` 在 DESIGN.md 缺失或 lint error > 0 时 exit 非 0。
- warning 不阻塞 export，但 JSON report 或 stderr 应展示 warning count。
- 未提供 `--out` 时输出 JSON 到 stdout；提供 `--out` 时写入项目内路径。
- `design-template` 默认不覆盖已有文件；显式 `--force` 才覆盖。

## L3 裂变计划

| L3 | 标题 | 范围 | 关键验收 |
|---|---|---|---|
| `design-context-L3.4.1` | Design Context Export Core | 新增 export core API、tokens-json、dtcg-json、template builder 和 core tests | 有效 DESIGN.md 可生成稳定 export JSON；template 可通过 lint |
| `design-context-L3.4.2` | Design Export CLI and Docs | 增加 assist/CLI 入口、stdout/out 文件输出、README/readme_zh/skill 文档 | 用户可通过 spec-manager 本地命令导出 tokens 或生成 starter DESIGN.md |

## 兼容性与迁移

- 现有 DESIGN.md parser/lint/diff public API 不变。
- 未使用 export/template 的项目行为不变。
- DTCG 输出第一版标注为 spec-manager 子集；后续扩展不得破坏 `schemaVersion`。
- template 只是起点，不替代项目真实设计系统。

## 验证策略

| 场景 | 验证方式 |
|---|---|
| tokens-json export | 单元测试断言 token groups、排序和 source result |
| dtcg-json export | 单元测试断言 color/dimension/typography 映射 `$type` / `$value` |
| invalid DESIGN.md | 单元测试断言 lint error 阻止 export 或报告 failure |
| template | 单元测试将 template 写入 DESIGN.md 后 `buildDesignContextReport` errors=0 |
| CLI stdout/out | CLI 测试覆盖 stdout JSON 和 out 文件写入 |
| 全量回归 | `npm test`、`npm run lint` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| DTCG 规范覆盖不足 | 文档明确第一版是当前 DESIGN.md schema 的 DTCG 子集 |
| CLI surface 过散 | 先放在 assist 子命令或单一 design command，不新增多组命令 |
| 导出文件覆盖用户数据 | 默认不覆盖；必须显式 `--force` |
| Tailwind 期待过高 | 本 L2 明确不做 Tailwind config 写入，只为后续 L2/L3 预留 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L1 | 继续 Phase 4 P2 能力 |
| references | design-context-L2.1 | 复用 parser/lint/report |
| references | design-context-L2.2 | 复用 schema lint |
| references | design-context-L2.3 | 复用 diff/review 边界说明 |
