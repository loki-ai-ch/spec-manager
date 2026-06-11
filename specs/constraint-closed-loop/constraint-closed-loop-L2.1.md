---
code: constraint-closed-loop-L2.1
level: L2
title: 技术方案：约束闭环增强
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L1
status: confirmed
created: '2026-06-10T13:00:00.000Z'
updated: '2026-06-10T13:30:00.000Z'
aiSummary: >-
  L2 拆 3 个 L3：L3.1.1 @verify 规则解析执行(AC-2)、L3.1.2 task-complete
  验证钩子+step failed 注入+verification layer(AC-1/3/4)、L3.1.3 audit
  compliance 格式+task show 分组(AC-5)。关键：@verify 放验收标准段内、
  complete 默认拒绝验证失败、失败通过 warnings 注入、layer 固定枚举
changeSummary: 用户确认 L2，进入 confirmed
---
# 技术方案：约束闭环增强 — 技术设计

## 方案概述

把 `constraint-closed-loop-L1` 的 5 条 AC 拆成 3 个可独立实施的模块：

1. **@verify 机器校验**（AC-2）— 新增 `src/core/verify.ts`，解析 L3 验收标准中的 `@verify` 标记并自动执行
2. **task-complete 验证钩子**（AC-1 + AC-3）— 修改 `src/core/task.ts`，complete 前自动执行验证命令，step failed 上下文注入重试
3. **verification 分层 + audit 合规**（AC-4 + AC-5）— 扩展 verification 数据模型，调整 task show 输出，audit compliance 已基本可用只需微调

架构关系：

```
[L3 ## 验收标准] ──@verify 解析──> [VerifyRule[]] ──执行──> [VerifyResult[]]
[L3 ## 验证命令] ──提取命令──────> [CommandExec] ──exitCode──> [pass/fail]
[task step failed] ──outputJson──> [task record] ──warnings──> [下次 step_report]
[verification] ──layer 字段──────> [task show 分组显示]
[audit state] ──checkCompliance──> [compliance: PASS/FAIL]
```

## 技术决策

| 问题 | 候选选项 | 选定 | 理由 |
|---|---|---|---|
| @verify 语法位置 | A: L3 验收标准段内 B: 独立段 C: frontmatter | A | 验收标准和机器校验规则在同一段，减少上下文切换 |
| @verify 规则类型 | A: 内置规则(file-exists/export-exists/command) B: 纯命令执行 C: 插件式 | A | 内置规则覆盖 80% 场景，command 兜底任意校验 |
| task complete 验证失败处理 | A: 拒绝 complete B: warning 允许继续 C: --force 跳过 | A + C | 默认拒绝保证质量，--force 用于紧急场景 |
| 失败上下文注入方式 | A: warnings 数组追加 B: 独立字段 C: 写文件 | A | 复用现有 warnings 机制，不改 task JSON 结构 |
| verification layer 枚举 | A: compile/functional/smoke 三级 B: 自由文本 C: 数字优先级 | A | 固定枚举便于分组和排序，覆盖主要验收层级 |
| audit compliance 现状 | 已有 checkCompliance + showSummary | 微调 | R18 已在基线中，L1 描述略有过时；保持现状 |

## 受影响模块

| 模块/路径 | 变更类型 | 范围 | 测试策略 |
|---|---|---|---|
| `src/core/verify.ts` | **新增** | @verify 规则解析 + 执行（file-exists/export-exists/command） | 单元测试覆盖三种规则类型 + 边界 case |
| `src/core/task.ts` | 修改 | `completeTaskUnlocked()` 增加验证命令执行；`reportStep()` 失败时持久化 outputJson；`addTaskVerification()` 增加 layer 参数 | 现有测试 + 新增 complete 前验证、失败注入、layer 测试 |
| `src/core/harness.ts` | 修改 | `buildHarnessTaskContext()` 在 warnings 中追加上次失败摘要 | 现有测试 + 新增失败注入测试 |
| `src/core/validate.ts` | 修改 | `validateSpecContent()` 增加 @verify 语法校验（warning-only） | 现有测试 + 新增 @verify 校验测试 |
| `src/core/invariants.ts` | 修改 | `assertTaskHasSuccessfulVerification()` 可选按 layer 检查 | 现有测试 + 新增 layer 过滤测试 |
| `src/cli/task.ts` | 修改 | `task show` 输出按 layer 分组 verification；`task verify` 增加 `--layer` 参数 | CLI 输出测试 |
| `src/core/audit.ts` | 微调 | `showSummary()` compliance 格式统一为 `PASS/FAIL`（去掉 ✓/✗ 前缀） | 现有测试更新 |

