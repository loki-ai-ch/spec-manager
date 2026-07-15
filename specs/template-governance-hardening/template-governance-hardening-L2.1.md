---
code: template-governance-hardening-L2.1
level: L2
title: Template Governance and Agent Guidance Parity Design
topic: template-governance-hardening
parentCode: template-governance-hardening-L1
status: implemented
aiSummary: >-
  设计模板治理加固方案：分两条 L3 处理模板 guidance parity/边界清理与 docs consistency 顶层 Agent capsule
  覆盖。
relations:
  - type: references
    target: workflow-usability-hardening-L2.2
  - type: references
    target: agent-install-surface-L2.1
created: '2026-07-15T08:23:52.923Z'
updated: '2026-07-15T09:03:06.610Z'
changeSummary: 'cascade: task-complete'
---
# Template Governance and Agent Guidance Parity Design — 技术设计

## 方案概述

本设计把 template-governance-hardening-L1 拆成两个可独立验证的实施切片：

```
[templates/* + skill/SKILL.md]
          │
          ├── docs-guidance tests: 发布模板必须包含关键 workflow/design guidance
          │
          └── project docs check: 缺失关键 guidance 时只读报告 warning
```

目标不是重写 spec-manager 生命周期，而是让模板、Agent 安装入口和发布前检查与已经实现的能力保持同频：

- Agent capsule 统一提醒 `task run`、resolved `writeRoot`、`specs/DESIGN.md`、acceptance/delivery、docs check。
- L1/L2/L3/agent-plan 模板消除已知歧义和技术栈偏置。
- `project docs check` 从只扫 `skill/SKILL.md` 和子目录 SKILL 扩展为扫描所有发布 Agent entry templates。

## 技术决策

| 问题 | 候选选项 | 用户选择 | 选定理由 |
|---|---|---|---|
| Agent capsule 单源化方式 | A: 本轮引入模板生成器；B: 保留文件模板但用测试和 docs check 约束关键短语 | B | 现有 `installAgentSupport` 直接读取静态模板；先降低漂移风险，不引入生成器和迁移成本 |
| docs check 缺失 guidance 的严重级别 | A: error；B: warning | B | guidance 漂移应阻止发布前注意，但不应打断私有项目正常使用 |
| DESIGN.md 指南投射范围 | A: 只放 native skill；B: 所有发布 Agent entry 模板都显式包含简短规则 | B | fallback 平台只读 `AGENTS.md`，必须能看到设计上下文能力 |
| L3 拆分 | A: 模板内容和 docs check 同一 L3；B: 两个 L3 | B | 文案改动和检查器逻辑风险不同，分开便于 review 和回滚 |
| `.agents/` 本地资产处理 | A: 作为发布源同步；B: 继续视为生成资产，只做 info 提醒 | B | `.agents/` 是安装输出/本地运行资产，不应进入 npm files |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `templates/L1-prd.md` | 修改 | 模板 charter 和 pre-write guidance | docs-guidance 文本断言 |
| `templates/L2-design.md` | 修改 | 层级边界和受影响模块/复用清单文案 | docs-guidance 文本断言 |
| `templates/L3-impl.md` | 修改 | 语言无关实施/验证/部署示例 | docs-guidance 文本断言 |
| `templates/agent-plan.json` | 修改 | 语言无关 planJson 示例 | docs-guidance 文本断言 |
| `templates/agents/*.md` | 修改 | Agent entry capsule guidance parity | docs-guidance + docs-consistency fixture |
| `templates/agents/codebuddy-skill/SKILL.md` | 修改 | native skill guidance parity | docs-guidance |
| `skill/SKILL.md` | 修改 | 如有必要补充模板治理/发布检查说明 | docs-guidance |
| `src/core/docs-consistency.ts` | 修改 | 扩展 guidance 扫描目标和关键词分组 | docs-consistency tests |
| `src/core/__tests__/docs-guidance.test.ts` | 修改 | 增加模板边界和 guidance parity 断言 | targeted tests |
| `src/core/__tests__/docs-consistency.test.ts` | 修改 | 增加顶层 Agent capsule 缺失 guidance fixture | targeted tests |

## 数据模型

不新增持久化数据模型。

`DocsConsistencyFinding` 保持现有 schema：

```ts
{
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  path?: string;
  suggestion?: string;
}
```

可新增 finding id，但不改变 report schemaVersion。

## 接口契约

### Agent Guidance Coverage

发布 Agent entry templates 包括：

```text
templates/agents/AGENTS.md
templates/agents/CLAUDE.md
templates/agents/CODEBUDDY.md
templates/agents/CURSOR.md
templates/agents/WINDSURF.md
templates/agents/codebuddy-skill/SKILL.md
skill/SKILL.md
```

这些入口必须覆盖以下语义：

| Guidance | 必备短语示例 |
|---|---|
| workflow core | `L1 -> L2 -> L3 -> Agent Task` |
| write root | `project context --json`, `writeRoot`, `specStore.path`, `contextSources` |
| task run | `spec-manager task run <L3-code> --plan <planFile>` |
| docs check | `spec-manager project docs check` |
| delivery | `spec-manager assist acceptance`, `spec-manager assist delivery` |
| design context | `specs/DESIGN.md`, `resolved write root`, `root \`DESIGN.md\` retained as a legacy fallback` |
| platform install | `spec-manager <platform> install`, `spec-manager agents install`, `spec-manager skills install` |

