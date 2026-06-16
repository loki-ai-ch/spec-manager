---
code: architecture-refactor-L3.1.3-snapshot
level: L3
title: 项目只读快照与索引模型
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  本 L3 规定 ProjectSnapshot 只读快照与索引模型：新增 project-snapshot 模块统一读取
  specs/tasks/decisions/incidents/changes，派生常用索引，并将
  integrity、usability、view、lifecycle 的只读路径接入同一快照口径，保持 CLI 与公共 API 兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      收集 snapshot 上下文: 读取
      architecture-refactor-L3.1.3-snapshot、architecture-refactor-L2.1、历史任务、agent-plan
      和只读模块源码
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: '新增 ProjectSnapshot 模块: 编辑 src/core/project-snapshot.ts'
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: '接入 integrity 快照索引: 编辑 src/core/integrity.ts 和 src/core/project-snapshot.ts'
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: >-
      接入 usability 和 view 快照读取: 编辑 src/core/usability.ts、src/core/view.ts 和
      src/core/project-snapshot.ts
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: >-
      接入 lifecycle readiness 快照索引: 编辑 src/core/lifecycle.ts 和
      src/core/project-snapshot.ts
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: >-
      导出 ProjectSnapshot 并新增专项测试: 编辑 src/index.ts 和
      src/core/__tests__/project-snapshot.test.ts
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: >-
      回归 snapshot 相关只读链路: 运行 project-snapshot、integrity、usability、view、lifecycle
      测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: >-
      验证 ProjectSnapshot 重构: 运行 npm test、npm run lint、spec-manager project
      doctor
    status: pending
relations:
  - type: based_on
    target: architecture-refactor-L2.1
  - type: references
    target: architecture-refactor-L3.1.2-spec-policy
  - type: references
    target: architecture-refactor-L3.1.1-task-completion
created: '2026-06-11T07:51:26.327Z'
updated: '2026-06-11T08:03:04.191Z'
changeSummary: 'cascade: task-complete'
---
# 项目只读快照与索引模型 — 实施规格

## 目标

实施 architecture-refactor-L2.1 的 ProjectSnapshot 交付物：新增只读项目快照模块，统一读取 specs、tasks、decisions、incidents、task-linked changes，并派生常用索引；将 doctor、flow、integrity、view、lifecycle 的只读判断路径接入同一快照口径，同时保持现有 CLI 输出、存储格式和公共 facade 兼容。

**前置依赖**: architecture-refactor-L3.1.2-spec-policy 已 implemented。

## 代码调查

