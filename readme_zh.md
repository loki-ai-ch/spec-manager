# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md)

**本地优先的规格驱动开发平台。** 纯 markdown + git 存储。无网络、无 MCP、无后端。

---

## 功能特性

- **四层漏斗** — 需求 → 设计 → 实施 → 连续性，每层有人工审核门禁
- **L0/L1/L2/L3 spec 层级** — 愿景 / PRD / 技术设计 / 实施规格
- **24 条规则** + `applies_to` 过滤 — 无需每次加载全部 24 条
- **状态机** `draft → confirmed → frozen → implemented`
- **Agent Task 生命周期** — `create → start → step → complete`,步骤写在 spec frontmatter;R5 阻止跳步 complete
- **决策卡片** 带 `what/why/affectedCriteria` 三段 + topic 查询
- **规则审计** at-least-once 本地 JSON 累加器
- **Delta specs** (OpenSpec 风格 `changes/<name>/`,含 ADDED/MODIFIED/REMOVED/RENAMED + archive merge)
- **多 Agent 配置** — 一个命令安装 Claude Code、Codex、OpenCode、CodeBuddy 指令
- **RFC 2119** 关键字(SHALL/MUST/SHOULD)在验收标准中校验
- **事故追踪** — 规则违规驱动规则迭代

> 完整方法论：[docs/methodology.md](docs/methodology.md)

## 安装

```bash
# 直接运行（推荐）
npx spec-manager <command>

# 或全局安装
npm install -g spec-manager
```

## AI Agent 配置

spec-manager 不绑定单一 AI 工具：CLI 负责把规格、任务、决策和审计数据落到本地文件；AI 工具只需要一个能强制执行同一套规则的工作流入口。内置安装器支持 Claude Code、Codex、OpenCode、CodeBuddy，以及其他兼容 `AGENTS.md` 的 agent。

不是每个工具都有原生的 "skills" 目录。spec-manager 会按平台安装最接近的形式：平台支持 skill 时安装真实 skill；平台不支持时，用项目级 `AGENTS.md` 作为类 skill 的工作流胶囊。

### 推荐安装

```bash
cd my-project
spec-manager project init --name my-project
spec-manager project agents --provider all
```

会写入：

| Provider | spec-manager 入口 | 文件 |
|---|---|---|
| Claude Code | 原生 skill | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| Codex | `AGENTS.md` 工作流胶囊，不是原生 skill | `AGENTS.md` |
| OpenCode | `AGENTS.md` 工作流胶囊，不是原生 skill | `AGENTS.md` |
| CodeBuddy | 原生 skill | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |

也可以只安装部分入口：

```bash
spec-manager project agents --provider list
spec-manager project agents --provider all --dry-run
spec-manager project agents --provider codex,opencode
spec-manager project agents --provider codebuddy --force
```

使用 `--dry-run` 可以在实际写入前预览会创建、覆盖和跳过哪些文件。

