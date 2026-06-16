---
code: critical-ac-readiness-L1
level: L1
title: 关键 AC Readiness 审计与修复建议
topic: critical-ac-readiness
parentCode: null
status: implemented
aiSummary: >-
  定义关键 AC readiness 审计与修复建议：完整列出 active L3 的关键 AC 状态，区分
  missing/empty/unknown/ready，支持 topic/json，强调不得自动伪造关键 AC。
created: '2026-06-16T07:42:17.191Z'
updated: '2026-06-16T08:25:58.917Z'
changeSummary: 'cascade: task-complete'
---
# 关键 AC Readiness 审计与修复建议

## 背景

adaptive workflow 已显式启用，默认 Profile 为 `standard`。`project workflow preview` 显示当前项目存在 66 个 active L3，其中只有 3 个具备有效 `## 关键验收标准`，63 个缺少 governed readiness。

这意味着项目可以安全使用 standard 默认流，但尚不适合把默认 Profile 升级为 governed。当前缺口不应该通过自动批量补写历史 L3 来“刷绿”，因为关键 AC 是业务/实现风险判断，必须由人或 Agent 在上下文中确认。更合理的下一步是提供可审计的 readiness 报告和修复建议，让维护者逐步处理高价值 L3。

## 问题归类

| 类别 | 问题描述 | 优先级 | 证据来源 |
|---|---|---|---|
| governed readiness 缺口 | 63/66 active L3 缺少有效关键 AC 声明 | P1 | `project workflow preview --json` |
| 修复路径不清晰 | preview 只列前 10 个示例，缺少完整清单、风险排序和修复建议 | P1 | 当前 preview 输出 |
| 自动修复风险 | 批量插入关键 AC 可能伪造验收语义 | P1 | 关键 AC 必须指向真实验收标准 |
| 采用度量闭环不足 | 启用 standard 后需要持续跟踪 readiness 改善 | P2 | `project profile metrics` 只聚合 Task profile，不聚合 L3 readiness 详情 |

## 用户故事

### Must have

- As a **项目维护者**, I want **查看所有缺少关键 AC 的 active L3 清单**, so that **我可以按风险逐步修复 governed readiness**
- As a **执行 Agent**, I want **获得每个 L3 的修复建议而不是自动改写**, so that **我能在读取上下文后补充真实关键 AC**
- As a **审计者**, I want **区分“缺少关键 AC”和“关键 AC 引用未知 AC”**, so that **我能判断是缺声明还是声明错误**
- As a **治理负责人**, I want **看到 readiness 进度和可升级 governed 的条件**, so that **我能决定何时调整默认 Profile**

### Should have

- As a **维护者**, I want **按 topic 过滤 readiness 报告**, so that **可以分阶段处理大型仓库**
- As a **团队负责人**, I want **JSON 输出**, so that **可以接入 release report 或 CI advisory**
- As an **Agent 模板维护者**, I want **入口规则说明关键 AC 不得自动伪造**, so that **不同 Agent 修复行为一致**

### Could have

- As a **项目维护者**, I want **生成可复制的 amend checklist**, so that **后续人工修复更快**

## 功能目标

| 能力 | 现状 | 目标 |
|---|---|---|
| Readiness 清单 | preview 只给数量和前 10 个示例 | 输出完整 active L3 readiness 清单，可按 topic 过滤 |
| 缺口分类 | 仅合并为 without critical AC | 区分 missing section、empty section、unknown AC reference |
| 修复建议 | 无 | 对每个缺口输出下一步建议和需人工确认的边界 |
| governed 升级判断 | preview 给 summary | 报告输出 readiness ratio 和升级条件 |
| JSON 输出 | preview 有 JSON | readiness 报告也有稳定 schemaVersion |

## 验收标准

