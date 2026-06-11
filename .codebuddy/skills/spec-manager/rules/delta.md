# Delta Spec 规则

> 本文件管辖:R24
> 主题:OpenSpec 风格的增量 spec 提案（change folder）的完整性

## R24 — delta change 必须含 proposal + delta spec

---
id: R24
title: delta change 必须含 proposal + delta spec
added: 0.1.0
applies_to: [change_new, change_archive]
---

**核心规则**：`spec-manager change new <name>` 创建的 change 文件夹（`changes/YYYY-MM-DD-<name>/`）必须满足：

1. **proposal.md** 非空 — 至少含 ## 为什么（Why）/ ## 影响范围（Scope）/ ## 验收标准（AC）
2. **至少一个 delta spec** — 在 `changes/.../specs/<topic>/<code>/` 下的 `*.md`，使用 ## ADDED Requirements / ## MODIFIED Requirements / ## REMOVED Requirements / ## RENAMED Requirements 四个段之一

`spec-manager change archive <name>` 会校验：
- proposal.md 存在且非空
- delta spec 文件存在且包含合法 delta 段落
- ADDED 操作的占位文件位于 `changes/<name>/specs/<topic>/<code>/<code>.md`，archive 时按占位 frontmatter 的 `parentCode` 字段把新 spec 放到主 specs 树的正确嵌套位置

违反任一条件 `change archive` 拒绝执行（exit 2），并打印具体缺什么。

### 为什么

- **避免 "delta 半截"**：没 proposal 的 change 是无目的的修改，没 delta spec 的 change 是凭空合并
- **可审计性**：archive 时机 = 知识合并点，必须有完整变更描述
- **可回滚**：proposal + delta 是 archive 的"原账本"，未来回滚或查询靠它们

### 与 R13/R14 的关系

- R13：delta spec 也必须写 aiSummary（`spec-manager spec update --ai-summary`）
- R14：delta spec 引用主 spec 时用 specCode，不复述原文

### 关联

- `templates/proposal.md` — change proposal 模板
- `templates/delta-spec.md` — delta spec 模板
- Phase 3 实施：`change new/archive/list` 三个 CLI 命令
