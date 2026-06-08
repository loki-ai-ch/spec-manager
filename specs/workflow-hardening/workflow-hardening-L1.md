---
code: workflow-hardening-L1
level: L1
title: spec-manager 流程硬化与全工具兼容
topic: workflow-hardening
parentCode: null
status: implemented
created: '2026-06-06T02:52:20.681Z'
updated: '2026-06-08T03:37:00.437Z'
aiSummary: >-
  针对执行复盘暴露的流程问题做硬化：validate-plan 直接校验 L3 markdown、placeholder
  validate、coveredSpecs 规则统一、guide blocking 分层、上游 spec frozen 提示、task show
  口径修正，并同步所有开发工具入口规则
changeSummary: frozen → implemented
---
# spec-manager 流程硬化与全工具兼容 — 需求文档

## 背景

本次执行 `roadmap-openspec-L3.1.1-guide` 暴露出 spec-manager 流程的 6 个体验和一致性问题：直接编辑 spec 容易残留 placeholder、`validate-plan` 不能从 L3 markdown 抽取 planJson、L3 模板与 `task create` 对 `coveredSpecs` 的要求冲突、`guide` 被非关键 doctor warning 阻断、上游 spec 未 frozen 导致 task complete 级联跳过但缺少前置提示、`task show` 的 step 截断文案容易误读。

这些问题影响的不只是当前 CLI 用户，也会影响 Claude skill、Codex/OpenCode 的 `AGENTS.md`、CodeBuddy skill，以及未来 Cursor/Windsurf 等规则文件。若不同开发工具看到的流程建议不一致，AI agent 会在同一个项目内做出不同操作，增加流程事故概率。

当前可量化证据：

1. `spec validate-plan specs/.../L3.md` 对 markdown 报 JSON 解析错误，用户必须手工抽取临时 JSON。
2. `task create` 要求 `coveredSpecs` 必含当前 L3，但 `templates/agent-plan.json` 和 L3 模板仍表达“单条可省略”的旧语义。
3. `project doctor` 发现 placeholder 残留时才暴露 L1/L2 写入方式问题，说明 `spec validate` 缺少该类检查。
4. `task show` 在 8 个步骤任务上输出 `steps: 5 (totalSteps: 5, truncated)`，信息自相矛盾。
5. `roadmap-openspec-L3.1.1-guide` 完成时 `task complete` 输出 `L2 expected frozen, got confirmed`，但在冻结 L3 前未给出上游 spec 状态提示。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| Spec 正文写入安全 | 直接编辑 markdown 后 placeholder 残留，`spec validate` 未拦截 | P1 | `roadmap-openspec-L1/L2` 曾残留 `<!-- 在此粘贴正文 -->` |
| Plan 校验入口割裂 | `validate-plan` 只能吃 JSON 文件，不能校验 L3 markdown 内的 planJson | P1 | 本次误用 markdown 触发 JSON parse error |
| 规则与模板冲突 | `coveredSpecs` 实际强制必填，但模板提示单条可省略 | P0 | `task create` R12 拦截本次 plan |
| Guide 阻断策略过重 | agent skill 资产缺失会阻断默认 guide 的流程建议 | P2 | smoke 输出 `Next: spec-manager project agents --provider claude --force` |
| 上游状态提示不足 | L3 implemented 后无法级联 confirmed L2，但冻结前无提醒 | P2 | `roadmap-openspec-L3.1.1-guide` task complete skipped: `expected frozen, got confirmed` |
| Task 展示文案错误 | step 截断显示 totalSteps 口径错误 | P1 | `task show` 输出 `steps: 5 (totalSteps: 5, truncated)` |
| 多工具流程一致性 | Claude/Codex/OpenCode/CodeBuddy/Cursor/Windsurf 可能获得不同流程建议 | P1 | 现有模板分散在 `skill/`、`templates/agents/`、未来规则文件 |

## 用户故事

### Must have

