---
code: roadmap-openspec-L1
level: L1
title: 借鉴 OpenSpec 的产品化改进
topic: roadmap-openspec
parentCode: null
status: implemented
created: '2026-06-06T02:37:52.336Z'
updated: '2026-06-08T03:23:18.536Z'
aiSummary: >-
  将 docs/roadmap.md 的 5 项 OpenSpec 借鉴改进纳入 spec 流程：rich guide/context、agent
  自动检测、交互式 view、shell completion；先以 P1 guide/context 作为首轮迭代
changeSummary: frozen → implemented
---
# 借鉴 OpenSpec 的产品化改进 — 需求文档

## 背景

`docs/roadmap.md` 基于 OpenSpec 对比提出 5 个改进方向：AI 指令生成、工具自动检测、交互式仪表盘、Shell 补全、Project Context 注入。当前 spec-manager 已完成 README/skill/task batch/测试补全等 AI 使用体验改造，但 roadmap 中仍有 5 项未进入 spec 体系。

现状存在三类可量化摩擦：

1. **guide 输出信息不足**：`spec-manager guide` 只输出 `Request` 和 `Next` 两行，AI 仍需再读规则、模板、父 spec 才能写正文。
2. **agent 安装需要手动选择 provider**：`project agents` 默认 `--provider all`，用户无法只安装项目中已出现的工具指令文件，容易产生不需要的 `CLAUDE.md`、`CODEBUDDY.md` 等文件。
3. **多 topic 导航和命令记忆成本高**：当前 `flow status` 是纯文本列表，项目已有 2 个 topic、8 条 spec；随着 roadmap 增加，用户需要记忆 spec code、task code 和子命令。

如果不做这些改进，AI 继续需要多次额外 CLI/文件读取才能进入正确工作状态；新用户在安装 agent、查找下一步、输入 spec code 时仍依赖人工记忆。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| AI 指令上下文 | `guide` 未打包规则、父 spec 摘要、必填段、模板和下一条命令 | P1 | `docs/roadmap.md` 第 1 项；`src/cli/usability.ts` 当前仅输出两行 |
| 项目上下文缺失 | `.spec-manager/config.yaml` 只有项目名，无法向 guide 注入技术栈和约束 | P1 | `docs/roadmap.md` 第 5 项 |
| 工具安装摩擦 | `project agents` 需要显式 provider，未利用现有配置文件自动检测 | P2 | `docs/roadmap.md` 第 2 项；`src/core/agents.ts` 仅提供 provider 展开 |
| 状态浏览低密度 | `flow status` 不能交互式选择 topic/spec/task 查看详情 | P3 | `docs/roadmap.md` 第 3 项 |
| 命令输入成本 | 无 shell completion，spec code 需要手动复制或记忆 | P4 | `docs/roadmap.md` 第 4 项 |

## 用户故事

### Must have

- As a **AI 代理**, I want **`guide --format rich` 输出可直接消费的结构化 prompt**, so that **我能少读文件也能按规则写 spec 正文**
- As a **AI 代理**, I want **guide 输出包含 project context**, so that **我能遵守项目技术栈和约束而不是临场猜测**
- As a **维护者**, I want **rich guide 保持纯本地和可测试**, so that **spec-manager 不引入远端依赖或遥测**

### Should have

- As a **项目用户**, I want **`project agents` 不传 provider 时自动检测已有工具**, so that **我只安装当前项目实际使用的 agent 指令文件**
- As a **项目用户**, I want **`view` 交互式浏览 topic/spec/task**, so that **我能在多 topic 项目中快速定位下一步**

### Could have

- As a **命令行用户**, I want **zsh/bash/fish completion**, so that **我能补全子命令、选项和 spec code**

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| guide 信息密度 | 默认输出 2 行，无结构化上下文 | 支持 `--format rich`，输出 task/parent_context/rules/required_sections/template/next_command/project_context 至少 7 个段 |
| 项目上下文 | `.spec-manager/config.yaml` 只有 project | 支持可选 `context` 字段，并在 rich guide 中原样注入 |
| agent provider 选择 | 不传 provider 时等价 all 或需要用户显式选择 | 不传 provider 时按项目文件自动检测，`--provider all` 保持强制安装全部 |
| topic/spec/task 浏览 | `flow status` 纯文本输出 | 新增 `view`，可按 topic 过滤并选择查看详情 |
| shell 补全 | 0 个 shell 支持 | 支持 zsh/bash/fish 安装和卸载，至少补全一级子命令和 spec code |

