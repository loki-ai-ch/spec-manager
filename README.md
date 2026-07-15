# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

中文 | [English](readme_en.md)

**spec-manager 是给 AI 编程用的本地规格管理层。**

它把一次需求从“聊天里的一句话”变成仓库里的可追踪交付链路：

```text
L1 PRD -> L2 Design -> L3 Impl -> Agent Task -> Verification Evidence
```

适用于 Claude Code、Codex、OpenCode、MiMo-Code、CodeBuddy、Cursor、Windsurf 等 AI 编程工具。所有数据都落在本地 markdown / JSON 文件里，可 git diff、可 review、可被不同 Agent 接力；不需要后端、不需要数据库、不依赖 MCP。

## 解决什么问题

AI 写代码已经很快，但真实项目里更常见的问题是：

- 需求说得太短，Agent 直接开写，后面发现方向错了。
- 多轮对话之后，AI 忘了之前为什么这么设计。
- 代码改完了，但没有任务记录、验证证据和决策上下文。
- UI 需求只说“高级一点”，没有稳定的设计上下文。
- 不同 AI 工具各管各的，项目记忆散在聊天记录里。

spec-manager 的价值不是让流程变重，而是让 AI 在动手前先进入项目上下文，在交付时留下证据。

## 核心价值

- **少跑偏**：先确认 L1/L2/L3，再进入实现，Agent 有冻结的目标和边界。
- **好审查**：规格、任务、决策、验证记录都在仓库里，知道改了什么、为什么改、怎么验。
- **可接力**：Claude、Codex、OpenCode、MiMo-Code、CodeBuddy、Cursor、Windsurf 都能读同一套本地文件。
- **有证据**：Task step、verification evidence、acceptance report 让“完成了”不只是口头结论。
- **能管设计上下文**：UI/视觉任务可读取 `specs/DESIGN.md`，把设计 prose、tokens、do/don't 约束一起交给 Agent。

## 5 分钟开始

```bash
# 1. 安装
npm install -g spec-manager

# 2. 初始化你的项目
cd my-project
spec-manager project init --name my-project

# 3. 给 AI 编程工具写入工作流入口
spec-manager project agents --provider all
```

然后可以在终端先看 spec-manager 建议的安全下一步：

```bash
spec-manager next "新增用户认证"
spec-manager brief "新增用户认证"
spec-manager dashboard
```

也可以直接对你的 AI 工具说：

```text
使用 spec-manager 新增用户认证。
```

如果是 Claude Code / CodeBuddy skill：

```text
/spec-manager 新增用户认证
```

Agent 会先创建规格并请求你确认，再进入实现。你可以只停在规格阶段 review，也可以继续让它创建 Task、执行、记录验证。

简单区分一下：

- **终端命令**：`spec-manager next/brief/dashboard` 用来查看下一步、生成上下文和检查项目状态。
- **AI 聊天请求**：`使用 spec-manager ...` 或 `/spec-manager ...` 用来让 Agent 按工作流推进。

## 最短路径

不想一开始理解全部概念，可以只记这几个命令：

```bash
spec-manager project init --name my-project
spec-manager project agents --provider all
spec-manager next "新增用户认证"
spec-manager brief "新增用户认证"
spec-manager dashboard
spec-manager project doctor
```

如果你想自己手动推进完整链路：

```bash
spec-manager spec new L1 --topic auth --title "用户认证"
spec-manager spec update auth-L1 --content ./l1.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm auth-L1

spec-manager spec new L2 --topic auth --parent auth-L1 --title "认证设计"
spec-manager spec confirm auth-L2.1

spec-manager spec new L3 --topic auth --parent auth-L2.1 --title "JWT 实现"
spec-manager spec confirm auth-L3.1.1

spec-manager task run auth-L3.1.1 --plan ./plan.json
```

`spec-manager spec confirm <L3>` 只负责把 L3 冻结，不会自动创建 Task。确认并执行、创建并执行任务、继续执行这个 L3 时，推荐用 `task run` 显式合并冻结、创建 Task 和启动 Task。

如果 L3 已经 frozen，可以用一条命令创建并立即启动 Task：

```bash
spec-manager task create auth-L3.1.1 --plan ./plan.json --start
```

如果你需要排查或拆解 Task 生命周期，也可以继续使用高级手动链路：

```bash
spec-manager task create auth-L3.1.1 --plan ./plan.json
spec-manager task start T-001 --spec auth-L3.1.1
```

大多数时候，你不需要手动敲完这些。把工作流入口装进 AI 工具后，让 Agent 按 spec-manager 规则来做即可。

兼容旧入口仍然可用：`spec-manager guide "需求"`、`spec-manager assist guide --request "需求"`、`spec-manager flow status --topic T` 适合已有脚本或需要更细命令提示的场景。

