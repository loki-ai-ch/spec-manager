---
code: agent-install-surface-L3.1.1
level: L3
title: Agent Platform Registry and Install CLI
topic: agent-install-surface
parentCode: agent-install-surface-L2.1
status: implemented
aiSummary: >-
  实现 AgentPlatform 注册表和 graphify-style install CLI：platform install、install
  --platform、agents/skills install，复用现有 provider 安装引擎并测试 fallback 语义。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey existing agent installer
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement platform registry
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Implement install CLI
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Add parser and CLI tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: agent-install-surface-L2.1
created: '2026-07-15T07:46:58.392Z'
updated: '2026-07-15T07:56:33.321Z'
changeSummary: 'cascade: task-complete'
---
# Agent Platform Registry and Install CLI

## 背景

`agent-install-surface-L2.1` 已确认平台安装面设计。本 L3 实现第一阶段：平台注册表、platform normalizer、顶层 install CLI，以及测试。README/英文 README 的长表文档放到后续 L3.1.2。

现有安装引擎 `installAgentSupport` 已能安装底层 provider。本 L3 不能复制安装逻辑，只应新增 platform -> provider/all 的解析层并复用现有安装流程。

## 目标

- 新增平台 registry，覆盖 L2.1 的平台清单。
- 支持 `spec-manager <platform> install`。
- 支持 `spec-manager install --platform <platform>`。
- 支持 `spec-manager agents install` 和 `spec-manager skills install`。
- 保留 `spec-manager project agents --provider ...` 兼容。
- 为 fallback 平台输出明确 notes，说明使用 AGENTS-compatible fallback。
- 增加测试覆盖 parser、CLI、dry-run、unsupported platform。

## 非目标

- 不写 README 长表；留给 L3.1.2。
- 不为 fallback 平台创建专属模板。
- 不增加 IDE 自动配置、OAuth、网络请求。
- 不改变 `installAgentSupport` 的文件覆盖语义。

## 涉及文件

- `src/core/agents.ts`
- `src/cli/index.ts` 或新增 CLI module
- `src/cli/project.ts` 如需抽 shared installer helper
- `src/core/__tests__/agents.test.ts`
- `src/cli/__tests__/project-agents.test.ts` 或新增 `agent-install.test.ts`

## 实施步骤

1. 在 `src/core/agents.ts` 新增 `AGENT_PLATFORMS` / `AGENT_PLATFORM_INFO`：
   - command 名、aliases、target provider/all、description、notes。
2. 新增 normalizer：
   - `normalizeAgentPlatform(input)`
   - `resolveAgentPlatformInstall(input)` 或等价函数。
3. 增加 shared install runner：
   - 复用 `installAgentSupport`。
   - 平台 notes 附加到 report.notes。
   - dry-run/force/sync-managed 与 `project agents` 一致。
4. 注册 CLI：
   - `spec-manager install --platform <platform>`
   - `spec-manager <platform> install` for each command platform.
   - `spec-manager agents install`
   - `spec-manager skills install`
5. 更新 `project agents --provider list` 或新增 platform list 输出（实现时可在 provider list 中附加 platform commands）。
6. 添加测试：
   - platform parser 覆盖 `claude`、`trae-cn`、`kimi`、`agents`、`skills`。
   - `spec-manager codex install --dry-run` 输出 planned codex。
   - `spec-manager kilo install --dry-run` 输出 planned codex 且包含 fallback note。
   - `spec-manager install --platform kimi --dry-run` 输出 planned codex。
   - `spec-manager agents install --dry-run` 和 `skills install --dry-run` 输出 all providers。
   - unknown platform 失败并提示 supported platforms。
   - 旧 `project agents --provider codex --dry-run` 仍通过。
7. 运行 targeted tests、lint、build。

## 平台清单

必须覆盖：

- claude
- codebuddy
- codex
- opencode
- kilo
- copilot
- vscode
- aider
- claw
- droid
- trae
- trae-cn
- cursor
- gemini
- hermes
- kimi
- amp
- agents
- skills
- kiro
- pi
- devin
- antigravity
- mimocode
- windsurf

## 接口契约

```bash
spec-manager codex install --dry-run
spec-manager kilo install --dry-run
spec-manager install --platform kimi --dry-run
spec-manager agents install --dry-run
spec-manager skills install --dry-run
```

输出必须包含 resolved provider，例如：

```text
✓ AI agent support planned: codex
notes:
  - Kilo Code uses AGENTS-compatible fallback instructions.
```

## 验收标准

1. **AC-1**: `spec-manager <platform> install` MUST work for every command platform in the platform list.
2. **AC-2**: `spec-manager install --platform kimi` MUST work and resolve to codex provider.
3. **AC-3**: `spec-manager agents install` and `spec-manager skills install` MUST resolve to all providers.
4. **AC-4**: Fallback platforms MUST install `AGENTS.md` via codex provider and emit fallback notes.
5. **AC-5**: Existing `project agents --provider` commands MUST remain compatible.
6. **AC-6**: `--dry-run`, `--force`, and `--sync-managed` MUST be accepted on new install commands.
7. **AC-7**: Unsupported platform errors MUST list or point to supported platforms.
8. **AC-8**: Targeted tests、lint、build MUST pass.

## 验证命令

```bash
npm test -- src/core/__tests__/agents.test.ts src/cli/__tests__/project-agents.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：顶层命令名和已有命令冲突。实现时不要覆盖已有 `project`、`spec`、`task`、`decision` 等命令。
- 风险：fallback 平台被误解为原生支持。notes 和 description 必须明确 AGENTS-compatible fallback。
- 回滚：移除平台注册表和新 CLI 注册，旧 `project agents` 不受影响。
