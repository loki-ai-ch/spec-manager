---
code: constraint-closed-loop-L3.1.3-audit
level: L3
title: audit compliance 格式统一
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L2.1
status: draft
created: '2026-06-10T14:00:00.000Z'
updated: '2026-06-10T14:00:00.000Z'
aiSummary: >-
  微调 audit showSummary compliance 输出格式：compliance 行去掉 ✓/✗ 前缀
  仅输出 PASS/FAIL；确认合规基线含 R18(已在代码中但 L1 描述略有过时)。
  变更极小，仅涉及 audit.ts 一行 + 测试更新。
---
# audit compliance 格式统一 — 实施规格

## 目标

实施 constraint-closed-loop-L2.1 的 deliverable 3：统一 `audit show` 的 compliance 输出格式为 `PASS | FAIL`，去掉 `✓/✗` 前缀。确认 R18 已在合规基线中。对应 AC-5。

**前置依赖**: 无（独立模块，与 L3.1.1/L3.1.2 无代码依赖）

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- `spec-manager spec show constraint-closed-loop-L3.1.3-audit --include-content`
- 执行 Level 3 文件级分析(R23):
  - Read `src/core/audit.ts` — 确认 `showSummary()`(line 170) 和 `checkCompliance()`(line 210) 的当前实现
  - Read `src/core/audit.ts` line 35 — 确认 `COMPLIANCE_BASELINE` 数组是否含 R18
  - Read `src/core/__tests__/audit.test.ts` — 确认现有 compliance 测试
  - Read `src/cli/audit.ts` — 确认 `audit show` 命令是否直接调用 `showSummary()`
- `Read templates/agent-plan.json` 确认 planJson 字段名(R12)

### Step 2 — 修改 showSummary()：compliance 行格式

- 修改 `src/core/audit.ts` 的 `showSummary()` 函数（line 189）：

```typescript
// 当前（line 189）:
lines.push(`compliance: ${baseline.pass ? '✓ PASS' : '✗ FAIL'}`);

// 改为:
lines.push(`compliance: ${baseline.pass ? 'PASS' : 'FAIL'}`);
```

- 仅去掉 compliance 行的 `✓/✗` 前缀
- details 行（`✓ R1: 3 (min 1)`）保持不变 — 已符合 L1 AC-5 要求
- 完成后 step_report outputJson:
  ```json
  {"summary": "showSummary compliance 行去掉 ✓/✗ 前缀，仅输出 PASS/FAIL", "files": ["src/core/audit.ts"]}
  ```

### Step 3 — 确认合规基线含 R18

- 确认 `src/core/audit.ts` 的 `COMPLIANCE_BASELINE`（约 line 35）包含 R18：

```typescript
const COMPLIANCE_BASELINE = ['R1', 'R4', 'R13', 'R18', 'R22'];
```

- 如果已包含 → 无需修改，记录确认
- 如果未包含 → 添加 R18
- L1 AC-5 的判定规则为：R1≥1 + R4≥1 + R13≥1 + R22≥1。代码实际已含 R18，比 L1 描述更严格。保持现状（含 R18），不降级。
- 完成后 step_report outputJson:
  ```json
  {"summary": "确认 COMPLIANCE_BASELINE 已含 R18，无需修改", "files": []}
  ```

### Step 4 — 更新测试

- 修改 `src/core/__tests__/audit.test.ts`：
  - 更新 compliance 输出断言：`compliance: PASS` 而非 `compliance: ✓ PASS`
  - 确认 FAIL 场景输出 `compliance: FAIL` 而非 `compliance: ✗ FAIL`
  - 确认 details 行仍使用 `✓/✗` 前缀
- 完成后 step_report outputJson:
  ```json
  {"summary": "更新 audit.test.ts compliance 格式断言", "files": ["src/core/__tests__/audit.test.ts"]}
  ```

### Step 5 — 验证

- `npm run lint` — 类型检查通过
- `npm test` — 全部测试通过
- `npm run build` — 编译成功

## 验收标准

- `spec-manager audit show` SHALL 输出 `compliance: PASS` 或 `compliance: FAIL`（无 `✓/✗` 前缀）
- compliance details 行 SHALL 保持 `✓/✗` 前缀（如 `✓ R1: 3 (min 1)`）
- 合规基线 SHALL 包含 R18（确认已有）
- @verify: file-exists(src/core/audit.ts)
- @verify: command(npm run lint)
- @verify: command(npm test)

## 验证命令

```bash
# 正向验证: 全量测试 + 类型检查
npm test
npm run lint
npm run build

# 反向验证: 手动确认 audit show 输出格式
node -e "
const { showSummary } = require('./dist/core/audit.js');
const { getPaths } = require('./dist/core/paths.js');
const output = showSummary(getPaths('.'));
console.log(output);
// 确认 compliance 行不含 ✓/✗ 前缀
const lines = output.split('\\n');
const compLine = lines.find(l => l.startsWith('compliance:'));
console.assert(!compLine.includes('✓') && !compLine.includes('✗'), 'compliance line should not have ✓/✗');
console.log('PASS');
"
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
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
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取 audit.ts 和 audit.test.ts"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "修改 showSummary compliance 行去掉 ✓/✗ 前缀"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "确认 COMPLIANCE_BASELINE 已含 R18"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "更新 audit.test.ts compliance 格式断言"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "验证: npm test + npm run lint + npm run build"}
  ]
}
```

autoConfirm=true — 变更极小（一行代码 + 测试断言），风险可控。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 格式变更影响下游消费 | `git revert <commit>`，恢复 `✓ PASS` / `✗ FAIL` 格式 | < 1 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 下游脚本依赖 `✓ PASS` 字符串匹配 | 极低概率，audit show 是人工阅读输出；如有脚本依赖需同步更新 |
| 变更太小不值得独立 L3 | 保持 spec 驱动一致性，且此 L3 作为 L3.1.2 的无依赖并行任务 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | constraint-closed-loop-L2.1 | 父 L2 |
| implements | constraint-closed-loop-L2.1 | 实现 deliverable 3: audit compliance 格式 |