## 它怎么工作

spec-manager 在项目里维护这些文件：

```text
my-project/
├── .spec-manager/
│   ├── config.yaml
│   ├── audit.json
│   └── incidents/
├── specs/<topic>/
│   ├── <topic>-L1.md
│   ├── <topic>-L2.1.md
│   ├── <topic>-L3.1.1.md
│   ├── decisions/
│   │   └── DC-001.md
│   └── tasks/
│       └── <specCode>-T-001.json
├── changes/<name>/
└── archive/<name>/
```

几个概念：

- **L1 PRD**：做什么，为什么做。
- **L2 Design**：技术方案和边界。
- **L3 Impl**：具体实施规格，冻结后才能写代码。
- **Agent Task**：Agent 执行步骤、状态、验证记录。
- **Decision card**：重要选择为什么这么定。
- **Verification Evidence**：测试、lint、build、design-lint 等可追踪证据。

## 单仓库与多仓库 specs

默认情况下，spec-manager 把 `.spec-manager/`、`specs/`、`changes/` 和 `archive/` 放在当前项目里。这适合一个代码仓库独立管理自己的规格。

如果你的目标是“一个 specs 根管理多个代码仓库”，推荐建立独立规划仓库或共享 specs 目录，然后让各代码仓库通过 `.spec-manager/config.yaml` 指向它：

```yaml
project_name: app-repo
specStore:
  id: product-planning
  path: ../product-specs
  mode: write
contextSources:
  - id: platform-specs
    path: ../platform-specs
    mode: read
```

几个边界要记住：

- **execution root**：你当前运行命令的代码仓库。
- **write root**：spec/task/decision 实际写入的 specs 根；配置 `specStore.path` 后，写命令会使用 resolved write root。
- **context sources**：只读上下文源，只给 brief/dashboard/context 读取，不参与写入。

写入前建议先检查：

```bash
spec-manager project context --json
spec-manager project store show
spec-manager project store doctor
spec-manager dashboard --json
```

未配置 `specStore` 时，行为保持单仓库默认，不需要迁移已有 specs。当前版本不提供 `--store <id|path>` 覆盖，也不会自动迁移 specs；如果要启用多仓库模式，请先初始化目标 specs 根，再配置 code repo 的 `specStore.path`。

UI/视觉项目的设计上下文也跟随 write root 管理：推荐放在 resolved write root 的 `specs/DESIGN.md`。代码仓库根目录的 `DESIGN.md` 仍作为 legacy fallback。

## 接入 AI 工具

一次安装所有支持的入口：

```bash
spec-manager agents install
# 等价别名
spec-manager skills install
```

只安装某个工具时，直接使用平台名：

```bash
spec-manager claude install
spec-manager codex install
spec-manager cursor install
spec-manager install --platform kimi
```

写入前预览：

```bash
spec-manager codex install --dry-run
spec-manager kilo install --dry-run
```

旧入口仍然保留，适合脚本或更细 provider 控制：

```bash
spec-manager project agents --provider all
spec-manager project agents --provider codex
spec-manager project agents --provider list
```

常用平台：

| 工具 | 推荐命令 | 写入内容 |
|---|---|---|
| Claude Code | `spec-manager claude install` | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| CodeBuddy | `spec-manager codebuddy install` | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |
| Codex | `spec-manager codex install` | `AGENTS.md` |
| OpenCode | `spec-manager opencode install` | `AGENTS.md` |
| MiMo-Code | `spec-manager mimocode install` | `AGENTS.md` |
| Cursor | `spec-manager cursor install` | `.cursorrules` |
| Windsurf | `spec-manager windsurf install` | `.windsurfrules` |

更多平台也可以直接装。没有专属原生格式的平台会使用 **AGENTS-compatible fallback instructions**，也就是写入通用 `AGENTS.md`，不会声称已经完成原生 IDE 集成。

| 平台 | 命令 |
|---|---|
| Kilo Code | `spec-manager kilo install` |
| GitHub Copilot CLI | `spec-manager copilot install` |
| VS Code Copilot Chat | `spec-manager vscode install` |
| Aider | `spec-manager aider install` |
| OpenClaw | `spec-manager claw install` |
| Factory Droid | `spec-manager droid install` |
| Trae | `spec-manager trae install` |
| Trae CN | `spec-manager trae-cn install` |
| Gemini CLI | `spec-manager gemini install` |
| Hermes | `spec-manager hermes install` |
| Kimi Code | `spec-manager kimi install` 或 `spec-manager install --platform kimi` |
| Amp | `spec-manager amp install` |
| Kiro IDE/CLI | `spec-manager kiro install` |
| Pi coding agent | `spec-manager pi install` |
| Devin CLI | `spec-manager devin install` |
| Google Antigravity | `spec-manager antigravity install` |

