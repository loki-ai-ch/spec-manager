---
code: architecture-refactor-L3.1.17
level: L3
title: 归档 ADDED 占位定义歧义修复
topic: architecture-refactor
parentCode: architecture-refactor-L2.1
status: implemented
aiSummary: 在归档 planning 阶段拒绝同一 ADDED code 的多个占位定义，避免目录遍历顺序决定 topic 与 parent 元数据。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: 补充多 topic 重复占位与单一占位回归测试
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 增加 ADDED 占位候选唯一性校验
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 保持占位元数据优先级与归档兼容
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 验证归档专项测试、全量测试、lint 和 project doctor
    status: pending
created: '2026-06-12T01:49:00.870Z'
updated: '2026-06-12T01:55:13.909Z'
changeSummary: 'cascade: task-complete'
---
# 归档 ADDED 占位定义歧义修复

## 目标

在归档修改磁盘前拒绝同一 `ADDED` spec code 的多个占位定义，避免目录遍历顺序静默决定新 spec 的 topic、level、title 与 parentCode。

## 代码调查

- `getChangeDir` 会扫描 `changes/<name>/specs/<topic>/<code>/<code>.md`，并把所有占位文件加入 `specFiles`。
- 同一 code 可以分别出现在多个 topic 目录下，扫描层当前不会报告冲突。
- `resolveAddedMetadata` 按 `filePath.endsWith('/<code>.md')` 查找候选，命中第一个后立即 `break`。
- `readdirSync` 返回顺序不是业务契约；即使当前平台表现稳定，也不应由文件系统遍历顺序决定 spec 所属 topic 或 parent。
- 未被选中的重复占位仍会随 change 一起归档，导致归档成功但实际应用定义与 change 内容歧义。

## 实施步骤

### Step 1 - 补充重复占位回归测试

- 覆盖同一 `ADDED` code 在两个不同 topic 下各有占位文件。
- 两个占位使用不同 title、level 或 parentCode，证明静默择一会改变行为。
- 断言 planning 与 archive 均在写盘前拒绝，错误包含 spec code 与所有候选路径或 topic。
- 保留单一占位以及多个不同 ADDED code 各自单一占位的成功行为。

### Step 2 - 增加候选唯一性校验

- `resolveAddedMetadata` 先收集同一 entry code 的全部占位候选。
- 候选为零时保持现有“无法推断”错误。
- 候选大于一时返回明确“占位定义歧义”错误，并列出候选位置。
- 仅候选唯一时读取占位 frontmatter 并继续现有 metadata 与 parent 校验。

### Step 3 - 保持现有兼容

- 保持占位 frontmatter 优先于 delta entry 的 level、title、parentCode 规则。
- 保持单一占位的 topic 推断、ADDED 创建、替换操作和失败回滚行为。
- 不改变 `getChangeDir` 的展示能力或占位目录格式。
- 不自动选择、合并或删除重复占位。

### Step 4 - 验证

- 运行 archive-plan、archive、delta 与 change CLI 专项测试。
- 运行全量测试、lint、build、installed CLI drift、project doctor 和 `git diff --check`。

## 验证命令

```bash
npm test -- src/core/__tests__/archive-plan.test.ts src/core/__tests__/archive.test.ts src/core/__tests__/delta.test.ts src/cli/__tests__/change.test.ts
npm test
npm run lint
npm run build
npm run verify:installed-cli
spec-manager project doctor
git diff --check
```

## 验收标准

1. **AC-1**: 同一 ADDED code 存在多个 topic 占位时，planning 阶段拒绝且不产生磁盘写入。
2. **AC-2**: 错误信息包含冲突 spec code，并列出全部候选路径或 topic。
3. **AC-3**: `archiveChange` 遇到重复占位时不创建 spec、不移动 change、不写 archive。
4. **AC-4**: 单一占位及多个不同 code 各自单一占位保持兼容。
5. **AC-5**: 专项测试、全量测试、lint、build、installed CLI drift、project doctor 和 diff check 全部通过。

## planJson (final)

```json
{
  "coveredSpecs": ["architecture-refactor-L3.1.17"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "补充多 topic 重复占位与单一占位回归测试"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "增加 ADDED 占位候选唯一性校验"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "保持占位元数据优先级与归档兼容"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证归档专项测试、全量测试、lint 和 project doctor"}
  ]
}
```

autoConfirm: false。理由：该修复新增 ADDED 输入拒绝条件并定义重复占位的错误语义，需要人工批准。

## 回滚方案

若候选唯一性校验错误阻断合法 ADDED，保留重复占位回归测试并回退实现；后续可在明确跨 topic 占位合并契约后扩展，但不得恢复静默择一行为。
