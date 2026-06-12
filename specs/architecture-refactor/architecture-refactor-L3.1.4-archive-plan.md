---
code: architecture-refactor-L3.1.4-archive-plan
level: L3
title: 归档计划与应用边界拆分
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  本 L3 规定归档计划与应用边界拆分：新增 archive-plan 模块承载 proposal 校验、delta 排序、预检和
  referenceUpdates 计划，archive.ts 保留 archiveChange facade、事务、apply 与 rollback，保持
  CLI 输出和磁盘格式兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      收集 archive plan 上下文: 读取
      architecture-refactor-L3.1.4-archive-plan、architecture-refactor-L2.1、历史任务、agent-plan
      和归档源码测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: '新增 archive plan 模块: 编辑 src/core/archive-plan.ts'
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: '迁出归档预检规则: 编辑 src/core/archive.ts 和 src/core/archive-plan.ts'
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: '拆分归档应用边界: 编辑 src/core/archive.ts 和 src/core/archive-plan.ts'
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: >-
      导出 archive-plan 并新增专项测试: 编辑 src/index.ts 和
      src/core/__tests__/archive-plan.test.ts
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: '回归归档链路: 运行 archive-plan、archive、paths、CLI change 测试'
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: '验证 archive plan 重构: 运行 npm test、npm run lint、spec-manager project doctor'
    status: pending
relations:
  - type: based_on
    target: architecture-refactor-L2.1
  - type: references
    target: architecture-refactor-L3.1.3-snapshot
  - type: references
    target: architecture-refactor-L3.1.2-spec-policy
created: '2026-06-11T08:07:16.793Z'
updated: '2026-06-11T08:18:27.496Z'
changeSummary: 'cascade: task-complete'
---
# 归档计划与应用边界拆分 — 实施规格

## 目标

实施 architecture-refactor-L2.1 的归档链路边界拆分交付物：将 `src/core/archive.ts` 中的 proposal 校验、delta 排序、预检、应用计划、引用迁移和目录归档拆成清晰的 plan/apply 能力，保留 `archiveChange(paths, name, opts)` 公共入口和 CLI 行为兼容，不改变 changes、specs、archive 的磁盘格式。

**前置依赖**: architecture-refactor-L3.1.3-snapshot 已 implemented。

## 代码调查

- `src/core/archive.ts:36` 的 `archiveChange` 当前负责 transaction snapshot、spec/task/decision 文件快照收集和 `archiveChangeUnlocked` 调用。
- `src/core/archive.ts:45` 的 `archiveChangeUnlocked` 同时执行 `validateChangeProposal`、`parseDeltaSpec`、entry 排序、`preflightArchive`、逐条 apply、rollback、change 目录移动和 R24 audit。
- architecture-refactor-L3.1.4-archive-plan 调查：`src/core/archive.ts:214` 的 `migrateStructuredSpecReferences` 同时迁移 specs、tasks、decisions、incidents、changes proposal 中的结构化引用，是归档应用阶段的独立副作用边界。
- `src/core/archive.ts:315` 的 `preflightArchive` 已包含 RENAMED/REMOVED/MODIFIED/ADDED 的核心预检规则，但只作为私有函数存在，无法独立测试 plan 输出。
- `src/core/archive.ts:368` 的 `resolveAddedMetadata` 和 `validateParentForAdded` 是 ADDED metadata 与 parent policy 的归档专用规则，适合归入 archive plan。
- `src/core/__tests__/archive.test.ts` 已覆盖 rename 引用迁移、rename 冲突、预检失败不应用、ADDED 缺占位、proposal R24、apply rollback 等关键行为。
- `src/cli/change.ts:168` 只调用 `archiveChange` 并打印 `applied/skipped/archivedTo`，本 L3 不改变 CLI 参数与输出字段语义。

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show architecture-refactor-L3.1.4-archive-plan --include-content`。
- SHALL 执行 `spec-manager spec show architecture-refactor-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic architecture-refactor`，确认 `architecture-refactor-L3.1.3-snapshot` 的 task 已 completed。
- SHALL 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `coveredSpecs`、`steps`、`stepNo`、`stepType`、`name`。
- SHALL 读取并记录实现锚点：`src/core/archive.ts`、`src/core/delta.ts`、`src/core/spec-io.ts`、`src/core/project-snapshot.ts`、`src/cli/change.ts`、`src/core/__tests__/archive.test.ts`、`src/core/__tests__/paths.test.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 architecture-refactor-L3.1.4-archive-plan、architecture-refactor-L2.1、历史任务、agent-plan 和归档链路源码测试分析","files":[]}
  ```

### Step 2 — 新增 archive plan 模块

- SHALL 新增 `src/core/archive-plan.ts`。
- SHALL 定义并导出：
  - `ArchivePlan`
  - `ArchivePlanEntry`
  - `ArchiveReferenceUpdate`
  - `ArchivePreflightIssue`
  - `PlanArchiveChangeInput`
  - `planArchiveChange`
- SHALL 在 `planArchiveChange` 中完成 proposal 校验、delta 解析、entry 排序和预检，不执行任何文件写入、删除或目录移动。
- SHALL 输出 `entries`，按 RENAMED、REMOVED、MODIFIED、ADDED 排序，并保留每条 entry 的 op/code/newCode/content/changeSummary。
- SHALL 输出 `referenceUpdates`，至少包含 RENAMED 触发的 spec parent/relation、task specCode、decision docCode、incident specCode、change proposal specCode 更新计划。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 archive plan 模块，提供只读计划和预检输出","files":["src/core/archive-plan.ts"]}
  ```

