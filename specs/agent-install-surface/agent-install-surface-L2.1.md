---
code: agent-install-surface-L2.1
level: L2
title: Platform Install Surface Design
topic: agent-install-surface
parentCode: agent-install-surface-L1
status: implemented
aiSummary: >-
  设计 graphify-style 平台安装面：新增 AgentPlatform 注册表，映射平台命令到既有 provider/all，fallback
  平台使用 AGENTS-compatible 指令，保留 project agents 兼容。
created: '2026-07-15T07:45:15.594Z'
updated: '2026-07-15T07:56:33.327Z'
changeSummary: 'cascade: task-complete'
---
# Platform Install Surface Design

## 背景

`agent-install-surface-L1` 要求实现 graphify-style 安装入口，让用户用平台名直接安装 spec-manager Agent 指令。现有实现已经有可靠的底层引擎：

```bash
spec-manager project agents --provider <provider>
```

核心设计问题不是重写安装逻辑，而是新增一个更顺手的 platform surface，并把多个平台映射到既有安装资产。

## 方案概述

引入 `AgentPlatform` 映射层：

- `AgentProvider` 继续表示底层安装资产，如 `claude`、`codex`、`codebuddy`、`cursor`、`windsurf`。
- `AgentPlatform` 表示用户认知里的平台命令，如 `claude`、`kilo`、`copilot`、`trae-cn`、`antigravity`。
- 每个 platform 映射到一个 provider 或 `all`。
- 没有专属格式的平台默认映射到通用 `codex` provider，即安装 `AGENTS.md`，并在 notes 中说明它使用 AGENTS-compatible fallback。

新增 CLI 入口：

```bash
spec-manager <platform> install [--dry-run] [--force] [--sync-managed]
spec-manager install --platform <platform> [--dry-run] [--force] [--sync-managed]
spec-manager agents install [--dry-run] [--force] [--sync-managed]
spec-manager skills install [--dry-run] [--force] [--sync-managed]
```

保留现有入口：

```bash
spec-manager project agents --provider <provider>
```

## 平台映射

| Platform | Command | Provider | Notes |
|---|---|---|---|
| Claude Code | `spec-manager claude install` | `claude` | Native skill + CLAUDE.md |
| CodeBuddy | `spec-manager codebuddy install` | `codebuddy` | Native skill + CODEBUDDY.md |
| Codex | `spec-manager codex install` | `codex` | AGENTS.md |
| OpenCode | `spec-manager opencode install` | `opencode` | AGENTS.md |
| Kilo Code | `spec-manager kilo install` | `codex` | AGENTS-compatible fallback |
| GitHub Copilot CLI | `spec-manager copilot install` | `codex` | AGENTS-compatible fallback |
| VS Code Copilot Chat | `spec-manager vscode install` | `codex` | AGENTS-compatible fallback |
| Aider | `spec-manager aider install` | `codex` | AGENTS-compatible fallback |
| OpenClaw | `spec-manager claw install` | `codex` | AGENTS-compatible fallback |
| Factory Droid | `spec-manager droid install` | `codex` | AGENTS-compatible fallback |
| Trae | `spec-manager trae install` | `codex` | AGENTS-compatible fallback |
| Trae CN | `spec-manager trae-cn install` | `codex` | AGENTS-compatible fallback |
| Cursor | `spec-manager cursor install` | `cursor` | .cursorrules |
| Gemini CLI | `spec-manager gemini install` | `codex` | AGENTS-compatible fallback |
| Hermes | `spec-manager hermes install` | `codex` | AGENTS-compatible fallback |
| Kimi Code | `spec-manager install --platform kimi` | `codex` | AGENTS-compatible fallback |
| Amp | `spec-manager amp install` | `codex` | AGENTS-compatible fallback |
| Agent Skills | `spec-manager agents install` / `spec-manager skills install` | `all` | Cross-framework install |
| Kiro IDE/CLI | `spec-manager kiro install` | `codex` | AGENTS-compatible fallback |
| Pi coding agent | `spec-manager pi install` | `codex` | AGENTS-compatible fallback |
| Devin CLI | `spec-manager devin install` | `codex` | AGENTS-compatible fallback |
| Google Antigravity | `spec-manager antigravity install` | `codex` | AGENTS-compatible fallback |
| MiMo-Code | `spec-manager mimocode install` | `mimocode` | AGENTS.md |
| Windsurf | `spec-manager windsurf install` | `windsurf` | .windsurfrules |

## 技术决策

- 在 `src/core/agents.ts` 中维护平台注册表，复用 `installAgentSupport`。
- `parseAgentProviders` 保持 provider 语义；新增 `normalizeAgentPlatform` 或等价函数处理 platform 语义。
- CLI 安装入口应调用同一 helper，避免 `project agents` 和 `<platform> install` 输出行为漂移。
- `agents install` 和 `skills install` 映射到 `all`，保留 `project agents --provider all` 兼容。
- Unsupported platform 应提示可用 platform commands，而不是只列 provider。
- dry-run/force/sync-managed 行为与 `project agents` 一致。

## 受影响模块

- `src/core/agents.ts`: 新增 platform registry、normalizer、platform install target resolution。
- `src/cli/index.ts` 或新 CLI module：注册顶层 `<platform> install` 和 `install --platform`。
- `src/cli/project.ts`: 可复用 shared installer helper，保持旧入口。
- `src/core/setup-surface.ts`: setup suggested commands 可继续使用旧入口，也可后续切到新入口。
- `README.md` / `readme_en.md`: 新增平台安装命令表。
- `skill/SKILL.md` / templates: 如有必要补充新入口。
- tests: agents core、project agents CLI、新 install CLI。

## 接口契约

成功安装输出沿用现有格式：

```text
✓ AI agent support installed: codex
created:
  - AGENTS.md
notes:
  - Kilo Code uses AGENTS-compatible fallback instructions.
```

dry-run:

```bash
spec-manager kilo install --dry-run
spec-manager install --platform kimi --dry-run
```

错误：

```text
✗ unsupported AI platform: unknown. Use one of: claude, codebuddy, codex, ...
```

## L3 裂变计划

- L3.1.1: Agent Platform Registry and Install CLI
- L3.1.2: README and Agent Guidance for Platform Install Surface

## 验收标准

1. **AC-1**: 设计 MUST 保留现有 `project agents --provider` 行为。
2. **AC-2**: 设计 MUST 有单一 platform registry，避免 README/CLI/tests 多处硬编码。
3. **AC-3**: 设计 MUST 明确新平台的 fallback provider 和 notes。
4. **AC-4**: 设计 MUST 支持 `agents install` 和 `skills install` 作为 all/cross-framework alias。
5. **AC-5**: 设计 MUST 支持 `install --platform kimi`。
6. **AC-6**: 设计 MUST 覆盖 dry-run/force/sync-managed 选项。
7. **AC-7**: 设计 MUST 不声称 fallback 平台具备原生 IDE 集成。

## 风险

- 风险：把 fallback 说成 native support。文案必须明确 AGENTS-compatible fallback。
- 风险：顶层命令过多污染 help。可以统一注册平台命令，但描述保持简短。
- 风险：`agents` 既像名词又像 provider。这里固定为 cross-framework alias，底层 provider 为 `all`。
