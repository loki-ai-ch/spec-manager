---
code: harness-coding-L2.1
level: L2
title: 技术方案：Coding Harness 集成路线落地
topic: harness-coding
parentCode: harness-coding-L1
status: implemented
aiSummary: >-
  技术方案将 coding harness 集成拆为 task context、task report、verification、change
  proposal、schema/docs 五个 L3；优先交付 frozen L3 到 text/json context，再逐步接入执行回写和审计
created: '2026-06-08T07:22:21.663Z'
updated: '2026-06-09T01:36:43.893Z'
changeSummary: 'cascade: project-reconcile'
---
# 技术方案：Coding Harness 集成路线落地

# 技术方案：Coding Harness 集成路线落地 — 技术设计

## 方案概述

本方案把 `harness-coding-L1` 的长期路线拆为 5 个可独立交付模块。第一轮优先交付 frozen L3 到 harness-ready task context 的生成；后续依次交付 coding harness report 回写、verification 结构化记录、frozen 后 change proposal/amendment 闭环，以及 Codex/OpenCode/CI 集成文档与 JSON schema 稳定化。

```
[frozen L3 spec] ─┐
[parent L1/L2]   ├─> [task context builder] ──> text/json context ──> Codex/OpenCode/CI
[decisions]      │
[task state]     ┘

[coding harness report] ──> [task report ingester] ──> task step / task complete

[verification result] ──> [verification recorder] ──> task-linked evidence + audit

[implementation conflict] ──> [change proposal] ──> task + L3 linked amendment trail
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| 首个交付切入点 | A: task context B: verification C: change proposal | A | 核心阻塞是 frozen L3 到 coding harness 的可执行上下文，且不需要改动实现流程 |
| task context 输入 | A: L3 code B: task code C: topic | A | 准入规则要求实现必须来自 frozen L3；task 可由后续命令创建或关联 |
| task context 输出 | A: Markdown/text B: JSON C: 两者都支持 | C | 人类审阅需要 text，harness 稳定解析需要 JSON |
| 执行回写模型 | A: 复用 `task step` B: 新增独立 run log C: 两者并行 | A | 现有 Agent Task 已是执行记录边界，先扩展 report 格式而非引入新实体 |
| verification 存储位置 | A: task 内嵌 evidence B: 独立 verification 文件 C: 只写 complete summary | A | verification 是 task 执行证据，初期内嵌更容易审计和展示 |
| frozen 后偏差处理 | A: change proposal 记录 B: 直接解冻 L3 C: 只写 decision | A | 保持 frozen 语义，偏差以显式 proposal 关联 task 与 L3 |
| schema 稳定策略 | A: 第一版即稳定 B: experimental 后稳定 C: 不提供 schema | B | 允许 Phase 1-4 迭代字段，Phase 5 再固定兼容承诺 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/spec-io.ts` | 复用/轻改 | 读取 L3、关联 L2/L1、状态、摘要和正文 | 单元测试 fixture 覆盖 frozen/draft/缺失层级链路 |
| `src/core/decision.ts` | 复用 | 按 topic 或 spec 相关性读取 decision | 单元测试覆盖无 decision 和多 decision |
| `src/core/task.ts` | 修改 | 增加 context/report/verification/change 相关数据读写或适配层 | 单元测试覆盖 step/report/complete 数据落盘 |
| `src/core/harness.ts` | 新增 | task context 构建、report 解析、verification 记录、change proposal 领域逻辑 | 核心单元测试覆盖 happy path 与准入错误 |
| `src/cli/task.ts` | 修改 | 增加 `task context`、`task report`、`task verify` 或等价子命令 | CLI 测试断言 exit code 与输出字段 |
| `src/cli/change.ts` | 新增或修改 | 增加 task-linked change proposal/amendment 命令 | CLI 测试覆盖关联 L3/task |
| `src/core/audit.ts` | 修改 | 校验 implementation task 是否有 step、verification 或未验证原因 | 单元测试覆盖 audit warning |
| `docs/` 或 `README.md` | 修改 | 增加 Codex/OpenCode/CI 集成示例 | 文档 smoke，命令示例与 CLI 保持一致 |
| `schemas/` 或 `src/core/schemas.ts` | 新增 | 定义 experimental/stable JSON schema | schema fixture 测试 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| Task context | `specCode` | string | 新增输出字段 | 无 | 是 |
| Task context | `statusGate` | `{ level, status, allowed }` | 新增输出字段 | 无 | 是 |
| Task context | `objectives` | string[] | 新增输出字段 | `[]` | 是 |
| Task context | `nonGoals` | string[] | 新增输出字段 | `[]` | 是 |
| Task context | `acceptanceCriteria` | string[] | 新增输出字段 | `[]` | 是 |
| Task context | `decisions` | `{ code?, title, summary }[]` | 新增输出字段 | `[]` | 是 |
| Task context | `suggestedVerification` | string[] | 新增输出字段 | `[]` | 是 |
| Task step report | `summary` | string | 新增输入字段 | 必填 | 是 |
| Task step report | `files` | string[] | 新增可选字段 | `[]` | 是 |
| Task step report | `tests` | string[] | 新增可选字段 | `[]` | 是 |
| Task step report | `risks` | string[] | 新增可选字段 | `[]` | 是 |
| Verification result | `command` | string | 新增字段 | 必填 | 是 |
| Verification result | `exitCode` | number | 新增字段 | 必填 | 是 |
| Verification result | `summary` | string | 新增字段 | 必填 | 是 |
| Verification result | `artifacts` | string[] | 新增字段 | `[]` | 是 |
| Verification result | `coversAc` | string[] | 新增字段 | `[]` | 是 |
| Change proposal | `taskCode` | string | 新增字段 | 必填 | 是 |
| Change proposal | `specCode` | string | 新增字段 | 必填 | 是 |
| Change proposal | `reason` | string | 新增字段 | 必填 | 是 |
| Change proposal | `impact` | string | 新增字段 | 必填 | 是 |

