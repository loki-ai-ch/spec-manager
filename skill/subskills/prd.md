# Sub-skill: PRD (L1)

## 路由自检

✓ 走本 skill 的信号：用户说"需求/想做 X/新功能/痛点/用户故事/商业价值"
✗ 不走的信号：用户说"实施/编码"（→ impl.md）或"技术方案"（→ design.md）或"typo"（→ quick.md）

## 模板

- [templates/L1-prd.md](../templates/L1-prd.md)
- skill 内 Read 该文件获取完整模板

## 流程

### L1 Spec 创建

1. **Q4 历史决策查询**（必做）：
   ```bash
   spec-manager decision list --topic <topic>
   ```
   若返回非空 → 向用户展示决策摘要,让用户确认新 L1 是否与历史一致或有意覆盖。
   > ☑ **R18** — 流程规则:新 L1 创建前查历史决策,避免与已实现 L1 的决策冲突
2. **PRE-WRITE Q1-Q3**（必做）：用当前工具的用户提问能力一次性问 3 个问题
   - Q1 核心痛点（量化）
   - Q2 范围边界（做/不做/推迟）
   - Q3 成功指标（基线 + 目标 + 测量方式）
3. **L1 去重搜索**（R16）：
   ```bash
   spec-manager spec list --level L1 --topic <topic>
   ```
   若发现同 topic L1 存在,**复用**而非新建。
   > ☑ **R16** — 流程规则:查重确认无重复 L1
4. **创建 L1**：
   ```bash
   spec-manager spec new L1 --topic <topic> --title "..."  # --code 不传则自动生成 <topic>-L1
   ```
5. **写正文**：把 L1-prd.md 模板填好后写到文件
   ```bash
   spec-manager spec update <code> --content ./draft.md --ai-summary "..." --change-summary "初始 L1"
   ```
   `spec update` 自动跑必填段校验（warning-only）。
   > ☑ **R13** / **R21** — `--ai-summary` ≤300 字符（CLI 截断,>300 自动 warn）
   > ☑ **R22** — 流程规则:创建后立即写正文,通知审核前自检 contentTemplate 非空（CLI 在 `confirm` 时强制校验）
6. 🛑 **等用户审核**（R1）
   > ☑ **R1** — 流程规则:停下等用户审核,不自行推进
7. 用户批准 → 调本 skill（不要凭上下文）：
   ```bash
   spec-manager spec confirm <code>
   ```
   > ☑ **R2** — 流程规则:状态变更由用户触发
   > ☑ **R4** — 流程规则:L1 审核独立,不连带假设 L2

## 与主 SKILL.md 关系

L1 confirmed 后,路由到 `subskills/design.md` 继续 L2。

## 适用规则

R1 / R2 / R4 / R7 / R13 / R14 / R16 / R17 / R19 / R22 / R23

## 相关规则（按需加载）

| 规则 ID | 文件 | 适用场景 | 类型 |
|---|---|---|---|
| R1/R2/R4 | [rules/flow-control.md](../../rules/flow-control.md) | 停下审核 / 状态归用户 / 每层独立 | 流程 |
| R7 | [rules/doc-governance.md](../../rules/doc-governance.md) | 层级绑定（虽 L1 无父,但确认子层要绑） | 代码 |
| R13/R21 | [rules/doc-governance.md](../../rules/doc-governance.md) | aiSummary 必传 + ≤300 字符 | 代码 |
| R14 | [rules/doc-governance.md](../../rules/doc-governance.md) | 跨层引用 — L1 不复述上层 | 流程 |
| R16 | [rules/doc-governance.md](../../rules/doc-governance.md) | L1 去重搜索 | 流程 |
| R19 | [rules/doc-governance.md](../../rules/doc-governance.md) | 研究期读 aiSummary 而非全文 | 流程 |
| R22 | [rules/doc-governance.md](../../rules/doc-governance.md) | 创建后立即写正文 | 代码（CLI 在 `confirm` 时强制） |
| R23 | [rules/codebase-survey.md](../../rules/codebase-survey.md) | 写 L1 前 Level 1 架构概览 | 流程 |
