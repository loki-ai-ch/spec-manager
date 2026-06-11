---
code: lifecycle-guidance-sync-L3.1.3-review-fixes
level: L3
title: 代码审查回归修复
topic: lifecycle-guidance-sync
parentCode: lifecycle-guidance-sync-L2.1
status: implemented
aiSummary: 修复绕过审计伪合规、R18 错误提示、完成门禁执行顺序、完整 dist 发布验证和 doctor 安全同步提示。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: 读取补救 L3/L2、历史 Task、审查发现与相关实现测试'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 编辑 Audit 与 Task Core 分离 bypass 事件和规则成功计数
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 编辑 Task complete 修复 R18 命令提示并前置无副作用门禁
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 编辑发布验证脚本递归比较完整 dist 文件集合与摘要
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 编辑 doctor 统一 Claude 与 CodeBuddy 安全同步提示
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 编辑回归测试覆盖审查发现的五项失败场景
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: '验证: 运行专项和全量测试、lint、build、doctor、发布验证与 diff 检查'
    status: pending
created: '2026-06-11T02:31:31.634Z'
updated: '2026-06-11T02:38:15.900Z'
changeSummary: 'cascade: task-complete'
---
# 代码审查回归修复

## 目标

修复 `lifecycle-guidance-sync-L3.1.1-runtime` 与 `lifecycle-guidance-sync-L3.1.2-distribution` 代码审查发现的五项回归，确保绕过审计不伪造合规、失败提示可执行、验证命令执行顺序安全、发布验证覆盖完整构建、doctor 修复提示统一使用安全同步路径。

## 实施步骤

### Step 1 — 收集审查上下文

- SHALL 读取本 L3、父 L2、历史 Task、审查发现和 `templates/agent-plan.json`。
- SHALL 读取 Task complete、Audit compliance、Decision CLI、doctor 与发布验证实现及相关测试。

### Step 2 — 分离绕过事件与规则成功计数

- Task complete bypass SHALL 保留结构化事件、能力和原因。
- bypass MUST NOT 增加 R18、R10 或其他规则的成功命中计数。
- compliance SHALL NOT 因仅存在 bypass 事件而通过。

### Step 3 — 修复 R18 提示与完成门禁顺序

- R18 错误提示 SHALL 输出可直接执行的 `decision create <L1-code>` 命令。
- Task complete SHALL 在运行 L3 验证命令和 `@verify` 前完成无副作用门禁：L3 frozen、全部步骤 succeeded、至少一条成功 verification。
- 不可完成的 Task MUST NOT 执行规格中的验证命令。

### Step 4 — 完整比较发布构建

- `verify:installed-cli` SHALL 递归比较本地与实际安装包的完整 `dist/` 文件集合和内容摘要。
- 任一文件缺失、多余或内容漂移 MUST 使验证失败。
- 脚本 SHALL 支持测试时显式指定待验证 CLI 或安装根目录，避免依赖真实全局安装。

### Step 5 — 统一 doctor 安全修复提示

- Claude 与 CodeBuddy Skill 缺失 rules/templates 时，doctor SHALL 推荐 `--sync-managed --dry-run`，不得推荐 `--force`。
- 相关提示 SHALL 与 Managed agent assets 检查一致。

### Step 6 — 增加审查回归测试

- SHALL 覆盖 bypass 不满足 compliance。
- SHALL 覆盖 R18 错误提示命令格式。
- SHALL 覆盖未满足基础门禁时不执行验证命令。
- SHALL 覆盖任意 `dist/` 缺失、多余或内容漂移使发布验证失败。
- SHALL 覆盖 doctor 不再输出 `--force`。

### Step 7 — 验证并发布用户级 CLI

- SHALL 运行专项测试、全量测试、lint、build、doctor、完整发布验证和 `git diff --check`。
- SHALL 更新用户级 PATH CLI 后再次运行完整发布验证。

## 验证命令

```bash
npx vitest run src/core/__tests__/audit.test.ts src/core/__tests__/task-cascade.test.ts src/core/__tests__/task-complete-verify.test.ts src/core/__tests__/usability.test.ts src/cli/__tests__/task.test.ts
npm test
npm run lint
npm run build
spec-manager project doctor
npm run verify:installed-cli
git diff --check
```

## planJson (final)

```json
{
  "coveredSpecs": ["lifecycle-guidance-sync-L3.1.3-review-fixes"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取补救 L3/L2、历史 Task、审查发现与相关实现测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编辑 Audit 与 Task Core 分离 bypass 事件和规则成功计数"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编辑 Task complete 修复 R18 命令提示并前置无副作用门禁"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编辑发布验证脚本递归比较完整 dist 文件集合与摘要"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编辑 doctor 统一 Claude 与 CodeBuddy 安全同步提示"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "编辑回归测试覆盖审查发现的五项失败场景"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "验证: 运行专项和全量测试、lint、build、doctor、发布验证与 diff 检查"}
  ]
}
```

## 回滚方案

| 场景 | 回滚操作 |
|---|---|
| bypass 事件兼容性受影响 | 保留 pending metadata，单独存储事件计数而不修改规则计数 |
| 门禁前置改变错误优先级 | 保留安全执行顺序，调整错误信息和测试预期 |
| 完整 dist 比较受非运行时文件影响 | 明确比较 `dist/` 常规文件集合，排除平台元数据 |

## 执行风险

| 风险 | 应对 |
|---|---|
| 当前工作树包含多批未提交修改 | 仅增量修改审查涉及文件，不回退已有变更 |
| 用户级 CLI 发布物再次落后 | build 后重新安装到 `~/.local` 并复验 |
| bypass 审计结构迁移 | 保持已有 metadata 可读，只修正计数语义 |