## 接口契约

### CLI: `spec-manager task context <l3-code>`

**请求**:

```bash
spec-manager task context harness-coding-L3.1.1-context
spec-manager task context harness-coding-L3.1.1-context --format json
```

**成功输出(text)**:

```text
Task Context: harness-coding-L3.1.1-context
Status Gate: L3 frozen, implementation allowed

Objectives:
- ...

Acceptance Criteria:
- AC-1 ...

Decisions:
- ...

Suggested Verification:
- pnpm test

Next:
spec-manager task create --from harness-coding-L3.1.1-context
```

**成功输出(json experimental)**:

```json
{
  "schemaVersion": "harness-context.experimental.v1",
  "specCode": "harness-coding-L3.1.1-context",
  "statusGate": { "level": "L3", "status": "frozen", "allowed": true },
  "objectives": [],
  "nonGoals": [],
  "acceptanceCriteria": [],
  "decisions": [],
  "suggestedVerification": [],
  "nextCommands": []
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 1 | PROJECT_NOT_INITIALIZED | 项目未初始化 |
| 2 | SPEC_NOT_FOUND | L3 code 不存在 |
| 2 | SPEC_NOT_L3 | 输入 spec 不是 L3 |
| 2 | L3_NOT_FROZEN | L3 不是 frozen 或 implemented |
| 2 | INVALID_FORMAT | `--format` 不是 `text` 或 `json` |

### CLI: `spec-manager task report <task-code>`

**请求**:

```bash
spec-manager task report TASK-001 --summary "Implemented context builder" --files src/core/harness.ts --tests "pnpm test"
spec-manager task report TASK-001 --input report.json
```

**输入 JSON**:

```json
{
  "summary": "Implemented context builder",
  "files": ["src/core/harness.ts"],
  "tests": ["pnpm test"],
  "risks": []
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 2 | TASK_NOT_FOUND | task code 不存在 |
| 2 | INVALID_REPORT | 缺少 summary 或字段类型错误 |

### CLI: `spec-manager task verify <task-code>`

**请求**:

```bash
spec-manager task verify TASK-001 --command "pnpm test" --exit-code 0 --summary "All tests passed"
spec-manager task verify TASK-001 --input verification.json
```

**输入 JSON**:

```json
{
  "command": "pnpm test",
  "exitCode": 0,
  "summary": "All tests passed",
  "artifacts": [],
  "coversAc": ["AC-1", "AC-2"]
}
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 2 | TASK_NOT_FOUND | task code 不存在 |
| 2 | INVALID_VERIFICATION | command、exitCode 或 summary 缺失 |

### CLI: `spec-manager change propose`

**请求**:

```bash
spec-manager change propose --task TASK-001 --spec harness-coding-L3.1.1-context --reason "Existing task model lacks verification field" --impact "Need to extend task output JSON"
```

**成功输出**: 创建 draft change proposal，并提示用户确认是 amend L3、记录 decision，还是拆后续任务。

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 2 | TASK_NOT_FOUND | task code 不存在 |
| 2 | SPEC_NOT_FOUND | spec code 不存在 |
| 2 | INVALID_CHANGE | reason 或 impact 为空 |

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| L3 正文无法提取 AC | context 缺少验收标准 | 输出空数组和 warning，不阻断 json 输出 | 用户补全 L3 正文 |
| topic 无 decision | context 缺少决策 | 输出空 decisions | 后续新增 decision |
| report JSON 字段超出 schema | harness 可能传入额外数据 | 保留已知字段，unknown fields 初期忽略并 warning | Phase 5 稳定 schema 后决定是否 strict |
| verification exitCode 非 0 | 验证失败 | 记录失败结果，不自动 complete task | harness 修复后再次提交 verification |
| change proposal 未处理 | 实现可能停滞 | task context 和 audit 提示 unresolved change | 用户确认 amend/decision/follow-up |

## 向后兼容

- **CLI**: 现有 `task create/start/step/complete` 行为保持；新增命令不改变现有参数语义。
- **数据**: 现有 task 文件必须继续可读；新增 report/verification/change 字段均为可选扩展。
- **状态流**: L1/L2 `draft -> confirmed`、L3 `draft -> frozen` 规则保持；task context 只强化准入检查。
- **输出**: text 为默认输出；JSON 输出在 Phase 1-4 标记为 experimental。
- **依赖**: 不新增运行时网络依赖；schema 校验优先使用项目已有校验方式或轻量本地实现。

## 关键交互流程

### frozen L3 到 task context

```
用户/agent → task context <l3-code>
  │
  ├─ 读取 L3 并校验 level/status
  ├─ 读取关联 L2/L1 摘要
  ├─ 读取 topic/spec 相关 decisions
  ├─ 提取目标、非目标、AC、验证建议
  └─ 输出 text/json context + next command
```

### coding harness 执行回写

```
coding harness → task report <task-code>
  │
  ├─ 校验 task 存在且未完成
  ├─ 解析 summary/files/tests/risks
  ├─ 写入 task step
  └─ 返回下一步验证或 complete 提示
```

### verification 记录

```
coding harness → task verify <task-code>
  │
  ├─ 校验 verification payload
  ├─ 写入 task evidence
  ├─ 若 exitCode != 0，提示保持 task active
  └─ 若 exitCode == 0，提示可 complete
```

### frozen 后变更闭环

```
coding harness 发现冲突
  │
  └─ change propose --task --spec --reason --impact
      │
      ├─ 关联 task + L3
      ├─ 标记 unresolved
      └─ 提示用户选择 amend L3 / decision / follow-up task
```

## 可观测性

- **日志**: CLI 输出 status gate、context 字段缺失 warning、report/verification 写入位置、unresolved change 提示。
- **指标**: 不新增 telemetry；本地 audit 可统计 task context 使用、verification 覆盖、unresolved change 数量。
- **告警**: audit 对以下情况输出 warning：implementation task 无 step、无 verification 且无未验证原因、存在 unresolved change proposal。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| spec 读取 | `src/core/spec-io.ts` | `listAllSpecs`、`findSpecByCode` | task context 获取 L3 与关联 spec |
| task 生命周期 | `src/core/task.ts` | `createTask`、`startTask`、`addTaskStep`、`completeTask` | report/verification 复用 task 记录边界 |
| decision 查询 | `src/core/decision.ts` | decision list/read 相关函数 | context 注入相关 decision |
| spec 校验 | `src/core/validate.ts` | level/status/section 校验逻辑 | context status gate 和 AC 提取辅助 |
| 路径解析 | `src/core/paths.ts` | `getPaths`、`ProjectPaths` | 定位 spec/task/change/audit 数据 |
| CLI 注册 | `src/cli/index.ts` | register 调用 | 注册 task/change 新命令 |
| audit 数据 | `src/core/audit.ts` | audit 读写或生成逻辑 | verification/change 覆盖检查 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `harness-coding-L3.1.1-context` | 实现 `task context <l3-code>` text/json 输出、L3 frozen 准入、关联 spec/decision/AC 汇总 | L2 confirmed |
| `harness-coding-L3.1.2-report` | 实现 `task report <task-code>`，支持 CLI 参数和 JSON input 回写 task step | L3.1.1 frozen/implemented |
| `harness-coding-L3.1.3-verification` | 实现 `task verify <task-code>`，结构化记录 command/exitCode/summary/artifacts/coversAc，并接入 audit warning | L3.1.2 frozen/implemented |
| `harness-coding-L3.1.4-change` | 实现 `change propose`，关联 task 与 L3，记录 unresolved/resolved change proposal | L3.1.2 frozen/implemented |
| `harness-coding-L3.1.5-schema-docs` | 稳定 JSON schema，补充 Codex/OpenCode/CI 集成示例和 smoke | L3.1.1-L3.1.4 implemented |

## 关联

- 父级: `harness-coding-L1`
- 复用: `spec-manager-ai-ux-L3.1.4-batch` 的 task 批量操作经验
- 复用: `workflow-hardening-L3.1.3-tools` 的多工具入口规则
