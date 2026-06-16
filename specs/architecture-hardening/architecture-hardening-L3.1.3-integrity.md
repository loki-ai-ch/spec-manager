---
code: architecture-hardening-L3.1.3-integrity
level: L3
title: 仓库完整性扫描与 doctor 诊断
topic: architecture-hardening
parentCode: architecture-hardening-L2.1
status: implemented
aiSummary: 新增只读仓库完整性扫描器，检查悬空引用、生命周期矛盾和缺失审计证据，并接入 project doctor。
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 repository doctor 与元数据模型
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 实现仓库引用与生命周期扫描器
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 接入 project doctor 诊断输出
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 导出结构化完整性公共接口
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 补充完整性和 doctor 回归测试
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证完整性测试与类型检查
    status: pending
created: '2026-06-08T09:35:15.249Z'
updated: '2026-06-08T09:48:16.174Z'
changeSummary: 'cascade: task complete'
---
# 仓库完整性扫描与 doctor 诊断

## 目标

实现只读的仓库级完整性扫描器，并通过 project doctor 报告结构化引用和审计历史问题，不自动修改已有数据。

## 实施步骤

1. 创建 `src/core/integrity.ts`，定义 `IntegrityIssue` 和扫描入口。
2. 扫描 Spec parent/relation、Task specCode、Decision docCode、Incident 和 task-linked Change 引用。
3. 检测冲突活动 Task、缺失成功 verification、缺失 Decision 和终态 Task 步骤异常。
4. 在 `src/cli/project.ts` 的 doctor 输出问题、来源文件和修复建议。
5. 从 `src/index.ts` 导出结构化完整性接口。
6. 新增 `src/core/__tests__/integrity.test.ts` 并扩展 project doctor CLI 测试。

## 验收标准

- 对应 `architecture-hardening-L1` 的 AC-7、AC-8、AC-9。
- 扫描器发现悬空结构化引用和仓库级生命周期矛盾。
- doctor 只报告问题，不自动修改文件。
- 现有合法仓库不产生错误级误报。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-hardening-L3.1.3-integrity"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 repository doctor 与元数据模型"},
    {"stepNo": 2, "stepType": "tool_action", "name": "实现仓库引用与生命周期扫描器"},
    {"stepNo": 3, "stepType": "tool_action", "name": "接入 project doctor 诊断输出"},
    {"stepNo": 4, "stepType": "tool_action", "name": "导出结构化完整性公共接口"},
    {"stepNo": 5, "stepType": "tool_action", "name": "补充完整性和 doctor 回归测试"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证完整性测试与类型检查"}
  ]
}
```

## 验证命令

```bash
npm test -- --run src/core/__tests__/integrity.test.ts src/cli/__tests__/usability.test.ts
npm run lint
```

## 回滚

删除完整性扫描器和 doctor 接入即可回滚。扫描器是只读模块，不应包含数据修复逻辑。

