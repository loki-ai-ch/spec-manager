# 规则 frontmatter 模板

> 复制本文件改 ID 即可。所有规则统一格式,便于 applies_to 过滤。

```markdown
---
id: R<N>
title: 一句话标题
added: 0.1.0
applies_to: [action_1, action_2, ...]
---

## 正文

详细规则 + 判定标准 + 违反示例 + 豁免 + 关联。
```

字段说明:
- `applies_to` — 该规则被检查的 action 名。CLI 和 skill 都通过 `applies_to` 过滤当前操作要加载哪些规则（人工筛选）。
- 其它字段（`trigger_count` / `last_triggered` / `health` / `reason_inc` / `audit_type`）已废弃：触发次数看 `spec-manager audit show`，incident 关联看 incident 文件 frontmatter。
