---
code: architecture-refactor-L3.1.2-spec-policy
level: L3
title: 规格仓储与策略边界拆分
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  本 L3 规定规格仓储与策略边界拆分：新增 spec-policy 模块承载 create/update/status/relation/content
  等策略，spec-io 保留仓储与兼容 facade，保持 CLI、错误关键词和存储格式兼容，并补充 spec-policy 专项测试和全量验证。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      收集 spec policy 上下文: 读取
      architecture-refactor-L3.1.2-spec-policy、architecture-refactor-L2.1、历史任务、agent-plan
      和相关源码测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: '新增 spec policy 模块: 编辑 src/core/spec-policy.ts'
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: >-
      委托 createSpec 和 updateSpec 到 spec policy: 编辑 src/core/spec-io.ts 和
      src/core/spec-policy.ts
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: '导出 spec policy 并检查调用路径: 编辑 src/index.ts 并检查 src/cli/spec.ts'
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: '新增 spec policy 单元测试: 编辑 src/core/__tests__/spec-policy.test.ts'
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: '回归 spec policy 相关测试: 运行 spec-policy、spec-io、cli spec 测试'
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证 spec policy 重构: 运行 npm test、npm run lint、spec-manager project doctor'
    status: pending
relations:
  - type: based_on
    target: architecture-refactor-L2.1
  - type: references
    target: architecture-refactor-L3.1.1-task-completion
  - type: references
    target: architecture-hardening-L3.1.2-core
created: '2026-06-11T07:23:23.907Z'
updated: '2026-06-11T07:46:28.466Z'
changeSummary: 'cascade: task-complete'
---
# 规格仓储与策略边界拆分 — 实施规格

## 目标

实施 architecture-refactor-L2.1 的规格仓储与策略边界重构交付物：将 `src/core/spec-io.ts` 中的规格业务策略抽出到独立 policy/service 模块，使 `spec-io` 保持读写与兼容 facade，现有 `createSpec`、`updateSpec`、CLI 和测试行为保持兼容。

**前置依赖**: architecture-refactor-L3.1.1-task-completion 已 implemented。

## 代码调查

- `src/core/spec-io.ts:176` 的 `createSpec` 同时处理 `parentCode` 存在性、parent level 约束、parent status 约束、R4/R7 audit、路径生成和实际写盘。
- `src/core/spec-io.ts:249` 的 `updateSpec` 同时处理 content/aiSummary/R13/R21/R22、status transition、implementation authority、step patch、relation validation、写盘和 R1/R13/R22 audit。
- `src/core/status.ts:67`、`src/core/status.ts:73` 已提供 `assertSpecTransition` 与 `isAuthorizedImplementationTransition`，应作为 policy 层状态策略基础。
- `src/core/validate.ts:37` 提供正文校验，CLI `src/cli/spec.ts:171` 在调用 `updateSpec` 后继续执行 warning-only validate。
- `src/cli/spec.ts:74`、`src/cli/spec.ts:171`、`src/cli/spec.ts:227`、`src/cli/spec.ts:263` 直接调用 `createSpec` / `updateSpec`，本 L3 不改变 CLI 参数和输出语义。
- `src/core/__tests__/spec-io.test.ts` 已覆盖 create/update 的核心规则：R4、R7、R13、R21、R22、relation、status、step patch 和缓存。
- `src/cli/__tests__/spec.test.ts` 已覆盖 L3 单次 confirm/freeze、R22 placeholder、validate-plan 和 spec validate 行为。

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show architecture-refactor-L3.1.2-spec-policy --include-content`。
- SHALL 执行 `spec-manager spec show architecture-refactor-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic architecture-refactor`，确认 `architecture-refactor-L3.1.1-task-completion` 的 task 已 completed。
- SHALL 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `coveredSpecs`、`steps`、`stepNo`、`stepType`、`name`。
- SHALL 读取并记录实现锚点：`src/core/spec-io.ts`、`src/core/status.ts`、`src/core/validate.ts`、`src/cli/spec.ts`、`src/core/__tests__/spec-io.test.ts`、`src/cli/__tests__/spec.test.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 architecture-refactor-L3.1.2-spec-policy、architecture-refactor-L2.1、历史任务、agent-plan 和 spec policy 相关源码测试分析","files":[]}
  ```

### Step 2 — 新增 spec policy 模块

- SHALL 新增 `src/core/spec-policy.ts`。
- SHALL 在 `src/core/spec-policy.ts` 中定义并导出：
  - `SpecPolicyWarning`
  - `CreateSpecPolicyInput`
  - `CreateSpecPolicyResult`
  - `UpdateSpecPolicyInput`
  - `UpdateSpecPolicyResult`
- SHALL 迁入 create 相关策略函数：
  - `validateSpecParentPolicy`
  - `buildInitialSpecRecord`
- SHALL 迁入 update 相关策略函数：
  - `applySpecContentPolicy`
  - `applySpecSummaryPolicy`
  - `applySpecStatusPolicy`
  - `applySpecStepPatchPolicy`
  - `applySpecRelationPolicy`
- SHALL 保留错误关键词兼容：`R4`、`R7`、`R13`、`R21` warning、`R22`、`RELATION_INVALID`、`RELATION_TARGET_NOT_FOUND`、`状态非法`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 spec policy 模块并迁入 create/update 业务策略","files":["src/core/spec-policy.ts"]}
  ```

