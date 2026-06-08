---
code: l3-approval-L3.1.1-single-freeze
level: L3
title: L3 单次批准冻结实施
topic: l3-approval
parentCode: l3-approval-L2.1
status: implemented
created: '2026-06-08T02:57:43.251Z'
updated: '2026-06-08T03:06:19.181Z'
aiSummary: 实施 L3 单次批准冻结：调整状态转换、confirm/approve、flow/guide、规则文档和多工具入口，并补充状态、CLI、门禁和模板一致性测试
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取 l3-approval-L3.1.1-single-freeze、l3-approval-L2.1 和
      templates/agent-plan.json 并完成文件级分析
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 src/core/status.ts 和 status.test.ts 扩展 draft 到 frozen 转换
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 src/cli/spec.ts 和 src/cli/usability.ts 统一 L3 单次批准目标状态
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 src/core/usability.ts 和 usability.test.ts 更新 flow guide 建议
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑 CLI spec task 测试覆盖单次批准和门禁兼容
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 编辑 flow-control README skill 同步 L3 单次批准规则
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 编辑根 AGENTS agent 模板和 agents.test.ts 同步统一规则
    status: pending
  - stepNo: 8
    stepType: mcp_tool
    name: 运行 targeted tests build 完整测试 CLI smoke 和残留检查
    status: pending
---
# L3 单次批准冻结实施 — 实施规格

## 目标

实施 `l3-approval-L2.1` 的唯一交付物：让正文完整的 draft L3 经一次明确人工批准直接进入 frozen，同时保持 L1/L2 批准语义、历史 confirmed L3 兼容、R3 task 门禁和多工具流程说明一致。

**前置依赖**: 无；父级 `l3-approval-L2.1` 已 confirmed。

## 实施步骤

### Step 1 — 上下文收集与基线确认