## 验收标准

1. **AC-1**: **Given** 已初始化项目和一个 draft spec, **When** 用户执行 `guide <spec-code> --format rich`, **Then** 输出 **SHALL** 包含 task、rules、required_sections、template、next_command 段。
2. **AC-2**: **Given** `.spec-manager/config.yaml` 包含 `context`, **When** 用户执行 rich guide, **Then** 输出 **SHALL** 包含 project_context 段且内容与配置一致。
3. **AC-3**: **Given** 项目根目录存在 `AGENTS.md` 且不存在 Claude/CodeBuddy 指令文件, **When** 用户执行 `project agents` 且不传 provider, **Then** 系统 **SHALL** 只选择 AGENTS.md 兼容 provider。
4. **AC-4**: **Given** 用户执行 `project agents --provider all`, **When** 安装 agent 指令, **Then** 系统 **MUST** 保持现有安装全部 provider 的行为。
5. **AC-5**: **Given** 项目存在多个 topic, **When** 用户执行 `view --topic <topic>`, **Then** 系统 **SHOULD** 只展示该 topic 的 spec 与 task 状态并允许查看详情。
6. **AC-6**: **Given** 用户安装 shell completion, **When** 在 shell 中输入 spec-manager 子命令或 spec code 前缀, **Then** 系统 **MAY** 提供可用补全候选。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| AI 写 spec 前额外读取次数 | 待测量；当前 guide 不含规则/模板/父摘要 | rich guide 场景 ≤1 次额外读取 | 记录一次 L1/L2/L3 写作流程中的 CLI/文件读取次数 |
| rich guide 结构段数量 | 0 | ≥7 | 单元测试断言输出段 |
| agent 自动检测准确性 | 0 个检测规则 | 覆盖 roadmap 中 5 类文件检测 | 单元测试临时项目 fixture |
| 交互式 view 可用性 | 0 个交互命令 | 支持 topic 过滤和详情查看 | CLI 测试或手动 smoke |
| completion shell 覆盖 | 0 | 3 | 安装命令输出和脚本内容检查 |

## 范围边界

- **做**:
  - rich guide 输出与 project context 注入
  - agent provider 自动检测
  - 交互式 view 命令
  - shell completion 命令
- **不做**(显式排除):
  - 不引入 telemetry、远端分析或云端同步
  - 不扩展到 26 个 agent provider
  - 不做 workspace 多项目管理
  - 不做 profile 系统
- **推迟**:
  - rich guide 的机器可读 JSON schema 版本
  - view 的 TUI 高级搜索和批量操作

## 设计原则

1. **本地优先** — 所有新能力必须只读取本地文件和本地 spec 数据。违反判断: 功能需要网络请求、遥测或远端状态才能运行。
2. **显式兼容** — 现有命令参数语义不得被破坏。违反判断: `--provider all`、默认 guide 文本或已有 flow status 行为发生不兼容变化。
3. **结构化输出** — AI 消费场景优先提供稳定段落和字段名。违反判断: rich guide 只能靠自然语言解析下一步。
4. **依赖克制** — 只有交互式 view 可引入交互依赖，其余功能复用现有 Commander/Node 标准库。违反判断: P1/P2/P4 为简单格式化或文件检测引入大型依赖。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | AI 指令生成 + Project Context 注入 | 无 | P1 |
| Phase 2 | 工具自动检测 | Phase 1 spec 完成 | P2 |
| Phase 3 | 交互式仪表盘 | Phase 2 完成 | P3 |
| Phase 4 | Shell 补全 | Phase 2 完成 | P4 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| rich guide 与 project context | Phase 1 | 1 |
| agent provider 自动检测 | Phase 2 | 1 |
| 交互式 view | Phase 3 | 1 |
| shell completion | Phase 4 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| rich guide 输出过长 | AI 仍需筛选大量文本 | L2 定义固定段落和摘要长度 |
| 自动检测误判 provider | 安装不符合用户预期的指令文件 | 保留 `--provider all` 和显式 provider 覆盖 |
| `@inquirer/prompts` 依赖引入成本 | 安装体积和测试复杂度上升 | 将交互式 view 独立到后续 L3 |
| completion 跨 shell 差异 | 安装/卸载脚本不稳定 | 每个 shell 独立生成脚本，先提供保守补全 |

## 关联

- 来源: `docs/roadmap.md`
- 前序: `spec-manager-ai-ux-L1` 已实现的 AI 使用体验改造
