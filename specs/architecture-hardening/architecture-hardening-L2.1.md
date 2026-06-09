---
code: architecture-hardening-L2.1
level: L2
title: 架构一致性加固技术设计
topic: architecture-hardening
parentCode: architecture-hardening-L1
status: implemented
aiSummary: >-
  以 Core 领域守卫、仓库完整性扫描、项目级文件事务和完整 rename 计划加固一致性；拆为
  Task、路径/Core、doctor、事务/rename、兼容验证五个 L3。
created: '2026-06-08T09:33:35.374Z'
updated: '2026-06-09T01:36:43.887Z'
changeSummary: 'cascade: project-reconcile'
---
# 架构一致性加固技术设计

## 方案概述

本方案以 `architecture-hardening-L1` 为需求边界，在现有纯 Markdown/JSON、本地文件存储上增加统一的领域一致性层。核心原则是：

1. Core API 是领域规则的唯一强制入口，CLI 仅负责参数解析与展示。
2. 单文件写继续使用原子 rename；多文件写通过项目级互斥锁、预检、快照和回滚组成轻量事务。
3. 引用完整性由仓库扫描器统一检查，rename 等复合操作必须先生成完整迁移计划再提交。
4. 已完成或失败的 Task 作为历史记录不可变；修正必须创建新 Task 或显式 change proposal。
5. 诊断与修复分离：`project doctor` 只报告，不自动改写用户数据。

## 技术决策

### D1：新增 Core 领域守卫

在 `src/core/invariants.ts` 集中实现可复用守卫：

- `assertTaskMutable(task, operation)`：仅 `running` Task 可写 step/verification。
- `assertTaskCompletable(task)`：必须 running、全部计划步骤成功、至少存在一条 `exitCode=0` verification。
- `assertNoActiveTaskForSpec(paths, specCode)`：同一 L3 最多一个 draft/running/waiting Task。
- `assertSpecTransitionAllowed(record, target, cause)`：状态推进必须符合状态机，并区分 user/cascade/archive 原因。
- `assertRelationTargetExists(paths, target)`：结构化 relation 不允许新增悬空引用。

`src/core/task.ts`、`src/core/spec-io.ts` 和 `src/core/decision.ts` 必须调用守卫，调用者不能通过直接使用 Core API 绕过规则。

### D2：新增仓库级引用索引与完整性报告

在 `src/core/integrity.ts` 扫描现有本地文件，构建引用边：

- Spec `parentCode`
- Spec `relations[].target`
- Task `specCode`
- Decision `docCode`
- Incident `specCode/taskCode/relatedDecisions`
- Task-linked Change `specCode/taskCode`

输出结构化 `IntegrityIssue[]`，至少包含 `kind`、`sourceFile`、`sourceId`、`targetId`、`message` 和修复提示。

`project doctor` 调用扫描器并报告：

- 悬空引用
- 同一 L3 的冲突活动任务
- completed Task 缺少成功 verification
- implemented L1 缺少 Decision
- completed/failed Task 内存在非 succeeded 步骤

### D3：引入轻量项目级写事务

在 `src/core/transaction.ts` 提供：

- 项目锁文件：`.spec-manager/write.lock`
- 锁内容包含 pid、operation、createdAt；默认检测有效锁并失败，不静默覆盖。
- `FileTransaction` 在写入前记录目标文件是否存在及原始内容。
- 所有变更先完成预检，再进入锁内重新校验，再执行写入。
- 任一步失败时恢复快照并删除本次新建文件。
- 成功后释放锁；异常和正常路径均使用 `finally` 释放。

首批迁移复合操作：

- `completeTask` 的 task 状态与 Spec cascade
- `archiveChange` 的 Delta 应用与 change 目录归档
- Spec rename 的全部引用迁移
- `audit report` 的 audit 与 audit-archive 更新

单文件写仍使用 `src/core/frontmatter.ts` 的 `writeAtomic`。

### D4：Spec rename 使用迁移计划

在 `src/core/integrity.ts` 提供 `planSpecRename(paths, oldCode, newCode)`，列出所有需要修改或重命名的文件。

Archive 的 RENAMED 操作不再只修改目标 Spec，而是在事务中：

1. 校验新 code 与路径安全。
2. 构建并验证引用迁移计划。
3. 更新目标 Spec code 和文件名。
4. 更新全部结构化引用。
5. 重命名关联 task 文件并更新 `task.specCode`。
6. 提交前再次运行完整性扫描；存在新增悬空引用则回滚。

正文中的普通文本引用不自动改写，仅结构化 frontmatter/JSON 字段参与迁移。

### D5：收紧 Task 生命周期和快捷命令

- 删除 `task batch`，或保留命令名但立即返回弃用错误与替代命令；不得自动生成成功步骤。
- `reportStep` 只能修改 running Task，且 stepNo 必须已存在于计划中。
- `addTaskVerification` 只能写入 running Task。
- `completeTask` 必须存在至少一条成功 verification；失败 verification 可保留但不能满足完成条件。
- completed/failed Task 不可由普通命令修改。
- 同一 frozen L3 存在活动 Task 时拒绝创建新 Task。

### D6：统一路径边界校验

在 `src/core/paths.ts` 增加：

