---
code: constraint-closed-loop-L3.1.3-audit
level: L3
title: audit compliance 格式统一
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L2.1
status: implemented
aiSummary: >-
  收口 audit compliance 文本契约：运行时 PASS/FAIL 已实现；本 L3 修正遗漏 R18
  的代码注释，并强化主行无图标、details 保留图标、R18 基线的精确测试。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 核对 audit.ts、audit.test.ts 与 cli/audit.ts 既有实现
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修正 audit.ts 的 R18 合规基线注释
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 强化 audit.test.ts 的 compliance 精确格式断言
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证 audit 专项测试与真实 CLI 输出
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm test + npm run lint + npm run build
    status: pending
created: '2026-06-10T14:00:00.000Z'
updated: '2026-06-15T09:47:14.657Z'
changeSummary: 交付收口：跨层引用改用明确 spec code，清除 R14 警告
---
# audit compliance 格式统一 — 实施规格

## 目标

实施 `constraint-closed-loop-L2.1` 的 deliverable 3 / AC-5：固定 `audit show` 的 compliance 文本契约为 `compliance: PASS|FAIL`，主行不得带 `✓/✗` 前缀，details 行继续保留状态前缀；同时统一 R18 合规基线的代码注释与测试契约。

**前置依赖**: `constraint-closed-loop-L3.1.2-hooks` implemented。

当前代码调查结论：

- `src/core/audit.ts` 的运行时输出已经使用 `compliance: PASS|FAIL`。
- `COMPLIANCE_BASELINE` 已包含 `R18`。
- `checkCompliance()` 上方注释仍遗漏 `R18`，与运行时基线不一致。
- 现有测试使用宽松 `toContain()`，无法阻止 `compliance: ✓ PASS` / `compliance: ✗ FAIL` 回归。

## 实施步骤

### Step 1 — 上下文收集与既有实现核对

- SHALL 读取 `constraint-closed-loop-L3.1.3-audit`、`constraint-closed-loop-L2.1`、同主题历史任务和 `templates/agent-plan.json`。
- SHALL 核对：
  - `src/core/audit.ts` 的 `COMPLIANCE_BASELINE`、`showSummary()`、`checkCompliance()`
  - `src/core/__tests__/audit.test.ts` 的 PASS、FAIL、details 与 R18 基线覆盖
  - `src/cli/audit.ts` 的 `audit show` 调用路径
- SHALL 记录当前 `showSummary()` 已满足主行格式，不重复修改已正确的运行时逻辑。

完成后 step_report outputJson:

```json
{"summary":"核对 audit compliance 运行时格式、R18 基线、测试与 CLI 调用路径","files":["src/core/audit.ts","src/core/__tests__/audit.test.ts","src/cli/audit.ts"]}
```

### Step 2 — 统一 R18 合规基线代码契约

- SHALL 保持 `COMPLIANCE_BASELINE` 为：

```typescript
['R1', 'R4', 'R13', 'R18', 'R22']
```

- SHALL 修正 `checkCompliance()` 上方注释，使其明确包含 `R18≥1`。
- SHALL 不降低或改变现有运行时合规基线。

完成后 step_report outputJson:

```json
{"summary":"修正 checkCompliance 注释并确认 R18 保持在合规基线中","files":["src/core/audit.ts"]}
```

### Step 3 — 强化 compliance 精确格式测试

- SHALL 更新 `src/core/__tests__/audit.test.ts`：
  - PASS 场景提取以 `compliance:` 开头的完整行，并精确断言等于 `compliance: PASS`。
  - FAIL 场景提取以 `compliance:` 开头的完整行，并精确断言等于 `compliance: FAIL`。
  - SHALL 断言 compliance 主行不包含 `✓` 或 `✗`。
  - SHALL 断言 details 行继续包含成功 `✓` 与失败 `✗` 前缀。
  - SHALL 保留 `COMPLIANCE_BASELINE` 精确包含 R18 的断言。

完成后 step_report outputJson:

```json
{"summary":"强化 audit compliance PASS/FAIL 主行与 details 前缀契约测试","files":["src/core/__tests__/audit.test.ts"]}
```

### Step 4 — 专项验证

- SHALL 运行：

```bash
npm test -- --run src/core/__tests__/audit.test.ts
npm run build
node dist/cli/index.js audit show
```

- SHALL 确认真实 CLI 输出的 compliance 主行严格为 `compliance: PASS` 或 `compliance: FAIL`。

完成后 step_report outputJson:

```json
{"summary":"audit 专项测试与真实 CLI 输出格式通过","tests":["npm test -- --run src/core/__tests__/audit.test.ts","npm run build","node dist/cli/index.js audit show"]}
```

### Step 5 — 全量验证

- SHALL 运行：

```bash
npm test
npm run lint
npm run build
```

完成后 step_report outputJson:

```json
{"summary":"全量测试、类型检查与构建通过","tests":["npm test","npm run lint","npm run build"]}
```

## 验收标准

- `spec-manager audit show` SHALL 输出完整主行 `compliance: PASS` 或 `compliance: FAIL`。
- compliance 主行 SHALL NOT 包含 `✓` 或 `✗`。
- compliance details 行 SHALL 保持 `✓/✗` 前缀。
- `COMPLIANCE_BASELINE` 与其代码注释 SHALL 同时包含 `R18`。
- @verify: file-exists(src/core/audit.ts)
- @verify: export-exists(src/core/audit.ts, checkCompliance)
- @verify: command(npm run lint)
- @verify: command(npm test)

## 验证命令

```bash
npm test -- --run src/core/__tests__/audit.test.ts
npm test
npm run lint
npm run build
node dist/cli/index.js audit show
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
  "coveredSpecs": ["constraint-closed-loop-L3.1.3-audit"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "核对 audit.ts、audit.test.ts 与 cli/audit.ts 既有实现"},
    {"stepNo": 2, "stepType": "tool_action", "name": "修正 audit.ts 的 R18 合规基线注释"},
    {"stepNo": 3, "stepType": "tool_action", "name": "强化 audit.test.ts 的 compliance 精确格式断言"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证 audit 专项测试与真实 CLI 输出"},
    {"stepNo": 5, "stepType": "tool_action", "name": "验证 npm test + npm run lint + npm run build"}
  ]
}
```

autoConfirm=false — 需人工确认本 L3 仅修正文档契约和测试，不改动已正确的运行时输出。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 精确格式测试与既有兼容约束冲突 | 回滚测试断言和注释修改，重新评估文本输出契约 | < 2 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 下游脚本依赖带图标的 compliance 主行 | 使用真实 CLI 验证，并保持本 L3 不新增运行时格式变化 |
| 测试只验证子串导致格式回归漏检 | 对完整 compliance 行做精确断言 |
| 注释与运行时 R18 基线再次漂移 | 同时保留基线数组精确断言 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | constraint-closed-loop-L2.1 | 父 L2 |
| implements | constraint-closed-loop-L2.1 | 实现 deliverable 3 / AC-5 |
| follows | constraint-closed-loop-L3.1.2-hooks | 前置 L3 已 implemented |
