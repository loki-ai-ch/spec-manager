---
code: lifecycle-guidance-sync-L1
level: L1
title: 方法论落地与分发一致性加固
topic: lifecycle-guidance-sync
parentCode: null
status: implemented
aiSummary: 统一方法论、生命周期、R18、完成绕过和 Agent 资产语义；让 doctor 检测托管资产漂移，并以行为契约和发布验证保证实际 CLI 与仓库实现一致。
created: '2026-06-09T01:38:47.121Z'
updated: '2026-06-11T02:29:14.083Z'
changeSummary: 'cascade: task-complete'
---
# 方法论落地与分发一致性加固

## 背景

核心代码已实现分层生命周期、Task 完成门禁和 R18 决策卡片闭环，但代码走读发现方法论尚未端到端落地：

- 实际执行的全局 `spec-manager` 可能落后于仓库源码与本地构建，导致 R18 正常路径不可用。
- 已安装 `.claude/skills/spec-manager` 可能保留旧规则，而 `project doctor` 只检查目录存在，无法发现内容漂移。
- README、中文 README、规则、Skill 和方法论对生命周期、R18 与 `--force` 的描述不一致。
- `--force` 同时绕过 R18 与 verification commands，范围过宽且缺少结构化原因。
- 方法论契约测试只检查关键词，不能证明门禁行为、分发资产和公开文档一致。
- R18 当前接受只有 superseded/partial 的历史卡片，不能保证存在当前有效决策。

## 用户故事

1. 作为 Agent 使用者，我希望从任一入口获得与实际代码一致的方法论与生命周期指引。
2. 作为项目维护者，我希望 doctor 能发现托管 Agent 资产缺失或内容漂移，并给出安全修复命令。
3. 作为任务执行者，我希望异常绕过按能力拆分、必须说明原因并留下审计记录。
4. 作为规则维护者，我希望 R18 保证存在当前有效决策，而不只是任意历史卡片。
5. 作为发布者，我希望能验证用户实际调用的 CLI 与当前仓库构建一致。
6. 作为代码维护者，我希望行为契约测试能阻止方法论与实现再次漂移。

## 验收标准

1. **AC-1**: 规则、README、中文 README、Skill、方法论与状态机注释 MUST 使用一致的分层生命周期和 R18 正常路径描述。
2. **AC-2**: `project doctor` MUST 对已安装的托管 Agent 资产逐文件检测 missing 与 drift；检测不得静默覆盖用户文件。
3. **AC-3**: doctor MUST 为 drift 提供显式、可预览的同步动作，且同步动作 MUST 保持 dry-run、幂等与可审计。
4. **AC-4**: Task complete 的异常绕过 MUST 拆分为独立能力；每次绕过 MUST 要求非空原因并写入审计。
5. **AC-5**: 旧 `--force` MUST 不再作为无理由的全量绕过入口；兼容处理 MUST 明确报错或迁移指引。
6. **AC-6**: R18 正常完成 MUST 至少存在一张非 superseded、非 partial 的当前有效决策卡片。
7. **AC-7**: 自动化测试 MUST 覆盖生命周期级联、R18 活跃决策、完成绕过、doctor 资产漂移和公开文档契约。
8. **AC-8**: 发布验证 MUST 能比较实际 `spec-manager` 命令与当前仓库构建的版本或行为，并在不一致时失败。
9. **AC-9**: 更新后本地构建、实际 CLI 发布验证、`project doctor`、全量测试、lint、build 和 `git diff --check` MUST 通过。

## 范围边界

### 必须包含

- 同步生命周期、R18、verification 和异常绕过相关文档与 Agent 入口。
- 增强 doctor 和 Agent 资产同步能力，检测内容漂移。
- 拆分并审计 Task complete 异常绕过。
- 收紧 R18 当前有效决策判定。
- 增加行为契约与发布验证。
- 同步当前仓库已安装 Claude Skill 的托管副本。

### 明确不做

- 不自动覆盖无法确认归属的用户自定义 Agent 文件。
- 不修改与本主题无关的业务能力。
- 不伪造外部发布成功；实际全局安装需要明确执行并验证。
- 不回退当前工作树已有修改。

## 成功指标

- doctor 能稳定发现并指导修复托管资产漂移。
- 无理由全量绕过入口被消除，所有异常绕过可追溯。
- R18 不能被失效历史卡片满足。
- 方法论契约测试验证行为而非只匹配关键词。
- 用户实际调用的 CLI 与当前仓库构建验证一致。