### Step 3 — 将 spec-io 收窄为仓储与兼容 facade

- SHALL 修改 `src/core/spec-io.ts`，保留以下仓储职责在原文件内：`readSpec`、`writeSpec`、`listAllSpecs`、`findSpecByCode`、`invalidateSpecCache`、`migrateSpecPaths`、`validateSpecFileIdentity`。
- SHALL 修改 `createSpec`，使其委托 `validateSpecParentPolicy` 与 `buildInitialSpecRecord` 后调用 `writeSpec`。
- SHALL 修改 `updateSpec`，使其委托 `spec-policy` 处理 patch 规则后调用 `writeSpec`。
- SHALL 保持 `SpecFrontmatter`、`StepFrontmatter`、`SpecRecord`、`UpdateResult`、`DESC_MAX_LEN` 等现有导出不破坏。
- SHOULD 使用 `import type` 避免 `spec-policy.ts` 与 `spec-io.ts` 出现不必要的运行时循环。
- 完成后 step_report outputJson:
  ```json
  {"summary":"将 spec-io 收窄为仓储与兼容 facade，createSpec/updateSpec 委托 spec-policy","files":["src/core/spec-io.ts","src/core/spec-policy.ts"]}
  ```

### Step 4 — 更新公共导出与依赖检查

- SHALL 更新 `src/index.ts` 导出 `src/core/spec-policy.ts`，不得移除现有导出。
- SHALL 搜索 `createSpec`、`updateSpec`、`SpecFrontmatter`、`UpdateResult` 的引用，确认 CLI、task、lifecycle、archive、tests 仍通过 `spec-io` 兼容入口工作。
- SHALL 确认 `src/cli/spec.ts` 不需要改变命令参数、提示语或状态推进语义。
- 完成后 step_report outputJson:
  ```json
  {"summary":"导出 spec-policy 并确认 CLI 与核心模块继续通过 spec-io 兼容入口工作","files":["src/index.ts","src/cli/spec.ts"]}
  ```

### Step 5 — 补充 spec policy 单元测试

- SHALL 新增 `src/core/__tests__/spec-policy.test.ts`。
- SHALL 覆盖 create policy 正向路径：L1 confirmed 后可创建 L2、L2 confirmed 后可创建 L3。
- SHALL 覆盖 create policy 反向路径：L2/L3 无 parent 抛 `R7`，parent draft 抛 `R4`，L3 parent 是 L1 抛 `R7`。
- SHALL 覆盖 update policy 正向路径：content + aiSummary 更新成功，aiSummary 超长截断并返回 warning。
- SHALL 覆盖 update policy 反向路径：content 缺 aiSummary 抛 `R13`，placeholder content 抛 `R22`。
- SHALL 覆盖 relation policy：合法 target 写入成功，非法 type 抛 `RELATION_INVALID`，缺失 target 抛 `RELATION_TARGET_NOT_FOUND`。
- SHALL 覆盖 status policy：普通非法 transition 抛 `状态非法`，授权 implemented transition 仍可由现有 lifecycle/task 路径使用。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 spec policy 专项测试覆盖 create/update/status/relation 策略","files":["src/core/__tests__/spec-policy.test.ts"]}
  ```

### Step 6 — 回归 CLI 与核心行为

- SHALL 执行 `npm test -- src/core/__tests__/spec-policy.test.ts src/core/__tests__/spec-io.test.ts src/cli/__tests__/spec.test.ts`，预期全部 passed。
- SHALL 搜索 `src/core/spec-io.ts`，确认 R4/R7/R13/R21/R22/relation/status 的策略判断主体已迁入 `src/core/spec-policy.ts`，`spec-io.ts` 仅保留兼容 facade 与仓储调用。
- SHOULD 若 `spec-io.ts` 内仍保留少量错误转发或 audit 调用，仅用于兼容 facade，不再承载具体规则判断。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 spec policy 专项、spec-io 和 CLI spec 回归，并确认规则主体迁出 spec-io","files":["src/core/spec-policy.ts","src/core/spec-io.ts","src/core/__tests__/spec-policy.test.ts"]}
  ```

