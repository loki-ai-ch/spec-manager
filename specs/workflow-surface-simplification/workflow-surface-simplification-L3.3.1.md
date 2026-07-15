---
code: workflow-surface-simplification-L3.3.1
level: L3
title: Setup Surface Projection
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.3
status: implemented
aiSummary: >-
  新增 setup surface 只读 projection：聚合 initialized、execution/write root、store
  diagnostics、provider readiness、uxProfile、workflowProfile 和 next action，为后续
  setup CLI 提供稳定模型。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Survey reusable setup projection modules
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement setup surface projection
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add setup surface core tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted tests lint build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.3
created: '2026-07-15T06:12:26.594Z'
updated: '2026-07-15T06:29:33.868Z'
changeSummary: 'cascade: task-complete'
---
# Setup Surface Projection

## 背景

`workflow-surface-simplification-L2.3` 设计了 setup/onboarding 与 UX profile 的第三阶段方向。第一步应先建立只读 core projection，让 CLI 和文档后续都基于同一个模型输出初始化状态、write root、provider readiness、profile 和 next action。

当前已有能力分散在 `workflow-surface`、`spec-store`、`agents`、`workflow-profile` 和 docs consistency 等模块中。L3.3.1 聚焦 core 层聚合，不新增用户命令，不写任何 spec/task/decision/config。

## 目标

- 新增 setup surface 只读 projection，供后续 `setup` / `project setup` CLI 使用。
- 输出 initialized、executionRoot、writeRoot、contextSources、store diagnostics、provider readiness、uxProfile、workflowProfile、nextAction、suggestedCommands。
- 复用现有 resolver 和 workflow surface 能力，避免第二套 root/profile/provider 推断。
- 在未初始化、local store、external store、broken write root 等场景下给出稳定模型。
- 为 `--json` 输出预先定义 schema version 和字段形状。

## 非目标

- 不新增 CLI 命令。
- 不写 `.spec-manager/config.yaml`，不保存 `uxProfile`。
- 不安装或覆盖 agent files。
- 不实现 `--apply`、`--store`、自动迁移或交互式 wizard。
- 不改变 `standard/governed` task workflow profile 行为。

## 实施步骤

1. 走读现有 `src/core/workflow-surface.ts`、`src/core/spec-store.ts`、`src/core/agents.ts`、`src/core/workflow-profile.ts`，确认可复用函数。
2. 新增 `src/core/setup-surface.ts` 或扩展 `workflow-surface.ts`：
   - 定义 `SetupSurfaceProjection`、`SetupProviderStatus`、`SetupProfileSummary` 类型。
   - 新增 `buildSetupSurface(paths, options)` 只读函数。
3. 集成 store resolution：
   - 暴露 `executionRoot`、`writeRoot`、`writeStore`、`contextSources`。
   - write root error 进入 `blockingReason` 和 `warnings`/`diagnostics`。
4. 集成 provider readiness：
   - 复用 agent provider metadata 和 detection 能力。
   - 输出 provider、status、files、suggestedCommand。
   - 默认不写文件。
5. 集成 profile 信息：
   - 读取 workflow profile enabled/defaultProfile。
   - 读取或默认 `uxProfile` 为 `core`。
   - 文案/字段明确 `uxProfile` 不改变 task workflow gate。
6. 集成 next action：
   - 复用 `buildWorkflowNextAction` 或现有 next projection。
   - 没有 request 时建议 `spec-manager next "<work>"`。
7. 添加 core tests：
   - 未初始化项目 projection。
   - local initialized project projection。
   - external store projection。
   - broken write root projection。
   - provider detection/suggested command。
   - uxProfile 与 workflowProfile 分离。
8. 运行 targeted tests、lint、build。

## 接口契约

建议类型：

```ts
interface SetupSurfaceProjection {
  schemaVersion: 'setup.v1';
  projectRoot: string;
  initialized: boolean;
  executionRoot: string;
  writeRoot: string;
  writeStore: {
    id: string;
    path: string;
    mode: 'write' | 'read';
    exists: boolean;
    initialized: boolean;
  };
  contextSources: Array<{
    id: string;
    path: string;
    mode: 'read' | 'write';
    exists: boolean;
    initialized: boolean;
  }>;
  uxProfile: 'core' | 'advanced';
  workflowProfile: {
    enabled: boolean;
    defaultProfile: 'standard' | 'governed';
  };
  providers: Array<{
    provider: string;
    status: 'installed' | 'available' | 'unknown';
    files: string[];
    suggestedCommand: string | null;
  }>;
  diagnostics: Array<{
    severity: 'warning' | 'error';
    code: string;
    message: string;
    fix?: string;
  }>;
  blockingReason: string | null;
  nextAction: string;
  suggestedCommands: string[];
}
```

字段要求：

- JSON projection 必须是单个对象，无 stdout 混杂。
- `projectRoot` 和 `executionRoot` 初期可以相同，但字段都必须存在。
- `writeRoot` 必须来自 `resolveSpecStore`。
- `uxProfile` 默认 `core`。
- `workflowProfile.defaultProfile` 必须来自现有 workflow profile 读取逻辑或默认值。
- broken write root 必须产生 `blockingReason` 和至少一条 error diagnostic。

## 验收标准

1. **AC-1**: `buildSetupSurface` MUST 是只读函数，不写文件、不修改 audit、不安装 agent files。
2. **AC-2**: projection MUST 包含 `schemaVersion`、`projectRoot`、`executionRoot`、`writeRoot`、`providers`、`uxProfile`、`workflowProfile`、`nextAction`、`suggestedCommands`。
3. **AC-3**: 未配置 `specStore` 时 projection MUST 保持 local write root 兼容。
4. **AC-4**: 配置 external `specStore.path` 时 projection MUST 显示 external write root 和 context sources。
5. **AC-5**: broken write root MUST 产生 error diagnostic、blockingReason 和修复建议。
6. **AC-6**: provider readiness MUST 给出可复制的 `spec-manager project agents --provider ...` 建议，但不写文件。
7. **AC-7**: `uxProfile` MUST 与 `workflowProfile.defaultProfile` 分离，并通过测试证明不会把 core/advanced 当成 standard/governed。
8. **AC-8**: targeted tests、lint、build MUST 通过。

## 验证命令

```bash
npm test -- src/core/__tests__/setup-surface.test.ts src/core/__tests__/workflow-surface.test.ts src/core/__tests__/spec-store.test.ts
npm run lint
npm run build
```

如实施时复用其它测试文件名，应选择覆盖 setup projection、workflow surface 和 spec store 的实际测试集合。

## 风险与回滚

- 风险：setup projection 复制已有 next/store/provider 逻辑会造成长期分叉；实现必须优先调用现有函数。
- 风险：provider detection 如依赖真实文件系统模板，会使测试脆弱；测试应使用临时项目和明确文件。
- 风险：broken store 如果直接 throw，会破坏 setup 作为诊断入口的价值；projection 应返回 diagnostic，而不是抛出。
- 回滚：删除 setup-surface 模块和测试，不影响已有 next/dashboard/store-aware write 行为。
