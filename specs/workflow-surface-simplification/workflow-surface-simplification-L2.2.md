---
code: workflow-surface-simplification-L2.2
level: L2
title: External Specs Store and Working Context Design
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L1
status: implemented
aiSummary: >-
  设计 external specs root/store 与 working context：区分 execution root、write
  root、read-only context source，定义 root resolution 优先级、诊断、context JSON 和后续 L3
  拆分；保持单仓库行为兼容。
relations:
  - type: based_on
    target: workflow-surface-simplification-L1
created: '2026-07-15T03:19:53.682Z'
updated: '2026-07-15T05:22:17.534Z'
changeSummary: 'cascade: task-complete'
---
# External Specs Store and Working Context Design

## 背景

`workflow-surface-simplification-L1` 明确提出：spec-manager 的 specs 不应只服务单个代码仓库，而应支持一个项目群、产品线或团队级规划根来管理整体 specs。当前实现主要通过当前工作目录向上查找 `.spec-manager/`，并把 `specs/`、`changes/`、`archive/` 绑定在同一个项目根下。这对单仓库项目简单可靠，但在多代码仓库协作中会产生几个问题：

- 代码仓库 A 和代码仓库 B 无法自然共享同一个规格事实源。
- Agent 在子仓库执行时不容易知道应该写入哪个 specs 根。
- 只读读取其它规划上下文和写入当前规划根之间没有明确边界。
- root 解析错误时，用户只看到“找不到/未初始化”，缺少可执行修复建议。

OpenSpec 的 store/reference/working set 思路说明了一个方向：让规划根成为一等对象，同时让 code repo 可以指向它。本设计将这个思路翻译为 spec-manager 的本地文件、强门禁和无网络约束模型。

## 目标

- 支持外部 specs root/store，使一个规划根可以服务多个代码仓库。
- 明确 write root 与 read-only context source 的边界，避免 Agent 把规格写到错误位置。
- 为 Agent 提供 working context JSON，包含当前代码仓库、写入根、只读上下文源和下一步建议。
- 增强 root resolution 诊断，遇到未初始化、歧义或指针错误时输出可执行修复建议。
- 保持现有单仓库 `.spec-manager/` 行为兼容。

## 范围边界

本设计覆盖配置模型、root resolution 策略、只读上下文源、working context projection 和 CLI 入口设计。它不要求在本阶段迁移现有 specs，不改变 spec/task/decision 文件格式，不引入远端服务、数据库或 MCP。

本设计只定义本地路径能力。跨机器共享仍由 git 或用户自己的文件同步完成。

## 方案概述

引入“spec store”作为 specs 写入事实源。一个代码仓库可以有自己的 `.spec-manager/`，也可以在 `.spec-manager/config.yaml` 中声明外部 `specStore` 指针。

推荐模型：

```yaml
project_name: app-repo
specStore:
  id: product-planning
  path: ../product-specs
  mode: write
contextSources:
  - id: platform-specs
    path: ../platform-specs
    mode: read
```

语义：

- `specStore.path` 是写入根，里面必须有 `.spec-manager/` 和 `specs/`。
- `contextSources` 是只读上下文源，可用于 search/brief/context，但不得用于写 spec/task。
- 未配置 `specStore` 时，保持当前项目根为写入根。
- 显式 `--store <id|path>` 可覆盖默认写入根，但必须在命令输出中展示 resolved write root。

## 技术决策

- root resolution 必须分成两层：execution root 和 specs write root。execution root 是当前代码仓库；write root 是 spec-manager 文件写入位置。
- `getPaths()` 的现有行为保持兼容。外部 store 能力应通过新的 resolver/facade 引入，避免破坏已有调用者。
- 只读 context source 只进入 brief/context/dashboard projection，不参与 create/update/confirm/task write。
- 对写命令，CLI 必须能够输出或在 JSON 中暴露 `writeRoot`，降低 Agent 写错位置的风险。
- 配置解析应宽容读取、严格写入：未知字段给 warning，非法 path/mode 给 actionable error。
- 所有路径必须解析为本地路径，并使用现有 `resolveWithin`/安全路径策略的等价保护，防止路径越界写入。

