---
code: critical-ac-readiness-L3.1.2-cli
level: L3
title: Critical AC Readiness CLI and Guidance
topic: critical-ac-readiness
parentCode: critical-ac-readiness-L2.1
status: implemented
aiSummary: >-
  实现 critical AC readiness CLI 和治理提示：新增 project readiness critical text/json
  输出、topic 过滤和错误映射，同步方法论、skill、Agent 入口中不得自动伪造关键 AC 的修复边界。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取本 L3、critical-readiness core、project CLI、方法论和 Agent 资产基线
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 project readiness critical CLI text/json 输出和错误处理
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 补充 CLI 测试覆盖 text、json、topic 过滤和非法 topic
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 同步方法论、skill、Agent 入口和契约测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行 vitest、build、doctor、spec validate 和 plan validate
    status: pending
created: '2026-06-16T08:27:57.455Z'
updated: '2026-06-16T08:35:33.966Z'
changeSummary: 'cascade: task-complete'
---
# Critical AC Readiness CLI and Guidance

## 背景

parent: `critical-ac-readiness-L2.1`

`critical-ac-readiness-L3.1.1-core` 已交付 `buildCriticalReadinessReport()` 和 public API。本 L3 将该 projection 暴露为项目级 CLI 报告，并同步方法论与 Agent 入口，确保不同执行环境都把关键 AC readiness 当作只读审计和人工确认修复流程，而不是自动补写内容。

## 目标

### 做

- 新增 `spec-manager project readiness critical [--topic <topic>] [--json]`。
- text 输出 totals、readiness ratio、各状态计数、缺口 item、suggestion 和 governed upgrade note。
- JSON 输出 `critical-readiness.experimental.v1`，直接来自 core report。
- 映射 `INVALID_CRITICAL_READINESS_TOPIC` 为 CLI exit code 2。
- 增加 CLI 测试覆盖 text、json、topic 过滤和非法 topic。
- 同步 `docs/methodology.md`、`skill/SKILL.md`、`templates/agents/*` 和 managed assets，明确不得自动伪造关键 AC。
- 更新方法论/Agent 契约测试。

### 不做

- 不修改 core 分类规则。
- 不自动补写历史 L3。
- 不新增 CI hard gate 或 doctor 强制失败。
- 不改变 `project workflow preview`、`project profile metrics` 和 Task 完成门禁。

## 实施步骤

1. 读取本 L3、`critical-ac-readiness-L2.1`、`src/core/critical-readiness.ts`、`src/cli/project.ts`、`docs/methodology.md`、`skill/SKILL.md`、`templates/agents/*` 与 managed assets 同步测试。
2. 在 `src/cli/project.ts` 新增 `project readiness critical` 命令，支持 text/json、topic 过滤和错误映射。
3. 新增或扩展 CLI 测试，覆盖默认 text、`--json`、`--topic` 和非法 topic。
4. 同步方法论、skill、Agent 模板和 managed assets，并补充契约测试，明确 readiness report 只给修复建议，不自动生成关键 AC。
5. 运行聚焦测试、build、doctor、`spec-manager spec validate` 和 `spec-manager spec validate-plan`。

## 受影响文件

| 路径 | 变更 |
|---|---|
| `src/cli/project.ts` | 新增 `project readiness critical` 命令和 text/json 输出 |
| `src/cli/__tests__/project-readiness.test.ts` | 新增 CLI 测试 |
| `src/core/__tests__/methodology-contract.test.ts` | 增加 readiness 修复边界契约 |
| `docs/methodology.md` | 补充 critical readiness report 与修复边界 |
| `skill/SKILL.md` | 同步 spec-manager skill 指引 |
| `templates/agents/*` | 同步 Agent 入口规则 |
| `.claude/skills/spec-manager/*`、`.codebuddy/skills/spec-manager/*` | managed assets 同步 |

## CLI 契约

```text
spec-manager project readiness critical [--topic <topic>] [--json]
```

Text 输出必须包含：

