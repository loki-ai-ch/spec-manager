---
code: agent-install-surface-L3.1.2
level: L3
title: README and Agent Guidance for Platform Install Surface
topic: agent-install-surface
parentCode: agent-install-surface-L2.1
status: implemented
aiSummary: >-
  补齐 graphify-style install 的 README、英文 README、skill/guidance 和 docs tests，明确
  fallback 平台使用 AGENTS-compatible instructions 并保留旧 project agents 入口。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey install docs guidance
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Update Chinese README install surface
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update English README install surface
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Update skill and template guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: Add docs guidance tests
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: Run docs tests lint build
    status: pending
relations:
  - type: based_on
    target: agent-install-surface-L2.1
created: '2026-07-15T07:57:02.549Z'
updated: '2026-07-15T08:03:00.685Z'
changeSummary: 'cascade: task-complete'
---
# README and Agent Guidance for Platform Install Surface

## 背景

`agent-install-surface-L3.1.1` 已实现 graphify-style 安装入口：

```bash
spec-manager <platform> install
spec-manager install --platform <platform>
spec-manager agents install
spec-manager skills install
```

但 README、英文 README、skill 和 Agent guidance 仍主要展示旧入口：

```bash
spec-manager project agents --provider all
spec-manager project agents --provider codex
```

需要把新的低门槛入口展示给用户，同时保留旧入口作为兼容/高级形式。

## 目标

- 更新中文 README，优先展示新平台安装入口。
- 更新英文 README，同步平台命令表。
- 更新 `skill/SKILL.md` 和必要 templates，让 Agent 能推荐新入口。
- 明确 fallback 平台使用 AGENTS-compatible instructions，不声称 native integration。
- 保留 `project agents --provider ...` 作为兼容/高级入口。
- 增加 docs guidance 测试，防止平台命令表和 skill guidance 回退。

## 非目标

- 不修改 L3.1.1 的 CLI/core 行为。
- 不新增平台。
- 不新增 native IDE integration。
- 不发布 npm 或提交 git；发布另行执行。

## 涉及文件

- `README.md`
- `readme_en.md`
- `skill/SKILL.md`
- `templates/agents/*` 如需增加一句 guidance
- `src/core/__tests__/docs-guidance.test.ts`

## 实施步骤

1. 走读 README/英文 README/skill 当前 Agent 安装段落。
2. 中文 README：
   - 5 分钟开始保留 `project agents --provider all` 或替换为 `agents install`。
   - 接入 AI 工具段落新增平台命令表，覆盖 L3.1.1 平台清单。
   - 标注 fallback 平台使用 AGENTS-compatible instructions。
3. 英文 README 同步。
4. skill/guidance 增加推荐：
   - 常见平台用 `spec-manager <platform> install`。
   - 跨框架用 `spec-manager agents install` / `skills install`。
   - 旧 `project agents --provider` 保留兼容。
5. 增加 docs guidance 测试：
   - README 包含 `spec-manager kilo install`、`spec-manager install --platform kimi`、`spec-manager agents install`、`AGENTS-compatible fallback`。
   - skill 包含新入口和旧入口兼容说明。
6. 运行 docs tests、lint、build。

## 验收标准

1. **AC-1**: 中文 README MUST 显示新平台安装命令表。
2. **AC-2**: 英文 README MUST 同步新平台安装命令表。
3. **AC-3**: README MUST 明确 fallback 平台使用 AGENTS-compatible instructions。
4. **AC-4**: README MUST 保留 `project agents --provider ...` 兼容入口。
5. **AC-5**: Skill/guidance MUST 推荐 `spec-manager <platform> install` 和 `agents/skills install`。
6. **AC-6**: Docs tests、lint、build MUST pass。

## 验证命令

```bash
npm test -- src/core/__tests__/docs-guidance.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：命令表过长影响 README 可读性。可分为常用命令和完整平台表。
- 风险：fallback wording 不清楚。必须使用 AGENTS-compatible fallback 明确边界。
- 回滚：恢复 README/skill 文档，不影响 L3.1.1 CLI 行为。
