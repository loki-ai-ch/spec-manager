---
code: architecture-refactor-L3.1.6-archive-review-fixes
level: L3
title: 归档计划审查缺陷修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 修复多 RENAMED 引用更新重复应用与 planArchiveChange 默认写 audit 的只读性缺陷，并补充事务和审计回归测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充多 rename 与 planning audit 只读性回归测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 修复归档引用更新应用边界
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 恢复 planArchiveChange 默认只读并保留 archiveChange R24 审计
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证修复：运行归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:00:23.822Z'
updated: '2026-06-11T09:05:25.912Z'
changeSummary: 'cascade: task-complete'
---
# 归档计划审查缺陷修复

## 目标

修复归档计划拆分后的两个行为缺陷：

1. 多个 `RENAMED` entry 同时存在时，引用更新不得被重复应用、不得读取已删除的 task 文件，也不得丢失位于另一个被 rename spec 中的结构化引用。
2. `planArchiveChange` 必须保持只读；proposal 校验失败不得默认写入 `.spec-manager/audit.json`。R24 audit 由有副作用的 `archiveChange` facade 负责记录。

保持 `archiveChange` 公共 API、CLI 输出字段、事务 rollback 和单 rename 行为兼容。

## 代码调查

- `src/core/archive.ts` 在每个 `RENAMED` entry 内调用 `applyArchiveReferenceUpdates(plan.referenceUpdates, tx)`，导致整个更新批次被重复消费。
- task reference update 第一次消费后会删除旧 task 文件，后续 rename 再消费同一计划时会读取不存在的旧路径。
- spec reference update 使用 planning 时记录的旧文件路径；若引用所在 spec 也被 rename，过早写入旧路径的更新会在 rename 时被删除。
- `src/core/archive-plan.ts` 的 `validateChangeProposal` 默认调用 `recordAuditHit`，使公开的 planning API 在失败路径写 audit 文件，违反只读契约。

## 实施步骤

### Step 1 - 建立回归测试

- 在 `src/core/__tests__/archive.test.ts` 增加多 rename 回归：
  - 两个被 rename spec 含相互或跨 rename 的结构化引用；
  - 至少一个被 rename spec 存在 task；
  - 归档成功后新 spec 和新 task 文件存在、旧文件不存在、引用全部指向新 code。
- 在 `src/core/__tests__/archive-plan.test.ts` 增加失败 planning 只读性回归：
  - proposal 无效时抛 R24；
  - 调用前后 audit 文件内容完全一致。

### Step 2 - 修复引用更新应用边界

- 修改 `src/core/archive.ts`，避免在每个 rename 中重复消费整个 `referenceUpdates`。
- 所有 spec rename 完成后再应用引用更新，或提供等价的路径重写/分组机制，确保更新目标使用最终路径。
- task、decision、incident、change proposal 更新每条仅应用一次。
- 保持任一 apply 失败时事务 rollback 并保留 `changes/<name>/`。

### Step 3 - 恢复 planning 只读性

- 修改 `src/core/archive-plan.ts`，`planArchiveChange` 和 proposal 校验默认不写 audit。
- 修改 `src/core/archive.ts`，在 `archiveChange` 的 R24 失败路径记录 audit，保持归档命令审计语义。
- 允许显式注入 collecting sink 用于调用方观察事件，但不得因默认 sink 破坏 planning 只读性。

### Step 4 - 验证

- 运行归档专项测试。
- 运行 `npm test`。
- 运行 `npm run lint`。
- 运行 `spec-manager project doctor`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
spec-manager project doctor
```

## 验收标准

1. **AC-1**: 同一 change 包含多个 `RENAMED` entry 时归档成功，引用和 task 文件迁移至最终 code，且无数据丢失。
2. **AC-2**: 每条 planned reference update 至多应用一次，应用目标使用最终文件路径。
3. **AC-3**: 直接调用 `planArchiveChange` 的成功和失败路径均不修改 specs、changes、archive 或 audit。
4. **AC-4**: 通过 `archiveChange` 触发 R24 失败时仍记录 R24 audit。
5. **AC-5**: 归档专项测试、全量测试、lint 和 project doctor 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.6-archive-review-fixes"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充多 rename 与 planning audit 只读性回归测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "修复归档引用更新应用边界"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "恢复 planArchiveChange 默认只读并保留 archiveChange R24 审计"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "运行归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修复涉及归档写入顺序、引用迁移和审计副作用边界，需要人工审批后执行。

## 回滚方案

若多 rename 或 rollback 行为回归，回退本修复变更并保留新增失败测试；若 audit 语义回归，恢复 `archiveChange` facade 的 R24 捕获记录逻辑。
