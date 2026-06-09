# Runbook 子 skill — 运维手册 / oncall 应急

## 用途

长期档案，存放 oncall 应急手册、部署手册、故障排查清单。

## 流程

1. 新建 runbook：

```bash
mkdir -p runbooks
cat > runbooks/auth-service-down.md <<'EOF'
# Auth Service 宕机应急

## 现象
- 监控：auth-service 5xx 比例 > 50% 持续 5 分钟
- 用户：登录按钮转圈无响应

## 第一步：止血
- 查看日志：`docker logs auth-service --tail 200`
- 重启：`docker compose restart auth-service`

## 第二步：根因
- 查 PostgreSQL 连接数：`SELECT count(*) FROM pg_stat_activity;`
- 如果 > 80%：kill 慢查询
- 如果 JWT secret 轮换：检查 `JWT_SECRET` env 是否同步

## 第三步：回滚
- 切回上一版本：`docker compose up -d --scale auth-service=0 && git checkout v1.1.0 && docker compose up -d`

## 关联
- 关联 spec：auth-L1
- 历史 incident：INC-20260513-001
EOF
```

2. 关联到 incident 模板（写 incident 时引用 runbook）

3. 长期维护：每次重大故障后写 incident → 复盘 → 更新 runbook

## 关联规则

- 关联到 R18 L1 implemented 后必须建决策卡片（重大运维决策也算）