- `src/core/integrity.ts:24` 的 `inspectProjectIntegrity` 每次自行读取 `listAllSpecs`、`listTasks`、`listDecisions`、`listIncidents`、`listTaskLinkedChangeProposals`，并在 `taskFileHint` 中再次调用 `listAllSpecs`。
- `src/core/usability.ts:25` 的 `runProjectDoctor` 自行读取 specs，再调用 `inspectProjectIntegrity` 触发另一轮读取；`getFlowStatus` 与 `suggestAfterSpecCommand` 也分别读取 specs/tasks。
- `src/core/view.ts:30` 的 `buildViewModel` 先读取 specs/tasks，又调用 `getFlowStatus` 导致重复读取与重复 topic 分组。
- `src/core/lifecycle.ts:38` 的 `assessImplementationReadiness` 通过 `findSpecByCode` 与 `listAllSpecs` 构造 parent/children 判断；cascade 递归中会重复读取。
- `src/core/task.ts:215` 的 `listTasks` 支持 `specCode/status/topic` 过滤，但 topic 过滤会再次读取 specs 构造 specCode 集合。
- `src/core/decision.ts:42`、`src/core/incident.ts:39`、`src/core/delta.ts:181` 已提供现成列表读取接口，适合作为 snapshot 的仓储输入。

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- SHALL 执行 `spec-manager spec show architecture-refactor-L3.1.3-snapshot --include-content`。
- SHALL 执行 `spec-manager spec show architecture-refactor-L2.1 --include-content`。
- SHALL 执行 `spec-manager task list --topic architecture-refactor`，确认 `architecture-refactor-L3.1.2-spec-policy` 的 task 已 completed。
- SHALL 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `coveredSpecs`、`steps`、`stepNo`、`stepType`、`name`。
- SHALL 读取并记录实现锚点：`src/core/integrity.ts`、`src/core/usability.ts`、`src/core/view.ts`、`src/core/lifecycle.ts`、`src/core/task.ts`、`src/core/decision.ts`、`src/core/incident.ts`、`src/core/delta.ts`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 architecture-refactor-L3.1.3-snapshot、architecture-refactor-L2.1、历史任务、agent-plan 和只读模块源码分析","files":[]}
  ```

### Step 2 — 新增 ProjectSnapshot 模块

- SHALL 新增 `src/core/project-snapshot.ts`。
- SHALL 定义并导出：
  - `ProjectSnapshot`
  - `ProjectSnapshotInclude`
  - `ProjectSnapshotIndexes`
  - `BuildProjectSnapshotOptions`
  - `buildProjectSnapshot`
- SHALL 在 snapshot 中包含只读集合：`specs`、`tasks`、`decisions`、`incidents`、`changes`。
- SHALL 派生 indexes：`specByCode`、`tasksBySpec`、`childrenByParent`、`decisionsByDocCode`、`decisionById`、`taskByKey`、`changesByTaskKey`。
- SHALL 支持 `include` 选项；默认读取 specs/tasks/decisions/incidents/changes 全量集合。
- SHOULD 支持 `topic` 过滤，但不得改变现有 `listAllSpecs` / `listTasks` 的公共行为。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 ProjectSnapshot 只读模型与常用索引构建能力","files":["src/core/project-snapshot.ts"]}
  ```

### Step 3 — 接入 integrity 只读检查

- SHALL 修改 `src/core/integrity.ts`，使 `inspectProjectIntegrity` 默认构建或接收 `ProjectSnapshot`。
- SHALL 保持 `inspectProjectIntegrity(paths)` 现有调用签名兼容；MAY 通过可选参数注入 snapshot。
- SHALL 用 `snapshot.indexes.specByCode` 替代本地 `specCodes` 派生，用 `tasksBySpec` / `taskByKey` / `decisionById` / `changes` 替代重复扫描。
- SHALL 修复 `taskFileHint` 依赖 `listAllSpecs(paths)` 的重复读取，改用 snapshot 或 spec index 推导 topic。
- 完成后 step_report outputJson:
  ```json
  {"summary":"integrity 接入 ProjectSnapshot 并移除重复只读扫描","files":["src/core/integrity.ts","src/core/project-snapshot.ts"]}
  ```

### Step 4 — 接入 usability 与 view 只读展示

- SHALL 修改 `src/core/usability.ts`，让 `runProjectDoctor`、`getFlowStatus`、`suggestAfterSpecCommand`、`getUpstreamFreezeAdvice` 优先复用 `ProjectSnapshot` 或 snapshot indexes。
- SHALL 保持现有函数签名兼容；新增可选参数时不得要求 CLI 调用方改参。
- SHALL 修改 `src/core/view.ts`，让 `buildViewModel` 基于一次 snapshot 构建 specs/tasks/flows，避免 `getFlowStatus` 触发第二轮读取。
- SHALL 保持 `TOPIC_NOT_FOUND` 错误关键词、`nextAction` 文案和 view model 字段兼容。
- 完成后 step_report outputJson:
  ```json
  {"summary":"usability 与 view 接入 ProjectSnapshot，保持 CLI 展示兼容","files":["src/core/usability.ts","src/core/view.ts","src/core/project-snapshot.ts"]}
  ```

### Step 5 — 接入 lifecycle readiness

