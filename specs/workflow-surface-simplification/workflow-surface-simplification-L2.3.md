---
code: workflow-surface-simplification-L2.3
level: L2
title: Setup and UX Profile Design
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L1
status: implemented
aiSummary: >-
  设计第三阶段 setup/onboarding 与 UX profile：用 setup/project setup 收束初始化、agent
  provider、write root、profile 和 next action；定义 uxProfile=core|advanced
  为呈现层能力，不改变 standard/governed task workflow profile。
relations:
  - type: based_on
    target: workflow-surface-simplification-L1
created: '2026-07-15T06:07:38.486Z'
updated: '2026-07-15T06:29:33.874Z'
changeSummary: 'cascade: task-complete'
---
# Setup and UX Profile Design

## 背景

`workflow-surface-simplification-L2.1` 已经把 `next`、`brief`、`dashboard` 建成高频入口，`workflow-surface-simplification-L2.2` 已经把 external specs store、write root 和 context source 闭环到写命令与文档。L1 中仍有两项易用性目标没有独立设计：

- 一站式 setup/onboarding：初始化后给用户和 Agent 一个明确的下一步，而不是散落在 `project init`、`project agents`、`doctor`、README 和 provider 检测之间。
- UX profile：把默认暴露面分成 core/advanced，让新用户优先看到短路径，让熟练用户仍能找到完整治理命令；该 profile 不能与 task workflow 的 `standard/governed` 混淆。

这份 L2 设计第三阶段 workflow surface：不削弱状态机，不隐藏底层命令，只把首次设置和命令呈现方式变得更顺手。

## 目标

- 设计一个 `setup` 或 `project setup` facade，把初始化检查、agent provider 建议、store 诊断、workflow profile 提示和下一步建议放到一个入口。
- 设计 UX profile 配置与输出语义，用于控制 README/agent guidance/CLI dashboard 的 core 或 advanced 呈现。
- 明确 UX profile 与 task workflow profile 的命名边界，避免用户误以为 `core/advanced` 会改变任务门禁。
- 保持现有命令兼容；setup 只组合、提示和建议，不绕过 `spec`、`task`、`decision` 状态机。
- 为 AI Agent 提供稳定 JSON 输出，包含 provider readiness、write root、profile、next action 和 suggested commands。

## 非目标

- 不删除 `project init`、`project agents`、`project doctor`、`next`、`dashboard` 等既有入口。
- 不让 setup 自动创建 L1/L2/L3 或自动确认任何 spec。
- 不改变 task workflow profile 的 `standard/governed` 行为。
- 不引入远程服务、telemetry、MCP 或网络依赖。
- 不做复杂交互式 wizard；优先做可脚本化、可测试的非交互输出。

## 方案概述

新增一个只读优先的 setup projection，推荐命令形态：

```bash
spec-manager setup [--provider <name|all|auto>] [--profile core|advanced] [--json]
```

或在 `project` 命名空间下提供等价入口：

```bash
spec-manager project setup [--provider <name|all|auto>] [--profile core|advanced] [--json]
```

设计倾向：顶层 `setup` 作为用户第一屏推荐入口，`project setup` 作为结构化 alias。实施规格可根据现有 CLI 注册结构决定先实现一个还是两个，但必须避免行为分叉。

setup 输出由以下只读信息组成：

- project initialized 状态。
- execution root / write root / context sources。
- agent provider 检测结果与建议安装命令。
- docs/guidance readiness，例如 README link、agent templates、Design Context 是否存在。
- task workflow profile 状态，仅说明 `standard/governed`，不由 UX profile 改写。
- UX profile 当前值与建议值。
- next action 和 suggested commands。

## 技术决策

- setup projection 必须是只读 core 函数，CLI text/json presenter 只渲染同一个模型。
- 顶层 `setup` 与 `project setup` 如同时提供，必须共享同一 projection 和 presenter，不得产生两个语义版本。
- `uxProfile` 只作为呈现层配置读取和输出，不参与 Task 创建、完成或 verification gate。
- setup 必须复用现有 `resolveSpecStore`、provider detection、workflow profile 读取和 workflow surface next action，不复制第二套 root 或 provider 推断逻辑。
- setup 默认只给建议命令，不写 agent files；未来 `--apply` 需要独立规格。

## UX Profile 设计

UX profile 是“呈现层 profile”，建议命名为 `uxProfile`，取值：

- `core`：默认给新用户和 Agent 的短路径。优先展示 `setup`、`next`、`brief`、`dashboard`、`project context --json`、`task create/start/step/verify/complete`。
- `advanced`：展示完整命令树，包括 `flow status`、`view`、`assist critique/drift/acceptance/delivery`、`project profile metrics`、`readiness critical`、`docs check` 等。

