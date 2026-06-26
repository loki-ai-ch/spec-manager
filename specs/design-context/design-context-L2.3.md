---
code: design-context-L2.3
level: L2
title: Design Context Diff and Drift
topic: design-context
parentCode: design-context-L1
status: implemented
aiSummary: >-
  技术设计：继续 DESIGN.md 重构融合，新增 Design Context diff/drift 能力，用本地 before/after 比较生成
  token、section 和 lint delta，后续接 verification/docs。
relations:
  - type: based_on
    target: design-context-L1
  - type: references
    target: design-context-L2.1
  - type: references
    target: design-context-L2.2
created: '2026-06-26T08:52:57.106Z'
updated: '2026-06-26T12:52:18.566Z'
changeSummary: 'cascade: task-complete'
---
# Design Context Diff and Drift — 技术设计

## 方案概述

本方案基于 `design-context-L1`，继续归入 DESIGN.md 重构融合主题。`design-context-L2.1` 和 `design-context-L2.2` 已完成读取、lint、brief、verification 和 schema diagnostics。本方案补充 review 场景：比较两个 DESIGN.md 状态，生成 token/prose/finding 变化摘要，让设计上下文变更可以被 Agent 和人审查。

目标：

- 新增原生 Design Context diff report，用于比较 before/after 两个 DESIGN.md 文件。
- 覆盖 token group added/removed/modified、section/prose added/removed/modified、lint summary delta。
- 将 diff report 接入 CLI/assist 或 verification 的一个小入口，便于 review 和 task evidence 使用。
- 保持本地、无网络、无外部 DESIGN.md CLI runtime 依赖。

非目标：

- 不实现 Tailwind/DTCG/export。
- 不实现自动修复 DESIGN.md。
- 不把 diff 作为默认 task complete 门禁；是否阻塞由 L3 verification 和 profile 决定。
- 不做语义级自然语言相似度判断；prose 第一版按 section 内容 hash/string 比较。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| diff 层级 | core API 先行，再接 CLI/verify | 复用现有 parser/lint，降低实现风险 |
| 输入 | before/after 显式路径 | 避免猜测 git 基线，保持 deterministic |
| token 比较 | 对 token group 做 JSON-stable value 比较 | 简单、可测试、足以发现 review 变化 |
| prose 比较 | 按 H2 section heading + content 比较 | 保留 DESIGN.md prose 作为一等上下文 |
| regression | after errors/warnings 大于 before 或 removed token 非空时标记 | 为 review 提供 conservative signal，不强制门禁 |

## 受影响模块

| 模块 | 影响 | 说明 |
|---|---|---|
| `src/core/design-context.ts` | 修改或拆分 | 暴露 diff report API，复用 DESIGN.md parse/lint/summary |
| `src/core/__tests__/design-context.test.ts` | 修改 | 覆盖 token/prose/finding delta |
| `src/core/verify.ts` | 可选修改 | 增加 `design-diff(before, after)` verify rule |
| `src/core/__tests__/verify.test.ts` | 可选修改 | 覆盖 diff regression verification |
| `src/cli/capability.ts` | 可选修改 | 增加 assist text/json 展示或后续 command |
| README / skill docs | 后续 L3 | 补充 review 用法 |

## 接口契约

新增 core 类型：

```ts
export interface DesignContextDiffSet {
  added: string[];
  removed: string[];
  modified: string[];
}

export interface DesignContextDiffReport {
  schemaVersion: 'design-context-diff.v1';
  before: DesignContextReport;
  after: DesignContextReport;
  tokens: Record<'colors' | 'typography' | 'spacing' | 'rounded' | 'components', DesignContextDiffSet>;
  sections: DesignContextDiffSet;
  findings: {
    before: DesignContextReport['result'];
    after: DesignContextReport['result'];
    delta: {
      errors: number;
      warnings: number;
      infos: number;
    };
  };
  regression: boolean;
}
```

新增 core API：

```ts
export interface BuildDesignContextDiffInput {
  paths: ProjectPaths;
  beforePath: string;
  afterPath: string;
}

export function buildDesignContextDiffReport(input: BuildDesignContextDiffInput): DesignContextDiffReport;
```

可选 verification contract：

```md
@verify: design-diff(DESIGN.before.md, DESIGN.md)
```

执行语义：

- before 或 after 不存在：fail。
- after lint errors > before lint errors：fail。
- after lint warnings > before lint warnings：fail。
- removed token 非空：fail。
- 其他 added/modified 作为 passed message 摘要。

## L3 裂变计划

| L3 | 标题 | 范围 | 关键验收 |
|---|---|---|---|
| `design-context-L3.3.1` | Design Context Diff Core | 新增 diff report API、token/prose/finding delta、公共导出和 core 测试 | 两个 DESIGN.md 文件可生成稳定 JSON diff |
| `design-context-L3.3.2` | Design Diff Verification and Docs | 增加 `design-diff(before, after)` verification、测试和 README/skill 文档 | diff regression 可作为 verification evidence |

## 兼容性与迁移

- 现有 `buildDesignContextReport` 和 `design-lint` 行为不变。
- 无 DESIGN.md diff 使用者的项目行为不变。
- Diff API 新增导出，不改变现有 JSON contract。

## 验证策略

| 场景 | 验证方式 |
|---|---|
| Token diff | `src/core/__tests__/design-context.test.ts` 覆盖 added/removed/modified |
| Prose diff | section content 修改/新增/删除测试 |
| Finding delta | before/after lint summary delta 测试 |
| Verification | `src/core/__tests__/verify.test.ts` 覆盖 `design-diff` |
| 全量回归 | `npm test`、`npm run lint` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| diff 被误解为语义评审 | 文档明确第一版是结构/value diff，不判断美学质量 |
| removed token 过严 | 只在 `design-diff` verification 中阻塞，core diff 仅报告 |
| design-context.ts 继续变大 | L3 可视实际情况拆 `design-context-diff.ts`，但公共导出保持稳定 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L1 | 继续归入 DESIGN.md 重构主题 |
| references | design-context-L2.1 | 复用 design-context core |
| references | design-context-L2.2 | 复用 schema lint findings |
