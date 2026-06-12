---
code: architecture-refactor-L3.1.5-verification
level: L3
title: 全链路兼容验证与回归补强
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  本 L3 规定 architecture-refactor 最终兼容验证：新增公共导出契约测试、CLI 架构 smoke 测试、installed CLI
  drift 补强，并串联 build、专项测试、全量测试、lint 与 project doctor，确保分层重构后公共 API、CLI
  行为和发布产物兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 收集 verification 上下文
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 public API contract 测试
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 新增 CLI architecture smoke 测试
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 强化 installed CLI drift 验证测试
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 运行架构专项测试与 export 搜索
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 运行 build、installed CLI 验证与相关测试
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 运行全量验证并完成 task
    status: pending
relations:
  - type: based_on
    target: architecture-refactor-L2.1
  - type: references
    target: architecture-refactor-L3.1.4-archive-plan
  - type: references
    target: architecture-refactor-L3.1.3-snapshot
  - type: references
    target: architecture-refactor-L3.1.2-spec-policy
  - type: references
    target: architecture-refactor-L3.1.1-task-completion
created: '2026-06-11T08:19:27.897Z'
updated: '2026-06-11T08:27:58.633Z'
changeSummary: 'cascade: task-complete'
---
# 全链路兼容验证与回归补强 — 实施规格

## 目标

实施 architecture-refactor-L2.1 的最终兼容验证交付物：对 architecture-refactor-L3.1.1-task-completion、architecture-refactor-L3.1.2-spec-policy、architecture-refactor-L3.1.3-snapshot、architecture-refactor-L3.1.4-archive-plan 形成全链路回归护栏，补强公共导出契约、installed CLI drift 验证和 CLI smoke 测试，确保分层重构后的命令语义、存储格式、状态流转和发布产物保持兼容。

**前置依赖**: architecture-refactor-L3.1.4-archive-plan 已 implemented。

## 代码调查

- `src/index.ts:1` 已导出 `task-completion`、`spec-policy`、`project-snapshot`、`archive-plan` 等新边界，但当前缺少专门的公共导出契约测试。
- `scripts/verify-installed-cli.mjs:1` 已具备 dist 与已安装 CLI 的文件 hash 比对能力，`src/core/__tests__/installed-cli-verification.test.ts` 只覆盖脚本本身，尚未与架构重构产物的构建验证串联。
- `package.json` 已提供 `build`、`lint`、`test`、`verify:installed-cli` scripts，可作为本 L3 的全链路验证入口。
- `src/core/__tests__/methodology-contract.test.ts` 覆盖方法论文档契约，但不覆盖 architecture-refactor 新增模块的 API 面。
- `src/cli/__tests__/spec.test.ts`、`src/cli/__tests__/task.test.ts`、`src/cli/__tests__/change.test.ts`、`src/cli/__tests__/view.test.ts`、`src/cli/__tests__/usability.test.ts` 分别覆盖 CLI 子链路，本 L3 需要补一个跨 spec/task/change/project/view 的 smoke。
- `src/core/__tests__/task-completion.test.ts`、`spec-policy.test.ts`、`project-snapshot.test.ts`、`archive-plan.test.ts` 已分别覆盖四段 L3 的核心模块，最终段应将这些测试纳入验证命令。

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show architecture-refactor-L3.1.5-verification --include-content`。
- SHALL 执行 `spec-manager spec show architecture-refactor-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic architecture-refactor`，确认 architecture-refactor-L3.1.4-archive-plan 的 task 已 completed。
- SHALL 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `coveredSpecs`、`steps`、`stepNo`、`stepType`、`name`。
- SHALL 读取并记录实现锚点：`src/index.ts`、`package.json`、`scripts/verify-installed-cli.mjs`、`src/core/__tests__/installed-cli-verification.test.ts`、`src/core/__tests__/methodology-contract.test.ts`、`src/cli/__tests__/spec.test.ts`、`src/cli/__tests__/task.test.ts`、`src/cli/__tests__/change.test.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 architecture-refactor-L3.1.5-verification、architecture-refactor-L2.1、历史任务、agent-plan 和验证链路源码测试分析","files":[]}
  ```

### Step 2 — 新增公共导出契约测试

- SHALL 新增 `src/core/__tests__/public-api.test.ts`。
- SHALL 通过 `await import('../../index.js')` 或等价路径验证公共 API 导出：
  - `runTaskCompletion`
  - `validateSpecParentPolicy`
  - `applySpecStatusPolicy`
  - `buildProjectSnapshot`
  - `planArchiveChange`
- SHALL 验证既有 facade 仍导出：
  - `createSpec`
  - `updateSpec`
  - `completeTask`
  - `archiveChange` 若未从 `src/index.ts` 导出，则 SHALL 记录并保持现状，不因本 L3 强制扩大公共面。
- SHOULD 将测试聚焦在导出存在和类型为 function，不耦合内部实现。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增公共 API 导出契约测试覆盖架构重构新边界与兼容 facade","files":["src/core/__tests__/public-api.test.ts"]}
  ```

