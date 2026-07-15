---
code: agent-install-surface-L1
level: L1
title: Graphify-style Agent Install Commands
topic: agent-install-surface
parentCode: null
status: implemented
aiSummary: >-
  新增 graphify-style Agent 安装入口需求：支持 spec-manager <platform> install、install
  --platform、agents/skills install，并扩展多平台 alias 到安全通用入口。
created: '2026-07-15T07:41:53.932Z'
updated: '2026-07-15T07:56:33.334Z'
changeSummary: 'cascade: task-complete'
---
# Graphify-style Agent Install Commands

## 背景

当前 spec-manager 的 Agent 入口安装主要通过：

```bash
spec-manager project agents --provider <provider>
```

它功能完整但不够顺手。用户参考 graphify 的安装命令面，希望在项目 build/初始化后可以直接运行：

```bash
spec-manager claude install
spec-manager codebuddy install
spec-manager codex install
spec-manager agents install
spec-manager install --platform kimi
```

并覆盖更多 AI coding 平台：Claude Code、CodeBuddy、Codex、OpenCode、Kilo Code、GitHub Copilot CLI、VS Code Copilot Chat、Aider、OpenClaw、Factory Droid、Trae、Trae CN、Cursor、Gemini CLI、Hermes、Kimi Code、Amp、Agent Skills、Kiro、Pi、Devin、Google Antigravity 等。

## 用户故事

1. 作为 spec-manager 用户，我希望用 `spec-manager <platform> install` 快速写入对应 Agent 入口，而不是先记住 `project agents --provider`。
2. 作为多 Agent 用户，我希望 `spec-manager agents install` / `spec-manager skills install` 一次安装跨框架入口。
3. 作为使用新兴/未深度适配平台的用户，我希望它们至少安装兼容的通用 Agent 指令，而不是报 unsupported。
4. 作为维护者，我希望 provider/platform 列表有统一映射，避免 README、CLI、测试各写一套别名。

## 验收标准

1. **AC-1**: CLI MUST support `spec-manager <platform> install` for the listed platforms where `<platform>` is a normalized command name.
2. **AC-2**: CLI MUST support `spec-manager install --platform <platform>` for platforms that are awkward as command names, including `kimi`.
3. **AC-3**: CLI MUST support `spec-manager agents install` and `spec-manager skills install` as cross-framework install aliases.
4. **AC-4**: Existing `spec-manager project agents --provider ...` MUST remain compatible.
5. **AC-5**: Existing provider behavior for Claude Code, CodeBuddy, Codex, OpenCode, Cursor, Windsurf, and MiMo-Code MUST remain unchanged.
6. **AC-6**: New platforms without a dedicated native format MUST install the safest compatible generic entrypoint, usually `AGENTS.md`, with clear provider notes.
7. **AC-7**: README and English README MUST show the new install surface and map platforms to commands.
8. **AC-8**: Tests MUST cover provider parsing, representative platform commands, cross-framework aliases, dry-run behavior, and unsupported platform errors.

## 范围边界

本轮只实现本地文件安装面，不引入网络服务、平台 API、OAuth、插件市场或 IDE 自动配置。不为每个新平台声称有原生能力；没有专属格式的平台应明确使用通用 Agent instructions fallback。

## 价值

这个改动降低上手门槛：用户从“我用哪个 Agent”直接得到命令，而不是先理解 spec-manager 内部 provider 概念。同时它保留现有 provider 安装引擎，避免把维护成本扩散到多套实现。