## 数据模型

### TaskVerificationRecord 扩展

| 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|
| `layer` | `'compile' \| 'functional' \| 'smoke'` | **新增** | `'functional'` | 是（旧记录无 layer 时显示为 functional） |

### TaskRecord 扩展

| 字段 | 类型 | 变更 | 默认值 | 向后兼容 |
|---|---|---|---|---|
| `lastFailedOutput` | `string \| null` | **新增** | `null` | 是（旧 task 无此字段） |

### VerifyRule（新增类型，不持久化）

```typescript
type VerifyRule =
  | { type: 'file-exists'; path: string }
  | { type: 'export-exists'; file: string; symbol: string }
  | { type: 'command'; cmd: string };
```

## 接口契约

### @verify 标记语法

在 L3 spec 的 `## 验收标准` 段中使用：

```markdown
## 验收标准

1. **AC-1**: 用户 SHALL 能通过 CLI 创建 spec
2. @verify: file-exists(src/cli/spec.ts)
3. @verify: export-exists(src/core/spec-io.ts, findSpecByCode)
4. @verify: command(npm run lint)
```

**解析规则**：
- `@verify:` 开头的行被解析为机器校验规则
- `file-exists(path)` — 检查文件是否存在
- `export-exists(file, symbol)` — 检查文件是否导出指定符号
- `command(cmd)` — 执行命令，exitCode=0 为通过
- 不在 `## 验收标准` 段内的 `@verify` 行被忽略

### CLI: `spec-manager task complete <taskId>`

**新增前置行为**：

1. 从 L3 spec `## 验证命令` 段提取命令
2. 从 L3 spec `## 验收标准` 段提取 `@verify` 规则
3. 依次执行，任一 exitCode ≠ 0 时拒绝 complete

**成功输出**：
```text
✓ 验证命令通过 (3/3)
✓ @verify 规则通过 (2/2)
✓ task T-001 completed
  cascaded: constraint-closed-loop-L3.1.1 → implemented
```

**验证失败**：
```text
✗ 验证命令失败 (2/3):
  ✓ npm run lint
  ✗ npm test (exit 1):
    FAIL src/core/__tests__/verify.test.ts
    ...
✗ task complete 拒绝：验证未通过
  使用 --force 跳过验证（不推荐）
```

**新增参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `--force` | boolean | 跳过验证命令执行（紧急场景） |
| `--skip-verify` | boolean | 跳过 @verify 规则执行 |

### CLI: `spec-manager task step --status failed`

**新增行为**：outputJson 被持久化到 `task.lastFailedOutput`，下次同 task 的 `reportStep` 调用在 warnings 中输出：

```text
⚠ 上次 step #3 失败摘要: {"summary":"编译错误: ...","error":"..."}
```

### CLI: `spec-manager task verify <taskId>`

**新增参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `--layer` | `compile \| functional \| smoke` | 按 layer 过滤 verification 记录 |

### CLI: `spec-manager task show <taskId>`

**verification 输出变更**：

```text
verifications:
  [compile]
    V-001: npm run lint → exit 0 (2026-06-10)
    V-002: npx tsc --noEmit → exit 0 (2026-06-10)
  [functional]
    V-003: npm test → exit 0 (2026-06-10)
  [smoke]
    V-004: node dist/cli/index.js --help → exit 0 (2026-06-10)
```

### CLI: `spec-manager audit show`

**compliance 输出格式统一**：

```text
compliance: PASS
  ✓ R1: 3 (min 1)
  ✓ R4: 2 (min 1)
  ✓ R13: 1 (min 1)
  ✓ R18: 1 (min 1)
  ✓ R22: 2 (min 1)
```

或：
```text
compliance: FAIL
  ✓ R1: 3 (min 1)
  ✗ R4: 0 (min 1)
  ...
```

## 容错与降级

