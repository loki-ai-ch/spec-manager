---
code: design-context-L2.5
level: L2
title: Design.md Parity Completion
topic: design-context
parentCode: design-context-L1
status: implemented
aiSummary: >-
  技术设计：补齐 design.md 四条 parity 路线，包括 lint parity、Tailwind export、fixtures
  conformance 和 prose-first brief guidance。
relations:
  - type: references
    target: design-context-L2.2
  - type: references
    target: design-context-L2.4
  - type: references
    target: design-context-L2.2
  - type: based_on
    target: design-context-L1
  - type: references
    target: design-context-L2.3
created: '2026-06-26T13:52:52.892Z'
updated: '2026-06-27T01:02:39.908Z'
changeSummary: 'cascade: task-complete'
---
# Design.md Parity Completion — 技术设计

## 方案概述

本方案继续 `design-context-L1` 的后续增强阶段，将 `/Users/loki/code/github/design.md` 中尚未被 spec-manager 原生吸收的关键能力补齐为四条可独立实施的 parity 方向：

1. **Lint Parity**：补齐源项目 linter 的设计系统规则，使 `design-lint` 从结构/schema 子集升级为更接近 DESIGN.md 专用 linter 的事实检查。
2. **Export Parity**：在现有 `tokens-json` / `dtcg-json` 基础上补齐 Tailwind v3 JSON 与 Tailwind v4 CSS `@theme` 导出。
3. **Spec/Fixture Parity**：引入源项目 examples/fixtures 作为 conformance fixtures，建立 spec-manager 自身的 DESIGN.md 兼容性回归集。
4. **Design Philosophy Guidance**：把源项目 `PHILOSOPHY.md` 的 prose-first、specific source-of-inspiration、negative constraints 等原则投影到 Agent Brief / critic 文案，让 DESIGN.md 不只被当成 token 文件。

本轮仍保持 spec-manager 的原生融合边界：不把外部 `@google/design.md` CLI 作为运行时硬依赖，不引入 Bun workspace，不自动改 UI 代码，不生成视觉截图判断。实现以 TypeScript core API、assist CLI、verify/evidence 和文档为主。

## 背景与代码调查

已落地能力：

- `src/core/design-context.ts` 已支持 DESIGN.md frontmatter + H2 section 解析、schema lint、token reference lint、summary、diff、`tokens-json` / `dtcg-json` export 和 starter template。
- `src/core/verify.ts` 已支持 `@verify: design-lint(DESIGN.md)` 与 `@verify: design-diff(before, after)`。
- `src/core/capability-brief.ts` / `src/cli/capability.ts` 已在设计相关请求中注入 Design Context。
- README、readme_zh、skill 分发文档已说明当前边界。

源项目仍未完全吸收的能力：

- Lint rules：`contrast-ratio`、`missing-primary`、`orphaned-tokens`、`token-summary`、`missing-sections`、`missing-typography`、`unknown-key`、`token-like-ignored`、fixer/preEvaluate。
- Export：Tailwind v3 `theme.extend` JSON、Tailwind v4 CSS `@theme`、更完整 DTCG emitter。
- Spec/fixtures：`docs/spec.md`、`spec-config.yaml`、examples 和 linter fixtures。
- Philosophy：`PHILOSOPHY.md` 强调 prose 是设计核心、具体参照优于泛化形容词、负约束应与具体风格参照配合。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 运行时依赖 | 继续重写为 spec-manager 原生 core，不依赖外部 CLI | 遵守 `design-context-L1` 的“无需外部 design.md CLI”边界 |
| Parity 范围 | 按四个实施规格垂直切片推进 | 每个方向可独立测试、review、回滚 |
| Lint 实现 | 扩展现有 `DesignContextFinding`，保留 severity/result contract | 避免破坏 `design-lint` / brief / evidence 消费者 |
| Color/contrast | 先实现 hex/rgb/hsl/named 的可测子集；现代色彩函数保留 warning | spec-manager 不引入复杂颜色引擎，先覆盖主流 DESIGN.md token |
| Export 命名 | 新增 `tailwind-json`、`tailwind-css` format，保留旧 format | 避免与外部 CLI 名称完全绑定，同时语义清晰 |
| Fixture 来源 | 复制必要 examples/fixtures 的最小集合并记录来源 | 避免测试依赖仓库外路径 |
| Philosophy 投影 | 进入 brief/critic/doc，不作为硬 lint error | 设计哲学更适合指导 agent，而非机械门禁 |

## 受影响模块

| 模块 | 影响 | 说明 |
|---|---|---|
| `src/core/design-context.ts` | 修改 | 增加 parity lint rules、Tailwind export mapper、guidance 数据投影 |
| `src/core/verify.ts` | 修改 | 保持 `design-lint` / `design-diff` 消费新 warning/result 的行为稳定 |
| `src/core/capability-brief.ts` | 修改 | 注入 prose-first guidance 与更完整 design context 摘要 |
| `src/core/capability-types.ts` | 可选修改 | 若后续实施规格选择显式 `designContext.guidance` 字段，则扩展 Agent Brief 类型 |
| `src/cli/capability.ts` | 修改 | 增加 `design-export` format、text brief guidance 输出 |
| `src/core/__tests__` | 修改/新增 | 增加 lint parity、export parity、fixture conformance、brief guidance 测试 |
| `src/cli/__tests__` | 修改 | 覆盖 CLI export format 与 text 输出 |
| `README.md` / `readme_zh.md` / `skill/SKILL.md` | 修改 | 更新 parity 能力、Tailwind export、设计哲学使用方式 |
| `templates/agents/codebuddy-skill/SKILL.md` | 修改 | 同步分发版 agent guidance |

