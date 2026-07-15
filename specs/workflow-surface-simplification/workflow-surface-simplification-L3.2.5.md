---
code: workflow-surface-simplification-L3.2.5
level: L3
title: Docs and Agent Guidance for Multi-repo Specs
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.2
status: implemented
aiSummary: >-
  补齐 external specs store 的 README 与 Agent guidance：明确单仓库/多仓库模式、write root
  验证命令、agent 写入前确认 root，以及 specs/DESIGN.md 跟随 resolved write root。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey docs and guidance gaps
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Update README multi repo store guidance
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update agent templates store guidance
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Add docs guidance smoke tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.2
created: '2026-07-15T05:58:45.057Z'
updated: '2026-07-15T06:06:37.973Z'
changeSummary: 'cascade: task-complete'
---
# Docs and Agent Guidance for Multi-repo Specs

## 背景

`workflow-surface-simplification-L3.2.1` 到 `workflow-surface-simplification-L3.2.4` 已经让 spec-manager 具备 external specs store 的核心能力：配置解析、project context/store doctor、workflow surface write root 投影，以及 spec/task/decision 写命令使用 external write root。

但用户和 AI Agent 仍需要从源码或前序规格里推断“应该把 specs 放在哪里”“代码仓库里配置什么”“写命令实际写到哪里”。如果 README 和 agent guidance 不显式说明，多仓库 specs 能力虽然存在，却很容易被误用成单仓库模式，或者让 Agent 把 specs 写回 code repo。

## 目标

- 更新中文 README 的核心路径，明确推荐 `specs` 作为项目群/产品线级事实源，而不是默认绑定单个代码仓库。
- 更新英文 README 的对应说明，保持中英文入口一致。
- 更新 agent templates 和 spec-manager skill guidance，让 Agent 在动手前确认 execution root、write root 和 context sources。
- 给出最小可复制配置示例和验证命令，降低 external store 首次使用门槛。
- 保持文档层面不承诺尚未实现的 `--store` override 或自动迁移能力。

## 非目标

- 不新增 CLI 命令。
- 不实现 `project store set` 或 `--store <id|path>`。
- 不迁移现有 specs/tasks/decisions。
- 不改变 spec/task/decision 的存储格式。
- 不重写完整 README 结构，只补齐 multi-repo specs 的显式路径和 Agent guidance。

## 实施步骤

1. 走读当前 README、英文 README、agent templates 和 spec-manager skill，确认现有 external store 说明缺口。
2. 更新中文 README：
   - 在上手路径中加入“单仓库默认”和“多仓库 external specs store”两种模式。
   - 增加最小 `specStore` / `contextSources` 配置示例。
   - 增加 `project context --json`、`project store show`、`project store doctor`、`dashboard --json` 验证命令。
   - 明确写命令会写入 resolved write root。
3. 更新英文 README：
   - 与中文 README 保持同等语义，但保持精简。
   - 明确 Chinese README is primary 或保留既有英文链接策略。
4. 更新 agent templates：
   - `AGENTS.md` / `CLAUDE.md` / `CURSOR.md` / `WINDSURF.md` / `CODEBUDDY.md` / CodeBuddy skill 中加入 store-aware workflow 注意事项。
   - 要求 Agent 在写 spec/task/decision 前优先检查 `project context --json` 或 `dashboard --json` 的 write root。
5. 更新 `.agents/skills/spec-manager/SKILL.md` 或对应模板：
   - 把 multi-repo specs 能力作为默认工作流提示。
   - 明确 `specs/DESIGN.md` 与 external write root 的关系：设计上下文应存在于 resolved write root 的 `specs/DESIGN.md`，root `DESIGN.md` 只作 legacy fallback。
6. 添加或更新测试：
   - README/agent guidance smoke 测试应检查关键命令与术语存在。
   - 如果已有 docs consistency 测试覆盖 templates，则同步更新预期。
7. 运行 targeted docs/template tests、lint、build。

## 验收标准

1. **AC-1**: 中文 README MUST 明确区分单仓库默认模式和多仓库 external specs store 模式。
2. **AC-2**: 中文 README MUST 提供可复制的 `specStore` / `contextSources` YAML 示例。
3. **AC-3**: 中英文 README MUST 明确写命令使用 resolved write root，并推荐用 `project context --json` 或 `project store doctor` 验证。
4. **AC-4**: Agent templates MUST 提醒 Agent 在写 spec/task/decision 前确认 execution root 与 write root。
5. **AC-5**: Guidance MUST NOT 推荐尚未实现的 `--store` override、自动迁移或网络服务。
6. **AC-6**: Guidance MUST 说明 `specs/DESIGN.md` 应跟随 resolved write root 管理，root `DESIGN.md` 是 legacy fallback。
7. **AC-7**: targeted tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/cli/__tests__/project-workflow.test.ts src/cli/__tests__/usability.test.ts src/core/__tests__/workflow-surface.test.ts
npm run lint
npm run build
```

如现有 docs/template 测试文件名不同，实施时应选择覆盖 README、agent templates 和 workflow surface guidance 的实际测试文件。

## 风险与回滚

- 风险：文档过度强调 external store，会让单仓库用户觉得必须配置 store。README 必须先说明“未配置时保持本地默认”。
- 风险：Agent guidance 如果只写“检查 root”但不给命令，执行时仍会遗漏。必须给出可复制命令。
- 风险：提到未实现能力会制造误导。文档只描述已实现能力和明确的后续方向。
- 回滚：恢复 README/templates/skill guidance 到上一版本，不影响已经实现的 store-aware CLI 行为。
