# Release 子 skill — 发布说明 / changelog

## 用途

为每个版本写 release notes（`releases/vX.Y.Z-release.md`）：
- 用户可见的变更
- 关联的 L1/L2/L3 spec
- 回滚说明

## 流程

1. 列出当前活跃 L1/L2/L3

```bash
spec-manager spec list --status implemented
spec-manager change list
```

2. 选本次发布的 spec 范围（按 milestone 过滤）

3. 写 release notes：

```bash
mkdir -p releases
cat > releases/v1.2.0-release.md <<'EOF'
# v1.2.0 — <主题>

## 新增
- 2FA 强制登录（auth-L1 MODIFIED）

## 修复
- JWT 过期返回 401 而非 500（auth-L3.1.1-jwt bugfix）

## 变更
- 数据库 schema: users 表加 mfa_secret 字段（migration 2026_05_11）

## 回滚
- 关闭 2FA 强制开关（`AUTH_REQUIRE_2FA=false`）
- DB 回滚：down migration

## 关联决策
- DC-002：改用 PASETO（影响 AC-1）
EOF
```

4. 同步到 git tag + GitHub release（如需）。优先使用 notes file，避免 `--notes "..."` 中的反引号或 `$()` 被 shell 展开。

```bash
gh release create v1.2.0 --title "v1.2.0" --notes-file releases/v1.2.0-release.md
```

## 关联规则

- 关联到 R14 跨层引用用 code 不是复述