### Docs Consistency Extension

`guidanceFindings(root)` 扩展扫描：

- `skill/SKILL.md`
- `templates/agents/*.md`
- `templates/agents/*/SKILL.md`

缺失任一关键 guidance 组时输出 warning：

```text
id: docs.agent-template.guidance.missing
severity: warning
path: templates/agents/AGENTS.md
suggestion: Mention the missing spec-manager workflow/design guidance before release.
```

本轮不扫描安装后的 `.agents/` 内容作为 error/warning，只继续用 existing generated asset info 提醒它是本地输出。

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| 某仓库没有 `templates/agents` | docs check 无法扫描 Agent templates | 跳过不存在路径，不报错 | 添加模板目录后自动扫描 |
| guidance 检查误报 | 发布前出现 warning | warning 不改变 exit code | 调整关键词组或补充文案 |
| Agent capsule 过长 | Agent 忽略重点 | 入口只保留短规则和常用命令 | 详细解释保留在 native skill/README |
| `.agents/` 漂移 | 本地自举环境读到旧模板 | 不把 `.agents` 当发布源；用 `spec-manager codex install --sync-managed` 或手动同步本地环境 | 保持 docs check info 提醒 |

## 向后兼容

- `spec-manager project agents --provider` 和新 `<platform> install` 行为不变。
- `project docs check` report schema 不变，新增 warning 不应导致 exit code 1。
- 旧项目没有 Agent templates 时 docs check 不报模板缺失。
- L1/L2/L3 模板只影响后续新 spec，不迁移历史 specs。
- `.agents/` 继续作为本地生成资产，不纳入 `package.json.files`。

## 关键交互流程

```text
维护者修改模板
  │
  ├─ npm test -- docs-guidance
  │    └─ 检查发布模板是否包含关键 guidance
  │
  ├─ spec-manager project docs check
  │    └─ 只读报告 README/package/guidance/generated asset findings
  │
  └─ npm pack --dry-run
       └─ 确认发布包只包含 source templates/skill/rules，不包含本地 generated assets
```

## 可观测性

- **日志**: 无新增运行时日志。
- **指标**: docs check summary 中 warning 计数可作为模板治理信号。
- **告警**: 发布前 CI/人工 checklist 使用 `project docs check` 和 targeted tests。

## 复用清单

| 工具类/基类 | 路径 | 类/函数 | 用途 |
|---|---|---|---|
| Docs consistency core | `src/core/docs-consistency.ts` | `buildDocsConsistencyReport`, `guidanceFindings` | 扩展 guidance 扫描 |
| Agent installer registry | `src/core/agents.ts` | `AGENT_PROVIDER_INFO`, `installAgentSupport` | 确认模板入口来源 |
| Guidance tests | `src/core/__tests__/docs-guidance.test.ts` | existing test suite | 增加发布模板 parity 断言 |
| Docs consistency tests | `src/core/__tests__/docs-consistency.test.ts` | existing fixtures | 增加 capsule guidance warning fixture |

## L3 裂变计划

| L3 code | 范围 | 前置依赖 |
|---|---|---|
| template-governance-hardening-L3.1.1 | Template Guidance Parity and Boundary Cleanup：修订 L1/L2/L3/agent-plan/Agent entry templates，补 docs-guidance 文本测试 | template-governance-hardening-L2.1 confirmed |
| template-governance-hardening-L3.1.2 | Docs Consistency Agent Capsule Coverage：扩展 docs check 扫描顶层 Agent capsule，补 docs-consistency fixture | template-governance-hardening-L3.1.1 implemented |

## 验证策略

| 场景 | 验证 |
|---|---|
| Agent entry 模板包含 Design guidance | `npm test -- docs-guidance` |
| L1/L2/L3 模板已知歧义消除 | `docs-guidance` 新增断言 |
| 顶层 Agent capsule 缺 docs/design guidance | `docs-consistency` fixture 输出 warning |
| 现有 Agent install 行为不变 | `npm test -- agents project-agents` |
| 发布前总体验证 | `npm test`、`npm run lint`、`npm run build`、`spec-manager project docs check`、`npm pack --dry-run` |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 文案测试太脆 | 断言稳定能力短语，不绑定整段文本 |
| docs check warning 增多影响用户信心 | finding detail 明确是 pre-release guidance，exit code 不阻塞 |
| 模板规则重复导致后续继续漂移 | 本轮用测试兜底；后续 Phase 3 再考虑单源生成 |
| 同步 `.agents` 造成误提交 | 不在任务中提交 `.agents`；必要时只说明本地 generated asset 状态 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | template-governance-hardening-L1 | 承接模板治理需求 |
| references | workflow-usability-hardening-L2.2 | 复用 docs consistency 设计 |
| references | design-context-L2.6 | 复用 `specs/DESIGN.md` 默认路径规则 |
| references | agent-install-surface-L2.1 | 复用 platform install/fallback guidance |
