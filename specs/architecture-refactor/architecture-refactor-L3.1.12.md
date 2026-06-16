---
code: architecture-refactor-L3.1.12
level: L3
title: 归档链式 Rename 引用闭包修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 修复归档批量 rename 在链式 A→B→C 场景下引用停留于中间 code、产生悬空引用的问题。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 补充链式 rename 引用与 task 文件迁移回归测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 规划 rename 最终 code 闭包与冲突校验
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 应用结构化引用到最终 rename code
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:44:14.676Z'
updated: '2026-06-12T00:57:01.430Z'
changeSummary: 'cascade: task-complete'
---
# 归档链式 Rename 引用闭包修复

## 目标

修复归档计划与应用拆分后的链式 rename 引用回归。

当一个 change 包含：

```text
A -> B
B -> C
```

最终 spec code 为 `C`。所有原先引用 `A` 或 `B` 的结构化引用、task `specCode` 和文件名都必须迁移到最终 code `C`，不得停留在中间 code `B`。

## 代码调查

- 旧实现每应用一个 `RENAMED` entry 就立即执行 `migrateStructuredSpecReferences(oldCode, newCode)`；链式 rename 会先迁移到 `B`，再迁移到 `C`。
- 新实现先应用全部 rename，随后一次性执行 `applyArchiveReferenceUpdates`。
- `planReferenceUpdates(paths, B, C)` 只扫描应用前磁盘；此时由 `A -> B` 产生的新引用尚不存在，因此不会规划它们。
- `renamedCodes` 当前是直接映射 `A -> B`、`B -> C`，不是最终闭包 `A -> C`、`B -> C`。
- task update 仍使用每条 update 自带的 `newCode/newFilePath`，因此链式 rename 后 task 可能停在 `B`，而最终 spec 已是 `C`。

## 实施步骤

### Step 1 - 补充链式 rename 回归测试

- 归档 `A -> B -> C` 后，原 `A` 的子 spec `parentCode` 必须为 `C`。
- 原指向 `A` 或 `B` 的 relations 必须指向 `C`。
- 原 `A` task 的 `specCode` 和文件名必须直接迁移到 `C`，不得遗留 `A` 或 `B` 文件。
- decision、incident 和其他 change proposal 的 spec 引用必须迁移到 `C`。
- 归档后 `inspectProjectIntegrity` 不得报告由链式 rename 产生的 dangling reference。

### Step 2 - 规划最终 rename 闭包

- 从有序 rename entries 计算每个源 code 的最终目标 code。
- 检测 rename 环、自指向和无法解析的链，预检失败且不修改磁盘。
- task 目标文件冲突检查必须针对最终 code 路径执行。
- plan/reference update 应明确携带最终目标，不依赖 apply 时再次推断中间状态。

### Step 3 - 应用最终引用迁移

- 所有结构化引用更新直接写入最终 code。
- task 文件最多迁移一次，从原路径直接写入最终路径。
- 保持多个独立 rename、双向 relation、成功归档目录和失败回滚行为兼容。

### Step 4 - 验证

- 运行 archive/archive-plan/integrity/change CLI 专项测试。
- 运行全量测试、lint、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive.test.ts src/core/__tests__/archive-plan.test.ts src/core/__tests__/integrity.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: 链式 `A -> B -> C` 后，所有原 `A`/`B` 结构化引用直接指向最终 `C`。
2. **AC-2**: task `specCode` 和文件名最多迁移一次，最终只存在 `C` 路径。
3. **AC-3**: rename 环、自指向和最终 task 路径冲突在预检阶段失败，且不修改磁盘。
4. **AC-4**: 多个独立 rename、relations、decision、incident、change proposal、归档与回滚行为保持兼容。
5. **AC-5**: 专项测试、全量测试、lint、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.12"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "补充链式 rename 引用与 task 文件迁移回归测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "规划 rename 最终 code 闭包与冲突校验"},
    {"stepNo": 3, "stepType": "tool_action", "name": "应用结构化引用到最终 rename code"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改 rename 规划语义和跨文件引用迁移，需要人工批准。

## 回滚方案

若闭包规划影响独立 rename，保留链式回归测试并回退实现；可退回逐 entry 引用迁移，但必须继续满足预检冲突和事务回滚要求。
