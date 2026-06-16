---
code: architecture-refactor-L3.1.16
level: L3
title: 归档替换操作最终投影修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 修正 REMOVED 引用保护的最终投影计算，允许同一 change 通过 REMOVED 后同 code ADDED 完成保持引用有效的原位替换。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 补充带引用同 code 替换与 rename-replace 回归测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 基于最终活动 code 集合校验 REMOVED 引用
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 保持真正删除引用阻断与替换兼容
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-12T01:41:01.103Z'
updated: '2026-06-12T01:46:45.051Z'
changeSummary: 'cascade: task-complete'
---
# 归档替换操作最终投影修复

## 目标

修正 `REMOVED` 引用完整性保护的最终投影计算：仅当目标 code 在整个 change 应用后不再存在时阻断存活引用，允许 `REMOVED` 后同 code `ADDED` 的原位替换保持现有引用有效。

## 代码调查

- 归档固定应用顺序为 `RENAMED → REMOVED → MODIFIED → ADDED`。
- `preflightArchive` 使用状态化 `specsByCode`，因此当前明确允许先 `REMOVED` 再以同 code `ADDED`；最终活动 spec 中该 code 仍存在。
- L3.1.15 新增的 `validateRemovedReferences` 只把所有 `REMOVED` entry code 放入 `removed` 集合，没有排除后续重新 `ADDED` 的 code。
- 存活 spec、task、decision、incident 或 change proposal 引用该 code 时，替换操作会被错误报告为 `REMOVED 引用完整性检查失败`。
- rename 到新 code、删除新 code、再同 code ADDED 的替换组合也会被相同逻辑错误阻断。

## 实施步骤

### Step 1 - 补充替换操作回归测试

- 覆盖带存活 spec `parentCode`/relation 引用的同 code `REMOVED + ADDED`。
- 覆盖带 task、decision、incident 或其他活动 change proposal 引用的同 code替换。
- 覆盖 `RENAMED A → B + REMOVED B + ADDED B`，引用最终迁移并保持有效。
- 断言成功归档后替换内容生效，引用目标仍存在，且没有新增 `dangling-reference`。

### Step 2 - 使用最终活动 code 投影

- 从初始活动 spec codes 按固定 entry 顺序应用 rename、remove 和 add，得到最终活动 code 集合。
- `REMOVED` 引用检查只针对最终活动集合中不存在的 code。
- 引用目标先经过最终 rename 映射，再判断其最终 code 是否不存在。
- 保持校验为 planning 阶段纯读取逻辑，不产生磁盘修改。

### Step 3 - 保持真正删除保护

- 仍然拒绝最终不存在且被存活 spec 或仓库元数据引用的 code。
- 仍然允许引用源与目标同批删除。
- 保持无引用删除、独立 rename、reference updates、归档布局与回滚行为兼容。
- 不扩大为通用内容合并或自动引用清理。

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

1. **AC-1**: 同 code `REMOVED + ADDED` 后 code 最终仍存在，存活 spec 引用不会被错误阻断。
2. **AC-2**: 同 code 替换时 task、decision、incident 和其他活动 change proposal 引用保持有效。
3. **AC-3**: rename 后在最终 code 上执行删除再新增时可成功归档，引用迁移至最终 code 且无 dangling reference。
4. **AC-4**: 最终真正删除且仍被存活引用的 code 继续在 planning 阶段被拒绝。
5. **AC-5**: 专项测试、全量测试、lint、build、installed CLI drift、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.16"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "补充带引用同 code 替换与 rename-replace 回归测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "基于最终活动 code 集合校验 REMOVED 引用"},
    {"stepNo": 3, "stepType": "tool_action", "name": "保持真正删除引用阻断与替换兼容"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：该修复调整 L3.1.15 的引用阻断边界，并正式确认同 code 删除后新增属于合法替换，需要人工批准。

## 回滚方案

若最终活动 code 投影放宽了不应允许的删除，保留替换与真正删除回归测试并回退实现；后续可对替换操作增加显式语义标记，但不得以仅检查 `REMOVED` entry 的方式制造假阳性。
