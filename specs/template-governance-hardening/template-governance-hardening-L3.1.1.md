---
code: template-governance-hardening-L3.1.1
level: L3
title: Template Guidance Parity and Boundary Cleanup
topic: template-governance-hardening
parentCode: template-governance-hardening-L2.1
status: implemented
aiSummary: >-
  实施规格：修订 L1/L2/L3/agent-plan/Agent entry templates，补齐 DESIGN.md、delivery、docs
  check guidance parity，并用 docs-guidance 测试兜底。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 template-governance-hardening-L3.1.1 和
      template-governance-hardening-L2.1 规格
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 编辑 src/core/__tests__/docs-guidance.test.ts 增加模板 parity 断言
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: >-
      编辑 templates/L1-prd.md templates/L2-design.md templates/L3-impl.md
      templates/agent-plan.json 清理模板边界
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 编辑 templates/agents 和 skill/SKILL.md 补齐 Agent guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 验证 npm test -- docs-guidance agents project-agents
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 验证 npm run build 和 node dist/cli/index.js project docs check
    status: pending
relations:
  - type: references
    target: design-context-L2.6
  - type: references
    target: agent-install-surface-L2.1
created: '2026-07-15T08:26:54.929Z'
updated: '2026-07-15T09:03:06.601Z'
changeSummary: 'cascade: task-complete'
---
# Template Guidance Parity and Boundary Cleanup — 实施规格

## 目标

实施 `template-governance-hardening-L2.1` 的第一个切片：修订 L1/L2/L3/agent-plan/Agent entry templates，并用 docs-guidance 文本测试覆盖关键 guidance parity。

**前置依赖**: `template-governance-hardening-L2.1` 已 confirmed；无前序 L3。

## 实施步骤

> **RFC 2119 关键字指引**:
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- 读取本 L3 与父 L2：
  - `spec-manager spec show template-governance-hardening-L3.1.1 --include-content`
  - `spec-manager spec show template-governance-hardening-L2.1 --include-content`
- 执行 Level 3 文件级分析(R23)，读取并确认以下文件存在：
  - `templates/L1-prd.md`
  - `templates/L2-design.md`
  - `templates/L3-impl.md`
  - `templates/agent-plan.json`
  - `templates/agents/AGENTS.md`
  - `templates/agents/CLAUDE.md`
  - `templates/agents/CODEBUDDY.md`
  - `templates/agents/CURSOR.md`
  - `templates/agents/WINDSURF.md`
  - `templates/agents/codebuddy-skill/SKILL.md`
  - `skill/SKILL.md`
  - `src/core/__tests__/docs-guidance.test.ts`
- 读取 `templates/agent-plan.json` 确认 planJson 字段名为 `coveredSpecs` / `stepNo` / `stepType` / `name`。

### Step 2 — 补强 docs-guidance 模板断言

- 编辑 `src/core/__tests__/docs-guidance.test.ts`：
  - 将 `templates/agents/AGENTS.md`、`CLAUDE.md`、`CODEBUDDY.md`、`CURSOR.md`、`WINDSURF.md` 纳入 design guidance 断言。
  - 增加断言：Agent guidance 包含 `spec-manager project docs check`、`spec-manager assist acceptance`、`spec-manager assist delivery`、`specs/DESIGN.md`、`resolved write root`、`root \`DESIGN.md\` retained as a legacy fallback`。
  - 增加模板边界断言：`templates/L1-prd.md` 不再包含“以下 3 个问题”但未定义 Q1-Q3；`templates/L2-design.md` 明确模块路径与实施文件边界；`templates/L3-impl.md` 和 `templates/agent-plan.json` 不包含 `.java`、`JAR` 作为默认示例。

### Step 3 — 修订 L1/L2/L3/agent-plan 模板

- 编辑 `templates/L1-prd.md`：
  - 将 PRE-WRITE INTERACTION 改成可执行的 Q1-Q4。
  - Q4 历史决策查询保留，仍在 Q1-Q3 之前执行。
- 编辑 `templates/L2-design.md`：
  - 将 “具体文件路径” 边界改成 “实施文件清单/函数签名下到 L3”。
  - 将 “受影响模块” 和 “复用清单” 文案改为模块/公共接口级，不要求函数级实施路径。
- 编辑 `templates/L3-impl.md`：
  - 把 Java/JAR/curl-only 示例改为语言无关示例。
  - 删除 `<autoConfirm 取值 + 理由>` 历史残留。
  - 部署步骤改成“发布/部署/打包(若涉及)”。
- 编辑 `templates/agent-plan.json`：
  - 将 `<ServiceName>.java`、后端 JAR、curl 示例改为通用文件/测试示例。

### Step 4 — 修订 Agent entry templates

