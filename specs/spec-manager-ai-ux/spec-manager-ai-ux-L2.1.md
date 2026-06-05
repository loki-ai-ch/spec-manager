---
code: spec-manager-ai-ux-L2.1
level: L2
title: 技术方案：重构优化 AI 使用本项目操作
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L1
status: implemented
aiSummary: >-
  五模块并行优化：spec 编码改为 topic-L<N>、topic 平铺目录、active 文件名=code.md、SKILL.md 精简、CLI task
  batch、测试补全
created: '2026-06-05T04:19:15.011Z'
updated: '2026-06-05T17:51:32+08:00'
changeSummary: 同步方法论 L2 必填段：技术决策
---
# 技术方案：重构优化 AI 使用本项目操作 — 技术设计

## 方案概述

四个独立模块的优化，无相互依赖，可并行实施：

```
Phase 1: README 场景化改造
Phase 2: SKILL.md + RESOLVER 合并精简
Phase 3: CLI task batch 命令
Phase 4: 核心模块测试补全
```

## 技术决策

| 问题 | 候选选项 | 选择 | 理由 |
|---|---|---|---|
| spec 编码格式 | A: `<YYYY-MM-DD>-<shortId>`(现状) B: `<topic>-L<N>` | B | 用户要求：编码与 topic 关联且含层级标识，可读性好 |
| SKILL.md 精简策略 | A: 删除内容 B: 合并 RESOLVER 内联 + 精简表格 | B | 删除会丢失信息；内联路由规则到 SKILL.md 后可删 RESOLVER.md，减少一次文件加载 |
| CLI 批量操作实现 | A: 新增 `task batch` 子命令 B: 给 `task step` 加 `--steps-file` | A | `batch` 语义更清晰，支持 create+start+step+complete 一体化 |
| spec 目录结构简化 | A: 完全扁平 B: 保留嵌套，去掉 code 目录层 | B | 扁平会丢失子 spec 嵌套能力；去掉 code 目录层后 spec 直接作为文件，子 spec 仍在父 spec 目录内 |
| 测试框架 | A: 继续 Vitest B: 换 Jest | A | 项目已用 Vitest，无理由换 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `README.md` + `readme_zh.md` | 修改 | 新增"使用场景"章节(5+ 场景) | 手动验证 |
| `.claude/skills/spec-manager/SKILL.md` | 修改 | 合并 RESOLVER 内容，精简至 ≤120 行 | 5 个场景端到端路由测试 |
| `.claude/skills/spec-manager/RESOLVER.md` | 删除 | 内容已合并到 SKILL.md | — |
| `src/cli/task.ts` | 修改 | 新增 `batch` 子命令 | 单元测试 |
| `src/core/paths.ts` | 修改 | spec 目录结构简化（去掉 code 目录层） | 更新 paths.test.ts |
| `src/core/spec-io.ts` | 修改 | 适配新目录结构 | 新增 spec-io.test.ts |
| `src/core/__tests__/` | 新增 | 6 个测试文件 | — |

## 数据模型

### spec 编码格式

- **L1 code** = `<topic>-L1`（如 `spec-manager-ai-ux-L1`）
- **L2 code** = `<topic>-L2.N`（如 `spec-manager-ai-ux-L2.1`，N 为同父序号）
- **L3 code** = `<topic>-L3.N.M`（如 `spec-manager-ai-ux-L3.1.1`）
- topic 从 `--topic` 参数获取
- level 从 `spec new L1|L2|L3` 参数获取
- `--code` 参数仍可手动覆盖

### 文件命名规则

- **topic 目录名** = topic（如 `spec-manager-ai-ux/`）
- **.md 文件名** = spec code（如 `spec-manager-ai-ux-L1.md`）
- 子 spec 直接平铺在 topic 目录内，父子关系由 `parentCode` 和点分 code 表达

### 文件系统目录结构

