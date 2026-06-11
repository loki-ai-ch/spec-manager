---
code: constraint-closed-loop-L3.1.2-hooks
level: L3
title: task complete 验证钩子与 step failed 上下文注入
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L2.1
status: draft
created: '2026-06-10T14:00:00.000Z'
updated: '2026-06-10T14:00:00.000Z'
aiSummary: >-
  修改 task.ts 的 completeTaskUnlocked 增加验证命令+@verify 规则自动执行(AC-1)；
  reportStep 失败时持久化 outputJson 到 lastFailedOutput 并在下次注入 warnings(AC-3)；
  addTaskVerification 增加 layer 参数、showTask 按 layer 分组显示(AC-4)。
  修改 invariants/harness/cli/task 配套支持。
---
# task complete 验证钩子与 step failed 上下文注入 — 实施规格

## 目标

实施 constraint-closed-loop-L2.1 的 deliverable 2：修改 `src/core/task.ts` 使 task complete 前自动执行验证命令和 @verify 规则(AC-1)、step failed 时持久化 outputJson 并在下次注入 warnings(AC-3)、verification 支持 layer 分层(AC-4)。

**前置依赖**: constraint-closed-loop-L3.1.1-verify implemented（需要 `parseVerifyRules` / `executeVerifyRules`）

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- `spec-manager spec show constraint-closed-loop-L3.1.2-hooks --include-content`
- 执行 Level 3 文件级分析(R23):
  - Read `src/core/task.ts` — 确认 `completeTaskUnlocked()`(line 359)、`reportStep()`(line 256)、`addTaskVerification()`(line 315)、`showTask()`(line 474) 的精确签名和行为
  - Read `src/core/invariants.ts` — 确认 `assertTaskHasSuccessfulVerification()`(line 19) 签名
  - Read `src/core/harness.ts` — 确认 `buildHarnessTaskContext()`(line 70) 和 `extractVerificationCommands()`(line 294)
  - Read `src/core/verify.ts` — 确认 L3.1.1 产出的 `parseVerifyRules` / `executeVerifyRules` 签名
  - Read `src/cli/task.ts` — 确认 `task complete`(line 284)、`task verify`(line 162)、`task show`(line 354) 的 CLI 注册
  - Read `src/schemas/spec.ts` — 确认 `StepFrontmatterSchema` 和 `SpecFrontmatterSchema`
  - Read `src/core/frontmatter.ts` — 确认 `writeAtomic` 可用于 task JSON 写入
- `Read templates/agent-plan.json` 确认 planJson 字段名(R12)

### Step 2 — 数据模型扩展：VerificationLayer 类型

- 在 `src/core/task.ts` 中新增类型：

```typescript
/** verification 分层枚举 — 固定三级 */
export type VerificationLayer = 'compile' | 'functional' | 'smoke';

/** 验证层排序优先级（用于 show 分组显示） */
export const VERIFICATION_LAYER_ORDER: VerificationLayer[] = ['compile', 'functional', 'smoke'];
```

- 扩展 `TaskVerificationRecord` 接口（line 47）：

```typescript
export interface TaskVerificationRecord {
  id: string;
  command: string;
  exitCode: number;
  summary: string;
  artifacts: string[];
  coversAc: string[];
  created: string;
  layer: VerificationLayer;  // 新增，默认 'functional'
}
```

- 扩展 `TaskRecord` 接口（line 32）：

```typescript
export interface TaskRecord {
  // ... 现有字段 ...
  lastFailedOutput: string | null;  // 新增，step failed 时持久化的 outputJson
}
```

- 向后兼容：旧 task JSON 无 `layer` 时默认 `'functional'`；无 `lastFailedOutput` 时默认 `null`
- 完成后 step_report outputJson:
  ```json
  {"summary": "扩展 TaskVerificationRecord 增加 layer 字段、TaskRecord 增加 lastFailedOutput", "files": ["src/core/task.ts"]}
  ```

### Step 3 — 修改 addTaskVerification()：增加 layer 参数

