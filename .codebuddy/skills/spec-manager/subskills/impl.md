# Sub-skill: Impl (L3 + Agent Task)

## 路由自检

✓ 走本 skill 的信号：用户说"实施/实现/编码/写代码/具体文件/planJson"
✗ 不走的信号：用户说"业务需求"（→ prd.md）或"架构设计"（→ design.md）或"typo"（→ quick.md）

## 模板

- [templates/L3-impl.md](../templates/L3-impl.md)
- [templates/agent-plan.json](../templates/agent-plan.json)（planJson 字段名 stepNo/stepType/name）

## 流程

### L3 Spec 创建

1. **确认父 L2**：`spec-manager spec show <L2 code>`
   > ☑ **R7**: L3 必须绑父 L2（违反时 CLI 自动 audit hit,见 `audit show`）
2. **L3 全文读父**（R19 跨层设计强制）：`spec show <L2 code> --include-content`
3. **文件级分析（Level 3）**（R23）：
   - 读 L2"受影响模块"中的每个文件，确认存在
   - 追踪 import/依赖：`grep -rn "functionName" <module-dir>`
   - 识别测试文件：`find <module-dir>/../test -name "*Test*"`
   > ☑ **R23** / **R12** / **R8** — 流程规则,人工把关
4. **创建 L3**：
   ```bash
   spec-manager spec new L3 --topic <topic> --title "..." --parent <L2 code>  # --code 不传则自动生成 <topic>-L3.N.M[-desc]
   ```
   > ☑ **R20** — 流程规则:scope-split L2 时所有子 L3 一次建齐
5. **写正文**：
   ```bash
   spec-manager spec update <code> --content ./draft.md --ai-summary "..." --change-summary "..."
   ```
   L3 必填段：目标 / 实施步骤 / 验证命令
   planJson ≤ 20 步（用户授权 ≤10 — R11），Step 1 上下文收集，末步验证（R10）
   ```bash
   spec-manager spec validate-plan ./plan.json  # R10/R11 校验,违反时自动 audit hit
   ```
   > ☑ **R11** / **R10** — `validate-plan` 违反时自动 audit hit
   > ☑ **R13** / **R21** — `--ai-summary` ≤300 字符（CLI 截断,>300 自动 warn）
   > ☑ **R14** / **R22** — 流程规则,人工把关
6. 🛑 **等用户审核**（R1）— 流程规则,停下等用户信号
7. 用户一次批准 → `spec-manager spec confirm <code>`，L3 直接进入 `frozen`
   > ☑ **R2** / **R4** — 流程规则:状态由用户推进,每层独立审核
   > CLI 在批准进入 `frozen` 之前会校验 R22（contentTemplate 非空）

### Agent Task 执行

8. **查历史任务**（连续性层）：
   ```bash
   spec-manager task list --topic <topic>
   ```
   了解同主题已有实现模式，复用成功的步骤顺序，避免重复踩坑。
9. **frozen 才可建 Task**（R3）：
   ```bash
   spec-manager task create <L3 code> --plan ./plan.json --auto-confirm
   ```
   > ☑ **R3** — 非 frozen 时 CLI 拒绝并 audit hit
10. `spec-manager task start <task-id>`
11. 逐步 `spec-manager task step <task-id> --no N --type T --name S --status succeeded --output-json J --latency L`
    - 禁跳步（R5）
    - outputJson 必含 summary（R15）
    - step_report 必须在工作完成后才报（R15）
    > ☑ **R5** — `task complete` 时仍有 pending/running 步会拒绝并报错
    > ☑ **R15** — outputJson 缺 summary 时 warning 落 warn 数组
12. 最后一个子 Task 完成前，对即将级联的 confirmed L1 检查并预建 R18 决策卡片：
    ```bash
    spec-manager decision list --doc-code <L1-code>
    spec-manager decision create <L1-code> --topic <topic> --what "..." --why "..."
    ```
13. `spec-manager task complete <task-id>`
    > ☑ **R6** — 流程规则:确认 cascade 后再标 implemented
    > ☑ **R18** — L1 cascade 到 implemented 后自动校验预建决策卡片，缺失则拒绝完成并回滚
14. 若仍 frozen,手动 `spec-manager spec implement <L3 code>`
15. 异常或历史恢复必须使用独立跳过参数并提供原因，跳过 R18 后必须立即补建 active 决策卡：
    ```bash
    spec-manager task complete <task-id> --skip-r18 --reason "历史仓库恢复"
    spec-manager decision create <L1-code> --topic <topic> --what "..." --why "..."
    ```
16. 规则审计合规检查：
    ```bash
    spec-manager audit show
    ```
    确认最低合规基线通过（R1≥1, R4≥1, R13≥1, R22≥1）

## 与主 SKILL.md 关系

L2 confirmed 后进入本 skill。Agent Task 完成后走 `/deploy` skill 部署。

## 适用规则

R1 / R2 / R3 / R4 / R5 / R6 / R7 / R8 / R10 / R11 / R12 / R13 / R14 / R15 / R18 / R20 / R22 / R23

## 相关规则（按需加载）

| 规则 ID | 文件 | 适用场景 | 类型 |
|---|---|---|---|
| R1/R2/R4 | [rules/flow-control.md](../../rules/flow-control.md) | 停下审核 / 状态归用户 / 每层独立 | 流程 |
| R3/R5/R6 | [rules/flow-control.md](../../rules/flow-control.md) + [rules/quality-gate.md](../../rules/quality-gate.md) | frozen 才建 Task / 不跳步 / task 后校验 | 流程 + 代码 |
| R7/R11/R13/R14/R22 | [rules/doc-governance.md](../../rules/doc-governance.md) | 层级绑定 / 粒度 / aiSummary / 跨层引用 / 创建即写正文 | 代码 + 流程 |
| R8/R12 | [rules/code-discipline.md](../../rules/code-discipline.md) | 改代码前自检 / 禁凭记忆 | 流程 |
| R10/R15/R18 | [rules/quality-gate.md](../../rules/quality-gate.md) | planJson 必含验证 / step 必含 summary / 决策卡片 | 代码 |
| R20 | [rules/doc-governance.md](../../rules/doc-governance.md) | scope-split 批量建齐 | 流程 |
| R23 | [rules/codebase-survey.md](../../rules/codebase-survey.md) | Level 3 文件级分析 | 流程 |

**类型说明**:
- **代码**:违反时 CLI 自动抛错或 audit hit
- **流程**:无自动审计,人工把关
