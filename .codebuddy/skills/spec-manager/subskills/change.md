# Change 子 skill — Delta Spec 提案（OpenSpec 风格）

## 用途

当需要**修改已存在的 spec** 时（不是新建一个 L1/L2/L3），用 change 提案：
- 比"改 spec 文件 + git diff"更结构化
- archive 时机 = 知识合并点（带 proposal + delta spec 的完整审计轨迹）
- 比"另起一个 v2 spec"更轻量

## 流程

1. 创建 change 目录：

```bash
spec-manager change new add-2fa --description "新增 2FA 双因素认证"
```

输出：
```
changes/add-2fa/
├── README.md
├── proposal.md          ← 填写 why/scope/risk
├── deltas/              ← 在这里创建 <spec-code>.md
└── specs/auth/          ← ADDED 时放新 spec 占位
```

2. 写 `proposal.md` frontmatter（why + scope 必填）：

```yaml
---
name: add-2fa
why: 高频账号被盗事件
scope: auth L1 加 2FA 需求
risk: 用户登录多一步
rollback: 移除 2FA 强制，保留可选
affectedCriteria:
  - AC-1
  - AC-2
---
```

3. 写 delta spec 文件 `deltas/<code>.md`：

```markdown
---
code: auth-L1
---

## MODIFIED Requirements

### Requirement: auth-L1
## 2FA 强制

登录成功后系统 **SHALL** 要求 TOTP 二次校验。
**SHALL NOT** 仅靠密码判定身份。

## 范围边界
- 邮箱 + 密码
- TOTP
- 备份码

## 验收标准
1. **AC-1-2fa**: **Given** 用户登录成功 **When** 系统检测未配置 2FA **Then** **SHALL** 引导用户设置
2. **AC-2-2fa**: **Given** 用户已配置 2FA **When** 登录 **Then** **SHALL** 要求 TOTP
```

支持 4 种 op：
- `## ADDED Requirements` — 新增 spec
- `## MODIFIED Requirements` — 修改 spec
- `## REMOVED Requirements` — 删除 spec
- `## RENAMED Requirements` — 改名 spec（`- FROM: X TO: Y`）

4. ADDED 时需要 `changes/<name>/specs/<topic>/<code>/<code>.md` 占位文件（含 frontmatter level/title/parentCode）—— 占位文件按 `<code>/<code>.md` 嵌套存放（仅限 changes/ 目录），archive 时由 `archiveChange` 根据 `parentCode` 创建到主 specs 平铺目录：

```bash
mkdir -p changes/add-2fa/specs/auth/auth-L2.1
cat > changes/add-2fa/specs/auth/auth-L2.1/auth-L2.1.md <<'EOF'
---
code: auth-L2.1
level: L2
title: 2FA 后端设计
topic: auth
parentCode: auth-L1
status: draft
project: 1
---
# 占位
EOF
```

5. 应用：

```bash
spec-manager change archive add-2fa
```

输出（按 RENAMED→REMOVED→MODIFIED→ADDED 顺序）：
```
✓ Change add-2fa archived
  applied: 2
    [MODIFIED] auth-L1
    [ADDED] auth-L3.1.1-new-feature
  archived to: archive/add-2fa
```

archive 会自动：
- 把 deltas/ 内容追加到主 spec 的 `## Delta (<name>)` 段
- 创建 ADDED 的新 spec
- REMOVED 把主 spec 移到 archive/
- RENAMED 改文件路径 + frontmatter code
- 整个 changes/<name>/ 目录移到 archive/<name>/
- 写 audit hit R24

## 关联规则

- R14 跨层引用用 code 不是复述
- R24 delta change 必须含 proposal + delta spec
- R18 L1 implemented 后必须建决策卡片（改动 L1 时同步建/改 decision）