- 修改 `src/core/task.ts` 的 `addTaskVerification()` 函数（line 315）：
  - `AddTaskVerificationInput` 增加可选 `layer?: VerificationLayer` 参数
  - 创建 `TaskVerificationRecord` 时设置 `layer: input.layer ?? 'functional'`
  - 向后兼容：不传 layer 时默认 `'functional'`

```typescript
export interface AddTaskVerificationInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  command: string;
  exitCode: number;
  summary: string;
  artifacts?: string[];
  coversAc?: string[];
  layer?: VerificationLayer;  // 新增
}
```

- 完成后 step_report outputJson:
  ```json
  {"summary": "addTaskVerification 增加 layer 参数，默认 functional", "files": ["src/core/task.ts"]}
  ```

### Step 4 — 修改 reportStep()：失败时持久化 outputJson

- 修改 `src/core/task.ts` 的 `reportStep()` 函数（line 256）：
  - 当 `status === 'failed'` 且 `outputJson` 存在时，写入 `task.lastFailedOutput = outputJson`
  - 在函数开头，检查 `task.lastFailedOutput` 非 null 时，向 warnings 追加失败摘要：

```typescript
// 在 reportStep() 函数开头，assertTaskMutable 之后添加：
if (task.lastFailedOutput) {
  const failedStep = task.steps?.find(s => s.status === 'failed');
  const stepLabel = failedStep ? `step #${failedStep.stepNo}` : '上次 step';
  const preview = task.lastFailedOutput.length > 200
    ? task.lastFailedOutput.slice(0, 200) + '...'
    : task.lastFailedOutput;
  warnings.push(`⚠ 上次 ${stepLabel} 失败摘要: ${preview}`);
}

// 在写入 task 之前，若 status === 'failed' 且 outputJson 存在：
if (input.status === 'failed' && input.outputJson) {
  task.lastFailedOutput = input.outputJson;
}
```

- 写入时使用现有 `writeTaskJSON()` 函数（已使用 writeAtomic）
- 完成后 step_report outputJson:
  ```json
  {"summary": "reportStep 失败时持久化 outputJson 到 lastFailedOutput，下次调用注入 warnings", "files": ["src/core/task.ts"]}
  ```

### Step 5 — 修改 completeTaskUnlocked()：验证命令 + @verify 自动执行

- 修改 `src/core/task.ts` 的 `completeTaskUnlocked()` 函数（line 359）：
  - 在 R5 检查（all steps succeeded）**之前**插入验证逻辑
  - 从 L3 spec 内容提取验证命令（复用 `extractVerificationCommands` from harness.ts）
  - 从 L3 spec 内容提取 @verify 规则（使用 `parseVerifyRules` from verify.ts）
  - 依次执行，任一失败时拒绝 complete

```typescript
// 在 completeTaskUnlocked() 中，assertTaskTransition 之后、R6 检查之前插入：

// AC-1: 自动执行验证命令
const spec = findSpecByCode(paths, input.specCode ?? task.specCode);
if (!spec) throw new Error(`SPEC_NOT_FOUND: ${input.specCode ?? task.specCode}`);

const specContent = readSpecContent(paths, spec);

// 提取验证命令
const verifyCmds = extractVerificationCommands(specContent);
const cmdResults: Array<{ cmd: string; exitCode: number; output: string }> = [];
let anyCmdFailed = false;

for (const cmd of verifyCmds) {
  try {
    execSync(cmd, { cwd: paths.root, timeout: 30_000, stdio: 'pipe', encoding: 'utf8' });
    cmdResults.push({ cmd, exitCode: 0, output: '' });
  } catch (err: any) {
    const exitCode = err.status ?? 1;
    const output = (err.stderr ?? err.stdout ?? '').toString().slice(0, 500);
    cmdResults.push({ cmd, exitCode, output });
    anyCmdFailed = true;
  }
}

// 提取 @verify 规则
const verifyRules = parseVerifyRules(specContent, '验收标准');
const ruleResults = verifyRules.length > 0
  ? executeVerifyRules(verifyRules, paths.root)
  : [];
const anyRuleFailed = ruleResults.some(r => !r.passed);