1. **AC-1**: **Given** 项目存在 active L3, **When** 运行 critical AC readiness 报告, **Then** 系统 **SHALL** 输出每个 L3 的 readiness 状态。
2. **AC-2**: **Given** L3 缺少 `## 关键验收标准`, **When** 生成报告, **Then** 系统 **SHALL** 将其标记为 missing critical section 或 empty critical section。
3. **AC-3**: **Given** L3 的关键 AC 引用不存在的 AC ID, **When** 生成报告, **Then** 系统 **SHALL** 将其标记为 unknown critical AC，并列出 unknown IDs。
4. **AC-4**: **Given** 用户传入 `--topic`, **When** 生成报告, **Then** 系统 **SHALL** 只统计该 topic 的 active L3。
5. **AC-5**: **Given** 用户请求 JSON 输出, **When** 生成报告, **Then** 系统 **SHALL** 输出稳定 `schemaVersion`，不得依赖自然语言解析。
6. **AC-6**: **Given** 报告发现缺口, **When** 输出修复建议, **Then** 系统 **SHALL** 明确关键 AC 需要基于 L3 上下文人工确认，并 **MUST** 不自动伪造。
7. **AC-7**: **Given** 所有 active L3 均 ready, **When** 输出 summary, **Then** 系统 **SHOULD** 提示可以重新运行 adoption preview 评估 governed default。
8. **AC-8**: **Given** 方法论和 Agent 入口同步后, **When** 运行契约测试和 doctor, **Then** 关键 AC 修复边界描述 **SHALL** 保持一致。

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|---|---|---|---|
| readiness 可见性 | 只显示 10 个示例 | 100% active L3 纳入清单 | fixture + 本项目 smoke |
| 缺口分类准确性 | 仅 count | missing/empty/unknown 分类可测 | 单元测试 |
| 安全修复边界 | 无统一提示 | 文档和 Agent 入口明确不自动伪造关键 AC | contract + doctor |
| governed 升级依据 | preview summary | readiness report 提供 ratio 和 next step | CLI 测试 |

## 范围边界

- **做**:
  - 新增只读 critical AC readiness 报告
  - 支持 text/json 输出和 topic 过滤
  - 分类 missing/empty/unknown/ready
  - 输出修复建议和 governed 升级判断
  - 同步方法论、skill、Agent 入口
- **不做**:
  - 不自动修改历史 L3
  - 不自动插入关键 AC
  - 不把 readiness warning 变成 `task complete` 硬门禁
  - 不要求一次性修复所有历史规格
- **推迟**:
  - 批量生成 amend proposal
  - CI 强制 readiness threshold
  - UI dashboard

## 设计原则

1. **报告优先于改写** — readiness 工具只揭示缺口和建议，不替用户创造关键 AC。
2. **语义真实性优先** — 关键 AC 必须来自 L3 的真实风险和验收语义。
3. **渐进治理** — standard 默认可以继续工作，governed readiness 逐步提升。
4. **本地事实源** — 只读取 active specs，不依赖远端服务或遥测。

## 里程碑

| 阶段 | 交付内容 | 前置依赖 | 优先级 |
|---|---|---|---|
| Phase 1 | Critical AC readiness core/API/CLI | adaptive workflow adoption preview implemented | P1 |
| Phase 2 | 修复建议、方法论和 Agent 入口同步 | Phase 1 | P1 |

## 交付物分解

| 交付物 | 归属阶段 | 预估 L2 个数 |
|---|---|---|
| Critical AC readiness 报告与修复建议 | Phase 1-2 | 1 |

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|---|---|---|
| 自动化建议被当成真实验收 | 可能伪造治理证据 | 报告只给 checklist，不生成 AC 内容 |
| 历史缺口过多造成噪声 | 用户难以行动 | 支持 topic 过滤和 summary ratio |
| 与 adoption preview 重复 | 命令边界不清 | preview 给采用决策，readiness 给完整修复清单 |

## 关联

- based_on: `adaptive-workflow-adoption-L1`
- based_on: `adaptive-workflow-adoption-L3.1.1-preview`
- based_on: `adaptive-evidence-workflow-L3.1.1-profile`
