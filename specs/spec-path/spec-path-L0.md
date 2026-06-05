---
code: spec-path-L0
level: L0
title: Spec 路径与命名规范
topic: spec-path
parentCode: null
status: frozen
aiSummary: 统一 spec 编码、目录结构和文件命名：点分编号 + 平铺布局 + desc 描述后缀
created: '2026-06-05T07:21:56.255Z'
updated: '2026-06-05T17:51:32+08:00'
changeSummary: 同步方法论 L0 必填段：愿景/路线图
---

# Spec 路径与命名规范

## 愿景

spec-manager 的 active spec 路径 SHALL 让人类和 AI 只通过 topic、level、code 就能稳定定位文档、理解层级、关联任务和决策，避免日期后缀和嵌套目录造成重复命名、迁移歧义和跨会话失忆。

## 路线图

1. **阶段 1**: 统一 code 语义为 `<topic>-L<N>[.<N>...][-<desc>]`。
2. **阶段 2**: active spec 文件落到 `specs/<topic>/<code>.md`。
3. **阶段 3**: 保留旧 `<code>-YYYYMMDD.md` 的读取与迁移兼容能力。
4. **阶段 4**: tasks/decisions 继续按 topic 归档，并通过 specCode 前缀避免冲突。

## 1. 目标

统一 spec-manager 项目的 spec 文件路径、编码和目录结构，使 AI Agent 和人类都能通过 code 自文档化理解层级关系。

## 2. 编码规则

### 2.1 格式

```
<topic>-L<N>[.<N>...][-<desc>]
```

| 层级 | 格式 | 示例 |
|------|------|------|
| L0 | `<topic>-L0` | `spec-path-L0` |
| L1 | `<topic>-L1` | `auth-L1` |
| L2 | `<topic>-L2.<N>` | `auth-L2.1` |
| L3 | `<topic>-L3.<N>.<M>[-desc]` | `auth-L3.1.1-login` |

### 2.2 约束

- topic: 小写字母 + 数字 + 连字符，如 `auth`、`billing-v2`
- desc（可选）: ≤15 字符，仅小写字母 + 数字 + 连字符
- 点分编号 N/M 从 1 开始，按同父创建顺序递增
- L2 必须有 parentCode 指向 L0 或 L1
- L3 必须有 parentCode 指向 L2

## 3. 目录结构

### 3.1 平铺布局

```
specs/<topic>/
├── <L1-code>.md
├── <L2-code>.md
├── <L3-code>[-desc].md
└── tasks/
    └── <L3-code>[-desc]-<taskId>.json
```

- 所有 spec .md 文件直接平铺在 `specs/<topic>/` 下，不嵌套子目录
- 点分编号已编码层级关系，无需目录层级体现父子
- tasks/ 目录在 topic 级别，task 文件名加 specCode 前缀避免冲突
- decisions/ 目录在 topic 级别

### 3.2 文件命名

```
<code>.md
```

- code = spec 编码（如 `auth-L3.1.1-login`）
- 创建时间只保存在 frontmatter `created` 字段
- 示例: `auth-L3.1.1-login.md`
- 旧格式 `<code>-<YYYYMMDD>.md` 仅作为兼容读取/迁移格式，不再作为 active spec 的 canonical 文件名

### 3.3 路径生成

`specFilePath(paths, parentFilePath, code, topic?, date?)`:

```
specs/<topic>/<code>.md
```

parentFilePath 和 date 参数保留（向后兼容），平铺布局下忽略。

## 4. 生成函数

```typescript
generateSpecCode(topic, level, parentCode?, siblingCount?, desc?)
```

| 输入 | 输出 |
|------|------|
| `('auth', 'L1')` | `auth-L1` |
| `('auth', 'L2', 'auth-L1')` | `auth-L2.1` |
| `('auth', 'L3', 'auth-L2.1')` | `auth-L3.1.1` |
| `('auth', 'L3', 'auth-L2.1', 0, 'login')` | `auth-L3.1.1-login` |
| `('auth', 'L3', 'auth-L2.1', 1, 'login')` | `auth-L3.1.2-login` |

## 5. Task 路径

```
specs/<topic>/tasks/<specCode>-<taskId>.json
```

- specCode 前缀避免跨 L3 的 T-001 冲突
- taskId 格式: `T-NNN`（三位数字，从 001 开始）

## 6. 迁移记录

| 日期 | 变更 |
|------|------|
| 2026-06-05 | 初始：`<YYYY-MM-DD>-<shortId>` 编码 + 嵌套目录 |
| 2026-06-05 | 改为 `<topic>-L<N>` 编码 + 嵌套目录 |
| 2026-06-05 | 改为点分编号 `<topic>-L<N>.<M>` + 平铺布局 + desc 后缀 |
| 2026-06-05 | active spec 文件名改为 `<code>.md`，旧 `<code>-<YYYYMMDD>.md` 作为兼容迁移格式 |
