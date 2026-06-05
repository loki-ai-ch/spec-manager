---
code: spec-manager-ai-ux-L1
level: L1
title: 重构优化 AI 使用本项目操作
topic: spec-manager-ai-ux
parentCode: null
status: implemented
aiSummary: 全栈重构优化 AI 使用 spec-manager 的体验：README 场景补全、SKILL.md 精简合并、CLI 批量操作、核心模块测试补全
created: '2026-06-05T04:13:43.934Z'
updated: '2026-06-05T04:16:00.238Z'
changeSummary: draft → confirmed
---
# 重构优化 AI 使用本项目操作 — 需求文档

## 背景

spec-manager 是一个本地优先的规格驱动开发平台,通过 Claude Code skill 让 AI 代理走完 PRD → Design → Impl → Task 全链路。当前系统存在三类可量化问题:

1. **新用户上手成本高**: README 只有一个"用户认证"教程场景,覆盖了 L1→Task 的主链路,但缺少快速修复、研究查询、delta change、复盘等高频场景的示例。新用户需要通读 300+ 行教程才能理解基本用法,无法按需跳转。
2. **AI 路由效率低**: skill 系统有 12 个 subskill + RESOLVER + 24 条规则分散在 6 个文件中。AI 每次收到 `/spec-manager` 调用时,需要加载 SKILL.md(137 行)+ RESOLVER.md(73 行)+ 匹配的 subskill + 相关规则,上下文消耗大。且 RESOLVER 的关键词匹配是静态表,遇到"我要给这个功能加个缓存"这类自然语言时容易误路由。
3. **CLI 交互冗余**: 完成一个 L3 spec + Agent Task 需要 8+ 次 CLI 调用(new → update → confirm → freeze → task create → task start → task step × N → task complete),每次调用都是一次独立的 Bash 工具调用,增加 token 消耗和延迟。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| 文档可发现性 | README 缺少多样化的使用场景示例,新用户无法快速定位自己需要的流程 | P1 | README 只有 1 个完整教程 |
| Skill 结构 | 12 个 subskill 文件 + 独立 RESOLVER,加载路径长,上下文消耗大 | P1 | SKILL.md 137 行 + RESOLVER 73 行 + subskills 平均 80 行 |
| 路由准确性 | 静态关键词表匹配,自然语言输入容易误路由 | P2 | RESOLVER 依赖精确关键词匹配 |
| CLI 粒度 | 每步操作一次 CLI 调用,Agent Task 创建到完成需 8+ 次调用 | P2 | task create/start/step/complete 分离 |
| 测试覆盖 | 仅 3 个测试文件,覆盖 cascade/paths/decision,核心模块 spec-io/validate/frontmatter 无测试 | P2 | src/core/__tests__/ 只有 3 文件 |

## 用户故事

### Must have

- As a **AI 代理**, I want **SKILL.md 精简且路由规则内联**, so that **每次 `/spec-manager` 调用加载更少上下文即可正确路由**
- As a **新用户**, I want **README 包含 5+ 个不同场景的使用示例**, so that **我能快速找到与自己需求匹配的流程,无需通读全文**
- As a **AI 代理**, I want **CLI 支持批量/组合操作**, so that **一个 Agent Task 的完整生命周期可以在 2-3 次 CLI 调用内完成**

### Should have

- As a **维护者**, I want **规则文件按 applies_to 聚合而非按主题分散**, so that **添加新规则时不需要在 6 个文件间跳转**
- As a **AI 代理**, I want **路由支持语义匹配而非纯关键词**, so that **自然语言输入也能正确路由**

### Could have

- As a **AI 代理**, I want **CLI 输出包含下一步操作提示**, so that **我不需要每次都查 SKILL.md 知道下一步该做什么**

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| README 使用场景覆盖 | 1 个完整教程(auth) | 5+ 个场景(quick/research/impl/delta/postmortem) |
| SKILL.md 上下文加载量 | SKILL.md 137 行 + RESOLVER 73 行 = 210 行 | ≤120 行(合并+精简) |
| Agent Task CLI 调用次数 | 8+ 次(task create/start/step×N/complete) | ≤3 次(批量 step report + auto-complete) |
| 核心模块测试覆盖 | 3 个测试文件(cascade/paths/decision) | 8+ 个测试文件(覆盖 spec-io/validate/frontmatter/status/audit/delta) |
| 路由准确率 | 精确关键词匹配,自然语言易误路由 | 语义匹配 + 关键词兜底 |

