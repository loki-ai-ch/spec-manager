---
code: adaptive-evidence-workflow-L3.1.1-profile
level: L3
title: 项目 Profile 准入与 Task 快照
topic: adaptive-evidence-workflow
parentCode: adaptive-evidence-workflow-L2.1
status: implemented
aiSummary: >-
  实施 adaptive workflow 项目配置、project workflow CLI、Task Profile 不可变快照、L3 关键 AC 解析和
  governed Task 创建准入，并同步 Harness Context 与多 Agent 方法论资产。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取源码并确认 Profile 配置、Task 创建和测试基线
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增共享项目工作流配置能力与公开导出
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 增加 project workflow CLI 与 doctor 配置检查
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 增加验收标准与关键 AC 解析校验
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 扩展 Task Profile 数据模型与 governed 创建准入
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 扩展 task create CLI 与 Harness Context
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 同步模板、方法论、Agent 入口与契约测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 验证 Profile 创建矩阵、全量测试、lint、build、installed CLI 和 project doctor
    status: pending
created: '2026-06-15T10:07:32.497Z'
updated: '2026-06-16T01:09:47.648Z'
changeSummary: 'cascade: task-complete'
---
# 项目 Profile 准入与 Task 快照 — 实施规格

## 目标

实施 `adaptive-evidence-workflow-L2.1` 的第一个模块边界：增加 adaptive workflow 项目配置、Task Profile 不可变快照、L3 关键 AC 解析与 governed Task 创建准入，为后续 Evidence 投影和完成门禁提供稳定事实源。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集与基线确认

- 读取 `adaptive-evidence-workflow-L3.1.1-profile`、父 `adaptive-evidence-workflow-L2.1` 与 `templates/agent-plan.json`。
- Read `src/cli/project.ts`，确认 config 初始化、项目子命令注册和 YAML 写入现状。
- Read `src/core/usability.ts`，确认 config.yaml 解析和 doctor check 模式。
- Read `src/core/task.ts`，确认 `TaskRecord`、`CreateTaskInput`、`createTask()` 和 Task JSON 写入边界。
- Read `src/core/spec-sections.ts`，确认 Markdown 段解析边界。
- Read `src/cli/task.ts`，确认 `task create` 参数和输出行为。
- Read `src/core/__tests__/project-fixture.ts`、`src/core/__tests__/usability.test.ts`、`src/core/__tests__/task-cascade.test.ts`、`src/cli/__tests__/task.test.ts`，确认 fixture 与断言模式。
- 运行现有测试和 lint，记录实施前基线。

### Step 2 — 新增共享项目工作流配置能力

- 新增 `src/core/workflow-profile.ts`，定义并导出：
  - `WorkflowProfile = 'legacy' | 'standard' | 'governed'`
  - `TaskWorkflowProfile = 'standard' | 'governed'`
  - `AdaptiveWorkflowConfig`
  - `readAdaptiveWorkflowConfig(paths)`
  - `writeAdaptiveWorkflowConfig(paths, config)`
  - `resolveTaskWorkflowProfile(paths, explicitProfile?, overrideReason?)`
- `readAdaptiveWorkflowConfig()` SHALL 将缺失 `adaptiveWorkflow` 解析为 `{ enabled: false, defaultProfile: 'standard' }`。
- 非法 `enabled` 或 `defaultProfile` SHALL 抛出以 `INVALID_ADAPTIVE_WORKFLOW_CONFIG:` 开头的错误。
- `writeAdaptiveWorkflowConfig()` SHALL 使用 YAML 结构化解析和序列化保留已有配置字段，不得用字符串拼接覆盖 `project_name`、`specWorkflow`、`rulesAppliesTo` 或 `context`。
- `resolveTaskWorkflowProfile()` SHALL 实现 L2 定义的 legacy/default/explicit/override-reason 决定顺序，并返回 profile、source、reason。
- 从 `src/index.ts` 导出公开类型和函数。

### Step 3 — 增加项目 workflow CLI 与 doctor 检查

- 在 `src/cli/project.ts` 注册：
  - `project workflow show [--json]`
  - `project workflow enable [--default-profile standard|governed]`
  - `project workflow disable`
- `show` SHALL 展示当前 enabled/defaultProfile；未配置时明确显示 legacy compatibility。
- `enable` SHALL 默认使用 `standard`，并拒绝非法枚举。
- `disable` SHALL 仅写项目配置，不修改现有 Task 文件。
- 在 `runProjectDoctor()` 中增加 adaptive workflow 配置有效性检查：
  - 缺失配置为 ok，不产生 warning。
  - 合法启用或禁用配置为 ok。
  - 非法配置为 fail，action 指向修复配置或重新执行 workflow 命令。
- 增加 core 与 CLI 测试，覆盖 show/enable/disable、配置字段保留和非法配置。

### Step 4 — 增加验收标准与关键 AC 解析

