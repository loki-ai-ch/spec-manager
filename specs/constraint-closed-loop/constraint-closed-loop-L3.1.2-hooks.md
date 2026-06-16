---
code: constraint-closed-loop-L3.1.2-hooks
level: L3
title: task complete 验证钩子与 step failed 上下文注入
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L2.1
status: implemented
aiSummary: >-
  由 task-completion.ts 的 runTaskCompletion 编排 R5/evidence 后、级联前的验证命令与 @verify
  门禁；scoped skip 必须提供 reason 并审计。task.ts 持久化 lastFailedOutput、支持 verification
  layer，harness/CLI 配套展示。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3/L2 spec + 受影响模块源码'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: >-
      核对数据模型扩展: VerificationLayer + TaskVerificationRecord.layer +
      TaskRecord.lastFailedOutput
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 核对 addTaskVerification layer 参数
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 核对 reportStep 失败时持久化 outputJson 到 lastFailedOutput
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 核对 task complete 验证命令和 @verify 自动执行
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 核对 showTask verification 按 layer 分组
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 核对 invariants 按 layer 检查 verification
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 核对 harness buildHarnessTaskContext 注入 lastFailedOutput
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: 核对 cli task complete skip/reason 语义和 force 废弃路径
    status: pending
  - stepNo: 10
    stepType: tool_action
    name: 核对 cli task verify --layer 参数
    status: pending
  - stepNo: 11
    stepType: tool_action
    name: 核对 cli task show 按 layer 分组显示
    status: pending
  - stepNo: 12
    stepType: tool_action
    name: 核对 task complete 验证钩子测试
    status: pending
  - stepNo: 13
    stepType: tool_action
    name: 核对 step failed 上下文注入测试
    status: pending
  - stepNo: 14
    stepType: tool_action
    name: 核对 verification layer 测试
    status: pending
  - stepNo: 15
    stepType: tool_action
    name: '验证: npm test + npm run lint + npm run build'
    status: pending
created: '2026-06-10T14:00:00.000Z'
updated: '2026-06-15T09:43:14.418Z'
changeSummary: follow-up L3.1.4 对账已实现的 completion 应用用例、门禁顺序与执行记录
---
# task complete 验证钩子与 step failed 上下文注入 — 实施规格

## 目标

实施 constraint-closed-loop-L2.1 的 deliverable 2：由 `src/core/task-completion.ts` 编排 task complete 验证门禁(AC-1)，由 `src/core/task.ts` 持久化 step failed outputJson 并支持 verification layer(AC-3/AC-4)。

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
  - Read `src/core/task-completion.ts` — 确认 `runTaskCompletion()` 与各 completion gate 的精确签名和行为
  - Read `src/core/task.ts` — 确认 `completeTask()` facade、`reportStep()`、`addTaskVerification()`、`showTask()` 的精确签名和行为
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

### Step 5 — 修改 runTaskCompletion()：验证命令 + @verify 自动执行

- 修改 `src/core/task-completion.ts` 的 `runTaskCompletion()` 应用用例：
  - 在 R5 和 successful verification evidence 检查之后、lifecycle cascade 之前执行验证逻辑
  - 从 L3 spec 内容提取验证命令（复用 `extractVerificationCommands` from harness.ts）
  - 从 L3 spec 内容提取 @verify 规则（使用 `parseVerifyRules` from verify.ts）
  - 依次执行，任一失败时拒绝 complete

```typescript
// 在 runTaskCompletion() 中，R5/evidence gate 之后、lifecycle cascade 之前执行：

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

// 拒绝 complete 若任一失败（除非显式 skip 对应门禁并提供 reason）
if ((!input.skipVerification && anyCmdFailed) || (!input.skipVerify && anyRuleFailed)) {
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
  throw new Error(`VERIFICATION_FAILED:\n${errorLines.join('\n')}\n如需异常恢复，请使用 --skip-verification 或 --skip-verify，并提供 --reason`);
}
```

- 需要新增 `CompleteInput` 字段：
  - `skipVerify?: boolean` — 跳过 @verify 规则执行（对应 `--skip-verify`）
  - `skipVerification?: boolean` — 跳过验证命令执行（对应 `--skip-verification`）
  - `bypassReason?: string` — 跳过任一完成门禁时必填，用于审计记录

