# spec-manager Roadmap — 借鉴 OpenSpec 的改进计划

> 基于对 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 源码的深度对比分析，提炼出 5 个值得借鉴的改进方向。

## 1. AI 指令生成

**现状**：`guide` 命令只输出下一步建议文本，AI 需要自己读规则文件理解约束。

**目标**：生成结构化指令，把规则、父 spec 摘要、必填段、模板打包成一条可直接消费的 prompt。

**设计**：

```bash
spec-manager guide auth-L1 --format rich
```

输出结构：
```xml
<task>为 auth-L1 编写 L1 PRD 正文</task>
<parent_context>
  父 spec: auth-L0 (愿景)
  aiSummary: "用户认证体系，支持 OAuth 2.0 + JWT"
</parent_context>
<rules>
  R1: 写完内容后必须停下等审核
  R2: confirm/freeze 是用户行为，不是 AI 行为
</rules>
<required_sections>
  ## 背景 / ## 用户故事 / ## 验收标准 / ## 范围边界
</required_sections>
<template>
  见 templates/L1-prd.md
</template>
<next_command>
  spec-manager spec update auth-L1 --content ./l1.md --ai-summary "..." --change-summary "..."
</next_command>
```

**关键文件**：`src/cli/usability.ts`（guide 命令）、`src/core/usability.ts`、`src/core/validate.ts`（必填段定义）、`rules/`（规则文件）

**涉及规则**：R1、R2、R22

---

## 2. 工具自动检测

**现状**：`spec-manager project agents --provider all` 安装所有工具的指令文件，但用户必须手动指定 provider。没有自动检测项目中已安装的 AI 工具。

**目标**：不传 `--provider` 时自动检测已安装工具，减少配置摩擦。

**设计**：

```bash
spec-manager project agents           # 自动检测已安装工具
spec-manager project agents --provider all  # 强制安装全部（现有行为不变）
```

检测逻辑：
```
.claude/          → Claude Code
.codebuddy/       → CodeBuddy
AGENTS.md         → Codex / OpenCode（AGENTS.md 兼容工具）
.cursorrules      → Cursor
.windsurfrules    → Windsurf
```

**关键文件**：`src/core/agents.ts`（agents 命令实现）、`src/cli/project.ts`（CLI 注册）

---

## 3. 交互式仪表盘

**现状**：`flow status` 输出纯文本，多 topic 时信息密度低，无法导航。

**目标**：交互式浏览所有 topic / spec / task 状态，可点击选择查看详情。

**设计**：

```bash
spec-manager view                  # 交互式浏览
spec-manager view --topic auth     # 按 topic 过滤
```

交互流程：
```
? 选择 topic: (Use arrow keys)
❯ auth [L1: implemented, L2: 2/3 implemented, Task: 1 running]
  billing [L1: confirmed, L2: draft]
  ...

? auth:
❯ auth-L1 [implemented] — OAuth 2.0 + JWT
  auth-L2.1 [implemented] — 后端设计
  auth-L2.2 [frozen] — 前端设计
  T-001 [running] — auth-L3.1.1-jwt
```

依赖：`@inquirer/prompts`（select、search）

**关键文件**：新增 `src/cli/view.ts`，复用 `src/core/spec-io.ts`（listAllSpecs）、`src/core/task.ts`（listTasks）

---

## 4. Shell 补全

**现状**：无 shell 补全。用户需要记忆命令和子命令。

**目标**：支持 zsh / bash / fish 补全。

**设计**：

```bash
spec-manager completion install zsh    # 安装 zsh 补全
spec-manager completion install bash   # 安装 bash 补全
spec-manager completion uninstall      # 卸载
```

Commander.js 内置 `.complete()` 方法，子命令和选项自动补全。额外支持 spec code 补全（从 specs/ 目录扫描）。

**关键文件**：新增 `src/cli/completion.ts`，注册到 `src/cli/index.ts`

---

## 5. Project Context 注入

**现状**：`.spec-manager/config.yaml` 只有项目名称，没有技术栈、约束等上下文信息。AI 每次都要问或猜测。

**目标**：在 config.yaml 中定义项目上下文，`guide` 命令输出时自动附带。

**设计**：

```yaml
# .spec-manager/config.yaml
project: my-app
context: |
  Tech stack: TypeScript, Node.js 18, ESM
  Database: PostgreSQL 16
  部署: Docker + AWS ECS
  约束: 不引入新 ORM，复用现有 Prisma schema
```

`guide` 输出时注入 `<project_context>` 段（与第 1 点的 AI 指令生成结合）。

**关键文件**：`src/core/paths.ts`（config 路径）、`src/core/usability.ts`（guide 命令）

---

## 实施顺序

| 优先级 | 改进项 | 工作量 | 依赖 |
|---|---|---|---|
| P1 | AI 指令生成 | 中 | 无 |
| P2 | 工具自动检测 | 小 | 无 |
| P3 | 交互式仪表盘 | 中 | 需加 `@inquirer/prompts` 依赖 |
| P4 | Shell 补全 | 小 | 无 |
| P5 | Project Context 注入 | 小 | 与 P1 结合效果最佳 |

## 不做的事

| 特性 | 原因 |
|---|---|
| Telemetry | spec-manager 定位纯本地，加遥测违背承诺 |
| 26 个工具适配器 | 先做好 4 个，够用再扩展 |
| Workspace 多项目 | 小团队场景用不到 |
| Profile 系统 | 规则过滤（applies_to）已经够灵活 |