- 扩展 `src/core/spec-sections.ts`，新增并导出：
  - `extractAcceptanceCriteria(content)`：返回稳定 AC ID 与完整文本。
  - `extractCriticalAcceptanceCriteria(content)`：读取 `## 关键验收标准` 中的 AC ID，去重并保持声明顺序。
  - `validateCriticalAcceptanceCriteria(content)`：返回合法关键 AC 和未知引用。
- AC ID SHALL 仅匹配 `AC-<正整数>`，并以 `## 验收标准` 中存在的 ID 为合法事实源。
- 解析函数 SHALL 支持现有 `1. **AC-1**: ...` 和 `1. AC-1 ...` 格式，不得把 `@verify` 行识别为 AC。
- 扩展 `validateSpecContent()`：L3 存在未知关键 AC 引用时产生 warning；非 L3 的关键 AC 段产生 warning；不改变现有 confirm/freeze 门禁语义。
- 增加解析和 validate 单元测试。

### Step 5 — 扩展 Task Profile 数据模型与创建准入

- 扩展 `TaskRecord` 可选字段：
  - `profile?: 'legacy' | 'standard' | 'governed'`
  - `profileSource?: 'project-default' | 'explicit' | 'legacy'`
  - `profileOverrideReason?: string | null`
- 扩展 `CreateTaskInput`，允许可选 `profile` 和 `profileOverrideReason`。
- 修改 `createTask()`：
  - 在写 Task 前调用 `resolveTaskWorkflowProfile()`。
  - 未启用项目且未传 Profile 时写入 `legacy/legacy/null`，保持现有完成语义。
  - 未启用项目显式传 Profile 时抛出 `ADAPTIVE_WORKFLOW_DISABLED`。
  - 显式值覆盖项目默认值且缺少理由时抛出 `PROFILE_OVERRIDE_REASON_REQUIRED`。
  - governed Profile SHALL 调用关键 AC 校验；没有合法关键 AC 时抛出 `GOVERNED_CRITICAL_AC_REQUIRED`；存在未知引用时抛出 `UNKNOWN_CRITICAL_AC`。
- 已创建 Task 的 Profile 字段不得由 `startTask`、`reportStep`、`addTaskVerification`、`waitTask`、`failTask` 修改。
- 增加 legacy、standard default、governed default、显式相同、显式覆盖、governed 无关键 AC、未知 AC 的创建矩阵测试。

### Step 6 — 扩展 task create CLI 和 Harness Context

- 在 `src/cli/task.ts` 的 `task create` 增加：
  - `--profile <standard|governed>`
  - `--profile-reason <reason>`
- 创建成功文本输出 SHALL 增加最终 Profile 和来源；既有 JSON 顶层结构保持。
- 非法 Profile、禁用状态、缺少覆盖理由和 governed 关键 AC 错误 SHALL 映射为稳定错误输出和非零 exit code，不使用 `process.exit` 绕过已建立的 handler/presenter 边界；如需拆分 create handler，沿用 `src/cli/task-handlers.ts` 模式。
- 扩展 `HarnessTaskContext`，新增可选 `workflowProfile` 与 `criticalAcceptanceCriteria`，保持 `harness-context.experimental.v1` 现有字段语义。
- 增加 CLI 与 Harness 回归测试。

### Step 7 — 同步模板、方法论与 Agent 入口

- 更新 `templates/L3-impl.md`，增加可选 `## 关键验收标准` 说明，并明确 governed L3 至少声明一条。
- 更新 `docs/methodology.md`，加入三档 Profile 边界、显式启用兼容规则和本 L3 当前实现范围；不得宣称 evidence 完成门禁已实现。
- 更新 `skill/SKILL.md`、`templates/agents/` 与项目托管 Agent 资产中的对应工作流规则，明确：
  - quick 不创建完整 Task 链路。
  - adaptive workflow 未启用时保持 legacy。
  - governed Task 创建前 L3 必须声明关键 AC。
- 更新方法论契约测试与 Agent 资产一致性测试。

### Step 8 — 全链路验证与交付收口

- 运行 Profile 配置、关键 AC 解析、Task 创建矩阵、CLI、Harness 和方法论聚焦测试。
- 运行全量测试、lint、build、installed CLI verification 与 project doctor。
- 使用 installed CLI 在临时 fixture 中验证：
  - 未启用项目创建 legacy Task。
  - 启用 standard 后创建 standard Task。
  - governed L3 无关键 AC 时创建失败。
  - governed L3 声明合法关键 AC 后创建成功。
- 检查 git diff，确认未实现 L3.1.2 evidence 投影或完成覆盖门禁。

## 验收标准

