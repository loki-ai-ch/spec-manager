---
code: workflow-hardening-L2.1
level: L2
title: 技术方案：流程硬化与全工具兼容
topic: workflow-hardening
parentCode: workflow-hardening-L1
status: implemented
created: '2026-06-06T02:55:16.812Z'
updated: '2026-06-08T03:32:03.971Z'
aiSummary: >-
  技术方案拆为三条 L3：CLI 校验硬化(validate-plan
  --from-spec/placeholder/coveredSpecs)、流程提示展示修正(guide 分层/upstream 提示/task
  show)、多工具入口统一(Claude/Codex/OpenCode/CodeBuddy/Cursor/Windsurf)
changeSummary: 'cascade: task complete'
---
# 技术方案：流程硬化与全工具兼容 — 技术设计

## 方案概述

本方案把 `workflow-hardening-L1` 拆成 3 个可独立实施的模块：CLI 流程校验硬化、流程提示与展示修正、多工具入口规则统一。CLI 是规则真相；agent/工具模板只表达 CLI 的真实约束，并通过测试防止漂移。

```
[L3 markdown] ──extract planJson──┐
[spec content] ──placeholder check├─> [validate/spec/task CLI]
[plan file] ──coveredSpecs check──┘

[spec status tree] ──upstream status advice──> [guide/spec freeze/task create]
[task steps] ──shown/total counts────────────> [task show]

[workflow capsule] ──render/sync──> Claude / Codex / OpenCode / CodeBuddy / Cursor / Windsurf
```

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| L3 planJson 校验入口 | A: `spec validate-plan --from-spec <code>` B: 新命令 `spec validate-spec-plan` C: 只支持 JSON 文件 | A | 复用现有命令语义，减少新命令数量，直接覆盖复盘误用场景 |
| markdown planJson 抽取方式 | A: 解析 `## planJson (final)` 后第一个 JSON fenced block B: 正则找任意 JSON C: 要求独立文件 | A | 与 L3 模板结构绑定，避免误抽 step_report 模板或其他 JSON |
| placeholder 校验级别 | A: `spec validate` warning-only B: 直接 fail C: 只在 confirm/freeze fail | A | 保持 validate 现有 warning-only 契约，confirm/freeze 已由 R22 保护 |
| `coveredSpecs` 规则 | A: 永远必填且包含当前 L3 B: 单 L3 可省略 C: task create 自动补齐 | A | 与当前 R12 强校验一致，模板不能诱导 agent 省略 |
| guide doctor 分层 | A: blocking 仅限初始化/配置/audit fail，agent asset 作为 advisory B: 所有 warn/fail 阻断 C: 完全不跑 doctor | A | 保留安全检查，同时不让非关键 agent 安装状态阻断 spec 下一步 |
| 上游状态提示位置 | A: `suggestAfterSpecCommand` 和 L3 freeze/task create 输出 B: 只在 complete skipped 输出 C: 只写文档 | A | 在用户作出冻结/执行决策前暴露级联影响 |
| 多工具一致性 | A: 统一 capsule 文案 + 模板包含性测试 B: 每个模板手工维护 C: 只更新 AGENTS.md | A | 降低 Claude/Codex/OpenCode/CodeBuddy/Cursor/Windsurf 文案漂移风险 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/validate.ts` | 修改 | 导出 `extractPlanJsonFromSpecContent`、新增 placeholder warning、复用 `validatePlanJson` | 单元测试覆盖 L3 markdown 抽取、无 plan、placeholder |
| `src/cli/spec.ts` | 修改 | `validate-plan` 增加 `--from-spec <code>`；`validate` 输出 placeholder warning；freeze 输出上游状态提示 | CLI 测试覆盖 file/from-spec 两种路径 |
| `src/core/task.ts` | 修改 | `createTask` 的 R12 错误消息增加修复示例；`showTask` 返回 `shownSteps`/`totalSteps` | core task 测试覆盖缺 `coveredSpecs` 与 show 截断 |
| `src/cli/task.ts` | 修改 | `task show` 文案改为 shown/total；`task create` 输出上游状态 advisory | CLI 或 core+输出测试 |
| `src/core/usability.ts` | 修改 | guide blocking/advisory 分层；`suggestAfterSpecCommand` 附加上游 frozen 提示 | usability 测试覆盖 agent warning 不阻断和 L3 upstream advice |
| `templates/L3-impl.md` | 修改 | planJson 示例改为 `coveredSpecs` 必填且必须包含当前 L3 | 模板包含性测试 |
| `templates/agent-plan.json` | 修改 | constraints 说明 `coveredSpecs` 必填 | 模板包含性测试 |
| `skill/SKILL.md` | 修改 | 全局硬规则增加 coveredSpecs、validate-plan from-spec、task show/step 说明 | 模板包含性测试 |
| `templates/agents/AGENTS.md` | 修改 | Codex/OpenCode capsule 同步统一规则 | 模板包含性测试 |
| `templates/agents/CLAUDE.md` | 修改 | Claude 项目入口同步统一规则 | 模板包含性测试 |
| `templates/agents/CODEBUDDY.md` | 修改 | CodeBuddy 项目入口同步统一规则 | 模板包含性测试 |
| `templates/agents/codebuddy-skill/SKILL.md` | 修改 | CodeBuddy skill 同步统一规则 | 模板包含性测试 |
| `src/core/agents.ts` | 修改 | provider 元数据可扩展 Cursor/Windsurf 规则文件 | 单元测试覆盖 provider list/安装 dry-run |
| `templates/agents/CURSOR.md`、`templates/agents/WINDSURF.md` 或等价规则文件 | 新增 | 提供 Cursor/Windsurf 兼容入口 | 模板包含性测试 |

## 数据模型

| 实体 | 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|---|
| PlanJson | `coveredSpecs` | string[] | 从事实必填变为模板明确必填 | 无 | CLI 已强制，模板同步 |
| ValidationWarning | `rule` | string | 新增 `placeholder_marker`、`plan_json_missing` 可选规则 | 无 | 是 |
| ShowTaskResult | `shownSteps` | number | 新增 | `steps.length` | 是 |
| ShowTaskResult | `totalSteps` | number | 新增 | 全量 task steps 数 | 是 |
| DoctorCheck | `blocking` | boolean | 可选新增，用于 guide 分层 | `status === fail` | 是 |
| AgentProvider | cursor/windsurf | enum value | 可选新增 | 无 | 仅新增 provider |

## 接口契约

### CLI: `spec-manager spec validate-plan`

**请求**:
```bash
spec-manager spec validate-plan ./plan.json
spec-manager spec validate-plan --from-spec workflow-hardening-L3.1.1-cli
```

**成功输出**:
```text
✓ planJson 校验通过
```

**错误响应**:

| 状态码 | 错误码 | 触发条件 |
|---|---|---|
| 1 | SPEC_NOT_FOUND | `--from-spec` 指向不存在的 spec |
| 2 | PLAN_JSON_MISSING | L3 markdown 中没有 `## planJson (final)` JSON fenced block |
| 2 | PLAN_JSON_INVALID | JSON 解析失败或 `validatePlanJson` 不通过 |

