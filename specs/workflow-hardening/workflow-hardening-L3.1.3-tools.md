---
code: workflow-hardening-L3.1.3-tools
level: L3
title: 多工具入口规则统一
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
created: '2026-06-08T02:14:58.291Z'
updated: '2026-06-08T02:24:04.679Z'
aiSummary: >-
  实施多工具入口规则统一：新增 Cursor/Windsurf provider 与模板，同步
  Claude/Codex/OpenCode/CodeBuddy/skill 统一规则，补充 provider 安装和模板覆盖测试
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: >-
      读取 workflow-hardening-L3.1.3-tools 与 workflow-hardening-L2.1 并检查
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 src/core/agents.ts 增加 cursor windsurf provider
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 新增 templates/agents/CURSOR.md 和 templates/agents/WINDSURF.md
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑现有 agents 模板和 skill/SKILL.md 同步统一规则
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: >-
      编辑 src/core/__tests__/agents.test.ts 和
      src/cli/__tests__/project-agents.test.ts 补充 provider 测试
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 编辑 src/core/__tests__/agents.test.ts 增加模板规则覆盖测试
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 编辑 src/cli/project.ts 更新 provider help
    status: pending
  - stepNo: 8
    stepType: mcp_tool
    name: >-
      验证 agents targeted tests、npm run build、完整 npm test、provider list 和 dry-run
      smoke
    status: pending
---
# 多工具入口规则统一 — 实施规格

## 目标

实施 `workflow-hardening-L2.1` 的第三项交付物：统一 Claude、Codex/OpenCode、CodeBuddy、Cursor、Windsurf 的 spec-manager 入口规则，并增加模板覆盖测试，防止工具说明漂移。

**前置依赖**: `workflow-hardening-L3.1.1-cli` 已 implemented；`workflow-hardening-L3.1.2-hints` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show workflow-hardening-L3.1.3-tools --include-content` 和 `spec-manager spec show workflow-hardening-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，`coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/agents.ts`，确认 `AGENT_PROVIDERS`、`AGENT_PROVIDER_INFO` 和安装步骤。
  - 读取 `templates/agents/AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md`、`templates/agents/codebuddy-skill/SKILL.md`。
  - 读取 `skill/SKILL.md`，确认 Claude skill 主入口规则。
  - 读取 `src/core/__tests__/agents.test.ts` 与 `src/cli/__tests__/project-agents.test.ts`，确认 provider 和模板测试扩展点。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/agent-plan 与 agents/template 测试基线读取","files":[]}
  ```

### Step 2 — 增加 Cursor/Windsurf provider 元数据

- 编辑 `src/core/agents.ts`：
  - 将 `AGENT_PROVIDERS` 扩展为 `['claude','codex','opencode','codebuddy','cursor','windsurf']`。
  - 新增 cursor provider：
    - aliases: `cursor`
    - files: `.cursorrules`
    - installSteps: `templates/agents/CURSOR.md` → `.cursorrules`
  - 新增 windsurf provider：
    - aliases: `windsurf`
    - files: `.windsurfrules`
    - installSteps: `templates/agents/WINDSURF.md` → `.windsurfrules`
  - 更新 unsupported provider 错误中的 provider 列表自动包含新增 provider。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 Cursor/Windsurf provider 元数据和安装步骤","files":["src/core/agents.ts"]}
  ```

### Step 3 — 新增 Cursor/Windsurf 入口模板

- 新增 `templates/agents/CURSOR.md`：
  - 面向 Cursor 的项目规则，目标文件 `.cursorrules`。
  - 必须包含 unified workflow rules。
- 新增 `templates/agents/WINDSURF.md`：
  - 面向 Windsurf 的项目规则，目标文件 `.windsurfrules`。
  - 必须包含 unified workflow rules。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 Cursor 和 Windsurf 规则模板","files":["templates/agents/CURSOR.md","templates/agents/WINDSURF.md"]}
  ```

### Step 4 — 同步现有工具入口规则

- 编辑 `templates/agents/AGENTS.md`、`templates/agents/CLAUDE.md`、`templates/agents/CODEBUDDY.md`、`templates/agents/codebuddy-skill/SKILL.md`、`skill/SKILL.md`。
- 每个入口 MUST 包含同一组 unified workflow rules：
  - Feature work must go through spec-manager.
  - L1 -> L2 -> L3 -> Agent Task.
  - Never write implementation code without frozen L3.
  - `draft -> confirmed` and `confirmed -> frozen` are explicit user review actions.
  - Before code edits, read frozen L3 and create/start an Agent Task.
  - planJson `coveredSpecs` must include current L3 specCode.
  - Record execution with `spec-manager task step`; finish with `spec-manager task complete`.
  - Prefer `spec-manager spec validate-plan --from-spec <L3-code>` for L3 markdown plan validation.
- 保持各工具特有入口描述不变。
- 完成后 step_report outputJson:
  ```json
  {"summary":"同步 Claude/Codex/OpenCode/CodeBuddy/skill 入口统一规则","files":["templates/agents/AGENTS.md","templates/agents/CLAUDE.md","templates/agents/CODEBUDDY.md","templates/agents/codebuddy-skill/SKILL.md","skill/SKILL.md"]}
  ```

### Step 5 — 补充 provider 安装测试

- 编辑 `src/core/__tests__/agents.test.ts`：
  - fixture 增加 `templates/agents/CURSOR.md` 和 `templates/agents/WINDSURF.md`。
  - `listAgentProviders` 断言 provider 顺序包含 cursor/windsurf。
  - `parseAgentProviders` 覆盖 cursor/windsurf。
  - `installAgentSupport(...providers: all)` 断言创建 `.cursorrules`、`.windsurfrules`。
  - dry-run 测试覆盖 cursor/windsurf created 或 overwrite。
- 编辑 `src/cli/__tests__/project-agents.test.ts`：
  - provider list 输出包含 cursor/windsurf。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 Cursor/Windsurf provider 安装和 CLI list 测试","files":["src/core/__tests__/agents.test.ts","src/cli/__tests__/project-agents.test.ts"]}
  ```

