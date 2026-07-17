---
code: spec-knowledge-loop-L3.1.2
level: L3
title: Agent Brief、Lessons、Guided Assist、文本/JSON 输出集成，固定评测集与兼容回归
topic: spec-knowledge-loop
parentCode: spec-knowledge-loop-L2.1
status: implemented
aiSummary: 将核心检索算法集成到Agent Brief、Lessons和Guided Assist系统中，确保向后兼容性，提供固定评测集用于回归测试
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 spec-knowledge-loop-L3.1.2 spec-knowledge-loop-L2.1 和前序 L3 规格
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 修改 src/core/capability-brief.ts 集成检索编排
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 修改 src/core/lessons.ts 支持跨 topic 经验
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 修改 src/core/guided-assist.ts 支持全库召回
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 修改 src/cli/brief-presenter.ts 更新输出格式
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 创建 __tests__/integration/ 目录下的集成测试
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 创建 __tests__/compatibility/ 目录下的兼容性测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 验证 npm test 通过所有测试
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: 验证 npm run build 成功
    status: pending
created: '2026-07-16T01:28:21.045Z'
updated: '2026-07-16T02:39:26.841Z'
changeSummary: 'cascade: task-complete'
---
# Agent Brief、Lessons、Guided Assist、文本/JSON 输出集成，固定评测集与兼容回归

## 实现概述

本 L3 实现 `spec-knowledge-loop-L2.1` 的集成层，将核心检索算法集成到现有的 Agent Brief、Lessons 和 Guided Assist 系统中。确保向后兼容性，并提供固定评测集用于回归测试。

## 集成模块

### 1. Agent Brief 集成 (`capability-brief.ts`)
- 修改 `buildAgentBrief` 函数，集成检索编排
- 显式 topic 处理：保持现有严格过滤逻辑
- 推断 topic 处理：仅用于排序信号，不用于过滤
- 结果投影：将检索结果转换为现有的 Brief 格式
- 新增字段：添加可选的 `retrieval` 和 `match` 元数据

### 2. Lessons 集成 (`lessons.ts`)
- 修改 `buildLessonsReport` 函数，支持跨 topic 经验
- 决策、失败任务、事故的跨 topic 检索
- 保持现有 Lessons 输出格式兼容性
- 新增匹配理由和置信度信息

### 3. Guided Assist 集成 (`guided-assist.ts`)
- 修改引导助手，支持全库召回
- 推断 topic 不再阻断 Brief 的全库召回
- 保持现有引导入口和阶段选择
- 新增检索状态反馈

### 4. 输出格式集成
- JSON 输出：保持 `agent-brief.v1` schema 兼容
- 文本输出：在现有输出基础上增加解释信息
- 新增字段：`retrieval`、`match`、`confidence` 等

## 测试策略

### 固定评测集
1. 测试用例设计
   - 显式 topic 测试用例（5 个）
   - 无显式 topic 测试用例（5 个）
   - 边界情况测试用例（3 个）
   - 性能测试用例（2 个）

2. 评测数据
   - 196 个 spec 的完整数据集
   - 决策、任务、事故的完整数据集
   - 关系索引的完整数据集

3. 评测指标
   - 查询成功率 (success@5)
   - 假无历史率
   - 候选数分布
   - 返回数分布
   - topic 多样性

### 兼容性测试
1. API 兼容性
   - 现有 `buildAgentBrief` 调用兼容
   - 现有 CLI 输出格式兼容
   - JSON schema 向后兼容

2. 数据兼容性
   - 历史 spec 数据兼容
   - 历史任务数据兼容
   - 配置格式兼容

3. 工作流兼容性
   - next command 兼容
   - Profile 推荐兼容
   - Design Context 兼容
   - 人工审批门禁兼容

### 回归测试
1. 功能回归
   - 现有功能无破坏
   - 新增功能正常工作
   - 边界情况正确处理

2. 性能回归
   - 检索性能无下降
   - 内存使用无异常增长
   - 响应时间无显著增加

## 实现计划

### 第一阶段：Agent Brief 集成
1. 修改 `capability-brief.ts`，集成检索编排
2. 添加新的输出字段和元数据
3. 更新相关单元测试

### 第二阶段：Lessons 和 Guided Assist 集成
1. 修改 `lessons.ts`，支持跨 topic 经验
2. 修改 `guided-assist.ts`，支持全库召回
3. 更新相关单元测试

### 第三阶段：输出格式和评测集
1. 更新 JSON 和文本输出格式
2. 创建固定评测集
3. 创建兼容性测试套件

### 第四阶段：文档和示例
1. 更新 API 文档
2. 创建使用示例
3. 更新 README 和指南

## 质量门禁

### 代码质量
- 单元测试覆盖率 > 85%
- TypeScript 严格模式通过
- ESLint 零警告
- 无破坏性变更

### 兼容性
- 现有 API 100% 兼容
- 现有 CLI 输出 100% 兼容
- 现有 JSON schema 100% 兼容

### 性能
- 集成后性能下降 < 10%
- 内存使用增加 < 20MB
- 响应时间增加 < 50ms

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 集成破坏现有功能 | 用户工作流中断 | 严格兼容性测试，增量集成 |
| 性能下降 | 用户体验下降 | 性能监控，优化关键路径 |
| 输出格式不兼容 | 现有工具失效 | 保持现有字段，添加可选字段 |
| 评测集不全面 | 质量风险 | 多样化测试用例，边界覆盖 |

## 依赖关系

- 依赖 `spec-knowledge-loop-L3.1.1` (implemented)
- 依赖现有 `capability-brief.ts` 模块
- 依赖现有 `lessons.ts` 模块
- 依赖现有 `guided-assist.ts` 模块
- 依赖现有 `brief-presenter.ts` 模块

## 交付物

1. 修改后的 `src/core/capability-brief.ts`
2. 修改后的 `src/core/lessons.ts`
3. 修改后的 `src/core/guided-assist.ts`
4. 修改后的 `src/cli/brief-presenter.ts`
5. `__tests__/integration/` 目录下的集成测试
6. `__tests__/compatibility/` 目录下的兼容性测试
7. `benchmarks/` 目录下的性能测试
8. 更新后的 API 文档
9. 更新后的 README 和指南
