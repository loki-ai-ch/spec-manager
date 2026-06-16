---
code: architecture-refactor-L3.1.8-snapshot-scope-safety
level: L3
title: ProjectSnapshot 范围安全与消费者校验
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: >-
  为 ProjectSnapshot 增加 include/topic 范围元数据与消费者保护，避免 partial/topic snapshot 导致
  integrity、readiness 和 flow 假结果。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 补充 snapshot 范围错误消费者回归测试
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 增加 ProjectSnapshot scope 元数据与范围 helper
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 加固 integrity、doctor、flow、readiness 和 advice 消费者
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 验证 snapshot 专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-11T09:11:18.838Z'
updated: '2026-06-11T09:19:26.090Z'
changeSummary: 'cascade: task-complete'
---
# ProjectSnapshot 范围安全与消费者校验

## 目标

修复 ProjectSnapshot 公开注入 API 的范围不透明问题。当前 snapshot 支持 `include` 和 `topic`，但返回模型不记录构建范围；消费者接收任意 snapshot 后直接使用空集合/过滤集合，可能产生错误诊断和错误操作提示。

本 L3 要求：

1. snapshot 明确携带其 include/topic scope。
2. 需要全项目完整数据的消费者不得静默接受 partial/topic snapshot。
3. 只需要 specs 或指定 topic 的消费者必须验证 snapshot 覆盖所需范围；不满足时明确报错或重新构建正确 snapshot。

## 代码调查

- `buildProjectSnapshot(paths, { include: ['specs'] })` 合法返回 tasks/decisions/incidents/changes 空集合，但 `inspectProjectIntegrity(paths, { snapshot })` 会把这些空集合当成全项目事实。
- `buildProjectSnapshot(paths, { topic: 'billing' })` 的 `specByCode` 不含其他 topic；若 billing spec 引用 auth spec，integrity 会误报 dangling reference。
- `assessImplementationReadiness` 接受 snapshot 后仅在目标 spec 缺失时回退 `findSpecByCode`，children 仍取自不完整 index，可能误报 `no-children`。
- `getFlowStatus`、`suggestAfterSpecCommand`、`getUpstreamFreezeAdvice` 接收 snapshot，但无法判断是否覆盖请求 topic/spec。

## 实施步骤

### Step 1 - 补充范围错误回归测试

- topic snapshot 注入 integrity 时不得产生跨 topic dangling 假阳性。
- specs-only snapshot 注入 integrity 时不得把缺失集合解释为真实空集合。
- unrelated topic 或缺 specs 的 snapshot 注入 readiness/flow/advice 时不得误报 `no-children` 或错误下一步。

### Step 2 - 增加 snapshot scope 契约

- `ProjectSnapshot` 增加只读 scope 元数据，至少包含实际 `include` 与 `topic`。
- 新增可复用范围判断/断言 helper，支持：
  - 判断集合是否 included；
  - 判断 snapshot 是否为全项目；
  - 判断 snapshot 是否覆盖指定 topic。
- 保持现有集合和 indexes 字段兼容。

### Step 3 - 加固消费者

- `inspectProjectIntegrity` 和 `runProjectDoctor` 需要全项目完整 snapshot；注入不满足时重新构建全量 snapshot，避免假阳性。
- `assessImplementationReadiness`、`getFlowStatus`、`suggestAfterSpecCommand`、`getUpstreamFreezeAdvice` 在 snapshot 不覆盖所需 specs/topic 时重新构建合适 snapshot。
- 保持现有无 snapshot 调用签名和 CLI 输出兼容。

### Step 4 - 验证

- 运行 snapshot/integrity/usability/view/lifecycle 专项测试、全量测试、lint 和 project doctor。

## 验证命令

```bash
npm test -- src/core/__tests__/project-snapshot.test.ts src/core/__tests__/integrity.test.ts src/core/__tests__/usability.test.ts src/core/__tests__/view.test.ts src/core/__tests__/lifecycle.test.ts
npm test
npm run lint
spec-manager project doctor
```

## 验收标准

1. **AC-1**: ProjectSnapshot 暴露 include/topic scope，调用方可判断其数据覆盖范围。
2. **AC-2**: partial/topic snapshot 不会导致 integrity 跨 topic dangling、missing decision/task/change 假阳性。
3. **AC-3**: 不覆盖目标 spec/topic 的 snapshot 不会导致 readiness/flow/advice 错误结果。
4. **AC-4**: 默认全量 snapshot 和现有 CLI 行为保持兼容。
5. **AC-5**: 专项测试、全量测试、lint 和 project doctor 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.8-snapshot-scope-safety"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "补充 snapshot 范围错误消费者回归测试"},
    {"stepNo": 2, "stepType": "tool_action", "name": "增加 ProjectSnapshot scope 元数据与范围 helper"},
    {"stepNo": 3, "stepType": "tool_action", "name": "加固 integrity、doctor、flow、readiness 和 advice 消费者"},
    {"stepNo": 4, "stepType": "tool_action", "name": "验证 snapshot 专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：修改公开 ProjectSnapshot 模型和多个消费者读取策略，需要人工审批。

## 回滚方案

若消费者输出回归，回退消费者自动重建逻辑并保留 scope 元数据；若 scope 字段影响公共类型兼容，改为可选字段并对旧 snapshot 保守视为不完整后重新构建。
