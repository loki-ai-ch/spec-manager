---
code: workflow-usability-hardening-L1
level: L1
title: Workflow Usability Hardening
topic: workflow-usability-hardening
parentCode: null
status: implemented
aiSummary: >-
  PRD：将严格工作流治理升级为可操作引导，覆盖 planJson 诊断、task step 并发/batch、段名
  alias、docs/package/agent 一致性检查。
created: '2026-06-27T13:45:43.903Z'
updated: '2026-06-27T14:39:23.939Z'
changeSummary: 'cascade: task-complete'
---
# Workflow Usability Hardening — PRD

## 背景

本轮实际使用 spec-manager 完成 DESIGN.md 融合、README 改造、npm publish 和 GitHub release 时，工作流整体有效，但暴露出若干“治理很严格，却没有足够递工具”的体验问题。

这些问题不是要弱化 spec-manager 的规则，而是要把规则从“拦住用户/Agent”升级为“指出具体修复路径，必要时提供可安全自动化的入口”。

## 用户痛点

1. **planJson 错误诊断不够具体**
   当 planJson 使用 `no/type` 而非 `stepNo/stepType` 时，`task create` 先被 Zod schema 拦住，只输出 `Invalid input; Required` 这类低信息错误。用户看不到 `validatePlanJson` 已经具备的 INC-005 友好提示。

2. **task step 并发上报存在覆盖风险**
   多个 `spec-manager task step` 并行执行时，当前 `reportStep` 采用读-改-写 task JSON 的方式，可能造成后写入覆盖先写入，导致步骤仍是 pending，直到 `task complete` 才暴露。

3. **L3 必填段名过于刚性**
   `## 实施计划` 与 `## 实施步骤` 语义接近，但校验只接受规范段名。当前会阻断流程，而不是提示 alias 或给出修复建议。

4. **文档/发布/Agent 资产一致性缺少显式检查**
   README 链接、`package.json.files`、`skill/SKILL.md`、`templates/agents/*`、本地 `.agents/` 生成资产之间没有一条集中检查命令。发布前容易漏掉英文 README、skill 文案或生成资产边界。

5. **release notes 易受 shell quoting 影响**
   手写 `gh release create --notes "..."` 时，notes 中的反引号会被 shell 展开。这个问题本质是发布辅助不足，但可以纳入 docs/package/release 检查或 release helper 的后续范围。

## 目标

- 让关键工作流错误输出从“schema 报错”升级为“可执行修复建议”。
- 让 task step 上报具备并发安全能力，或提供官方 batch 上报入口，避免并行 Agent 写入丢失。
- 让 spec 段名治理支持低风险 alias 识别，并提示规范段名。
- 提供项目级 docs/package/agent 资产一致性检查，覆盖 README、npm files、skill/template 文案和生成资产边界。
- 保持现有治理强度，不引入隐式自动放行，不自动修改用户文件，除非命令显式声明修复模式。

## 非目标

- 不取消 L1/L2/L3/Task 审核门禁。
- 不放宽 L3 frozen 才能创建 Task 的规则。
- 不把 warning-only 问题变成隐藏自动修复。
- 不重构整个 CLI 架构。
- 不在本轮实现完整 release automation；release notes helper 可作为后续 L3。

## 范围边界

本轮覆盖四类工作流可用性改进：

- planJson 诊断：把 schema required 转成字段级修复建议。
- task step 上报：降低并行写入覆盖风险，或提供官方 batch 入口。
- spec 段名治理：识别常见 alias 并给出规范段名建议。
- docs/package/agent 一致性：新增只读检查，帮助发布前发现文档和分发资产漂移。

本轮不做隐式自动修复；任何修改型修复都必须作为后续显式命令设计。

## 用户故事

- 作为 Agent，我在提交错误 planJson 时，希望 CLI 告诉我具体字段错在哪、应该改成什么，而不是只看到 schema required。
- 作为用户，我希望并行上报多个 task step 不会丢失结果。
- 作为规格作者，我写了语义等价但不规范的段名时，希望 spec-manager 告诉我如何改正，而不是只说缺段。
- 作为维护者，我希望发布前有一条命令检查 README 链接、package files、skill/template 文案是否一致。

## 验收标准

1. **AC-1**: `task create` MUST 对 planJson 字段错误输出包含 path、错误字段、建议字段和最小可复制示例。
2. **AC-2**: `task step` MUST 避免并行上报丢失不同 step 的成功状态，或新增 `task step batch` 并在文档中推荐用于并发场景。
3. **AC-3**: L3 规格出现 `## 实施计划` 时，校验/critic MUST 提示它是 `## 实施步骤` 的 alias，并给出规范修复建议。
4. **AC-4**: 新增项目检查能力 MUST 报告 README 英文链接、`package.json.files`、`skill/SKILL.md`、agent templates、生成资产边界中的不一致。
5. **AC-5**: 所有新增检查 MUST 默认只读；若后续提供 fix，也必须显式 opt-in。
6. **AC-6**: 文档和 skill guidance SHOULD 说明这些新能力如何帮助 Agent 避免“治理严格但不会修”的困境。

## 代码调查摘要

- `src/core/task.ts#createTask` 先执行 `PlanJsonSchema.safeParse`，失败时只拼接 Zod issue message；这会绕过 `src/core/validate.ts#validatePlanJson` 中已有的 `no/type/desc` 友好提示。
- `src/core/task.ts#reportStep` 对 task JSON 执行读-改-写，缺少事务锁或基于最新文件的 merge retry，存在并行写覆盖风险。
- `src/core/spec-sections.ts#sectionBody` 对 heading 做精确匹配；critical AC、verification commands 等消费者依赖规范段名。
- `src/core/spec-critic.ts` 已有 section rule 模型，可承接 alias/修复建议类 advisory。
- `src/core/usability.ts#runProjectDoctor` 已做 project doctor 和 agent managed asset 检查，可扩展 docs/package 只读检查。
- `package.json.files` 控制 npm 包内容；README/readme_en、skill、templates 是否一致目前缺少集中审计。

## 成功指标

- Agent 在错误 planJson 上能一次性修正字段名。
- 并行或批量 step 上报不会造成 completed 前才发现 pending。
- 文档段名错误能在 spec update/critique 阶段得到明确修复建议。
- 发布前能用一条命令看出 README/package/skill/template 的一致性问题。

## L2 拆分建议

1. **Workflow Error Guidance and Safe Step Reporting**
   覆盖 planJson 诊断、task step 并发安全或 batch 上报、段名 alias。

2. **Docs Package and Agent Asset Consistency Checks**
   覆盖 README/package files、skill/template、生成资产边界和 release notes 风险提示。
