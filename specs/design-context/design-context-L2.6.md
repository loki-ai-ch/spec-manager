---
code: design-context-L2.6
level: L2
title: Managed Specs Design Context Path
topic: design-context
parentCode: design-context-L1
status: implemented
aiSummary: >-
  技术设计：将 DESIGN.md 默认入口调整为 spec-manager 管理的 specs/DESIGN.md，根目录 DESIGN.md 作为兼容
  fallback。
relations:
  - type: based_on
    target: design-context-L1
created: '2026-06-27T09:28:42.090Z'
updated: '2026-06-27T09:41:01.722Z'
changeSummary: 'cascade: task-complete'
---
# Managed Specs Design Context Path — 技术设计

## 方案概述

本设计将 DESIGN.md 从“项目根目录旁路文件”调整为 spec-manager 管理的规格上下文资产。默认设计上下文入口改为 `specs/DESIGN.md`，根目录 `DESIGN.md` 保留为兼容 fallback。显式传入的 path 仍拥有最高优先级。

目标是让 spec-manager 既能管理单个项目的实施规格，也能管理一个项目群、产品域或长期系统的完整 specs 体系。设计上下文应归入 `/specs` 管理面，而不是被隐含绑定到某个代码项目根目录。

## 背景与代码调查

当前实现：

- `src/core/design-context.ts` 使用固定默认文件名 `DESIGN.md`。
- `buildDesignContextReport` 可接收显式 `filePath`，但无显式路径时只查项目根目录。
- `assist design-export` / `assist design-template` 允许显式 `--path` / `--out`。
- `assist brief` 调用 design context report 时未暴露 design path 参数，因此不会自动读取 `specs/DESIGN.md`。
- `resolveWithin` 已限制所有传入路径必须位于项目根目录内，不能使用绝对路径或逃逸路径。

这意味着 `specs/DESIGN.md` 目前可以被显式读取，但不是默认一等入口。

## 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 默认入口 | `specs/DESIGN.md` 优先于根目录 `DESIGN.md` | 符合 spec-manager 管理完整 specs 的产品定位 |
| 兼容策略 | 保留根目录 `DESIGN.md` fallback | 不破坏现有用户和已发布文档 |
| 显式路径 | `--path` / verify 参数继续最高优先级 | 用户明确输入应覆盖自动发现 |
| 配置化 | 本轮不新增项目配置键 | 先收敛默认发现规则，避免引入配置迁移成本 |
| topic scoped path | 本轮不自动扫描 `specs/<topic>/DESIGN.md` | 避免 brief 在多 topic 项目中出现歧义；后续可单独设计 |

## 路径优先级

无显式路径时，统一 resolver 按如下顺序查找：

1. `specs/DESIGN.md`
2. `DESIGN.md`

有显式路径时：

1. 使用调用方提供的 path。
2. path 必须是项目根目录内的相对路径。
3. 禁止绝对路径和 `../` 逃逸路径。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/design-context.ts` | 新增默认路径发现，report/template/export 使用统一 resolver |
| `src/core/capability-brief.ts` | brief 默认读取 `specs/DESIGN.md` |
| `src/core/verify.ts` | `@verify: design-lint(DESIGN.md)` 保持兼容，显式 `specs/DESIGN.md` 可用 |
| `src/cli/capability.ts` | `design-template` 默认输出调整为 `specs/DESIGN.md`，文案同步 |
| `README.md` / `readme_zh.md` | 推荐路径更新为 `specs/DESIGN.md` |
| `.agents/skills/spec-manager/SKILL.md` | 入口规则同步，root `DESIGN.md` 标注为 legacy fallback |
| `templates/agents/codebuddy-skill/SKILL.md` | 分发版 skill 同步 |

## 接口契约

### Default Design Context Resolution

Core 层提供统一默认路径候选：

```ts
const DEFAULT_DESIGN_CONTEXT_PATHS = ['specs/DESIGN.md', 'DESIGN.md'] as const;
```

Report/export/brief 在未接收显式 filePath 时使用候选列表查找第一个存在的文件。若候选均不存在，report 返回 `exists: false`，`path` 指向首选默认路径 `specs/DESIGN.md`。

### Explicit Path Resolution

显式路径 contract 不变：

```ts
buildDesignContextReport({ paths, filePath: 'DESIGN.md' });
buildDesignContextExportReport({ paths, filePath: 'specs/DESIGN.md', format: 'tokens-json' });
```

所有显式路径继续通过 `resolveWithin` 解析，并保持安全约束：

- 必须是相对路径。
- 必须位于项目根目录内。
- 不自动 fallback 到其他候选。

### CLI Defaults

CLI 默认值调整：

```bash
spec-manager assist design-template --out specs/DESIGN.md
spec-manager assist design-export --path specs/DESIGN.md --format tokens-json
```

未传 `--path` 的 export 使用 `specs/DESIGN.md` 作为首选默认路径，并在不存在时兼容 fallback 到根目录 `DESIGN.md`。

## 兼容性

- 已存在根目录 `DESIGN.md` 的项目继续可用。
- 若同时存在 `specs/DESIGN.md` 和根目录 `DESIGN.md`，默认使用 `specs/DESIGN.md`。
- 显式 `--path DESIGN.md` 仍可强制读取根目录文件。
- `@verify: design-lint(DESIGN.md)` 语义不变，因为 verify 参数是显式路径。
- 本轮不迁移、复制或删除现有 DESIGN.md 文件。

## L3 裂变计划

| L3 | 标题 | 范围 |
|---|---|---|
| `design-context-L3.6.1` | Managed Specs Design Context Defaults | 统一默认 path resolver、brief/template/export/doc/test，把 canonical 默认入口改为 `specs/DESIGN.md` |

## 验证策略

| 场景 | 验证 |
|---|---|
| 默认发现 | 单测覆盖仅有 `specs/DESIGN.md` 时 report/brief 可读取 |
| fallback | 单测覆盖仅有根目录 `DESIGN.md` 时保持兼容 |
| 优先级 | 单测覆盖两者同时存在时优先 `specs/DESIGN.md` |
| 显式路径 | 单测覆盖显式 `DESIGN.md` 可覆盖默认 |
| CLI 文档 | CLI/help 或 snapshot 测试覆盖新默认输出路径 |
| 全量回归 | `npm test`、`npm run lint`、`npm run build` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 用户不知道为什么根目录 DESIGN.md 不再优先 | docs 明确优先级，显式 path 可覆盖 |
| `specs/` 目录不存在时 template 写入失败 | template 写入前确保父目录存在 |
| 多 topic DESIGN.md 自动发现歧义 | 本轮只支持全局 `specs/DESIGN.md`，topic scoped 留待后续规格 |
| 旧 agent 说明与新行为不一致 | 同步 README、skill 和分发模板 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | design-context-L1 | 延续 DESIGN.md 融合主线 |
| references | design-context-L2.1 | 原始 parser/brief 设计 |
| references | design-context-L2.4 | template/export 设计 |
| references | design-context-L2.5 | parity completion 后续默认路径调整 |
