---
code: lifecycle-guidance-sync-L2.1
level: L2
title: 方法论落地与分发一致性设计
topic: lifecycle-guidance-sync
parentCode: lifecycle-guidance-sync-L1
status: implemented
aiSummary: 设计独立完成绕过与审计、R18 活跃决策、doctor 托管资产漂移检测、方法论行为契约及实际 CLI 发布一致性验证。
created: '2026-06-11T02:15:27.425Z'
updated: '2026-06-11T02:29:14.081Z'
changeSummary: 'cascade: task-complete'
---
# 方法论落地与分发一致性设计

## 方案概述

通过两个实施规格完成闭环：运行时规格负责 Task complete 绕过与 R18 活跃决策；分发规格负责 doctor 资产漂移、入口同步、行为契约和发布验证。两部分共享正常流程不变、异常动作显式且可审计的原则。

## 技术决策

### TD-1：完成绕过按能力拆分并强制审计

- CLI SHALL 使用独立的 `--skip-r18` 与 `--skip-verification` 表达异常绕过能力。
- 任一绕过 SHALL 要求 `--reason <text>`，空原因 MUST 被拒绝。
- Core SHALL 接收分离的绕过选项并写入结构化审计事件，记录 task、能力和原因。
- 旧 `--force` SHALL 报错并给出迁移指引，不得继续执行无理由全量绕过。

### TD-2：R18 只接受当前有效决策

- Task complete 与 integrity SHALL 使用同一活跃决策判定。
- `superseded` 与 `partial` 决策 SHALL NOT 单独满足 R18。
- 历史卡片仍 SHALL 被保留并可查询。

### TD-3：doctor 检测托管 Agent 资产内容漂移

- Core SHALL 从 package root 枚举 bundled Agent 资产，与已安装托管路径逐文件比较。
- doctor SHALL 区分 missing 与 drift，并将其报告为 non-blocking warning。
- doctor SHALL 给出显式同步命令；同步 MUST 支持 dry-run，默认不得覆盖漂移文件。
- 同步漂移文件 SHALL 要求显式能力并逐文件报告 overwritten，保留现有安装 API 的兼容行为。

### TD-4：方法论行为契约与入口同步

- 文档、规则、Skill SHALL 统一描述分层生命周期、R18 正常路径、verification 与异常绕过。
- 测试 SHALL 通过 Core/CLI 行为断言验证关键方法论门禁，并保留少量稳定文本契约。
- 当前仓库已安装的 Claude Skill 托管副本 SHALL 与 bundled 源同步。

### TD-5：发布一致性验证

- 项目 SHALL 提供可自动执行的发布验证，比较 PATH 中实际 `spec-manager` 与当前构建的版本及关键 R18 行为。
- 验证 SHALL 在不一致时以非零退出，且不得自动修改全局安装。
- 实际全局安装更新属于显式发布动作，执行后 SHALL 再运行发布验证。

## 接口契约

- `CompleteTaskOptions` 新增独立跳过能力和 `bypassReason`，移除内部全量 force 语义。
- 审计事件新增 Task complete bypass 事件，payload 至少包含 taskId、specCode、bypassedChecks、reason。
- doctor 新增 Agent managed assets 检查结果，detail 包含 missing/drift 计数与代表性路径。
- Agent 安装/同步报告继续使用 created、skipped、overwritten、notes，dry-run 不写文件。

## 受影响模块

- Runtime：`src/cli/task.ts`、`src/core/task.ts`、`src/core/integrity.ts`、`src/core/audit-events.ts`。
- Distribution：`src/core/agents.ts`、`src/core/usability.ts`、相关 CLI 与测试、发布验证脚本。
- Guidance：README、中文 README、methodology、rules、skill、已安装 Claude Skill 托管文件。
- Tests：Task complete、R18、doctor、Agent 安装、方法论契约与发布验证。

## 兼容性

- 正常 `task complete` 行为保持不变。
- 旧 `--force` 改为明确失败属于有意的安全收紧，错误信息提供替代参数。
- 已存在的自定义 Agent 文件默认不覆盖；只有显式同步漂移能力可覆盖托管目标。
- 决策查询与历史展示保持不变，只收紧 R18 gate。

## 验证策略

1. 正向测试正常完成、单独绕过、组合绕过、活跃决策和同步 dry-run。
2. 反向测试空原因、旧 force、只有 superseded/partial 决策、资产漂移和 PATH CLI 不一致。
3. 运行专项测试、全量测试、lint、build、doctor、发布验证和 `git diff --check`。

## L3 裂变计划

1. `lifecycle-guidance-sync-L3.1.1-runtime`：完成绕过拆分、审计和 R18 活跃决策门禁。
2. `lifecycle-guidance-sync-L3.1.2-distribution`：doctor 资产漂移、Agent 同步、入口文档、行为契约及发布验证。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 覆盖用户自定义 Skill 内容 | 默认只报告 drift；显式同步才覆盖并逐文件报告 |
| 安全收紧破坏旧自动化 | 旧 force 返回清晰迁移指引，并在 README/Skill 中同步 |
| 活跃决策判定与查询语义分叉 | 提取共享 predicate，Task complete 与 integrity 共用 |
| 全局 CLI 更新需要仓库外写入 | 先实现非破坏验证，发布安装单独请求权限并复验 |
| 当前工作树已有未提交修改 | 增量编辑并在每步复核 diff，不回退现有内容 |
