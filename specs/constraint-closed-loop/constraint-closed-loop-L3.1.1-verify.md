---
code: constraint-closed-loop-L3.1.1-verify
level: L3
title: '@verify 规则解析与执行'
topic: constraint-closed-loop
parentCode: constraint-closed-loop-L2.1
status: implemented
aiSummary: >-
  新增 src/core/verify.ts 实现 file-exists/export-exists/command 三种机器校验规则的解析与执行；扩展
  validate.ts 提供 warning-only 语法校验，并为 constraint-closed-loop-L3.1.2-hooks 提供
  parseVerifyRules/executeVerifyRules 基础设施。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: mcp_tool
    name: '上下文收集: 读取 L3/L2 spec + 受影响模块源码'
    status: pending
  - stepNo: 2
    stepType: mcp_tool
    name: 核对 verify.ts 类型定义(VerifyRule/VerifyResult)
    status: pending
  - stepNo: 3
    stepType: mcp_tool
    name: 核对 parseVerifyRules 三种规则解析
    status: pending
  - stepNo: 4
    stepType: mcp_tool
    name: 核对 executeVerifyRules 三种规则执行
    status: pending
  - stepNo: 5
    stepType: mcp_tool
    name: 核对 verify.ts 导出注册到 index.ts
    status: pending
  - stepNo: 6
    stepType: mcp_tool
    name: 核对 validateSpecContent @verify 语法校验
    status: pending
  - stepNo: 7
    stepType: mcp_tool
    name: 核对 verify.test.ts 测试(parse + execute)
    status: pending
  - stepNo: 8
    stepType: mcp_tool
    name: 核对 validate.test.ts @verify 校验测试
    status: pending
  - stepNo: 9
    stepType: mcp_tool
    name: '验证: npm test + npm run lint + npm run build'
    status: pending
created: '2026-06-10T14:00:00.000Z'
updated: '2026-06-15T09:47:08.903Z'
changeSummary: 交付收口：避免验收标准中的说明性示例被误识别为非法 @verify 行
---
# "@verify 规则解析与执行" — 实施规格

## 目标

实施 constraint-closed-loop-L2.1 的 deliverable 1：新增 `src/core/verify.ts`，解析 L3 验收标准中的 `@verify` 标记并自动执行，扩展 `validate.ts` 增加语法校验。对应 AC-2。

**前置依赖**: 无

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- `spec-manager spec show constraint-closed-loop-L3.1.1-verify --include-content` + `spec-manager spec show constraint-closed-loop-L2.1 --include-content`
- 执行 Level 3 文件级分析(R23):
  - Read `src/core/validate.ts` — 确认 `validateSpecContent()` 签名和 `ValidationWarning` 接口
  - Read `src/core/harness.ts` — 确认 `extractVerificationCommands()` 的 section 解析逻辑（可复用模式）
  - Read `src/core/spec-io.ts` — 确认 `findSpecByCode()` 签名
  - Read `src/core/__tests__/validate.test.ts` — 确认测试模式
  - Read `src/core/constants.ts` — 确认是否需要新增常量
- `Read templates/agent-plan.json` 确认 planJson 字段名(R12)

### Step 2 — 新增 src/core/verify.ts：类型定义

- Write `src/core/verify.ts`，定义类型：

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

/** @verify 规则 — 从 L3 验收标准段解析，不持久化 */
export type VerifyRule =
  | { type: 'file-exists'; path: string }
  | { type: 'export-exists'; file: string; symbol: string }
  | { type: 'command'; cmd: string };

/** 单条规则执行结果 */
export interface VerifyResult {
  rule: VerifyRule;
  passed: boolean;
  message: string;
}
```

- 完成后 step_report outputJson:
  ```json
  {"summary": "新增 verify.ts 类型定义", "files": ["src/core/verify.ts"]}
  ```

### Step 3 — 新增 src/core/verify.ts：parseVerifyRules()

- 在 `src/core/verify.ts` 中实现解析函数：

```typescript
const VERIFY_RE = /^@verify:\s*(\w[\w-]*)\((.+)\)\s*$/;

