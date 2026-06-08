---
code: workflow-hardening-L3.1.4-placeholder-fix
level: L3
title: Placeholder 示例引用误判修复
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
created: '2026-06-08T03:26:29.793Z'
updated: '2026-06-08T03:32:03.969Z'
aiSummary: >-
  统一 validate、flow、guide、doctor 使用 isPlaceholderContent，避免完整正文中的 placeholder
  marker 示例被误判，同时保留真实占位的 R22 拦截
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取 workflow-hardening-L3.1.4-placeholder-fix、workflow-hardening-L2.1 和
      templates/agent-plan.json 并复现误判
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 src/core/validate.ts 统一 validate placeholder 判定
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 src/core/usability.ts 统一 flow guide doctor placeholder 判定
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 spec-io.test.ts 和 validate.test.ts 增加核心判定回归测试
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑 usability.test.ts 和 CLI spec 测试增加流程误判回归测试
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 验证 workflow-hardening L1/L2 不再误判且真实占位仍被 R22 阻断
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 运行 placeholder targeted tests、build 和完整测试
    status: pending
---
# Placeholder 示例引用误判修复 — 实施规格

## 目标

实施 `workflow-hardening-L2.1` 的 placeholder 校验补充修复：统一所有入口使用 `isPlaceholderContent` 判断，确保真实占位正文继续被 R22 拦截，而完整规格中引用 placeholder marker 的代码示例或验收描述不再被误判。

**前置依赖**: `workflow-hardening-L3.1.1-cli`、`workflow-hardening-L3.1.2-hints`、`workflow-hardening-L3.1.3-tools` 均已 implemented。

## 实施步骤

### Step 1 — 上下文收集与误判复现

- 执行 `spec-manager spec show workflow-hardening-L3.1.4-placeholder-fix --include-content` 和 `spec-manager spec show workflow-hardening-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名与 `coveredSpecs` 要求。
- 执行 Level 3 文件级分析(R23)：
  - 读取 `src/core/spec-io.ts` 的 `isPlaceholderContent`，确认当前“marker + 短正文”语义。
  - 读取 `src/core/validate.ts`，确认 `validateSpecContent` 直接 `includes(marker)` 导致误判。
  - 读取 `src/core/usability.ts`，确认 doctor、flow 和 `suggestAfterSpecCommand` 的 placeholder 判断是否统一。
  - 读取 `src/core/__tests__/validate.test.ts`、`src/core/__tests__/usability.test.ts`、`src/core/__tests__/spec-io.test.ts` 和 CLI spec 测试。
- 复现：
  - `spec-manager spec validate workflow-hardening-L1`
  - `spec-manager spec validate workflow-hardening-L2.1`
  - 预期修复前输出 `[placeholder_marker]`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 placeholder 判定调用链分析并复现 L1/L2 示例引用误判","files":[]}
  ```

### Step 2 — 统一 validate placeholder 判定

- 编辑 `src/core/validate.ts`：
  - 移除或停止使用本地 `PLACEHOLDER_MARKER` 直接包含判断。
  - 复用 `isPlaceholderContent(content)` 生成 `placeholder_marker` warning。
  - 保持 warning rule、message 和 warning-only 契约不变。
- 确认 `spec-io.ts` 对 `SpecLevel` 的引用为 type-only，不产生运行时循环依赖；若构建暴露循环问题，再将纯判断函数抽到无依赖模块并由两边复用。
- 完成后 step_report outputJson:
  ```json
  {"summary":"统一 validateSpecContent 使用 isPlaceholderContent 判定 placeholder","files":["src/core/validate.ts"]}
  ```

### Step 3 — 统一 flow、guide 与 doctor placeholder 判定

- 编辑 `src/core/usability.ts`：
  - `runProjectDoctor` 保持使用 `isPlaceholderContent`。
  - `suggestNextActionForTopic` 将直接 `content.includes(PLACEHOLDER_MARKER)` 改为 `isPlaceholderContent(content)`。
  - `suggestAfterSpecCommand` 将直接 marker 包含判断改为 `isPlaceholderContent(content)`。
  - 移除不再需要的 `PLACEHOLDER_MARKER` import。
- 保持真实占位 spec 的 update 建议不变；完整正文中的 marker 示例 SHALL 不覆盖正常 next action。
- 完成后 step_report outputJson:
  ```json
  {"summary":"统一 flow、guide、doctor 使用 isPlaceholderContent 判定 placeholder","files":["src/core/usability.ts"]}
  ```

### Step 4 — 增加核心判定与 validate 回归测试

- 编辑 `src/core/__tests__/spec-io.test.ts`：
  - 导入并测试 `isPlaceholderContent`。
  - 真实 createSpec scaffold 或短正文 marker 返回 true。
  - 完整长正文中引用 marker 返回 false。