| 场景 | 影响 | 降级策略 | 恢复方式 |
|---|---|---|---|
| L3 无 `## 验证命令` 段 | 无法提取验证命令 | 跳过命令执行，仅执行 @verify 规则 | 补充验证命令段 |
| L3 无 `## 验收标准` 段 | 无法提取 @verify 规则 | 跳过 @verify 执行，仅执行验证命令 | 补充验收标准段 |
| @verify: file-exists 路径不存在 | 校验失败 | 输出缺失文件路径 | 创建文件 |
| @verify: command 执行超时 | 校验失败 | 30s 超时，输出 timeout 错误 | 优化命令或增加超时 |
| 旧 task JSON 无 lastFailedOutput | 无失败上下文 | warnings 中不输出 | 无需恢复，新 task 自动包含 |
| 旧 verification 无 layer | 分组显示 | 默认归类为 `functional` | 无需恢复 |
| --force 跳过验证 | 代码可能有问题 | 输出 warning 标记已跳过 | 后续手动验证 |

## 向后兼容

- **Task JSON**: `lastFailedOutput` 和 `layer` 都是新增字段，旧 task 文件无需迁移
- **CLI**: `task complete` 新增验证是增强行为，`--force` 提供逃生口
- **@verify 语法**: 纯新增，不影响现有 L3 spec 内容
- **audit compliance**: 已有功能，仅输出格式微调

## 关键交互流程

### task complete 自动验证

```
用户 → task complete T-001
  ├─ findTaskById
  ├─ assertTaskTransition(running → completed)
  ├─ extractVerificationCommands(L3 ## 验证命令)  ← 新增
  │   └─ 逐条执行，收集 exitCode
  ├─ extractVerifyRules(L3 ## 验收标准)           ← 新增
  │   └─ 逐条执行 file-exists/export-exists/command
  ├─ 任一失败?
  │   └─ 拒绝 complete，输出错误摘要
  ├─ R5: 检查所有 step 已 succeeded
  ├─ assertTaskHasSuccessfulVerification
  ├─ cascade implemented
  └─ R18: 检查决策卡片
```

### step failed 上下文注入

```
reportStep(status=failed, outputJson="...")
  ├─ 写入 task.steps[idx].status = failed
  ├─ 写入 task.lastFailedOutput = outputJson  ← 新增
  └─ 返回 { task, spec, warnings }

下次 reportStep(同一 task):
  ├─ 读取 task.lastFailedOutput
  ├─ 非 null?
  │   └─ warnings.push("上次 step #N 失败摘要: ...")  ← 新增
  └─ 正常执行
```

### @verify 解析与执行

```
validateSpecContent(L3, content)
  ├─ 现有检查: 必填段、RFC 2119、R17、R23...
  ├─ parseVerifyRules(content, '验收标准')  ← 新增
  │   └─ 逐行匹配 @verify: 语法
  └─ 返回 ValidationWarning[] (含 @verify 语法警告)

executeVerifyRules(rules: VerifyRule[]): VerifyResult[]
  ├─ file-exists: existsSync(path)
  ├─ export-exists: 读取文件，grep export 语句
  └─ command: execSync(cmd, { timeout: 30000 })
```

## 可观测性

- **日志**: 验证命令执行输出到 stdout；@verify 结果以 ✓/✗ 前缀逐行输出
- **指标**: verification 记录包含 layer + exitCode + summary，可统计各层通过率
- **告警**: task complete 验证失败时输出完整错误上下文，不吞错误

## 复用清单

| 工具类/函数 | 路径 | 用途 |
|---|---|---|
| `extractVerificationCommands` | `src/core/harness.ts` | 从 L3 提取验证命令（已有） |
| `validateSpecContent` | `src/core/validate.ts` | 扩展 @verify 校验 |
| `writeAtomic` | `src/core/frontmatter.ts` | task JSON 原子写入 |
| `recordAuditHit` | `src/core/audit-events.ts` | 规则审计命中记录 |
| `findSpecByCode` | `src/core/spec-io.ts` | 读取 L3 spec 内容 |
| `showTask` | `src/core/task.ts` | 扩展 verification 分组显示 |

## L3 裂变计划

| L3 code | 范围 | AC | 前置依赖 |
|---|---|---|---|
| `constraint-closed-loop-L3.1.1-verify` | @verify 规则解析、执行、validate 校验 | AC-2 | 无 |
| `constraint-closed-loop-L3.1.2-hooks` | task complete 验证钩子、step failed 上下文注入、verification layer | AC-1, AC-3, AC-4 | L3.1.1 implemented |
| `constraint-closed-loop-L3.1.3-audit` | audit compliance 格式统一、task show 分组显示 | AC-5 | L3.1.2 implemented |

## 关联

- 父 L1: `constraint-closed-loop-L1`（约束闭环增强需求）
- 方法论: `docs/methodology.md`（约束闭环控制系统章节）
