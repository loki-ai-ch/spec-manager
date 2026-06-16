---
code: methodology-hardening-L3.1.1-doc-contract
level: L3
title: 方法论文档与契约测试加固
topic: methodology-hardening
parentCode: methodology-hardening-L2.1
status: implemented
aiSummary: >-
  增量重构
  docs/methodology.md：修正独立状态流、门禁分级、R8/quick、L3/Task定位、审计基线、失败重试和真实环境验收边界，将无来源外部验证改为实践启发；新增
  Vitest 文档契约测试并执行全量验证。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3/L2、历史任务、plan 模板与方法论事实来源'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 docs/methodology.md 重构规范性契约与门禁分级
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 docs/methodology.md 修正运行机制边界与实践启发表述
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 新增 methodology-contract.test.ts 锁定文档事实契约
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: '验证: 运行专项测试、全量测试、lint、build 与 diff 检查'
    status: pending
created: '2026-06-11T01:41:57.793Z'
updated: '2026-06-11T01:46:34.961Z'
changeSummary: 'cascade: task-complete'
---
# 方法论文档与契约测试加固 — 实施规格

## 目标

实施 `methodology-hardening-L2.1` 的方法论文档契约与专项回归测试：基于当前工作树增量修订 `docs/methodology.md`，并新增文档契约测试锁定关键事实。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集与文件级事实核对

- `spec-manager spec show methodology-hardening-L3.1.1-doc-contract --include-content`
- `spec-manager spec show methodology-hardening-L2.1 --include-content`
- `spec-manager task list --topic methodology-hardening`
- 读取 `templates/agent-plan.json` 确认 planJson 字段名。
- 读取当前工作树中的 `docs/methodology.md`，确认并保留已有未提交的约束闭环内容。
- 读取 `src/core/status.ts`、`src/core/task.ts`、`src/core/invariants.ts`、`src/core/validate.ts`、`src/core/audit.ts`、`rules/code-discipline.md` 与 `skill/subskills/quick.md`，建立文档事实清单。
- 识别现有 Vitest 测试风格与测试目录。
- 完成后 step_report outputJson:
  ```json
  {"summary":"读取 L3/L2、历史任务、plan 模板、当前方法论文档与规则实现事实，确认仅增量修改两个目标文件","files":[]}
  ```

### Step 2 — 重构方法论文档的规范性契约

- SHALL 在 `docs/methodology.md` 中将当前统一状态机改为 L1/L2、L3、Task 独立状态流。
- SHALL 增加门禁能力矩阵，明确 hard gate、warning、human gate 与 target capability。
- SHALL 修正 R8 与 Agent Task 的关系：新功能和非平凡修改绑定 L3/Task，quick 为受限例外，R8 负责代码调查。
- SHALL 将 L3 定位改为实施规格或实施契约，将 Task 定位为执行记录。
- SHALL 将最低审计合规基线修正为包含 R18。
- SHALL 保留当前工作树已有的约束闭环核心理念，不恢复或覆盖用户已有内容。
- 完成后 step_report outputJson:
  ```json
  {"summary":"重构方法论文档规范性契约，修正独立状态流、门禁分级、R8/quick、L3/Task定位和审计基线","files":["docs/methodology.md"]}
  ```

### Step 3 — 修正运行机制与设计理念边界

- SHALL 将“每个模块必然执行”“失败必然重试”等表述改为当前真实能力：阻止错误完成、保存失败摘要、支持继续处理和断点续跑。
- SHALL 明确失败摘要会被截断并通过 warnings 暴露，不承诺自动 retry 调度或完整 prompt 注入。
- SHALL 明确成功 verification、验证命令与 `@verify` 是当前门禁，但真实环境冷启动和全部关键 AC 覆盖仍是目标能力或人工验收。
- SHALL 将无来源的“方法论验证”改为“实践启发”，删除不可追溯的具体实验强结论。
- SHOULD 按规范性契约、运行机制、设计理念与边界重排章节并减少重复。
- 完成后 step_report outputJson:
  ```json
  {"summary":"修正失败处理、verification边界和真实环境验收表述，将无来源外部验证降级为实践启发并整理文档结构","files":["docs/methodology.md"]}
  ```

