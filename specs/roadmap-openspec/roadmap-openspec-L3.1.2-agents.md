---
code: roadmap-openspec-L3.1.2-agents
level: L3
title: agent provider 自动检测
topic: roadmap-openspec
parentCode: roadmap-openspec-L2.1
status: implemented
created: '2026-06-08T02:25:24.175Z'
updated: '2026-06-08T02:31:56.518Z'
aiSummary: >-
  实施 project agents 默认 provider 自动检测：新增 detectAgentProviders，未显式 provider 时按项目
  marker 检测 Claude/Codex/OpenCode/CodeBuddy/Cursor/Windsurf，保留显式 all/list
  行为并补充测试和 smoke
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 roadmap-openspec-L3.1.2-agents 与 roadmap-openspec-L2.1 并检查
      templates/agent-plan.json
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/agents.ts 新增 detectAgentProviders
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/cli/project.ts 调整 project agents 默认检测
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 src/core/__tests__/agents.test.ts 补充 provider 检测测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 编辑 src/cli/__tests__/project-agents.test.ts 补充 CLI 自动检测测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 编辑 src/cli/project.ts 更新 project agents help
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 验证 agents targeted tests、npm run build、完整 npm test 和 auto-detect smoke
    status: pending
---
# agent provider 自动检测 — 实施规格

## 目标

实施 `roadmap-openspec-L2.1` 的第二项交付物：`project agents` 在未显式传入 `--provider` 时根据项目根目录已有工具标记自动检测 provider，并继续保持 `--provider all`、`--provider list` 和显式逗号组合的现有行为。

**前置依赖**: `roadmap-openspec-L3.1.1-guide` 已 implemented；`workflow-hardening-L3.1.3-tools` 已 implemented，因此 provider 元数据已包含 Claude、Codex、OpenCode、CodeBuddy、Cursor、Windsurf。

## 实施步骤

### Step 1 — 上下文收集

- 执行 `spec-manager spec show roadmap-openspec-L3.1.2-agents --include-content` 和 `spec-manager spec show roadmap-openspec-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，`coveredSpecs` 必须包含当前 L3 specCode。
- 执行 Level 3 文件级分析(R23):
  - 读取 `src/core/agents.ts`，确认 `AGENT_PROVIDER_INFO`、`parseAgentProviders`、`installAgentSupport` 和 provider target 去重行为。
  - 读取 `src/cli/project.ts`，确认 `project agents` 的默认 option、`--provider list` 分支和 `installAgentSupport` 调用点。
  - 读取 `src/core/__tests__/agents.test.ts` 与 `src/cli/__tests__/project-agents.test.ts`，确认 provider 检测和 CLI 默认行为测试扩展点。
  - 读取 `src/core/paths.ts` 或测试 fixture，确认可用 `ProjectPaths.root` 扫描项目根目录。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 L3/L2/agent-plan 与 agents CLI/test 基线读取","files":[]}
  ```

### Step 2 — 增加 provider 自动检测核心函数

- 编辑 `src/core/agents.ts`：
  - 新增 `AgentProviderDetection` interface，字段包含 `providers: AgentProvider[]` 与 `reasons: Record<AgentProvider, string[]>` 或等价结构。
  - 新增 `detectAgentProviders(paths: ProjectPaths): AgentProviderDetection`。
  - 扫描 provider metadata 中的 `files` 标记：
    - `CLAUDE.md` 或 `.claude/skills/spec-manager/` 命中 claude。
    - `AGENTS.md` 命中 codex 与 opencode。
    - `CODEBUDDY.md` 或 `.codebuddy/skills/spec-manager/` 命中 codebuddy。
    - `.cursorrules` 命中 cursor。
    - `.windsurfrules` 命中 windsurf。
  - 检测顺序 SHALL 与 `AGENT_PROVIDERS` 顺序一致，并对同 provider 多个 marker 去重。
  - reason 文案 SHOULD 包含命中的相对路径，便于 CLI 输出。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 detectAgentProviders 核心检测函数","files":["src/core/agents.ts"]}
  ```

### Step 3 — 调整 `project agents` 默认行为

- 编辑 `src/cli/project.ts`：
  - 将 `--provider` option 默认值从 `'all'` 改为 undefined 或等价无默认值。
  - 保持 `--provider list` 直接打印 provider 列表。
  - 当用户显式传入 `--provider <value>` 时继续调用 `parseAgentProviders(value)`，因此 `--provider all` 仍安装全部。
  - 当用户未传 `--provider` 时调用 `detectAgentProviders(paths)`：
    - 若检测到 provider，调用 `installAgentSupport` 安装检测结果。
    - 输出 `detected:` 段，列出命中 marker 与 provider。
    - 若没有检测到 provider，抛出可读错误，提示使用 `--provider all` 或显式 provider。
  - 非 dry-run 安装后的 Next 文案 SHOULD 增加 Cursor/Windsurf，或使用通用 spec-manager invocation 文案避免遗漏。
- 完成后 step_report outputJson:
  ```json
  {"summary":"调整 project agents 默认 provider 自动检测行为","files":["src/cli/project.ts"]}
  ```

### Step 4 — 补充核心检测测试

- 编辑 `src/core/__tests__/agents.test.ts`：
  - 增加 `detectAgentProviders` import。
  - 测试空项目返回空 providers。
  - 测试 `.claude/skills/spec-manager/`、`CODEBUDDY.md`、`.cursorrules`、`.windsurfrules` 命中对应 provider。
  - 测试 `AGENTS.md` 同时命中 codex 与 opencode。
  - 测试多个 marker 同时存在时 provider 顺序与 `AGENT_PROVIDERS` 一致。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 provider 自动检测核心单元测试","files":["src/core/__tests__/agents.test.ts"]}
  ```

