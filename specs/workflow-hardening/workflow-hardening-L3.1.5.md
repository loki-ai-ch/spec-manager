---
code: workflow-hardening-L3.1.5
level: L3
title: MiMo-Code agent provider compatibility
topic: workflow-hardening
parentCode: workflow-hardening-L2.1
status: implemented
aiSummary: >-
  新增 MiMo-Code 作为 AGENTS.md 兼容 agent provider，复用统一 workflow capsule，补充 provider
  检测、安装、CLI list 和 README 使用说明。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: 读取 L3/L2、agents 实现、CLI 测试、README 和 MiMo-Code AGENTS.md'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 src/core/agents.ts 和 src/cli/project.ts 新增 mimocode provider
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 provider 单元测试和 CLI 测试覆盖 mimocode
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 README.md 和 readme_zh.md 补充 MiMo-Code 使用方式
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 验证 targeted tests、npm test、npm run build 和 provider list smoke
    status: pending
created: '2026-06-12T02:15:09.497Z'
updated: '2026-06-12T02:21:45.970Z'
changeSummary: 'cascade: task-complete'
---
# MiMo-Code agent provider compatibility — 实施规格

## 目标

实施 `workflow-hardening-L2.1` 的多工具入口统一扩展：新增 MiMo-Code 作为 `AGENTS.md` 兼容 provider，并补充 README / 中文 README 的 MiMo-Code 使用方式。

**前置依赖**: `workflow-hardening-L3.1.3-tools` 已 implemented。

### 背景

对 `/Users/loki/code/github/MiMo-Code` 的文件级检查显示：

- 根目录存在 `AGENTS.md`，MiMo-Code 可读取项目级 AGENTS 指令。
- package name 为 `mimocode`，用户安装命令为 `npm install -g @mimo-ai/cli`。
- Runtime 配置使用 `.mimocode/mimocode.json`，但 spec-manager 工作流入口仍应复用 `AGENTS.md`。

### 范围

- SHALL 新增 `mimocode` provider 元数据，复用 `templates/agents/AGENTS.md`。
- SHALL 支持 aliases: `mimocode`、`mimo-code`、`mimo code`、`mimo`。
- SHALL 将已有 `AGENTS.md` 自动检测为 Codex、OpenCode、MiMo-Code 兼容入口。
- SHALL 更新 README / 中文 README 的 provider 表格、示例命令和说明。
- SHALL 保持 `codex` / `opencode` 既有行为不变。

### 非目标

- 不修改 MiMo-Code 仓库源码。
- 不新增 MiMo-Code 专属模板，除非未来 MiMo-Code 引入不同于 `AGENTS.md` 的入口文件。
- 不改变已有项目文件的覆盖语义；仍由 `--force` 控制覆盖。

## 实施步骤

### Step 1 — 上下文收集

- 读取 `workflow-hardening-L3.1.5` 与父级 `workflow-hardening-L2.1`。
- 读取 `src/core/agents.ts`、`src/cli/project.ts`、`src/core/__tests__/agents.test.ts`、`src/cli/__tests__/project-agents.test.ts`。
- 读取 `README.md` 与 `readme_zh.md` 的 agent setup 区块。
- 确认 MiMo-Code 仓库 `/Users/loki/code/github/MiMo-Code/AGENTS.md` 存在，且 README 使用 `mimocode` / `@mimo-ai/cli` 命名。

### Step 2 — 新增 provider 元数据

- 在 `src/core/agents.ts` 中将 `AGENT_PROVIDERS` 扩展为包含 `mimocode`。
- 在 `AGENT_PROVIDER_INFO` 中新增 `mimocode` 项：
  - `files: ['AGENTS.md']`
  - `installSteps` 复用 `templates/agents/AGENTS.md` 到 `AGENTS.md`
  - `notes` 明确 MiMo-Code 读取 `AGENTS.md`
- 更新 `src/cli/project.ts` provider help 文案，加入 `mimocode`。

### Step 3 — 补充 provider 测试

- 更新 `src/core/__tests__/agents.test.ts`：
  - alias 解析覆盖 `mimocode`、`mimo-code`、`mimo code`、`mimo`
  - provider list 顺序包含 `mimocode`
  - `all` 安装包含 `mimocode` 但 `AGENTS.md` 仍只创建一次
  - `AGENTS.md` 自动检测结果包含 `codex`、`opencode`、`mimocode`
- 更新 `src/cli/__tests__/project-agents.test.ts`：
  - list 输出包含 `mimocode`
  - 默认检测 `AGENTS.md` 输出包含 `mimocode`
  - explicit all 输出包含 `mimocode`

### Step 4 — 补充 README 使用方式

- 更新 `README.md`：
  - multi-agent 简介加入 MiMo-Code
  - provider 表格新增 MiMo-Code 行
  - examples 加入 `spec-manager project agents --provider mimocode`
  - 手动安装说明标注 Codex / OpenCode / MiMo-Code 共享 `AGENTS.md`
- 更新 `readme_zh.md` 同步中文说明。

### Step 5 — 验证

- 运行 provider targeted tests。
- 运行完整 `npm test`。
- 运行 `npm run build`。

## 验证命令

```bash
# 正向验证: provider 相关单元测试
npm test -- src/core/__tests__/agents.test.ts src/cli/__tests__/project-agents.test.ts
# 预期输出包含: Test Files  2 passed

# 正向验证: 完整测试
npm test
# 预期输出包含: Test Files

# 正向验证: TypeScript build
npm run build
# 预期退出码: 0

# 手工 smoke: provider list
node dist/cli/index.js project agents --provider list
# 预期输出包含: mimocode
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
  "coveredSpecs": ["workflow-hardening-L3.1.5"],
  "steps": [
    {
      "stepNo": 1,
      "stepType": "mcp_tool",
      "name": "上下文收集: 读取 L3/L2、agents 实现、CLI 测试、README 和 MiMo-Code AGENTS.md"
    },
    {
      "stepNo": 2,
      "stepType": "mcp_tool",
      "name": "编辑 src/core/agents.ts 和 src/cli/project.ts 新增 mimocode provider"
    },
    {
      "stepNo": 3,
      "stepType": "mcp_tool",
      "name": "编辑 provider 单元测试和 CLI 测试覆盖 mimocode"
    },
    {
      "stepNo": 4,
      "stepType": "mcp_tool",
      "name": "编辑 README.md 和 readme_zh.md 补充 MiMo-Code 使用方式"
    },
    {
      "stepNo": 5,
      "stepType": "mcp_tool",
      "name": "验证 targeted tests、npm test、npm run build 和 provider list smoke"
    }
  ]
}
```

autoConfirm: false。理由: 新增 provider 会影响 `--provider all` 输出和自动检测结果，需要显式冻结后实施。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| provider 行为异常 | `git revert <commit>` | < 5 min |
| README 表述不准确 | revert README/readme_zh.md 对应段落后重新提交 | < 5 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `AGENTS.md` 同时代表 Codex/OpenCode/MiMo-Code 导致自动检测多 provider | 复用现有多 provider 检测模型，安装阶段按 target 去重，文档中说明共享 `AGENTS.md` |
| MiMo-Code 后续改用专属规则文件 | 本 L3 不新增专属模板，后续以新 provider installStep 扩展 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | workflow-hardening-L2.1 | 多工具入口统一的增量 provider |
