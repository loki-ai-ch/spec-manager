---
code: ai-capability-compensation-L3.1.2-critic
level: L3
title: Spec Critic 分层审查
topic: ai-capability-compensation
parentCode: ai-capability-compensation-L2.1
status: implemented
aiSummary: >-
  实施第二片能力补偿层：新增 assist critique 的 Spec Critic projection，对 L1/L2/L3
  草稿进行分层质量审查，输出 blocking/warning/advisory 和 JSON/text 报告，不改变状态机。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 frozen L3 父 L2 已实现 assist 文件和测试'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/capability-types.ts 新增 SpecCritiqueReport 类型
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/spec-critic.ts 新增 section parser 和分层规则
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/cli/capability.ts 新增 assist critique 命令和 presenter
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 core CLI tests 覆盖 spec critic 和 assist critique
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 README readme_zh 增加 assist critique 示例
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      验证: npm test -- src/core/__tests__/spec-critic.test.ts
      src/cli/__tests__/capability.test.ts
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: >-
      验证: npm run build && npm test && spec-manager spec validate
      ai-capability-compensation-L3.1.2-critic
    status: pending
relations:
  - type: based_on
    target: ai-capability-compensation-L2.1
created: '2026-06-17T04:01:16.213Z'
updated: '2026-06-17T04:15:05.366Z'
changeSummary: 'cascade: task-complete'
---
# Spec Critic 分层审查 — 实施规格

## 背景

`ai-capability-compensation-L2.1` 将 Spec Critic 定义为能力补偿层第二片：在 L1/L2/L3 审核或冻结前，对规格正文进行分层质量审查，帮助较弱模型发现目标、边界、接口、验证、回滚等缺口。

`ai-capability-compensation-L3.1.1` 已实现 `assist brief`、`assist lessons` 和共享 `AssistFinding` / `AssistSourceRef` 类型。本片复用这些共享类型，并新增 `assist critique <specCode>`。

## 目标

1. 提供 `SpecCritiqueReport` JSON/text projection。
2. 对 L1、L2、L3 使用不同审查维度。
3. 将审查结果标记为 `blocking`、`warning` 或 `advisory`。
4. 复用现有 markdown section、spec metadata、validate/readiness 能力，不引入 AI 语义判断。
5. 通过 `spec-manager assist critique <specCode> [--json]` 暴露只读能力。
6. 保持无写入副作用、无状态机变化、无 hard gate。

## 方案概述

新增 `src/core/spec-critic.ts`，读取指定 spec 后按 level 分发到 L1/L2/L3 规则集：

```text
specCode
  -> findSpecByCode
  -> level-specific deterministic checks
  -> SpecCritiqueReport
  -> assist critique text/json presenter
```

本 L3 只覆盖：

- `SpecCritiqueReport` 类型。
- L1/L2/L3 分层 deterministic checks。
- `assist critique <specCode> [--json]` CLI。
- core 与 CLI 测试。

本 L3 不实现 `assist next`、`assist drift`、`assist acceptance`。

## 技术决策

### 决策 1：Critic 是 advisory report，不是 confirm/freeze hard gate

`assist critique` 只输出报告，不阻止 `spec confirm` 或 `task complete`。

理由：

- 首版检查基于 section 和关键文本启发式，不能等同人工判断。
- L2 已明确 assist 默认只读/advisory/report。
- 避免破坏现有生命周期和脚本。

### 决策 2：分层规则显式编码

L1/L2/L3 采用独立规则数组，而不是一套通用字段。

理由：

- L1 关注目标、用户故事、验收、范围。
- L2 关注模块、接口、状态流、兼容性、测试、L3 拆分。
- L3 关注文件级改动、实施步骤、验证命令、回滚和禁止范围。

### 决策 3：首版仅解析 markdown section 与关键词

检查正文标题、表格/列表内容和关键短语，不做自然语言语义判断。

理由：

- 保持本地可复现。
- 避免模型自评。
- 可用 fixture 测试锁定行为。

## 受影响模块

| 模块 | 变更 | 说明 |
|---|---|---|
| `src/core/spec-critic.ts` | 新增 | 分层 Spec Critic projection |
| `src/core/capability-types.ts` | 修改 | 增加 `SpecCritiqueReport` 类型 |
| `src/cli/capability.ts` | 修改 | 注册 `assist critique` 和 presenter |
| `src/core/__tests__/spec-critic.test.ts` | 新增 | L1/L2/L3 core fixture 测试 |
| `src/cli/__tests__/capability.test.ts` | 修改 | critique CLI JSON/text/错误测试 |
| `README.md` / `readme_zh.md` | 可选修改 | 增加 critique 示例 |

## 接口契约

### Core 类型

```ts
export interface SpecCritiqueReport {
  schemaVersion: 'spec-critique.v1';
  specCode: string;
  level: 'L1' | 'L2' | 'L3';
  status: string;
  findings: AssistFinding[];
  summary: {
    blocking: number;
    warning: number;
    advisory: number;
  };
}
```

### CLI 契约

```text
spec-manager assist critique <specCode> [--json]
```

行为：

