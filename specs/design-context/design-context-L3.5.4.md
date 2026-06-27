---
code: design-context-L3.5.4
level: L3
title: Design Philosophy Brief Guidance
topic: design-context
parentCode: design-context-L2.5
status: implemented
aiSummary: >-
  实施规格：将 DESIGN.md prose-first 哲学注入 Agent Brief / critique / docs，作为非门禁
  guidance。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      上下文收集: 读取
      design-context-L3.5.4、design-context-L2.5、PHILOSOPHY.md、brief/critique/CLI/tests
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/capability-types.ts 增加 designGuidance 类型
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/capability-brief.ts 注入 Design Guidance
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 渲染 brief text guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/core/spec-critic.ts 增加 design philosophy advisory
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/core/__tests__/capability-brief.test.ts 增加 guidance tests
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      编辑 src/cli/__tests__/capability.test.ts 与
      src/core/__tests__/spec-critic.test.ts 增加 CLI/critic tests
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 编辑 README/readme_zh/skill docs 补充 guidance 文档
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: '验证: targeted tests + npm test + npm run lint'
    status: pending
relations:
  - type: based_on
    target: design-context-L2.5
  - type: references
    target: design-context-L3.5.1
  - type: references
    target: design-context-L3.5.3
  - type: references
    target: design-context-L2.2
created: '2026-06-27T01:49:44.374Z'
updated: '2026-06-27T08:41:23.369Z'
changeSummary: 'cascade: task-complete'
---
# Design Philosophy Brief Guidance — 实施规格

## 背景

`design-context-L2.5` 的第四条 parity 路线要求把 `/Users/loki/code/github/design.md/PHILOSOPHY.md` 的 prose-first 设计思想融入 spec-manager。`design-context-L3.5.1`、`design-context-L3.5.2`、`design-context-L3.5.3` 已补齐 lint parity、Tailwind export 和 fixture conformance；当前 `buildAgentBrief` 只在 UI/visual/style 请求中附带 `designContext` report 和 DESIGN.md suggested read，但没有明确提醒 agent：DESIGN.md 的核心不是 token 值，而是 prose、具体参照、negative constraints 和 domain-specific sections。

本实施规格只做非门禁 guidance：将设计哲学以稳定 JSON 字段和 CLI 文本形式注入 Agent Brief，并补充 critic/docs 说明。它不把哲学原则变成 hard lint error，也不要求模型判断视觉质量。

## 目标

- 在 `AgentBrief` 中新增稳定的 `designGuidance?: string[]` 字段，只在 design-relevant request 且 `DESIGN.md` 存在时输出。
- guidance 内容覆盖 prose-first、specific inspiration、negative constraints / do-don't、unknown sections may carry design intent。
- CLI `assist brief` 文本输出最多 4 条 Design Guidance，紧跟 Design Context，便于 agent 开工前阅读。
- `assist critique` 对涉及 UI/visual/style/design-context 的实施或设计规格给出 advisory，提醒规格应说明如何使用 DESIGN.md prose / do-don't。
- README、readme_zh、skill 和 codebuddy skill 同步说明 Design Philosophy Guidance 的使用边界。

## 范围

### 做

- 修改 `src/core/capability-types.ts`，给 `AgentBrief` 增加可选 `designGuidance?: string[]`。
- 修改 `src/core/capability-brief.ts`，在 design-relevant request 且 DESIGN.md exists 时生成固定 guidance。
- 修改 `src/cli/capability.ts`，在 brief text 输出 `Design Guidance:`，最多 4 条。
- 修改 `src/core/spec-critic.ts`，对 UI/design-context 相关设计或实施规格增加 advisory finding；该 finding 只提醒补充 prose-first / do-don't 使用方式，不阻塞确认。
- 增加 core/CLI tests，覆盖 JSON brief、text brief、非视觉请求不输出 guidance、critique advisory。
- 更新文档，说明 guidance 是非门禁建议，不替代 DESIGN.md lint，也不要求外部 DESIGN.md CLI。

