---
code: spec-knowledge-activation-hardening-L3.1.2
level: L3
title: Constraint Package Projection
topic: spec-knowledge-activation-hardening
parentCode: spec-knowledge-activation-hardening-L2.1
status: implemented
aiSummary: >-
  实现受控正文与代码模块信号，生成包含 Spec、Decision、关键 AC、Lessons、模块、冲突、来源、置信度和 unknown 的
  constraintPackage，保持检索排序和 Brief 兼容。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: '上下文收集: 读取 L3、父 L2、前序 L3、历史 Task 和 plan 模板'
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 src/core/spec-sections.ts 提取正文和代码模块信号
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 retrieval scoring 和 index 支持新增字段解释
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 src/core/capability-types.ts 定义 constraint package
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 src/core/capability-brief.ts 组装完整约束包
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 修改 Brief presenter 并补充 retrieval 与兼容测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: '验证: 运行定向 Vitest、lint、build 和全量测试'
    status: pending
relations:
  - type: based_on
    target: spec-knowledge-activation-hardening-L2.1
  - type: references
    target: spec-knowledge-activation-hardening-L3.1.1
created: '2026-07-16T08:12:02.037Z'
updated: '2026-07-16T08:36:21.702Z'
changeSummary: 'cascade: task-complete'
---
# Constraint Package Projection - 实施规格

## 目标

实施 `spec-knowledge-activation-hardening-L2.1` 的受控正文/模块信号与完整历史约束包。

**前置依赖**: `spec-knowledge-activation-hardening-L3.1.1` 已 implemented

## 实施步骤

### Step 1 - 上下文收集
- **SHALL** 读取本 L3、父级 `spec-knowledge-activation-hardening-L2.1`、前序 L3、历史 Task 和 plan 模板，复核 retrieval、Spec sections、Lessons、Brief types 与 presenter。

### Step 2 - 提取受控正文和模块信号
- 修改 `src/core/spec-sections.ts` 并新增必要 helper，从目标、接口、复用清单和 Task 产物提取有界文本与模块引用。

### Step 3 - 扩展检索字段解释
- 修改 `src/core/retrieval/scoring.ts` 与 `index.ts`，加入正文/模块字段权重和 match reason，保持稳定排序与 diversity。

### Step 4 - 定义 constraint package 类型
- 修改 `src/core/capability-types.ts`，新增 specs、decisions、acceptanceCriteria、lessons、codeModules、conflicts 和 unknownDimensions。

### Step 5 - 组装约束包
- 修改 `src/core/capability-brief.ts`，从共享激活结果、knowledge resolver、AC 与 approved Lessons 生成受控数量的 package；证据不足必须输出 unknown。

### Step 6 - 文本展示与兼容测试
- 修改 `src/cli/brief-presenter.ts`，扩展 `capability-brief.test.ts`、retrieval integration 与 brief compatibility 测试。

### Step 7 - 验证
- 运行 retrieval/Brief 定向测试、lint、build 和全量测试。

## 验证命令
```bash
npm test -- --run src/core/__tests__/integration/retrieval-integration.test.ts src/core/__tests__/capability-brief.test.ts src/core/__tests__/compatibility/brief-compatibility.test.ts
npm run lint
npm run build
npm test
```

## 验收标准
1. **AC-1**: constraintPackage **SHALL** 输出六类约束维度、来源、置信度和 unknownDimensions。
2. **AC-2**: 受控正文和模块信号 **SHALL** 参与评分且不得读取网络或扫描无关仓库内容。
3. **AC-3**: 冲突只能标记 candidate/unknown，**SHALL NOT** 自动改变知识状态或 history disposition。
4. **AC-4**: `agent-brief.v1` 现有字段、显式 topic 和数组上限 **SHALL** 保持兼容。

## 关键验收标准
- AC-1
- AC-2
- AC-3
- AC-4

## step_report 模板
```json
{"taskId":"<task id>","stepNo":1,"stepType":"tool_action","status":"succeeded","toolName":"<tool>","latencyMs":"<ms>","outputJson":"{\"summary\":\"<完成内容>\",\"files\":[]}"}
```

## planJson (final)
```json
{"coveredSpecs":["spec-knowledge-activation-hardening-L3.1.2"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"上下文收集: 读取 L3、父 L2、前序 L3、历史 Task 和 plan 模板"},{"stepNo":2,"stepType":"tool_action","name":"修改 src/core/spec-sections.ts 提取正文和代码模块信号"},{"stepNo":3,"stepType":"tool_action","name":"修改 retrieval scoring 和 index 支持新增字段解释"},{"stepNo":4,"stepType":"tool_action","name":"修改 src/core/capability-types.ts 定义 constraint package"},{"stepNo":5,"stepType":"tool_action","name":"修改 src/core/capability-brief.ts 组装完整约束包"},{"stepNo":6,"stepType":"tool_action","name":"修改 Brief presenter 并补充 retrieval 与兼容测试"},{"stepNo":7,"stepType":"tool_action","name":"验证: 运行定向 Vitest、lint、build 和全量测试"}]}
```

autoConfirm: false，约束包结果需通过自动测试和人工抽样复核。

## 回滚方案
| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 召回排序退化 | 移除新增字段权重并保留原候选字段 | < 10 min |
| Brief 兼容失败 | 移除 constraintPackage 可选投影 | < 10 min |

## 执行风险
| 风险 | 应对 |
|---|---|
| 正文噪声压过摘要 | 限制章节、长度和字段权重 |
| 模块引用误识别 | 只接受结构化路径模式并输出 sourceRef |

## 关联
| 关联类型 | 目标 specCode | 说明 |
|---|---|---|
| based_on | spec-knowledge-activation-hardening-L2.1 | 父技术设计 |
| references | spec-knowledge-activation-hardening-L3.1.1 | 依赖共享激活投影 |