```typescript
interface CompleteInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  auditSink?: (ruleId: string) => void;
  skipR18Check?: boolean;
  skipVerification?: boolean;  // 新增：跳过验证命令（--skip-verification）
  skipVerify?: boolean;         // 新增：跳过 @verify 规则（--skip-verify）
  bypassReason?: string;        // 新增：任一 skip 门禁时必填
}
```

- 复用 `runCommand`、`parseVerifyRules` / `executeVerifyRules` from `./verify.js`
- 完成后 step_report outputJson:
  ```json
  {"summary": "runTaskCompletion 增加验证命令+@verify 自动执行，失败拒绝 complete", "files": ["src/core/task-completion.ts"]}
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

### Step 9 — 修改 cli/task.ts：task complete 增加 --skip-verification/--skip-verify/--reason

- 修改 `src/cli/task.ts` 的 `task complete` 命令（line 284）：
  - 保持 `--force` 为废弃参数，调用时 SHALL 抛出 `DEPRECATED_FORCE`
  - 新增 `--skip-verification` 参数：跳过 L3 验证命令执行
  - 新增 `--skip-verify` 参数：跳过 @verify 规则执行
  - 新增 `--reason <text>` 参数：跳过任一完成门禁时必填；缺失时 SHALL 抛出 `BYPASS_REASON_REQUIRED`

```typescript
// task complete 命令修改：
.command('complete <taskId>')
.option('--spec <specCode>', 'scope to specific spec')
.option('--force', 'deprecated: use skip flags with --reason')
.option('--skip-r18', 'skip R18 decision gate')
.option('--skip-verification', 'skip L3 verification command execution')
.option('--skip-verify', 'skip @verify rule execution')
.option('--reason <text>', 'required reason when any completion gate is skipped')
.option('--json', 'output as JSON')
.action(async (taskId, opts) => {
  if (opts.force) {
    throw new Error('DEPRECATED_FORCE: --force 已移除；请按需使用 --skip-r18、--skip-verification 或 --skip-verify，并提供 --reason');
  }
  // ... 现有逻辑 ...
  const result = completeTask({
    paths,
    taskId,
    specCode: opts.spec,
    skipR18Check: opts.skipR18,
    skipVerification: opts.skipVerification,
    skipVerify: opts.skipVerify,     // 新增
    bypassReason: opts.reason,
  });
  // ... 输出逻辑 ...
});
```

- 输出格式变更：
  - 成功时输出验证通过摘要：`✓ 验证命令通过 (N/N)` + `✓ @verify 规则通过 (N/N)`
  - 失败时输出完整错误上下文（复用 completion gate 的 errorLines）
- 完成后 step_report outputJson:
  ```json
  {"summary": "task complete 增加 --skip-verification、--skip-verify 与 --reason，--force 保持废弃错误路径", "files": ["src/cli/task.ts"]}
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
  - **runTaskCompletion 验证命令通过**：L3 含 `## 验证命令` 段，命令全部 exit 0 → complete 成功
  - **runTaskCompletion 验证命令失败**：命令 exit 1 → 拒绝 complete，错误包含命令输出
  - **runTaskCompletion @verify 通过**：L3 含 `@verify: file-exists(existing-file)` → complete 成功
  - **runTaskCompletion @verify 失败**：`@verify: file-exists(nonexistent)` → 拒绝 complete
  - **runTaskCompletion --skip-verification**：验证命令失败 + `skipVerification: true` + `bypassReason` → complete 成功并记录 bypass
  - **runTaskCompletion --skip-verify**：@verify 失败 + `skipVerify: true` + `bypassReason` → complete 成功并记录 bypass
  - **runTaskCompletion skip 无 reason**：任一 skip=true 但缺少 `bypassReason` → 拒绝 complete
  - **runTaskCompletion 无验证命令段**：跳过命令执行，仅执行 @verify
  - **runTaskCompletion 无验收标准段**：跳过 @verify，仅执行验证命令
  - **CLI --force 废弃路径**：`task complete --force` → 抛出 `DEPRECATED_FORCE`
