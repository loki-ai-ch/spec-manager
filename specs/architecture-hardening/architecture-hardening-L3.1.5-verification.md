---
code: architecture-hardening-L3.1.5-verification
level: L3
title: 兼容迁移与跨模块验证
topic: architecture-hardening
parentCode: architecture-hardening-L2.1
status: implemented
aiSummary: 补齐旧数据兼容、端到端验证、提示和文档，确保加固规则可诊断且不自动改写历史。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取新增规则错误码和现有用户文档
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 补充旧数据兼容和端到端测试
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 更新 README 与方法论文档
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 校准 completion guide 与 flow 提示
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行全量测试类型检查和 doctor
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证全部架构加固验收标准
    status: pending
created: '2026-06-08T09:35:15.492Z'
updated: '2026-06-08T09:48:16.413Z'
changeSummary: 'cascade: task complete'
---
# 兼容迁移与跨模块验证

## 目标

补齐历史数据兼容、端到端验证和用户文档，使架构加固在现有本地项目中可诊断、可迁移且不静默改写历史。

## 实施步骤

1. 汇总前四个 L3 引入的新错误码、行为变化和 doctor 诊断。
2. 增加旧 completed Task 缺 verification、旧悬空引用和旧重复活动 Task 的兼容读取测试。
3. 增加 CLI 端到端测试，覆盖合法完整流程与所有新增拒绝路径。
4. 更新 `README.md`、`readme_zh.md` 和 `docs/methodology.md`，说明任务不可变性、成功 verification、事务与诊断行为。
5. 检查 completion、guide、flow status 对弃用 batch 和新增规则的提示一致性。
6. 运行全量测试、类型检查、project doctor，并记录剩余历史诊断。

## 验收标准

- 对应 `architecture-hardening-L1` 的 AC-8、AC-9。
- 旧数据可以读取和诊断，但不会被自动修复或补写。
- 合法 L1→L2→L3→Task→verification→complete 流程通过端到端测试。
- README 与方法论不再推荐会绕过执行证据的命令。
- 全量测试和类型检查通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-hardening-L3.1.5-verification"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取新增规则错误码和现有用户文档"},
    {"stepNo": 2, "stepType": "tool_action", "name": "补充旧数据兼容和端到端测试"},
    {"stepNo": 3, "stepType": "tool_action", "name": "更新 README 与方法论文档"},
    {"stepNo": 4, "stepType": "tool_action", "name": "校准 completion guide 与 flow 提示"},
    {"stepNo": 5, "stepType": "tool_action", "name": "运行全量测试类型检查和 doctor"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证全部架构加固验收标准"}
  ]
}
```

## 验证命令

```bash
npm test
npm run lint
node dist/cli/index.js project doctor
```

## 回滚

回滚兼容测试、提示和文档变更不会影响领域实现；不得删除揭示真实历史不一致的 doctor 诊断。

## 代码调查

- `src/core/completion.ts` 的命令列表仍包含 `task batch`，需与弃用行为同步。
- `src/core/usability.ts` 负责 guide 与 flow 的下一步提示，需检查是否推荐无 verification 的完成路径。
- `src/cli/project.ts` 提供 project doctor，是展示历史兼容诊断的入口。
- `src/core/__tests__/task-cascade.test.ts`、`src/core/__tests__/archive.test.ts` 和 `src/core/__tests__/audit.test.ts` 是跨模块回归测试基础。
- `README.md`、`readme_zh.md` 与 `docs/methodology.md` 共同定义用户可见工作流，必须同步更新。