- 执行 `spec-manager spec show l3-approval-L3.1.1-single-freeze --include-content` 和 `spec-manager spec show l3-approval-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名和 `coveredSpecs` 要求。
- 执行 Level 3 文件级分析(R23)：
  - 读取 `src/core/status.ts`，确认状态转移基线。
  - 读取 `src/cli/spec.ts`、`src/cli/usability.ts`，确认 confirm/freeze/approve 实现。
  - 读取 `src/core/usability.ts`，确认 flow/guide next action。
  - 读取 `rules/flow-control.md`、`README.md`、`skill/SKILL.md`、`skill/subskills/impl.md` 和 `templates/agents/*`，确认双批准描述。
  - 读取对应 status/usability/spec/agents 测试，确认扩展点。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/agent-plan 与单次批准相关代码、规则、文档、测试基线读取","files":[]}
  ```

### Step 2 — 扩展状态转换能力

- 编辑 `src/core/status.ts`：
  - 更新状态机注释，明确 L1/L2 `draft -> confirmed`、L3 一次批准 `draft -> frozen`、历史 L3 `confirmed -> frozen`。
  - 将 `frozen` 加入 draft 的合法目标，保留 `confirmed` 和 `archived`。
  - 不删除 `confirmed -> frozen`、`frozen -> confirmed` 和 `frozen -> implemented`。
- 编辑 `src/core/__tests__/status.test.ts`：
  - 新增或更新 `draft -> frozen` 可达断言。
  - 更新 `nextStatuses('draft')` 的期望数量和成员。
  - 保留历史 confirmed/frozen 转移测试。
- 完成后 step_report outputJson:
  ```json
  {"summary":"允许 draft 到 frozen 状态转换并更新状态机测试","files":["src/core/status.ts","src/core/__tests__/status.test.ts"]}
  ```

### Step 3 — 统一 spec confirm 与 approve 的 L3 目标状态

- 编辑 `src/cli/spec.ts`：
  - 为 `confirm` 命令按 spec 层级和当前状态解析实际目标。
  - 当命令为 `confirm` 且记录为 draft L3 时，实际目标 SHALL 为 frozen。
  - draft L1/L2 执行 confirm 仍进入 confirmed。
  - `freeze <confirmed L3>` 保持兼容；不得允许 L1/L2 进入 frozen。
  - R22 placeholder 校验、R2/R9 audit 和真实转换输出均使用实际目标。
- 编辑 `src/cli/usability.ts`：
  - `approve <draft L3>` 目标改为 frozen。
  - `approve <confirmed L3>` 仍进入 frozen。
  - `approve <draft L1/L2>` 仍进入 confirmed。
  - 更新命令 description。
- 完成后 step_report outputJson:
  ```json
  {"summary":"统一 spec confirm 与 approve 的 L3 单次批准目标状态","files":["src/cli/spec.ts","src/cli/usability.ts"]}
  ```

### Step 4 — 更新 flow 与 guide 下一步建议

- 编辑 `src/core/usability.ts`：
  - `suggestNextActionForTopic` 遇到 draft L3 时建议一次用户批准入口，并使执行后直接 frozen。
  - `suggestAfterSpecCommand` 对 draft L3 明确提示一次批准后进入 frozen；draft L1/L2 仍提示 confirm 后进入 confirmed。
  - confirmed L3 继续提示兼容 freeze，不改变已有项目收尾路径。
  - frozen L3 继续提示创建 Agent Task，保留 upstream advice。
- 编辑 `src/core/__tests__/usability.test.ts`：
  - 覆盖 draft L3、confirmed L3、frozen L3 的下一步。
  - 覆盖 draft L1/L2 的建议不变。
- 完成后 step_report outputJson:
  ```json
  {"summary":"更新 flow 和 guide 的 L3 单次批准建议及测试","files":["src/core/usability.ts","src/core/__tests__/usability.test.ts"]}
  ```

### Step 5 — 增加 CLI 行为与门禁测试

- 编辑或新增 `src/cli/__tests__/spec.test.ts` 和 usability CLI 测试：
  - 正向：正文完整的 draft L3 执行 `spec confirm` 后状态为 frozen。
  - 正向：draft L1/L2 执行 `spec confirm` 后状态为 confirmed。
  - 正向：历史 confirmed L3 执行 `spec freeze` 或 approve 后状态为 frozen。
  - 反向：placeholder draft L3 执行 confirm 仍被 R22 阻断。
  - 反向：draft L1/L2 不能通过 freeze 进入 frozen。
- 保留 `src/cli/__tests__/task.test.ts` 中非 frozen L3 不能创建 task 的断言，增加单次批准 frozen L3 可创建 task 的覆盖（若现有测试未覆盖）。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 L3 单次批准、历史兼容和 R22/R3 门禁 CLI 测试","files":["src/cli/__tests__/spec.test.ts","src/cli/__tests__/task.test.ts"]}
  ```

### Step 6 — 同步规则、README 与 skill

- 编辑 `rules/flow-control.md`：
  - R1 继续要求写完停下等审核。
  - R2 明确 L1/L2 批准进入 confirmed，L3 一次批准进入 frozen；AI 不得自行推进。
  - R3 继续要求 frozen L3 才能创建 Agent Task。
  - R4 继续保持 L1/L2/L3 三层独立审核点，但不要求 L3 内部重复审核。
- 编辑 `README.md`：
  - 更新状态机说明、快捷命令、完整示例和 L3 审核段落。
  - 删除 “L3 needs two confirmations” 等双批准描述。
- 编辑 `skill/SKILL.md` 和 `skill/subskills/impl.md`：
  - 更新硬规则和 L3 实施流程为一次用户批准后 frozen。
  - 保持写正文后停止、task step、task complete 等规则。
- 完成后 step_report outputJson:
  ```json
  {"summary":"同步 flow-control、README 和 skill 的 L3 单次批准规则","files":["rules/flow-control.md","README.md","skill/SKILL.md","skill/subskills/impl.md"]}
  ```

### Step 7 — 同步项目入口与多工具 agent 模板

- 编辑根 `AGENTS.md` 及以下模板：
  - `templates/agents/AGENTS.md`
  - `templates/agents/CLAUDE.md`
  - `templates/agents/CODEBUDDY.md`
  - `templates/agents/CURSOR.md`
  - `templates/agents/WINDSURF.md`
  - `templates/agents/codebuddy-skill/SKILL.md`
- 所有入口 MUST 表达：
  - L1/L2 与 L3 都需要独立人工批准。
  - L3 一次明确批准后直接 frozen。
  - 未批准不得写实现代码；frozen 后才创建/start Agent Task。
- 编辑 `src/core/__tests__/agents.test.ts` 的模板包含性断言，防止恢复成双批准描述。
- 完成后 step_report outputJson:
  ```json
  {"summary":"同步根 AGENTS 和六类 agent 模板的 L3 单次批准规则","files":["AGENTS.md","templates/agents/AGENTS.md","templates/agents/CLAUDE.md","templates/agents/CODEBUDDY.md","templates/agents/CURSOR.md","templates/agents/WINDSURF.md","templates/agents/codebuddy-skill/SKILL.md","src/core/__tests__/agents.test.ts"]}
  ```

### Step 8 — 构建与完整验证

- 运行 targeted tests：
  - `npm test -- --run src/core/__tests__/status.test.ts src/core/__tests__/usability.test.ts src/core/__tests__/agents.test.ts src/cli/__tests__/spec.test.ts src/cli/__tests__/task.test.ts`
- 运行 `npm run build`。
- 运行完整 `npm test`。
- 使用临时项目 smoke 验证：
  - draft L3 一次 `spec confirm` 输出 `draft → frozen`。
  - draft L1 一次 `spec confirm` 输出 `draft → confirmed`。
  - placeholder L3 confirm 输出 R22 错误。
- 执行文本残留检查，确认 active 规则/README/skill/agent 入口不再要求 L3 两次批准。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 targeted tests、build、完整测试、CLI smoke 和双批准残留检查","files":[]}
  ```

## 验证命令

```bash
# 正向验证: targeted tests
npm test -- --run src/core/__tests__/status.test.ts src/core/__tests__/usability.test.ts src/core/__tests__/agents.test.ts src/cli/__tests__/spec.test.ts src/cli/__tests__/task.test.ts
# 预期输出包含: Test Files  5 passed

# 正向验证: build
npm run build
# 预期输出: exit code 0

# 正向验证: 完整测试
npm test
# 预期输出包含: Test Files
# 预期输出不包含: failed

# 正向验证: L3 一次批准
node dist/cli/index.js spec confirm <draft-l3-code>
# 预期输出包含: draft → frozen

# 正向验证: L1 批准语义不变
node dist/cli/index.js spec confirm <draft-l1-code>
# 预期输出包含: draft → confirmed

# 反向验证: placeholder L3 仍被阻断
node dist/cli/index.js spec confirm <placeholder-draft-l3-code>
# 预期 exit code: 2
# 预期输出包含: R22

# 文本残留检查
rg -n "L3 needs two confirmations|用户再批准|L3 confirmed→frozen|draft -> confirmed.*confirmed -> frozen" README.md rules skill templates/agents AGENTS.md
# 预期输出: 无双批准流程残留
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
  "coveredSpecs": ["l3-approval-L3.1.1-single-freeze"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 l3-approval-L3.1.1-single-freeze、l3-approval-L2.1 和 templates/agent-plan.json 并完成文件级分析"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 src/core/status.ts 和 status.test.ts 扩展 draft 到 frozen 转换"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 src/cli/spec.ts 和 src/cli/usability.ts 统一 L3 单次批准目标状态"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 src/core/usability.ts 和 usability.test.ts 更新 flow guide 建议"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 CLI spec task 测试覆盖单次批准和门禁兼容"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "编辑 flow-control README skill 同步 L3 单次批准规则"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "编辑根 AGENTS agent 模板和 agents.test.ts 同步统一规则"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "运行 targeted tests build 完整测试 CLI smoke 和残留检查"}
  ]
}
```

autoConfirm: `false`。理由：本任务改变用户审核到 frozen 的关键状态推进语义，执行步骤和结果必须保留人工可审计记录。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| L3 confirm 误冻结非 L3 或未批准规格 | 回退 CLI 目标解析与 `draft -> frozen` 转换，恢复双步骤流程 | < 10 min |
| flow/guide 建议与 CLI 行为不一致 | 回退 usability 建议并恢复旧提示 | < 5 min |
| 多工具模板引导错误 | 回退规则、README、skill 和 agent 模板文案 | < 10 min |
| 测试暴露历史状态不兼容 | 保留 confirmed/freeze 兼容路径，限制新行为仅作用于 draft L3 confirm/approve | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 全局允许 `draft -> frozen` 被非 L3 调用误用 | CLI 层按 level 限制目标；测试覆盖 L1/L2 freeze 失败 |
| `spec confirm` 名称与最终 frozen 状态不完全直观 | CLI 输出真实转换，README/guide 明确该命令表示用户批准 |
| 历史 confirmed L3 和新 draft L3 路径混淆 | 保留 confirmed -> frozen，并分别测试新旧路径 |
| 文档和 agent 模板再次漂移 | agents 模板包含性测试和残留检查共同约束 |