// 拒绝 complete 若任一失败（除非 --force）
if (!input.skipVerify && (anyCmdFailed || anyRuleFailed)) {
  const errorLines: string[] = [];
  if (cmdResults.length > 0) {
    const passed = cmdResults.filter(r => r.exitCode === 0).length;
    errorLines.push(`验证命令 ${anyCmdFailed ? '✗' : '✓'} (${passed}/${cmdResults.length}):`);
    for (const r of cmdResults) {
      const icon = r.exitCode === 0 ? '✓' : '✗';
      errorLines.push(`  ${icon} ${r.cmd}${r.exitCode !== 0 ? ` (exit ${r.exitCode}): ${r.output}` : ''}`);
    }
  }
  if (ruleResults.length > 0) {
    const passed = ruleResults.filter(r => r.passed).length;
    errorLines.push(`@verify 规则 ${anyRuleFailed ? '✗' : '✓'} (${passed}/${ruleResults.length}):`);
    for (const r of ruleResults) {
      errorLines.push(`  ${r.passed ? '✓' : '✗'} ${r.message}`);
    }
  }
  throw new Error(`VERIFICATION_FAILED:\n${errorLines.join('\n')}\n使用 --force 跳过验证（不推荐）`);
}
```

- 需要新增 `CompleteInput` 字段：
  - `skipVerify?: boolean` — 跳过 @verify 规则执行（对应 `--skip-verify`）
  - `skipVerification?: boolean` — 跳过验证命令执行（对应 `--force` 的新语义）

```typescript
interface CompleteInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  auditSink?: (ruleId: string) => void;
  skipR18Check?: boolean;
  skipVerification?: boolean;  // 新增：跳过验证命令（--force）
  skipVerify?: boolean;         // 新增：跳过 @verify 规则（--skip-verify）
}
```

- 需要导入：`execSync` from `node:child_process`，`parseVerifyRules` / `executeVerifyRules` from `./verify.js`
- 完成后 step_report outputJson:
  ```json
  {"summary": "completeTaskUnlocked 增加验证命令+@verify 自动执行，失败拒绝 complete", "files": ["src/core/task.ts"]}
  ```

### Step 6 — 修改 showTask()：verification 按 layer 分组

- 修改 `src/core/task.ts` 的 `showTask()` 函数（line 474）：
  - 返回值增加 `verificationsByLayer` 字段：

```typescript
export function showTask(paths: ProjectPaths, taskId: string, opts?: { full?: boolean; specCode?: string }): {
  task: TaskRecord;
  steps: StepFrontmatter[];
  shownSteps: StepFrontmatter[];
  totalSteps: number;
  truncated: boolean;
  verificationsByLayer: Record<VerificationLayer, TaskVerificationRecord[]>;
} | null
```

- 分组逻辑：
  - 按 `VERIFICATION_LAYER_ORDER` 排序
  - 旧 verification 无 layer 字段时归入 `'functional'`
  - 返回 `Record<VerificationLayer, TaskVerificationRecord[]>`，空 layer 组不出现在结果中

- 完成后 step_report outputJson:
  ```json
  {"summary": "showTask 返回 verificationsByLayer 按 compile/functional/smoke 分组", "files": ["src/core/task.ts"]}
  ```

### Step 7 — 修改 invariants.ts：按 layer 检查 verification

- 修改 `src/core/invariants.ts` 的 `assertTaskHasSuccessfulVerification()` 函数（line 19）：

```typescript
export function assertTaskHasSuccessfulVerification(
  task: TaskRecord,
  opts?: { layer?: VerificationLayer }
): void {
  const verifications = task.verifications ?? [];
  const filtered = opts?.layer
    ? verifications.filter(v => (v.layer ?? 'functional') === opts.layer)
    : verifications;
  const hasSuccess = filtered.some(v => v.exitCode === 0);
  if (!hasSuccess) {
    const layerHint = opts?.layer ? ` (layer: ${opts.layer})` : '';
    throw new Error(
      `VERIFICATION_REQUIRED: task ${task.id} requires at least one successful verification${layerHint}`
    );
  }
}
```

- 向后兼容：不传 opts 时行为与现有完全一致
- 完成后 step_report outputJson:
  ```json
  {"summary": "assertTaskHasSuccessfulVerification 支持可选 layer 过滤", "files": ["src/core/invariants.ts"]}
  ```

### Step 8 — 修改 harness.ts：注入 lastFailedOutput 到 warnings

- 修改 `src/core/harness.ts` 的 `buildHarnessTaskContext()` 函数（line 70）：
  - 读取 task record，在 warnings 中追加上次失败摘要：

```typescript
// 在 buildHarnessTaskContext() 中，读取 task 后添加：
const taskRecord = findTaskById(paths, taskCode);
if (taskRecord?.lastFailedOutput) {
  const preview = taskRecord.lastFailedOutput.length > 300
    ? taskRecord.lastFailedOutput.slice(0, 300) + '...'
    : taskRecord.lastFailedOutput;
  context.warnings.push(`⚠ 上次 step 失败摘要: ${preview}`);
}
```

- 注意：`buildHarnessTaskContext` 接收的是 `l3Code`，需要从 l3Code 找到关联的 task
- 完成后 step_report outputJson:
  ```json
  {"summary": "buildHarnessTaskContext 在 warnings 中追加 lastFailedOutput 摘要", "files": ["src/core/harness.ts"]}
  ```

### Step 9 — 修改 cli/task.ts：task complete 增加 --force/--skip-verify

- 修改 `src/cli/task.ts` 的 `task complete` 命令（line 284）：
  - 现有 `--force` 参数改为跳过验证命令执行（当前仅跳过 R18）
  - 新增 `--skip-verify` 参数：跳过 @verify 规则执行

```typescript
// task complete 命令修改：
.command('complete <taskId>')
.option('--spec <specCode>', 'scope to specific spec')
.option('--force', 'skip verification command execution (emergency)')
.option('--skip-verify', 'skip @verify rule execution')
.option('--json', 'output as JSON')
.action(async (taskId, opts) => {
  // ... 现有逻辑 ...
  const result = completeTask({
    paths,
    taskId,
    specCode: opts.spec,
    skipR18Check: opts.force,        // 保留现有行为
    skipVerification: opts.force,    // 新增：--force 也跳过验证命令
    skipVerify: opts.skipVerify,     // 新增
  });
  // ... 输出逻辑 ...
});
```

- 输出格式变更：
  - 成功时输出验证通过摘要：`✓ 验证命令通过 (N/N)` + `✓ @verify 规则通过 (N/N)`
  - 失败时输出完整错误上下文（复用 completeTaskUnlocked 的 errorLines）
- 完成后 step_report outputJson:
  ```json
  {"summary": "task complete 增加 --force 跳过验证、--skip-verify 跳过 @verify", "files": ["src/cli/task.ts"]}
  ```

### Step 10 — 修改 cli/task.ts：task verify 增加 --layer

- 修改 `src/cli/task.ts` 的 `task verify` 命令（line 162）：
  - 新增 `--layer <layer>` 参数：值域 `compile|functional|smoke`
  - 传递给 `addTaskVerification()` 的 `layer` 参数

```typescript
.option('--layer <layer>', 'verification layer: compile, functional, smoke')
```

- 验证 layer 值是否在枚举内，不在时报错
- 完成后 step_report outputJson:
  ```json
  {"summary": "task verify 增加 --layer 参数", "files": ["src/cli/task.ts"]}
  ```

### Step 11 — 修改 cli/task.ts：task show 按 layer 分组

- 修改 `src/cli/task.ts` 的 `task show` 命令（line 354）：
  - 使用 `showTask()` 返回的 `verificationsByLayer` 渲染分组输出：

```typescript
// verifications 输出格式：
if (result.verificationsByLayer && Object.keys(result.verificationsByLayer).length > 0) {
  console.log('verifications:');
  for (const layer of VERIFICATION_LAYER_ORDER) {
    const items = result.verificationsByLayer[layer];
    if (!items || items.length === 0) continue;
    console.log(`  [${layer}]`);
    for (const v of items) {
      console.log(`    ${v.id}: ${v.command} → exit ${v.exitCode} (${v.created.slice(0, 10)})`);
    }
  }
} else if (result.task.verifications && result.task.verifications.length > 0) {
  // fallback: 无 layer 信息时平铺显示
  console.log('verifications:');
  for (const v of result.task.verifications) {
    console.log(`  ${v.id}: ${v.command} → exit ${v.exitCode} (${v.created.slice(0, 10)})`);
  }
}
```

- 完成后 step_report outputJson:
  ```json
  {"summary": "task show verifications 按 compile/functional/smoke 分组显示", "files": ["src/cli/task.ts"]}
  ```

### Step 12 — 测试：task complete 验证钩子

- 在 `src/core/__tests__/` 中新增或扩展测试：
  - **completeTaskUnlocked 验证命令通过**：L3 含 `## 验证命令` 段，命令全部 exit 0 → complete 成功
  - **completeTaskUnlocked 验证命令失败**：命令 exit 1 → 拒绝 complete，错误包含命令输出
  - **completeTaskUnlocked @verify 通过**：L3 含 `@verify: file-exists(existing-file)` → complete 成功
  - **completeTaskUnlocked @verify 失败**：`@verify: file-exists(nonexistent)` → 拒绝 complete
  - **completeTaskUnlocked --force**：验证失败 + `skipVerification: true` → complete 成功
  - **completeTaskUnlocked --skip-verify**：@verify 失败 + `skipVerify: true` → complete 成功
  - **completeTaskUnlocked 无验证命令段**：跳过命令执行，仅执行 @verify
  - **completeTaskUnlocked 无验收标准段**：跳过 @verify，仅执行验证命令
