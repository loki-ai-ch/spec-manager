# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md)

**让 AI 写代码的过程可追踪。** spec-manager 是 Claude Code、Codex、OpenCode、MiMo-Code、CodeBuddy、Cursor、Windsurf 等 AI 编程工具的本地工作流层。

你不需要一上来理解完整流程。先在一个项目里跑起来，再慢慢加深。

## 为什么用它

- **少失控**：AI 不再只凭一句模糊 prompt 直接改代码，而是先留下轻量规格。
- **好交接**：需求、任务、决策、验证记录都落在仓库里的 markdown / JSON 文件。
- **不挑工具**：Claude Code、Codex、OpenCode、MiMo-Code、CodeBuddy、Cursor、Windsurf 都能接入。

所有数据都在本地：markdown + git 存储，无后端、无网络依赖、无 MCP 要求。

## 它怎么工作

spec-manager 把工作产物保存在你的仓库里：PRD、设计、实现规格、任务历史、决策记录和验证证据。

一个典型需求会经过这条链路：

`L1 PRD -> L2 Design -> L3 Impl -> Agent Task -> Verification`

这样 AI agent 有明确冻结的实现目标，人也能回看每次改动为什么做、怎么做、验证过什么。

## 自适应 Harness 治理

`v0.4.2` 增加了一条更适合关键任务的验收证据路径。

- 创建 Task 时记录 Profile 快照。
- `standard` 保持轻量，缺少覆盖时以 warning 暴露。
- `governed` 要求 frozen L3 声明 critical AC，并提供覆盖这些 AC 的验证证据。
- `project profile recommend`、`project profile metrics`、`project workflow preview`、`project readiness critical` 等只读命令用于预览和审计，不做隐藏门禁。

示例：

```bash
spec-manager project profile recommend --request "新增 SSO 登录"
spec-manager project readiness critical
```

## 3 分钟开始

```bash
# 1. 安装，或直接 npx 运行
npm install -g spec-manager
# 或: npx spec-manager <command>

# 2. 初始化项目
cd my-project
spec-manager project init --name my-project

# 3. 给你的 AI 编程工具写入工作流入口
spec-manager project agents --provider all
```

然后直接对 AI 说：

```text
使用 spec-manager 新增用户认证。
```

如果是 Claude Code / CodeBuddy skill：

```text
/spec-manager 新增用户认证
```

AI 会先创建规格，并在真正实现前请求你确认。你可以只到这里停下来看看生成的文件，也可以继续让它执行完整任务。

## MiMo-Code

MiMo-Code 读取项目根目录的 `AGENTS.md`，所以接入很简单：

```bash
npm install -g @mimo-ai/cli
spec-manager project agents --provider mimocode
mimocode
```

这会把 spec-manager 的共享工作流胶囊写入 `AGENTS.md`。

## AI 工具接入

如果不想一次安装所有入口，只安装你正在用的工具：

```bash
spec-manager project agents --provider list
spec-manager project agents --provider claude
spec-manager project agents --provider codex
spec-manager project agents --provider opencode
spec-manager project agents --provider mimocode
spec-manager project agents --provider codebuddy
spec-manager project agents --provider cursor
spec-manager project agents --provider windsurf
```

写入前可以先预览：

```bash
spec-manager project agents --provider mimocode --dry-run
```

| 工具 | spec-manager 入口 | 文件 |
|---|---|---|
| Claude Code | 原生 skill | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| Codex | `AGENTS.md` 工作流胶囊 | `AGENTS.md` |
| OpenCode | `AGENTS.md` 工作流胶囊 | `AGENTS.md` |
| MiMo-Code | `AGENTS.md` 工作流胶囊 | `AGENTS.md` |
| CodeBuddy | 原生 skill | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |
| Cursor | 项目规则 | `.cursorrules` |
| Windsurf | 项目规则 | `.windsurfrules` |

## 想自己控制流程时

不用背完整命令，先用这些入口：

```bash
spec-manager guide "新增用户认证"           # 告诉你下一步该做什么
spec-manager new feature --topic auth "用户认证"
spec-manager flow status --topic auth       # 看进度和阻塞点
spec-manager view --topic auth              # 交互式浏览
spec-manager project doctor                 # 检查配置和仓库完整性
```

需要更严格时，再使用完整流程：

```bash
spec-manager spec new L1 --topic auth --title "用户认证"
spec-manager spec update auth-L1 --content ./l1.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm auth-L1
spec-manager spec new L2 --topic auth --parent auth-L1 --title "认证设计"
spec-manager spec new L3 --topic auth --parent auth-L2.1 --title "JWT 实现"
spec-manager task create auth-L3.1.1 --plan ./plan.json
```

这部分是可选深度。大多数人先从 `guide`、`new feature` 或 AI prompt 开始就够了。

## 核心概念

- **L1**：做什么，为什么做
- **L2**：技术方案
- **L3**：实施计划
- **Task**：AI 执行记录、步骤和验证
- **Decision card**：重要决策为什么这么选
- **Delta change**：修改已上线规格但保留历史

## 常用命令

| 命令 | 用途 |
|---|---|
| `spec-manager project init --name X` | 创建 `.spec-manager/` |
| `spec-manager project agents [--provider P]` | 安装 AI 工具工作流入口 |
| `spec-manager project doctor` | 检查配置和仓库完整性 |
| `spec-manager guide "需求"` | 根据需求给出下一条命令 |
| `spec-manager new feature --topic T "标题"` | 快速启动一个轻量 L1 |
| `spec-manager flow status --topic T` | 查看进度和阻塞点 |
| `spec-manager spec list` | 列出规格 |
| `spec-manager spec show <code> --include-content` | 读取规格 |
| `spec-manager task list --topic T` | 查看任务 |
| `spec-manager decision list --topic T` | 查看决策 |

任何命令都可以加 `--help` 查看详细用法。

## 会生成哪些文件

```text
my-project/
├── .spec-manager/
│   ├── config.yaml
│   ├── audit.json
│   └── incidents/
├── specs/<topic>/
│   ├── <L1-code>.md
│   ├── <L2-code>.md
│   ├── <L3-code>[-desc].md
│   ├── decisions/
│   │   └── DC-001.md
│   └── tasks/
│       └── <specCode>-T-001.json
├── changes/<name>/
└── archive/<name>/
```

规格编码是可读的：`auth-L1`、`auth-L2.1`、`auth-L3.1.1-jwt`。

## 深入了解

- [方法论](docs/methodology.md)
- [规则](rules/)
- [模板](templates/)
- [决策卡片模板](templates/decision.md)

## 许可证

MIT