- SHALL 修改 `src/core/lifecycle.ts`，让 `assessImplementationReadiness` 可接收 `ProjectSnapshot` 或 snapshot indexes。
- SHALL 保持 `assessImplementationReadiness(paths, specCode, authority)` 和 `cascadeImplementedHierarchy(options)` 兼容。
- SHALL 在 readiness 判断中使用 `childrenByParent` 获取 direct children，保持 blocker：`missing-spec`、`wrong-status`、`no-children`、`children-incomplete`、`authority-not-allowed` 不变。
- SHOULD 在 cascade 递归中避免每层重复 `listAllSpecs`；如需要写后刷新，必须解释并保留行为正确性。
- 完成后 step_report outputJson:
  ```json
  {"summary":"lifecycle readiness 接入 ProjectSnapshot 索引并保持 cascade 行为兼容","files":["src/core/lifecycle.ts","src/core/project-snapshot.ts"]}
  ```

### Step 6 — 导出与专项测试

- SHALL 更新 `src/index.ts` 导出 `src/core/project-snapshot.ts`，不得移除既有导出。
- SHALL 新增 `src/core/__tests__/project-snapshot.test.ts`。
- SHALL 覆盖 snapshot 构建：specByCode、childrenByParent、tasksBySpec、taskByKey、decisionsByDocCode、decisionById、changesByTaskKey。
- SHALL 覆盖 topic/include 过滤：指定 topic 只返回该 topic 的 specs/tasks/decisions/changes；未 include 的集合为空且索引为空。
- SHALL 覆盖消费者兼容：`inspectProjectIntegrity`、`getFlowStatus`、`buildViewModel`、`assessImplementationReadiness` 的关键输出与原行为一致。
- 完成后 step_report outputJson:
  ```json
  {"summary":"导出 ProjectSnapshot 并新增快照与消费者兼容测试","files":["src/index.ts","src/core/__tests__/project-snapshot.test.ts"]}
  ```

### Step 7 — 回归只读链路

- SHALL 执行 `npm test -- src/core/__tests__/project-snapshot.test.ts src/core/__tests__/integrity.test.ts src/core/__tests__/usability.test.ts src/core/__tests__/view.test.ts src/core/__tests__/lifecycle.test.ts src/cli/__tests__/view.test.ts src/cli/__tests__/usability.test.ts`，预期全部 passed。
- SHALL 搜索 `src/core/integrity.ts`、`src/core/usability.ts`、`src/core/view.ts`、`src/core/lifecycle.ts` 中重复 `listAllSpecs` / `listTasks` 读取点，确认已由 snapshot 或兼容 facade 集中处理。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 snapshot 相关核心与 CLI 展示回归，并确认重复只读扫描已收敛","files":["src/core/project-snapshot.ts","src/core/integrity.ts","src/core/usability.ts","src/core/view.ts","src/core/lifecycle.ts"]}
  ```

### Step 8 — 验证

- SHALL 执行 `npm test`，预期所有 test files 和 tests passed。
- SHALL 执行 `npm run lint`，预期 TypeScript noEmit 成功。
- SHALL 执行 `spec-manager project doctor`，预期输出包含 `Project doctor: ok`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成全量测试、类型检查和 project doctor 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: snapshot 与消费者回归测试通过
npm test -- src/core/__tests__/project-snapshot.test.ts src/core/__tests__/integrity.test.ts src/core/__tests__/usability.test.ts src/core/__tests__/view.test.ts src/core/__tests__/lifecycle.test.ts src/cli/__tests__/view.test.ts src/cli/__tests__/usability.test.ts
# 预期输出包含: project-snapshot.test.ts
# 预期输出包含: passed

# 正向验证: 全量测试通过
npm test
# 预期输出包含: Test Files
# 预期输出包含: passed

# 正向验证: TypeScript 类型检查通过
npm run lint
# 预期输出不包含: error TS

# 正向验证: 项目诊断保持 ok
spec-manager project doctor
# 预期输出包含: Project doctor: ok
```

## 验收标准

