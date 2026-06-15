---
code: constraint-closed-loop-L1
level: L1
title: 约束闭环增强 — 机器可校验的验收与带错重试
topic: constraint-closed-loop
parentCode: null
status: implemented
aiSummary: >-
  约束闭环增强：task complete 前自动执行验证命令、L3 AC 支持 @verify 机器校验、 step failed
  上下文自动注入重试、verification 分层标记(compile/functional/smoke)、 audit show 输出
  compliance PASS/FAIL 判定
created: '2026-06-10T12:00:00.000Z'
updated: '2026-06-15T09:30:21.686Z'
changeSummary: 'cascade: task-complete'
---
# 约束闭环增强 — 需求文档

## 背景

spec-manager 已建立 L1→L2→L3→Task 的分层流程和 24 条规则，但验收机制仍依赖人工判断为主。执行复盘和外部实践（Qwen3.7-Max 实验）共同揭示了一个问题：**没有机器可校验的自动判据，闭环只是伪闭环**。

当前痛点：

1. **验收标准是文字描述，不是机器规则** — L1 AC 写的是"用户 SHALL 能..."，但没有人或机器去字面校验 AC 是否真被实现。task complete 只检查 status 级联，不检查 AC 覆盖率。
2. **task complete 缺少自动化前置检查** — 当前 task complete 只做 status 级联（frozen → implemented），不验证 lint/typecheck/test 是否通过。一个编译不过的代码也能标记 implemented。
3. **失败重试没有上下文注入** — step failed 后重试是人工操作，上一轮的错误信息不会自动注入下一轮。AI 每次重试都可能重复犯同样的错。
4. **verification 结构化程度不够** — verification 记录了 command/exitCode/summary，但没有区分"编译检查"、"功能验证"、"真机冒烟"等层级，无法做分层验收。
5. **规则审计只有命中计数，没有合规判定** — audit show 只显示各规则命中次数，不判定"本次 task 是否合规"。

## 用户故事

**US-1**: 作为 spec-manager 用户，我希望 task complete 时自动执行 lint/typecheck/test，这样我不会误把编译不过的代码标记为 implemented。

**US-2**: 作为 spec-manager 用户，我希望 L3 的验收标准能被机器字面校验（如"文件 X 必须存在"、"函数 Y 必须导出"），这样验收不依赖人工逐条检查。

**US-3**: 作为 spec-manager 用户，我希望 step failed 后的重试能自动带上上一轮的错误信息，这样 AI 不会重复犯同样的错。

**US-4**: 作为 spec-manager 用户，我希望 verification 能分层标记（编译/功能/冒烟），这样我能清楚知道代码通过了哪一层验收。

**US-5**: 作为 spec-manager 用户，我希望 audit show 能判定本次 session 是否合规（而非只显示计数），这样我能一眼看出流程是否被遵守。

## 验收标准

1. **AC-1**: `spec-manager task complete` 在级联 status 前 SHALL 执行 L3 验证命令（从 ## 验证命令 段提取），exitCode ≠ 0 时 SHALL 拒绝 complete 并输出错误摘要。

2. **AC-2**: L3 spec 的 ## 验收标准 段支持 `@verify` 标记语法（如 `- @verify: file-exists(src/index.ts)`），`spec-manager spec validate` SHALL 校验这些规则并在 task verify 时自动执行。

3. **AC-3**: `spec-manager task step --status failed` 的 outputJson SHALL 被持久化到 task record，下一次同 task 的 step_report 调用 SHALL 在 warnings 中包含上一轮失败摘要。

4. **AC-4**: verification 记录 SHALL 支持 `layer` 字段（值域: `compile` / `functional` / `smoke`），`task show` 输出 SHALL 按 layer 分组显示验收结果。

5. **AC-5**: `spec-manager audit show` SHALL 输出 `compliance: PASS | FAIL` 判定，判定规则为：最低合规基线（R1≥1 + R4≥1 + R13≥1 + R22≥1）全部满足时为 PASS，否则 FAIL。

## 范围边界

### 做

- task complete 自动化前置验证（AC-1）
- `@verify` 标记语法与自动校验（AC-2）
- 失败上下文自动注入重试（AC-3）
- verification 分层标记（AC-4）
- audit compliance 判定（AC-5）

### 不做

- 不做自动化 UI 测试 / E2E 测试框架
- 不做 CI/CD 集成（那是 deploy skill 的事）
- 不做 AC 覆盖率的自动追踪（需要代码级 AST 分析，超出当前范围）
- 不做跨 session 的失败上下文持久化（仅限同一 task 内）

## 度量指标

| 指标 | 基线 | 目标 | 测量方式 |
|------|------|------|---------|
| task complete 前自动验证通过率 | 0%（无自动验证） | 100%（所有 task complete 前执行验证） | audit 日志统计 |
| 失败重试上下文注入率 | 0%（人工重试） | 100%（同 task 内自动注入） | step_report warnings 统计 |
| audit compliance 判定可用性 | 无判定 | 每次 audit show 输出 PASS/FAIL | 功能验证 |