### 不做

- 不新增 lint error/warning 来机械评价 prose 质量。
- 不调用外部 `/Users/loki/code/github/design.md` 或 `@google/design.md` CLI。
- 不改变 `DesignContextReport` schemaVersion。
- 不自动生成或重写 DESIGN.md 内容。
- 不要求 task complete 因 guidance 缺失而失败。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/capability-types.ts` | 新增 `AgentBrief.designGuidance?: string[]` |
| `src/core/capability-brief.ts` | 新增 guidance 生成逻辑 |
| `src/cli/capability.ts` | brief text 渲染 guidance |
| `src/core/spec-critic.ts` | UI/design spec advisory |
| `src/core/__tests__/capability-brief.test.ts` | core brief contract tests |
| `src/cli/__tests__/capability.test.ts` | CLI brief/critique output tests |
| `src/core/__tests__/spec-critic.test.ts` | critique advisory tests |
| README / readme_zh / skill docs | 文档同步 |

## 实施步骤

1. **上下文收集**：读取 `design-context-L3.5.4`、`design-context-L2.5`、PHILOSOPHY.md、brief/critique/CLI/tests 现状。

   ```json
   {"summary":"完成 Design Philosophy Guidance 上下文收集","files":["specs/design-context/design-context-L3.5.4.md","specs/design-context/design-context-L2.5.md","/Users/loki/code/github/design.md/PHILOSOPHY.md","src/core/capability-brief.ts","src/core/spec-critic.ts","src/cli/capability.ts"]}
   ```

2. **扩展 brief 类型契约**：在 `AgentBrief` 增加 `designGuidance?: string[]`。

   ```json
   {"summary":"扩展 AgentBrief designGuidance 类型契约","files":["src/core/capability-types.ts"]}
   ```

3. **实现 guidance 生成**：在 `buildAgentBrief` 中基于 design relevance 和 DESIGN.md exists 注入固定 guidance。

   ```json
   {"summary":"实现 Agent Brief Design Guidance 注入","files":["src/core/capability-brief.ts"]}
   ```

4. **渲染 CLI brief 文本**：在 `renderBriefText` 中输出 Design Guidance，最多 4 条。

   ```json
   {"summary":"渲染 brief text Design Guidance","files":["src/cli/capability.ts"]}
   ```

5. **增加 critic advisory**：在 `buildSpecCritique` 对 UI/design-context 相关设计或实施规格增加非阻塞 design philosophy finding。

   ```json
   {"summary":"增加 design philosophy spec critique advisory","files":["src/core/spec-critic.ts"]}
   ```

6. **补 core tests**：覆盖 visual request guidance、non-visual request 无 guidance、guidance 条数和内容稳定。

   ```json
   {"summary":"补充 capability brief guidance core tests","files":["src/core/__tests__/capability-brief.test.ts"]}
   ```

7. **补 CLI/critic tests**：覆盖 brief JSON/text 输出和 critique advisory。

   ```json
   {"summary":"补充 CLI brief 和 spec critique guidance tests","files":["src/cli/__tests__/capability.test.ts","src/core/__tests__/spec-critic.test.ts"]}
   ```

8. **更新文档**：说明 Design Philosophy Guidance 是非门禁 agent guidance。

   ```json
   {"summary":"补充 Design Philosophy Guidance 文档","files":["README.md","readme_zh.md","skill/SKILL.md","templates/agents/codebuddy-skill/SKILL.md"]}
   ```

9. **验证**：运行定向测试、全量测试和 lint。

   ```json
   {"summary":"完成 Design Philosophy Brief Guidance 验证","commands":["npm test -- --run src/core/__tests__/capability-brief.test.ts src/core/__tests__/spec-critic.test.ts src/cli/__tests__/capability.test.ts","npm test","npm run lint"]}
   ```

## 关键验收标准

1. **AC-1**: **Given** 一个存在 DESIGN.md 的 UI/visual/style request，**When** 调用 `buildAgentBrief`，**Then** brief **SHALL** 包含 `designGuidance` 且至少包含 prose-first、specific reference、negative constraints 三类 guidance。
   - @verify: command(npm test -- --run src/core/__tests__/capability-brief.test.ts)
2. **AC-2**: **Given** 一个非视觉 request 或不存在 DESIGN.md，**When** 调用 `buildAgentBrief`，**Then** brief **SHALL NOT** 输出 `designGuidance`。
   - @verify: command(npm test -- --run src/core/__tests__/capability-brief.test.ts)
3. **AC-3**: **Given** `spec-manager assist brief` 文本输出，**When** 请求命中 UI/visual/style 且 DESIGN.md 存在，**Then** CLI **SHALL** 输出 `Design Guidance:` 和最多 4 条 guidance。
   - @verify: command(npm test -- --run src/cli/__tests__/capability.test.ts)
4. **AC-4**: **Given** UI/design-context 相关设计或实施规格，**When** 运行 `assist critique`，**Then** critique **SHALL** 返回非阻塞 advisory，提醒补充 DESIGN.md prose / do-don't 使用方式。
   - @verify: command(npm test -- --run src/core/__tests__/spec-critic.test.ts src/cli/__tests__/capability.test.ts)
5. **AC-5**: **Given** 本实施完成，**When** 运行全量验证，**Then** `npm test` 与 `npm run lint` **MUST** 通过。
   - @verify: command(npm test)
   - @verify: command(npm run lint)

## 验证命令

```bash
npm test -- --run src/core/__tests__/capability-brief.test.ts src/core/__tests__/spec-critic.test.ts src/cli/__tests__/capability.test.ts
npm test
npm run lint
```

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| guidance 输出变成噪音 | 只在 design-relevant request 且 DESIGN.md 存在时输出，并限制 4 条 |
| JSON contract 破坏旧消费者 | 新字段 optional，不改变 schemaVersion 和既有字段 |
| critique advisory 被误解成 gate | severity 使用 `advisory`，文档明确非门禁 |
| guidance 与 lint 责任混淆 | 文档说明 guidance 指导 agent 阅读 prose，lint 仍负责结构/token 事实检查 |
| 过度复制 PHILOSOPHY.md 文案 | 使用短句概括，不长篇嵌入源文档 |

## 回滚计划

若 guidance 被证明干扰 agent brief：

1. 保留类型字段 optional，先移除 CLI 文本渲染。
2. 将 `buildAgentBrief` 中 guidance 生成降级为 empty/undefined。
3. 保留 docs 中 DESIGN.md prose-first 边界说明，避免破坏已有 lint/export/diff 能力。

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L2.5 | 实现 Design Philosophy Guidance 路线 |
| references | design-context-L3.5.1 | lint findings 与 guidance 都服务于 agent 开工前设计理解 |
| references | design-context-L3.5.3 | conformance fixtures 覆盖真实 prose 样本 |
| references | design-context-L2.2 | brief guidance 依赖 design context schema/lint 基础 |

## planJson (final)

```json
{
  "version": 1,
  "coveredSpecs": ["design-context-L3.5.4"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 design-context-L3.5.4、design-context-L2.5、PHILOSOPHY.md、brief/critique/CLI/tests"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/capability-types.ts 增加 designGuidance 类型"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/capability-brief.ts 注入 Design Guidance"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/cli/capability.ts 渲染 brief text guidance"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/core/spec-critic.ts 增加 design philosophy advisory"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/core/__tests__/capability-brief.test.ts 增加 guidance tests"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/capability.test.ts 与 src/core/__tests__/spec-critic.test.ts 增加 CLI/critic tests"},
    {"stepNo": 8, "stepType": "tool_action", "name": "编辑 README/readme_zh/skill docs 补充 guidance 文档"},
    {"stepNo": 9, "stepType": "tool_action", "name": "验证: targeted tests + npm test + npm run lint"}
  ]
}
```