## L3 裂变计划

| L3 | 标题 | 范围 | 关键验收 |
|---|---|---|---|
| `design-context-L3.5.1` | Design Lint Parity Rules | 补齐 missing-primary、missing-typography、missing-sections、orphaned-tokens、unknown-key、token-summary、token-like-ignored、contrast-ratio 子集 | `design-lint` 对源项目代表性 fixture 输出结构化 findings；错误/警告语义稳定 |
| `design-context-L3.5.2` | Tailwind Export Parity | 新增 Tailwind v3 JSON 与 Tailwind v4 CSS export core + CLI + docs | `assist design-export --format tailwind-json/tailwind-css` 可输出稳定主题 |
| `design-context-L3.5.3` | Design Spec Fixtures and Conformance | 引入 examples/fixtures、conformance 测试和 README 说明 | 全量测试覆盖 valid/invalid/examples，防止后续 parser/lint drift |
| `design-context-L3.5.4` | Design Philosophy Brief Guidance | 将 prose-first 原则注入 Agent Brief / critic / skill docs | UI 请求的 brief 能提醒 agent 先读设计 prose、具体参照和 do/don't |

## 接口契约

### Lint Parity

保持现有 report shape：

```ts
export interface DesignContextReport {
  schemaVersion: 'design-context.v1';
  path: string;
  exists: boolean;
  summary: DesignContextSummary | null;
  findings: DesignContextFinding[];
  result: { errors: number; warnings: number; infos: number };
}
```

新增 findings 使用稳定 path：

- `colors`
- `typography`
- `sections`
- `components.<name>`
- `tokens.<group>`
- `unknown.<key>`

warning 不阻塞 `design-lint`，error 继续阻塞。

### Export Parity

扩展 export format：

```ts
export type DesignContextExportFormat =
  | 'tokens-json'
  | 'dtcg-json'
  | 'tailwind-json'
  | 'tailwind-css';
```

CLI：

```bash
spec-manager assist design-export --format tailwind-json --path DESIGN.md
spec-manager assist design-export --format tailwind-css --path DESIGN.md --out theme.css
```

`tailwind-json` 输出：

```json
{
  "theme": {
    "extend": {
      "colors": {},
      "fontFamily": {},
      "fontSize": {},
      "borderRadius": {},
      "spacing": {}
    }
  }
}
```

`tailwind-css` 输出 Tailwind v4 `@theme` block。CSS output 是字符串；若继续沿用 `DesignContextExportReport.output: Record<string, unknown>`，则以 `{ "css": "..." }` 包装，CLI 无 `--json` 时可直接打印 CSS。

### Fixture/Conformance

新增测试 fixtures 目录建议：

```text
src/core/__tests__/fixtures/design-context/
  examples/
  invalid/
  parity/
```

fixtures 应只复制必要样本，避免把外部项目整体 vendoring 进仓库。

### Philosophy Guidance

Brief 中新增非门禁 guidance：

- DESIGN.md prose is primary context; tokens support prose.
- Prefer specific source-of-inspiration descriptions over generic adjectives.
- Respect negative constraints and do/don't lists.
- Unknown sections may carry domain-specific design intent.

JSON brief 可增加 `designContext.guidance?: string[]`，text brief 展示最多 4 条。若保持 contract 更保守，则先将 guidance 放入 `findings` 或 `suggestedReads` 附加说明；后续实施规格决定最终 shape。

## 兼容性

- 现有 `buildDesignContextReport`、`buildDesignContextDiffReport`、`buildDesignContextExportReport` 调用方保持兼容。
- 旧 format `tokens-json` / `dtcg-json` 不改输出语义。
- 新 lint warning 可能增加 `design-lint` 的 warning count，但不会阻塞 task complete，除非后续 governed AC 明确要求 warning 为 0。
- `design-diff` 当前对 warning 增量判 regression；新增 lint warning 后，需要在 `design-context-L3.5.1` 同步更新相关测试，确保 intentional warning 增量行为清晰。

## 验证策略

| 场景 | 验证 |
|---|---|
| Lint parity | `npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts` |
| Export parity | `npm test -- --run src/core/__tests__/design-context.test.ts src/cli/__tests__/capability.test.ts` |
| Fixture conformance | 新增 fixture-driven tests，覆盖源项目 examples 和 invalid cases |
| Brief guidance | `npm test -- --run src/core/__tests__/capability-brief.test.ts src/cli/__tests__/capability.test.ts` |
| 全量回归 | `npm test`、`npm run lint` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Lint warning 变多导致 diff regression 更敏感 | `design-context-L3.5.1` 明确 baseline fixture，并更新 diff 文档 |
| Contrast 颜色解析不完整 | 第一版只声明支持可解析子集，现代 CSS 函数保持 warning/info |
| Tailwind export 被误解为完整 Tailwind 配置生成 | 文档说明只输出 theme tokens，不修改项目配置 |
| 复制源项目 fixture 带来维护负担 | 只引入小集合，并在文件头/README 注明来源和用途 |
| Philosophy guidance 变成模板化噪音 | 仅在 design-relevant request 且 DESIGN.md 存在时展示，限制条数 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L1 | 继续 DESIGN.md 融合主线 |
| references | design-context-L2.2 | 延展 schema/lint 诊断 |
| references | design-context-L2.3 | diff regression 依赖 lint result |
| references | design-context-L2.4 | export/template 后续增强 |
