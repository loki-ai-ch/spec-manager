---
code: roadmap-openspec-L2.1
level: L2
title: 技术方案：OpenSpec 改进路线图落地
topic: roadmap-openspec
parentCode: roadmap-openspec-L1
status: implemented
created: '2026-06-06T02:40:16.856Z'
updated: '2026-06-08T03:22:18.839Z'
aiSummary: >-
  技术方案将 roadmap 拆为 rich guide/context、agent 自动检测、交互式 view、shell completion 四个
  L3；默认兼容现有 guide/project agents/flow 行为，仅 view 引入 @inquirer/prompts
changeSummary: frozen → implemented
---
# 技术方案：OpenSpec 改进路线图落地 — 技术设计

## 方案概述

本方案把 `docs/roadmap.md` 的 5 项改进拆为 4 个可独立交付模块。第一轮优先交付 rich guide 与 project context 注入；后续依次交付 agent provider 自动检测、交互式 view、shell completion。

```
[config.yaml context] ─┐
[spec/rules/template] ─┼─> [guide rich renderer] ──> AI prompt
[flow/task state]     ─┘

[project files] ──> [agent provider detector] ──> [project agents install]

[spec/task state] ──> [view selector] ──> [detail renderer]
[command tree + specs] ──> [completion generator] ──> [zsh/bash/fish script]
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| rich guide 输出格式 | A: XML-like tagged text B: JSON only C: Markdown | A | roadmap 示例已采用 XML-like；对 AI 可读且人类可直接浏览，后续可再扩展 JSON |
| guide 默认行为 | A: 默认 rich B: 新增 `--format rich`，默认保持短文本 | B | 避免破坏当前 `guide` 的轻量输出和脚本兼容性 |
| project context 来源 | A: `.spec-manager/config.yaml` 可选 `context` 字段 B: 新文件 C: 环境变量 | A | 与现有项目配置同源，纯本地，用户可直接编辑 |
| provider 自动检测触发方式 | A: 不传 `--provider` 时检测 B: 新增 `--auto` C: 永远 all | A | 符合 roadmap；显式 `--provider all` 保持原行为 |
| Codex/OpenCode 共用 `AGENTS.md` 的处理 | A: 同时返回 codex/opencode B: 只返回 codex C: 提示用户选择 | A | 两者安装步骤目标相同，安装层已有目标去重，不会重复写文件 |
| 交互式 view 依赖 | A: `@inquirer/prompts` B: 手写 readline C: 不做交互 | A | roadmap 指定依赖；select/search 能覆盖 topic/spec/task 导航 |
| completion 实现 | A: Commander 静态命令树 + spec 扫描 B: 依赖 shell 插件 C: 只输出文档 | A | 可保持本地生成，spec code 补全来自现有 `listAllSpecs` |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/usability.ts` | 修改 | 新增 rich guide 输入模型、config context 读取、结构化渲染 | 单元测试覆盖有/无 context、有/无 parent/spec |
| `src/cli/usability.ts` | 修改 | `guide` 增加 `--format text\|rich` 并调用 rich renderer | CLI 测试断言输出段落 |
| `src/core/validate.ts` | 复用/轻改 | 暴露或复用 level 必填段定义给 guide | 单元测试断言 L1/L2/L3 required sections |
| `rules/` 与 `templates/` | 复用 | rich guide 读取相关规则摘要和模板内容 | 不直接改规则；通过 renderer 测试 |
| `.spec-manager/config.yaml` | 兼容扩展 | 支持可选 `context` 多行字段 | fixture 测试解析 |
| `src/core/agents.ts` | 修改 | 新增 provider 检测函数并保持 install 去重 | 单元测试覆盖 `.claude/`、`.codebuddy/`、`AGENTS.md`、`.cursorrules`、`.windsurfrules` |
| `src/cli/project.ts` | 修改 | `project agents` 不传 provider 时走检测，显式 provider 走现有解析 | CLI 测试覆盖默认/显式 all/list |
| `src/cli/view.ts` | 新增 | 交互式 topic/spec/task 选择与详情渲染 | 通过 mock prompt 做 CLI 单元测试；保留 `flow status` |
| `src/cli/completion.ts` | 新增 | completion install/uninstall 和脚本生成 | 单元测试生成 zsh/bash/fish 脚本包含命令与 spec code hook |
| `src/cli/index.ts` | 修改 | 注册 view 与 completion 命令 | CLI help 快照或包含性断言 |
| `package.json` | 修改 | 为 view 增加 `@inquirer/prompts` | 测试安装后 `pnpm test` |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| Project config | `context` | string | 新增可选 | 空字符串 | 是 |
| Guide options | `format` | `'text' \| 'rich'` | 新增 | `'text'` | 是 |
| Agent detection report | `detectedProviders` | AgentProvider[] | 新增 | `[]` | 是 |
| Agent detection report | `reasonByProvider` | Record<string,string[]> | 新增 | `{}` | 是 |
| Completion target | `shell` | `'zsh' \| 'bash' \| 'fish'` | 新增 | 无 | 是 |

## 接口契约

### CLI: `spec-manager guide [request...] --format rich`

**请求**:
```bash
spec-manager guide roadmap-openspec-L1 --format rich
```

