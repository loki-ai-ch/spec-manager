---
code: design-context-L3.5.2
level: L3
title: Tailwind Export Parity
topic: design-context
parentCode: design-context-L2.5
status: implemented
aiSummary: >-
  实施规格：补齐 DESIGN.md Tailwind export parity，新增 tailwind-json 与 tailwind-css
  core/CLI/docs/tests。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3.5.2、L2.5、export core/CLI 和相关测试'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 参考源项目 Tailwind v3/v4 emitters
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 扩展 export format contract
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 tailwind-json mapper
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 tailwind-css mapper
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 扩展 design-export CLI
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 core/CLI tests 覆盖 Tailwind export
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 编辑 README/readme_zh/skill docs 补充 Tailwind export
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: '验证: npm test -- --run design-context/capability + npm test + npm run lint'
    status: pending
relations:
  - type: based_on
    target: design-context-L2.5
  - type: references
    target: design-context-L2.4
  - type: references
    target: design-context-L3.4.1
  - type: references
    target: design-context-L3.4.2
created: '2026-06-27T01:06:33.324Z'
updated: '2026-06-27T01:27:26.100Z'
changeSummary: 'cascade: task-complete'
---
# Tailwind Export Parity — 实施规格

## 背景

`design-context-L2.5` 的第二条 parity 路线要求补齐 `/Users/loki/code/github/design.md` 的 Tailwind export 能力。当前 `src/core/design-context.ts` 已支持 `tokens-json` 和 `dtcg-json`，`src/cli/capability.ts` 已提供 `spec-manager assist design-export`，但缺少 Tailwind v3 `theme.extend` JSON 与 Tailwind v4 CSS `@theme` 输出。

本实施规格只覆盖 Tailwind export parity：新增 `tailwind-json` 和 `tailwind-css` 两种 format，让 spec-manager 可以从同一个根目录 `DESIGN.md` 本地导出 Tailwind 可消费的 token 主题。

## 目标

- `buildDesignContextExportReport` 支持 `tailwind-json`，输出 Tailwind v3 风格 `{ theme: { extend } }`。
- `buildDesignContextExportReport` 支持 `tailwind-css`，输出 Tailwind v4 `@theme { ... }` CSS block。
- `spec-manager assist design-export --format tailwind-json|tailwind-css` 可打印或写入导出内容。
- DESIGN.md 缺失或 lint error 仍阻止 export；warning/info 不阻止 export。
- 旧格式 `tokens-json` / `dtcg-json` 兼容不变。

## 范围

### 做

- 扩展 `DesignContextExportFormat`：
  - `tokens-json`
  - `dtcg-json`
  - `tailwind-json`
  - `tailwind-css`
- 在 `src/core/design-context.ts` 中实现 Tailwind v3 mapper：
  - `colors` -> `theme.extend.colors`
  - `typography.<name>.fontFamily` -> `theme.extend.fontFamily.<name>: [fontFamily]`
  - `typography.<name>.fontSize` -> `theme.extend.fontSize.<name>: [fontSize, meta]`
  - `rounded` -> `theme.extend.borderRadius`
  - `spacing` -> `theme.extend.spacing`
- 在 `src/core/design-context.ts` 中实现 Tailwind v4 CSS mapper：
  - colors -> `--color-*`
  - typography font family -> `--font-*`
  - typography font size -> `--text-*`
  - line height -> `--leading-*`
  - letter spacing -> `--tracking-*`
  - font weight -> `--font-weight-*`
  - rounded -> `--radius-*`
  - spacing -> `--spacing-*`
- 在 CLI 中支持新 format；`tailwind-css` 无 `--json` 且无 `--out` 时直接输出 CSS 文本，`--out` 写 CSS 文本。
- 增加 core tests 与 CLI tests。
- 更新 README、readme_zh、skill docs、codebuddy skill docs。

### 不做

