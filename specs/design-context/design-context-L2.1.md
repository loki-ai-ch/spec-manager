---
code: design-context-L2.1
level: L2
title: DESIGN.md 设计上下文技术设计
topic: design-context
parentCode: design-context-L1
status: implemented
aiSummary: >-
  技术设计：将 DESIGN.md 重写为 spec-manager 原生 design-context 能力，拆分为 core
  parser/lint/summary、Agent Brief 注入、design-lint verification/evidence、文档引导四个
  L3。
relations:
  - type: based_on
    target: design-context-L1
  - type: references
    target: ai-capability-compensation-L2.1
  - type: references
    target: harness-coding-L2.1
  - type: references
    target: constraint-closed-loop-L2.1
created: '2026-06-26T02:32:58.501Z'
updated: '2026-06-26T02:47:53.961Z'
changeSummary: 'cascade: task-complete'
---
# DESIGN.md 设计上下文技术设计

## 方案概述

本方案将 `/Users/loki/code/github/design.md` 的核心思想重写为 spec-manager 原生能力：以项目根目录的 `DESIGN.md` 作为可选设计上下文事实源，提供纯本地的解析、lint、摘要与 verification 投影。第一版不直接依赖外部 `design.md` CLI，不引入 Bun runtime，不做自动 UI 改写，也不把 Tailwind/DTCG export 纳入主路径。

整体分为三层：

1. **Design Context Core**：新增设计上下文 core 模块，负责发现 `DESIGN.md`、解析 YAML frontmatter 与 Markdown H2 section、构建设计 token/prose 摘要、返回结构化 lint findings。
2. **Assist Brief Projection**：扩展 Agent Brief 数据模型和 presenter，在 UI/视觉相关请求且存在 `DESIGN.md` 时注入设计上下文摘要，并将 `DESIGN.md` 加入 suggested reads/source refs。
3. **Verification/Evidence Bridge**：新增 design lint verification 能力，使 L3/Task 可以声明或记录 DESIGN.md lint 结果，并让现有 task evidence/acceptance report 读取该 verification。

第一版的设计重点是“上下文可读 + 证据可追溯”。lint 结果进入结构化 JSON，brief 摘要面向 agent 阅读，是否阻塞 task complete 仍由 L3 critical AC 与 workflow profile 决定。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 集成方式 | 重写最小核心能力，不直接 shell out 外部 CLI | 保持 spec-manager 本地、可测试、无额外 runtime 的边界 |
| 命名 | 使用 `design-context` / `visual context` 语义 | 避免与 L2 Design 技术设计概念混淆 |
| 文件来源 | 默认只发现项目根目录 `DESIGN.md`，CLI 可显式传 path | 简化第一版范围，同时保留测试和多文件扩展空间 |
| lint 严重度 | 保留 error/warning/info summary，warning 默认不阻塞 | 与现有 evidence/profile 门禁解耦，避免视觉 warning 过度阻塞 |
| brief 注入 | 请求意图触发 + 文件存在触发，可通过 CLI 参数后续扩展 | 降低非 UI 任务噪音，同时满足 UI 任务自动带上下文 |

## 受影响模块

| 模块 | 影响 | 说明 |
|---|---|---|
| `src/core/design-context.ts` | 新增 | DESIGN.md 发现、解析、lint、摘要投影 |
| `src/core/capability-types.ts` | 修改 | `AgentBrief` 增加可选 `designContext` 或专用 source ref 字段 |
| `src/core/capability-brief.ts` | 修改 | 在 build brief 时按请求意图和 DESIGN.md 存在性注入设计上下文 |
| `src/cli/capability.ts` | 修改 | brief 文本/JSON presenter 展示设计上下文摘要 |
| `src/core/verify.ts` | 修改 | 增加 `design-lint(path)` verify rule 或等价 design verification bridge |
| `src/core/task-evidence.ts` / acceptance report | 兼容修改 | 沿用 `TaskVerificationRecord`，无需改变 coverage 算法，只确保 design lint verification 可展示 |
| `src/index.ts` | 修改 | 导出 design-context core API，便于测试和第三方使用 |
| `src/core/__tests__` / `src/cli/__tests__` | 新增/修改 | 覆盖 parser/lint/brief/verify/evidence 场景 |
| README / skill docs | 后续 L3 | 增加 DESIGN.md 使用说明和范围边界 |

## 接口契约

### Core 数据结构

新增设计上下文报告类型，保持 JSON 可序列化：

```ts
export type DesignFindingSeverity = 'error' | 'warning' | 'info';

export interface DesignContextFinding {
  severity: DesignFindingSeverity;
  path?: string;
  message: string;
}

export interface DesignContextSummary {
  name: string | null;
  description: string | null;
  sections: string[];
  tokenCounts: {
    colors: number;
    typography: number;
    spacing: number;
    rounded: number;
    components: number;
  };
  proseSummary: string[];
  tokenSummary: string[];
}

export interface DesignContextReport {
  schemaVersion: 'design-context.v1';
  path: string;
  exists: boolean;
  summary: DesignContextSummary | null;
  findings: DesignContextFinding[];
  result: {
    errors: number;
    warnings: number;
    infos: number;
  };
}
```

