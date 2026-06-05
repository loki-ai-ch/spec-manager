# TestPlan 子 skill — 测试方案

## 用途

为 L3 spec 写"测试方案"（testplan.md）：
- 描述本 L3 实施时需要的测试类型 + 用例
- 与 plan.md 互补：plan = 时间维度，testplan = 质量维度

## 流程

1. 读 L3 spec + 父 L2

```bash
spec-manager spec show 2026-06-04-c3d4e5 --include-content
```

2. 创建 testplan：

```bash
# 用 git 直接写，或：
mkdir -p testplans/auth
cat > testplans/auth/2026-06-04-c3d4e5-testplan.md <<'EOF'
# <L3 title> 测试方案

## 单元测试
- 覆盖函数：
  - signJwt()：正常 + 异常（key 缺失 / 过期）
  - verifyJwt()：合法 / 过期 / 篡改签名

## 集成测试
- 登录成功 → 拿到 token → 调 /me 拿到 user
- token 过期 → 401
- 篡改 token → 401

## 端到端
- Playwright：注册 → 登录 → 访问受保护页

## 验证命令
- pnpm test
- pnpm test:integration
EOF
```

3. 写完同样用 `spec update --ai-summary` 记一句

## 关联规则

- R10 planJson 最后一步必须是验证（testplan 是 plan 的姊妹）