### Step 7 — 验证

- SHALL 执行 `npm test`，预期所有 test files 和 tests passed。
- SHALL 执行 `npm run lint`，预期 TypeScript noEmit 成功。
- SHALL 执行 `spec-manager project doctor`，预期输出包含 `Project doctor: ok`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成全量测试、类型检查和 project doctor 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: spec policy 相关测试通过
npm test -- src/core/__tests__/spec-policy.test.ts src/core/__tests__/spec-io.test.ts src/cli/__tests__/spec.test.ts
# 预期输出包含: spec-policy.test.ts
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

1. **AC-1**: `src/core/spec-policy.ts` SHALL 存在，并导出 `validateSpecParentPolicy`、`applySpecContentPolicy`、`applySpecStatusPolicy`、`applySpecRelationPolicy`。
2. **AC-2**: `src/core/spec-io.ts` SHALL 继续导出 `createSpec` 和 `updateSpec`，且现有 CLI 无需改变调用参数。
3. **AC-3**: R4/R7/R13/R21/R22/relation/status 的用户可见错误关键词 MUST 与现有行为兼容。
4. **AC-4**: `src/core/__tests__/spec-policy.test.ts` SHALL 覆盖 create、update、status、relation 策略的正反向行为。
5. **AC-5**: `npm test`、`npm run lint`、`spec-manager project doctor` SHALL 全部通过。

@verify: file-exists(src/core/spec-policy.ts)
@verify: export-exists(src/core/spec-policy.ts, validateSpecParentPolicy)
@verify: export-exists(src/core/spec-policy.ts, applySpecStatusPolicy)
@verify: export-exists(src/core/spec-io.ts, createSpec)
@verify: export-exists(src/core/spec-io.ts, updateSpec)
@verify: command(npm test -- src/core/__tests__/spec-policy.test.ts)

## step_report 模板

每步完成后调用 `spec-manager task step`，不得预报。示例：

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
  "coveredSpecs": ["architecture-refactor-L3.1.2-spec-policy"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集 spec policy 上下文: 读取 architecture-refactor-L3.1.2-spec-policy、architecture-refactor-L2.1、历史任务、agent-plan 和相关源码测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 spec policy 模块: 编辑 src/core/spec-policy.ts"},
    {"stepNo": 3, "stepType": "tool_action", "name": "委托 createSpec 和 updateSpec 到 spec policy: 编辑 src/core/spec-io.ts 和 src/core/spec-policy.ts"},
    {"stepNo": 4, "stepType": "tool_action", "name": "导出 spec policy 并检查调用路径: 编辑 src/index.ts 并检查 src/cli/spec.ts"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 spec policy 单元测试: 编辑 src/core/__tests__/spec-policy.test.ts"},
    {"stepNo": 6, "stepType": "tool_action", "name": "回归 spec policy 相关测试: 运行 spec-policy、spec-io、cli spec 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证 spec policy 重构: 运行 npm test、npm run lint、spec-manager project doctor"}
  ]
}
```

autoConfirm: false。理由：本 L3 触碰规格创建、更新和状态策略，执行期间不应自动通过 human gate。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| spec policy 拆分导致 CLI 行为回归 | `git revert <commit>` 后重新运行 `npm test` | < 5 min |
| spec-io 与 spec-policy 出现循环依赖 | 回退 `src/core/spec-policy.ts` 与 `src/core/spec-io.ts` 拆分提交，恢复原 create/update 实现 | < 10 min |
| 策略错误消息不兼容 | 回退错误消息相关 patch，优先恢复既有测试断言 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `spec-policy.ts` 与 `spec-io.ts` 类型互引导致运行时循环 | 使用 `import type`；policy 输入输出使用结构类型，写盘仍由 `spec-io` facade 完成 |
| 状态授权逻辑移动后影响 lifecycle/task cascade | 保留 `isAuthorizedImplementationTransition` 调用语义；运行 lifecycle、task 和全量测试 |
| audit hit 迁移遗漏 | 在 policy 中保留 R4/R7/R13/R21/R22 现有 hit 时机；使用现有 audit/spec tests 回归 |
| relation 校验迁移后误接受坏 target | 新增 relation missing target 测试，保留 `findSpecByCode` 查询 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | architecture-refactor-L2.1 | 引用父 L2 的规格策略边界设计 |
| references | architecture-refactor-L3.1.1-task-completion | 依赖上一段完成用例拆分已 implemented |
| references | architecture-hardening-L3.1.2-core | 参考路径安全与 Core 输入规则收口 |