| 变更 | 旧结构 | 新结构 |
|---|---|---|
| spec 编码 | `<YYYY-MM-DD>-<shortId>` | `<topic>-L<N>[.M...]`（点分编号，层级自文档化） |
| 目录名 | `<code>/` | `<topic>/` |
| 文件名 | `<code>.md` | `<code>.md` |
| 子 spec 嵌套 | `<parent-dir>/<code>/<code>.md` | 平铺在 `specs/<topic>/` |

### 新目录结构示例

```
specs/
└── spec-manager-ai-ux/
    ├── spec-manager-ai-ux-L1.md
    ├── spec-manager-ai-ux-L2.1.md
    ├── spec-manager-ai-ux-L3.1.1-readme.md
    ├── decisions/
    │   └── DC-001.md
    └── tasks/
        └── spec-manager-ai-ux-L3.1.1-readme-T-001.json
```

## 接口契约

### `task batch` 命令

**CLI 接口**:
```bash
spec-manager task batch <specCode> --plan <file> [--auto-confirm]
```

**行为**: 等价于 `create` + `start` + 对每个 step 自动 `step` + `complete`，一条命令完成整个 Agent Task 生命周期。

**输出**:
```
✓ Task T-001 created for 2026-06-06-c3d4e5
  steps: 4
✓ Task T-001 → running
  [1/4] 上下文收集... succeeded (1200ms)
  [2/4] 创建 jwt.ts... succeeded (3400ms)
  [3/4] 创建 jwt.test.ts... succeeded (2100ms)
  [4/4] 验证测试... succeeded (5000ms)
✓ Task T-001 → completed
  cascaded:
    2026-06-06-c3d4e5 (L3): frozen → implemented
```

**错误处理**: 任一步骤失败时停止，报告已完成步骤 + 失败步骤，task 状态为 `failed`。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| `task batch` 中间步骤失败 | task 停在 running 状态 | 已上报的 step 保留，可用 `task step` 手动补报后 `task complete` | 手动恢复 |
| spec 目录迁移中断 | 新旧路径混用 | 提供 `migrate` 命令做一次性迁移，迁移前备份 | 重新运行 migrate |
| SKILL.md 精简后遗漏规则 | AI 执行时违反规则 | 精简后用 5 个场景端到端测试 | 补回遗漏内容 |

## 向后兼容

- **CLI 命令**: 所有现有命令保持不变，`task batch` 是新增命令
- **spec 文件**: 目录结构变更需要一次性迁移脚本（`spec-manager migrate`）
- **frontmatter**: 无变更
- **SKILL.md**: 路由逻辑不变，只是文件组织优化

## 复用清单

| 工具类/函数 | 路径 | 用途 |
|---|---|---|
| `createTask` | src/core/task.ts | batch 中复用 |
| `startTask` | src/core/task.ts | batch 中复用 |
| `reportStep` | src/core/task.ts | batch 中复用 |
| `completeTask` | src/core/task.ts | batch 中复用 |
| `findSpecByCode` | src/core/spec-io.ts | batch 中查找 spec |
| `listSpecFiles` | src/core/paths.ts | 迁移脚本中遍历 |

## L3 裂变计划

| L3 范围 | 内容 | 前置依赖 |
|---|---|---|
| L3-1: README 场景化改造 | EN+ZH README 新增 5 个使用场景 | 无 |
| L3-2: SKILL.md 合并精简 | 合并 RESOLVER、精简表格、删除 RESOLVER.md | 无 |
| L3-3: spec 编码格式改造 | `spec new` 生成 `<topic>-L<N>` 编码 + 目录结构简化 + 迁移脚本 | 无 |
| L3-4: CLI task batch 命令 | 新增 `task batch` 子命令 + 测试 | 无 |
| L3-5: 核心模块测试补全 | spec-io/validate/frontmatter/status/audit/delta 测试 | 无 |

## 关联

- 父 L1: spec-manager-ai-ux-L1（重构优化 AI 使用本项目操作）
