---
code: workflow-surface-simplification-L3.4.2
level: L3
title: Task Run Guidance and Compatibility
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.4
status: implemented
aiSummary: >-
  补齐 task run 的 README 与 Agent guidance：确认并执行/创建并执行任务映射到 task run；普通 spec
  confirm 仍只冻结；保留 task create/start 手动拆解路径。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey task run docs guidance
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Update README task run guidance
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Update agent templates task run guidance
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Add task run guidance tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.4
created: '2026-07-15T07:01:32.986Z'
updated: '2026-07-15T07:23:42.837Z'
changeSummary: 'cascade: task-complete'
---
# Task Run Guidance and Compatibility

## 背景

`workflow-surface-simplification-L3.4.1` 已实现 `spec-manager task run <L3-code> --plan <file>`，可以显式合并 L3 freeze、Task create 和 Task start。但 README、agent templates 和 spec-manager skill 仍主要展示旧的三步链路：

```bash
spec-manager spec confirm <L3-code>
spec-manager task create <L3-code> --plan ./plan.json
spec-manager task start T-001 --spec <L3-code>
```

如果 guidance 不更新，Agent 仍会在用户说“确认并执行”“创建并执行任务”时继续拆成两轮，无法真正消除本轮复盘发现的摩擦。

本规格补齐文档和 Agent guidance，同时明确兼容边界：普通 `spec confirm` 仍只冻结，只有用户明确表达执行意图时才使用 `task run`。

## 目标

- 更新中文 README 和英文 README，把 `task run` 作为 L3 确认并执行的推荐短路径。
- 保留手动三步链路作为 advanced/拆解说明。
- 更新 agent templates 和 spec-manager skill：自然语言“确认并执行”“创建并执行任务”“继续执行 L3”应映射到 `task run`。
- 明确只说“确认 L3”或给出 `spec confirm` 时不得自动创建 task。
- 添加 docs/guidance smoke tests，防止后续文档回退。

## 非目标

- 不改 `task run` core/CLI 行为。
- 不改 `spec confirm` 行为。
- 不新增命令 alias。
- 不自动生成 planJson。
- 不修改 task lifecycle 或 verification gate。

## 实施步骤

1. 走读当前 README、readme_en、agent templates、`.agents/skills/spec-manager/SKILL.md`、docs guidance tests。
2. 更新中文 README：
   - 在最短路径或手动推进链路中加入 `spec-manager task run auth-L3.1.1 --plan ./plan.json`。
   - 明确 `spec confirm <L3>` 只冻结，不创建 task。
   - 将旧 `task create` + `task start` 保留为 advanced/manual breakdown。
3. 更新英文 README：
   - 同步 task run short path。
   - 保持中文 README 优先链接策略。
4. 更新 agent templates：
   - `AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md`、`CURSOR.md`、`WINDSURF.md`、CodeBuddy skill。
   - 加入自然语言映射规则。
5. 更新本项目 `.agents/skills/spec-manager/SKILL.md`：
   - 加入同样规则，确保 Codex 在本项目内也使用新短路径。
6. 更新测试：
   - `docs-guidance.test.ts` 或新增测试检查 README 和 templates 包含 `task run`。
   - 检查 guidance 同时包含“spec confirm remains confirm-only”语义。
7. 运行 targeted docs tests、lint、build。

## 接口契约

文档推荐命令：

```bash
spec-manager task run <L3-code> --plan ./plan.json
```

Agent guidance 必须表达：

- If the user says “confirm and run”, “create and execute the task”, or “continue executing this L3”, use:

```bash
spec-manager task run <L3-code> --plan <planFile>
```

- If the user only asks to confirm/freeze an L3, use:

```bash
spec-manager spec confirm <L3-code>
```

and stop; do not create a task automatically.

## 验收标准

1. **AC-1**: 中文 README MUST 推荐 `task run` 作为 L3 确认并执行的短路径。
2. **AC-2**: 英文 README MUST 同步说明 `task run`。
3. **AC-3**: Agent templates MUST 明确“确认并执行/创建并执行任务/继续执行 L3”映射到 `task run`。
4. **AC-4**: Agent guidance MUST 明确普通 `spec confirm <L3>` 不自动创建 task。
5. **AC-5**: 文档 MUST 保留手动 `task create` + `task start` 作为 advanced/manual breakdown。
6. **AC-6**: Guidance MUST NOT 声称 planJson 会自动生成。
7. **AC-7**: targeted docs tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/core/__tests__/docs-guidance.test.ts src/cli/__tests__/task.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：Agent 把所有 L3 confirm 都改成 task run。guidance 必须强调只有执行意图才使用 task run。
- 风险：README 只展示 task run 会让高级用户不知道如何拆解排错。保留 manual breakdown。
- 回滚：恢复 README/templates/skill guidance，不影响已经实现的 `task run` 命令。
