---
code: repository-remediation-L3.1.1
level: L3
title: 历史验证豁免与完整性扫描
topic: repository-remediation
parentCode: repository-remediation-L2.1
status: implemented
aiSummary: 建立独立历史 verification 豁免登记，严格校验精确 Task 匹配并接入完整性扫描，不修改终态 Task。
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 收集上下文并记录历史 Task 字节摘要
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 新增 integrity-exemptions.ts 登记读取与严格合并
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 修改 integrity.ts 接入有效豁免与无效登记报告
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 新增完整性豁免单元测试与公共导出
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 验证测试构建并比较历史 Task 字节摘要
    status: pending
created: '2026-06-08T09:57:31.254Z'
updated: '2026-06-08T10:04:16.195Z'
changeSummary: 'cascade: task complete'
---
# 历史验证豁免与完整性扫描 — 实施规格

## 目标

实施 `repository-remediation-L2.1` 的 TD-1、TD-2：建立独立、严格校验的历史 verification 豁免登记，并接入完整性扫描。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- SHALL 读取 `repository-remediation-L3.1.1`、`repository-remediation-L2.1`、`templates/agent-plan.json`。
- SHALL 分析 `src/core/paths.ts`、`src/core/integrity.ts`、`src/core/task.ts`、`src/core/__tests__/integrity.test.ts` 及其 import。
- SHALL 记录 16 个历史 Task 文件的原始字节摘要，后续验证不得变化。

### Step 2 — 定义豁免路径与登记模型

- SHALL 在 `ProjectPaths` 增加 `integrityExemptionsFile`，指向 `.spec-manager/integrity-exemptions.json`。
- SHALL 新建 `src/core/integrity-exemptions.ts`，定义 `IntegrityExemption`、`IntegrityExemptionRegistry`、读取结果与验证问题类型。
- SHALL 实现 `readIntegrityExemptions(paths)`：不存在文件返回空登记；JSON、版本或字段非法时返回可报告问题，不静默吞错。
- SHALL 实现按 `id` 和 `specCode:taskId` 双重去重的合并函数；冲突必须抛出明确错误。

### Step 3 — 接入完整性扫描

- SHALL 在 `src/core/integrity.ts` 增加 `invalid-exemption` issue kind。
- SHALL 仅对精确匹配、字段完整、指向 completed 且仍缺成功 verification 的登记项抑制 `missing-verification`。
- SHALL 对重复、悬空、状态不符或已有成功 verification 的登记项报告 `invalid-exemption`。
- MUST 避免为每个 Task 重复扫描全部 spec，保持现有行为兼容。

### Step 4 — 增加测试与导出

- SHALL 在 `src/core/__tests__/integrity-exemptions.test.ts` 覆盖空文件、非法 JSON、非法版本、重复键和合并冲突。
- SHALL 扩展 `src/core/__tests__/integrity.test.ts`，覆盖有效豁免、近似但不匹配的豁免、无效豁免和新 completed Task 仍被报告。
- SHALL 在 `src/index.ts` 导出公共模型与读取函数。

### Step 5 — 验证

- SHALL 运行定向测试、完整测试、lint、build 和 `git diff --check`。
- SHALL 比较 16 个历史 Task 文件实施前后的字节摘要，结果必须一致。

## 验证命令

```bash
# 正向验证：有效精确豁免抑制对应 missing-verification
npx vitest run src/core/__tests__/integrity-exemptions.test.ts src/core/__tests__/integrity.test.ts
# 预期：所有测试 passed

# 反向验证：近似键、悬空或新 Task 仍产生 missing-verification / invalid-exemption
npm test
# 预期：所有测试 passed

npm run lint
npm run build
git diff --check
# 预期：均退出码 0
```

## step_report 模板

```json
{"taskId":"<task id>","stepNo":<stepNo>,"stepType":"mcp_tool","status":"succeeded","toolName":"<实际工具>","latencyMs":"<实际耗时>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"}
```

## planJson (final)

```json
{
  "coveredSpecs": ["repository-remediation-L3.1.1"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "收集上下文并记录历史 Task 字节摘要"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 integrity-exemptions.ts 登记读取与严格合并"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "修改 integrity.ts 接入有效豁免与无效登记报告"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "新增完整性豁免单元测试与公共导出"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "运行测试构建并比较历史 Task 字节摘要"}
  ]
}
```

`autoConfirm=false`：完整性门禁语义变化需要人工核验。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 豁免误抑制问题 | 回退本 L3 代码与测试；删除尚未使用的空登记文件 | < 10 min |
| 历史 Task 意外变化 | 停止任务，使用实施前摘要定位变化并仅恢复本任务造成的修改 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 非法登记导致 doctor 崩溃 | 读取函数返回结构化问题，由扫描器报告 `invalid-exemption` |
| 宽泛匹配弱化门禁 | 仅使用 `specCode:taskId` 精确键并校验 Task 当前状态 |