### Step 3 — 从 archive.ts 迁出预检与 metadata 规则

- SHALL 修改 `src/core/archive.ts`，将 `validateChangeProposal`、`preflightArchive`、`resolveAddedMetadata`、`validateParentForAdded` 的规则主体迁入 `src/core/archive-plan.ts`。
- SHALL 保留用户可见错误关键词兼容：`R24`、`Change not found`、`Change 预检失败，未修改 specs 且未归档`、`Spec not found`、`目标 spec 已存在`、`无法推断`、`R7`。
- SHALL 让 `archiveChange` 或内部 unlocked 函数先调用 `planArchiveChange`，后续 apply 使用计划结果。
- 完成后 step_report outputJson:
  ```json
  {"summary":"将归档 proposal 校验、预检和 ADDED metadata 规则迁入 archive-plan","files":["src/core/archive.ts","src/core/archive-plan.ts"]}
  ```

### Step 4 — 拆分归档应用边界

- SHALL 在 `src/core/archive.ts` 中新增或收敛内部 apply 函数：
  - `applyArchivePlan`
  - `applyArchiveEntry`
  - `applyArchiveReferenceUpdates`
  - `moveChangeToArchive`
- SHALL 保持 `ArchiveApplyTransaction` 的 rollback 语义，任一 entry apply 失败 MUST 回滚已写文件并保留 `changes/<name>/`。
- SHALL 保持 `archiveChange` 返回 `ArchiveResult` 的字段兼容：`changeName`、`applied`、`skipped`、`archivedTo`。
- SHOULD 在 architecture-refactor-L3.1.4-archive-plan 中将 `migrateStructuredSpecReferences` 改为消费 `ArchiveReferenceUpdate[]` 或等价计划，减少应用阶段临时扫描判断。
- 完成后 step_report outputJson:
  ```json
  {"summary":"拆分 archive apply、reference update 和 change 目录归档边界，保留 archiveChange facade","files":["src/core/archive.ts","src/core/archive-plan.ts"]}
  ```

### Step 5 — 导出与专项测试

- SHALL 更新 `src/index.ts` 导出 `src/core/archive-plan.ts`，不得移除既有导出。
- SHALL 新增 `src/core/__tests__/archive-plan.test.ts`。
- SHALL 覆盖 `planArchiveChange` 正向路径：RENAMED 生成 referenceUpdates，MODIFIED/REMOVED/ADDED entries 按固定顺序输出。
- SHALL 覆盖 `planArchiveChange` 反向路径：proposal 缺 why/scope 抛 R24，RENAMED target 已存在抛预检错误，ADDED 缺占位抛无法推断，L3 ADDED parent 不是 L2 抛 R7。
- SHALL 覆盖 `planArchiveChange` 不修改磁盘：预检成功后 `changes/<name>/` 仍存在，spec 内容未变化。
- 完成后 step_report outputJson:
  ```json
  {"summary":"导出 archive-plan 并新增归档计划专项测试","files":["src/index.ts","src/core/__tests__/archive-plan.test.ts"]}
  ```

