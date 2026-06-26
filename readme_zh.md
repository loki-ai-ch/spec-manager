# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md)

**让 AI 编程可交付、可审查、可追踪。** spec-manager 是 Claude Code、Codex、OpenCode、MiMo-Code、CodeBuddy、Cursor、Windsurf 等 AI 编程工具的本地工作流层。

你不需要一上来采用很重的流程。先在一个项目里跑起来，把 Agent 输出变成仓库里的交付记录。

## 为什么用它

- **少跑偏**：AI 按已确认的目标、设计边界和实施规格工作，而不是凭模糊 prompt 猜。
- **好审查**：需求、任务、决策、验证记录说明改了什么、为什么改、怎么确认。
- **可接力**：工作流产物落在仓库里的 markdown / JSON 文件，人和不同 Agent 都能从同一份上下文继续。
- **不挑工具**：Claude Code、Codex、OpenCode、MiMo-Code、CodeBuddy、Cursor、Windsurf 都能接入。

所有数据都在本地：markdown + git 存储，无后端、无网络依赖、无 MCP 要求。

## 它怎么工作

spec-manager 把工作产物保存在你的仓库里：PRD、设计、实现规格、任务历史、决策记录和验证证据。

一个典型需求会经过这条链路：

`L1 PRD -> L2 Design -> L3 Impl -> Agent Task -> Verification`

这样 AI agent 有明确冻结的实现目标，人也能回看范围、原因、执行过程和验证证据。

## 自适应 Harness 治理

有些改动需要速度，有些改动需要更强的证据来证明关键验收标准真的被验证过。

- 创建 Task 时记录 Profile 快照，避免后续配置变化改写当时的交付契约。
- `standard` 保持轻量，把缺失证据作为 warning 暴露出来。
- `governed` 把关键 AC 覆盖变成高风险任务的完成门禁。
- `project profile recommend`、`project profile metrics`、`project workflow preview`、`project readiness critical` 等只读命令帮助团队选择合适强度、审计缺口，而且不做隐藏自动化。

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
spec-manager assist guide --request "新增用户认证"  # 为 Agent 生成本地上下文与下一步建议
spec-manager assist critique auth-L1        # 确认前审查规格质量缺口
spec-manager assist next T-001 --spec auth-L3.1.1   # 导航任务下一步和证据
spec-manager assist drift T-001 --spec auth-L3.1.1  # 对账实际变更与声明范围
spec-manager assist acceptance T-001 --spec auth-L3.1.1 # 汇总证据、人工验收和残余风险
spec-manager assist delivery T-001 --spec auth-L3.1.1   # 生成面向用户的交付摘要
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

## 设计上下文

做 UI、视觉或样式相关工作时，可以在项目根目录放一个 `DESIGN.md` 描述产品的设计上下文。spec-manager 会把它当作可选的本地上下文，而不是 L2 技术设计的替代品。

- `spec-manager assist brief --request "<UI 需求>"` 会在需求命中设计相关意图且 `DESIGN.md` 存在时自动带上 Design Context。
- `spec-manager assist design-template --out DESIGN.md` 会写入 starter DESIGN.md；默认不覆盖已有文件，除非传 `--force`。
- `spec-manager assist design-export --format tokens-json --path DESIGN.md` 会导出规范化 tokens；使用 `--format dtcg-json` 可输出当前 DESIGN.md schema 的 DTCG JSON 子集，使用 `--out <file>` 可写入本地文件。
- L3 规格可以使用 `@verify: design-lint(DESIGN.md)`，把 DESIGN.md lint 结果记录为 verification evidence。
- 面向 review 的 L3 规格可以使用 `@verify: design-diff(DESIGN.before.md, DESIGN.md)` 比较两个显式 DESIGN.md 文件。该规则只在 after 文件新增 lint error/warning、任一文件缺失或移除 design token 时失败；新增/修改 token 和 section prose 变化会作为结构 diff 摘要展示。
- schema lint 会把无效颜色、尺寸、typography 和 component token 结构报告为 error；未知 component property 会报告为 warning。按 finding path 修复，例如 `colors.primary` 或 `components.button-primary.animation`。
- 第一版只读取、摘要、lint、diff 和报告 DESIGN.md；不会自动生成 UI、改写组件、判断视觉美学质量，也不依赖外部 design CLI。

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