### CLI: `spec-manager spec validate <code>`

**新增行为**: 正文包含 `<!-- 在此粘贴正文 -->` 时输出：

```text
⚠ [placeholder_marker] contentTemplate 仍包含占位标记，请使用 spec-manager spec update <code> --content <file> --ai-summary "..."
```

### CLI: `spec-manager task create <specCode> --plan <file>`

**新增错误示例**:
```text
R12: planJson.coveredSpecs 必须包含当前 L3 specCode (workflow-hardening-L3.1.1-cli)
Example:
{
  "coveredSpecs": ["workflow-hardening-L3.1.1-cli"],
  "steps": [...]
}
```

### CLI: `spec-manager task show <taskId>`

**成功输出**:
```text
steps:
  shownSteps: 5
  totalSteps: 8
  truncated: true
```

### CLI: `spec-manager guide <request>`

**新增行为**: 非关键 doctor warning 进入 advisory，不覆盖 request 的 `Next:`。关键初始化失败仍输出初始化 next。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| L3 markdown 有多个 JSON block | 可能抽错 planJson | 只抽 `## planJson (final)` 段之后第一个 JSON fenced block | 调整 L3 markdown |
| planJson fenced block 非 JSON | validate-plan 失败 | 输出 parse error 和 from-spec code | 修正 JSON |
| 旧 task JSON 没有 steps | totalSteps 计算缺数据 | fallback 到 spec frontmatter steps | 重新创建 task 或补 steps |
| Cursor/Windsurf 规则文件路径随工具变化 | 安装位置不匹配用户环境 | 先提供标准 `.cursorrules`、`.windsurfrules` 模板；后续 provider 扩展 | 显式 provider 或手工移动 |

