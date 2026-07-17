---
code: spec-knowledge-governance-L3.1.1-validity
level: L3
title: Knowledge Validity Registry and Resolver
topic: spec-knowledge-governance
parentCode: spec-knowledge-governance-L2.1
status: implemented
aiSummary: >-
  实施版本化知识注册表、五类 canonical source ref、显式/推导/默认 unknown 解析器、replacement 环检测与
  store-aware 原子写入，并新增 knowledge show/set CLI 及核心、事务、store 回归测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3/L2、历史 Task、agent-plan 模板和知识模块调用链'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 src/core/knowledge.ts 定义知识模型和 canonical source ref
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 src/core/paths.ts 并接入 knowledge registry 原子存储
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 实现 src/core/knowledge.ts 来源校验、状态解析和 replacement 环检测
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 src/cli/knowledge.ts 并修改 src/cli/index.ts 注册 show/set 命令
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 新增 knowledge 核心与 CLI 测试并补充路径事务和 store 回归
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、npm run build、全量 Vitest 和 CLI 反向 smoke'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-governance-L2.1
  - type: references
    target: spec-knowledge-loop-L2.1
  - type: references
    target: critical-ac-readiness-L2.1
created: '2026-07-16T03:25:00.405Z'
updated: '2026-07-16T03:42:16.470Z'
changeSummary: 'cascade: task-complete'
---
# Knowledge Validity Registry and Resolver — 实施规格

## 目标

实施 `spec-knowledge-governance-L2.1` 的知识注册表、canonical source ref、有效性解析器与 `knowledge show/set` CLI，使知识状态独立于现有生命周期并保持人工写入、只读推导和 store-aware 原子存储。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- **SHALL** 读取 `spec-knowledge-governance-L3.1.1-validity`、`spec-knowledge-governance-L2.1` 全文和本 topic 历史 Task。
- **SHALL** 复核 `src/core/paths.ts` 的 `ProjectPaths/getPaths`、`src/core/transaction.ts` 的 `withProjectTransaction/FileTransaction`、`src/core/project-snapshot.ts` 的索引结构、`src/cli/index.ts` 的命令注册方式及相邻测试。
- **SHALL** 读取 `.agents/skills/spec-manager/templates/agent-plan.json`，确认 `stepNo/stepType/name` 字段。

### Step 2 — 定义知识模型与来源引用

- **SHALL** 新增 `src/core/knowledge.ts`，定义 `KnowledgeState`、`KnowledgeBasis`、`KnowledgeAnnotation`、`KnowledgeRegistry`、`ResolvedKnowledge` 和版本常量 `knowledge-registry.v1`。
- **SHALL** 实现 canonical source ref 的 parse/format，支持 `spec`、`decision`、`task`、`lesson`、`ac`；Decision 必须使用 topic 与 id 的复合键。
- **SHALL** 对非法格式返回 `KNOWLEDGE_SOURCE_REF_INVALID`，不得以路径字符串作为持久标识。

### Step 3 — 接入路径和原子注册表存储

- **SHALL** 在 `src/core/paths.ts` 的 `ProjectPaths` 与 `getPaths` 增加 `knowledgeFile`，目标为解析后 write root 的 `.spec-manager/knowledge.json`。
- **SHALL** 在 `src/core/knowledge.ts` 实现缺文件返回空注册表、schema 严格解析、稳定键排序和 `withProjectTransaction(...).write(...)` 原子更新。
- **SHALL** 保持外部 `specStore.path` 通过现有 `getWritePaths` 解析后使用同一契约，不得回写 execution root。

### Step 4 — 实现来源校验与有效性解析

- **SHALL** 基于 `buildProjectSnapshot`、Spec 关系和原始记录实现 `validateKnowledgeSource` 与 `resolveKnowledge`。
- **SHALL** 按“显式 annotation > 稳定事实推导 > 默认 unknown”解析；implemented Spec 不得被自动推导为 current。
- **SHALL** 推导 archived Spec 为 historical、存在有效替代关系的目标为 superseded、active/superseded/partial Decision 分别为 current/superseded/unknown，并返回 `basis` 与 reason。
- **SHALL** 检查 replacement 必填、目标存在、不能指向自身且不能形成传递环；失败不得产生部分写入。

### Step 5 — 实现 `knowledge show/set` CLI

- **SHALL** 新增 `src/cli/knowledge.ts` 的 `registerKnowledgeCommands`，并在 `src/cli/index.ts` 注册顶层 `knowledge` 命令。
- **SHALL** 实现 `show <sourceRef> [--json]` 只读展示 state、basis、reason、replacementRef、reviewedAt。
- **SHALL** 实现 `set <sourceRef> --state --reason [--replacement]`，仅显式调用可写；重复内容语义幂等但仍通过既有 audit 能力记录操作。
- **SHALL** 使用稳定错误码映射参数、来源、replacement 和损坏注册表错误。

### Step 6 — 增加核心与 CLI 测试

