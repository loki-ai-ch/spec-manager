---
code: architecture-hardening-L1
level: L1
title: 架构一致性与审计可信度加固
topic: architecture-hardening
parentCode: null
status: implemented
aiSummary: 加固跨文件领域一致性和审计可信度：阻断 batch 流程绕过、冻结已完成任务、迁移 rename 引用、增加并发与事务保护、路径安全及 Core 规则收口。
created: '2026-06-08T09:32:22.044Z'
updated: '2026-06-09T01:36:43.890Z'
changeSummary: 'cascade: project-reconcile'
---
# 架构一致性与审计可信度加固

## 背景

spec-manager 以本地 Markdown/JSON 文件承载规格、任务、决策、变更和审计数据。当前单个命令与模块已有较完整测试，但跨文件、跨模块的领域不变量缺少统一约束，导致部分操作可以绕过流程门禁、破坏引用完整性或改写已完成的审计历史。

本需求旨在加固 spec-manager 自身的架构边界，使其对多 Agent、并发 CLI 和第三方 Core API 调用保持一致、可恢复、可验证的行为。

## 用户故事

1. 作为项目维护者，我希望任何任务被标记完成前都具有真实步骤结果和验证证据，避免流程命令伪造实施完成。
2. 作为使用多个 Agent 的团队，我希望并发操作不会静默覆盖彼此的状态更新。
3. 作为规格维护者，我希望重命名或归档规格时，所有关联引用保持完整，或操作在写入前明确失败。
4. 作为审计人员，我希望 completed task 和已落库历史不可被普通执行命令改写。
5. 作为 CLI 与 Core API 使用者，我希望无论通过哪种入口执行操作，都受到同一套领域规则约束。
6. 作为本地工具使用者，我希望所有路径参数均被限制在项目允许目录内。

## 验收标准

1. **AC-1**: 系统 MUST 禁止任何未执行计划步骤、未记录有效验证证据的快捷命令将 Task 或关联 Spec 推进为 completed/implemented。
2. **AC-2**: 系统 MUST 禁止普通 task report、step 或 verify 操作修改 completed/failed Task 的既有执行历史。
3. **AC-3**: 系统 MUST 在规格 RENAMED 操作中迁移全部结构化引用；若任一引用无法安全迁移，整个操作必须无部分写入地失败。
4. **AC-4**: 系统 MUST 为跨 Task、Spec、Decision、Change、Audit 的复合写操作提供一致性保护，并能够检测并发覆盖风险。
5. **AC-5**: 系统 MUST 对所有 change 名称和文件路径执行目录边界校验，禁止读取或写入允许目录之外的文件。
6. **AC-6**: Core API MUST 强制状态转换、引用存在性和输入 schema 等领域不变量，CLI 不得成为唯一规则执行层。
7. **AC-7**: 系统 MUST 检测同一 L3 的冲突活动任务，并对缺失决策卡片、缺失 verification evidence、悬空引用等仓库不一致状态提供可执行诊断。
8. **AC-8**: 自动化测试 MUST 覆盖流程绕过、completed task 改写、跨引用 rename、路径穿越、并发更新和复合写失败回滚。
9. **AC-9**: 现有合法 CLI 工作流和纯 Markdown/JSON、本地优先、无后端的产品约束 MUST 保持兼容。

## 范围边界

### 必须包含

- 收紧或移除 `task batch` 的自动成功行为。
- Task 生命周期与完成后历史不可变性。
- Spec rename 的仓库级引用完整性。
- 多文件复合操作的一致性、失败恢复和并发冲突检测。
- Change 路径安全。
- Core API 领域规则收口与输入校验。
- `project doctor` 或等价诊断对仓库级不变量的检查。
- 对应回归测试和迁移兼容策略。

### 明确不做

- 不引入远程后端、数据库或网络依赖。
- 不改变本地 Markdown/JSON 作为单一真相源的产品方向。
- 不重写全部 CLI 展示文案或交互界面。
- 不在本需求中增加新的规格层级或替换现有 L0/L1/L2/L3 方法论。
- 不自动修改用户已有的不一致数据；诊断与显式迁移必须分离。

## 成功指标

- 审核发现的高严重度流程绕过和历史改写路径全部被自动化测试阻断。
- 仓库级完整性检查能够发现悬空 parentCode、task specCode、decision docCode 和 relation target。
- 所有复合写操作在注入中途失败时不留下部分提交。
- 并发写入冲突能够被明确报告，不发生静默丢失更新。
- 现有合法测试集继续通过，并新增针对跨模块不变量的测试。