## 受影响模块

- `src/core/paths.ts`: 保留现有 `getPaths`，新增 store-aware resolver 或类型。
- `src/core/project-config.ts` 或新增 `src/core/spec-store.ts`: 读取/验证 `specStore` 与 `contextSources`。
- `src/core/workflow-surface.ts`: projection 可增加 execution root / write root / context source 字段。
- `src/cli/project.ts`: 增加 store 诊断或配置命令。
- `src/cli/usability.ts`: `next`、`dashboard`、`brief` 可显示 resolved write root。
- `src/cli/spec.ts`、`src/cli/task.ts`、`src/cli/decision.ts`: 后续实现中逐步接入 write root。
- `templates/agents/*`: 后续 guidance 应提示 Agent 确认 write root。
- README/docs: 后续文档说明多仓库 specs 管理方式。

## 接口契约

建议分阶段 CLI：

```bash
spec-manager project store show
spec-manager project store doctor
spec-manager project context --json
```

后续可选：

```bash
spec-manager project store set --id product-planning --path ../product-specs
spec-manager next "work" --store product-planning
```

`project context --json` 建议输出：

```json
{
  "executionRoot": "/repo/app",
  "writeRoot": "/repo/product-specs",
  "store": {
    "id": "product-planning",
    "path": "/repo/product-specs",
    "mode": "write"
  },
  "contextSources": [
    {
      "id": "platform-specs",
      "path": "/repo/platform-specs",
      "mode": "read",
      "healthy": true
    }
  ],
  "warnings": [],
  "nextAction": "spec-manager next \"<work>\""
}
```

所有 JSON 输出必须是单个对象，方便 Agent 读取。

## Root Resolution 策略

优先级建议：

1. 显式 `--store <id|path>`。
2. 环境变量 `SPEC_MANAGER_ROOT`，保持兼容。
3. 当前 execution root 的 `.spec-manager/config.yaml` 中 `specStore.path`。
4. 向上查找最近 `.spec-manager/`，保持现有行为。
5. 找不到时使用 cwd 作为未初始化 root，并输出 init 建议。

诊断要求：

- 指针路径不存在：提示 `spec-manager project init --root <path>` 或修正 config。
- 指针路径存在但未初始化：提示在该路径初始化。
- store id 不存在：列出可用 id。
- write root 与 execution root 不一致：明确显示两个路径。
- context source 异常：warning，不阻止当前 write root 操作，除非命令显式要求该 source。

## L3 裂变计划

- L3.2.1: Spec Store Config and Resolver
- L3.2.2: Project Context and Store Doctor CLI
- L3.2.3: Workflow Surface Write Root Projection
- L3.2.4: Store-aware Spec/Task Write Commands
- L3.2.5: Docs and Agent Guidance for Multi-repo Specs

## 验收标准

1. **AC-1**: 设计 MUST 保持现有单仓库 `.spec-manager/` 行为兼容。
2. **AC-2**: 设计 MUST 明确 execution root、write root 和 read-only context source 的区别。
3. **AC-3**: root resolution MUST 有明确优先级和可执行诊断建议。
4. **AC-4**: context JSON MUST 暴露 write root 和 context sources，且为单个 JSON 对象。
5. **AC-5**: 只读 context source MUST NOT 被写命令用于 spec/task/decision 写入。
6. **AC-6**: 设计 MUST 不声明 external specs store 已经实现，只作为后续 L3 实施计划。
7. **AC-7**: 后续实现 MUST 通过测试证明单仓库兼容和外部 store 写入边界。

## 风险

- 多 root 模型会增加心智复杂度；因此输出必须明确“当前写到哪里”。
- 若过早改造 `getPaths()`，可能影响大量现有命令；应先新增 resolver/facade，再逐步接入。
- `--store` 如果既接受 id 又接受 path，错误提示必须足够清楚。
- 只读上下文源如果和写入根混用，会破坏事实源边界，必须在类型和测试中体现。
