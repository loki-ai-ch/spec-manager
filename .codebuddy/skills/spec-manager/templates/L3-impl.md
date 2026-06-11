<!-- ========== Stage Charter: L3 Impl ==========
Value: 执行日志 — 回答"具体改哪些文件/函数,怎么验证"
Time horizon: 短期(实施完成即沉淀,后续仅供审计)
Target reader: Agent Task 执行者(AI agent)、代码审核者
Must NOT have:
  - 业务背景论证 / 用户故事 → 上到 L1
  - 架构选型对比 / 多方案比较 → 上到 L2
  - 成功标准(用户视角) → 上到 L1
  - 重复方案概述 → 引用 L2 code 即可
Soft boundary: 可引用父 L2 code + 一句话定位,不复述(见 rules/doc-governance.md#R14)

Expert guidelines:
  - 每步实施必须精确到函数/方法级别,禁止"修改相关代码"等模糊表述
  - planJson 字段名必须从 templates/agent-plan.json 读取,禁止凭记忆(R12/INC-005)
  - step_report 每步必须携带 outputJson(R15),格式见下方模板
  - coveredSpecs: 必须包含当前 L3 specCode；若本 Task 实际覆盖多条 L3,列出所有 specCode
  - 验证命令必须可直接粘贴执行,含预期输出的精确匹配串
  - 回滚方案不是可选项,每个 L3 必须说明"改坏了怎么恢复"
  - 写 L3 前必须执行 Level 3 文件级分析(R23,见 rules/codebase-survey.md)
  - 注: optimization-L1 P0 — 本模板不再含"变更文件清单"表格,文件变更由 git 管理
========== -->

# {{title}} — 实施规格

## 目标

<一句话 + 引用父 L2 的 deliverable 编号。形如"实施 auth-L2.1 的 deliverables 1/2/3">

**前置依赖**:<前序 L3 specCode 已 implemented 声明,若无则"无">

## 实施步骤

> **RFC 2119 关键字指引**: 实施步骤中使用以下关键字标注约束级别：
> - **SHALL** (必须) — 硬性要求,不执行则任务不可完成
> - **MUST** (应当) — 强烈建议,例外需说明理由
> - **SHOULD** (推荐) — 最佳实践,可酌情调整
> - **MAY** (可选) — 完全可选

### Step 1 — 上下文收集

- `spec-manager spec show <本 L3 code> --include-content` + `spec-manager spec show <父 L2 code> --include-content`
- 执行 Level 3 文件级分析(R23):
  - 查架构基线获取文件清单
  - Read L2"受影响模块"中的每个文件,确认存在
  - 追踪 import/依赖关系
  - 识别测试文件
  - 验证变更清单中所有路径
- `Read templates/agent-plan.json` 确认 planJson 字段名(R12)

### Step 2 — <具体动作>

- <精确到 Edit/Write/Bash,含 old_string 锚点>
- 完成后 step_report outputJson:
  ```json
  {"summary": "<完成内容>", "files": ["<变更文件>"]}
  ```

### Step N-1 — 部署(若涉及后端)

### Step N — 验证

<必须有正向验证(正常输入) + 反向验证(错误/边界输入)>

## 验证命令

```bash
# 正向验证: 正常场景
# 命令 + 预期输出(精确匹配串)
...

# 反向验证: 错误/边界场景
# 命令 + 预期错误码/消息
...
```

## step_report 模板

<每步完成后调用 `spec-manager task step` 时使用此格式。必须在工作完成后调用,不得预报>

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "mcp_tool",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

<⚠️ 字段名必须与 templates/agent-plan.json 一致: stepNo / stepType / name。禁止凭记忆拼写>

```json
{
  "coveredSpecs": ["<本 L3 specCode>"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "上下文收集: spec-manager spec show(L3 + 父 L2)"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "<动词+宾语+文件>"},
    {"stepNo": "N-1", "stepType": "mcp_tool", "name": "部署(若涉及后端)"},
    {"stepNo": "N", "stepType": "mcp_tool", "name": "验证: <命令 + 预期输出>"}
  ]
}
```

<autoConfirm 取值 + 理由>

## 回滚方案

<改坏了怎么恢复。必填>

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 代码问题 | `git revert <commit>` + 重新部署 | < 5 min |
| 数据问题 | <SQL 回滚脚本/备份恢复> | ... |

## 执行风险

<这一步卡住怎么办。禁架构风险(上到 L2)>

| 风险 | 应对 |
|---|---|
| ... | ... |

## 关联

<使用 `spec-manager spec add-relation <本L3 code> --type <type> --target <targetCode>` 建立关联>

| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | <父 L2 code> | 必填：引用父 L2 |
| implements | <父 L2 code> | 可选：明确实现关系 |
| references | <相关 specCode> | 可选：跨 spec 引用 |
