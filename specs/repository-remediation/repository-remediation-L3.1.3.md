---
code: repository-remediation-L3.1.3
level: L3
title: Claude Skill 资产安全补齐
topic: repository-remediation
parentCode: repository-remediation-L2.1
status: implemented
aiSummary: 实现 Claude skill merge-missing 安全补齐，执行固定迁移并验证 Decision、豁免、人工文件不可变和 doctor 归零。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 收集资产上下文并记录人工文件与历史 Task 摘要
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 agents.ts 实现目录 merge-missing
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 接入 remediation.ts 资产计划执行与 doctor 指引
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 新增 merge-missing 与端到端迁移测试
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 预览并执行 repository-remediation-v1 当前仓库迁移
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证完整测试、doctor 归零与迁移幂等
    status: pending
created: '2026-06-08T09:57:42.513Z'
updated: '2026-06-09T01:16:32.459Z'
changeSummary: 'cascade: task complete'
---
# Claude Skill 资产安全补齐 — 实施规格

## 目标

实施 `repository-remediation-L2.1` 的 TD-5，并执行 `repository-remediation-v1` 完成端到端仓库修复与 doctor 归零验证。

**前置依赖**: `repository-remediation-L3.1.1`、`repository-remediation-L3.1.2` 已 implemented

## 实施步骤

### Step 1 — 上下文收集

- SHALL 读取 `repository-remediation-L3.1.3`、`repository-remediation-L2.1`、`repository-remediation-L3.1.1`、`repository-remediation-L3.1.2`、`templates/agent-plan.json`。
- SHALL 分析 `src/core/agents.ts`、`src/core/remediation.ts`、`src/core/usability.ts`、对应测试及 bundled `rules/`、`templates/`。
- SHALL 记录 `CLAUDE.md`、`.claude/settings.local.json`、已有 Claude skill 文件和 16 个历史 Task 文件的原始字节摘要。

### Step 2 — 实现 merge-missing 资产能力

- SHALL 扩展 `src/core/agents.ts` 的目录安装选项，支持递归 merge-missing。
- SHALL 逐文件报告 `created` 与 `skipped`；目标已存在时不得删除目录或覆盖文件。
- SHALL 保持现有默认安装和 `--force` 行为不变。

### Step 3 — 接入迁移计划与执行

- SHALL 扩展 `repository-remediation-v1` 计划，精确包含 `.claude/skills/spec-manager/rules/` 和 `templates/` 中缺失文件。
- SHALL dry-run 显示每个将创建或跳过的资产。
- SHALL 在迁移事务中只创建缺失资产；任何冲突或复制失败必须回滚同次迁移写入。
- SHALL 更新 doctor 对 Claude 缺失资产的 action，指向显式 remediation dry-run，而非 `--force`。

### Step 4 — 增加资产与端到端测试

- SHALL 扩展 `src/core/__tests__/agents.test.ts`，覆盖 merge-missing、已有文件不覆盖、dry-run 零写入和默认语义不变。
- SHALL 扩展 `src/core/__tests__/remediation.test.ts`，覆盖资产计划、事务回滚和重复迁移全部 skip。
- SHALL 扩展 doctor 测试，验证迁移后无当前 20 个问题，制造新缺失 verification 时仍报告。

### Step 5 — 执行当前仓库迁移

- SHALL 先运行 `project remediate --migration repository-remediation-v1 --dry-run`，人工核对仅包含 4 个决策、16 个豁免和缺失 Claude 资产。
- SHALL 保存 16 个 Task 与人工文件摘要后执行真实迁移。
- SHALL 确认 4 个 Decision Card 可按 `docCode` 查询、豁免登记精确包含 16 项、Claude rules/templates 完整。
- SHALL 确认 16 个 Task、`CLAUDE.md` 和 `.claude/settings.local.json` 字节级未变化。

### Step 6 — 最终验证

- SHALL 运行完整测试、lint、build、`git diff --check` 和 `project doctor`。
- SHALL 再次执行 dry-run，所有迁移目标必须为 `skip` 且无 conflict。

## 验证命令

```bash
# 正向验证：预览后执行固定迁移
node dist/cli/index.js project remediate --migration repository-remediation-v1 --dry-run
node dist/cli/index.js project remediate --migration repository-remediation-v1
node dist/cli/index.js project doctor
# 预期：Repository integrity 为 No integrity issues；Claude rules/templates present

# 反向验证与幂等性：新问题仍被测试发现，重复预览全部 skip
npx vitest run src/core/__tests__/agents.test.ts src/core/__tests__/remediation.test.ts src/core/__tests__/integrity.test.ts src/cli/__tests__/usability.test.ts
node dist/cli/index.js project remediate --migration repository-remediation-v1 --dry-run
# 预期：所有测试 passed；迁移计划无 create/conflict

npm test
npm run lint
npm run build
git diff --check
# 预期：均退出码 0
```

## step_report 模板

```json
{"taskId":"<task id>","stepNo":<stepNo>,"stepType":"tool_action","status":"succeeded","toolName":"<实际工具>","latencyMs":"<实际耗时>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"}
```

## planJson (final)

```json
{
  "coveredSpecs": ["repository-remediation-L3.1.3"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "收集资产上下文并记录人工文件与历史 Task 摘要"},
    {"stepNo": 2, "stepType": "tool_action", "name": "修改 agents.ts 实现目录 merge-missing"},
    {"stepNo": 3, "stepType": "tool_action", "name": "接入 remediation.ts 资产计划执行与 doctor 指引"},
    {"stepNo": 4, "stepType": "tool_action", "name": "新增 merge-missing 与端到端迁移测试"},
    {"stepNo": 5, "stepType": "tool_action", "name": "预览并执行 repository-remediation-v1 当前仓库迁移"},
    {"stepNo": 6, "stepType": "tool_action", "name": "运行完整验证并确认 doctor 归零与迁移幂等"}
  ]
}
```

`autoConfirm=false`：真实迁移和仓库归零结果需要人工复核。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| merge-missing 覆盖已有文件 | 停止执行，根据实施前摘要恢复被覆盖文件并修正复制逻辑 | < 15 min |
| 当前仓库迁移结果不符 | 删除本迁移新建的 Decision、豁免登记项和缺失资产；不得修改历史 Task | < 15 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| bundled 目录与目标目录层级不同 | 计划器逐文件列出 source/target，dry-run 人工核对后执行 |
| doctor 归零掩盖新违规 | 自动化测试临时制造未登记 completed Task，确认仍报告问题 |