- 编辑 `src/core/__tests__/validate.test.ts`：
  - 保留真实 placeholder 返回 `placeholder_marker` warning。
  - 新增完整规格在正文/代码示例中引用 marker 时不返回 `placeholder_marker`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"增加 placeholder 核心判定和 validate 示例引用回归测试","files":["src/core/__tests__/spec-io.test.ts","src/core/__tests__/validate.test.ts"]}
  ```

### Step 5 — 增加 flow、guide 与 doctor 回归测试

- 编辑 `src/core/__tests__/usability.test.ts`：
  - 完整 spec 引用 marker 时，doctor 不报告 placeholder。
  - 完整 draft spec 引用 marker 时，`suggestAfterSpecCommand` 返回审核建议而非 update 建议。
  - topic flow 中完整 spec 引用 marker 时，next action 不被 placeholder update 覆盖。
  - 真实占位 spec 仍返回 update 建议。
- 编辑或复用 CLI spec 测试，确认 `spec validate` 对完整示例引用不输出 `[placeholder_marker]`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"增加 flow、guide、doctor 和 CLI validate 的 placeholder 误判回归测试","files":["src/core/__tests__/usability.test.ts","src/cli/__tests__/spec.test.ts"]}
  ```

### Step 6 — 验证现有 workflow-hardening 规格不再误判

- 运行：
  - `spec-manager spec validate workflow-hardening-L1`
  - `spec-manager spec validate workflow-hardening-L2.1`
- 两条命令 SHALL 不再输出 `[placeholder_marker]`。
- 运行 `spec-manager flow status --topic workflow-hardening`，next action SHALL 不再要求更新已完整的 L1/L2 正文。
- 创建或使用测试 fixture 验证真正的 placeholder spec 仍被 `spec confirm`/`approve` 的 R22 阻断。
- 完成后 step_report outputJson:
  ```json
  {"summary":"验证 workflow-hardening L1/L2 示例引用不再误判且真实占位仍被 R22 阻断","files":[]}
  ```

### Step 7 — 构建与完整测试

- 运行 targeted tests：
  - `npm test -- --run src/core/__tests__/spec-io.test.ts src/core/__tests__/validate.test.ts src/core/__tests__/usability.test.ts src/cli/__tests__/spec.test.ts src/cli/__tests__/usability.test.ts`
- 运行 `npm run build`。
- 运行完整 `npm test`。
- 确认没有降低 R22、placeholder warning 或 flow update 建议的真实占位覆盖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 placeholder targeted tests、build 和完整测试验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: 完整规格中的 marker 示例不误判
spec-manager spec validate workflow-hardening-L1
spec-manager spec validate workflow-hardening-L2.1
# 预期输出不包含: [placeholder_marker]

# 正向验证: flow 不再被示例引用覆盖
spec-manager flow status --topic workflow-hardening
# 预期输出不包含: spec-manager spec update workflow-hardening-L1
# 预期输出不包含: spec-manager spec update workflow-hardening-L2.1

# 正向验证: targeted tests
npm test -- --run src/core/__tests__/spec-io.test.ts src/core/__tests__/validate.test.ts src/core/__tests__/usability.test.ts src/cli/__tests__/spec.test.ts src/cli/__tests__/usability.test.ts
# 预期输出包含: Test Files  5 passed

# 正向验证: build
npm run build
# 预期 exit code: 0

# 正向验证: 完整测试
npm test
# 预期输出包含: Test Files
# 预期输出不包含: failed

# 反向验证: 真实 placeholder 仍被识别
spec-manager spec validate <真实占位测试-spec-code>
# 预期输出包含: [placeholder_marker]
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["workflow-hardening-L3.1.4-placeholder-fix"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 workflow-hardening-L3.1.4-placeholder-fix、workflow-hardening-L2.1 和 templates/agent-plan.json 并复现误判"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 src/core/validate.ts 统一 validate placeholder 判定"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 src/core/usability.ts 统一 flow guide doctor placeholder 判定"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 spec-io.test.ts 和 validate.test.ts 增加核心判定回归测试"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 usability.test.ts 和 CLI spec 测试增加流程误判回归测试"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "验证 workflow-hardening L1/L2 不再误判且真实占位仍被 R22 阻断"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "运行 placeholder targeted tests、build 和完整测试"}
  ]
}
```

autoConfirm: `false`。理由：该任务修改 R22 与流程建议共用的 placeholder 判定语义，需要通过正反向测试保留人工可审计结果。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 真实 placeholder 不再被识别 | 回退 validate/usability 调用点并恢复旧判断，重新设计统一函数 | < 10 min |
| 完整短正文中的 marker 示例仍误判 | 调整 `isPlaceholderContent` 语义并增加结构化 marker 行测试 | < 10 min |
| 导入产生运行时循环依赖 | 将 `isPlaceholderContent` 抽到无依赖的 `src/core/placeholder.ts` | < 10 min |
| flow next action 回归 | 回退 usability 调用点并用 fixture 固定真实占位与完整正文场景 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `isPlaceholderContent` 的长度阈值将来变化导致语义漂移 | 所有入口复用同一函数，并用正反向测试固定契约 |
| validate 导入 spec-io 产生循环依赖 | `SpecLevel` 当前为 type-only；构建失败时抽取纯函数模块 |
| 示例引用出现在极短规格中仍可能被判 placeholder | 本 L3 先修复当前完整规格误判；短规格结构化语义后续独立设计 |
