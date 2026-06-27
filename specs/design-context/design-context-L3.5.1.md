---
code: design-context-L3.5.1
level: L3
title: Design Lint Parity Rules
topic: design-context
parentCode: design-context-L2.5
status: implemented
aiSummary: >-
  实施规格：补齐 DESIGN.md lint parity rules，包括
  missing-primary、missing-typography、missing-sections、orphaned
  tokens、unknown-key、token-like、contrast-ratio 与 verification 回归。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3.5.1、L2.5、design-context core 和相关测试'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 参考源项目 lint rules 行为
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 接入 lint parity pipeline
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 structural parity rules
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/design-context.ts 实现 color usage 与 contrast rules
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/design-context.test.ts 增加 parity lint 测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 src/core/__tests__/verify.test.ts 和必要 diff 测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: '验证: npm test -- --run design-context/verify + npm test + npm run lint'
    status: pending
relations:
  - type: based_on
    target: design-context-L2.5
  - type: references
    target: design-context-L2.2
  - type: references
    target: design-context-L3.2.1
  - type: references
    target: design-context-L3.3.2
created: '2026-06-27T00:44:50.968Z'
updated: '2026-06-27T01:02:39.903Z'
changeSummary: 'cascade: task-complete'
---
# Design Lint Parity Rules — 实施规格

## 背景

`design-context-L2.5` 将 `/Users/loki/code/github/design.md` 的剩余整合拆为四条 parity 路线；本实施规格只覆盖第一条 **Lint Parity**。当前 `src/core/design-context.ts` 已支持 DESIGN.md frontmatter、H2 section、基础 schema、token reference、diff/export/template，但仍缺少源项目 linter 的设计系统规则：missing-primary、missing-typography、missing-sections、orphaned-tokens、token-summary、unknown-key、token-like-ignored、contrast-ratio。

本次目标是把这些规则以 spec-manager 原生方式接入现有 `DesignContextReport.findings`，保持 `schemaVersion: design-context.v1`、`result` 计数和 `design-lint` verification contract 不变。

## 目标

- `DesignContextReport` 能输出 DESIGN.md 专用 parity lint findings，并保持现有 JSON shape 不变。
- `design-lint` 对 warning-only parity findings 继续通过，只在 error 存在时失败。
- `design-diff` 对 warning delta 的 regression 行为保持稳定、可测、可解释。
- 新增 lint parity rules 不依赖外部 CLI 或网络。

## 范围

### 做

- 在 `src/core/design-context.ts` 中新增 lint parity helper，并由 `readDesignContextParts` 调用。
- 新增或增强以下 warning/info 规则：
  - `missing-primary`: colors 存在但没有 `primary`。
  - `missing-typography`: colors 存在但 typography 缺失或为空。
  - `missing-sections`: 存在 tokens 但缺少推荐 section，先覆盖 `Colors`、`Typography`、`Layout`、`Shapes`、`Components` 的 info。
  - `orphaned-tokens`: color token 未被 component 或 prose token ref 使用时 warning。
  - `token-summary`: 输出 token group count 的 info finding。
  - `unknown-key`: 顶层 YAML key 与已知 schema key 近似时 warning，例如 `colours` -> `colors`。
  - `token-like-ignored`: Markdown prose 中出现 `{...}` token-like reference 但无法解析时 info 或 warning。
  - `contrast-ratio`: component 同时声明 `backgroundColor` 和 `textColor` 且能解析到 hex/rgb/named color 时，低于 WCAG AA 4.5:1 warning。
- 在 `src/core/__tests__/design-context.test.ts` 增加单元测试，覆盖每类 parity finding 的 path/message/severity。
- 在 `src/core/__tests__/verify.test.ts` 增加 `design-lint` warning-only parity fixture，确保 warnings 不阻塞 verification。
- 评估并更新现有 diff 测试：新增 warning 会影响 `design-diff` warning delta，测试 fixture 应显式避免无关 warning 或断言 warning delta。

### 不做

- 不实现 fixer/preEvaluate 自动修复。
- 不引入外部 `@google/design.md` CLI、Bun workspace 或源项目运行时依赖。
- 不实现完整 CSS Color Level 4 解析；现代色彩函数继续保留现有 warning 策略。
- 不改变 `DesignContextReport` 公共 JSON shape。
- 不修改 Tailwind/DTCG export；该范围属于后续 `design-context-L3.5.2`。

## 复用清单

| 现有代码 | 复用方式 |
|---|---|
| `src/core/design-context.ts` | 复用 parser、section extraction、token ref collector、schema lint、report/result 聚合 |
| `src/core/verify.ts` | 保持 `design-lint` 仅 error 阻塞的行为 |
| `src/core/__tests__/design-context.test.ts` | 追加 parity lint fixtures |
| `src/core/__tests__/verify.test.ts` | 追加 warning-only verification fixture |
| `/Users/loki/code/github/design.md/packages/cli/src/linter/linter/rules/*` | 作为行为参考，不直接复制运行时依赖 |

## 实施步骤

1. **上下文收集**：读取 `design-context-L3.5.1`、`design-context-L2.5`、`src/core/design-context.ts`、`src/core/__tests__/design-context.test.ts`、`src/core/__tests__/verify.test.ts`。

   ```json
   {"summary":"完成 L3.5.1 父设计与现有 design-context/verify 测试上下文收集","files":["specs/design-context/design-context-L3.5.1.md","specs/design-context/design-context-L2.5.md","src/core/design-context.ts","src/core/__tests__/design-context.test.ts","src/core/__tests__/verify.test.ts"]}
   ```