- 使用真实文件系统（temp dir），不 mock
- 完成后 step_report outputJson:
  ```json
  {"summary": "task complete 验证钩子测试覆盖通过/失败/force/skip-verify 场景", "files": ["src/core/__tests__/task-complete-verify.test.ts"]}
  ```

### Step 13 — 测试：step failed 上下文注入

- 测试 `reportStep()` 的 lastFailedOutput 行为：
  - **step failed 持久化**：`reportStep({ status: 'failed', outputJson: '...' })` → task.lastFailedOutput 被写入
  - **下次 step warnings 注入**：先 reportStep(failed)，再 reportStep(any) → warnings 包含上次失败摘要
  - **无 outputJson 时不持久化**：`reportStep({ status: 'failed' })` → lastFailedOutput 不变
  - **成功 step 不清除 lastFailedOutput**：成功 step 后 lastFailedOutput 仍保留（供后续 step 引用）
- 完成后 step_report outputJson:
  ```json
  {"summary": "step failed 上下文注入测试覆盖持久化和 warnings 注入", "files": ["src/core/__tests__/step-failed-context.test.ts"]}
  ```

### Step 14 — 测试：verification layer

- 测试 `addTaskVerification()` 的 layer 参数：
  - **默认 layer**：不传 layer → 记录中 layer='functional'
  - **指定 layer**：传 'compile' → 记录中 layer='compile'
  - **showTask 分组**：添加不同 layer 的 verification → showTask 返回正确分组
  - **按 layer 检查**：`assertTaskHasSuccessfulVerification(task, { layer: 'compile' })` 仅检查 compile 层
