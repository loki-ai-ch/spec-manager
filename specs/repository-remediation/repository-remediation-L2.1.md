---
code: repository-remediation-L2.1
level: L2
title: 历史一致性迁移技术设计
topic: repository-remediation
parentCode: repository-remediation-L1
status: implemented
aiSummary: 以版本化固定迁移清单补建决策、登记严格历史豁免并 merge-missing 补齐 Claude skill，支持 dry-run、事务执行与幂等验证。
created: '2026-06-08T09:52:59.621Z'
updated: '2026-06-09T01:36:43.898Z'
changeSummary: 'cascade: project-reconcile'
---
# 历史一致性迁移技术设计

## 方案概述

本次修复采用“显式迁移清单 + 通用完整性豁免模型”的方案：

1. 新增固定版本的 `repository-remediation-v1` 迁移清单，精确列出 4 个待补决策的 L1、16 个历史 Task 豁免以及待补齐的 Claude skill 资产。
2. 新增项目级完整性豁免登记文件 `.spec-manager/integrity-exemptions.json`。迁移只登记历史事实，不修改终态 Task。
3. 完整性扫描在报告 `missing-verification` 前校验豁免；仅精确匹配、类型正确且仍指向符合约束的 completed Task 时豁免才有效。
4. 新增 `project remediate` 命令。命令先生成确定性执行计划，`--dry-run` 只输出计划；真实执行在项目写事务内创建缺失 Decision Card、登记豁免并补齐缺失 Claude skill 文件。
5. Claude 资产采用 merge-missing 语义，只创建不存在的目录和文件，不覆盖 `CLAUDE.md`、`.claude/settings.local.json` 或任何已有文件。

迁移完成后，通用完整性扫描继续对新建或未登记的 completed Task 执行成功 verification 门禁。迁移清单不会从扫描结果自动生成，也不会自动扩展。

## 技术决策

### TD-1：豁免登记独立于 Task 历史

新增 `.spec-manager/integrity-exemptions.json`，使用版本化结构保存豁免：

```json
{
  "version": 1,
  "exemptions": [
    {
      "id": "repository-remediation-v1:<specCode>:<taskId>",
      "kind": "legacy-missing-verification",
      "specCode": "<specCode>",
      "taskId": "<taskId>",
      "reason": "Task completed before successful verification became mandatory.",
      "createdAt": "<migration execution timestamp>",
      "migrationId": "repository-remediation-v1"
    }
  ]
}
```

不在 Task 文件中增加 verification、标签或迁移字段。这样可以保持终态 Task 字节级不变，并让历史例外具备单独审计面。

### TD-2：豁免必须通过严格有效性校验

完整性扫描仅在以下条件全部满足时抑制 `missing-verification`：

- `kind` 为 `legacy-missing-verification`。
- `specCode + taskId` 与当前 Task 精确匹配。
- Task 当前状态为 `completed`。
- Task 当前仍缺少成功 verification。
- 登记项包含非空 `reason`、`createdAt` 和 `migrationId`。

重复 ID、重复 Task 键、引用不存在 Task、引用非 completed Task、引用已有成功 verification 的 Task，均报告新的 `invalid-exemption` 完整性问题。无登记项时维持现有 `missing-verification` 行为。

### TD-3：迁移计划是唯一执行输入

`src/core/remediation.ts` 定义固定迁移清单并提供：

```ts
planRepositoryRemediation(options): RepositoryRemediationPlan
applyRepositoryRemediation(options): RepositoryRemediationReport
```

计划器读取仓库当前状态，将每个目标分类为 `create` 或 `skip`，并返回：

- 待创建或已存在的 4 个 Decision Card。
- 待登记或已存在的 16 个 Task 豁免。
- 待创建或已存在的 Claude skill 文件。
- 阻止执行的冲突，例如同一 L1 已有语义不兼容决策、同一 Task 已有不同迁移豁免。

`--dry-run` 与真实执行调用同一个计划器。真实执行拒绝带冲突的计划，并在 `withProjectWriteTransaction` 中应用计划，确保部分失败不会留下半完成迁移。

### TD-4：Decision Card 基于确定性决策摘要

迁移清单为 4 个 implemented L1 提供人工审阅后的结构化决策摘要、理由和影响；不通过生成式推断在运行时临时编写内容：

- `l3-approval-L1`：一次显式 L3 审批直接冻结，保留人工实施门禁。
- `roadmap-openspec-L1`：以本地文件为事实源，补齐 agent 接入、视图和完成闭环。
- `spec-manager-ai-ux-L1`：通过场景化文档、skill 和测试改善 AI 使用体验；后续已废弃能力不写成当前推荐。
- `workflow-hardening-L1`：CLI 作为工作流事实源，统一 agent 指令并强化校验与提示。

幂等判断以 `docCode` 为主键。目标 L1 已存在 Decision Card 时跳过，不创建重复记录。

### TD-5：Claude 资产使用 merge-missing，不复用 force 覆盖