### Step 6 — 增加模板规则覆盖测试

- 新增或编辑 `src/core/__tests__/agents.test.ts`：
  - 读取真实模板文件或 fixture 模板，断言所有入口模板包含统一关键语句：
    - `coveredSpecs`
    - `spec validate-plan --from-spec`
    - `task step`
    - `task complete`
    - `frozen L3`
    - `explicit user approval` 或等价中文/英文短语
  - 对 `skill/SKILL.md` 单独断言也包含 `coveredSpecs` 和 `validate-plan --from-spec`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增多工具入口模板统一规则覆盖测试","files":["src/core/__tests__/agents.test.ts"]}
  ```

### Step 7 — 更新 CLI 描述和 smoke 覆盖

- 编辑 `src/cli/project.ts`：
  - `project agents` description 和 `--provider` help 文案加入 cursor/windsurf。
  - `printAgentProviderList` 自动打印新增 provider，无需特殊分支。
- 手动 smoke：
  - `node dist/cli/index.js project agents --provider list`
  - `node dist/cli/index.js project agents --provider cursor,windsurf --dry-run`
- 完成后 step_report outputJson:
  ```json
  {"summary":"更新 project agents provider help 并准备 cursor/windsurf smoke","files":["src/cli/project.ts"]}
  ```

### Step 8 — 验证

- 运行 `npm test -- --run src/core/__tests__/agents.test.ts src/cli/__tests__/project-agents.test.ts`。
- 运行 `npm run build`。
- 运行完整 `npm test`。
- 运行 smoke：
  - `node dist/cli/index.js project agents --provider list`
  - `node dist/cli/index.js project agents --provider cursor,windsurf --dry-run`
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 agents targeted tests、build、完整 npm test 和 cursor/windsurf smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: agents targeted tests
npm test -- --run src/core/__tests__/agents.test.ts src/cli/__tests__/project-agents.test.ts
# 预期输出包含:
# Test Files  2 passed

# 正向验证: TypeScript build
npm run build
# 预期输出: exit code 0

# 正向验证: 完整测试
npm test
# 预期输出包含:
# Test Files

# 正向验证: provider list
node dist/cli/index.js project agents --provider list
# 预期输出包含:
# cursor
# windsurf

# 正向验证: cursor/windsurf dry run
node dist/cli/index.js project agents --provider cursor,windsurf --dry-run
# 预期输出包含:
# .cursorrules
# .windsurfrules
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
  "coveredSpecs": ["workflow-hardening-L3.1.3-tools"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "读取 workflow-hardening-L3.1.3-tools 与 workflow-hardening-L2.1 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 src/core/agents.ts 增加 cursor windsurf provider"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "新增 templates/agents/CURSOR.md 和 templates/agents/WINDSURF.md"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑现有 agents 模板和 skill/SKILL.md 同步统一规则"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 src/core/__tests__/agents.test.ts 和 src/cli/__tests__/project-agents.test.ts 补充 provider 测试"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "编辑 src/core/__tests__/agents.test.ts 增加模板规则覆盖测试"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "编辑 src/cli/project.ts 更新 provider help"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "验证 agents targeted tests、npm run build、完整 npm test、provider list 和 dry-run smoke"}
  ]
}
```

autoConfirm: `false`。理由：本任务修改 provider 安装范围和多工具模板，需要人工可审计执行记录。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| Cursor/Windsurf provider 路径不符合预期 | revert `src/core/agents.ts` 新 provider 和对应模板 | < 5 min |
| 统一规则文案过长影响 agent 上下文 | 缩短模板文案，保留测试关键短语 | < 5 min |
| provider all 影响用户安装范围 | 暂时将 cursor/windsurf 从 `all` 移除，保留显式 provider | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `.cursorrules` / `.windsurfrules` 不是所有版本标准路径 | L3 先按 roadmap 指定路径交付；后续可扩展 provider 元数据 |
| 模板覆盖测试过于脆弱 | 使用关键短语包含性测试，不做完整快照 |
| `all` 新增 provider 改变安装输出 | 测试更新并在 release notes 中说明新增 Cursor/Windsurf 支持 |