- `Critical AC Readiness`
- schemaVersion 或报告版本。
- active L3 总数、ready/missing/empty/unknown 计数。
- readiness ratio。
- 每个非 ready item 的 specCode、status、reason、suggestion。
- governed upgrade note。
- 当所有 active L3 ready 时提示可重新运行 `spec-manager project workflow preview`。

JSON 输出必须是 `CriticalReadinessReport`。

错误：

| 错误码 | 条件 | Exit |
|---|---|---|
| `INVALID_CRITICAL_READINESS_TOPIC` | topic 为空、包含 `/`、`\`、`..` 或路径风险字符 | 2 |

## 方法论与 Agent 边界

- readiness report 是只读审计，不修改 spec/task/config。
- missing/empty/unknown 的修复建议必须要求读取 L3 上下文并人工确认。
- Agent 不得批量插入或生成“看起来合理”的关键 AC。
- governed default 只能在所有 active L3 ready 后作为 adoption preview 的再评估输入，不能由 readiness 命令自动启用。

## 验收标准

1. **AC-1**: Given 用户运行 `project readiness critical`, When 项目存在 active L3, Then CLI SHALL 输出 Critical AC Readiness text report 和 totals。
2. **AC-2**: Given 用户传入 `--json`, When 命令成功, Then CLI SHALL 输出 `critical-readiness.experimental.v1` JSON report。
3. **AC-3**: Given 用户传入 `--topic`, When 命令成功, Then CLI SHALL 只输出该 topic 的 readiness 数据。
4. **AC-4**: Given topic 参数非法, When 命令执行, Then CLI SHALL 输出 `INVALID_CRITICAL_READINESS_TOPIC` 并以 exit code 2 失败。
5. **AC-5**: Given report 存在 missing/empty/unknown item, When 输出 text report, Then CLI SHALL 显示 specCode、status、reason 和 suggestion。
6. **AC-6**: Given 所有 active L3 ready, When 输出 text report, Then CLI SHOULD 提示重新运行 `spec-manager project workflow preview` 评估 governed default。
7. **AC-7**: Given 方法论和 Agent 入口同步, When 运行契约测试和 managed asset doctor, Then 文档 SHALL 明确 readiness report 不自动伪造关键 AC。
8. **AC-8**: Given 本 L3 完成, When 运行 build 和相关聚焦测试, Then project readiness CLI、methodology contract 和 managed assets SHALL 通过。

## 关键验收标准

- AC-1
- AC-2
- AC-4
- AC-5
- AC-7
- AC-8

## 验证命令

- `npx vitest run src/cli/__tests__/project-readiness.test.ts --reporter=dot`
- `npx vitest run src/core/__tests__/methodology-contract.test.ts --reporter=dot`
- `npm run build`
- `spec-manager project doctor`
- `spec-manager spec validate critical-ac-readiness-L3.1.2-cli`
- `spec-manager spec validate-plan --from-spec critical-ac-readiness-L3.1.2-cli`

## planJson (final)

```json
{
  "schemaVersion": "spec-manager.plan.v1",
  "spec": "critical-ac-readiness-L3.1.2-cli",
  "coveredSpecs": ["critical-ac-readiness-L3.1.2-cli"],
  "profile": "standard",
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取本 L3、critical-readiness core、project CLI、方法论和 Agent 资产基线"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 project readiness critical CLI text/json 输出和错误处理"},
    {"stepNo": 3, "stepType": "tool_action", "name": "补充 CLI 测试覆盖 text、json、topic 过滤和非法 topic"},
    {"stepNo": 4, "stepType": "tool_action", "name": "同步方法论、skill、Agent 入口和契约测试"},
    {"stepNo": 5, "stepType": "tool_action", "name": "运行 vitest、build、doctor、spec validate 和 plan validate"}
  ]
}
```

## 回滚方案

若 CLI 或文档同步引发回归，回退 `src/cli/project.ts`、`src/cli/__tests__/project-readiness.test.ts`、方法论/skill/Agent 资产和 managed assets 的本 L3 改动；保留已实现的 `src/core/critical-readiness.ts` core API 不变。