- 完成后 step_report outputJson:
  ```json
  {"summary": "verification layer 测试覆盖默认值、指定值、分组、按 layer 检查", "files": ["src/core/__tests__/verification-layer.test.ts"]}
  ```

### Step 15 — 验证

- `npm run lint` — 类型检查通过
- `npm test` — 全部测试通过
- `npm run build` — 编译成功

## 验收标准

- `spec-manager task complete` 在级联 status 前 SHALL 执行 L3 验证命令，exitCode ≠ 0 时 SHALL 拒绝 complete
- `spec-manager task complete` SHALL 执行 @verify 规则，失败时 SHALL 拒绝 complete
- `--force` SHALL 跳过验证命令执行
- `--skip-verify` SHALL 跳过 @verify 规则执行
- `reportStep(status=failed, outputJson=...)` SHALL 持久化 outputJson 到 `task.lastFailedOutput`
- 下次同 task 的 `reportStep` 调用 SHALL 在 warnings 中包含上次失败摘要
- `addTaskVerification` SHALL 支持 `layer` 参数，值域 `compile|functional|smoke`，默认 `functional`
- `task show` SHALL 按 layer 分组显示 verification 记录
- `assertTaskHasSuccessfulVerification` SHALL 支持可选 layer 过滤
- @verify: file-exists(src/core/task.ts)
- @verify: export-exists(src/core/task.ts, addTaskVerification)
- @verify: export-exists(src/core/invariants.ts, assertTaskHasSuccessfulVerification)
- @verify: command(npm run lint)
- @verify: command(npm test)