### Step 6 — 回归归档 CLI 与核心行为

- SHALL 执行 `npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/core/__tests__/paths.test.ts src/cli/__tests__/change.test.ts`，预期全部 passed。
- SHALL 搜索 `src/core/archive.ts`，确认 proposal 校验、预检和 ADDED metadata 规则主体已迁出到 `src/core/archive-plan.ts`，`archive.ts` 主要承担事务、apply 和兼容 facade。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 archive-plan、archive、paths 和 CLI change 回归，并确认归档预检规则已迁出","files":["src/core/archive-plan.ts","src/core/archive.ts","src/core/__tests__/archive-plan.test.ts"]}
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
# 正向验证: archive plan 与归档回归测试通过
npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/core/__tests__/paths.test.ts src/cli/__tests__/change.test.ts
# 预期输出包含: archive-plan.test.ts
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

1. **AC-1**: `src/core/archive-plan.ts` SHALL 存在，并导出 `planArchiveChange`、`ArchivePlan`、`ArchivePlanEntry`。
2. **AC-2**: `planArchiveChange` SHALL 只读生成归档计划和预检结果，不修改 specs、changes、archive。
3. **AC-3**: `archiveChange` SHALL 保持现有公共 API 和 CLI 输出字段兼容。
4. **AC-4**: `archive-plan.test.ts` SHALL 覆盖计划排序、referenceUpdates、R24、RENAMED 冲突、ADDED metadata/R7 和只读性。
5. **AC-5**: `npm test`、`npm run lint`、`spec-manager project doctor` SHALL 全部通过。

@verify: file-exists(src/core/archive-plan.ts)
@verify: export-exists(src/core/archive-plan.ts, planArchiveChange)
@verify: export-exists(src/core/archive-plan.ts, ArchivePlan)
@verify: export-exists(src/core/archive-plan.ts, ArchivePlanEntry)
@verify: command(npm test -- src/core/__tests__/archive-plan.test.ts)

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
  "coveredSpecs": ["architecture-refactor-L3.1.4-archive-plan"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "收集 archive plan 上下文: 读取 architecture-refactor-L3.1.4-archive-plan、architecture-refactor-L2.1、历史任务、agent-plan 和归档源码测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 archive plan 模块: 编辑 src/core/archive-plan.ts"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "迁出归档预检规则: 编辑 src/core/archive.ts 和 src/core/archive-plan.ts"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "拆分归档应用边界: 编辑 src/core/archive.ts 和 src/core/archive-plan.ts"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "导出 archive-plan 并新增专项测试: 编辑 src/index.ts 和 src/core/__tests__/archive-plan.test.ts"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "回归归档链路: 运行 archive-plan、archive、paths、CLI change 测试"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "验证 archive plan 重构: 运行 npm test、npm run lint、spec-manager project doctor"}
  ]
}
```

autoConfirm: false。理由：本 L3 触碰归档应用和 rollback 语义，必须人工审批后执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| archive plan 拆分导致归档行为回归 | `git revert <commit>` 后重新运行 archive 与 CLI change 测试 | < 5 min |
| referenceUpdates 计划遗漏 | 回退引用迁移消费计划的 patch，恢复应用阶段扫描迁移 | < 10 min |
| apply rollback 语义变化 | 回退 `ArchiveApplyTransaction` 调用边界，保留原逐条 apply 实现 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 预检计划与实际 apply 使用的数据不一致 | `archiveChange` 在同一 transaction 内先 `planArchiveChange` 再 apply，测试覆盖预检成功但 apply 失败 rollback |
| RENAMED 引用迁移计划漏掉某类文件 | 保留 specs/tasks/decisions/incidents/change proposal 五类引用测试或现有 archive 测试，必要时应用阶段继续兜底扫描 |
| ADDED 继续触发 createSpec parent status R4 | plan 只负责结构预检，apply 仍通过 `createSpec` 保持既有 R4 行为 |
| CLI 输出变化 | 不修改 `src/cli/change.ts` 输出结构，运行 CLI change 回归 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | architecture-refactor-L2.1 | 归档边界设计来源 |
| references | architecture-refactor-L3.1.3-snapshot | ProjectSnapshot 依赖已 implemented |
| references | architecture-refactor-L3.1.2-spec-policy | ADDED apply 继续复用 createSpec/spec policy |
