# Sub-skill: Design (L2)

## 路由自检

✓ 走本 skill 的信号：用户说"技术方案/架构/选型/接口设计/数据模型/可选方案"
✗ 不走的信号：用户说"业务需求"（→ prd.md）或"实施"（→ impl.md）或"typo"（→ quick.md）

## 模板

- [templates/L2-design.md](../../templates/L2-design.md)

## 流程

### L2 Spec 创建

1. **确认父 L1**：`spec-manager spec show <L1 code>`（默认 narrow 视图读 aiSummary）
   > 🔍 **R19 自检**: 研究/跨层是否只读 aiSummary？→ `spec-manager audit hit R19`
2. **L2 全文读父**（R19 跨层设计强制）：写 L2 正文前必须 `spec show <L1 code> --include-content` 读父 L1 全文
3. **Level 2 代码调查**（R23）：Read ≥3 个源文件了解模块
4. **创建 L2**：
   ```bash
   spec-manager spec new L2 --topic <topic> --title "..." --parent <L1 code>  # --code 不传则自动生成
   ```
   > 🔍 **R7 自检**: L2 是否绑定了父 L1？→ `spec-manager audit hit R7`
5. **写正文**：
   ```bash
   spec-manager spec update <code> --content ./draft.md --ai-summary "..." --change-summary "..."
   ```
   L2 必填段：方案概述 / 受影响模块 / 接口契约 / L3 裂变计划
6. 🛑 **等用户审核**（R1）
7. 用户批准 → `spec-manager spec confirm <code>`（R2）

## L2 是架构拆解（R17）

- L1:L2 比例 1:1 或 1:2
- 按模块边界拆，不是功能点
- L2 裂变计划表格列出所有 L3

## 与主 SKILL.md 关系

L2 confirmed 后，路由到 `subskills/impl.md` 继续 L3。

## 适用规则

R1 / R2 / R4 / R7 / R13 / R14 / R17 / R19 / R22 / R23

## 相关规则（按需加载）

| 规则 ID | 文件 | 适用场景 |
|---|---|---|
| R7/R14/R17 | [rules/doc-governance.md](../../rules/doc-governance.md) | 层级绑定 / 跨层引用 / 架构拆解 |
| R19 | [rules/doc-governance.md](../../rules/doc-governance.md) | 写 L2 前必读父 L1 全文 |
| R23 | [rules/codebase-survey.md](../../rules/codebase-survey.md) | Level 2 模块深潜（≥3 源文件） |