## 验收标准

1. **AC-1**: **Given** 新用户打开 README, **When** 查看"使用场景"章节, **Then** SHALL 找到至少 5 个不同场景的完整示例(含 CLI 命令),每个示例 ≤10 行
2. **AC-2**: **Given** AI 代理收到 `/spec-manager <自然语言>`, **When** 加载 SKILL.md, **Then** 上下文行数 SHALL ≤120 行且包含内联路由规则
3. **AC-3**: **Given** AI 代理创建 Agent Task, **When** 执行完整生命周期(create → start → step × N → complete), **Then** CLI 调用次数 SHALL ≤3 次
4. **AC-4**: **Given** 开发者运行测试套件, **When** 执行 `pnpm test`, **Then** 测试文件 SHALL ≥8 个且核心模块(spec-io/validate/frontmatter)有覆盖
5. **AC-5**: **Given** AI 代理收到模糊输入如"我要给这个功能加个缓存", **When** 路由匹配, **Then** MUST 正确识别为 delta change 或 PRD 而非误匹配到其他 subskill

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 新用户首次成功执行时间 | 待测量 | ≤5 分钟(从 clone 到第一个 spec 创建) | 手动测试 |
| AI 单次 `/spec-manager` 上下文 token 消耗 | 待测量 | 减少 40% | 对比 SKILL.md 改版前后行数 |
| Agent Task 端到端 CLI 调用次数 | 8+ | ≤3 | 计数 task 相关 CLI 调用 |
| 路由误匹配率 | 待测量 | ≤5%(10 个测试输入) | 构造 10 个自然语言测试用例验证 |

## 范围边界

- **做**: README 使用场景补全、SKILL.md/RESOLVER 合并精简、CLI 批量操作支持、核心模块测试补全
- **不做**(显式排除):
  - 不改 MCP 架构(保持纯本地)
  - 不改 spec 文件格式/frontmatter schema(向后兼容)
  - 不新增 subskill(只优化现有结构)
- **推迟**:
  - 语义路由的 ML 模型训练(当前用规则匹配 + 更好的关键词表即可)
  - Web UI(保持 CLI-first)

## 设计原则

1. **最小上下文原则** — AI 每次加载的 skill 文件总行数 ≤120 行。违反判断:如果 SKILL.md + 加载的 subskill 总行数 >120,即违反。
2. **向后兼容原则** — 现有 spec 文件、CLI 命令、frontmatter schema 不得 breaking change。违反判断:如果已有 spec 文件需要修改才能通过新校验,即违反。
3. **渐进增强原则** — 每个 Phase 独立可交付,不依赖后续 Phase。违反判断:如果 Phase 1 无法独立使用(不依赖 Phase 2),即违反。
4. **测试先行原则** — 新增/修改的 core 模块必须有对应测试。违反判断:如果 PR 中新增 core 逻辑但无测试文件,即违反。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | README 使用场景补全(5+ 场景) | 无 | P1 |
| Phase 2 | SKILL.md + RESOLVER 合并精简 | 无 | P1 |
| Phase 3 | CLI 批量操作(task batch) | 无 | P2 |
| Phase 4 | 核心模块测试补全(8+ 测试文件) | 无 | P2 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| README 场景化改造(EN + ZH) | Phase 1 | 1 |
| SKILL.md 结构重构 | Phase 2 | 1 |
| CLI task batch 命令 | Phase 3 | 1 |
| 核心模块测试套件 | Phase 4 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| SKILL.md 精简后遗漏关键规则 | AI 执行时违反规则 | 改版后用 5 个场景端到端测试验证 |
| CLI 批量操作与现有 task step 上报逻辑冲突 | R15(step_report 必含 summary)校验失效 | 批量模式仍逐条校验每步的 outputJson |
| 测试补全需重构 core 模块以支持依赖注入 | 增加代码复杂度 | 仅在必要时引入接口,不为测试过度抽象 |

## 关联

- 基于: 无前序 L1
- 关联 spec-manager 项目本身(spec-manager 使用自己的 spec-manager 流程)