- spec 不存在：exit 1，输出 `SPEC_NOT_FOUND`。
- 支持 L1/L2/L3；其他 level 返回 warning/advisory 或空结果。
- text 输出稳定标题 `Spec Critique`、spec code、summary、findings。
- JSON 输出 `schemaVersion`、`specCode`、`level`、`status`、`summary`、`findings`。

## 实施步骤

1. 修改 `src/core/capability-types.ts`，增加 `SpecCritiqueReport` 类型。
2. 新增 `src/core/spec-critic.ts`，实现 `buildSpecCritique(paths, specCode)`。
3. 实现 markdown section parser：按 `## heading` 提取 section 名和正文。
4. 实现 L1/L2/L3 规则集。
5. 修改 `src/cli/capability.ts`，增加 `assist critique` 命令和 text presenter。
6. 新增 `src/core/__tests__/spec-critic.test.ts`。
7. 扩展 `src/cli/__tests__/capability.test.ts`。
8. 可选更新 README / readme_zh 的 assist 示例。

## 实现细节

### Section Parser

- 只识别二级标题 `## <title>`。
- 标题 normalize：trim、lowercase、去除全角/半角冒号和多余空白。
- 返回 `Map<string, string>`。
- 不解析嵌套 markdown 语义。

### L1 检查维度

| 规则 | 条件 | severity |
|---|---|---|
| `l1.background.missing` | 缺少 `背景` | blocking |
| `l1.user_stories.missing` | 缺少 `用户故事` | blocking |
| `l1.acceptance.missing` | 缺少 `验收标准` | blocking |
| `l1.scope.missing` | 缺少 `范围边界` | blocking |
| `l1.metrics.missing` | 缺少 `度量指标` | warning |
| `l1.risks.missing` | 缺少 `风险` 或 `风险与依赖` | warning |

### L2 检查维度

| 规则 | 条件 | severity |
|---|---|---|
| `l2.overview.missing` | 缺少 `方案概述` | blocking |
| `l2.decisions.missing` | 缺少 `技术决策` | warning |
| `l2.modules.missing` | 缺少 `受影响模块` | blocking |
| `l2.contracts.missing` | 缺少 `接口契约` | blocking |
| `l2.tests.missing` | 缺少 `测试策略` | warning |
| `l2.split.missing` | 缺少 `L3 裂变计划` | blocking |
| `l2.compat.missing` | 缺少 `兼容性` | warning |

### L3 检查维度

| 规则 | 条件 | severity |
|---|---|---|
| `l3.goals.missing` | 缺少 `目标` | blocking |
| `l3.modules.missing` | 缺少 `受影响模块` | warning |
| `l3.steps.missing` | 缺少 `实施步骤` | blocking |
| `l3.verification.missing` | 缺少 `验证命令` | blocking |
| `l3.rollback.missing` | 缺少 `回滚` 或 `风险与缓解` | warning |
| `l3.scope.advisory` | 未明确“不实现/不包括/禁止范围” | advisory |

### Finding Source

每条 finding 的 `sourceRefs` 至少包含当前 spec：

```ts
{ kind: 'spec', id: specCode, path: spec.filePath, summary: spec.fm.title }
```

### Summary

summary 通过 findings severity 计数生成。

## 验证命令

### Core

```bash
npm test -- src/core/__tests__/spec-critic.test.ts
```

### CLI

```bash
npm test -- src/cli/__tests__/capability.test.ts
```

### 全量回归

```bash
npm test
npm run build
spec-manager spec validate ai-capability-compensation-L3.1.2-critic
```

验收标准：

- L1 缺少必填段时产生 blocking finding。
- L2 缺少 `接口契约` 或 `L3 裂变计划` 时产生 blocking finding。
- L3 缺少 `验证命令` 时产生 blocking finding。
- 完整 spec 返回 summary 全 0 或仅合理 advisory。
- `assist critique <specCode> --json` 输出稳定 schema。
- spec 不存在时 exit 1 且提示 `SPEC_NOT_FOUND`。

## 状态流与门禁

- 本 L3 由用户确认后 `draft -> frozen`。
- 实现必须通过 Agent Task 创建、启动、step、verify、complete。
- `assist critique` 只读，不写 audit/spec/task。
- critique finding 不作为 hard gate，除非未来单独 L3 修改 confirm/freeze 语义。

## L3 裂变计划

| 子切片 | 范围 | 交付 |
|---|---|---|
| types | critique report type | `SpecCritiqueReport` |
| core | section parser + L1/L2/L3 rules | `buildSpecCritique` |
| cli | assist critique | text/json presenter |
| tests | core + CLI fixture | regression coverage |

本次仅实现上述子切片，不扩展到 task next / drift / acceptance。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 形式化检查过浅 | 无法证明 spec 真正高质量 | 明确标 advisory/report，不作为 hard gate |
| 中文/英文标题差异 | 误报缺段 | 规则支持常用中英文标题别名 |
| finding 太多 | 用户难以处理 | 首版只检查高价值维度，按 severity 聚合 |
| 与 spec validate 重复 | 用户困惑 | validate 保持规则/格式检查，critique 聚焦能力补偿质量缺口 |

## 关联

- based_on: `ai-capability-compensation-L2.1`
- references: `ai-capability-compensation-L3.1.1`
- references: `methodology-hardening-L1`
