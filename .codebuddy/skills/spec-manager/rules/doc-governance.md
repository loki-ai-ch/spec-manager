# 文档治理规则

> 本文件管辖:R7 R11 R13 R14 R16 R17 R19 R20 R21 R22
> 主题:层级绑定、粒度控制、摘要与变更说明、跨层引用、批量建齐、正文非空门禁

## Contents

- **R7 层级绑定** — L2/L3 必须有 `parentCode`
- **R11 粒度控制** — Agent Task ≤20 步
- **R13 aiSummary 上传** — 写完 contentTemplate 必须给 aiSummary
- **R14 跨层引用** — 用 specCode 而不是复述上层内容
- **R16 L1 去重** — 创建前必须搜同 topic
- **R17 L2 架构拆解** — L2 是架构不是 todolist
- **R19 研究先看摘要** — 研究期 `spec show` 默认收窄,需 aiSummary；跨层设计必须读父全文
- **R20 批量建 L3** — scope-split L2 必须 1 次建齐所有子 L3
- **R21 aiSummary ≤300 字符** — 硬限制
- **R22 创建即写正文** — 防 contentTemplate 空白进审核

---

## R7 — 层级建模已启用,L2/L3 必须绑定父 Spec

---
id: R7
title: 层级建模已启用,L2/L3 必须绑定父 Spec
added: 0.1.0
applies_to: [L2_create, L3_create]
---

`spec-manager spec new L2 --parent <L1 code>` 必须指定 `parentCode`。
`spec-manager spec new L3 --parent <L2 code>` 必须指定 `parentCode`。
CLI 在 `L2`/`L3` 缺 `--parent` 时直接拒绝（exit 2），不会创建文件。

## R11 — Agent Task 粒度控制

---
id: R11
title: Agent Task 粒度控制
added: 0.1.0
applies_to: [agent_task_create]
---

- 单个 Agent Task = 单个 L3 Spec = **≤ 20 个步骤**(用户授权 ≤10)
- **单步单责**：每个 planJson step 只做一件事（改一个文件 / 调一个工具 / 运行一次验证）
- 超过 16 步时，必须拆分为多个 L3 Spec

`spec-manager spec validate-plan` 自动检查并 warn。

## R13 — 写完 contentTemplate 后必须上传 aiSummary

---
id: R13
title: 写完 contentTemplate 后必须上传 aiSummary
added: 0.1.0
applies_to: [doc_update]
---

每次 `spec-manager spec update <code> --content <file>` 后，必须紧跟 `--ai-summary "..."`（同一调用或下次调用均可）。

**摘要必须遵循** `docs/ai-summary-spec.md` 的写作规范（三秒可读 + 具体到字段/文件/接口路径 + 按层级模板，≤200字）。

**同时要求**：每次 `spec-manager spec update` 必须在同一调用中传入 `--change-summary`，描述本次写入的原因。

## R14 — 跨层引用用 specCode,不复述上层内容

---
id: R14
title: 跨层引用用 specCode,不复述上层内容
added: 0.1.0
applies_to: [L2_write, L3_write]
---

**核心规则**:L2 Spec 引用 L1 时只写 `parentCode + 一句话定位`,不复制 L1 的用户故事/验收标准。L3 Spec 引用 L2 时只写一句话,不复制 L2 的架构描述。

### 判定

✅ 正确:

- L2: `本 L2 实现 auth-L1 的目标 3(演进闭环)。L1 的用户故事详见其正文。`
- L3: `本 L3 对应 auth-L2.1 的 L3 裂变计划,落地 5 份模板文件。`

❌ 错误:

- L2 正文大段粘贴 L1 的"用户故事"和"验收标准"章节
- L3 正文重复 L2 的"方案概述"和"关键技术决策"
- L3 重新阐述业务背景(应引用 L1 code)

### 为什么

- **单一真相源**:同一信息只写一处,修改时不分裂
- **反向溯源**:未来审计链路 L3→L2→L1 通过 parentCode 一跳一跳走
- **分层老化**:L3 短期失效(实施完成即历史),L1 长期沉淀

## R16 — L1 创建前必须搜索去重

---
id: R16
title: L1 创建前必须搜索去重
added: 0.1.0
applies_to: [L1_create]
---

