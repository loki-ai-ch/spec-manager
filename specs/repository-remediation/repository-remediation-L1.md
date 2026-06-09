---
code: repository-remediation-L1
level: L1
title: 历史仓库一致性显式迁移
topic: repository-remediation
parentCode: null
status: implemented
aiSummary: >-
  显式迁移 20 个历史一致性问题：补建 4 个 Decision Card，以不可变豁免登记 16 个旧 Task，并补齐 Claude skill
  rules/templates。
created: '2026-06-08T09:50:30.475Z'
updated: '2026-06-09T01:36:43.900Z'
changeSummary: 'cascade: project-reconcile'
---
# 历史仓库一致性显式迁移

## 背景

`architecture-hardening-L1` 已上线仓库完整性扫描、Task 终态不可变和成功 verification 门禁。新规则在当前仓库中发现 20 个历史遗留问题：

- 4 个 implemented L1 缺少 Decision Card。
- 16 个旧 completed Task 缺少成功 verification。
- Claude 项目 skill 已安装主体与 subskills，但缺少 bundled `rules/` 和 `templates/`。

这些旧 Task 在新规则上线前已完成，不能通过补写 verification 篡改终态历史。需要建立显式、可审计、可重复执行的迁移机制，区分历史豁免与当前违规。

## 用户故事

1. 作为维护者，我希望为 implemented L1 补建基于现有规格内容的决策卡片，使历史技术决策可以查询。
2. 作为审计人员，我希望旧 completed Task 的验证缺失被明确登记为历史迁移豁免，而不是伪造验证证据。
3. 作为项目使用者，我希望 `project doctor` 在应用显式迁移后不再重复报告已登记的历史问题。
4. 作为 Claude Code 使用者，我希望项目内 spec-manager skill 包含完整 rules 和 templates，同时不覆盖人工维护的 `CLAUDE.md`。
5. 作为工具维护者，我希望迁移操作可预览、可审计、可重复执行且不会静默修改终态 Task。

## 验收标准

1. **AC-1**: 系统 MUST 为 4 个缺失 Decision Card 的 implemented L1 创建基于现有规格和实施结果的结构化决策记录。
2. **AC-2**: 系统 MUST 为 16 个旧 completed Task 建立显式历史豁免记录，且 MUST NOT 修改这些 Task 的 steps、verifications、status 或时间字段。
3. **AC-3**: 完整性扫描 MUST 区分未处理的缺失 verification 与已登记历史豁免，并保留豁免原因、创建时间和关联 Task。
4. **AC-4**: 历史豁免 MUST 仅适用于迁移清单中明确列出的终态 Task；新建 Task 或未登记旧 Task 不得被自动豁免。
5. **AC-5**: 系统 MUST 提供 dry-run 或等价预览，展示将创建的决策、豁免记录和 skill 资产，不修改文件。
6. **AC-6**: 项目内 Claude skill MUST 包含 `rules/` 和 `templates/`，且安装过程 MUST NOT 覆盖已有 `CLAUDE.md` 或人工配置。
7. **AC-7**: 迁移完成后 `project doctor` MUST 不再报告这 20 个已处理问题，同时仍能发现新制造的同类问题。
8. **AC-8**: 自动化测试 MUST 覆盖豁免范围、终态 Task 不可变、迁移幂等性、dry-run 和 Claude skill 资产修复。

## 范围边界

### 必须包含

- 读取并总结以下 implemented L1 后创建 Decision Card：
  - `l3-approval-L1`
  - `roadmap-openspec-L1`
  - `spec-manager-ai-ux-L1`
  - `workflow-hardening-L1`
- 为当前完整性扫描列出的 16 个旧 completed Task 创建显式历史豁免记录。
- 扩展完整性扫描，使其识别有效豁免但不弱化新 Task 门禁。
- 补齐 `.claude/skills/spec-manager/rules/` 和 `.claude/skills/spec-manager/templates/`。
- 提供迁移预览、幂等执行和自动化验证。

### 明确不做

- 不向旧 completed Task 补写伪造 verification。
- 不修改旧 Task 的 status、steps、时间戳或执行摘要。
- 不自动为未来发现的问题创建豁免。
- 不覆盖已有 `CLAUDE.md`、`.claude/settings.local.json` 或其他人工配置。
- 不处理与当前 20 个问题无关的历史内容重写。

## 成功指标

- 当前仓库完整性问题从 20 个降至 0。
- 16 个旧 Task 文件内容在迁移前后保持字节级不变。
- 4 个 Decision Card 可通过 topic 与 docCode 查询。
- 新增一个无 verification 的 completed Task 时，doctor 仍会报告问题。
- 重复执行迁移不会产生重复决策、重复豁免或覆盖人工文件。