- As a **AI agent**, I want **所有工具入口都遵循同一套 spec-manager 流程规则**, so that **Claude、Codex、OpenCode、CodeBuddy、Cursor、Windsurf 不会给出互相冲突的操作**
- As a **AI agent**, I want **L3 markdown 内的 planJson 可直接校验**, so that **我不需要创建临时 JSON 文件来通过 R12**
- As a **维护者**, I want **模板与 CLI 强校验保持一致**, so that **agent 按模板写出的 plan 能被 `task create` 接受**
- As a **AI agent**, I want **spec validate 能发现 placeholder 残留**, so that **正文写入错误在进入审核前暴露**

### Should have

- As a **CLI 用户**, I want **guide 只被关键初始化问题阻断**, so that **非关键 agent 安装 warning 不妨碍查询当前 spec 下一步**
- As a **AI agent**, I want **冻结 L3 前看到上游 L2/L1 状态提醒**, so that **我知道是否需要先请求用户冻结上游 spec 以启用级联**
- As a **CLI 用户**, I want **task show 正确区分 shownSteps 和 totalSteps**, so that **我不会误解任务步骤数量**

### Could have

- As a **工具模板维护者**, I want **agent 模板复用统一 workflow capsule**, so that **未来新增 Cursor/Windsurf 规则文件时不用复制多份过期流程**

## 功能目标

| 能力 | 现状(量化) | 目标(量化) |
|---|---|---|
| planJson 校验 | 只能校验纯 JSON 文件 | 支持 `spec validate-plan --from-spec <L3-code>`，自动抽取 L3 planJson |
| coveredSpecs 规则一致性 | 模板与 `task create` 冲突 1 处以上 | 模板、skill、agent 指令均要求 `coveredSpecs` 必填且包含当前 L3 |
| placeholder 检查 | `spec validate` 不检查残留 marker | `spec validate` 对正文含 marker 输出 warning 或 fail 级别提示 |
| guide 阻断策略 | doctor 第一个 warn/fail 均阻断 | 仅初始化、配置、audit 等关键 fail 阻断；agent skill warning 作为提示 |
| 上游状态提示 | L3 freeze/task create 前无上游级联提示 | L3 confirmed/frozen 下一步提示包含上游 L2/L1 状态建议 |
| task show 口径 | shown 与 total 文案混淆 | 输出 `shownSteps: N` 与 `totalSteps: M` |
| 工具兼容覆盖 | 主要覆盖 Claude/Codex/OpenCode/CodeBuddy | 所有已支持和 roadmap 指定工具模板均含统一 workflow 规则 |

## 验收标准