1. **AC-1**: `src/core/project-snapshot.ts` SHALL 存在，并导出 `buildProjectSnapshot`、`ProjectSnapshot`、`ProjectSnapshotIndexes`。
2. **AC-2**: snapshot SHALL 提供 `specByCode`、`tasksBySpec`、`childrenByParent`、`decisionById`、`taskByKey`、`changesByTaskKey` 索引。
3. **AC-3**: `inspectProjectIntegrity`、`runProjectDoctor`、`getFlowStatus`、`buildViewModel`、`assessImplementationReadiness` SHALL 保持现有公共调用签名兼容。
4. **AC-4**: `project-snapshot.test.ts` SHALL 覆盖索引构建、topic/include 过滤和消费者兼容路径。
5. **AC-5**: `npm test`、`npm run lint`、`spec-manager project doctor` SHALL 全部通过。

@verify: file-exists(src/core/project-snapshot.ts)
@verify: export-exists(src/core/project-snapshot.ts, buildProjectSnapshot)
@verify: export-exists(src/core/project-snapshot.ts, ProjectSnapshot)
@verify: export-exists(src/core/project-snapshot.ts, ProjectSnapshotIndexes)
@verify: command(npm test -- src/core/__tests__/project-snapshot.test.ts)

## step_report 模板

每步完成后调用 `spec-manager task step`，不得预报。示例：

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.3-snapshot"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集 snapshot 上下文: 读取 architecture-refactor-L3.1.3-snapshot、architecture-refactor-L2.1、历史任务、agent-plan 和只读模块源码"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 ProjectSnapshot 模块: 编辑 src/core/project-snapshot.ts"},
    {"stepNo": 3, "stepType": "tool_action", "name": "接入 integrity 快照索引: 编辑 src/core/integrity.ts 和 src/core/project-snapshot.ts"},
    {"stepNo": 4, "stepType": "tool_action", "name": "接入 usability 和 view 快照读取: 编辑 src/core/usability.ts、src/core/view.ts 和 src/core/project-snapshot.ts"},
    {"stepNo": 5, "stepType": "tool_action", "name": "接入 lifecycle readiness 快照索引: 编辑 src/core/lifecycle.ts 和 src/core/project-snapshot.ts"},
    {"stepNo": 6, "stepType": "tool_action", "name": "导出 ProjectSnapshot 并新增专项测试: 编辑 src/index.ts 和 src/core/__tests__/project-snapshot.test.ts"},
    {"stepNo": 7, "stepType": "tool_action", "name": "回归 snapshot 相关只读链路: 运行 project-snapshot、integrity、usability、view、lifecycle 测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证 ProjectSnapshot 重构: 运行 npm test、npm run lint、spec-manager project doctor"}
  ]
}
```

autoConfirm: false。理由：本 L3 改动 doctor/flow/integrity/view/lifecycle 等多条只读链路，应保留人工审批后再执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| snapshot 接入导致 doctor 或 view 输出回归 | `git revert <commit>` 后重新运行相关 CLI 测试 | < 5 min |
| snapshot 索引与现有读取口径不一致 | 回退消费者接入，仅保留未使用的 `project-snapshot.ts` 再补测试 | < 10 min |
| lifecycle cascade 因快照陈旧误判 | 回退 lifecycle 接入，保留原 `findSpecByCode/listAllSpecs` 读取路径 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 写操作后 snapshot 变旧影响 cascade | lifecycle 写后需要重新评估时重新构建 snapshot，或限制 snapshot 只用于写前 readiness |
| topic 过滤导致 task/decision/change 集合遗漏 | snapshot tests 覆盖跨 topic 数据，索引只包含过滤后的集合 |
| include 选项为空集合时消费者误用 | indexes 与集合同步为空，消费者默认使用全量 include |
| CLI 输出顺序变化 | 保留现有 sort 规则：spec code、task created、topic alphabetical，并运行 CLI view/usability 回归 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | architecture-refactor-L2.1 | 引用父 L2 的 ProjectSnapshot 设计 |
| references | architecture-refactor-L3.1.2-spec-policy | 依赖上一段 spec policy 拆分已 implemented |
| references | architecture-refactor-L3.1.1-task-completion | task completion 后续 cascade/readiness 需复用快照口径 |