## 常用 assist 能力

这些命令用于让 Agent 更稳地工作，而不是替代完整流程：

```bash
spec-manager next "新增用户认证"                       # 输出当前最安全下一步
spec-manager brief "优化登录页视觉"                     # 生成 Agent Brief，UI 请求会带上 Design Context
spec-manager dashboard                                 # 查看项目/topic 摘要
spec-manager assist guide --request "新增用户认证"       # 兼容旧入口：读取本地上下文并建议下一步
spec-manager assist critique auth-L1                    # 审查规格质量缺口
spec-manager assist next T-001 --spec auth-L3.1.1       # 查看任务下一步和证据状态
spec-manager assist drift T-001 --spec auth-L3.1.1      # 对账实际变更是否偏离 L3 范围
spec-manager assist acceptance T-001 --spec auth-L3.1.1 # 汇总验收证据和残余风险
spec-manager assist delivery T-001 --spec auth-L3.1.1   # 生成面向用户的交付摘要
```

## Design Context：让 UI 需求不再只靠感觉

做 UI、视觉、样式相关任务时，推荐把设计上下文放在：

```text
specs/DESIGN.md
```

它是 spec-manager 管理的 specs 体系的一部分。根目录 `DESIGN.md` 仍作为 legacy fallback 兼容。

常用命令：

```bash
spec-manager assist design-template
spec-manager brief "优化仪表盘视觉"
spec-manager assist design-export --format tokens-json
```

L3 里可以把设计 lint 纳入验证：

```text
@verify: design-lint(specs/DESIGN.md)
```

当前 Design Context 支持：

- 读取 DESIGN.md frontmatter 和 prose section。
- lint colors、typography、spacing、rounded、components 等 token。
- 输出 `tokens-json`、`dtcg-json`、`tailwind-json`、`tailwind-css`。
- 在 Agent Brief 中提示 prose-first、具体灵感参照、do/don't 约束。
- 用 `design-diff` 对比两个 DESIGN.md 的结构变化。

它不会自动生成 UI、不会修改 Tailwind 配置，也不会替你判断审美质量；它的作用是把设计上下文稳定地交给 Agent。

## 自适应治理

有些任务只需要轻量流程，有些高风险任务需要更强证据。

spec-manager 支持 Profile：

- `standard`：保持轻量，缺失证据以 warning 暴露。
- `governed`：关键 AC 必须有成功 verification evidence 才能完成 Task。

只读辅助命令：

```bash
spec-manager project profile recommend --request "新增 SSO 登录"
spec-manager project profile metrics
spec-manager project workflow preview
spec-manager project readiness critical
```

这些命令不会偷偷修改配置，只帮助你理解风险和证据缺口。

## 常用命令速查

| 命令 | 用途 |
|---|---|
| `spec-manager project init --name X` | 初始化 `.spec-manager/` |
| `spec-manager project agents --provider all` | 写入 AI 工具入口 |
| `spec-manager project doctor` | 检查配置和仓库完整性 |
| `spec-manager project docs check` | 发布前检查 README、package files、Agent guidance 和生成资产边界 |
| `spec-manager next "需求"` | 根据需求给出下一条安全命令 |
| `spec-manager brief "需求"` | 生成 Agent Brief 和下一步 |
| `spec-manager dashboard` | 查看项目/topic 摘要 |
| `spec-manager guide "需求"` | 兼容旧入口：根据需求给出下一条命令 |
| `spec-manager new feature --topic T "标题"` | 快速创建轻量 L1 |
| `spec-manager flow status --topic T` | 查看规格链路进度和阻塞点 |
| `spec-manager spec list` | 列出规格 |
| `spec-manager spec show <code> --include-content` | 查看规格正文 |
| `spec-manager task list --topic T` | 查看任务 |
| `spec-manager decision list --topic T` | 查看决策 |
| `spec-manager view --topic T` | 交互式浏览 |

任何命令都可以加 `--help` 查看细节。

## 适合谁

适合：

- 正在用 AI Agent 维护真实项目的人。
- 想让 AI 改动可 review、可验收、可追踪的团队。
- 需要在多个 AI 编程工具之间共享项目记忆的人。
- 需要把 UI 设计上下文交给 Agent 的项目。

不适合：

- 一次性 demo。
- 完全不想保留规格和任务历史的临时代码。
- 只想让 AI 直接改一行 typo 的场景。此类小改可用 `quick` 例外。

## 深入了解

- [English README](readme_en.md)
- [方法论](docs/methodology.md)
- [规则](rules/)
- [模板](templates/)
- [决策卡片模板](templates/decision.md)

## License

MIT
