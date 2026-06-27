---
code: design-context-L3.5.3
level: L3
title: Design Spec Fixtures and Conformance
topic: design-context
parentCode: design-context-L2.5
status: implemented
aiSummary: >-
  实施规格：引入 DESIGN.md examples/fixtures 最小集合，建立 parser/lint/export/diff
  conformance 回归测试与文档说明。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3.5.3、L2.5、当前 tests 和源 fixtures'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 选择 fixture 最小子集
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 新增 fixture 目录和 README
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 复制 valid DESIGN.md conformance fixtures
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 invalid/parity fixtures
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/design-context.test.ts 增加 fixture helpers
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 src/core/__tests__/design-context.test.ts 增加 conformance tests
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 编辑 README/readme_zh/skill docs 补充 fixture conformance 说明
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: '验证: npm test -- --run design-context + npm test + npm run lint'
    status: pending
relations:
  - type: based_on
    target: design-context-L2.5
  - type: references
    target: design-context-L3.5.1
  - type: references
    target: design-context-L3.5.2
  - type: references
    target: design-context-L3.4.1
created: '2026-06-27T01:28:57.170Z'
updated: '2026-06-27T01:43:03.604Z'
changeSummary: 'cascade: task-complete'
---
# Design Spec Fixtures and Conformance — 实施规格

## 背景

`design-context-L2.5` 的第三条 parity 路线要求引入 `/Users/loki/code/github/design.md` 的 examples/fixtures，建立 spec-manager 自身的 DESIGN.md conformance 回归集。当前 `src/core/__tests__/design-context.test.ts` 主要使用内联字符串 fixture，已经覆盖 parser、schema lint、diff、export、template、Tailwind export；但缺少来自源项目的真实样本和格式契约样本，后续 parser/lint/export 演进时容易出现 drift。

本实施规格只覆盖 fixture 与 conformance 测试建设：复制必要样本到 spec-manager 测试目录，增加 fixture-driven tests，并在 README/skill 中说明这些 fixtures 的定位。目标不是把源项目完整 vendoring 进仓库，而是建立小而稳定的兼容回归集。

## 目标

- 在 spec-manager 仓库内新增最小 DESIGN.md fixture 集，覆盖 valid examples、invalid lint cases、export conformance cases。
- 新增 fixture-driven tests，验证 `buildDesignContextReport`、`buildDesignContextExportReport`、`buildDesignContextDiffReport` 对这些样本稳定。
- fixture 文件应带来源说明，便于后续维护与更新。
- 保持运行时零外部依赖；测试不依赖 `/Users/loki/code/github/design.md` 的存在。

## 范围

### 做

- 新增测试 fixture 目录，例如：

```text
src/core/__tests__/fixtures/design-context/
  examples/
  invalid/
  parity/
  README.md
```

- 从源项目复制小集合样本：
  - examples: `paws-and-paths/DESIGN.md`、`atmospheric-glass/DESIGN.md`、`totality-festival/DESIGN.md`。
  - linter valid fixtures: `HERITAGE.md`、`ALPINE_OBSERVATORY.md`。
  - invalid fixtures: `NO_FRONTMATTER.md`、`OUT_OF_ORDER.md`，以及一个 broken ref / bad schema 的本地 parity fixture。
- 新增 fixture-driven tests：
  - valid examples: report exists、errors=0、summary/tokenCounts 合理。
  - invalid examples: missing frontmatter / section order 等 finding 稳定。
  - export examples: at least one fixture 可导出 `tokens-json`、`dtcg-json`、`tailwind-json`、`tailwind-css`。
  - diff conformance: 用两个小 fixture 验证 token added/removed/modified 和 section modified。
- 更新 README/readme_zh 或 docs 小节，说明 conformance fixtures 只用于测试，不代表完整外部 spec 复制。

### 不做

- 不复制源项目整个仓库、Bun workspace、npm package 或所有 tests。
- 不把 `/Users/loki/code/github/design.md` 作为测试运行时依赖。
- 不引入外部 `@google/design.md` CLI。
- 不新增 snapshot 巨型金文件；测试应断言关键字段，避免脆弱。
- 不改变 runtime parser/export 行为，除非 fixture 暴露必须修复的兼容 bug；若需要修 runtime，应在 task step 中明确记录。

## 复用清单

| 现有代码 | 复用方式 |
|---|---|
| `src/core/design-context.ts` | 作为 fixture conformance 的被测 parser/lint/export/diff |
| `src/core/__tests__/design-context.test.ts` | 增加 fixture-driven describe block 或拆出新 test file |
| `src/core/__tests__/project-fixture.ts` | 复用临时 project root 写入 fixture |
| `/Users/loki/code/github/design.md/examples/*/DESIGN.md` | 复制小集合 valid examples |
| `/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures/*.md` | 复制小集合 valid/invalid linter fixtures |
| README / readme_zh / skill docs | 补充 conformance fixture 说明 |

## 实施步骤

1. **上下文收集**：读取 `design-context-L3.5.3`、`design-context-L2.5`、当前 design-context tests、源项目 examples/fixtures 列表。

   ```json
   {"summary":"完成 L3.5.3 父设计、当前 tests 和源 DESIGN.md fixtures 上下文收集","files":["specs/design-context/design-context-L3.5.3.md","specs/design-context/design-context-L2.5.md","src/core/__tests__/design-context.test.ts","/Users/loki/code/github/design.md/examples","/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures"]}
   ```

2. **选择 fixture 子集**：确认复制清单和命名，避免引入不必要的大文件或源项目构建产物。

   ```json
   {"summary":"确定 conformance fixture 最小子集","files":["/Users/loki/code/github/design.md/examples/paws-and-paths/DESIGN.md","/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures/HERITAGE.md"]}
   ```

