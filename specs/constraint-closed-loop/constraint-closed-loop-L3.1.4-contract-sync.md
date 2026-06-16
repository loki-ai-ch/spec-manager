---
code: constraint-closed-loop-L3.1.4-contract-sync
level: L3
title: 完成门禁规格契约对账
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L2.1
status: implemented
aiSummary: >-
  处理 constraint-closed-loop-L3.1.2-hooks 完成后的规格漂移：对账
  constraint-closed-loop-L2.1/L3.1.2 的 task-completion 模块路径、R5 后且级联前的验证顺序、scoped
  skip + reason 审计契约与 lastFailedOutput 数据模型，并解除关联 change proposal。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 核对 change proposal、父 L2/L3.1.2 与完成门禁实现
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 对账 constraint-closed-loop-L2.1 完成门禁契约
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 对账 constraint-closed-loop-L3.1.2-hooks 实施记录
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证规格一致性与完成门禁专项测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 解除 change proposal 并验证 npm test + lint + build + project doctor
    status: pending
created: '2026-06-15T09:32:16.807Z'
updated: '2026-06-15T09:47:21.940Z'
changeSummary: 交付收口：跨层引用改用明确 spec code，清除 R14 警告
---
# 完成门禁规格契约对账 — 实施规格

## 目标

处理 change proposal `constraint-closed-loop-l3-1-2-hooks-t-001-proposal`：将 `constraint-closed-loop-L2.1` 与 `constraint-closed-loop-L3.1.2-hooks` 中已过时的完成门禁描述，对账为当前已实现且已验证的契约。

本 L3 仅修正规格文档，不修改运行时代码。对账基准为：

- 完成应用用例位于 `src/core/task-completion.ts`，`src/core/task.ts` 的 `completeTask()` 为兼容 facade。
- 完成门禁顺序为 task/L3 status → R5 steps → verification evidence → 验证命令 → `@verify` → lifecycle cascade → R18。
- 验证命令和 `@verify` SHALL 在生命周期级联前执行；失败 SHALL 拒绝完成。
- `--force` 已废弃；异常恢复使用独立的 `--skip-r18`、`--skip-verification`、`--skip-verify`，任一 skip SHALL 提供 `--reason` 并记录审计事件。
- 失败上下文通过 `TaskRecord.lastFailedOutput` 持久化，并注入后续 step/harness warnings。

**前置依赖**:

- `constraint-closed-loop-L3.1.2-hooks` implemented
- `constraint-closed-loop-L3.1.3-audit` implemented
- change proposal `constraint-closed-loop-l3-1-2-hooks-t-001-proposal` unresolved

## 实施步骤

### Step 1 — 上下文收集与偏差清单确认

- SHALL 读取 `constraint-closed-loop-L3.1.4-contract-sync`、`constraint-closed-loop-L2.1`、`constraint-closed-loop-L3.1.2-hooks`、关联 change proposal 和 `templates/agent-plan.json`。
- SHALL 核对以下实际实现与测试：
  - `src/core/task-completion.ts`
  - `src/core/task.ts`
  - `src/cli/task.ts`
  - `src/core/__tests__/task-completion.test.ts`
  - `src/core/__tests__/task-complete-verify.test.ts`
  - `src/cli/__tests__/task.test.ts`
- SHALL 生成明确偏差清单，至少覆盖模块路径、门禁顺序、skip/reason、失败上下文数据模型。

完成后 step_report outputJson:

```json
{"summary":"核对 change proposal、constraint-closed-loop-L2.1/L3.1.2 与当前完成门禁实现，确认规格偏差清单","files":["src/core/task-completion.ts","src/core/task.ts","src/cli/task.ts"]}
```

### Step 2 — 对账 constraint-closed-loop-L2.1 完成门禁契约

- SHALL 更新 `constraint-closed-loop-L2.1`：
  - 将 `--force` 逃生口替换为 scoped skip + required reason + audit 记录。
  - 将完成门禁模块从旧 `task.ts/completeTaskUnlocked()` 描述更新为 `task-completion.ts` 应用用例。
  - 将门禁顺序更新为当前实现，明确验证在 R5 后、lifecycle cascade 前执行。
  - 将失败上下文描述更新为 `lastFailedOutput` 持久化，而非“不改 task JSON 结构”。
  - 保持 verification layer、audit compliance 与 `@verify` 已实现契约不变。
- SHALL 使用 `spec-manager spec update` 更新正文与 aiSummary，不直接手工修改 frontmatter。

完成后 step_report outputJson:

```json
{"summary":"对账 constraint-closed-loop-L2.1 的完成门禁模块、顺序、scoped bypass 与失败上下文数据模型","files":["specs/constraint-closed-loop/constraint-closed-loop-L2.1.md"]}
```

### Step 3 — 对账 L3.1.2 实施记录

- SHALL 更新 `constraint-closed-loop-L3.1.2-hooks`：
  - 将旧 `completeTaskUnlocked()` / `src/core/task.ts` 完成逻辑描述更新为 `runTaskCompletion()` / `src/core/task-completion.ts`。
  - 将“验证在 R5 前执行”更新为“R5 和 verification evidence 后、生命周期级联前执行”。
  - SHALL 保留 scoped skip + reason、verification layer、lastFailedOutput 和已完成测试记录。
  - SHALL 将实施步骤表述调整为历史对账后的真实结果，不伪造未发生的执行。