1. **AC-1**: **Given** L3 spec markdown 含 `## planJson (final)` JSON 代码块, **When** 用户执行 `spec validate-plan --from-spec <code>`, **Then** 系统 **SHALL** 校验该代码块且无需临时 JSON 文件。
2. **AC-2**: **Given** planJson 不含 `coveredSpecs` 或未包含当前 L3 code, **When** 用户执行 `task create`, **Then** 系统 **SHALL** 输出与模板一致的错误说明和修复示例。
3. **AC-3**: **Given** spec 正文仍含 `<!-- 在此粘贴正文 -->`, **When** 用户执行 `spec validate <code>`, **Then** 系统 **SHALL** 报告 placeholder 残留。
4. **AC-4**: **Given** 项目已初始化但 Claude skill rules/templates 缺失, **When** 用户执行默认 `guide <request>`, **Then** 系统 **SHOULD** 继续输出当前请求的下一步，并把 agent 修复作为 advisory。
5. **AC-5**: **Given** L3 的上游 L2 是 confirmed 但未 frozen, **When** 用户查看 L3 下一步或冻结 L3, **Then** 系统 **SHOULD** 提示“上游 L2 未 frozen，完成 task 后不会级联 L2”。
6. **AC-6**: **Given** task 总步骤数大于默认展示数, **When** 用户执行 `task show`, **Then** 系统 **SHALL** 输出 `shownSteps` 与 `totalSteps` 两个不同字段。
7. **AC-7**: **Given** 安装 Claude、Codex/OpenCode、CodeBuddy 或生成 Cursor/Windsurf 规则文件, **When** 用户查看工具入口说明, **Then** 每个入口 **MUST** 包含同一套人工审核、frozen L3、task step、coveredSpecs 必填规则。
8. **AC-8**: **Given** 运行完整测试套件, **When** 执行 `npm test`, **Then** 新增流程硬化能力 **MUST** 有 CLI/core 测试覆盖且全部通过。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| 临时 plan JSON 文件需求 | 本次执行需要 1 次 | 0 次 | L3 markdown 直接 validate-plan |
| 模板/CLI coveredSpecs 冲突 | 1 处已复现 | 0 处 | rg `coveredSpecs` + 单元测试 |
| placeholder 残留发现点 | doctor 阶段才发现 | validate 阶段发现 | `spec validate` 测试 |
| guide 非关键 warning 阻断 | 1 次已复现 | 0 次 | CLI guide fixture |
| task show 步骤口径错误 | 1 次已复现 | 0 次 | task show 测试 |
| 工具入口规则覆盖 | 4 类现有入口，Cursor/Windsurf 未明确 | 现有入口 + roadmap 指定入口全部覆盖 | 模板快照/包含性测试 |

## 范围边界

- **做**:
  - `validate-plan --from-spec`
  - placeholder validate 检查
  - coveredSpecs 模板/CLI/skill 统一
  - guide doctor blocking/advisory 分层
  - 上游 spec frozen 状态提示
  - task show shown/total 文案修正
  - 所有开发工具入口规则同步
- **不做**(显式排除):
  - 不改变 spec/task 文件存储格式
  - 不放宽人工审核门禁
  - 不引入网络服务或 telemetry
  - 不把 Cursor/Windsurf 做成完整 skill 系统
- **推迟**:
  - 自动修复 placeholder 的交互式编辑器
  - Web/TUI 形式的流程诊断面板

## 设计原则

1. **CLI 为唯一真相** — 工具模板只描述 CLI 的真实行为，不创造独立流程。违反判断: 任一模板要求的步骤无法被 CLI 校验或执行。
2. **错误即修复建议** — 流程拦截必须给出可复制的下一步或示例。违反判断: 错误只说明失败原因，没有修复命令或字段示例。
3. **跨工具一致** — Claude、Codex/OpenCode、CodeBuddy、Cursor、Windsurf 的入口规则必须表达同一审核和任务生命周期。违反判断: 任一工具模板遗漏 frozen L3 或 task step 规则。
4. **向后兼容** — 新增检查默认不破坏已 implemented specs；必要时先 warning 再逐步收紧。违反判断: 旧项目无法运行 `spec list`、`task show` 或默认 `guide`。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | planJson/placeholder/coveredSpecs 三项硬化 | 无 | P0/P1 |
| Phase 2 | guide blocking、上游状态提示、task show 文案 | Phase 1 | P1/P2 |
| Phase 3 | 全工具模板与兼容测试 | Phase 1 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| CLI 流程校验硬化 | Phase 1 | 1 |
| 流程提示与展示修正 | Phase 2 | 1 |
| 多工具入口规则统一 | Phase 3 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| placeholder 检查过严影响历史 spec | 旧项目 validate 噪声变多 | 初期作为 warning，错误消息提供修复方式 |
| 多工具模板重复导致再次漂移 | 后续规则变更难同步 | 抽取统一 capsule 或测试所有模板关键语句 |
| guide advisory 过多 | 用户仍被噪声干扰 | blocking/advisory 分层，默认 guide 只输出关键 next |

## 关联

- 来源: `roadmap-openspec-L3.1.1-guide` 执行复盘
- 关联: `roadmap-openspec-L1` 的 AI 使用体验改进