### Core 函数

```ts
export interface BuildDesignContextInput {
  paths: ProjectPaths;
  filePath?: string;
}

export function buildDesignContextReport(input: BuildDesignContextInput): DesignContextReport;
export function isDesignRelevantRequest(request: string): boolean;
```

设计上下文解析规则：

- 支持 YAML frontmatter `---`。
- 支持 Markdown H2 sections，优先识别 `Overview`、`Colors`、`Typography`、`Layout`、`Components`、`Do's and Don'ts` 及常见别名。
- 支持 token groups：`colors`、`typography`、`spacing`、`rounded`、`components`。
- 支持 `{colors.primary}` 形式的简单 token reference 检查。
- 第一版不要求完整 CSS color parser 覆盖所有 CSS Color 4 语法；hex、rgb/hsl 函数和 named color 可作为 L3 范围拆分。

### Agent Brief 契约

`AgentBrief` 增加可选字段：

```ts
designContext?: DesignContextReport;
```

注入条件：

- `DESIGN.md` 存在；并且
- `request` 命中 UI/视觉/样式关键词，或后续 CLI 显式参数要求注入。

文本 presenter 输出：

- 文件路径
- 设计名称/描述
- prose summary
- token counts
- lint summary
- 最多 5 条 warning/error finding

JSON presenter 保留完整 `DesignContextReport`。

### Verification 契约

扩展 `@verify` 支持：

```md
@verify: design-lint(DESIGN.md)
```

执行结果语义：

- 文件不存在：exit 非 0，message 指出 `DESIGN.md not found`。
- lint errors > 0：exit 非 0，message 包含 error/warning/info summary。
- lint errors = 0：exit 0，warning/info 作为 message 摘要保留。

Task verification 仍使用现有 `TaskVerificationRecord`，`layer` 可继续使用现有 verification layer；L3 可通过 `coversAc` 将该 verification 绑定到 AC。

## L3 裂变计划

| L3 | 标题 | 范围 | 关键验收 |
|---|---|---|---|
| `design-context-L3.1.1-core` | DESIGN.md Core Parser and Lint | 新增 core 模块、数据结构、解析/lint/summary、公共导出和单元测试 | 覆盖 valid、missing file、missing YAML、broken ref、section summary |
| `design-context-L3.1.2-brief` | Agent Brief Design Context Projection | 扩展 AgentBrief 类型、brief builder、text/json presenter、CLI 测试 | UI 请求 + DESIGN.md 存在时 brief 输出设计上下文和 source ref |
| `design-context-L3.1.3-evidence` | Design Lint Verification and Evidence | 扩展 `@verify` design-lint、verification 输出、task evidence/acceptance 兼容测试 | design-lint 可作为 task verification 覆盖 AC，并被 evidence/acceptance 展示 |
| `design-context-L3.1.4-docs` | Documentation and Usage Guidance | README/skill/docs 更新，说明范围边界、命令示例和不做项 | 用户能按文档创建 DESIGN.md 并在 brief/task 中使用 |

## 兼容性与迁移

- 无需迁移既有 specs/tasks。
- 没有 `DESIGN.md` 的项目保持当前行为，brief 不新增噪音。
- 现有 `@verify: command(...)` 保持可用；`design-lint` 是新增类型。
- 不改变 task complete 的 governed/standard 判定；design lint 是否成为阻塞项由 L3 critical AC 与 verification exit code 决定。

## 验证策略

| 场景 | 验证方式 |
|---|---|
| Core parser/lint | `src/core/__tests__/design-context.test.ts` fixture 单元测试 |
| Brief 注入 | `src/core/__tests__/capability.test.ts` 或新增 brief 测试 |
| CLI presenter | `src/cli/__tests__/capability.test.ts` JSON/text 输出断言 |
| Verify rule | `src/core/__tests__/verify.test.ts` 覆盖 `design-lint(DESIGN.md)` |
| Evidence 串联 | 构造 task verification 覆盖 AC，断言 task evidence/acceptance 包含记录 |
| 全量回归 | `npm test`、`npm run lint` |

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| CSS color 解析范围过宽 | 重写成本膨胀 | L3.1.1 明确第一版支持子集，复杂颜色作为 warning 或后续增强 |
| Brief 输出过长 | 干扰 agent 阅读 | 限制 prose/token/finding 展示数量，JSON 保留完整数据 |
| Verification 类型膨胀 | `verify.ts` 变成通用执行器 | 只新增 design-lint 一个类型；复杂策略放到 design-context core |
| 外部代码许可证 | 合规风险 | 重写实现；如引用算法或文本，保留 Apache-2.0 attribution |

## 关联

- based_on: `design-context-L1`
- references: `ai-capability-compensation-L2.1`
- references: `harness-coding-L2.1`
- references: `constraint-closed-loop-L2.1`
