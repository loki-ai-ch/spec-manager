---
code: spec-manager-ai-ux-L3.1.3-encoding
level: L3
title: spec 编码格式改造 + 目录结构简化
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: >-
  8 步实施：generateSpecCode 改 topic-L<N>、specFilePath 适配 code-YYYYMMDD.md、CLI
  适配、迁移脚本、测试更新
created: '2026-06-05T04:29:24.478Z'
updated: '2026-06-05T04:45:17.290Z'
changeSummary: >-
  frozen → implemented: generateSpecCode 改 topic-L<N>，specFilePath 适配
  code-YYYYMMDD.md，CLI 适配，测试全部通过
---
# spec 编码格式改造 + 目录结构简化 — 实施规格

## 目标

实施 2026-06-05-159dad 的编码格式改造：将 spec code 从 `<YYYY-MM-DD>-<shortId>` 改为 `<topic>-L<N>`，目录名 = code，文件名 = code + `-` + 日期。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- `spec-manager spec show 2026-06-05-92884d --include-content` + `spec-manager spec show 2026-06-05-159dad --include-content`
- Read `src/core/spec-io.ts` — 确认 `generateSpecCode()` 逻辑（第 60-64 行）
- Read `src/core/paths.ts` — 确认 `specFilePath()` 逻辑（第 73-86 行）
- Read `src/cli/spec.ts` — 确认 `spec new` 命令逻辑（第 20-61 行）
- Read `src/core/__tests__/paths.test.ts` — 确认现有测试用例
- Read `templates/agent-plan.json` — 确认 planJson 字段名

### Step 2 — 修改 `generateSpecCode()` 为新格式

- **文件**: `src/core/spec-io.ts`
- **变更**: 修改 `generateSpecCode()` 函数签名，接收 `topic` 和 `level` 参数
- **新逻辑**: 返回 `${topic}-${level}`（如 `auth-L1`）
- **删除**: 原来的 `randomBytes` 逻辑
- 完成后 step_report outputJson:
  ```json
  {"summary": "generateSpecCode 改为 topic-L<N> 格式", "files": ["src/core/spec-io.ts"]}
  ```

### Step 3 — 修改 `specFilePath()` 适配新目录结构

- **文件**: `src/core/paths.ts`
- **变更**: 修改 `specFilePath()` 函数
- **旧逻辑**: `specs/<topic>/<code>/<code>.md`
- **新逻辑**: `specs/<topic>/<code>/<code>-<YYYYMMDD>.md`
  - 顶层 spec: `join(paths.specsDir, topic, code, `${code}-${date}.md`)`
  - 子 spec: `join(dirname(parentFilePath), code, `${code}-${date}.md`)`
- **新增**: 函数需要接收 `date` 参数（或从 `new Date()` 获取）
- 完成后 step_report outputJson:
  ```json
  {"summary": "specFilePath 适配新目录结构 code-YYYYMMDD.md", "files": ["src/core/paths.ts"]}
  ```

### Step 4 — 修改 `spec new` CLI 命令

- **文件**: `src/cli/spec.ts`
- **变更**: 修改 `spec new` 命令（第 20-61 行）
  - `--code` 参数描述更新为 `<topic>-L<N>` 格式
  - 自动生成逻辑: `code = opts.code ?? `${opts.topic}-${level}``
  - 传 `code` 给 `createSpec()`
- 完成后 step_report outputJson:
  ```json
  {"summary": "spec new 命令适配新编码格式", "files": ["src/cli/spec.ts"]}
  ```

### Step 5 — 修改 `createSpec()` 适配新文件路径

- **文件**: `src/core/spec-io.ts`
- **变更**: `createSpec()` 函数（第 144-198 行）
  - 调用 `specFilePath()` 时传入日期参数
  - 生成的占位 content 中标题使用新 code
- 完成后 step_report outputJson:
  ```json
  {"summary": "createSpec 适配新文件路径", "files": ["src/core/spec-io.ts"]}
  ```

### Step 6 — 更新 paths.test.ts 测试

- **文件**: `src/core/__tests__/paths.test.ts`
- **变更**: 更新所有测试用例的期望路径
  - 旧: `specs/auth/2026-06-04-a1b2c3/2026-06-04-a1b2c3.md`
  - 新: `specs/auth/auth-L1/auth-L1-20260604.md`
- 完成后 step_report outputJson:
  ```json
  {"summary": "paths.test.ts 测试用例更新", "files": ["src/core/__tests__/paths.test.ts"]}
  ```

### Step 7 — 编写迁移脚本

- **文件**: `src/core/migrate.ts`（新增）
- **功能**: 扫描现有 spec 文件，重命名为新格式
  - 读取 frontmatter 中的 `topic`, `level`, `code`, `created`
  - 新 code = `${topic}-${level}`
  - 新文件名 = `${newCode}-${YYYYMMDD}.md`
  - 移动文件到新目录结构
  - 更新 frontmatter 中的 `code` 字段
- **CLI**: `src/cli/project.ts` 新增 `migrate` 子命令
- 完成后 step_report outputJson:
  ```json
  {"summary": "迁移脚本编写完成", "files": ["src/core/migrate.ts", "src/cli/project.ts"]}
  ```

### Step 8 — 验证

- 运行 `pnpm test` 确认所有测试通过
- 手动测试: `spec-manager spec new L1 --topic test --title "测试"` 确认新格式
- 运行迁移脚本确认旧 spec 能正确迁移

## 验证命令

```bash
# 正向验证: 新建 spec 使用新格式
node dist/cli/index.js spec new L1 --topic demo --title "Demo"
# 预期: code=demo-L1, file=specs/demo/demo-L1/demo-L1-20260605.md

# 正向验证: 子 spec 嵌套正确
node dist/cli/index.js spec new L2 --topic demo --title "Demo L2" --parent demo-L1
# 预期: code=demo-L2, file=specs/demo/demo-L1/demo-L2/demo-L2-20260605.md

# 反向验证: code 重复时报错
node dist/cli/index.js spec new L1 --topic demo --title "Dup"
# 预期: ✗ code 重复: demo-L1

# 测试套件
pnpm test
# 预期: all tests pass
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "Read",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["2026-06-05-92884d"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: spec-io.ts + paths.ts + spec.ts + paths.test.ts"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "修改 generateSpecCode() 为 topic-L<N> 格式"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "修改 specFilePath() 适配 code-YYYYMMDD.md"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "修改 spec new CLI 命令适配新编码"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "修改 createSpec() 适配新文件路径"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "更新 paths.test.ts 测试用例"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "编写迁移脚本 migrate.ts + CLI migrate 命令"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "验证: pnpm test + 手动测试新格式"}
  ]
}
```

autoConfirm: false — 涉及目录结构变更，需用户确认迁移结果。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 代码问题 | `git revert <commit>` | < 2 min |
| 迁移脚本跑坏 | `git checkout -- specs/` 恢复原文件 | < 2 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 迁移脚本遗漏某些 spec | 迁移后跑 `spec list` 对比数量 |
| 新旧格式混用导致 findSpecByCode 失效 | 迁移脚本必须一次性完成，不支持部分迁移 |