- **SHALL** 新增 `src/core/__tests__/knowledge.test.ts`，覆盖五类引用、空表、显式优先级、全部推导分支、默认 unknown、损坏 JSON、悬空来源和 replacement cycle。
- **SHALL** 修改 `src/core/__tests__/paths.test.ts`、`src/core/__tests__/transaction.test.ts`，覆盖 knowledgeFile 和失败回滚。
- **SHALL** 新增 `src/cli/__tests__/knowledge.test.ts` 并修改 `src/cli/__tests__/architecture-smoke.test.ts`、`src/cli/__tests__/store-aware-writes.test.ts`，覆盖命令挂载、文本/JSON、错误码、幂等与外部 write store。

### Step 7 — 构建与验证

- **SHALL** 运行定向 Vitest、TypeScript build 和全量测试。
- **SHALL** 用临时初始化项目执行 CLI smoke：未标注 implemented Spec 输出 unknown，显式 set 后输出 explicit 状态，非法 replacement 返回稳定错误且文件无变化。

## 验证命令

```bash
# 正向验证: 核心模型、路径、事务和 CLI
npm test -- --run src/core/__tests__/knowledge.test.ts src/core/__tests__/paths.test.ts src/core/__tests__/transaction.test.ts src/cli/__tests__/knowledge.test.ts src/cli/__tests__/architecture-smoke.test.ts src/cli/__tests__/store-aware-writes.test.ts
# 预期: Test Files 全部 passed，Tests 全部 passed

npm run build
# 预期: tsc 退出码 0

npm test -- --run
# 预期: Test Files 全部 passed，Tests 全部 passed

# 反向验证: 由 knowledge CLI 测试断言
npm test -- --run src/cli/__tests__/knowledge.test.ts -t "requires replacement|rejects replacement cycle|defaults implemented spec to unknown"
# 预期: 3 个目标用例 passed；错误分别含 KNOWLEDGE_REPLACEMENT_REQUIRED、KNOWLEDGE_REPLACEMENT_CYCLE，implemented Spec state=unknown
```

## 验收标准

1. **AC-1**: `knowledge show` 对 Spec、Decision、Task、Lesson 和 AC 返回 state、basis、reason、更新时间及可回查来源。
2. **AC-2**: superseded/invalidated/historical annotation 保留原来源，并要求 replacementRef 或非空可审计 reason。
3. **AC-9**: Brief、show 和 resolver 的只读调用均不修改 `knowledge.json`；只有显式 `knowledge set` 可以写入。
4. **AC-10**: 缺少注册表的 legacy 项目可继续读取；无 annotation 的 implemented Spec 解析为 unknown，而不是报错或 current。
5. **AC-11**: store 模式只写解析后的 write root，失败事务恢复写入前内容。

## 关键验收标准

- AC-1
- AC-2
- AC-9
- AC-10
- AC-11

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["spec-knowledge-governance-L3.1.1-validity"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3/L2、历史 Task、agent-plan 模板和知识模块调用链"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 src/core/knowledge.ts 定义知识模型和 canonical source ref"},
    {"stepNo": 3, "stepType": "tool_action", "name": "修改 src/core/paths.ts 并接入 knowledge registry 原子存储"},
    {"stepNo": 4, "stepType": "tool_action", "name": "实现 src/core/knowledge.ts 来源校验、状态解析和 replacement 环检测"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 src/cli/knowledge.ts 并修改 src/cli/index.ts 注册 show/set 命令"},
    {"stepNo": 6, "stepType": "tool_action", "name": "新增 knowledge 核心与 CLI 测试并补充路径事务和 store 回归"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证: 运行定向 Vitest、npm run build、全量 Vitest 和 CLI 反向 smoke"}
  ]
}
```

`autoConfirm` 取 `false`：知识有效性会改变后续规格判断，Task 执行仍保留人工可见步骤，不自动确认语义状态。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| CLI 或解析器回归 | 回退本 L3 的代码提交，移除 knowledge 命令注册；旧工作流不依赖新字段 | < 10 min |
| 注册表写入异常 | 从版本控制恢复 `.spec-manager/knowledge.json`；原始 Spec/Decision/Task 不受影响 | < 5 min |
| store 路径错误 | 回退 `ProjectPaths.knowledgeFile` 变更，删除误生成的空注册表 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| Lesson 复合 identity 无统一现成索引 | 用 sourceKind + 原始 source ref 的可回查复合键，无法校验时返回 NOT_FOUND，不制造记录 |
| Decision ID 跨 topic 冲突 | parser 强制 `decision:<topic>:<id>`，测试两个 topic 同 id |
| replacement 环检查遗漏长链 | 从目标沿 replacementRef 遍历并维护 visited set，覆盖三节点环测试 |
| 外部 store 写到错误根 | 所有 CLI 从 `getWritePaths` 注入 ProjectPaths，store-aware 测试断言 execution root 未变化 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-governance-L2.1 | 实施知识有效性注册表与解析契约 |
| references | spec-knowledge-loop-L2.1 | 复用本地检索来源与 store-aware Brief 基础 |
| references | critical-ac-readiness-L2.1 | 复用 AC 身份和来源校验口径 |