3. **新增 fixture 目录和 README**：创建 `src/core/__tests__/fixtures/design-context/README.md`，记录来源和维护规则。

   ```json
   {"summary":"新增 Design Context conformance fixture 目录说明","files":["src/core/__tests__/fixtures/design-context/README.md"]}
   ```

4. **复制 valid example fixtures**：复制选定 examples 和 linter valid fixtures 到仓库内测试 fixture 目录。

   ```json
   {"summary":"复制 valid DESIGN.md conformance fixtures","files":["src/core/__tests__/fixtures/design-context/examples","src/core/__tests__/fixtures/design-context/parity"]}
   ```

5. **新增 invalid/parity fixtures**：复制或创建 missing frontmatter、out-of-order、broken ref、bad schema fixtures。

   ```json
   {"summary":"新增 invalid DESIGN.md conformance fixtures","files":["src/core/__tests__/fixtures/design-context/invalid"]}
   ```

6. **增加 fixture test helpers**：在 `src/core/__tests__/design-context.test.ts` 或新文件中新增读取 fixture helper、copy-to-project helper。

   ```json
   {"summary":"增加 fixture-driven test helpers","files":["src/core/__tests__/design-context.test.ts"]}
   ```

7. **增加 conformance tests**：覆盖 valid examples、invalid findings、export formats、diff fixture。

   ```json
   {"summary":"增加 Design Context fixture conformance tests","files":["src/core/__tests__/design-context.test.ts"]}
   ```

8. **补文档**：更新 README/readme_zh/skill docs，说明 conformance fixtures 的用途和边界。

   ```json
   {"summary":"补充 Design Context conformance fixture 文档","files":["README.md","readme_zh.md","skill/SKILL.md","templates/agents/codebuddy-skill/SKILL.md"]}
   ```

9. **验证**：运行定向测试、全量测试和 lint。

   ```json
   {"summary":"完成 Design Spec Fixtures and Conformance 验证","commands":["npm test -- --run src/core/__tests__/design-context.test.ts","npm test","npm run lint"]}
   ```

## 关键验收标准

1. **AC-1**: **Given** 仓库内 conformance fixture 目录，**When** 用户或 agent 查看 fixture README，**Then** README **SHALL** 说明来源、选择原则和不依赖外部仓库的维护方式。
   - @verify: file-exists(src/core/__tests__/fixtures/design-context/README.md)
2. **AC-2**: **Given** 选定 valid DESIGN.md fixtures，**When** 运行 design-context core tests，**Then** parser/lint **SHALL** 对这些 fixtures 返回 exists=true 且 errors=0。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
3. **AC-3**: **Given** invalid/parity fixtures，**When** 运行 design-context core tests，**Then** tests **SHALL** 断言 missing frontmatter、section order、broken ref 或 bad schema findings 的 severity/path/message 稳定。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
4. **AC-4**: **Given** 至少一个 valid fixture，**When** 运行 export conformance tests，**Then** `tokens-json`、`dtcg-json`、`tailwind-json`、`tailwind-css` **SHALL** 都能输出关键字段。
   - @verify: command(npm test -- --run src/core/__tests__/design-context.test.ts)
5. **AC-5**: **Given** 本实施完成，**When** 运行全量验证，**Then** `npm test` 与 `npm run lint` **MUST** 通过。
   - @verify: command(npm test)
   - @verify: command(npm run lint)

## 验证命令

```bash
npm test -- --run src/core/__tests__/design-context.test.ts
npm test
npm run lint
```

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| fixture 文件过大导致测试维护成本高 | 只复制小集合，避免完整 vendoring |
| 源项目 fixture 包含当前 parser 不支持的 alpha 特性 | 先将该 fixture 放入 parity/known-warning，并断言实际稳定行为 |
| 测试对 warning/info 数量过脆弱 | 优先断言关键 path/message，不盲目断言总数 |
| 后续源项目更新导致 fixture drift | README 记录来源和手动更新方式 |
| 复制内容许可证/归属不清 | fixture README 标注源路径和仅测试用途 |

## 回滚计划

若 fixture conformance 引入不稳定：

1. 保留 fixture README，移除造成不稳定的单个 fixture。
2. 将对应测试改为更小的本地 parity fixture。
3. 不回滚 runtime code，除非本 L3 为满足 fixture 修改了 runtime 行为且被证明有误。

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.5 | 实现 Spec/Fixture Parity 路线 |
| references | design-context-L3.5.1 | conformance tests 覆盖新增 lint parity rules |
| references | design-context-L3.5.2 | conformance tests 覆盖 Tailwind export formats |
| references | design-context-L3.4.1 | 复用 export core contract |

## planJson (final)

```json
{
  "version": 1,
  "coveredSpecs": ["design-context-L3.5.3"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3.5.3、L2.5、当前 tests 和源 fixtures"},
    {"stepNo": 2, "stepType": "tool_action", "name": "选择 fixture 最小子集"},
    {"stepNo": 3, "stepType": "tool_action", "name": "新增 fixture 目录和 README"},
    {"stepNo": 4, "stepType": "tool_action", "name": "复制 valid DESIGN.md conformance fixtures"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 invalid/parity fixtures"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/design-context.test.ts 增加 fixture helpers"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 src/core/__tests__/design-context.test.ts 增加 conformance tests"},
    {"stepNo": 8, "stepType": "tool_action", "name": "编辑 README/readme_zh/skill docs 补充 fixture conformance 说明"},
    {"stepNo": 9, "stepType": "tool_action", "name": "验证: npm test -- --run design-context + npm test + npm run lint"}
  ]
}
```
