---
code: architecture-refactor-L3.1.7-archive-transaction-hardening
level: L3
title: 归档冲突预检与事务回滚加固
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 增加 rename task 目标路径冲突预检，并确保最终 change 目录移动失败时完整回滚所有结构化引用迁移。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充 task 目标冲突与目录移动失败回滚测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 增加 rename task 目标路径冲突预检
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 统一归档应用与目录移动失败回滚边界
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:06:39.042Z'
updated: '2026-06-11T09:10:10.365Z'
changeSummary: 'cascade: task-complete'
---
# 归档冲突预检与事务回滚加固

## 目标

修复归档链路第二轮审查发现的两个数据安全缺口：

1. `RENAMED` 导致 task 文件改名时，如果目标 task 文件已存在，必须在 planning 阶段拒绝，禁止静默覆盖。
2. spec rename、结构化引用迁移与 change 目录移动必须处于统一回滚边界；最终目录移动失败时，incident、其他 change proposal、spec、task、decision 等已修改文件全部恢复。

保持 `archiveChange` 公共 API、CLI 输出和成功归档行为兼容。

## 代码调查

- `src/core/archive-plan.ts` 的 `planReferenceUpdates` 计算 task `newFilePath`，但未验证目标文件是否已存在。
- `src/core/archive.ts` 的 task reference update 使用 `writeAtomic(newFilePath, ...)`，目标已存在时会覆盖其内容。
- `archiveChange` 外层 `FileTransaction` 只显式 snapshot specs、tasks、decisions；incident 和其他 change proposal 仅由内部 `ArchiveApplyTransaction` snapshot。
- `ArchiveApplyTransaction.rollback()` 只在 entry apply 失败时调用；`moveChangeToArchive` 失败发生在其后，导致内部 snapshot 未恢复。

## 实施步骤

### Step 1 - 补充失败回归测试

- 在 `archive-plan.test.ts` 增加 rename task 目标文件冲突测试，预期 planning 抛明确冲突错误且不修改磁盘。
- 在 `archive.test.ts` 增加目录移动失败回滚测试，覆盖被迁移的 spec 引用、task、incident 和其他 change proposal。

### Step 2 - 增加 task 目标路径冲突预检

- planning 生成 `task-specCode` reference update 时检查 `newFilePath`。
- 当 `newFilePath !== filePath` 且目标已存在时，归档预检失败，不应用任何 entry。
- 错误信息包含冲突目标路径，便于人工修复。

### Step 3 - 统一归档应用回滚边界

- 确保 `moveChangeToArchive` 失败会调用归档应用事务 rollback。
- 将 reference update 涉及的 incident 和 change proposal 纳入可靠回滚。
- 确保 change 目录在移动失败后仍位于 `changes/<name>`。
- 保持 R24 仅在成功归档或 R24 proposal 校验失败时记录。

### Step 4 - 验证

- 运行归档专项测试、全量测试、lint 和 project doctor。

## 验证命令

```bash
npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
spec-manager project doctor
```

## 验收标准

1. **AC-1**: rename task 目标文件已存在时，planning 阶段失败且目标文件内容不变。
2. **AC-2**: 最终 change 目录移动失败时，所有 spec/task/decision/incident/change proposal 修改均回滚。
3. **AC-3**: 移动失败后 `changes/<name>` 保留，且不记录成功 R24 audit。
4. **AC-4**: 成功归档和现有单/多 rename 行为保持兼容。
5. **AC-5**: 专项测试、全量测试、lint 和 project doctor 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.7-archive-transaction-hardening"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充 task 目标冲突与目录移动失败回滚测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "增加 rename task 目标路径冲突预检"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "统一归档应用与目录移动失败回滚边界"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改归档冲突策略和失败回滚边界，需要人工审批。

## 回滚方案

若成功归档行为回归，回退本 L3 实现并保留新增失败测试；若统一事务方案影响范围过大，保留 task 冲突预检，并以显式 catch 调用内部 rollback 的最小方案恢复移动失败安全性。
