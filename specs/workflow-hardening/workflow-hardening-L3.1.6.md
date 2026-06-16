---
code: workflow-hardening-L3.1.6
level: L3
title: Rename task step mcp_tool type
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
aiSummary: Rename task step mcp_tool to tool_action with compatibility
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 stepType schema、task core、CLI、模板和历史数据使用点
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 schema/runtime 将 tool_action 作为新工具执行类型并兼容 mcp_tool
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 更新 CLI help、模板、agent 资产和文档示例
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 迁移仓库 specs/tasks 中的 stepType 历史值
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 更新测试 fixture 并补充兼容性覆盖
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证 targeted tests、build、doctor、rg mcp_tool 和 git diff --check
    status: pending
created: '2026-06-16T09:21:15.907Z'
updated: '2026-06-16T09:30:47.528Z'
changeSummary: 'cascade: task-complete'
---
# Rename task step mcp_tool type — 实施规格

## 目标

将 Task step 类型中的 `mcp_tool` 重命名为更贴合语义的 `tool_action`，避免用户误以为该步骤必须依赖 MCP server。

`tool_action` 表示 agent 通过工具、命令、文件读写、patch、CLI、测试等方式完成的执行步骤。

## 代码调查

当前相关路径：

- `src/schemas/spec.ts`
  - `StepTypeSchema` 兼容读取 `mcp_tool`，规范输出为 `tool_action`
  - `PlanJsonSchema` 复用 `StepTypeSchema`
- `src/core/task.ts`
  - `CreateTaskInput.planJson.steps[].stepType`
  - `createTask` 将 planJson steps 写入 task JSON 和 spec frontmatter steps。
  - `reportStep` 保留已计划 step 的 `stepType`，fallback 当前为 `tool_action`。
- `src/cli/task.ts`
  - `task step --type` help 文案包含 `llm_call|tool_action|human_gate`。
- `templates/agent-plan.json`、`templates/L3-impl.md`
  - planJson 示例默认使用 `tool_action`。
- agent 分发资产：
  - `.claude/skills/spec-manager/...`
  - `.codebuddy/skills/spec-manager/...`
  - `skill/SKILL.md`
  - `templates/agents/...`
- 历史 specs/tasks 中大量保存了 `"stepType": "mcp_tool"`。

## 实施步骤

### Step 1 — 更新 schema 与 runtime 兼容

- 将公开推荐枚举改为 `llm_call | tool_action | human_gate`。
- 兼容读取旧值 `mcp_tool`，在 parse/normalization 层映射为 `tool_action`。
- 新建 task、fallback、模板和 CLI 输出不再生成 `mcp_tool`。
- 兼容目标：旧仓库仍可读取，但本仓库历史记录迁移为新值。

### Step 2 — 更新 CLI、模板和文档资产

- 更新 `task step --type` help。
- 更新 `templates/agent-plan.json`、`templates/L3-impl.md`。
- 更新 agent 入口模板和 skill 文案中的枚举说明。
- 搜索并替换规范性示例里的 `mcp_tool` 为 `tool_action`。

### Step 3 — 迁移仓库历史记录

- 将本仓库 specs/tasks/spec frontmatter/planJson 示例中的 `"stepType": "mcp_tool"` 替换为 `"stepType": "tool_action"`。
- 保留普通叙述中提到旧名称的地方，仅在需要解释兼容性时保留。
- 不修改与本任务无关的 `.claude/settings.local.json`。

### Step 4 — 更新测试

- 更新已有测试 fixture。
- 增加或调整测试，覆盖：
  - 新值 `tool_action` 可创建 task。
  - 旧值 `mcp_tool` 被兼容读取/归一化或至少不会破坏旧文件读取。
  - CLI/help/schema 不再推荐 `mcp_tool`。

### Step 5 — 验证

- 运行 targeted tests：
  - `npm test -- src/core/__tests__/task-cascade.test.ts src/core/__tests__/validate.test.ts src/cli/__tests__/task.test.ts`
- 运行 `npm run build`。
- 运行 `spec-manager project doctor`。
- 运行 `rg "mcp_tool" src templates skill .claude/skills/spec-manager .codebuddy/skills/spec-manager specs`，确认只剩兼容说明或旧值兼容测试。
- 运行 `git diff --check`。

## 验收标准

- 新生成的 planJson 示例和 task steps 使用 `tool_action`。
- 用户面文案不再把普通工具执行步骤称为 `mcp_tool`。
- 旧 `mcp_tool` task 数据具备兼容处理，不导致旧仓库读取失败。
- 本仓库历史 spec/task 记录完成迁移。
- 验证命令通过。

## 验证命令

```bash
npm test -- src/core/__tests__/task-cascade.test.ts src/core/__tests__/validate.test.ts src/cli/__tests__/task.test.ts
npm run build
spec-manager project doctor
rg "mcp_tool" src templates skill .claude/skills/spec-manager .codebuddy/skills/spec-manager specs
git diff --check
```

## planJson

```json
{
  "coveredSpecs": ["workflow-hardening-L3.1.6"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "tool_action",
      "name": "读取 stepType schema、task core、CLI、模板和历史数据使用点"
    },
    {
      "stepNo": 2,
      "stepType": "tool_action",
      "name": "修改 schema/runtime 将 tool_action 作为新工具执行类型并兼容 mcp_tool"
    },
    {
      "stepNo": 3,
      "stepType": "tool_action",
      "name": "更新 CLI help、模板、agent 资产和文档示例"
    },
    {
      "stepNo": 4,
      "stepType": "tool_action",
      "name": "迁移仓库 specs/tasks 中的 stepType 历史值"
    },
    {
      "stepNo": 5,
      "stepType": "tool_action",
      "name": "更新测试 fixture 并补充兼容性覆盖"
    },
    {
      "stepNo": 6,
      "stepType": "tool_action",
      "name": "验证 targeted tests、build、doctor、rg mcp_tool 和 git diff --check"
    }
  ]
}
```

## 回滚方案

如迁移影响过大，回滚代码和历史数据替换提交；旧值 `mcp_tool` 仍是兼容读取值。
