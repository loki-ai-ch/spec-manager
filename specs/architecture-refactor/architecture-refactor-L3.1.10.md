---
code: architecture-refactor-L3.1.10
level: L3
title: 归档 REMOVED 目录一致性与回滚清理
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 修复包含 REMOVED 的归档被拆分到两个目录，以及失败回滚遗留本次创建目录的问题。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充 REMOVED 成功目录一致性与失败目录清理回归测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 统一 removed spec 与 change 元数据归档目标
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 加固归档事务创建目录回滚
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:33:33.355Z'
updated: '2026-06-11T09:39:18.072Z'
changeSummary: 'cascade: task-complete'
---
# 归档 REMOVED 目录一致性与回滚清理

## 目标

修复归档链路审查发现的目录一致性缺陷：

1. 包含 `REMOVED` 的归档当前先写入 `archive/<name>/specs/...`，随后因 `archive/<name>` 已存在，将 `changes/<name>` 移到时间戳目录，导致同一次归档被拆分到两个根目录。
2. entry apply 或最终目录移动失败时，文件内容会回滚，但本次创建的空目录可能残留，影响后续重试的归档目标选择。

保持 delta 应用顺序、归档结果 shape、spec 内容、结构化引用迁移和 R24 audit 语义兼容。

## 代码调查

- `applyArchiveEntry` 的 `REMOVED` 分支直接将 archived spec 写入 `join(paths.archiveDir, plan.changeName)`。
- `moveChangeToArchive` 发现该目标已存在后，必然选择时间戳目录，因此 removed spec 与 proposal/deltas 分离。
- `ArchiveResult.archivedTo` 只返回 change 目录位置，无法代表 removed spec 的实际位置。
- `ArchiveApplyTransaction` 只跟踪 created files；rollback 删除文件但不删除本次创建的空目录。
- 当前归档测试没有覆盖成功 `REMOVED` 的目录布局，也没有覆盖失败后的目录残留。

## 实施步骤

### Step 1 - 补充目录一致性回归测试

- 成功归档单个 `REMOVED` 后，断言 `archivedTo` 同时包含 change proposal/delta 与 archived spec。
- 断言同一次成功归档不会额外创建同名时间戳目录。
- 在 `REMOVED` 后续 entry apply 失败时，断言 specs、change 目录和 archive 目录布局恢复到调用前状态。

### Step 2 - 统一归档目标

- 在 apply 前确定本次归档唯一目标目录，包括已有目标冲突时的时间戳目标。
- `REMOVED` archived spec 和最终 change 元数据必须写入/移动到同一个目标根目录。
- `ArchiveResult.archivedTo` 必须指向包含本次全部归档资产的根目录。

### Step 3 - 加固目录回滚

- 事务显式跟踪本次创建的目录，并在失败回滚时按逆序删除已空目录。
- 不得删除调用前已存在目录或其中任何内容。
- 最终目录移动失败后，`changes/<name>` 保留，spec/reference update 恢复，且不遗留本次归档目标目录。

### Step 4 - 验证

- 运行 archive/archive-plan/change CLI 专项测试。
- 运行全量测试、lint、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive.test.ts src/core/__tests__/archive-plan.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: 成功 `REMOVED` 归档的 removed specs、proposal 和 deltas 位于同一个 `archivedTo` 根目录。
2. **AC-2**: 同一次成功归档不会因内部 removed spec 写入而被拆分为同名目录和时间戳目录。
3. **AC-3**: 归档失败后恢复调用前文件和目录布局，不遗留本次创建的空目录。
4. **AC-4**: 已存在归档目标时仍使用唯一时间戳目标，且不覆盖历史归档。
5. **AC-5**: 专项测试、全量测试、lint、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.10"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充 REMOVED 成功目录一致性与失败目录清理回归测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "统一 removed spec 与 change 元数据归档目标"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "加固归档事务创建目录回滚"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改归档目录布局和失败回滚语义，需要人工批准。

## 回滚方案

若唯一归档目标方案影响历史兼容，保留新增测试并回退实现；若目录跟踪过度复杂，至少确保成功 `REMOVED` 使用统一目标，并以调用前目录快照保护失败重试。