- `assertSafeChangeName(name)`
- `resolveWithin(baseDir, ...segments)`

所有 change 的 new/show/resolve/archive/read 路径必须通过同一校验。解析后路径必须等于 baseDir 或位于其子目录内，禁止 `..`、绝对路径和符号链接逃逸。

### D7：兼容与迁移策略

- 不自动修复已有不一致仓库。
- `project doctor` 首先报告问题和建议命令。
- completed Task 缺 verification 的历史数据保留，不能被新规则自动补写；如需补充，使用显式迁移命令或新 Task。
- 公共 API 保持现有函数名；新增严格校验可能使原本非法调用开始抛错，属于预期行为修正。

## 受影响模块

| 模块 | 当前职责 | 调整 |
|---|---|---|
| `src/core/task.ts` | Task 生命周期和级联 | 调用领域守卫；完成操作进入事务；完成后不可变 |
| `src/cli/task.ts` | Task CLI | 移除/弃用 batch 自动成功；展示 Core 错误 |
| `src/core/archive.ts` | Delta 应用和归档 | 使用项目事务与完整 rename 计划 |
| `src/core/delta.ts` | Change 解析与 proposal | 所有入口统一路径校验与原子写 |
| `src/core/spec-io.ts` | Spec 读写 | Core 状态转换、relation 目标与 schema 校验 |
| `src/core/invariants.ts` | 新模块 | 集中领域守卫 |
| `src/core/integrity.ts` | 新模块 | 引用索引、完整性扫描、rename 计划 |
| `src/core/transaction.ts` | 新模块 | 项目锁、快照、提交和回滚 |
| `src/core/audit.ts` | 审计数据 | report 复合写进入事务 |
| `src/core/paths.ts` | 路径模型 | change 名称和目录边界校验 |
| `src/cli/project.ts` | project doctor | 展示仓库级完整性问题 |
| `src/index.ts` | 公共 API | 导出严格 Core API 与结构化完整性类型 |

## 接口契约

```ts
export interface IntegrityIssue {
  kind:
    | 'dangling-reference'
    | 'conflicting-active-task'
    | 'missing-verification'
    | 'missing-decision'
    | 'immutable-history-violation';
  sourceFile: string;
  sourceId: string;
  targetId?: string;
  message: string;
  remediation?: string;
}

export function inspectProjectIntegrity(paths: ProjectPaths): IntegrityIssue[];

export interface RenamePlan {
  oldCode: string;
  newCode: string;
  writes: Array<{ filePath: string; description: string }>;
  renames: Array<{ from: string; to: string; description: string }>;
}

export function planSpecRename(paths: ProjectPaths, oldCode: string, newCode: string): RenamePlan;

export function withProjectTransaction<T>(
  paths: ProjectPaths,
  operation: string,
  callback: (tx: FileTransaction) => T,
): T;
```

错误契约使用稳定前缀，便于 CLI 和第三方调用者处理：

- `TASK_IMMUTABLE`
- `TASK_NOT_RUNNING`
- `TASK_ALREADY_ACTIVE`
- `VERIFICATION_REQUIRED`
- `INTEGRITY_VIOLATION`
- `WRITE_CONFLICT`
- `PATH_OUTSIDE_PROJECT`

## L3 裂变计划

1. **L3.1：Task 生命周期与流程绕过修复**  
   实现领域守卫，弃用 `task batch` 自动成功，强制活动任务唯一、完成前成功 verification、完成后不可变。

2. **L3.2：路径安全与 Core 输入规则收口**  
   实现 change 名称/目录边界校验、Spec schema/状态/relation 校验，并补齐公共 API 回归测试。

3. **L3.3：仓库完整性扫描与 doctor 诊断**  
   实现引用索引、完整性问题模型和 `project doctor` 输出，不自动修改已有仓库。

4. **L3.4：项目级事务与完整 rename**  
   实现项目锁、文件事务、失败回滚；迁移 `completeTask`、`archiveChange`、audit report，并实现结构化引用 rename。

5. **L3.5：兼容迁移与跨模块验证**  
   增加历史数据兼容策略、故障注入、并发冲突及端到端 CLI 测试，更新 README 与方法论文档。

## 代码调查

- Task 创建、步骤上报、验证与完成集中在 `src/core/task.ts`；当前 `reportStep` 和 `addTaskVerification` 未检查 Task 状态。
- 自动成功快捷路径位于 `src/cli/task.ts` 的 `task batch`。
- Delta rename 和有限回滚位于 `src/core/archive.ts`；当前只修改目标 Spec 文件。
- Change 路径由 `src/core/delta.ts` 的 `changeDir/getChangeDir` 拼接，读取入口未统一校验名称。
- Spec 写入与状态 patch 位于 `src/core/spec-io.ts`；`updateSpec` 当前允许直接写状态。
- 单文件原子写位于 `src/core/frontmatter.ts`，可继续作为事务的底层写原语。
- 审计读改写位于 `src/core/audit.ts`；`report` 同时写 audit 与 archive，当前无复合事务。
- `src/core/__tests__/archive.test.ts` 已覆盖部分失败回滚，可作为事务故障注入测试基础。
- `src/core/__tests__/task-cascade.test.ts` 已覆盖 Task 级联与 R5，可扩展完成后不可变和 verification 门禁测试。