- 不自动修改 `tailwind.config.js` 或项目 CSS 文件。
- 不生成 Tailwind plugin、preset 或 npm package。
- 不支持完整 CSS Color Level 4 转换；沿用现有 lint/export 的 token 原值策略。
- 不依赖外部 `@google/design.md` CLI 或 Tailwind package。
- 不改变 task completion / verification 状态机。

## 复用清单

| 现有代码 | 复用方式 |
|---|---|
| `src/core/design-context.ts` | 复用 parser、lint、export report、stableNormalize、token group helpers |
| `src/cli/capability.ts` | 扩展 `assist design-export` format parsing、stdout/out 写入逻辑 |
| `src/core/__tests__/design-context.test.ts` | 增加 Tailwind export core tests |
| `src/cli/__tests__/capability.test.ts` | 增加 Tailwind export CLI stdout/out tests |
| README / readme_zh / skill docs | 同步新 format 用法与边界 |
| `/Users/loki/code/github/design.md/packages/cli/src/linter/tailwind/*` | 行为参考，不作为运行时依赖 |

## 实施步骤

1. **上下文收集**：读取 `design-context-L3.5.2`、`design-context-L2.5`、`src/core/design-context.ts`、`src/cli/capability.ts`、相关 tests。

   ```json
   {"summary":"完成 L3.5.2 父设计、现有 export core/CLI 和测试上下文收集","files":["specs/design-context/design-context-L3.5.2.md","specs/design-context/design-context-L2.5.md","src/core/design-context.ts","src/cli/capability.ts","src/core/__tests__/design-context.test.ts","src/cli/__tests__/capability.test.ts"]}
   ```

2. **参考源项目 Tailwind emitters**：读取源项目 Tailwind v3 handler、Tailwind v4 handler/serializer/tests。

   ```json
   {"summary":"完成源 design.md Tailwind v3/v4 export 行为参考调查","files":["/Users/loki/code/github/design.md/packages/cli/src/linter/tailwind/handler.ts","/Users/loki/code/github/design.md/packages/cli/src/linter/tailwind/v4/handler.ts","/Users/loki/code/github/design.md/packages/cli/src/linter/tailwind/v4/serialize.ts"]}
   ```

3. **扩展 core export contract**：编辑 `src/core/design-context.ts`，扩展 `DesignContextExportFormat` 与 export output handling，确保旧 format 不变。

   ```json
   {"summary":"扩展 Design Context export format contract","files":["src/core/design-context.ts"]}
   ```

4. **实现 Tailwind v3 JSON mapper**：实现 `tailwind-json` output，覆盖 colors、fontFamily、fontSize、borderRadius、spacing。

   ```json
   {"summary":"实现 tailwind-json export mapper","files":["src/core/design-context.ts"]}
   ```

5. **实现 Tailwind v4 CSS mapper**：实现 `tailwind-css` output 与 CSS `@theme` serializer，保持 category 输出顺序稳定。

   ```json
   {"summary":"实现 tailwind-css export mapper and serializer","files":["src/core/design-context.ts"]}
   ```

6. **扩展 CLI**：编辑 `src/cli/capability.ts`，支持新 format、CSS stdout、CSS out 文件写入和 JSON report 输出。

   ```json
   {"summary":"扩展 assist design-export CLI 支持 tailwind-json 和 tailwind-css","files":["src/cli/capability.ts"]}
   ```

7. **补测试**：编辑 core/CLI tests，覆盖 `tailwind-json`、`tailwind-css`、`--out` 写 CSS、invalid format。

   ```json
   {"summary":"增加 Tailwind export core and CLI tests","files":["src/core/__tests__/design-context.test.ts","src/cli/__tests__/capability.test.ts"]}
   ```

8. **补文档**：更新 README、readme_zh、skill docs 和 codebuddy skill docs，说明新 format 与不自动写 Tailwind config 的边界。

   ```json
   {"summary":"补充 Tailwind export docs and agent guidance","files":["README.md","readme_zh.md","skill/SKILL.md","templates/agents/codebuddy-skill/SKILL.md"]}
   ```

