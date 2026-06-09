# 代码调查规则

> 本文件管辖:R23
> 主题:Spec 写作前必须基于实际代码（不靠想象）

## R23 — Spec 写作前必须执行三级代码调查

---
id: R23
title: Spec 写作前必须执行三级代码调查
added: 0.1.0
applies_to: [L1_create, L2_create, L3_create]
---

| Level | 触发时机 | 内容 | 最低要求 |
|---|---|---|---|
| Level 1 架构概览 | 写 L1 前 | 项目结构、技术栈、模块、API 端点、数据模型 | 读 README / 找 architecture-baseline；或 find + grep 补扫 |
| Level 2 模块深潜 | 写 L2 前 | 受影响模块的 controller / service / entity + 复用工具类 | 至少 Read 3 个源文件 |
| Level 3 文件级分析 | 写 L3 前 | 精确函数签名 / 插入行号 / 调用链 / 测试文件 | Read 验证每个文件路径存在 |

### 策略

- **基线优先**：先查 `spec list --q architecture-baseline` 看是否有基线 spec
- **基线不足时**：用 `find` / `grep` 实时补扫
- **Read 一致性**：写完 L1/L2/L3 后再 Read 一次确认字段名/路径未变化

### 违反判定

- L2 复用清单无具体路径（只有"用现有的 X"）
- L3 受影响模块未经 Read 验证
- 有基线 spec 但没读
- 新项目无基线就开始写 L1

### 关联

- R8 改代码前自检
- R12 planJson 字段名从模板读
