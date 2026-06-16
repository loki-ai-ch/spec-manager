---
code: architecture-refactor-L3.1.14
level: L3
title: 归档重复 MODIFIED 数据丢失修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  在归档 planning 阶段拒绝同一 change 对同一 spec 的重复 MODIFIED，避免同名 delta marker 导致静默
  last-write-wins 数据丢失。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 补充同文件与跨文件重复 MODIFIED 回归测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 增加重复 MODIFIED planning 冲突校验
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 保持独立 MODIFIED 与组合操作兼容
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-12T01:24:57.566Z'
updated: '2026-06-12T01:31:43.989Z'
changeSummary: 'cascade: task-complete'
---
# 归档重复 MODIFIED 数据丢失修复

## 目标

在归档修改磁盘前拒绝同一 change 对同一 spec 的重复 `MODIFIED` entry，包括同一 delta 文件内重复和跨多个 delta 文件重复，避免相同 delta marker 导致静默 last-write-wins 数据丢失。

## 代码调查

- `parseDeltaSpec` 会读取 change 下的全部 delta 文件，并将各文件中的 entries 合并到同一个列表。
- `planArchiveChange` 会排序 entries，但当前不会校验同一 spec code 是否存在多条 `MODIFIED`。
- apply 阶段为每条 `MODIFIED` 使用相同 marker：`## Delta (<change-name>)`。
- 第一条 `MODIFIED` 写入后，后续同 code entry 会移除或替换前一条相同 marker 内容；归档仍成功并移动 change，造成第一条修改静默丢失。
- 重复 `ADDED`、`REMOVED` 等操作通常会因状态变化失败；重复 `MODIFIED` 则可静默成功，因此必须显式拒绝。

## 实施步骤

### Step 1 - 补充重复 MODIFIED 回归测试

- 覆盖同一 delta 文件内对同一 spec 的重复 `MODIFIED`。
- 覆盖多个 delta 文件分别对同一 spec 的重复 `MODIFIED`。
- 断言冲突在 planning/preflight 阶段暴露，原 spec 内容不变，change 不被归档。
- 保留多个不同 spec 各自 `MODIFIED` 的成功行为。

### Step 2 - 增加 planning 冲突校验

- 在 `planArchiveChange` 中按 spec code 汇总 `MODIFIED` entries。
- 同一 code 的 `MODIFIED` 数量大于一时返回明确冲突错误。
- 错误信息包含冲突 spec code 和重复修改语义，便于定位 delta 内容。
- 校验必须发生在任何 apply 磁盘修改前。

### Step 3 - 保持合法组合兼容

- 允许同一 change 修改多个不同 spec。
- 保持 rename 后修改最终目标等现有合法组合兼容。
- 不修改 delta parser 或磁盘格式，不为重复修改猜测合并顺序或合并语义。

### Step 4 - 验证

- 运行 archive-plan、archive、delta 与 change CLI 专项测试。
- 运行全量测试、lint、build、installed CLI drift、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/core/__tests__/delta.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: 同一 delta 文件内对同一 spec 的重复 `MODIFIED` 在 planning 阶段被拒绝，且不产生磁盘写入。
2. **AC-2**: 跨多个 delta 文件对同一 spec 的重复 `MODIFIED` 在 planning 阶段被拒绝，且不产生磁盘写入。
3. **AC-3**: 错误信息包含冲突 spec code，并明确指出重复 `MODIFIED`。
4. **AC-4**: 不同 spec 的独立 `MODIFIED` 和现有合法组合保持兼容。
5. **AC-5**: 专项测试、全量测试、lint、build、installed CLI drift、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.14"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "补充同文件与跨文件重复 MODIFIED 回归测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "增加重复 MODIFIED planning 冲突校验"},
    {"stepNo": 3, "stepType": "tool_action", "name": "保持独立 MODIFIED 与组合操作兼容"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：该修复新增归档输入拒绝条件并定义重复修改冲突语义，需要人工批准。

## 回滚方案

若重复校验影响现有合法归档，保留回归测试并回退冲突校验；后续仅在独立规格明确重复 `MODIFIED` 的确定性合并语义后再支持该输入。