### Step 3 — 新增 CLI end-to-end smoke 测试

- SHALL 新增 `src/cli/__tests__/architecture-smoke.test.ts`。
- SHALL 使用临时项目和 Commander 注册真实 CLI commands，覆盖以下最小链路：
  - `spec new L1` + `spec update` + `spec confirm`
  - `spec new L2` + `spec update` + `spec confirm`
  - `spec new L3` + `spec update` + `spec confirm` 进入 frozen
  - `task create/start/step/verify/complete` 触发 L3 implemented cascade
  - `view` 或 `project doctor` 验证只读 snapshot 链路仍可用
- SHALL 保持测试不依赖全局安装、不访问网络、不修改真实仓库。
- SHOULD 若 `change archive` 的完整 CLI smoke 成本过高，继续依赖 `archive-plan.test.ts` 与 `cli/change.test.ts`，并在测试命名中明确覆盖边界。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 CLI 架构 smoke 测试覆盖 spec/task/view/project 兼容链路","files":["src/cli/__tests__/architecture-smoke.test.ts"]}
  ```

### Step 4 — 补强 installed CLI 验证

- SHALL 确认 `scripts/verify-installed-cli.mjs` 对 missing、extra、changed dist files 均失败并输出 `INSTALLED_CLI_DRIFT`。
- SHALL 若现有测试不足，修改 `src/core/__tests__/installed-cli-verification.test.ts` 覆盖 dist 新增模块文件，例如 `dist/core/archive-plan.js` 或 `dist/core/project-snapshot.js` 缺失时失败。
- SHALL 执行 `npm run build` 后再运行 installed CLI 验证相关测试，确保 dist 包含 architecture-refactor 新模块。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补强 installed CLI drift 验证，覆盖架构重构新增 dist 模块","files":["src/core/__tests__/installed-cli-verification.test.ts"]}
  ```

### Step 5 — 回归架构重构专项测试组

- SHALL 执行：
  `npm test -- src/core/__tests__/task-completion.test.ts src/core/__tests__/spec-policy.test.ts src/core/__tests__/project-snapshot.test.ts src/core/__tests__/archive-plan.test.ts src/core/__tests__/public-api.test.ts src/cli/__tests__/architecture-smoke.test.ts`
- SHALL 预期全部 passed。
- SHALL 搜索 `src/index.ts` 和 `dist/index.d.ts`，确认 `spec-policy`、`project-snapshot`、`archive-plan` 的导出可见。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 architecture-refactor 专项测试组回归和公共导出检查","files":["src/index.ts","dist/index.d.ts"]}
  ```

### Step 6 — 发布产物与 installed CLI 验证

- SHALL 执行 `npm run build`，预期 `dist/` 构建成功。
- SHALL 执行 `npm run verify:installed-cli`；若当前环境未安装全局 `spec-manager`，SHOULD 使用 `SPEC_MANAGER_INSTALLED_ROOT=<临时目录>` 复制当前 dist 的方式运行脚本验证成功路径，并说明环境限制。
- SHALL 执行 `npm test -- src/core/__tests__/installed-cli-verification.test.ts`，预期 passed。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 build、installed CLI drift 脚本和 installed CLI 单元测试验证","files":["dist"]}
  ```

### Step 7 — 全量验证

- SHALL 执行 `npm test`，预期所有 test files 和 tests passed。
- SHALL 执行 `npm run lint`，预期 TypeScript noEmit 成功。
- SHALL 执行 `spec-manager project doctor`，预期输出包含 `Project doctor: ok`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成全量测试、类型检查和 project doctor 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: 架构重构专项测试通过
npm test -- src/core/__tests__/task-completion.test.ts src/core/__tests__/spec-policy.test.ts src/core/__tests__/project-snapshot.test.ts src/core/__tests__/archive-plan.test.ts src/core/__tests__/public-api.test.ts src/cli/__tests__/architecture-smoke.test.ts
# 预期输出包含: public-api.test.ts
# 预期输出包含: architecture-smoke.test.ts
# 预期输出包含: passed

