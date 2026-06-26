---
code: design-context-L2.2
level: L2
title: Design Context Schema Lint Enhancement
topic: design-context
parentCode: design-context-L1
status: implemented
aiSummary: >-
  技术设计：在既有 DESIGN.md 重构主题下继续完善 schema lint，补齐 token
  group、颜色、尺寸、typography、component 属性和引用目标类型检查。
relations:
  - type: references
    target: design-context-L2.1
  - type: references
    target: design-context-L3.1.3
  - type: based_on
    target: design-context-L1
  - type: references
    target: design-context-L2.1
  - type: references
    target: design-context-L3.1.1
  - type: references
    target: design-context-L3.1.3
created: '2026-06-26T08:02:02.543Z'
updated: '2026-06-26T08:29:50.002Z'
changeSummary: 'cascade: task-complete'
---
# Design Context Schema Lint Enhancement — 技术设计

## 方案概述

本方案基于 `design-context-L2.1`，继续归入 `design-context-L1` 的重构主题，不另起大型 L1。第二段能力聚焦 schema lint 增强：让 DESIGN.md lint 更接近格式规范中的 token schema 约束，使错误更早、更结构化地暴露给 Agent 和 task evidence。

目标：

- 增强 `src/core/design-context.ts` 的 schema lint，覆盖第一版尚未验证的 token 类型和 component 属性。
- 保持 spec-manager 原生、本地、无外部 CLI/runtime 依赖。
- 保持 warning 默认不阻塞，error 通过既有 `design-lint(DESIGN.md)` verification 产生非 0 结果。
- 不在本 L2 引入 diff/export、Tailwind/DTCG 转换、自动 UI 生成或外部 package shell-out。

非目标：

- 不复制外部 DESIGN.md CLI 架构。
- 不实现完整 CSS Color 4 解析器；第一段增强只做可维护子集和明确 warning。
- 不改变 Agent Brief 的触发条件。
- 不改变 task complete 的 governed/standard 判定模型。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 范围 | 先补 schema lint，不做 diff/export | 当前缺口最直接影响 `design-lint` evidence 质量，且可在现有 API 内完成 |
| API | 保持 `DesignContextReport` 不变 | brief、verify、测试和第三方使用者无需迁移 |
| 颜色解析 | 支持常用子集，复杂 CSS 函数 warning-pass | 避免引入大型 CSS parser，同时不错误阻塞现代颜色语法 |
| component 未知属性 | warning | 保留未知内容，符合 “unknown content preserve” 的消费策略 |
| 引用目标 | 多数引用必须指向 primitive；component typography 可引用 composite | 对齐 DESIGN.md token reference 语义，同时支持 component 场景 |

## 受影响模块

| 模块 | 影响 | 说明 |
|---|---|---|
| `src/core/design-context.ts` | 修改 | 增加 schema lint 内部函数，覆盖 token group、颜色、尺寸、typography、component 属性和引用目标类型 |
| `src/core/__tests__/design-context.test.ts` | 修改 | 增加 valid/invalid schema fixture |
| `src/core/__tests__/verify.test.ts` | 修改 | 确认 invalid schema 会让 `design-lint(DESIGN.md)` verification 失败 |
| `src/cli/__tests__/capability.test.ts` 或 brief 测试 | 可选修改 | 如新增 finding 文案影响 brief 展示，补充截断/展示断言 |
| README / skill docs | `design-context-L3.2.2` | 需要时补充常见 schema lint 示例 |

## 接口契约

公共 API 保持不变：

```ts
export function buildDesignContextReport(input: BuildDesignContextInput): DesignContextReport;
export function isDesignRelevantRequest(request: string): boolean;
```

在 `design-context.ts` 内部增加 schema lint 组合函数：

```ts
function lintDesignTokenSchema(rawTokens: Record<string, unknown>): DesignContextFinding[];
```

`buildDesignContextReport` 在 YAML parse 成功后追加 schema findings：

