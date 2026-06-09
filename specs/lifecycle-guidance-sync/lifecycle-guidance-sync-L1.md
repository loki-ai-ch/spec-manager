---
code: lifecycle-guidance-sync-L1
level: L1
title: 生命周期规则与文档语义同步
topic: lifecycle-guidance-sync
parentCode: null
status: draft
aiSummary: >-
  同步分层生命周期语义到 R2、CLAUDE、skill、README、methodology 和状态机注释，并校验 bundled 与已安装 Claude
  flow-control rule 一致，防止 frozen-only 旧指引回归。
created: '2026-06-09T01:38:47.121Z'
updated: '2026-06-09T01:39:18.641Z'
changeSummary: 记录生命周期实现后残留的规则与文档语义冲突
---
# 生命周期规则与文档语义同步

## 背景

`lifecycle-reconciliation-L1` 已实现分层生命周期语义：

- L3 在 Task 完成后由 `frozen` 进入 `implemented`。
- L2/L1 在全部直接子规格 implemented 后，由 `confirmed` 受控级联进入 `implemented`。
- 历史滞留状态通过显式 `project reconcile` 对账。

但当前规则与文档仍存在 frozen-only 旧表述：

- `rules/flow-control.md` 声明唯一例外只有 `frozen → implemented`。
- `CLAUDE.md` 声明只有 Task complete 能触发 `frozen → implemented`。
- `src/core/status.ts` 注释仍把 frozen → implemented 描述为唯一自动级联。
- `README.md`、`readme_zh.md`、`docs/methodology.md` 和 `skill/SKILL.md` 未完整描述 L1/L2 confirmed 自动级联。
- 已安装的 `.claude/skills/spec-manager/rules/flow-control.md` 需要与 bundled rules 保持一致。

这些文本会使 Agent 错误地要求冻结 L1/L2，重新制造已经修复的生命周期矛盾。

## 用户故事

1. 作为 Agent 使用者，我希望所有入口文件对 L1/L2/L3 生命周期给出一致描述。
2. 作为规则维护者，我希望 R2 明确区分用户审批推进和受控自动级联。
3. 作为项目维护者，我希望 bundled rules 与当前仓库已安装的 Claude skill rules 保持一致。
4. 作为代码维护者，我希望状态机注释准确描述普通转换与 authority 特殊转换。

## 验收标准

1. **AC-1**: R2 MUST 明确：用户负责 L1/L2 draft → confirmed 与 L3 draft → frozen；Task complete 可推进 frozen L3，并在子规格全部完成时级联 confirmed L2/L1。
2. **AC-2**: 规则 MUST 明确 `project reconcile` 只能执行已审阅范围内的历史状态对账，不是通用人工状态绕过。
3. **AC-3**: `CLAUDE.md`、`skill/SKILL.md`、README 和方法论文档 MUST 使用一致的分层生命周期描述。
4. **AC-4**: `src/core/status.ts` 注释 MUST 区分普通状态机与受控 implementation authority。
5. **AC-5**: `.claude/skills/spec-manager/rules/flow-control.md` MUST 与 `rules/flow-control.md` 内容一致。
6. **AC-6**: 文档 MUST NOT 建议冻结 L1/L2 或使用 `spec implement --force` 完成正常级联。
7. **AC-7**: 自动化检查 MUST 扫描关键入口，阻止 frozen-only 旧表述再次出现。
8. **AC-8**: 更新后 `project doctor`、全量测试、lint、build 和 `git diff --check` MUST 通过。

## 范围边界

### 必须包含

- 更新 R2 生命周期与 authority 说明。
- 同步 `CLAUDE.md`、README、中文 README、methodology、skill 和状态机注释。
- 同步当前仓库 Claude skill 的 bundled rule 副本。
- 增加关键文本一致性自动化检查。

### 明确不做

- 不改变已实现的生命周期代码行为。
- 不新增状态转换、CLI 命令或迁移目标。
- 不修改任何 Task、Decision 或历史 spec 状态。
- 不扩展到与生命周期无关的文档重写。

## 成功指标

- 关键入口不再包含“只有 frozen → implemented”或“L1/L2 必须 frozen 才能级联”的错误描述。
- bundled 与已安装 Claude flow-control rule 完全一致。
- Agent 从任一入口均能得到同一生命周期规则。
- 全量验证与 doctor 保持通过。