## 验证命令

```bash
# 正向验证: 全量测试 + 类型检查
npm test
npm run lint
npm run build

# 反向验证: task complete 验证失败场景
# (需要先创建一个验证命令会失败的 task)
# spec-manager task complete T-xxx → 应输出验证失败摘要
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "shell",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["constraint-closed-loop-L3.1.2-hooks"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取 L3/L2 spec + 受影响模块源码"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "数据模型扩展: VerificationLayer 类型 + TaskVerificationRecord.layer + TaskRecord.lastFailedOutput"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "修改 addTaskVerification 增加 layer 参数"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "修改 reportStep 失败时持久化 outputJson 到 lastFailedOutput"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "修改 completeTaskUnlocked 增加验证命令+@verify 自动执行"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "修改 showTask verification 按 layer 分组"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "修改 invariants 按 layer 检查 verification"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "修改 harness buildHarnessTaskContext 注入 lastFailedOutput"},
    {"stepNo": 9, "stepType": "mcp_tool", "name": "修改 cli task complete 增加 --force/--skip-verify"},
    {"stepNo": 10, "stepType": "mcp_tool", "name": "修改 cli task verify 增加 --layer 参数"},
    {"stepNo": 11, "stepType": "mcp_tool", "name": "修改 cli task show 按 layer 分组显示"},
    {"stepNo": 12, "stepType": "mcp_tool", "name": "测试: task complete 验证钩子(通过/失败/force/skip-verify)"},
    {"stepNo": 13, "stepType": "mcp_tool", "name": "测试: step failed 上下文注入(持久化/warnings)"},
    {"stepNo": 14, "stepType": "mcp_tool", "name": "测试: verification layer(默认值/分组/按 layer 检查)"},
    {"stepNo": 15, "stepType": "mcp_tool", "name": "验证: npm test + npm run lint + npm run build"}
  ]
}
```

autoConfirm=false — 需人工确认 completeTaskUnlocked 的验证执行位置（R5 之前）和 --force 语义是否合理。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| completeTaskUnlocked 验证逻辑有 bug | `git revert <commit>`，恢复 task.ts 的 completeTaskUnlocked | < 2 min |
| lastFailedOutput 导致 task JSON 异常 | 删除 task JSON 中的 lastFailedOutput 字段，还原 reportStep | < 2 min |
| layer 字段兼容问题 | 旧 task 无 layer 默认 functional，无需迁移；如需回滚删除 layer 相关代码 | < 3 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| completeTaskUnlocked 中 execSync 阻塞 | 30s 超时，与 L3.1.1 的 executeVerifyRules 一致 |
| 验证命令可能有副作用（如写文件） | 文档说明：验证命令应幂等且无副作用；--force 提供逃生口 |
| lastFailedOutput 可能很大（大 JSON） | warnings 中截断到 200-300 字符 |
| 旧 task 无 layer 字段导致类型错误 | 所有读取 layer 的地方使用 `?? 'functional'` 兜底 |
| completeTaskUnlocked 在事务内执行外部命令 | execSync 在 withProjectTransaction 的 snapshot 之后执行，失败时回滚 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | constraint-closed-loop-L2.1 | 父 L2 |
| implements | constraint-closed-loop-L2.1 | 实现 deliverable 2: task complete 验证钩子 |
| references | constraint-closed-loop-L3.1.1-verify | 依赖 parseVerifyRules/executeVerifyRules |