/**
 * 从 spec markdown 的指定段中解析 @verify 规则。
 * 仅解析 ## sectionName 段内的 @verify: 行。
 */
export function parseVerifyRules(content: string, sectionName: string): VerifyRule[] {
  const rules: VerifyRule[] = [];
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // 检测段标题
    if (/^##\s+/.test(trimmed)) {
      inSection = trimmed.includes(sectionName);
      continue;
    }
    if (!inSection) continue;

    const m = VERIFY_RE.exec(trimmed);
    if (!m) continue;

    const [, type, argsStr] = m;
    const args = splitArgs(argsStr);

    if (type === 'file-exists' && args.length === 1) {
      rules.push({ type: 'file-exists', path: args[0] });
    } else if (type === 'export-exists' && args.length === 2) {
      rules.push({ type: 'export-exists', file: args[0], symbol: args[1] });
    } else if (type === 'command' && args.length === 1) {
      rules.push({ type: 'command', cmd: args[0] });
    }
    // 未知规则类型或参数数量不匹配 → 跳过（不报错，由 validate 层警告）
  }
  return rules;
}

/** 拆分括号内逗号分隔参数，处理嵌套括号 */
function splitArgs(raw: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '(' ) { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}
```

- 完成后 step_report outputJson:
  ```json
  {"summary": "实现 parseVerifyRules，支持 file-exists/export-exists/command 三种规则解析", "files": ["src/core/verify.ts"]}
  ```

### Step 4 — 新增 src/core/verify.ts：executeVerifyRules()

- 在 `src/core/verify.ts` 中实现执行函数：

```typescript
const COMMAND_TIMEOUT_MS = 30_000;

/**
 * 执行一组 @verify 规则，返回每条规则的结果。
 * projectRoot 用于解析相对路径。
 */
export function executeVerifyRules(rules: VerifyRule[], projectRoot: string): VerifyResult[] {
  return rules.map(rule => executeOne(rule, projectRoot));
}

