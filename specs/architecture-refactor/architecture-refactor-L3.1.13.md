---
code: architecture-refactor-L3.1.13
level: L3
title: 归档 ADDED Topic 目录回滚修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 修复归档 ADDED 在新 topic 下创建 spec 后失败回滚遗留空 topic 目录的问题。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 补充 ADDED 新 topic apply 与移动失败目录回滚测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 在 ADDED 创建前纳入 topic 目录事务跟踪
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 加固目录回滚对既有 topic 的保护
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-12T01:00:39.475Z'
updated: '2026-06-12T01:03:52.407Z'
changeSummary: 'cascade: task-complete'
---
# 归档 ADDED Topic 目录回滚修复

## 目标

修复归档 `ADDED` 在失败回滚时遗留新 topic 空目录的问题。

当 change 在此前不存在的 topic 中新增 spec 时，`createSpec` 会创建 `specs/<topic>`。如果后续 ADDED entry 失败，或最终 change 目录移动失败，归档必须恢复调用前完整文件与目录布局，不得保留本次创建的空 topic 目录。

## 代码调查

- `applyArchiveEntry` 的 `ADDED` 分支直接调用 `createSpec`，随后仅执行 `tx.trackCreated(newSpec.filePath)`。
- `writeSpec`/`writeAtomic` 会递归创建 spec 父目录，但 `ArchiveApplyTransaction` 不知道这些目录由本次调用创建。
- `ArchiveApplyTransaction.rollback()` 会删除新 spec 文件，却无法删除未跟踪的 `specs/<new-topic>` 空目录。
- `L3.1.10` 已为 `REMOVED` 暂存目录增加 `ensureDirectory` 与逆序目录清理，但 `ADDED` 尚未接入。
- 当前 apply rollback 测试使用已有 `auth` topic，无法发现目录残留。

## 实施步骤

### Step 1 - 补充失败目录回归测试

- 多个 ADDED 中第一个在新 topic 创建成功、后续 entry apply 失败时，断言新 spec 与新 topic 目录均被删除。
- ADDED 新 topic 成功应用后，最终 change 目录移动失败时，断言新 topic 目录被删除。
- 既有 topic 下 ADDED 失败时，断言既有 topic 目录及原内容保持。

### Step 2 - 纳入 ADDED 目录事务

- 在调用 `createSpec` 前确定目标 spec 文件与父目录。
- 使用归档事务记录仅由本次调用创建的目录。
- 保持 `createSpec` 作为 spec 创建和策略校验入口，不复制写入逻辑。

### Step 3 - 保护既有目录

- rollback 只删除本次调用前不存在且回滚后为空的目录。
- 不得删除既有 topic、tasks、decisions 或其他内容。
- 保持 REMOVED 暂存目录、成功 ADDED、归档目标与失败回滚行为兼容。

### Step 4 - 验证

- 运行 archive/archive-plan/change CLI 专项测试。
- 运行全量测试、lint、project doctor、build、installed CLI drift 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive.test.ts src/core/__tests__/archive-plan.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: ADDED 新 topic 后 apply 失败，不遗留新 spec 文件或空 topic 目录。
2. **AC-2**: ADDED 新 topic 后最终移动失败，不遗留新 spec 文件或空 topic 目录。
3. **AC-3**: rollback 不删除调用前已存在 topic 或其中内容。
4. **AC-4**: 成功 ADDED、REMOVED 目录回滚、归档目标与 R24 audit 行为保持兼容。
5. **AC-5**: 专项测试、全量测试、lint、build、installed CLI drift、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.13"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "补充 ADDED 新 topic apply 与移动失败目录回滚测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "在 ADDED 创建前纳入 topic 目录事务跟踪"},
    {"stepNo": 3, "stepType": "tool_action", "name": "加固目录回滚对既有 topic 的保护"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改归档失败事务的目录回滚范围，需要人工批准。

## 回滚方案

若 ADDED 目录跟踪影响成功创建，保留回归测试并回退实现；可改为在 rollback 后基于调用前目录存在性显式清理目标 topic。