**成功输出**:
```xml
<task>...</task>
<project_context>...</project_context>
<parent_context>...</parent_context>
<rules>...</rules>
<required_sections>...</required_sections>
<template>...</template>
<next_command>...</next_command>
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 1 | PROJECT_NOT_INITIALIZED | 项目未初始化 |
| 2 | INVALID_FORMAT | `--format` 不是 `text` 或 `rich` |

### CLI: `spec-manager project agents`

**请求**:
```bash
spec-manager project agents
spec-manager project agents --provider all
spec-manager project agents --provider codex,opencode
```

**成功输出**:
```text
✓ AI agent support installed: codex, opencode
detected:
  - AGENTS.md -> codex, opencode
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 2 | UNSUPPORTED_PROVIDER | 显式 provider 无法解析 |
| 2 | NO_PROVIDER_DETECTED | 默认检测没有命中任何 provider |

### CLI: `spec-manager view [--topic <topic>]`

**请求**:
```bash
spec-manager view
spec-manager view --topic roadmap-openspec
```

**成功输出**: 进入交互式选择；选择 spec 或 task 后打印详情和下一步建议。

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 1 | PROJECT_NOT_INITIALIZED | 项目未初始化 |
| 2 | TOPIC_NOT_FOUND | 指定 topic 无 spec/task |

### CLI: `spec-manager completion install <shell>`

**请求**:
```bash
spec-manager completion install zsh
spec-manager completion install bash
spec-manager completion install fish
spec-manager completion uninstall
```

**成功输出**: 打印写入路径和重新加载 shell 的提示。

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 2 | UNSUPPORTED_SHELL | shell 不是 zsh/bash/fish |
| 2 | COMPLETION_NOT_INSTALLED | uninstall 未找到已安装脚本 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| config.yaml 无 context 或解析失败 | rich guide 缺少项目上下文 | 输出空 project_context 或警告，不阻断 guide | 修正 config.yaml 后重试 |
| request 无法匹配 spec code | guide 无法给出具体父 spec | 回退到 topic 推断和 flow nextAction | 用户传入明确 spec code |
| provider 自动检测无命中 | 不知道安装哪个 agent | 提示使用 `--provider all` 或显式 provider | 用户重跑命令 |
| inquirer 在非 TTY 环境不可用 | view 无法交互 | 提示使用 `flow status --topic` | 在 TTY 中重试 |
| completion 安装路径不可写 | 无法写 shell 脚本 | 输出脚本内容路径建议，不修改文件 | 用户使用可写路径或手动安装 |

## 向后兼容

- **API**: 无 HTTP API 变更。
- **CLI**: `guide` 默认 text 行为保持；`project agents --provider all` 保持安装全部；`flow status` 保留。
- **数据**: config 增加可选字段，不要求迁移；spec/task/frontmatter schema 不变。
- **依赖**: 仅 `view` L3 允许新增 `@inquirer/prompts`；其他 L3 不新增运行时依赖。

## 关键交互流程

### rich guide

```
用户 → guide --format rich
  │
  ├─ 读取 config context
  ├─ 匹配 spec/request + flow nextAction
  ├─ 读取 parent/spec 摘要
  ├─ 读取 level required sections + template
  └─ 输出结构化 prompt
```

### project agents 自动检测

```
用户 → project agents
  │
  ├─ 扫描项目根目录工具标记
  ├─ 生成 detectedProviders
  ├─ 若为空则提示显式 provider
  └─ 调用 installAgentSupport
```

## 可观测性

- **日志**: CLI 输出检测命中原因、安装路径、rich guide 的 next_command。
- **指标**: 不新增 telemetry；测试中统计 rich guide 段数和 provider 检测命中。
- **告警**: 无运行时告警；错误通过 CLI exit code 和错误消息表达。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| flow 状态 | `src/core/usability.ts` | `getFlowStatus`、`suggestNextActionForTopic` | guide/view 生成下一步建议 |
| doctor 检查 | `src/core/usability.ts` | `runProjectDoctor` | guide 保持初始化检查 |
| spec 读取 | `src/core/spec-io.ts` | `listAllSpecs`、`findSpecByCode` | guide/view/completion 获取 spec 与摘要 |
| task 读取 | `src/core/task.ts` | `listTasks` | view 展示 task 状态 |
| provider 元数据 | `src/core/agents.ts` | `AGENT_PROVIDER_INFO`、`installAgentSupport` | 自动检测和安装复用现有 provider 配置 |
| 路径解析 | `src/core/paths.ts` | `getPaths`、`ProjectPaths` | config、completion、provider 检测定位项目根 |
| 模板渲染 | `src/core/usability.ts` | `renderTemplate` | rich guide 注入 L1/L2/L3 模板 |
| CLI 注册 | `src/cli/index.ts` | `register*` 调用 | 注册 view/completion 新命令 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `roadmap-openspec-L3.1.1-guide` | 实现 `guide --format rich` 与 `.spec-manager/config.yaml` context 注入 | 无 |
| `roadmap-openspec-L3.1.2-agents` | 实现 `project agents` 默认自动检测 provider，显式 provider 保持现有行为 | L3.1.1 implemented |
| `roadmap-openspec-L3.1.3-view` | 新增 `view` 交互式 topic/spec/task 浏览 | L3.1.2 implemented |
| `roadmap-openspec-L3.1.4-completion` | 新增 zsh/bash/fish completion install/uninstall 与 spec code 补全 | L3.1.2 implemented |

## 关联

- 父 L1: `roadmap-openspec-L1`（将 `docs/roadmap.md` 的 5 项 OpenSpec 借鉴改进纳入 spec 流程）