- 使用真实文件系统（temp dir），不 mock
- 完成后 step_report outputJson:
  ```json
  {"summary": "task complete 验证钩子测试覆盖通过/失败/skip-verification/skip-verify/reason/force-deprecated 场景", "files": ["src/core/__tests__/task-complete-verify.test.ts"]}
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
- `--skip-verification` SHALL 跳过验证命令执行，且 SHALL 要求 `--reason`
- `--skip-verify` SHALL 跳过 @verify 规则执行
- `--force` SHALL 被拒绝，并提示改用 `--skip-r18` / `--skip-verification` / `--skip-verify` + `--reason`
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
  "stepType": "tool_action",
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
    {"stepNo": 1, "stepType": "tool_action", "name": "上下文收集: 读取 L3/L2 spec + 受影响模块源码"},
    {"stepNo": 2, "stepType": "tool_action", "name": "数据模型扩展: VerificationLayer 类型 + TaskVerificationRecord.layer + TaskRecord.lastFailedOutput"},
    {"stepNo": 3, "stepType": "tool_action", "name": "修改 addTaskVerification 增加 layer 参数"},
    {"stepNo": 4, "stepType": "tool_action", "name": "修改 reportStep 失败时持久化 outputJson 到 lastFailedOutput"},
    {"stepNo": 5, "stepType": "tool_action", "name": "修改 runTaskCompletion 增加验证命令+@verify 自动执行"},
    {"stepNo": 6, "stepType": "tool_action", "name": "修改 showTask verification 按 layer 分组"},
    {"stepNo": 7, "stepType": "tool_action", "name": "修改 invariants 按 layer 检查 verification"},
    {"stepNo": 8, "stepType": "tool_action", "name": "修改 harness buildHarnessTaskContext 注入 lastFailedOutput"},
    {"stepNo": 9, "stepType": "tool_action", "name": "修改 cli task complete 增加 --skip-verification/--skip-verify/--reason，保留 --force 废弃错误路径"},
    {"stepNo": 10, "stepType": "tool_action", "name": "修改 cli task verify 增加 --layer 参数"},
    {"stepNo": 11, "stepType": "tool_action", "name": "修改 cli task show 按 layer 分组显示"},
    {"stepNo": 12, "stepType": "tool_action", "name": "测试: task complete 验证钩子(通过/失败/skip-verification/skip-verify/reason/force-deprecated)"},
    {"stepNo": 13, "stepType": "tool_action", "name": "测试: step failed 上下文注入(持久化/warnings)"},
    {"stepNo": 14, "stepType": "tool_action", "name": "测试: verification layer(默认值/分组/按 layer 检查)"},
    {"stepNo": 15, "stepType": "tool_action", "name": "验证: npm test + npm run lint + npm run build"}
  ]
}
```

autoConfirm=false — 已人工确认 runTaskCompletion 的验证执行位置和完成门禁 scoped skip/reason 语义。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| runTaskCompletion 验证逻辑有 bug | `git revert <commit>`，恢复 task-completion.ts 的完成门禁实现 | < 2 min |
| lastFailedOutput 导致 task JSON 异常 | 删除 task JSON 中的 lastFailedOutput 字段，还原 reportStep | < 2 min |
| layer 字段兼容问题 | 旧 task 无 layer 默认 functional，无需迁移；如需回滚删除 layer 相关代码 | < 3 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| runTaskCompletion 中外部命令阻塞 | `runCommand` 使用 30s 超时，与 L3.1.1 的 executeVerifyRules 一致 |
| 验证命令可能有副作用（如写文件） | 文档说明：验证命令应幂等且无副作用；异常恢复使用 `--skip-verification --reason <原因>` 并留审计记录 |
| lastFailedOutput 可能很大（大 JSON） | warnings 中截断到 200-300 字符 |
| 旧 task 无 layer 字段导致类型错误 | 所有读取 layer 的地方使用 `?? 'functional'` 兜底 |
| runTaskCompletion 在事务内执行外部命令 | 外部命令在 withProjectTransaction 的 snapshot 之后执行，失败时回滚 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | constraint-closed-loop-L2.1 | 父 L2 |
| implements | constraint-closed-loop-L2.1 | 实现 deliverable 2: task complete 验证钩子 |
| references | constraint-closed-loop-L3.1.1-verify | 依赖 parseVerifyRules/executeVerifyRules |
