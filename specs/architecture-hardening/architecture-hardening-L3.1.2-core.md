---
code: architecture-hardening-L3.1.2-core
level: L3
title: 路径安全与 Core 输入规则收口
topic: architecture-hardening
parentCode: architecture-hardening-L2.1
status: implemented
aiSummary: 统一 change 路径边界校验，并将 Spec schema、状态转换和 relation 引用规则收口到 Core API。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取路径 change 和 Spec Core 实现
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 实现 change 名称与目录边界守卫
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 收口 Spec schema 状态与 relation 校验
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 更新公共 API 导出契约
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 补充路径穿越和 Core 绕过测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证路径 Core 测试与类型检查
    status: pending
created: '2026-06-08T09:35:15.118Z'
updated: '2026-06-08T09:48:16.052Z'
changeSummary: 'cascade: task complete'
---
# 路径安全与 Core 输入规则收口

## 目标

落实 `architecture-hardening-L2.1` 的路径边界和 Core 规则强制，使 change 与 Spec 公共 API 无法绕过名称、状态、schema 和引用存在性校验。

## 实施步骤

1. 在 `src/core/paths.ts` 增加 `assertSafeChangeName` 与 `resolveWithin`。
2. 在 `src/core/delta.ts` 的全部 change 读取和写入入口统一使用路径守卫。
3. 在 `src/core/spec-io.ts` 读取时校验 frontmatter schema，更新状态时强制状态转换规则。
4. 在 `src/core/spec-io.ts` 添加 relation target 存在性及 relation 类型校验。
5. 更新 `src/index.ts` 导出严格路径与输入契约。
6. 在 paths/spec-io/delta/change CLI 测试中补充路径穿越和 Core 绕过回归用例。

## 验收标准

- 对应 `architecture-hardening-L1` 的 AC-5、AC-6、AC-8、AC-9。
- 所有 change 名称入口拒绝 `..`、绝对路径和目录逃逸。
- Core API 直接调用不能写入非法状态转换或悬空 relation。
- 已有合法 change/spec 工作流保持兼容。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-hardening-L3.1.2-core"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取路径 change 和 Spec Core 实现"},
    {"stepNo": 2, "stepType": "tool_action", "name": "实现 change 名称与目录边界守卫"},
    {"stepNo": 3, "stepType": "tool_action", "name": "收口 Spec schema 状态与 relation 校验"},
    {"stepNo": 4, "stepType": "tool_action", "name": "更新公共 API 导出契约"},
    {"stepNo": 5, "stepType": "tool_action", "name": "补充路径穿越和 Core 绕过测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证路径 Core 测试与类型检查"}
  ]
}
```

## 验证命令

```bash
npm test -- --run src/core/__tests__/paths.test.ts src/core/__tests__/spec-io.test.ts src/core/__tests__/delta.test.ts src/cli/__tests__/change.test.ts
npm run lint
```

## 回滚

回滚路径守卫和 Core 校验调用；保留新增测试作为风险记录。不得通过仅在 CLI 校验恢复旧行为。

