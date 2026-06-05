---
code: spec-manager-ai-ux-L3.1.1-readme
level: L3
title: README 场景化改造
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: EN+ZH README 新增 5 个使用场景：quick/research/full/delta/postmortem，每条 ≤10 行
created: '2026-06-05T04:30:21.944Z'
updated: '2026-06-05T17:55:22+08:00'
changeSummary: 同步方法论 R12：planJson coveredSpecs 使用 canonical specCode
steps:
  - stepNo: '1'
    stepType: mcp_tool
    name: '上下文收集: README.md + readme_zh.md'
    status: succeeded
    toolName: Read
    outputJson: >-
      {"summary":"读取 README.md 和 readme_zh.md，确认现有结构：Quick start +
      Tutorial，无使用场景章节","files":["README.md","readme_zh.md"]}
    latencyMs: 500
    reportedAt: '2026-06-05T04:34:43.989Z'
  - stepNo: '2'
    stepType: llm_call
    name: 设计 5 个使用场景(quick/research/full/delta/postmortem)
    status: succeeded
    toolName: llm_call
    outputJson: >-
      {"summary":"设计 5 个使用场景：quick fix / research / full feature / delta change
      / postmortem","files":[]}
    latencyMs: 1000
    reportedAt: '2026-06-05T04:34:52.580Z'
  - stepNo: '3'
    stepType: mcp_tool
    name: 编写英文 README Usage scenarios 章节
    status: succeeded
    toolName: Edit
    outputJson: >-
      {"summary":"README.md 新增 Usage scenarios 章节，5 个场景每条 ≤10 行含 CLI
      命令","files":["README.md"]}
    latencyMs: 2000
    reportedAt: '2026-06-05T04:35:14.722Z'
  - stepNo: '4'
    stepType: mcp_tool
    name: 编写中文 README 使用场景章节
    status: succeeded
    toolName: Edit
    outputJson: '{"summary":"readme_zh.md 新增使用场景章节，与英文版同步，5 个场景","files":["readme_zh.md"]}'
    latencyMs: 2000
    reportedAt: '2026-06-05T04:35:33.576Z'
  - stepNo: '5'
    stepType: mcp_tool
    name: '验证: 场景数量 + EN/ZH 同步'
    status: succeeded
    toolName: Bash
    outputJson: '{"summary":"验证通过：EN+ZH 各 5 个使用场景，编号 1-5，场景类型一致","files":[]}'
    latencyMs: 500
    reportedAt: '2026-06-05T04:35:51.181Z'
---
# README 场景化改造 — 实施规格

## 目标

实施 spec-manager-ai-ux-L2.1 的 README 场景化改造：EN+ZH README 新增 5 个使用场景示例。

**前置依赖**: 无

## 代码调查

- `README.md`
- `readme_zh.md`

## 实施步骤

### Step 1 — 上下文收集

- Read `README.md` — 确认现有结构（Quick start + Tutorial）
- Read `readme_zh.md` — 确认中文版结构

### Step 2 — 设计 5 个使用场景

场景覆盖：
1. **快速修复** — 改一行代码，走 quick 流程
2. **研究查询** — 查看已有 spec 列表
3. **完整功能开发** — L1→L2→L3→Task 全链路（现有教程精简版）
4. **Delta change** — 修改已上线 spec
5. **复盘** — 记录事故 postmortem

### Step 3 — 编写英文 README 场景

- **文件**: `README.md`
- **位置**: 在 `## Quick start` 之后、`## Tutorial` 之前，新增 `## Usage scenarios` 章节
- 每个场景 ≤10 行，含完整 CLI 命令
- 完成后 step_report outputJson:
  ```json
  {"summary": "README.md 新增 5 个使用场景", "files": ["README.md"]}
  ```

### Step 4 — 编写中文 README 场景

- **文件**: `readme_zh.md`
- **位置**: 同英文版
- 内容与英文版对应
- 完成后 step_report outputJson:
  ```json
  {"summary": "readme_zh.md 新增 5 个使用场景", "files": ["readme_zh.md"]}
  ```

### Step 5 — 验证

- 检查 EN+ZH 场景数量一致
- 检查每个场景 CLI 命令可执行（dry-run）

## 验证命令

```bash
# 正向验证: 场景数量
grep -c "^###" README.md
# 预期: ≥5 个场景标题

# 正向验证: 中文版同步
grep -c "^###" readme_zh.md
# 预期: 与英文版一致
```

## planJson (final)

```json
{
  "coveredSpecs": ["spec-manager-ai-ux-L3.1.1-readme"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: README.md + readme_zh.md"},
    {"stepNo": 2, "stepType": "llm_call", "name": "设计 5 个使用场景(quick/research/full/delta/postmortem)"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编写英文 README Usage scenarios 章节"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编写中文 README 使用场景章节"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "验证: 场景数量 + EN/ZH 同步"}
  ]
}
```

autoConfirm: true — 纯文档修改，无风险。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 内容问题 | `git checkout -- README.md readme_zh.md` | < 1 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 场景 CLI 命令过时 | 每个命令基于实际 CLI 接口编写 |