- 编辑以下文件，加入简短 Design Context / delivery / docs check guidance：
  - `templates/agents/AGENTS.md`
  - `templates/agents/CLAUDE.md`
  - `templates/agents/CODEBUDDY.md`
  - `templates/agents/CURSOR.md`
  - `templates/agents/WINDSURF.md`
  - `templates/agents/codebuddy-skill/SKILL.md`
  - `skill/SKILL.md`（如缺少模板治理提示则补充）
- 所有 Agent entry templates SHALL 包含：
  - `spec-manager project docs check`
  - `spec-manager assist acceptance`
  - `spec-manager assist delivery`
  - `specs/DESIGN.md`
  - `resolved write root`
  - `root \`DESIGN.md\` retained as a legacy fallback`
- 不提交或改写 `.agents/` 生成资产。

### Step 5 — 验证

- 运行 targeted tests：
  - `npm_config_cache=/tmp/spec-manager-npm-cache npm test -- docs-guidance agents project-agents`
- 运行 docs check：
  - `node dist/cli/index.js project docs check` 若 dist 未更新则先运行 `npm run build` 后再执行。

## 验证命令

```bash
# 正向验证: guidance/template 文本断言通过
npm_config_cache=/tmp/spec-manager-npm-cache npm test -- docs-guidance agents project-agents
# 预期输出包含: Test Files 3 passed

# 正向验证: docs check 无 error
npm run build
node dist/cli/index.js project docs check
# 预期输出包含: errors=0

# 反向验证: 确认模板不再包含已知偏置
node -e "const fs=require('fs'); const files=['templates/L1-prd.md','templates/L2-design.md','templates/L3-impl.md','templates/agent-plan.json']; const re=/\\.java|JAR|以下 3 个问题|autoConfirm/; const hits=[]; for (const file of files) fs.readFileSync(file,'utf8').split(/\\n/).forEach((line,index)=>{ if (re.test(line)) hits.push(`${file}:${index + 1}:${line}`); }); if (hits.length) { console.error(hits.join('\\n')); process.exit(1); } console.log('no template bias markers found');"
# 预期输出包含: no template bias markers found
```

## 验收标准

1. **AC-1**: **Given** 发布 Agent entry templates, **When** 运行 docs-guidance 测试, **Then** 所有入口 **SHALL** 覆盖 docs check、delivery/acceptance、writeRoot 和 `specs/DESIGN.md` guidance。
2. **AC-2**: **Given** L1/L2/L3/agent-plan 模板, **When** 运行模板边界断言, **Then** 模板 **SHALL** 不包含未定义 Q1-Q3、路径边界冲突、`.java`/`JAR` 默认示例或 `autoConfirm` 残留。
3. **AC-3**: **Given** 现有 Agent install 行为, **When** 运行 `npm test -- agents project-agents`, **Then** 平台安装行为 **SHALL** 保持兼容。

## 关键验收标准

- AC-1
- AC-2
- AC-3

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["template-governance-hardening-L3.1.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 template-governance-hardening-L3.1.1 和 template-governance-hardening-L2.1 规格"},
    {"stepNo": 2, "stepType": "tool_action", "name": "编辑 src/core/__tests__/docs-guidance.test.ts 增加模板 parity 断言"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 templates/L1-prd.md templates/L2-design.md templates/L3-impl.md templates/agent-plan.json 清理模板边界"},
    {"stepNo": 4, "stepType": "tool_action", "name": "编辑 templates/agents 和 skill/SKILL.md 补齐 Agent guidance"},
    {"stepNo": 5, "stepType": "tool_action", "name": "验证 npm test -- docs-guidance agents project-agents"},
    {"stepNo": 6, "stepType": "tool_action", "name": "验证 npm run build 和 node dist/cli/index.js project docs check"}
  ]
}
```

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 文案测试过严 | 回退 `src/core/__tests__/docs-guidance.test.ts` 中新增断言，保留模板修订重新评估 | < 10 min |
| 模板 guidance 造成误导 | 回退对应 `templates/agents/*` 和 `skill/SKILL.md` 修改 | < 10 min |
| 通用模板示例不清晰 | 回退 L1/L2/L3/agent-plan 单个模板修改并补更明确示例 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| Agent capsule 变得过长 | 只加入短规则，不展开 README 级说明 |
| 文案断言脆弱 | 只断言稳定能力短语，避免整段 snapshot |
| `.agents` 本地生成资产误入提交 | `git status --short` 检查，保持 `.agents/` 未跟踪或不 staged |

## 关联

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | template-governance-hardening-L2.1 | 父 L2 |
| references | design-context-L2.6 | DESIGN.md 默认路径 |
| references | agent-install-surface-L2.1 | Agent platform install guidance |
