# Plan 子 skill — 实施计划（不是 L2 架构设计）

## 用途

为已确认的 L2 spec 写"实施计划"（plan.md）：
- **不是 L2 的架构设计**（L2 是"为什么这么做 / 怎么拆模块"）
- plan.md 是"接下来几周按什么顺序做什么"，可被任意角色读取
- 与 Agent Task 的关系：plan.md 是 task 的上游，task 是 plan 的执行

## 流程

1. 读父 L2 spec
2. 用 `spec new L3` 创建 L3 spec（已有则跳过）
3. 写 `plan.md`：

```bash
spec-manager spec show 2026-06-04-b2c3d4 --include-content
```

4. `plan.md` 结构：

```markdown
# <L2 title> 实施计划

## 阶段拆分
- 阶段 1（M1）：<一句话目标>
- 阶段 2（M2）：<一句话目标>
- ...

## 每个阶段交付
- M1：L3 spec 列表 + 预期工时
- M2：...

## 风险
- ...

## 里程碑 Spec
- M1: <link to L3 spec>
```

5. 写完用 `spec update` 把它存到 spec 的 frontmatter `changeSummary` 或专门建一个 plan/ 目录

## 关联规则

- R17 L2 是架构拆解不是 todolist（plan.md 才是 todolist）
- R20 scope-split 批量建齐子 L3
