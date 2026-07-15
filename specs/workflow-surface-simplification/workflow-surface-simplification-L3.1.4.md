---
code: workflow-surface-simplification-L3.1.4
level: L3
title: README Onboarding Surface Refresh
topic: workflow-surface-simplification
parentCode: workflow-surface-simplification-L2.1
status: implemented
aiSummary: >-
  刷新 README onboarding surface：中文和英文 README 默认推荐 next、brief、dashboard，清楚区分终端命令与
  AI 聊天请求，并把旧 guide/assist/flow 放入 advanced/compatibility 语境。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: Read frozen L3 and current Chinese English README onboarding sections
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: Refresh Chinese README onboarding and command surface
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: Refresh English README onboarding and command surface
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: Run docs consistency and targeted README related tests
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm run lint and npm run build
    status: pending
relations:
  - type: based_on
    target: workflow-surface-simplification-L2.1
created: '2026-07-15T03:01:39.469Z'
updated: '2026-07-15T03:14:28.709Z'
changeSummary: 'cascade: task-complete'
---
# README Onboarding Surface Refresh

## 背景

`workflow-surface-simplification-L3.1.1` 到 `workflow-surface-simplification-L3.1.3` 已经实现了 `next`、`dashboard`、`brief` 三个 core quick path 入口，并更新了 Agent guidance。README 仍然主要展示 `project init`、`project agents`、`guide`、`flow status` 和 `assist` 命令，用户第一眼看到的仍是旧入口。

本实施规格负责把 README onboarding surface 调整到新的短路径，让中文 README 第一屏和英文 README 都明确推荐 `next / brief / dashboard`，同时保留高级命令说明。

## 目标

- 中文 README 的 5 分钟开始和最短路径 MUST 推荐 `spec-manager next`、`spec-manager brief`、`spec-manager dashboard`。
- 英文 README MUST 同步说明新入口，避免中英文文档分叉。
- README MUST 清楚区分终端命令与 AI 聊天请求。
- 旧命令 `guide`、`assist guide`、`flow status` MUST 保留在 advanced/compatibility 语境，不作为默认第一入口。
- 文档 MUST 保持 Design Context、adaptive workflow 和 multi-agent setup 说明准确。

## 非目标

- 不改 CLI 行为。
- 不改 agent templates；它们已由上一条实施规格处理。
- 不改 package metadata 或发布版本号。
- 不新增 external specs root/store 文档；该能力尚未实现。

## 涉及文件

- `README.md`: 中文优先 README。
- `readme_en.md`: 英文 README。
- 如文档检查要求，可同步少量 docs 入口，但本规格不主动扩散到全部文档。

## 实施步骤

1. 阅读当前 README 和英文 README 的 onboarding、最短路径、assist、常用命令段落。
2. 将默认上手路径调整为：
   - 初始化项目。
   - 安装/检测 agent support。
   - 用 `spec-manager next "<work>"` 判断下一步。
   - 用 `spec-manager brief "<work>"` 生成 Agent 上下文。
   - 用 `spec-manager dashboard` 查看项目状态。
3. 保留完整手动 L1/L2/L3/Task 链路示例，明确其为 advanced/manual path。
4. 更新 Design Context 段落中读取设计上下文的推荐命令为 `spec-manager brief "<UI request>"`，保留 `assist design-*` 命令。
5. 更新常用命令表，把 `next`、`brief`、`dashboard` 放在 guide/flow 前。
6. 运行 docs consistency、targeted tests、lint/build。

## 接口契约

README 示例命令必须使用已实现命令：

```bash
spec-manager next "新增用户认证"
spec-manager brief "新增用户认证"
spec-manager dashboard
```

英文 README 对应使用：

```bash
spec-manager next "add user authentication"
spec-manager brief "add user authentication"
spec-manager dashboard
```

不得把尚未实现的 external store/setup/profile 命令写成可用能力。

## 验收标准

1. **AC-1**: 中文 README MUST 在最短路径中推荐 `next`、`brief`、`dashboard`。
2. **AC-2**: 英文 README MUST 同步推荐 `next`、`brief`、`dashboard`。
3. **AC-3**: README MUST 清楚说明终端命令和 AI 聊天请求分别在哪里使用。
4. **AC-4**: 旧 `guide` / `assist guide` / `flow status` MUST 仍可在 advanced 或 compatibility 段落找到。
5. **AC-5**: Design Context 文档 MUST 推荐 `spec-manager brief "<UI request>"` 作为默认读取设计上下文入口。
6. **AC-6**: 文档不得宣称 external specs root/store 已实现。
7. **AC-7**: docs consistency、lint、build MUST 通过。

## 验证命令

```bash
node dist/cli/index.js project docs check
npm test -- src/cli/__tests__/usability.test.ts src/cli/__tests__/capability.test.ts src/core/__tests__/workflow-surface.test.ts
npm run lint
npm run build
```

## 风险与回滚

- 风险：README 过度强调短路径可能让用户忽略强门禁。需要保留完整手动链路和“不会绕过审核”的说明。
- 风险：中英文 README 不一致。实施时应并排更新关键段落。
- 回滚：恢复 README/readme_en.md 文案，已实现 CLI 能力不受影响。