## 向后兼容

- **CLI**: `spec validate-plan <file>` 原行为保留；`--from-spec` 是新增入口。
- **Spec**: 不改 frontmatter schema；placeholder 检查 warning-only。
- **Task**: task JSON 结构不变；`showTask` 返回新增字段，不删除原 steps。
- **Agent templates**: 更新现有模板文案，不改变已安装项目文件；用户需重新执行 `project agents --force` 才覆盖。

## 关键交互流程

### validate-plan from spec

```
用户 → spec validate-plan --from-spec <L3>
  ├─ findSpecByCode
  ├─ locate "## planJson (final)"
  ├─ extract first ```json block
  ├─ JSON.parse
  └─ validatePlanJson
```

### guide 分层

```
用户 → guide <request>
  ├─ runProjectDoctor
  ├─ blocking fail? 输出修复命令并停止
  ├─ advisory warn? 保留为 notes
  └─ 输出 request nextAction + advisory
```

### 工具模板同步

```
统一规则清单
  ├─ skill/SKILL.md
  ├─ templates/agents/AGENTS.md
  ├─ templates/agents/CLAUDE.md
  ├─ templates/agents/CODEBUDDY.md
  ├─ templates/agents/codebuddy-skill/SKILL.md
  ├─ templates/agents/CURSOR.md
  └─ templates/agents/WINDSURF.md
```

## 可观测性

- **日志**: CLI 错误输出包含 rule id、spec code、修复示例。
- **指标**: 无 telemetry；测试统计模板覆盖和 CLI 输出。
- **告警**: `project doctor` 保持显式输出 fail/warn，但 guide 只将关键 fail 作为 blocking。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| spec 读取 | `src/core/spec-io.ts` | `findSpecByCode`、`isPlaceholderContent` | from-spec、placeholder 检查 |
| plan 校验 | `src/core/validate.ts` | `validatePlanJson`、`validateSpecContent` | 复用现有校验入口 |
| task 创建 | `src/core/task.ts` | `createTask` | R12 错误消息增强 |
| task 展示 | `src/core/task.ts` | `showTask` | shown/total 计数 |
| flow 建议 | `src/core/usability.ts` | `suggestAfterSpecCommand`、`runProjectDoctor` | upstream advice 和 guide 分层 |
| provider 元数据 | `src/core/agents.ts` | `AGENT_PROVIDER_INFO` | Cursor/Windsurf 兼容入口 |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| `workflow-hardening-L3.1.1-cli` | `validate-plan --from-spec`、placeholder validate、coveredSpecs 模板/错误消息统一 | 无 |
| `workflow-hardening-L3.1.2-hints` | guide blocking/advisory 分层、upstream frozen 提示、task show shown/total 文案 | L3.1.1 implemented |
| `workflow-hardening-L3.1.3-tools` | Claude/Codex/OpenCode/CodeBuddy/Cursor/Windsurf 入口规则统一与模板测试 | L3.1.1 implemented |

## 关联

- 父 L1: `workflow-hardening-L1`（流程硬化与全工具兼容需求）