创建 L1 Spec 前，必须先执行：

```bash
spec-manager spec list --level L1 --topic <topic>
```

若发现同 topic 的 L1 已存在，应复用现有 L1（追加用户故事/验收标准），而非新建。

## R17 — L2 是架构拆解，不是任务清单

---
id: R17
title: L2 是架构拆解，不是任务清单
added: 0.1.0
applies_to: [L2_create]
---

**L1:L2 比例必须控制在 1:1 或 1:2。** L2 的拆分维度是**模块边界 / 系统层**，不是功能点清单。

### 自检

创建 L2 前问自己：
1. 这个 L2 和同层其他 L2 是否改的是**不同模块/系统层**？→ 是则合理
2. 这些 L2 是否都在改**同一个模块的不同功能点**？→ 是则应合并为一个 L2，功能点下沉到 L3

## R19 — 跨层引用/研究优先读 aiSummary

---
id: R19
title: 跨层引用/研究优先读 aiSummary
added: 0.1.0
applies_to: [doc_list, spec_show, research, cross_layer_reference, L2_write, L3_write, cross_layer_design]
---

> 人工审计:本规则靠自律,默认收窄视图,需全文时显式 `--include-content` / `Include-Content`。

**核心规则**：研究、扫目录、跨层引用场景，**优先只读 `aiSummary`**（≤300字），不要 `spec show <code> --include-content` 拉全文。

### 何时必须只读 aiSummary

- `spec list` 返回结果的初筛（扫 code + aiSummary 判断是否相关）
- L2/L3 启动时读父层（`spec show <parent>` 只为"知道父层长啥样"）
- 跨 topic 关联时扫 `decision list` 结果
- L1 去重搜索（R16）的结果比对

### 何时允许读全文

只有以下 3 种场景允许 `--include-content`：

1. **即将写作本层正文** — 需要精确对齐父层的用户故事/接口契约/章节编号
2. **执行 Agent Task 步骤** — 需要精确字段名/文件行号（R12 要求凭 Spec 不凭记忆）
3. **aiSummary 明显不够** — 读完 aiSummary 仍无法判断是否重复/是否要引用

### 跨层设计必须读父层全文

**核心规则**：写 L2 正文前必须读 L1 全文，写 L3 正文前必须读 L2 全文。aiSummary 不能替代全文。这是流程问题，不是优化问题。

## R20 — scope-split L2 必须批量建齐所有子 L3

---
id: R20
title: scope-split L2 必须批量建齐所有子 L3
added: 0.1.0
applies_to: [L2_scope_split, L3_create]
---

**核心规则**：当一个 L2 决定拆成 N 个 L3 执行（scope-split）时，必须在第一个 L3 推 `frozen` **之前**，把全部 N 个子 L3 spec 都通过 `spec-manager spec new` 建好（可保持 `draft` 状态）。禁止"先建 L3-A 走 frozen → complete，再回头建 L3-B"的顺序。

**重要**："建齐" = 每个子 L3 都同时满足（1）`spec new` 建立 +（2）`spec update --content` 写入非空正文。

## R21 — aiSummary ≤300 字符

---
id: R21
title: aiSummary ≤300 字符
added: 0.1.0
applies_to: [doc_update]
---

`spec-manager spec update --ai-summary` 入参 >300 字符时自动截断并 warn。**不 throw**。

**生成摘要时直接控制在 200 字以内即可**（与 R13 写作规范一致）。

## R22 — spec 创建后必须立即写正文，通知用户审核前自检 contentTemplate 非空

---
id: R22
title: spec 创建后必须立即写正文,通知用户审核前自检 contentTemplate 非空
added: 0.1.0
applies_to: [doc_create_spec, user_review_signal, L1_create, L2_create, L3_create, scope_split_batch_create]
---

**核心规则**：调用 `spec-manager spec new` 后，**必须紧跟一次** `spec-manager spec update <code> --content <file> --ai-summary "..." --change-summary "..."` 写入非空正文，才能视为该 spec 创建完成。**禁止**只创建空架子（仅 metadata：title/code/level/parentCode/description）就向用户发出"spec 写完了，请审核"信号。