9. **验证**：运行定向测试、全量测试和 lint。

   ```json
   {"summary":"完成 Tailwind Export Parity 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts src/cli/__tests__/capability.test.ts","npm test","npm run lint"]}
   ```

## 关键验收标准

1. **AC-1**: **Given** 有效 DESIGN.md 含 colors、typography、spacing、rounded，**When** 执行 `buildDesignContextExportReport(..., format: 'tailwind-json')`，**Then** output **SHALL** 包含 Tailwind v3 `theme.extend` 中对应的 colors/fontFamily/fontSize/borderRadius/spacing。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
2. **AC-2**: **Given** 有效 DESIGN.md 含同一组 tokens，**When** 执行 `buildDesignContextExportReport(..., format: 'tailwind-css')`，**Then** output **SHALL** 包含稳定 `@theme` CSS block 和正确 variable prefixes。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
3. **AC-3**: **Given** 用户执行 `spec-manager assist design-export --format tailwind-json|tailwind-css`，**When** DESIGN.md 有效，**Then** CLI **SHALL** 输出对应格式；当提供 `--out` 时 **SHALL** 写入项目内文件。
   - @verify: command(npm test -- --run src/cli/__tests__/capability.test.ts)
4. **AC-4**: **Given** DESIGN.md 缺失或存在 lint error，**When** 执行任一 Tailwind export，**Then** CLI **MUST** 非 0 退出且不写出成功内容。
   - @verify: command(npm test -- --run src/cli/__tests__/capability.test.ts)
5. **AC-5**: **Given** 本实施完成，**When** 运行全量验证，**Then** `npm test` 与 `npm run lint` **MUST** 通过。
   - @verify: command(npm test)
   - @verify: command(npm run lint)

## 验证命令

```bash
npm test -- --run src/core/__tests__/design-context.test.ts src/cli/__tests__/capability.test.ts
npm test
npm run lint
```

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| CSS output 与 JSON report 混用导致 CLI 行为混乱 | 定义 `tailwind-css` 默认 stdout/out 为 CSS 文本，`--json` 输出完整 report |
| Tailwind v4 token name 不适合 CSS variable | 第一版不新增硬 error，保持原 token name；后续 conformance L3 可加更严格 lint |
| typography metadata 丢失 | v3 fontSize tuple 带 lineHeight/letterSpacing/fontWeight，v4 输出 sibling CSS variables |
| 旧 format 回归 | 保留原 tests，并新增旧格式断言不变 |
| 文档让用户误以为会自动改配置 | README/skill 明确只导出 tokens，不写项目配置 |

## 回滚计划

若 Tailwind export 引入回归：

1. 从 `parseDesignExportFormat` 移除 `tailwind-json` / `tailwind-css`。
2. 保留 core helper 但不暴露 CLI，恢复旧格式可用。
3. 回退新增文档和测试，再拆分更小规格重做。

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.5 | 实现 Export Parity 路线 |
| references | design-context-L2.4 | 延展 export/template 能力 |
| references | design-context-L3.4.1 | 复用 export core contract |
| references | design-context-L3.4.2 | 复用 export CLI/docs |

## planJson (final)

```json
{
  "version": 1,
  "coveredSpecs": ["design-context-L3.5.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3.5.2、L2.5、export core/CLI 和相关测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "参考源项目 Tailwind v3/v4 emitters"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 扩展 export format contract"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 tailwind-json mapper"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 tailwind-css mapper"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/cli/capability.ts 扩展 design-export CLI"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 core/CLI tests 覆盖 Tailwind export"},
    {"stepNo": 8, "stepType": "tool_action", "name": "编辑 README/readme_zh/skill docs 补充 Tailwind export"},
    {"stepNo": 9, "stepType": "tool_action", "name": "验证: npm test -- --run design-context/capability + npm test + npm run lint"}
  ]
}
```
