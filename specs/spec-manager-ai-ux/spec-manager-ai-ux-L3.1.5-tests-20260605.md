---
code: spec-manager-ai-ux-L3.1.5-tests
level: L3
title: 核心模块测试补全
topic: spec-manager-ai-ux
parentCode: spec-manager-ai-ux-L2.1
status: implemented
aiSummary: 6 个新测试文件：spec-io/validate/frontmatter/status/audit/delta
created: '2026-06-05T04:30:24.887Z'
updated: '2026-06-05T04:33:01.425Z'
changeSummary: confirmed → frozen
---
# 核心模块测试补全 — 实施规格

## 目标

实施 2026-06-05-159dad 的测试补全：为核心模块新增测试文件，覆盖 spec-io/validate/frontmatter/status/audit/delta。

**前置依赖**: 无

## 实施步骤

### Step 1 — 上下文收集

- Read `src/core/__tests__/task-cascade.test.ts` — 确认测试模式和 fixture 用法
- Read `src/core/__tests__/paths.test.ts` — 确认路径测试模式
- Read `src/core/__tests__/decision.test.ts` — 确认决策测试模式
- Read `src/core/validate.ts` — 确认校验逻辑
- Read `src/core/frontmatter.ts` — 确认 frontmatter 序列化逻辑
- Read `src/core/status.ts` — 确认状态机逻辑
- Read `src/core/audit.ts` — 确认审计逻辑

### Step 2 — 编写 spec-io.test.ts

- **文件**: `src/core/__tests__/spec-io.test.ts`（新增）
- **用例**:
  - `createSpec` 创建 L1/L2/L3，验证 frontmatter 字段
  - `readSpec` 读取已创建的 spec
  - `updateSpec` 更新 content/aiSummary/status
  - `findSpecByCode` 查找 + 找不到返回 null
  - `listAllSpecs` 列出所有 + 缓存失效
- 完成后 step_report outputJson:
  ```json
  {"summary": "spec-io.test.ts 编写完成", "files": ["src/core/__tests__/spec-io.test.ts"]}
  ```

### Step 3 — 编写 validate.test.ts

- **文件**: `src/core/__tests__/validate.test.ts`（新增）
- **用例**:
  - L1 必填段校验（背景/用户故事/验收标准/范围边界）
  - RFC 2119 关键字检测
  - planJson 校验（steps 数量/末步验证/字段名）
  - aiSummary 长度校验
- 完成后 step_report outputJson:
  ```json
  {"summary": "validate.test.ts 编写完成", "files": ["src/core/__tests__/validate.test.ts"]}
  ```

### Step 4 — 编写 frontmatter.test.ts

- **文件**: `src/core/__tests__/frontmatter.test.ts`（新增）
- **用例**:
  - `writeFrontmatter` 序列化 → `readSpec` 反序列化 roundtrip
  - 特殊字符转义（YAML 保留字符）
  - 空字段省略
- 完成后 step_report outputJson:
  ```json
  {"summary": "frontmatter.test.ts 编写完成", "files": ["src/core/__tests__/frontmatter.test.ts"]}
  ```

### Step 5 — 编写 status.test.ts

- **文件**: `src/core/__tests__/status.test.ts`（新增）
- **用例**:
  - 状态转换合法性（draft→confirmed→frozen→implemented）
  - 非法转换拒绝（draft→frozen 跳步）
  - `isActiveStatus` / `nextStatuses` 函数
- 完成后 step_report outputJson:
  ```json
  {"summary": "status.test.ts 编写完成", "files": ["src/core/__tests__/status.test.ts"]}
  ```

### Step 6 — 编写 audit.test.ts

- **文件**: `src/core/__tests__/audit.test.ts`（新增）
- **用例**:
  - `hit` 写入 audit.json
  - `report` 同步到平台
  - 累加计数正确性
- 完成后 step_report outputJson:
  ```json
  {"summary": "audit.test.ts 编写完成", "files": ["src/core/__tests__/audit.test.ts"]}
  ```

### Step 7 — 编写 delta.test.ts

- **文件**: `src/core/__tests__/delta.test.ts`（新增）
- **用例**:
  - `createChange` 创建 change 目录结构
  - `archiveChange` 合并到 specs
  - ADDED/MODIFIED/REMOVED 操作
- 完成后 step_report outputJson:
  ```json
  {"summary": "delta.test.ts 编写完成", "files": ["src/core/__tests__/delta.test.ts"]}
  ```

### Step 8 — 验证

- `pnpm test` 全部通过
- 检查测试文件数量 ≥8

## 验证命令

```bash
# 正向验证: 测试文件数量
ls src/core/__tests__/*.test.ts | wc -l
# 预期: ≥8

# 正向验证: 全部通过
pnpm test
# 预期: all tests pass
```

## 实施结果

- 6 个新测试文件全部编写完成
- 测试文件总数: 9（≥8 目标达成）
- 总测试数: 185（全部通过）
- 新增测试覆盖:
  - `spec-io.test.ts`: 29 tests — generateSpecCode / createSpec / readSpec / updateSpec / findSpecByCode / listAllSpecs
  - `validate.test.ts`: 20 tests — validateSpecContent (L0-L3) / validatePlanJson (INC-005 / R10 / R11)
  - `frontmatter.test.ts`: 9 tests — roundtrip / atomic write / stripUndefined / special chars
  - `status.test.ts`: 25 tests — canTransition / nextStatuses / isActiveStatus / isCompleteStatus
  - `audit.test.ts`: 17 tests — hit / readAudit / startSession / report / showSummary
  - `delta.test.ts`: 20 tests — createChange / getChangeDir / listChanges / parseDeltaFile / parseDeltaSpec / renderDeltaFile

## planJson (final)

```json
{
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 现有测试 + validate.ts + frontmatter.ts + status.ts + audit.ts"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "编写 spec-io.test.ts"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "编写 validate.test.ts"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "编写 frontmatter.test.ts"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "编写 status.test.ts"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "编写 audit.test.ts"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "编写 delta.test.ts"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "验证: pnpm test 全部通过"}
  ]
}
```

autoConfirm: true — 纯测试新增，不修改生产代码。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 测试写得不好 | 删除新增测试文件 | < 1 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| 测试依赖文件系统，CI 环境可能不同 | 使用 tmpdir 隔离，每个测试独立目录 |