参考：[Codex `AGENTS.md`](https://github.com/openai/codex/blob/main/docs/agents_md.md)、[OpenCode rules](https://opencode.ai/docs/rules/)、[CodeBuddy skills](https://www.codebuddy.ai/docs/cli/skills)。

对 Codex CLI 来说，不需要找 `skills` 命令或目录。只要在项目根目录运行 Codex，它会读取 `AGENTS.md`。你让它 "Use spec-manager ..." 时，这个文件就相当于 spec-manager 的工作流入口。

### 手动安装

如果不使用安装器，也可以直接复制模板：

```bash
# Codex / OpenCode / AGENTS.md 兼容工具（类 skill 工作流胶囊）
cp path/to/spec-manager/templates/agents/AGENTS.md my-project/AGENTS.md

# Claude Code
mkdir -p my-project/.claude/skills/spec-manager
cp -r path/to/spec-manager/skill/* my-project/.claude/skills/spec-manager/
cp -r path/to/spec-manager/rules my-project/.claude/skills/spec-manager/rules
cp -r path/to/spec-manager/templates my-project/.claude/skills/spec-manager/templates
cp path/to/spec-manager/templates/agents/CLAUDE.md my-project/CLAUDE.md

# CodeBuddy
mkdir -p my-project/.codebuddy/skills/spec-manager
cp -r path/to/spec-manager/skill/subskills my-project/.codebuddy/skills/spec-manager/subskills
cp -r path/to/spec-manager/rules my-project/.codebuddy/skills/spec-manager/rules
cp -r path/to/spec-manager/templates my-project/.codebuddy/skills/spec-manager/templates
cp path/to/spec-manager/templates/agents/CODEBUDDY.md my-project/CODEBUDDY.md
cp path/to/spec-manager/templates/agents/codebuddy-skill/SKILL.md my-project/.codebuddy/skills/spec-manager/SKILL.md
```

### 开始迭代

```bash
# Claude Code / CodeBuddy skill:
/spec-manager 新增用户认证功能

# Codex / OpenCode / 其他 AGENTS.md agent:
使用 spec-manager 新增用户认证功能。
```

AI 会按 L1→L2→L3→Task 管线推进，每层都有人工审核关卡。完整 24 条规则见 [rules/](rules/)。

## 快速开始

```bash
cd my-project
spec-manager project init --name my-project
spec-manager project agents --provider all
spec-manager spec new L1 --topic auth --title "用户认证"  # 自动生成 auth-L1
# 写正文到 ./l1.md，然后：
spec-manager spec update auth-L1 --content ./l1.md \
  --ai-summary "OAuth 2.0 + JWT,3 个端点" --change-summary "初始 L1"
# 等用户审核
spec-manager spec confirm <code>
# L2/L3 类似：spec new L2 --parent <L1 code>
```

或使用已配置的 AI agent:

```bash
/spec-manager 新增用户认证功能
```

## 更易用的工作流

日常使用时，可以用这些辅助命令减少记忆成本：

```bash
spec-manager project doctor                 # 检查初始化、agent 文件、skill 资产、占位 spec、audit
spec-manager flow status --topic auth       # 展示 L1/L2/L3/Task 进度和下一条命令
spec-manager guide "新增用户认证"            # 根据请求给出下一步
spec-manager new feature --topic auth "用户认证"
spec-manager approve auth-L1                # draft→confirmed，或 L3 confirmed→frozen
spec-manager run auth-L3.1.1 --plan ./plan.json
spec-manager template L1 --title "用户认证" > l1.md
```

原有长命令仍然可用；这些快捷入口只是封装同一套规则和状态机。

| 命令 | 什么时候用 | 它会给你什么 |
|---|---|---|
| `project doctor` | 不确定项目是否配置完整时 | 初始化、agent 文件、skill 资产、占位 spec、audit 检查和修复命令 |
| `flow status` | 想知道某个 topic 卡在哪一步时 | L1/L2/L3/Task 状态和下一条命令 |
| `guide` | 有需求但不知道从哪条命令开始时 | 不改文件，只给出下一步 |
| `new feature` | 想快速安全地启动一个 L1 时 | 创建 L1 壳并打印后续 update 命令 |
| `approve` | 用户已经明确批准某个 spec 时 | 推进 `draft→confirmed` 或 `L3 confirmed→frozen` |
| `run` | frozen L3 已准备执行时 | 根据 plan 文件创建并启动 task |
| `template` | 需要 L1/L2/L3 或 `agent-plan` 草稿时 | 输出或写入内置模板 |

示例：

```bash
spec-manager project doctor
spec-manager flow status --topic auth
spec-manager template L2 --title "发票模块" --output l2.md
spec-manager guide "新增账单导出"
```

## 使用场景

### 1. 快速修复（typo / 一行改动）

```bash
spec-manager spec show <code> --include-content     # 读当前 spec
# 直接编辑文件，然后：
spec-manager spec update <code> --content ./fixed.md --ai-summary "修复 AC-2 笔误" --change-summary "typo fix"
```

### 2. 研究查询（浏览已有 spec）

```bash
spec-manager spec list                               # 全部 spec
spec-manager spec list --level L1 --status confirmed  # 按条件过滤
spec-manager spec show <code>                         # 仅元数据（R19）
spec-manager decision list --topic auth               # 决策历史
```

### 3. 完整功能开发（L1 → L2 → L3 → Task）

```bash
spec-manager spec new L1 --topic billing --title "计费系统"
spec-manager spec update <l1-code> --content ./l1.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm <l1-code>                   # 用户审核

spec-manager spec new L2 --topic billing --title "发票模块" --parent <l1-code>
spec-manager spec update <l2-code> --content ./l2.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm <l2-code>

spec-manager spec new L3 --topic billing --title "PDF 生成" --parent <l2-code>
spec-manager spec update <l3-code> --content ./l3.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm <l3-code>
spec-manager spec freeze <l3-code>                    # frozen 后可建 task

spec-manager task create <l3-code> --plan ./plan.json --auto-confirm
spec-manager task start T-001
spec-manager task step T-001 --no 1 --status succeeded --output-json '{"summary":"..."}'
spec-manager task complete T-001                      # 级联 L3→L2→L1
```

### 4. Delta change（修改已上线 spec）

```bash
spec-manager change new add-2fa --description "新增 2FA"
# 编辑 changes/add-2fa/proposal.md + deltas/<code>.md
spec-manager change archive add-2fa                  # 应用并归档
```

### 5. 复盘（事故记录）

```bash
spec-manager incident new --severity high --rule R5 --spec <code>
# 填写 .spec-manager/incidents/INC-*.md
spec-manager incident list
```

## 教程 — 一个功能的完整生命周期

下面以"用户认证"功能为例,走一遍从需求到上线的全流程。每一步对应一条 CLI 调用加一个人工审核关卡。

### 1. 初始化项目

```bash
mkdir my-project && cd my-project
git init
spec-manager project init --name my-project
```

会创建 `.spec-manager/`(config + audit + incidents)。`.spec-manager/audit.json` 是否加入 `.gitignore` 看你 —— 提交也行,留本地也行。

### 2. 写 L1 PRD(what & why)

```bash
spec-manager spec new L1 --topic auth --title "用户认证"
# → 输出: code auth-L1,文件 specs/auth/auth-L1.md
```

写正文前,先回答 3-4 个 PRE-WRITE 问题(见 `templates/L1-prd.md`):谁的用户、成功指标、明确不做的事 —— 如果该 topic 有 active 决策卡片,还要先查一下 `spec-manager decision list --topic auth`,确认新 L1 与历史决策是否一致。

然后把正文写到草稿文件再 `update`:

```bash
cat > /tmp/auth-l1.md <<'EOF'
# 用户认证 — L1 PRD

## 背景
... (用户故事、MoSCoW 分级、验收标准、范围边界)

EOF

spec-manager spec update auth-L1 \
  --content /tmp/auth-l1.md \
  --ai-summary "OAuth 2.0 + JWT,3 个端点,/login /refresh /me" \
  --change-summary "初始 L1"
```

`update` 会自动跑一次必填段 + RFC 2119 关键字校验(只 warn,不阻塞)。**此时不要推进 status** —— `update` 写完仍是 `draft`。

### 3. 确认 L1(用户审核关卡)

```bash
spec-manager spec confirm auth-L1
# status: draft → confirmed
```

用户用 `spec show auth-L1 --include-content` 通读正文,批准后才进 L2。

### 4. 写 L2 设计(how)

L2 跟 L1 比例 1:1 或 1:2,**按模块边界拆,不按功能点**(R17)。每个 L2 必须绑父 L1。

```bash
spec-manager spec new L2 --topic auth --title "OAuth 2.0 后端设计" --parent auth-L1
# → 输出: code auth-L2.1

# 写 L2 正文(技术方案、模块边界、接口契约、L3 裂变计划)
cat > /tmp/auth-l2.md <<'EOF'
# OAuth 2.0 后端设计 — L2

## 方案概述
...

## 接口契约
| 端点 | 方法 | 入参 | 出参 | 错误码 |
|---|---|---|---|---|
| /login | POST | {email, password} | {accessToken, refreshToken} | 401 |

## L3 裂变计划
| L3 code | 范围 | 前置依赖 |
|---|---|---|
| auth-L3.1.1-jwt | JWT 签发模块 | 无 |
| auth-L3.1.2-refresh | Refresh token 模块 | auth-L3.1.1-jwt implemented |
EOF

spec-manager spec update auth-L2.1 \
  --content /tmp/auth-l2.md \
  --ai-summary "JWT 签发/验证、refresh 轮换、3 个端点" \
  --change-summary "初始 L2"
```

用户审核 → `spec confirm auth-L2.1`。

### 5. 写 L3 实施规格(精确步骤)

```bash
spec-manager spec new L3 --topic auth --title "JWT 签发模块" --parent auth-L2.1 --desc jwt
# → 输出: code auth-L3.1.1-jwt
```

L3 是实施精度的归属:文件路径、函数签名、planJson 步骤都写在这里。planJson 单独放一个文件:

```bash
cat > /tmp/jwt-plan.json <<'EOF'
{
  "coveredSpecs": ["auth-L3.1.1-jwt"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "Read 父 L2 + 同 L1 历史 spec 全文,确认无重复实现"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "新建 src/auth/jwt.ts 实现 signJwt(payload, secret, ttl)"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "新建 src/auth/__tests__/jwt.test.ts 覆盖 sign + verify + 过期"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "验证: pnpm test src/auth/jwt.test.ts 返回 0 失败"}
  ]
}
EOF

# 提交到 L3 前先校验 planJson
spec-manager spec validate-plan /tmp/jwt-plan.json

# 写 L3 正文(引用 planJson)
cat > /tmp/jwt-l3.md <<'EOF'
# JWT 签发模块 — L3

## 目标
实施 auth-L2.1 的 deliverables 1/2/3 中的"JWT 签发"部分。

## 实施步骤
见 /tmp/jwt-plan.json (4 步,末步必为验证)
EOF

spec-manager spec update auth-L3.1.1-jwt \
  --content /tmp/jwt-l3.md \
  --ai-summary "signJwt/verifyJwt 函数 + 单元测试 + 4 步 planJson" \
  --change-summary "初始 L3"
```

L3 需要两次确认:`spec confirm auth-L3.1.1-jwt` 后再 `spec freeze auth-L3.1.1-jwt`。`frozen` 是建 Agent Task 的前置条件。

### 6. 创建并执行 Agent Task

```bash
spec-manager task create auth-L3.1.1-jwt --plan /tmp/jwt-plan.json --auto-confirm
# → 输出: taskId T-001,文件 specs/auth/tasks/auth-L3.1.1-jwt-T-001.json

spec-manager task start T-001 --spec auth-L3.1.1-jwt
# 第 1 步
spec-manager task step T-001 --spec auth-L3.1.1-jwt --no 1 --type mcp_tool --name "上下文收集" \
  --status succeeded --output-json '{"summary":"read L2 + L1","read":["auth-L2.1"]}' --latency 1200
# ... 每步重复

spec-manager task complete T-001 --spec auth-L3.1.1-jwt
# → L3 status: frozen → implemented
# → 若 L2 所有子 L3 都 implemented:L2 级联到 implemented
# → 若 L1 所有子 L2 都 implemented:L1 级联到 implemented
```

`task step` 是每步的上报(R15 要求带 `outputJson`);`task complete` 触发级联 —— 不会反向(R2)。

### 7. 记录决策卡片(R18:L1 implemented)

L1 走到 `implemented` 后,**必须**至少建一张决策卡片,记录关键 what/why:

```bash
spec-manager decision create auth-L1 \
  --topic auth \
  --what "采用 JWT 而非 session" \
  --why "无状态扩展,便于多服务共享身份" \
  --criteria "AC-1,AC-2"
# → 输出: DC-001
```

`task complete` 完成后,CLI **自动**打印 R18 自检提示 —— 对每个刚 cascade 到 `implemented` 的 L1,展示是否已有决策卡片,并给出完整创建命令 + `audit hit R18` 收尾命令:

```text
⚠ R18 (决策卡片):以下 L1 已 cascade 到 implemented,请确认已建决策卡片:
  ✗ auth-L1 [auth] — 待建
    spec-manager decision create auth-L1 \
      --topic auth --what "..." --why "..." --criteria AC-1,AC-2
    spec-manager audit hit R18 --spec auth-L1
  ✓ billing-L1 [billing] — 已有 2 张 (active: 2)
    spec-manager audit hit R18 --spec billing-L1
```

**查询决策** —— 按 topic 或按 AC 编号(AC-7:追溯某个 requirement 经历了哪些变化):

```bash
spec-manager decision list --topic auth
# ● DC-001 [auth]  采用 JWT 而非 session {AC-1,AC-2}
# ● DC-002 [auth]  用 refresh-token 轮换

spec-manager decision list --criteria AC-1 --include-all
# ● DC-001 [auth]  采用 JWT 而非 session
# ○ DC-003 [auth]  改用 PASETO (superseded by DC-005)
# ◐ DC-004 [auth]  跳过 refresh-token (partial — 见 INC-20260604-001)
```

**生命周期** —— 3 个状态,1 条转换路径:

| From | To | 命令 | 何时 |
|---|---|---|---|
| active | superseded | `decision supersede DC-001 --by DC-005` | 新决策完全取代旧决策 |
| active | partial | `decision set-partial DC-004 --reason "INC-...:AC-3 假设不成立"` | 决策部分失效 |
| (任意) | (删除) | `decision delete DC-001` | 仅 active 可删;其他状态先恢复 |

**编辑** what/why/affectedCriteria(不改状态):

```bash
spec-manager decision update DC-001 \
  --what "采用 JWT + 短 TTL + refresh-token 轮换" \
  --criteria "AC-1,AC-2,AC-3"
```

手写正文时用 [决策卡片模板](templates/decision.md)(CLI 自动按此格式渲染)。

### 8. 修改已存在的 spec(delta change)

要改已经上线的 spec 时,用 change 提案 —— **不要直接改 spec 正文**:

```bash
spec-manager change new add-2fa --description "新增 2FA 双因素认证"
# → 创建 changes/add-2fa/(proposal.md + deltas/ + specs/)

# 1. 编辑 changes/add-2fa/proposal.md(why + scope + risk)
# 2. 写 changes/add-2fa/deltas/<code>.md,## MODIFIED Requirements 段
# 3. 若 ADDED,放占位文件到 changes/add-2fa/specs/<topic>/<code>/<code>.md

spec-manager change archive add-2fa
# 按 RENAMED→REMOVED→MODIFIED→ADDED 顺序应用,然后把 changes/add-2fa/ 移到 archive/
```

留下完整审计轨迹:谁、何时、提议了什么,改动前 spec 长什么样。

## 常用命令速查

| 命令 | 作用 |
|---|---|
| `spec-manager project init --name X` | 初始化 `.spec-manager/` |
| `spec-manager project status` | 项目总览(按层统计 + 最近活动) |
| `spec-manager spec list [--level L1] [--topic X] [--status draft]` | 列 spec(可过滤) |
| `spec-manager spec show <code> [--include-content]` | 查 spec;默认窄视图(只元数据, R19) |
| `spec-manager spec update <code> --content F --ai-summary S --change-summary R` | 写正文 |
| `spec-manager spec confirm \| freeze \| implement <code>` | 推进 status(用户触发) |
| `spec-manager spec validate <code>` | 重跑必填段校验 |
| `spec-manager spec add-relation <code> --target T --type based_on\|supersedes\|implements\|references` | 加跨 spec 引用 |
| `spec-manager task create \| start \| step \| complete \| fail \| list \| show` | Agent Task 生命周期 |
| `spec-manager decision create \| list \| show \| update \| set-partial \| supersede \| delete` | 决策卡片(R18) |
| `spec-manager change new \| archive \| list \| show` | Delta spec 工作流 |
| `spec-manager incident new \| list` | 规则违规追踪 |
| `spec-manager audit hit \| report \| show` | 本地规则审计 |

任何命令都可加 `--help` 看完整用法。

## 文件布局

Spec 文件平铺存储 —— 点分编码(`auth-L2.1`、`auth-L3.1.1-jwt`)自文档化层级关系,无需嵌套目录。`decisions/` 和 `tasks/` 在 topic 级别。

```
my-project/
├── .spec-manager/
│   ├── config.yaml
│   ├── audit.json
│   └── incidents/
├── specs/<topic>/
│   ├── <L1-code>-<date>.md
│   ├── <L2-code>-<date>.md
│   ├── <L3-code>[-desc]-<date>.md
│   ├── decisions/               # R18: L1 implemented 后挂决策卡片
│   │   └── DC-001.md
│   └── tasks/                   # R3: L3 frozen 后挂 Agent Task
│       └── <specCode>-T-001.json
├── changes/<name>/
│   ├── proposal.md
│   ├── deltas/<code>.md
│   └── specs/<topic>/<code>/<code>.md  # ADDED 占位文件
└── archive/<name>/               # 已合并的 change
```

Spec 编码采用 `<topic>-L<N>[.<M>][-desc]` 格式(例:`auth-L1`、`auth-L2.1`、`auth-L3.1.1-jwt`):编码自文档化层级关系,无需追溯父目录。`spec new` 不传 `--code` 时自动生成。`--desc` 可加 ≤15 字符描述后缀提升可读性。

## 文档

- [docs/methodology.md](docs/methodology.md) — 公开方法论

## 架构

```
spec-manager/
├── src/                    TypeScript CLI 源码
│   ├── cli/                命令实现
│   ├── core/               spec IO、校验、状态机
│   └── schemas/            Zod schemas
├── templates/              L0/L1/L2/L3/proposal/decision/incident markdown 模板
├── rules/                  24 条 markdown 规则,带 YAML frontmatter
├── skill/                  Agent skill 内容 (SKILL.md + 12 个 subskills)
├── docs/                   公开文档
└── examples/               迁移示例
```

## 设计取舍

- **Markdown + YAML frontmatter** 而非 JSON 或 DB:git 友好、可读、可 diff
- **原子写入** (temp + rename) 防止 spec 写一半
- **默认 narrow 视图** (`spec show` 默认只返回元数据, R19) — 节省上下文
- **校验只 warn 不 throw** (按 R22、R13);R22 在 confirm/freeze 时阻止占位正文
- **本地规则审计** — JSON 文件 + at-least-once pending 队列(没有网络可失败)
- **无 DAG,严格树** — L1→L2→L3→Task 线性;delta change 单独概念

## 许可证

MIT