1. **AC-1**: 项目缺少 adaptive workflow 配置时，现有 Task 创建路径 SHALL 成功并将 Task 解释为 legacy，不新增完成语义。
2. **AC-2**: 项目显式启用 adaptive workflow 后，Task 创建 SHALL 保存最终 standard 或 governed Profile 及来源。
3. **AC-3**: 用户显式选择不同于项目默认值的 Profile 时，系统 SHALL 要求并保存非空覆盖理由。
4. **AC-4**: governed Task 创建前，L3 SHALL 至少声明一条存在于自身验收标准中的关键 AC；缺失或未知引用 SHALL 阻止创建。
5. **AC-5**: `project workflow show/enable/disable` SHALL 保留 config.yaml 现有字段，并且 disable 不修改已有 Task Profile 快照。
6. **AC-6**: 旧 Task JSON 缺少 Profile 字段时 SHALL 继续可读，并按 legacy 解释。
7. **AC-7**: Harness Context SHALL 在不破坏现有字段的前提下展示可用的 Profile 与关键 AC 信息。
8. **AC-8**: 模板、方法论和已支持 Agent 入口 SHALL 明确 governed 创建准入与 legacy 兼容边界，且不得提前宣称 evidence 完成门禁已交付。

## 关键验收标准

- AC-1
- AC-2
- AC-4
- AC-5
- AC-6

## 验证命令

```bash
# 正向验证：聚焦能力与全量回归
npx vitest run src/core/__tests__/workflow-profile.test.ts src/core/__tests__/task-cascade.test.ts src/core/__tests__/harness.test.ts src/cli/__tests__/task.test.ts src/cli/__tests__/usability.test.ts
npm test
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor

# 反向验证：现有 L3 plan 与正文规则仍可校验
spec-manager spec validate adaptive-evidence-workflow-L3.1.1-profile
spec-manager spec validate-plan --from-spec adaptive-evidence-workflow-L3.1.1-profile
```

预期：

- 聚焦测试与全量测试 exit code 均为 0。
- lint、build、installed CLI verification exit code 均为 0。
- `project doctor` 输出 `Project doctor: ok`。
- Spec validate 输出所有必填段齐全且无 RFC 2119 警告。
- validate-plan 不报告 plan 字段、coveredSpecs 或末步验证错误。

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["adaptive-evidence-workflow-L3.1.1-profile"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取源码并确认 Profile 配置、Task 创建和测试基线"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增共享项目工作流配置能力与公开导出"},
    {"stepNo": 3, "stepType": "tool_action", "name": "增加 project workflow CLI 与 doctor 配置检查"},
    {"stepNo": 4, "stepType": "tool_action", "name": "增加验收标准与关键 AC 解析校验"},
    {"stepNo": 5, "stepType": "tool_action", "name": "扩展 Task Profile 数据模型与 governed 创建准入"},
    {"stepNo": 6, "stepType": "tool_action", "name": "扩展 task create CLI 与 Harness Context"},
    {"stepNo": 7, "stepType": "tool_action", "name": "同步模板、方法论、Agent 入口与契约测试"},
    {"stepNo": 8, "stepType": "tool_action", "name": "验证 Profile 创建矩阵、全量测试、lint、build、installed CLI 和 project doctor"}
  ]
}
```

`autoConfirm=false`。本 L3 涉及项目配置、Task 创建准入与多 Agent 方法论分发，执行步骤不应自动通过人工门禁。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 配置解析或 CLI 导致兼容回归 | 回退 workflow-profile、project workflow 和 doctor 相关变更；未启用项目继续按旧逻辑运行 | < 15 min |
| Task 新字段导致读取问题 | 回退 Task 创建写入与类型扩展；已生成 JSON 的新增可选字段可被旧代码忽略 | < 15 min |
| 关键 AC 解析误判 | 回退新增解析和 governed 创建准入；保留 Spec Markdown 内容不影响旧版本 | < 10 min |
| Agent 资产同步错误 | 回退模板/方法论文档并重新执行托管资产同步 | < 15 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| YAML 序列化改变用户配置格式或丢失字段 | 使用结构化 round-trip 测试验证已知字段与 `context` 多行内容保留；只要求语义保留，不要求注释位置完全不变 |
| Task create 仍位于较厚 CLI action 中 | 只在需要稳定错误映射时拆出 create handler，不扩大到无关 task 命令 |
| L3 AC 格式存在历史变体 | 解析器同时覆盖加粗和非加粗 AC ID，并用现有 Spec fixture 回归 |
| 方法论同步误宣称后续能力 | 文档明确标注 evidence 门禁由 L3.1.2 交付，方法论契约测试锁定边界 |
| 新测试依赖不存在的固定文件名 | 聚焦测试命令允许新增 `workflow-profile.test.ts`；若测试按现有模块合并，实施时同步更新 L3 change proposal 或验证命令说明 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | adaptive-evidence-workflow-L2.1 | 实现 Profile 准入与 Task 快照模块 |
| references | constraint-closed-loop-L3.1.2-hooks | 复用 Task 完成与 Harness 上下文边界 |
| references | lifecycle-guidance-sync-L3.1.2-distribution | 复用 Agent 方法论资产同步约束 |