1. `lintTokenGroups`
2. `lintColorTokens`
3. `lintDimensionTokens`
4. `lintTypographyTokens`
5. `lintComponentTokens`
6. `lintTokenRefs` 的 primitive/composite 约束增强

严重度策略：

| 场景 | severity | 理由 |
|---|---|---|
| token group 类型不是 object | error | 无法可靠消费 |
| color 明显不是支持格式 | error | 设计 token 值不可用 |
| dimension 明显不是 number 或 `px/em/rem` 字符串 | error | spacing/rounded 无法可靠消费 |
| typography token 不是 object | error | composite token 结构错误 |
| typography 缺少 `fontFamily` 或 `fontSize` | warning | 可读性差，但不一定不可用 |
| typography 属性类型错误 | error | 值不可用 |
| component token 不是 object | error | component token 结构错误 |
| component property 未知 | warning | 接受未知内容但提示 |
| component 引用 typography composite | pass | component 允许引用 composite typography |
| 非 component 引用 composite group | error | 多数 token reference 应指向 primitive |

第一版支持的值规则：

| 类型 | 支持范围 |
|---|---|
| Color | `#RGB`/`#RGBA`/`#RRGGBB`/`#RRGGBBAA`、`rgb()`/`rgba()`、`hsl()`/`hsla()`、常见 named colors、`transparent`、`currentColor`、CSS wide-gamut/mix 函数 warning-pass |
| Dimension | number；或以 `px`、`em`、`rem` 结尾的字符串 |
| Typography | object；`fontFamily` string；`fontSize` dimension；`fontWeight` number/string；`lineHeight` number/dimension；`letterSpacing` dimension；`fontFeature`/`fontVariation` string |
| Component property | `backgroundColor`、`textColor`、`typography`、`rounded`、`padding`、`size`、`height`、`width` |

## L3 裂变计划

| L3 | 标题 | 范围 | 关键验收 |
|---|---|---|---|
| `design-context-L3.2.1` | Design Token Schema Lint | colors、spacing、rounded、typography、components schema lint；reference primitive/composite 约束；单元测试 | invalid token value 产生结构化 finding，valid DESIGN.md 不回归 |
| `design-context-L3.2.2` | Design Lint Diagnostics UX | CLI/text brief 和 verification message 中优化 schema finding 呈现、文档补充常见 lint 例子 | Agent/用户能快速定位 schema lint 错误 |

## 兼容性与迁移

- 公共 `DesignContextReport` 结构保持不变。
- 新增 findings 可能让之前仅 warning 的 DESIGN.md 出现 error；这只在用户显式使用 `design-lint` verification 时阻塞。
- 没有 `DESIGN.md` 的项目行为不变。

## 验证策略

| 场景 | 验证方式 |
|---|---|
| Schema lint | `src/core/__tests__/design-context.test.ts` fixture 单元测试 |
| Verify rule | `src/core/__tests__/verify.test.ts` 覆盖 invalid schema 导致 `design-lint(DESIGN.md)` 失败 |
| Brief/CLI 展示 | `src/cli/__tests__/capability.test.ts` 或 brief 测试覆盖 finding 展示上限 |
| 全量回归 | `npm test`、`npm run lint` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| CSS color 支持过宽导致实现膨胀 | 明确第一版支持子集，复杂函数 warning-pass，不引入外部解析器 |
| 新 lint 过于严格影响已有 DESIGN.md | 仅明显不可消费值为 error，未知 component property 为 warning |
| `design-context.ts` 变大 | 先保持单模块，若超过可读阈值再在后续 L3 拆 `design-context-lint.ts` |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L1 | 继续归入 DESIGN.md 重构主题 |
| references | design-context-L2.1 | 复用第一段设计上下文架构 |
| references | design-context-L3.1.1 | 扩展 core parser/lint |
| references | design-context-L3.1.3 | 保持 design-lint verification 语义 |