2. **参考源项目规则**：读取 `/Users/loki/code/github/design.md/packages/cli/src/linter/linter/rules/index.ts`、`contrast-ratio.ts`、`missing-primary.ts`、`missing-typography.ts`、`missing-sections.ts`、`orphaned-tokens.ts`、`unknown-key.ts`、`token-like-ignored.ts`。

   ```json
   {"summary":"完成源 design.md lint rule 行为参考调查","files":["/Users/loki/code/github/design.md/packages/cli/src/linter/linter/rules/index.ts"]}
   ```

3. **扩展 lint pipeline**：在 `src/core/design-context.ts` 中新增 `lintDesignParityRules(rawTokens, sections)`，并在现有 schema/ref lint 后合并 findings。

   ```json
   {"summary":"接入 Design Context lint parity pipeline","files":["src/core/design-context.ts"]}
   ```

4. **实现 structural parity rules**：实现 missing-primary、missing-typography、missing-sections、token-summary、unknown-key、token-like-ignored，确保 path 稳定。

   ```json
   {"summary":"实现 structural lint parity rules","files":["src/core/design-context.ts"]}
   ```

5. **实现 color usage rules**：实现 orphaned-tokens、component color ref/literal 解析、contrast-ratio helper；只对可解析颜色输出 contrast warning。

   ```json
   {"summary":"实现 color usage 与 contrast lint parity rules","files":["src/core/design-context.ts"]}
   ```

6. **补 core tests**：在 `src/core/__tests__/design-context.test.ts` 增加 parity lint 测试，覆盖 missing-primary、missing-typography、missing-sections、orphaned-tokens、unknown-key、token-like-ignored、contrast-ratio、token-summary。

   ```json
   {"summary":"增加 Design Lint Parity core tests","files":["src/core/__tests__/design-context.test.ts"]}
   ```

7. **补 verify/diff 回归测试**：在 `src/core/__tests__/verify.test.ts` 增加 warning-only `design-lint` 测试；如 `design-diff` fixture 因新增 warning 变动，则调整 fixture 或断言。

   ```json
   {"summary":"补充 design-lint warning-only verification 与 diff warning delta 回归测试","files":["src/core/__tests__/verify.test.ts","src/core/__tests__/design-context.test.ts"]}
   ```

8. **验证**：运行定向测试、全量测试和 lint。

   ```json
   {"summary":"完成 Design Lint Parity Rules 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts","npm test","npm run lint"]}
   ```

## 关键验收标准

1. **AC-1**: **Given** DESIGN.md 定义 colors 但缺少 `primary`，**When** 构建 design context report，**Then** report **SHALL** 包含 `missing-primary` 语义 warning，且 `design-lint` verification **SHALL** 通过。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts)
2. **AC-2**: **Given** DESIGN.md component 的 `backgroundColor` / `textColor` 可解析且低于 WCAG AA 4.5:1，**When** 构建 report，**Then** report **SHALL** 包含 contrast warning，path 指向对应 component。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
3. **AC-3**: **Given** DESIGN.md 含有近似 typo 顶层 key、未使用 color token 或 prose 中无法解析的 token-like ref，**When** 构建 report，**Then** report **SHALL** 输出结构化 findings 且不改变 `DesignContextReport` JSON shape。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
4. **AC-4**: **Given** 新增 parity warning，**When** 执行既有 design-diff 与 design-lint verification 测试，**Then** warning-only lint **MUST NOT** 阻塞 `design-lint`，但 warning delta regression 行为 **MUST** 保持明确可测。
   - @verify: command(npm test -- --run src/core/__tests__/verify.test.ts src/core/__tests__/task-complete-verify.test.ts)
5. **AC-5**: **Given** 本实施完成，**When** 运行全量验证，**Then** `npm test` 与 `npm run lint` **MUST** 通过。
   - @verify: command(npm test)
   - @verify: command(npm run lint)

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 新 warning 导致既有测试 result.warnings 断言失败 | 调整测试断言为具体 finding 或补齐 fixture tokens，避免脆弱计数 |
| contrast parser 过度承诺 | 仅解析 hex/rgb/named 的可测子集，现代 CSS 函数不参与 contrast |
| orphaned token 误报 prose 使用 | 统计 component refs 与 Markdown prose `{colors.x}` ref，降低误报 |
| unknown-key 误伤 custom extension | 只对近似已知 schema key warning，不对任意 unknown key warning |
| diff regression 变得更敏感 | 明确测试 warning delta；必要时让 diff fixture 含一致 warning baseline |

## 回滚计划

若新增 parity rules 导致大量误报或下游完成门禁异常：

1. 回滚 `lintDesignParityRules` 调用点，保留 helper 代码不执行。
2. 保持原有 schema/ref lint、`design-lint` 和 `design-diff` 行为。

## 验证命令

```bash
npm test -- --run src/core/__tests__/design-context.test.ts src/core/__tests__/verify.test.ts
npm test -- --run src/core/__tests__/task-complete-verify.test.ts
npm test
npm run lint
```
3. 回退新增测试或改为 pending fixture，再拆更小 L3 重新推进。

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.5 | 实现 Lint Parity 路线 |
| references | design-context-L2.2 | 延展 schema lint |
| references | design-context-L3.2.1 | 复用现有 token schema lint |
| references | design-context-L3.3.2 | 保持 design-diff verification 行为 |

## planJson (final)

```json
{
  "version": 1,
  "coveredSpecs": ["design-context-L3.5.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3.5.1、L2.5、design-context core 和相关测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "参考源项目 lint rules 行为"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 接入 lint parity pipeline"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 structural parity rules"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/design-context.ts 实现 color usage 与 contrast rules"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/design-context.test.ts 增加 parity lint 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 src/core/__tests__/verify.test.ts 和必要 diff 测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证: npm test -- --run design-context/verify + npm test + npm run lint"}
  ]
}
```
