---
code: template-governance-hardening-L3.1.2
level: L3
title: Docs Consistency Agent Capsule Coverage
topic: template-governance-hardening
parentCode: template-governance-hardening-L2.1
status: implemented
aiSummary: >-
  实施规格：扩展 project docs check 的 Agent capsule guidance 扫描范围，并用 docs-consistency
  fixture 覆盖顶层模板缺失 guidance 的 warning。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 template-governance-hardening-L3.1.2 template-governance-hardening-L2.1
      和前序 L3 规格
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/docs-consistency.ts 扩展 Agent capsule guidance 扫描
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/__tests__/docs-consistency.test.ts 增加顶层 Agent capsule fixture
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证 npm test -- docs-consistency docs-guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run build 和 node dist/cli/index.js project docs check
    status: pending
relations:
  - type: based_on
    target: template-governance-hardening-L2.1
  - type: references
    target: template-governance-hardening-L3.1.1
  - type: references
    target: workflow-usability-hardening-L2.2
created: '2026-07-15T09:06:14.541Z'
updated: '2026-07-15T09:22:16.692Z'
changeSummary: 'cascade: task-complete'
---
# Docs Consistency Agent Capsule Coverage — 实施规格

## 目标

实施 `template-governance-hardening-L2.1` 的第二个切片：扩展 `project docs check` 的 guidance 扫描范围，让顶层 Agent capsule 缺少关键 workflow/design guidance 时输出 warning。

**前置依赖**: `template-governance-hardening-L3.1.1` 已 implemented。

## 实施步骤

> **RFC 2119 关键字指引**:
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- 读取本 L3 与父 L2：
  - `spec-manager spec show template-governance-hardening-L3.1.2 --include-content`
  - `spec-manager spec show template-governance-hardening-L2.1 --include-content`
- 读取前序 L3：
  - `spec-manager spec show template-governance-hardening-L3.1.1 --include-content`
- 执行文件级分析(R23)，读取：
  - `src/core/docs-consistency.ts`
  - `src/core/__tests__/docs-consistency.test.ts`
  - `templates/agents/AGENTS.md`
  - `templates/agents/CLAUDE.md`
  - `templates/agents/CODEBUDDY.md`
  - `templates/agents/CURSOR.md`
  - `templates/agents/WINDSURF.md`
  - `templates/agents/codebuddy-skill/SKILL.md`
  - `skill/SKILL.md`

### Step 2 — 扩展 docs consistency guidance 扫描

- 编辑 `src/core/docs-consistency.ts`：
  - 将扫描目标从 `skill/SKILL.md` + `templates/agents/*/SKILL.md` 扩展为：
    - `skill/SKILL.md`
    - `templates/agents/*.md`
    - `templates/agents/*/SKILL.md`
  - 将单一 `GUIDANCE_PHRASES` 扩展为稳定短语组，至少覆盖：
    - `spec-manager`
    - `project docs check`
    - `project context --json`
    - `writeRoot`
    - `specs/DESIGN.md`
    - `assist acceptance`
    - `assist delivery`
  - 对缺失短语继续输出 warning，不改变 `DocsConsistencyReport` schema。
  - 对不存在的模板目录保持跳过，不报错。

### Step 3 — 补充 docs-consistency fixtures

- 编辑 `src/core/__tests__/docs-consistency.test.ts`：
  - 增加 fixture：`templates/agents/AGENTS.md` 只包含旧 workflow guidance 时，report 包含 `docs.agent-template.guidance.missing`，path 为 `templates/agents/AGENTS.md`。
  - 更新 “consistent docs and guidance” fixture：补齐顶层 Agent capsule 与 CodeBuddy skill 所需短语，保持 no findings。
  - 保留已有 generated asset info/warning 行为。

### Step 4 — 验证

- 运行 targeted tests：
  - `npm_config_cache=/tmp/spec-manager-npm-cache npm test -- docs-consistency docs-guidance`
- 运行 build 和 docs check：
  - `npm run build`
  - `node dist/cli/index.js project docs check`

## 验证命令

```bash
# 正向验证: docs consistency 和 docs guidance 测试通过
npm_config_cache=/tmp/spec-manager-npm-cache npm test -- docs-consistency docs-guidance
# 预期输出包含: Test Files 2 passed

# 正向验证: 构建通过
npm run build
# 预期输出包含: tsc

# 正向验证: 当前项目 docs check 无 error/warning
node dist/cli/index.js project docs check
# 预期输出包含: errors=0 warnings=0
```

## 验收标准

1. **AC-1**: **Given** `templates/agents/AGENTS.md` 缺少 docs/design/delivery guidance, **When** 运行 docs consistency report, **Then** report **SHALL** 输出 `docs.agent-template.guidance.missing` warning 并指向该文件。
2. **AC-2**: **Given** 顶层 Agent capsule、native skill 和 CodeBuddy skill 都包含关键 guidance, **When** 运行 docs consistency report, **Then** report **SHALL** 不产生 guidance warning。
3. **AC-3**: **Given** 当前仓库发布模板已补齐 guidance, **When** 运行构建产物的 `project docs check`, **Then** 输出 **SHALL** 为 `errors=0 warnings=0`。

## 关键验收标准

- AC-1
- AC-2
- AC-3

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
  "coveredSpecs": ["template-governance-hardening-L3.1.2"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 template-governance-hardening-L3.1.2 template-governance-hardening-L2.1 和前序 L3 规格"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/docs-consistency.ts 扩展 Agent capsule guidance 扫描"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/__tests__/docs-consistency.test.ts 增加顶层 Agent capsule fixture"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证 npm test -- docs-consistency docs-guidance"},
    {"stepNo": 5, "stepType": "tool_action", "name": "验证 npm run build 和 node dist/cli/index.js project docs check"}
  ]
}
```

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| docs check warning 过严 | 回退 `src/core/docs-consistency.ts` 的新增短语组，保留扫描目标扩展后重新评估 | < 10 min |
| fixture 过度约束 | 回退或放宽 `src/core/__tests__/docs-consistency.test.ts` 新增断言 | < 10 min |
| 当前仓库 docs check 误报 | 根据 finding 调整模板短语或检查逻辑 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 关键词检查误报 | 使用 warning，不改变 exit code；短语选稳定命令/路径 |
| 旧项目没有模板目录 | 检查器跳过不存在目录 |
| 与下一阶段单源生成重复 | 本轮只做扫描和 fixture，不引入生成器 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | template-governance-hardening-L2.1 | 父 L2 |
| references | template-governance-hardening-L3.1.1 | 前序模板 guidance parity |
| references | workflow-usability-hardening-L2.2 | 现有 docs consistency 设计 |
