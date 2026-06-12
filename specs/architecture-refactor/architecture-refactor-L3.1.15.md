---
code: architecture-refactor-L3.1.15
level: L3
title: 归档 REMOVED 引用完整性保护
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 在归档 planning 阶段基于最终投影状态拒绝仍被存活仓库对象引用的 REMOVED spec，避免成功归档制造 dangling reference。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充 REMOVED 存活引用与组合操作回归测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 增加归档最终投影引用完整性校验
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 保持无引用删除与同批删除兼容
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-12T01:34:27.678Z'
updated: '2026-06-12T01:39:59.870Z'
changeSummary: 'cascade: task-complete'
---
# 归档 REMOVED 引用完整性保护

## 目标

在归档修改磁盘前，基于 change 应用后的最终投影状态拒绝仍被存活仓库对象引用的 `REMOVED` spec，避免成功归档立即制造 `dangling-reference` 完整性问题。

## 代码调查

- `preflightArchive` 的 `REMOVED` 分支当前只确认 spec 存在，随后直接从规划态 `specsByCode` 删除。
- `applyArchiveEntry` 会把该 spec 移出活动 `specs/`，但不会处理指向它的 `parentCode`、relations、task、decision、incident 或其他未归档 change proposal。
- `inspectProjectIntegrity` 会把上述引用目标不存在全部报告为 `dangling-reference`。
- 因此删除仍有子 spec 或 relation 引用的 spec 可以成功归档，并让 `spec-manager project doctor` 随即失败。
- rename 后再 remove 最终目标时，reference updates 还会先把引用迁移到随后被删除的 code，造成相同问题。

## 实施步骤

### Step 1 - 补充 REMOVED 引用回归测试

- 覆盖仍被存活子 spec `parentCode` 引用的 `REMOVED`。
- 覆盖仍被存活 spec relation 引用的 `REMOVED`。
- 覆盖 task、decision、incident 和其他未归档 change proposal 对被删除 spec 的引用。
- 覆盖 rename 后删除最终目标，且存活引用会指向最终删除 code 的组合操作。
- 断言冲突在 planning/preflight 阶段暴露，spec 与 change 目录均不发生变化。

### Step 2 - 增加最终投影引用完整性校验

- 从排序后的 entries 和最终 rename 映射构建归档后的活动 spec code 投影。
- 对最终被删除的 spec，检查归档后仍存活的 spec、task、decision、incident 和 change proposal 引用。
- 忽略引用源也在同一 change 中被删除的 spec，以及本次归档后不再属于活动 changes 的当前 proposal。
- 错误信息包含被删除 code、引用源类型和引用源标识，便于修正 change。
- 校验必须发生在任何 apply 磁盘修改前。

### Step 3 - 保持合法删除兼容

- 无存活引用的 `REMOVED` 保持成功归档。
- parent 与 child、relation source 与 target 在同一 change 中共同删除时允许归档。
- 保持独立 rename、reference update、REMOVED 暂存布局和失败回滚行为兼容。
- 不自动删除或改写引用；引用如何迁移或清理必须由显式 change 表达。

### Step 4 - 验证

- 运行 archive-plan、archive、integrity 与 change CLI 专项测试。
- 运行全量测试、lint、build、installed CLI drift、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/core/__tests__/integrity.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: `REMOVED` 仍被存活 spec 的 `parentCode` 或 relation 引用时，planning 阶段拒绝归档且不产生磁盘写入。
2. **AC-2**: `REMOVED` 仍被 task、decision、incident 或其他活动 change proposal 引用时，planning 阶段拒绝归档且不产生磁盘写入。
3. **AC-3**: rename 后删除最终目标且存在存活引用时被拒绝，错误包含被删除 code 与引用源。
4. **AC-4**: 无引用删除，以及引用源和目标在同一 change 中共同删除，保持成功归档。
5. **AC-5**: 成功归档不会新增 `dangling-reference`，且专项测试、全量测试、lint、build、installed CLI drift、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.15"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充 REMOVED 存活引用与组合操作回归测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "增加归档最终投影引用完整性校验"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "保持无引用删除与同批删除兼容"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：该修复新增 `REMOVED` 的强引用阻断规则，并定义组合删除的投影语义，需要人工批准。

## 回滚方案

若最终投影校验错误阻断合法删除，保留回归测试并回退实现；后续可拆分引用类型逐项启用，但不得恢复会静默制造 dangling reference 的成功路径。
