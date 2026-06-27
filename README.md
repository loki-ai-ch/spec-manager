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

然后直接对你的 AI 工具说：

```text
使用 spec-manager 新增用户认证。
```

如果是 Claude Code / CodeBuddy skill：

```text
/spec-manager 新增用户认证
```

Agent 会先创建规格并请求你确认，再进入实现。你可以只停在规格阶段 review，也可以继续让它创建 Task、执行、记录验证。

## 最短路径

不想一开始理解全部概念，可以只记这几个命令：

```bash
spec-manager project init --name my-project
spec-manager project agents --provider all
spec-manager guide "新增用户认证"
spec-manager flow status --topic auth
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

spec-manager task create auth-L3.1.1 --plan ./plan.json
spec-manager task start T-001 --spec auth-L3.1.1
```

大多数时候，你不需要手动敲完这些。把工作流入口装进 AI 工具后，让 Agent 按 spec-manager 规则来做即可。

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

## 接入 AI 工具

一次安装所有支持的入口：

```bash
spec-manager project agents --provider all
```

只安装某个工具：

```bash
spec-manager project agents --provider claude
spec-manager project agents --provider codex
spec-manager project agents --provider opencode
spec-manager project agents --provider mimocode
spec-manager project agents --provider codebuddy
spec-manager project agents --provider cursor
spec-manager project agents --provider windsurf
```

写入前预览：

```bash
spec-manager project agents --provider codex --dry-run
```

| 工具 | 入口 | 文件 |
|---|---|---|
| Claude Code | 原生 skill | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| Codex | `AGENTS.md` 工作流胶囊 | `AGENTS.md` |
| OpenCode | `AGENTS.md` 工作流胶囊 | `AGENTS.md` |
| MiMo-Code | `AGENTS.md` 工作流胶囊 | `AGENTS.md` |
| CodeBuddy | 原生 skill | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |
| Cursor | 项目规则 | `.cursorrules` |
| Windsurf | 项目规则 | `.windsurfrules` |

## 常用 assist 能力

这些命令用于让 Agent 更稳地工作，而不是替代完整流程：

```bash
spec-manager assist guide --request "新增用户认证"       # 读取本地上下文并建议下一步
spec-manager assist brief --request "优化登录页视觉"     # 生成 Agent Brief，UI 请求会带上 Design Context
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
spec-manager assist brief --request "优化仪表盘视觉"
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
| `spec-manager guide "需求"` | 根据需求给出下一条命令 |
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