- SHALL 使用 `spec-manager spec update` 更新正文与 aiSummary。

完成后 step_report outputJson:

```json
{"summary":"对账 L3.1.2 的实际完成模块、门禁顺序与执行记录","files":["specs/constraint-closed-loop/constraint-closed-loop-L3.1.2-hooks.md"]}
```

### Step 4 — 验证规格与实现一致性

- SHALL 运行：

```bash
spec-manager spec validate constraint-closed-loop-L2.1
spec-manager spec validate constraint-closed-loop-L3.1.2-hooks
rg -n -- "--force|completeTaskUnlocked|在 R5 检查.*之前|不改 task JSON 结构" specs/constraint-closed-loop/constraint-closed-loop-L2.1.md specs/constraint-closed-loop/constraint-closed-loop-L3.1.2-hooks.md
npm test -- --run src/core/__tests__/task-completion.test.ts src/core/__tests__/task-complete-verify.test.ts src/cli/__tests__/task.test.ts
```

- `rg` MAY 匹配“`--force` 已废弃”与历史兼容测试描述，但 SHALL NOT 匹配将 `--force` 描述为有效逃生口的内容。

完成后 step_report outputJson:

```json
{"summary":"规格校验与完成门禁专项测试通过，旧契约描述已清除","tests":["spec-manager spec validate","rg drift scan","targeted completion tests"]}
```

### Step 5 — 解除 change proposal 并全量验证

- SHALL 在对账完成后执行：

```bash
spec-manager change resolve constraint-closed-loop-l3-1-2-hooks-t-001-proposal
npm test
npm run lint
npm run build
spec-manager project doctor
```

- SHALL 确认 change proposal 状态为 `resolved`。

完成后 step_report outputJson:

```json
{"summary":"解除完成门禁规格漂移 proposal，并通过全量测试、类型检查、构建与项目诊断","tests":["npm test","npm run lint","npm run build","spec-manager project doctor"]}
```

## 验收标准

- `constraint-closed-loop-L2.1` SHALL 将完成门禁应用用例定位到 `src/core/task-completion.ts`。
- `constraint-closed-loop-L2.1` 与 `constraint-closed-loop-L3.1.2-hooks` SHALL 描述验证门禁在 R5 后、生命周期级联前执行。
- `constraint-closed-loop-L2.1` 与 `constraint-closed-loop-L3.1.2-hooks` SHALL 将 `--force` 描述为废弃，并以 scoped skip + required reason 作为异常恢复契约。
- `constraint-closed-loop-L2.1` SHALL 描述 `TaskRecord.lastFailedOutput` 持久化模型。
- 关联 change proposal SHALL 在规格对账与验证完成后变为 resolved。
- 本 L3 SHALL NOT 修改运行时代码。
- @verify: file-exists(src/core/task-completion.ts)
- @verify: export-exists(src/core/task-completion.ts, runTaskCompletion)
- @verify: command(npm run lint)
- @verify: command(npm test)

## 验证命令

```bash
spec-manager spec validate constraint-closed-loop-L2.1
spec-manager spec validate constraint-closed-loop-L3.1.2-hooks
npm test -- --run src/core/__tests__/task-completion.test.ts src/core/__tests__/task-complete-verify.test.ts src/cli/__tests__/task.test.ts
npm test
npm run lint
npm run build
spec-manager project doctor
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "shell",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["constraint-closed-loop-L3.1.4-contract-sync"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "核对 change proposal、constraint-closed-loop-L2.1/L3.1.2 与完成门禁实现"},
    {"stepNo": 2, "stepType": "tool_action", "name": "对账 constraint-closed-loop-L2.1 完成门禁契约"},
    {"stepNo": 3, "stepType": "tool_action", "name": "对账 constraint-closed-loop-L3.1.2-hooks 实施记录"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证规格一致性与完成门禁专项测试"},
    {"stepNo": 5, "stepType": "tool_action", "name": "解除 change proposal 并验证 npm test + lint + build + project doctor"}
  ]
}
```

autoConfirm=false — 需人工确认允许通过 follow-up L3 对账已 implemented 的 `constraint-closed-loop-L2.1` 与 `constraint-closed-loop-L3.1.2-hooks` 正文。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 对账正文错误改变既有契约 | 恢复 L2/L3.1.2 正文并保持 change proposal unresolved | < 5 min |
| 对账后专项测试显示实现不符合契约 | 停止 resolve proposal，新增独立实现修复 L3 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| implemented 规格被无依据重写 | 所有修改 SHALL 以 change proposal、源码和测试为依据 |
| 历史实施记录与当前架构混淆 | 明确标注实际完成模块和兼容 facade，不伪造历史执行 |
| 提前 resolve proposal 掩盖偏差 | 仅在规格校验和专项测试通过后 resolve |

## 关联

| 关联类型 | 目标 | 说明 |
|---|---|---|
| based_on | constraint-closed-loop-L2.1 | 父 L2 |
| follows | constraint-closed-loop-L3.1.2-hooks | 对账已完成实现 |
| resolves | constraint-closed-loop-l3-1-2-hooks-t-001-proposal | 解除完成后规格漂移 |