### Step 4 — 新增文档契约测试

- 在 `src/core/__tests__/methodology-contract.test.ts` 新增 Vitest 测试。
- 测试 SHALL 从仓库根目录读取 `docs/methodology.md`。
- 正向契约 SHALL 检查：
  - 文档包含 hard gate、warning、human gate、target capability 的分级。
  - 文档包含 L1/L2、L3、Task 独立状态流。
  - 文档包含 quick 受限例外和 R8 代码调查语义。
  - 最低审计合规基线包含 R18。
  - 文档使用“实践启发”表述。
- 反向契约 SHALL 检查文档不包含：
  - `失败**必然重试**`
  - `每个模块**必然被执行**`
  - `## 方法论验证`
- 测试 SHOULD 避免完整段落快照，仅锁定稳定事实。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增方法论文档契约测试，锁定正确事实并阻止已知过度承诺回归","files":["src/core/__tests__/methodology-contract.test.ts"]}
  ```

### Step 5 — 验证文档契约与项目基线

- 运行专项测试、全量测试、lint、build 和 `git diff --check`。
- 检查 `git diff -- docs/methodology.md src/core/__tests__/methodology-contract.test.ts`，确认只包含本规格范围内修改。
- 确认未修改运行时实现文件。
- 完成后 step_report outputJson:
  ```json
  {"summary":"专项文档契约测试、全量测试、lint、build和diff检查通过，运行时行为文件未修改","files":["docs/methodology.md","src/core/__tests__/methodology-contract.test.ts"]}
  ```

## 验证命令

```bash
# 正向验证: 专项文档契约与完整项目验证
npx vitest run src/core/__tests__/methodology-contract.test.ts
npm test
npm run lint
npm run build
git diff --check

# 反向验证: 已知错误强表述必须不存在
! rg -n '失败\*\*必然重试\*\*|每个模块\*\*必然被执行\*\*|## 方法论验证' docs/methodology.md

# 范围验证: 不应修改运行时实现文件
git diff --name-only
```

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
  "coveredSpecs": ["methodology-hardening-L3.1.1-doc-contract"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3/L2、历史任务、plan 模板与方法论事实来源"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 docs/methodology.md 重构规范性契约与门禁分级"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 docs/methodology.md 修正运行机制边界与实践启发表述"},
    {"stepNo": 4, "stepType": "tool_action", "name": "新增 methodology-contract.test.ts 锁定文档事实契约"},
    {"stepNo": 5, "stepType": "tool_action", "name": "验证: 运行专项测试、全量测试、lint、build 与 diff 检查"}
  ]
}
```

`autoConfirm: false`，原因：方法论公开表述和契约测试需要用户审核后执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 文档结构或表述不符合预期 | 仅回退本 Task 对 `docs/methodology.md` 的增量修改，保留执行前已有未提交内容 | < 10 min |
| 文档契约测试过于脆弱 | 调整或移除 `src/core/__tests__/methodology-contract.test.ts` 中不稳定断言 | < 5 min |
| 与后续生命周期同步工作冲突 | 保留正确事实，重新协调章节归属和测试断言 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 覆盖用户已有的未提交方法论改动 | 编辑前保存并复核当前 diff，只做增量重构 |
| 文档重排丢失核心理念 | 对照执行前章节逐项确认核心内容仍存在或被有边界地改写 |
| 契约测试依赖具体文案 | 只匹配稳定标识和已知禁止短语，不做全文快照 |
| 全量测试受工作树中其他未提交代码影响 | 记录非本 Task 导致的失败，不回退其他改动 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | `methodology-hardening-L2.1` | 父技术设计 |
| implements | `methodology-hardening-L2.1` | 实施方法论文档契约与测试 |
| references | `lifecycle-guidance-sync-L1` | 复用分层生命周期事实 |
| references | `constraint-closed-loop-L1` | 复用当前闭环能力边界 |