### Step 5 — 补充 CLI 默认/显式行为测试

- 编辑 `src/cli/__tests__/project-agents.test.ts`：
  - 默认执行 `project agents --dry-run` 且项目存在 `AGENTS.md` 时，输出包含 `detected:`、`codex`、`opencode`，并保持 dry-run 不写新文件。
  - 默认执行 `project agents --dry-run` 且项目存在 `.cursorrules` / `.windsurfrules` 时，输出包含 cursor/windsurf 和对应规则文件。
  - 显式 `--provider all --dry-run` 仍输出全部 provider，确保默认自动检测没有破坏显式 all。
  - 无 marker 且未传 `--provider` 时断言抛出错误，错误消息包含 `--provider all`。
  - `--provider list` 行为保持不安装文件。
- 完成后 step_report outputJson:
  ```json
  {"summary":"补充 project agents CLI 自动检测和显式 provider 测试","files":["src/cli/__tests__/project-agents.test.ts"]}
  ```

### Step 6 — 更新帮助文案与验证 smoke

- 编辑 `src/cli/project.ts`：
  - 更新 `project agents` description/help，说明“不传 provider 自动检测，显式 all 安装全部”。
  - 确保 `printAgentProviderList` 自动列出所有 provider，无需特殊分支。
- 手动 smoke 使用 build 后 CLI：
  - `node dist/cli/index.js project agents --provider list`
  - 在临时目录或测试项目中创建 marker 后运行 `project agents --dry-run`，确认输出 detected。
  - 在无 marker 临时目录运行 `project agents --dry-run`，确认错误提示显式 provider。
- 完成后 step_report outputJson:
  ```json
  {"summary":"更新 project agents help 并准备自动检测 smoke","files":["src/cli/project.ts"]}
  ```

### Step 7 — 验证

- 运行 `npm test -- --run src/core/__tests__/agents.test.ts src/cli/__tests__/project-agents.test.ts`。
- 运行 `npm run build`。
- 运行完整 `npm test`。
- 运行 smoke：
  - `node dist/cli/index.js project agents --provider list`
  - `mkdir -p /tmp/spec-manager-agent-smoke && cd /tmp/spec-manager-agent-smoke && touch AGENTS.md && SPEC_MANAGER_ROOT=$PWD node /Users/loki/code/github/spec-manager/dist/cli/index.js project agents --dry-run`
  - `mkdir -p /tmp/spec-manager-agent-empty && cd /tmp/spec-manager-agent-empty && SPEC_MANAGER_ROOT=$PWD node /Users/loki/code/github/spec-manager/dist/cli/index.js project agents --dry-run`
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 targeted tests、build、完整 npm test 和 provider auto-detect smoke 验证","files":[]}
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

# 正向验证: 默认自动检测 AGENTS.md
mkdir -p /tmp/spec-manager-agent-smoke
cd /tmp/spec-manager-agent-smoke
touch AGENTS.md
SPEC_MANAGER_ROOT=$PWD node /Users/loki/code/github/spec-manager/dist/cli/index.js project agents --dry-run
# 预期输出包含:
# detected:
# codex
# opencode
# AGENTS.md

# 反向验证: 无 marker 且未显式 provider
mkdir -p /tmp/spec-manager-agent-empty
cd /tmp/spec-manager-agent-empty
SPEC_MANAGER_ROOT=$PWD node /Users/loki/code/github/spec-manager/dist/cli/index.js project agents --dry-run
# 预期输出包含:
# --provider all
```

## step_report 模板

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
  "coveredSpecs": ["roadmap-openspec-L3.1.2-agents"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 roadmap-openspec-L3.1.2-agents 与 roadmap-openspec-L2.1 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/agents.ts 新增 detectAgentProviders"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/cli/project.ts 调整 project agents 默认检测"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 src/core/__tests__/agents.test.ts 补充 provider 检测测试"},
    {"stepNo": 5, "stepType": "tool_action", "name": "编辑 src/cli/__tests__/project-agents.test.ts 补充 CLI 自动检测测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "编辑 src/cli/project.ts 更新 project agents help"},
    {"stepNo": 7, "stepType": "tool_action", "name": "验证 agents targeted tests、npm run build、完整 npm test 和 auto-detect smoke"}
  ]
}
```

autoConfirm: `false`。理由：本任务改变 `project agents` 的默认行为，需要用户确认 L3 细节后再冻结执行。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 默认自动检测误判 provider | revert `detectAgentProviders` 与 `project agents` 默认分支，恢复默认 `all` | < 5 min |
| 无 marker 错误提示影响脚本 | 将无 provider 检测降级为提示并要求显式 provider，不写文件 | < 5 min |
| CLI 测试过度依赖输出文案 | 放宽测试为关键短语包含，保留行为断言 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `AGENTS.md` 同时代表 Codex/OpenCode 导致用户只想安装其中一个 | 默认检测按 L2 决策同时返回；目标文件去重避免重复写，用户可显式 `--provider codex` |
| 空项目默认不再安装 all | 错误提示明确给出 `--provider all`；显式 all 保持原行为 |
| marker 文件已存在且未 `--force` 时 dry-run/安装输出为 skipped | 测试覆盖 dry-run 和 skipped，CLI 输出保持现有 printPathGroup |