扩展 agent 安装能力，支持目录的 merge-missing 模式：递归枚举 bundled 资产，只复制目标中不存在的文件，已有文件统一记为 `skipped`。迁移只对以下目标启用该模式：

- `.claude/skills/spec-manager/rules/`
- `.claude/skills/spec-manager/templates/`

不调用 `project agents --force`，不删除目录，也不触碰 Claude 指令文件和人工配置。通用 agent 安装接口保留现有默认语义，避免无关行为变化。

### TD-6：迁移是显式、版本化、不可自动扩展的操作

CLI 新增：

```bash
spec-manager project remediate --migration repository-remediation-v1 --dry-run
spec-manager project remediate --migration repository-remediation-v1
```

必须显式传入迁移 ID。命令不会读取 doctor 输出后自动生成豁免，也不会接受“豁免所有当前问题”之类的宽泛参数。重复执行同一迁移只报告 `skipped`，不产生重复数据或覆盖文件。

## 受影响模块

| 模块 | 变更 |
|---|---|
| `src/core/remediation.ts` | 新增固定迁移清单、计划器、冲突检测和事务化执行器 |
| `src/core/integrity-exemptions.ts` | 新增豁免登记 schema、读取、验证和幂等合并 |
| `src/core/integrity.ts` | 识别有效历史豁免，并报告 `invalid-exemption` |
| `src/core/agents.ts` | 增加 merge-missing 目录复制能力和逐文件 dry-run 报告 |
| `src/core/decision.ts` | 复用现有决策创建能力，必要时暴露按 `docCode` 查询辅助函数 |
| `src/core/transaction.ts` | 复用项目写事务保证迁移原子性 |
| `src/cli/project.ts` | 新增 `project remediate` 命令和计划/结果输出 |
| `src/core/usability.ts` | doctor 展示新增的无效豁免问题 |
| `src/index.ts` | 导出新增公共类型与核心函数 |
| `src/core/__tests__/integrity*.test.ts` | 覆盖豁免严格匹配、无效登记和新问题发现 |
| `src/core/__tests__/remediation.test.ts` | 覆盖计划、dry-run、终态不可变、幂等和事务失败 |
| `src/core/__tests__/agents.test.ts` | 覆盖 Claude merge-missing 与不覆盖已有文件 |
| `src/cli/__tests__/project.test.ts` | 覆盖迁移 CLI 参数和输出 |

## 接口契约

### 完整性豁免

```ts
type IntegrityExemptionKind = 'legacy-missing-verification';

interface IntegrityExemption {
  id: string;
  kind: IntegrityExemptionKind;
  specCode: string;
  taskId: string;
  reason: string;
  createdAt: string;
  migrationId: string;
}

interface IntegrityExemptionRegistry {
  version: 1;
  exemptions: IntegrityExemption[];
}
```

- 读取不存在的登记文件等价于空登记表。
- 无法解析、版本不支持或字段非法时，完整性扫描报告 `invalid-exemption`，不得静默忽略。
- 写入前按 `id` 和 `specCode:taskId` 双重去重；冲突时拒绝迁移。

### 迁移计划

```ts
interface RepositoryRemediationPlan {
  migrationId: 'repository-remediation-v1';
  decisions: PlannedAction[];
  exemptions: PlannedAction[];
  agentAssets: PlannedAction[];
  conflicts: RemediationConflict[];
}

interface PlannedAction {
  action: 'create' | 'skip';
  target: string;
  detail: string;
}
```

- dry-run 不得写入任何项目文件，包括 audit。
- apply 必须重新生成计划，避免使用过期预览。
- 存在任一 conflict 时 apply 必须在写入前失败。
- apply 成功后再次计划，所有目标必须为 `skip` 且无 conflict。

### 终态不可变验证

迁移测试在执行前后读取 16 个 Task 文件原始字节并逐一比较。任何 Task 文件变化均视为迁移失败。该验证独立于对象级字段断言。

### R23 可执行操作映射

| 用户目标 | CLI / API |
|---|---|
| 预览迁移 | `spec-manager project remediate --migration repository-remediation-v1 --dry-run` |
| 执行迁移 | `spec-manager project remediate --migration repository-remediation-v1` |
| 验证仓库 | `spec-manager project doctor` / `inspectProjectIntegrity(paths)` |
| 查询补建决策 | `spec-manager decision list --topic <topic>` |

## L3 裂变计划

1. **repository-remediation-L3.1.1-exemptions**：实现豁免登记模型、严格有效性校验和完整性扫描集成。
2. **repository-remediation-L3.1.2-migration**：实现固定迁移清单、决策补建、计划器、dry-run、事务执行与 CLI。
3. **repository-remediation-L3.1.3-agent-assets**：实现 Claude skill merge-missing 资产补齐及端到端 doctor 验证。

三个 L3 按顺序实施：先建立豁免语义，再实现迁移执行，最后补齐 agent 资产并验证当前仓库归零。任何 L3 均不得修改 16 个历史 Task 文件。
