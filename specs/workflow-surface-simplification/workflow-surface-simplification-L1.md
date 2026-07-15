---
code: workflow-surface-simplification-L1
level: L1
title: OpenSpec-Inspired Usability Refactor
topic: workflow-surface-simplification
parentCode: null
status: implemented
aiSummary: >-
  对比 OpenSpec 后提出 spec-manager 易用性重构：core quick path、setup/onboarding、external
  specs store、root diagnostics 和 guide/assist/flow/view 收敛，同时保持规格分层、执行任务记录与
  evidence 强门禁。
created: '2026-07-15T02:12:21.011Z'
updated: '2026-07-15T02:29:47.318Z'
changeSummary: 'cascade: task-complete'
---
# OpenSpec-Inspired Usability Refactor

## 背景

spec-manager 已经具备强治理能力：规格分层、人类审核门控、执行任务记录、verification evidence、Design Context、adaptive workflow、docs consistency 和多 Agent 入口。这些能力证明项目价值没有走偏，但也带来一个新的产品问题：新用户和 AI Agent 初次进入时，需要同时理解 project、guide、assist、flow、view、spec、task、profile、readiness 等多个入口。

与 `/Users/loki/code/github/OpenSpec` 对比后，OpenSpec 在易用性上有三点值得借鉴：

1. 用 `explore -> propose -> apply -> archive` 这样的动作式路径降低心智负担。
2. 初始化时把工具检测、agent 入口、profile 选择和下一步提示收束到一条 setup 路径。
3. 通过 external store、只读引用源和 working set 支持一个规划仓库管理多个代码仓库的需求。

spec-manager 不应照搬 OpenSpec 的弱门禁或流动式 artifact 模型。spec-manager 的差异化价值仍然是本地文件事实源、强审核门控、执行留痕和证据闭环。本次改造的目标是在不削弱治理能力的前提下，把高频入口变得更短、更可解释、更适合 AI Agent 和项目群使用。

## 目标

- 降低首次使用门槛，让用户可以从“我要做 X”自然进入下一步，而不是先学习完整 CLI 命令树。
- 为 AI Agent 提供更短的动作式入口和更明确的 next action，减少反复询问、错用命令和跳过流程。
- 支持 specs 作为项目群/产品线级事实源，而不是默认绑定单个代码仓库。
- 收敛 `guide`、`assist`、`flow`、`view` 等重叠入口，形成清晰的 core/advanced 使用层次。
- 保持规格分层、执行任务记录和 evidence 的硬边界，不把易用性优化变成流程弱化。

## 范围边界

本规格覆盖 spec-manager 的产品易用性重构方向，包括核心短路径、初始化体验、外部 specs root/store、root resolution 诊断、AI Agent guidance 和文档入口收敛。它不直接定义具体模块改动、命令参数细节或迁移实现；这些内容应在后续设计和实施规格中拆分。

本规格允许后续设计多个子方向，但必须保持一个原则：任何新入口都只是现有状态机和事实源的安全封装，不得制造第二套生命周期或第二套事实存储。

## 非目标

- 不移除现有 `spec`、`task`、`decision`、`project` 等底层命令。
- 不引入网络服务、数据库、MCP 或 telemetry。
- 不让 Agent 在没有冻结实施规格的情况下写实现代码。
- 不把 OpenSpec 的 change folder 模型替换为 spec-manager 的分层 spec 模型。
- 不自动迁移现有 specs、tasks、decisions 的目录结构。

## 用户故事

- 作为新用户，我希望安装后只需要一条 setup/init 路径，就能知道终端里该敲什么、AI 聊天里该说什么。
- 作为 AI Agent，我希望拿到一个稳定的 `next`/`brief` 输出，明确当前 root、topic、阻塞点和下一条安全命令。
- 作为管理多个代码仓库的负责人，我希望 specs 可以放在独立规划仓库或统一 specs 根中，并让各代码仓库引用它。
- 作为熟练用户，我希望仍然可以使用完整高级命令进行精细治理。
- 作为维护者，我希望新增易用入口只是底层命令的安全封装，不制造第二套事实源。

## 需求

- MUST 提供一个 core quick path 设计，使高频动作可以用更短的入口表达，例如 explore/propose/apply/deliver 或 next/dashboard/brief。
- MUST 明确 core quick path 与现有规格分层和执行任务状态机的映射关系，任何快捷入口都不得绕过审核门控。
- MUST 设计一站式 setup/onboarding 体验，覆盖项目初始化、agent provider 检测、agent 入口安装建议、profile 选择和下一步提示。
- MUST 设计 specs 外部存储模型，使 code repo 可以指向独立 specs root/store，并支持只读上下文源。
- MUST 设计 root resolution 诊断，让写操作明确展示当前写入的 specs 根，并在 root 错误时给出可执行修复建议。
- MUST 收敛 guide/assist/flow/view 的主入口命名和职责，减少用户面对的第一屏命令数量。
- MUST 保持现有命令兼容；旧命令可以保留为 advanced 或 alias。
- SHOULD 提供 JSON 输出契约，方便 AI Agent 读取 root、topic、nextAction、blockingReason 和 suggestedCommands。
- SHOULD 支持 UX profile，例如 core/advanced，用于控制文档和 agent guidance 的默认暴露程度；该 profile 不应与 task workflow 的 standard/governed 混淆。
- SHOULD 更新 README、agent templates 和 docs，使中文 README 优先呈现短路径，英文 README 链接保持一致。

## 验收标准

1. **AC-1**: 新用户 MUST 可以通过一个推荐入口完成初始化和 agent guidance 安装建议，并获得明确下一步。
2. **AC-2**: 用户 MUST 可以用一个短入口获取当前项目/某 topic 的 next action，而不需要先知道 `flow status`、`assist guide` 和 `view` 的差异。
3. **AC-3**: 快捷入口 MUST NOT 绕过规格分层和执行任务状态门禁；涉及实现的动作 MUST 仍要求冻结实施规格和执行任务记录。
4. **AC-4**: specs root/store 设计 MUST 支持“一个 specs 根管理多个代码仓库”的目标，并明确 write root 与 read-only context source 的边界。
5. **AC-5**: root resolution 失败或歧义时 MUST 输出可执行修复建议，不只给出 generic error。
6. **AC-6**: README 和 agent guidance MUST 清楚区分“终端命令”和“AI 聊天请求”。
7. **AC-7**: 现有高级命令兼容性 MUST 保留，已有 specs/tasks/decisions 不需要迁移即可继续工作。

## 风险与约束

- 易用入口过多会进一步增加困惑；必须优先收敛，而不是继续堆命令。
- External spec store 会触及路径解析、写入边界和多仓库协作，需要先设计再实施。
- UX profile 和 task workflow profile 名称接近，必须在配置和文档中明确区分。
- 任何快捷封装都必须可审计、可测试，并输出底层将执行或建议执行的真实命令。

## 分阶段建议

1. 第一阶段：不改核心数据模型，先收敛 `next/dashboard/brief/setup` 体验和文档/agent guidance。
2. 第二阶段：引入 external specs root/store、只读上下文源和 working set JSON。
3. 第三阶段：引入 UX profile，把 core/advanced 命令展示和 agent guidance 分层。

## OpenSpec 对比结论

OpenSpec 的价值在于产品化入口和多仓库规划体验；spec-manager 的价值在于强治理和证据闭环。本次改造应吸收前者的易用性，但继续坚持后者的事实源和门禁模型。