配置建议：

```yaml
uxProfile: core
workflow:
  enabled: true
  defaultProfile: standard
```

命名边界：

- `uxProfile=core|advanced` 只影响提示、排序和文档/JSON projection 的默认显著程度。
- `workflow.defaultProfile=standard|governed` 影响 Agent Task 的证据门禁。
- setup 必须在 text 和 JSON 中明确这两者不同。

## Root 和 Store 集成

setup 必须复用 `resolveSpecStore` / `project context` 的语义：

- 未配置 `specStore` 时，显示单仓库默认写入当前 root。
- 配置 external `specStore.path` 时，显示 execution root 与 write root。
- context source 异常为 warning，write root 异常为 blocking。
- suggested commands 必须优先包含可执行修复，如 `spec-manager project store doctor` 或在目标路径运行 `spec-manager project init`。

setup 不应实现 `--store` override；该能力如果需要，另开 L2/L3。

## Agent Provider 集成

setup 应复用现有 provider detection/install capability：

- 检测已有 `AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md`、`.cursorrules`、`.windsurfrules` 等。
- 根据 `--provider` 或 auto detection 给出 `spec-manager project agents --provider <provider>` 建议。
- `--json` 输出 provider readiness 数组，便于 Agent 判断是否需要写入入口文件。
- setup 默认不直接写 agent files；如未来允许 `--apply`，必须另开 L3 并明确文件覆盖边界。

## 接口契约

`setup --json` 建议输出单个对象：

```json
{
  "schemaVersion": "setup.v1",
  "projectRoot": "/repo/app",
  "initialized": true,
  "executionRoot": "/repo/app",
  "writeRoot": "/repo/product-specs",
  "uxProfile": "core",
  "workflowProfile": {
    "enabled": true,
    "defaultProfile": "standard"
  },
  "providers": [
    {
      "provider": "codex",
      "status": "installed",
      "files": ["AGENTS.md"],
      "suggestedCommand": null
    }
  ],
  "warnings": [],
  "blockingReason": null,
  "nextAction": "spec-manager next \"<work>\"",
  "suggestedCommands": [
    "spec-manager project context --json",
    "spec-manager project agents --provider all",
    "spec-manager dashboard"
  ]
}
```

Text 输出应短而可执行，第一屏包含：

- Project / Root。
- Write root。
- Agent entry status。
- UX profile 与 workflow profile。
- Next command。

## 受影响模块

- `src/core/setup-surface.ts` 或 `src/core/workflow-surface.ts`: setup projection。
- `src/cli/usability.ts` 或 `src/cli/project.ts`: `setup` / `project setup` 命令。
- `src/core/agents.ts`: provider readiness 可复用现有 detect/install report。
- `src/core/spec-store.ts`: write root/context source 诊断复用。
- `src/core/workflow-profile.ts`: 只读读取 task workflow profile。
- `.spec-manager/config.yaml` 读取逻辑：需要容忍 `uxProfile` 字段。
- README、readme_en、agent templates：推荐 setup 作为第一入口。
- 测试：core projection、CLI JSON/text、未初始化、external store、provider detection、profile 命名边界。

## L3 裂变计划

- L3.3.1: Setup Surface Projection
- L3.3.2: Setup CLI and JSON Presenter
- L3.3.3: UX Profile Config and Guidance
- L3.3.4: Setup Documentation and Agent Entry Refresh

## 验收标准

1. **AC-1**: 设计 MUST 提供一个 setup 入口，把初始化状态、agent guidance 建议、write root 和下一步建议收束到一个输出。
2. **AC-2**: setup MUST NOT 自动创建/确认/freeze/complete specs 或 tasks。
3. **AC-3**: `setup --json` MUST 输出单个对象，包含 projectRoot、writeRoot、providers、uxProfile、workflowProfile、nextAction 和 suggestedCommands。
4. **AC-4**: UX profile MUST 明确命名为呈现层能力，不得改变 `standard/governed` task workflow profile。
5. **AC-5**: external `specStore.path` 场景下 setup MUST 显示 execution root 与 write root，并对 write root 错误给出 fix。
6. **AC-6**: provider guidance MUST 给出可复制的 `project agents --provider ...` 建议，但默认不写文件。
7. **AC-7**: 现有 `project init`、`project agents`、`next`、`brief`、`dashboard`、`project doctor` 行为 MUST 保持兼容。

## 风险

- setup 如果承担太多写操作，会变成隐式 wizard，反而不透明。第一版保持只读建议。
- UX profile 容易与 workflow profile 混淆，必须在字段名、README 和输出文案中持续区分。
- 顶层 `setup` 与 `project setup` 双入口可能造成重复；实施时应采用 alias/facade，共用同一 projection。
