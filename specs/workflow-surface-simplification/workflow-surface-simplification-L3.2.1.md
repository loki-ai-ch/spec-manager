---
code: workflow-surface-simplification-L3.2.1
level: L3
title: Spec Store Config and Resolver
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.2
status: implemented
aiSummary: >-
  实现 spec store 配置读取与 resolver 基础：解析 specStore/contextSources，区分 execution
  root、write root、read-only context source，输出 diagnostics；不接入现有写命令。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and existing paths/config test patterns
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Implement spec store config parser and resolver
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Add spec store resolver unit tests
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run targeted spec store tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.2
created: '2026-07-15T03:24:06.831Z'
updated: '2026-07-15T05:22:17.529Z'
changeSummary: 'cascade: task-complete'
---
# Spec Store Config and Resolver

## 背景

`workflow-surface-simplification-L2.2` 设计了 external specs root/store 与 working context。第一步实施需要建立配置读取与 resolver 基础，让系统能够理解 execution root、write root 和 read-only context source，但暂不改变现有 spec/task/decision 写命令行为。

本规格只新增 core 能力和测试，不新增 CLI 命令，不让任何写命令自动改用 external store。

## 目标

- 新增 spec store 配置解析能力，读取 `.spec-manager/config.yaml` 中的 `specStore` 和 `contextSources`。
- 新增 resolver，基于当前 execution root 解析默认 write root 和只读 context sources。
- 保持现有 `getPaths()` 和单仓库行为完全兼容。
- 对配置错误给出结构化 diagnostics，供后续 `project store doctor` / `project context` 使用。
- 覆盖单仓库、外部 store、只读 context source、非法配置和缺失路径测试。

## 非目标

- 不新增 CLI 命令。
- 不修改 `spec new/update/confirm`、`task create/start/step`、`decision create` 的写入 root。
- 不修改 README 或 agent guidance。
- 不自动创建或迁移外部 store。

## 涉及文件

- `src/core/spec-store.ts`: 新增配置类型、读取函数、resolver 和 diagnostics。
- `src/core/__tests__/spec-store.test.ts`: 新增单元测试。
- `src/core/paths.ts`: 如需复用类型或 path helper，可增加非破坏性导出；不得改变 `getPaths()` 行为。

## 数据结构

建议类型：

```ts
export type SpecStoreMode = 'write' | 'read';

export interface SpecStoreConfigEntry {
  id: string;
  path: string;
  mode: SpecStoreMode;
}

export interface SpecStoreResolvedEntry {
  id: string;
  path: string;
  mode: SpecStoreMode;
  exists: boolean;
  initialized: boolean;
}

export interface SpecStoreResolution {
  executionRoot: string;
  writeRoot: string;
  writeStore: SpecStoreResolvedEntry;
  contextSources: SpecStoreResolvedEntry[];
  diagnostics: SpecStoreDiagnostic[];
}
```

配置字段：

```yaml
specStore:
  id: product-planning
  path: ../product-specs
  mode: write
contextSources:
  - id: platform-specs
    path: ../platform-specs
    mode: read
```

## 行为规则

- 未配置 `specStore` 时，resolver MUST 返回当前 `paths.root` 作为 `writeRoot`，并保持兼容。
- `specStore.path` MUST 相对 execution root 解析；绝对路径可以读取，但 diagnostics 必须标记为 explicit absolute path，供后续 UX 决策使用。
- `specStore.mode` 缺省时 MUST 视为 `write`。
- `contextSources[].mode` 缺省时 MUST 视为 `read`。
- `contextSources` MUST NOT 影响 `writeRoot`。
- 外部 store 路径不存在时 resolver MUST 不抛异常，而是返回 diagnostic。
- 外部 store 存在但未初始化时 MUST 返回 diagnostic。
- 重复 store id MUST 返回 diagnostic。
- 配置 YAML 无法解析时 MUST 返回 diagnostic，并回退当前 root 为 write root。
- resolver MUST NOT 写入任何文件。

## 验收标准

1. **AC-1**: 无 `specStore` 配置时 resolver MUST 返回当前项目 root 作为 write root。
2. **AC-2**: 有 `specStore.path` 时 resolver MUST 解析外部 write root，并报告 exists/initialized 状态。
3. **AC-3**: `contextSources` MUST 被解析为 read-only entries，且不得改变 write root。
4. **AC-4**: 缺失路径、未初始化路径、重复 id、非法 mode、YAML parse error MUST 产生 diagnostics 而不是导致进程崩溃。
5. **AC-5**: `getPaths()` 现有行为 MUST 保持不变。
6. **AC-6**: resolver MUST 不写入任何文件。
7. **AC-7**: 单元测试 MUST 覆盖单仓库、外部 store、context source 和错误配置场景。

## 实施步骤

1. 新增 `src/core/spec-store.ts`，定义类型和配置读取。
2. 实现 `resolveSpecStore(paths)`，返回 `SpecStoreResolution`。
3. 实现 path existence / initialized 检查和 diagnostics。
4. 添加单元测试 fixtures。
5. 运行 targeted tests、lint、build。

## 验证命令

```bash
npm test -- src/core/__tests__/spec-store.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：配置解析过严会让旧 config 报错。实施必须宽容未知字段，只对 specStore/contextSources 自身做 diagnostics。
- 风险：resolver 命名如果像写入能力，用户可能以为 external store 已全量接入。文档和类型应明确这是 core resolver，写命令尚未接入。
- 回滚：删除新增 core 文件和测试，不影响现有命令。
