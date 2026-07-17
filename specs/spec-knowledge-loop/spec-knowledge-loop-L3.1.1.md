---
code: spec-knowledge-loop-L3.1.1
level: L3
title: 统一归一化、分词、候选评分、一跳关系扩展、稳定排序、多样性裁剪与核心单元测试
topic: spec-knowledge-loop
parentCode: spec-knowledge-loop-L2.1
status: implemented
aiSummary: 实现统一归一化、分词、候选评分、一跳关系扩展、稳定排序、多样性裁剪的核心算法，纯本地确定性实现，不依赖外部服务
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取 spec-knowledge-loop-L3.1.1 spec-knowledge-loop-L2.1 和前序 L3 规格
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 创建 src/core/retrieval/normalization.ts 实现统一归一化和分词
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 创建 src/core/retrieval/scoring.ts 实现候选评分算法
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 创建 src/core/retrieval/relation-expansion.ts 实现一跳关系扩展
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 创建 src/core/retrieval/sorting.ts 实现稳定排序
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 创建 src/core/retrieval/diversity.ts 实现多样性裁剪
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 创建 __tests__/retrieval/ 目录下的单元测试
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 验证 npm test 通过所有测试
    status: pending
  - stepNo: 9
    stepType: tool_action
    name: 验证 npm run build 成功
    status: pending
created: '2026-07-16T01:27:41.147Z'
updated: '2026-07-16T01:45:45.357Z'
changeSummary: 'cascade: task-complete'
---
# 统一归一化、分词、候选评分、一跳关系扩展、稳定排序、多样性裁剪与核心单元测试

## 实现概述

本 L3 实现 `spec-knowledge-loop-L2.1` 的核心检索算法，包括统一归一化、分词、候选评分、一跳关系扩展、稳定排序和多样性裁剪。所有实现均为纯本地、确定性算法，不依赖外部服务。

## 核心模块

### 1. 统一归一化 (`normalization.ts`)
- 文本归一化：Unicode NFC 归一化、空白字符标准化、标点符号处理
- 中英文分词：基于本地词典的中文分词，英文按空格分词
- 停用词过滤：中文停用词表、英文停用词表、自定义停用词

### 2. 候选评分 (`scoring.ts`)
- 字段权重配置：
  - 标题 (title): 3.0
  - 主题 (topic): 2.5
  - 代码 (code): 2.0
  - AI 摘要 (aiSummary): 1.5
  - 决策理由 (decision.what/why): 1.0
- 匹配算法：TF-IDF 变体，考虑词频和文档频率
- 置信度计算：基于匹配字段数量和权重

### 3. 一跳关系扩展 (`relation-expansion.ts`)
- 关系类型处理：
  - 基于 (based_on): 权重 0.8
  - 引用 (references): 权重 0.6
  - 实现 (implements): 权重 0.9
  - 父子关系 (parent/child): 权重 0.7
- 扩展策略：从高分候选扩展到直接关联的 spec/decision/task
- 去重机制：避免循环引用和重复扩展

### 4. 稳定排序 (`sorting.ts`)
- 主要排序键：匹配分数 (descending)
- 次要排序键：
  1. 状态权重：implemented > confirmed > draft
  2. 层级权重：L1 > L2 > L3
  3. 代码字母顺序
- 排序稳定性：相同配置下，相同输入总是产生相同输出

### 5. 多样性裁剪 (`diversity.ts`)
- 每个 topic 最多 2 个结果
- 优先保留 L1/L2 层级
- 当显式 topic 时，该 topic 不受多样性限制
- 总结果数限制：5 个

## 测试策略

### 单元测试
1. 归一化测试
   - 中文文本归一化
   - 英文文本归一化
   - 混合语言文本
   - 边界情况（空字符串、特殊字符）

2. 分词测试
   - 中文分词准确性
   - 英文分词准确性
   - 停用词过滤效果
   - 自定义停用词支持

3. 评分测试
   - 字段权重正确应用
   - 匹配分数计算准确性
   - 置信度等级正确划分
   - 无匹配词时的处理

4. 关系扩展测试
   - 一跳扩展正确性
   - 关系权重应用
   - 循环引用处理
   - 无效关系忽略

5. 排序测试
   - 分数排序正确性
   - 稳定性验证
   - 相同分数时的排序规则

6. 多样性裁剪测试
   - topic 限制生效
   - 层级优先级
   - 显式 topic 例外
   - 总数限制

### 集成测试
1. 端到端检索流程
   - 完整检索流程测试
   - 边界情况处理
   - 错误恢复机制

2. 性能测试
   - 196 个 spec 的检索性能
   - 内存使用监控
   - 响应时间目标：< 100ms

## 实现计划

### 第一阶段：基础模块
1. 创建 `normalization.ts` 和基础测试
2. 创建 `scoring.ts` 和评分测试
3. 创建 `relation-expansion.ts` 和扩展测试

### 第二阶段：排序和裁剪
1. 创建 `sorting.ts` 和排序测试
2. 创建 `diversity.ts` 和多样性测试
3. 集成测试和性能优化

### 第三阶段：文档和示例
1. 更新 API 文档
2. 创建使用示例
3. 性能基准测试报告

## 质量门禁

### 代码质量
- 单元测试覆盖率 > 90%
- TypeScript 严格模式通过
- ESLint 零警告
- 无 any 类型使用

### 性能要求
- 196 个 spec 检索时间 < 100ms
- 内存使用 < 50MB
- 无内存泄漏

### 兼容性
- 现有 `buildAgentBrief` API 兼容
- 现有 CLI 输出格式兼容
- JSON schema 向后兼容

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 中文分词准确性不足 | 召回率下降 | 使用多字段匹配，增加容错机制 |
| 性能不达标 | 用户体验下降 | 优化算法，增加缓存机制 |
| 内存使用过高 | 系统资源紧张 | 流式处理，避免全量加载 |
| 测试覆盖率不足 | 质量风险 | 严格门禁，增量测试 |

## 依赖关系

- 依赖 `spec-knowledge-loop-L2.1` (confirmed)
- 依赖现有 `project-snapshot.ts` 模块
- 依赖现有 `spec-io.ts` 模块
- 依赖现有 `lessons.ts` 模块

## 交付物

1. `src/core/retrieval/normalization.ts`
2. `src/core/retrieval/scoring.ts`
3. `src/core/retrieval/relation-expansion.ts`
4. `src/core/retrieval/sorting.ts`
5. `src/core/retrieval/diversity.ts`
6. `__tests__/retrieval/` 目录下的所有测试文件
7. 更新后的 API 文档
8. 性能基准测试报告
