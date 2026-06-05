---
code: spec-manager-ai-ux-L3.1.2-skill
level: L3
title: SKILL.md 合并精简
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: RESOLVER 内联到 SKILL.md、精简至 ≤120 行、删除 RESOLVER.md
created: '2026-06-05T04:30:22.871Z'
updated: '2026-06-05T04:38:42.260Z'
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: SKILL.md + RESOLVER.md'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 合并 RESOLVER 到 SKILL.md，精简至 ≤120 行
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 同步 skill/SKILL.md 分发版本
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 删除 RESOLVER.md（两处）
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: '验证: 行数 + 路由表存在'
    status: pending
changeSummary: frozen → implemented (task complete)
---
# SKILL.md 合并精简 — 实施规格

## 目标

实施 2026-06-05-159dad 的 SKILL.md 合并精简：将 RESOLVER.md 内容内联到 SKILL.md，精简至 ≤120 行，删除 RESOLVER.md。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- Read `.claude/skills/spec-manager/SKILL.md` — 确认当前结构（137 行）
- Read `.claude/skills/spec-manager/RESOLVER.md` — 确认路由规则（73 行）
- Read `skill/SKILL.md` + `skill/RESOLVER.md` — 确认分发版本

### Step 2 — 合并 RESOLVER 到 SKILL.md

- **策略**: 将 RESOLVER 的路由表和消歧规则内联到 SKILL.md 的入口路由章节
- **精简方向**:
  - CLI 速查表压缩为 3 行概要（完整帮助用 `--help`）
  - 设计取舍章节删除（已在 README）
  - 数据布局章节精简为关键约定 3 行
  - 硬性约束表格保留但压缩
- 完成后 step_report outputJson:
  ```json
  {"summary": "SKILL.md 合并 RESOLVER 内容，精简至 ≤120 行", "files": [".claude/skills/spec-manager/SKILL.md"]}
  ```

### Step 3 — 同步分发版本

- **文件**: `skill/SKILL.md`
- **变更**: 与 `.claude/skills/spec-manager/SKILL.md` 保持一致
- 完成后 step_report outputJson:
  ```json
  {"summary": "skill/SKILL.md 同步更新", "files": ["skill/SKILL.md"]}
  ```

### Step 4 — 删除 RESOLVER.md

- 删除 `.claude/skills/spec-manager/RESOLVER.md`
- 删除 `skill/RESOLVER.md`
- 完成后 step_report outputJson:
  ```json
  {"summary": "RESOLVER.md 已删除", "files": [".claude/skills/spec-manager/RESOLVER.md", "skill/RESOLVER.md"]}
  ```

### Step 5 — 验证

- 统计 SKILL.md 行数 ≤120
- 测试 5 个场景的路由匹配

## 验证命令

```bash
# 正向验证: 行数
wc -l .claude/skills/spec-manager/SKILL.md
# 预期: ≤120

# 正向验证: RESOLVER 已删
ls .claude/skills/spec-manager/RESOLVER.md 2>&1
# 预期: No such file

# 反向验证: SKILL.md 仍包含路由表
grep "入口路由" .claude/skills/spec-manager/SKILL.md
# 预期: 匹配到
```

## planJson (final)

```json
{
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: SKILL.md + RESOLVER.md"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "合并 RESOLVER 到 SKILL.md，精简至 ≤120 行"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "同步 skill/SKILL.md 分发版本"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "删除 RESOLVER.md（两处）"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "验证: 行数 + 路由表存在"}
  ]
}
```

autoConfirm: true — 纯文档修改，无风险。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 精简过度遗漏规则 | `git checkout -- .claude/skills/spec-manager/SKILL.md skill/SKILL.md` | < 1 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 精简后遗漏关键规则 | 对比原 RESOLVER 路由表逐条确认 |