# 正向验证: 发布产物构建通过
npm run build
# 预期输出不包含: error TS

# 正向验证: installed CLI drift 验证通过
npm run verify:installed-cli
# 预期输出包含: Installed CLI matches current build

# 正向验证: installed CLI drift 单元测试通过
npm test -- src/core/__tests__/installed-cli-verification.test.ts
# 预期输出包含: installed-cli-verification.test.ts
# 预期输出包含: passed

# 正向验证: 全量测试通过
npm test
# 预期输出包含: Test Files
# 预期输出包含: passed

# 正向验证: TypeScript 类型检查通过
npm run lint
# 预期输出不包含: error TS

# 正向验证: 项目诊断保持 ok
spec-manager project doctor
# 预期输出包含: Project doctor: ok
```

## 验收标准

1. **AC-1**: `public-api.test.ts` SHALL 验证 `runTaskCompletion`、`validateSpecParentPolicy`、`buildProjectSnapshot`、`planArchiveChange` 等新边界公共导出。
2. **AC-2**: `architecture-smoke.test.ts` SHALL 覆盖 spec/task/view 或 project doctor 的真实 CLI 兼容链路。
3. **AC-3**: installed CLI drift 验证 SHALL 覆盖架构重构新增 dist 模块缺失或变更场景。
4. **AC-4**: `npm run build`、架构专项测试、installed CLI 测试 SHALL 全部通过。
5. **AC-5**: `npm test`、`npm run lint`、`spec-manager project doctor` SHALL 全部通过。

@verify: file-exists(src/core/__tests__/public-api.test.ts)
@verify: file-exists(src/cli/__tests__/architecture-smoke.test.ts)
@verify: command(npm test -- src/core/__tests__/public-api.test.ts src/cli/__tests__/architecture-smoke.test.ts)
@verify: command(npm run build)

## step_report 模板

每步完成后调用 `spec-manager task step`，不得预报。示例：

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.5-verification"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "收集 verification 上下文: 读取 architecture-refactor-L3.1.5-verification、architecture-refactor-L2.1、历史任务、agent-plan 和验证源码测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增公共导出契约测试: 编辑 src/core/__tests__/public-api.test.ts"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "新增 CLI 架构 smoke 测试: 编辑 src/cli/__tests__/architecture-smoke.test.ts"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "补强 installed CLI 验证: 编辑 src/core/__tests__/installed-cli-verification.test.ts"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "回归架构重构专项测试组: 运行 task-completion、spec-policy、project-snapshot、archive-plan、public-api、architecture-smoke 测试"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "验证发布产物和 installed CLI: 运行 npm run build、npm run verify:installed-cli、installed-cli-verification 测试"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "验证 architecture-refactor 全链路: 运行 npm test、npm run lint、spec-manager project doctor"}
  ]
}
```

autoConfirm: false。理由：本 L3 是最终验证与发布产物防线，仍需要人工审批后执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 新 smoke 测试不稳定 | 回退 smoke 测试，保留公共导出契约和专项模块测试 | < 5 min |
| installed CLI 验证与环境耦合过强 | 回退环境依赖部分，保留 `SPEC_MANAGER_INSTALLED_ROOT` 临时目录测试路径 | < 10 min |
| build 后 dist 产生大量无关差异 | 回退 dist 产物，仅保留源码测试；重新明确发布流程 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `npm run verify:installed-cli` 依赖全局安装环境 | 优先尝试真实命令；失败若为 `INSTALLED_CLI_MISSING`，使用 `SPEC_MANAGER_INSTALLED_ROOT` 临时目录验证脚本成功路径并记录限制 |
| CLI smoke 与现有单元测试重复 | smoke 只覆盖跨命令 happy path，不复刻各子命令细节 |
| 公共导出测试锁死内部实现 | 只断言稳定边界导出存在，不断言内部 helper |
| dist 构建影响工作区状态 | 明确将 build 产物作为验证结果；不清理用户已有 dist 变更 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | architecture-refactor-L2.1 | 最终兼容验证设计来源 |
| references | architecture-refactor-L3.1.4-archive-plan | archive plan 依赖已 implemented |
| references | architecture-refactor-L3.1.3-snapshot | ProjectSnapshot 依赖已 implemented |
| references | architecture-refactor-L3.1.2-spec-policy | spec policy 依赖已 implemented |
| references | architecture-refactor-L3.1.1-task-completion | task completion 依赖已 implemented |