function executeOne(rule: VerifyRule, projectRoot: string): VerifyResult {
  switch (rule.type) {
    case 'file-exists': {
      const abs = path.resolve(projectRoot, rule.path);
      const exists = existsSync(abs);
      return {
        rule,
        passed: exists,
        message: exists ? `${rule.path} exists` : `${rule.path} not found`,
      };
    }
    case 'export-exists': {
      const abs = path.resolve(projectRoot, rule.file);
      if (!existsSync(abs)) {
        return { rule, passed: false, message: `${rule.file} not found` };
      }
      const content = readFileSync(abs, 'utf8');
      // 匹配 export function/const/class/type/interface + symbol 名
      const re = new RegExp(
        `export\\s+(?:default\\s+)?(?:function|const|let|var|class|type|interface|enum)\\s+${escapeRegExp(rule.symbol)}\\b`
      );
      const alsoNamed = new RegExp(
        `export\\s*\\{[^}]*\\b${escapeRegExp(rule.symbol)}\\b[^}]*\\}`
      );
      const found = re.test(content) || alsoNamed.test(content);
      return {
        rule,
        passed: found,
        message: found
          ? `${rule.symbol} exported from ${rule.file}`
          : `${rule.symbol} not found in exports of ${rule.file}`,
      };
    }
    case 'command': {
      try {
        execSync(rule.cmd, {
          cwd: projectRoot,
          timeout: COMMAND_TIMEOUT_MS,
          stdio: 'pipe',
          encoding: 'utf8',
        });
        return { rule, passed: true, message: `${rule.cmd} → exit 0` };
      } catch (err: any) {
        const exitCode = err.status ?? 'timeout';
        const stderr = (err.stderr ?? '').toString().slice(0, 500);
        return {
          rule,
          passed: false,
          message: `${rule.cmd} → exit ${exitCode}${stderr ? ': ' + stderr : ''}`,
        };
      }
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- 完成后 step_report outputJson:
  ```json
  {"summary": "实现 executeVerifyRules，三种规则各有独立执行逻辑，command 30s 超时", "files": ["src/core/verify.ts"]}
  ```

### Step 5 — 新增 src/core/verify.ts：导出 index

- 在 `src/index.ts` 中增加 `export * from './core/verify.js'`
- 确认 `src/core/verify.ts` 的所有 public 函数和类型已导出
- 完成后 step_report outputJson:
  ```json
  {"summary": "verify.ts 导出注册到 index.ts", "files": ["src/index.ts"]}
  ```

### Step 6 — 扩展 validate.ts：@verify 语法校验

- 修改 `src/core/validate.ts` 的 `validateSpecContent()` 函数：
  - 在现有检查之后，对 L3 spec 增加 @verify 语法校验
  - 导入 `parseVerifyRules` from `./verify.js`
  - 对 `## 验收标准` 段中的每行 `@verify:` 做正则匹配
  - 匹配成功但规则类型不在 `file-exists/export-exists/command` 中 → `warn('unknown_verify_type', ...)`
  - 参数数量不匹配 → `warn('verify_arity_mismatch', ...)`
  - 这些是 warning-only，不阻塞（符合现有 validate 设计哲学）

```typescript
// 在 validateSpecContent() 函数尾部、return 之前添加：
if (level === 'L3') {
  const lines = content.split('\n');
  let inAC = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      inAC = /验收标准/.test(trimmed);
      continue;
    }
    if (!inAC || !trimmed.startsWith('@verify:')) continue;

    const m = /^@verify:\s*(\w[\w-]*)\((.+)\)\s*$/.exec(trimmed);
    if (!m) {
      warnings.push({
        rule: 'verify_syntax_error',
        level: 'warn',
        message: `@verify 行格式不正确: "${trimmed}" — 期望 @verify: type(arg1, ...)`,
        section: '验收标准',
      });
      continue;
    }
    const [, type, argsStr] = m;
    const argCount = splitArgs(argsStr).length;
    const validTypes: Record<string, number> = {
      'file-exists': 1,
      'export-exists': 2,
      'command': 1,
    };
    if (!(type in validTypes)) {
      warnings.push({
        rule: 'unknown_verify_type',
        level: 'warn',
        message: `未知 @verify 类型: "${type}" — 支持: file-exists, export-exists, command`,
        section: '验收标准',
      });
    } else if (argCount !== validTypes[type]) {
      warnings.push({
        rule: 'verify_arity_mismatch',
        level: 'warn',
        message: `@verify: ${type}() 参数数量错误: 期望 ${validTypes[type]}，实际 ${argCount}`,
        section: '验收标准',
      });
    }
  }
}
```

- 需要将 `splitArgs` 从 verify.ts 导出，或在 validate.ts 中内联一个简化版本
- 完成后 step_report outputJson:
  ```json
  {"summary": "validateSpecContent 增加 @verify 语法校验，warning-only", "files": ["src/core/validate.ts"]}
  ```

### Step 7 — 新增测试 src/core/__tests__/verify.test.ts

- 使用 vitest，测试 `parseVerifyRules` 和 `executeVerifyRules`：
  - **parseVerifyRules**: 标准三种规则解析、未知类型跳过、非验收标准段忽略、参数数量不匹配跳过、空内容返回空数组
  - **executeVerifyRules**:
    - `file-exists`: 存在的文件 → passed=true；不存在 → passed=false
    - `export-exists`: 存在且有导出 → passed=true；存在但无导出 → passed=false；文件不存在 → passed=false
    - `command`: `echo ok` → passed=true；`exit 1` → passed=false；超时场景（可选，用 `sleep 60` + 短 timeout mock）
  - 测试使用真实文件系统（temp dir），不 mock
- 完成后 step_report outputJson:
  ```json
  {"summary": "verify.test.ts 覆盖三种规则的解析和执行，含边界 case", "files": ["src/core/__tests__/verify.test.ts"]}
  ```

### Step 8 — 更新 validate.test.ts

- 在 `src/core/__tests__/validate.test.ts` 中增加：
  - L3 spec 含合法 @verify 行 → 无 warning
  - L3 spec 含未知 @verify 类型 → `unknown_verify_type` warning
  - L3 spec 含参数数量错误 → `verify_arity_mismatch` warning
  - L3 spec 含格式错误的 @verify 行 → `verify_syntax_error` warning
  - L1/L2 spec 含 @verify 行 → 不触发校验（仅 L3）
- 完成后 step_report outputJson:
  ```json
  {"summary": "validate.test.ts 增加 @verify 语法校验测试", "files": ["src/core/__tests__/validate.test.ts"]}
  ```

### Step 9 — 验证

- `npm run lint` — 类型检查通过
- `npm test` — 全部测试通过（含新增 verify.test.ts 和 validate.test.ts 用例）
- `npm run build` — 编译成功

## 验收标准

- `file-exists(path)` 类型的机器校验标记在验收标准段内 SHALL 被解析为 `VerifyRule` 并可通过 `executeVerifyRules` 执行
- `export-exists(file, symbol)` 类型的机器校验标记 SHALL 检查文件是否导出指定符号
- `command(cmd)` 类型的机器校验标记 SHALL 执行命令并以 exitCode=0 判定通过
- 不在 `## 验收标准` 段内的 `@verify` 行 SHALL 被忽略
- `validateSpecContent('L3', content)` SHALL 对 @verify 语法错误输出 warning（不 throw）
- @verify: file-exists(src/core/verify.ts)
- @verify: export-exists(src/core/verify.ts, parseVerifyRules)
- @verify: export-exists(src/core/verify.ts, executeVerifyRules)
- @verify: command(npm run lint)
- @verify: command(npm test)

## 验证命令

```bash
# 正向验证: 全量测试 + 类型检查
npm test
npm run lint
npm run build

# 反向验证: 手动测试 @verify 解析
node -e "
const { parseVerifyRules } = require('./dist/core/verify.js');
const md = '## 验收标准\n1. AC-1\n2. @verify: file-exists(src/core/verify.ts)\n3. @verify: command(npm test)';
const rules = parseVerifyRules(md, '验收标准');
console.log(JSON.stringify(rules, null, 2));
console.assert(rules.length === 2, 'expected 2 rules');
console.assert(rules[0].type === 'file-exists');
console.assert(rules[1].type === 'command');
console.log('PASS');
"
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
  "coveredSpecs": ["constraint-closed-loop-L3.1.1-verify"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: 读取 L3/L2 spec + 受影响模块源码"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新增 verify.ts 类型定义(VerifyRule/VerifyResult)"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "实现 parseVerifyRules 三种规则解析"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "实现 executeVerifyRules 三种规则执行"},
    {"stepNo": 5, "stepType": "mcp_tool", "name": "verify.ts 导出注册到 index.ts"},
    {"stepNo": 6, "stepType": "mcp_tool", "name": "扩展 validateSpecContent 增加 @verify 语法校验"},
    {"stepNo": 7, "stepType": "mcp_tool", "name": "新增 verify.test.ts 测试(parse + execute)"},
    {"stepNo": 8, "stepType": "mcp_tool", "name": "更新 validate.test.ts 增加 @verify 校验测试"},
    {"stepNo": 9, "stepType": "mcp_tool", "name": "验证: npm test + npm run lint + npm run build"}
  ]
}
```

autoConfirm=false — 首个 L3，需人工确认 verify.ts 的 API 设计是否符合后续 L3.1.2 的消费预期。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| verify.ts 设计不合理 | 删除 `src/core/verify.ts`，还原 `validate.ts` 和 `index.ts`，`git revert <commit>` | < 2 min |
| 测试文件有问题 | 删除 `src/core/__tests__/verify.test.ts`，还原 `validate.test.ts` | < 1 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| `export-exists` 的正则匹配不够全面（re-export、`export * from`） | 初版仅匹配直接导出声明和 `export {}` 块，后续迭代扩展 |
| `command` 规则执行超时阻塞流程 | 30s 硬超时 + execSync 自带 timeout，超时返回 passed=false |
| `splitArgs` 对嵌套括号的处理边界 | 测试覆盖 `export-exists(file, symbol)` 和 `command(npm test && echo ok)` 场景 |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | constraint-closed-loop-L2.1 | 父 L2 |
| implements | constraint-closed-loop-L2.1 | 实现 deliverable 1: @verify 机器校验 |
