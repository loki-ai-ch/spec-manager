---
code: architecture-hardening-L3.1.4-transaction
level: L3
title: 项目级事务与完整 rename
topic: architecture-hardening
parentCode: architecture-hardening-L2.1
status: implemented
aiSummary: 实现项目锁与文件事务，迁移复合写操作，并通过 rename 计划完整迁移结构化引用；已记录 audit 临时文件并发冲突复现。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 archive task audit 与原子写实现
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 实现项目锁和文件事务模块
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 迁移 audit report 与 task complete 事务
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 实现 Spec rename 引用迁移计划
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 迁移 archive rename 到事务提交
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 补充锁冲突故障注入和 rename 测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 验证事务 archive task audit 测试
    status: pending
created: '2026-06-08T09:35:15.375Z'
updated: '2026-06-08T09:48:16.292Z'
changeSummary: 'cascade: task complete'
---
# 项目级事务与完整 rename

## 目标

为跨文件复合写操作提供项目级互斥、预检、快照和失败回滚，并使 Spec rename 完整迁移全部结构化引用。

## 实施步骤

1. 创建 `src/core/transaction.ts`，实现 `.spec-manager/write.lock` 和 `FileTransaction`。
2. 将 `src/core/audit.ts` 的 report 迁移到事务内，避免 audit 与 archive 部分提交。
3. 将 `src/core/task.ts` 的 complete 与 Spec cascade 迁移到事务内。
4. 在 `src/core/integrity.ts` 增加 rename 迁移计划和引用重写能力。
5. 将 `src/core/archive.ts` 的 archive/RENAMED 改为预检后事务提交，并更新关联 Task 文件名与结构化引用。
6. 增加故障注入、锁冲突、完整 rename 和回滚测试。

## 验收标准

- 对应 `architecture-hardening-L1` 的 AC-3、AC-4、AC-8、AC-9。
- 复合写任一步失败时不留下部分提交。
- 并发写锁冲突明确返回 `WRITE_CONFLICT`。
- RENAMED 后不存在旧 code 的结构化悬空引用。
- 正文普通文本不被自动改写。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-hardening-L3.1.4-transaction"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 archive task audit 与原子写实现"},
    {"stepNo": 2, "stepType": "tool_action", "name": "实现项目锁和文件事务模块"},
    {"stepNo": 3, "stepType": "tool_action", "name": "迁移 audit report 与 task complete 事务"},
    {"stepNo": 4, "stepType": "tool_action", "name": "实现 Spec rename 引用迁移计划"},
    {"stepNo": 5, "stepType": "tool_action", "name": "迁移 archive rename 到事务提交"},
    {"stepNo": 6, "stepType": "tool_action", "name": "补充锁冲突故障注入和 rename 测试"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证事务 archive task audit 测试"}
  ]
}
```

## 验证命令

```bash
npm test -- --run src/core/__tests__/archive.test.ts src/core/__tests__/task-cascade.test.ts src/core/__tests__/audit.test.ts src/core/__tests__/integrity.test.ts
npm run lint
```

## 回滚

回滚各复合操作的事务接入和 rename 计划；保留 `writeAtomic` 单文件写。若事务提交失败，不得通过跳过完整性检查完成归档。

## 代码调查与复现证据

- `src/core/audit.ts` 当前使用 `.audit-${Date.now()}.tmp`，同一毫秒的并行规格更新会争用同一临时文件。
- 在创建本 L3 组时，并行执行 `spec update` 已复现 `ENOENT ... rename .audit-<timestamp>.tmp -> audit.json`。
- `src/core/frontmatter.ts` 已使用随机临时文件名，可作为单文件写实现参考，但仍不能解决跨文件一致性。
- `src/core/archive.ts` 已有局部 `ArchiveApplyTransaction`，可提取并扩展为通用项目事务。
