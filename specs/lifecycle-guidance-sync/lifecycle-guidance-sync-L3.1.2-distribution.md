---
code: lifecycle-guidance-sync-L3.1.2-distribution
level: L3
title: Agent 资产与方法论分发一致性
topic: lifecycle-guidance-sync
parentCode: lifecycle-guidance-sync-L2.1
status: implemented
aiSummary: 增强 doctor 托管资产漂移检测与显式同步，统一入口文档和方法论行为契约，并验证实际 CLI 发布物。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: 读取分发 L3/L2、历史任务、plan 模板、Agent/doctor 与入口文档'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 Agent 与 doctor Core 检测托管资产 missing 和 drift
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 Agent 同步能力支持 dry-run、显式覆盖与逐文件报告
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑 README、methodology、rules、Skill 与已安装 Claude 托管副本统一语义
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑方法论与分发测试验证行为契约和内容漂移
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 新增发布验证脚本比较实际 spec-manager 与当前构建
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: '验证: dry-run 同步并运行 doctor、发布验证、全量测试、lint、build 与 diff 检查'
    status: pending
created: '2026-06-11T02:17:01.256Z'
updated: '2026-06-11T02:29:14.076Z'
changeSummary: 'cascade: task-complete'
---
# Agent 资产与方法论分发一致性

## 目标

让 doctor、Agent 资产、公开入口、方法论契约和实际 CLI 发布物保持一致，使内容漂移可检测、可预览、可验证。

## 实施步骤

### Step 1 — 收集分发上下文

- SHALL 读取本 L3、父 L2、历史相关任务、`templates/agent-plan.json`。
- SHALL 读取 Agent 安装、doctor、CLI 项目命令、方法论测试、package scripts 和全部相关入口文档。
- SHALL 比较 bundled 与当前仓库已安装 Claude Skill 的逐文件差异。

### Step 2 — 实现托管资产漂移检测

- SHALL 枚举 bundled 托管资产并比较已安装目标。
- SHALL 让 doctor 区分 missing 与 drift，并报告代表性文件。
- SHALL 保持检查 non-blocking，避免阻止读取和修复仓库。

### Step 3 — 实现显式资产同步

- SHALL 为托管资产同步提供 dry-run 和显式覆盖能力。
- SHALL 默认不覆盖 drift 文件；显式同步 SHALL 逐文件报告 overwritten。
- SHALL 覆盖幂等、缺失、漂移、自定义文件保留和 dry-run 零写入测试。

### Step 4 — 同步方法论与 Agent 入口

- SHALL 同步 README、中文 README、methodology、rules、Skill 和当前仓库已安装 Claude Skill 托管副本。
- SHALL 明确生命周期级联、R18 活跃决策、verification 与异常绕过语义。
- SHALL 不覆盖 `.claude/settings.local.json` 等用户文件。

### Step 5 — 升级方法论行为契约

- SHALL 保留稳定文本契约，并增加对 runtime、doctor、Agent 同步和公开 CLI 行为的契约测试。
- SHALL 让测试能发现旧 Skill 内容、错误 force 描述和 doctor 漂移漏报。

### Step 6 — 增加发布一致性验证

- SHALL 增加可执行脚本或 npm script，比较 PATH 中实际 CLI 与当前构建的版本及关键行为。
- SHALL 在不一致时非零退出，不自动修改全局安装。
- SHALL 在明确发布动作后复验实际 CLI。

### Step 7 — 执行分发同步与最终验证

- SHALL dry-run 后同步当前仓库已安装 Claude Skill 托管资产。
- SHALL 运行 doctor、发布一致性验证、专项测试、全量测试、lint、build 和 `git diff --check`。

## 验证命令

```bash
npx vitest run src/core/__tests__/agents.test.ts src/core/__tests__/usability.test.ts src/cli/__tests__/usability.test.ts src/core/__tests__/methodology-contract.test.ts
node dist/cli/index.js project doctor
npm test
npm run lint
npm run build
npm run verify:installed-cli
git diff --check
```

## planJson (final)

```json
{
  "coveredSpecs": ["lifecycle-guidance-sync-L3.1.2-distribution"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取分发 L3/L2、历史任务、plan 模板、Agent/doctor 与入口文档"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 Agent 与 doctor Core 检测托管资产 missing 和 drift"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 Agent 同步能力支持 dry-run、显式覆盖与逐文件报告"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑 README、methodology、rules、Skill 与已安装 Claude 托管副本统一语义"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑方法论与分发测试验证行为契约和内容漂移"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "新增发布验证脚本比较实际 spec-manager 与当前构建"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "验证: dry-run 同步并运行 doctor、发布验证、全量测试、lint、build 与 diff 检查"}
  ]
}
```

## 回滚方案

| 场景 | 回滚操作 |
|---|---|
| doctor 将用户文件误判为托管漂移 | 收窄托管清单，仅比较 package 明确拥有的目标 |
| 显式同步覆盖范围过宽 | 停止同步并恢复本 Task 写入的托管文件 |
| 发布验证受 PATH 环境影响 | 输出实际路径与差异，允许显式传入待验证 CLI |

## 执行风险

| 风险 | 应对 |
|---|---|
| bundled 与已安装目录结构不完全相同 | 使用显式 provider 安装映射生成托管清单 |
| 当前工作树已有文档和 Skill 修改 | 增量合并，复核每个目标文件 diff |
| 更新全局 CLI 需要仓库外权限 | 实现和本地验证先完成，发布安装单独请求批准 |
