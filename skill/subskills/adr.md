# ADR 子 skill — 架构决策记录

## 用途

**优先用 `decision create` 命令**（结构化 what/why/affectedCriteria + topic 查询），非必要不新增 adr 文档。

## Decision vs ADR 的选择

| 维度 | Decision Card（推荐） | ADR 文档 |
|------|----------------------|----------|
| 存储 | `specs/<topic>/decisions/DC-NNN.md`（topic 级别） | `adrs/NNNN-title.md` |
| 字段 | what/why/affectedCriteria | 全文 Markdown |
| 状态机 | active/superseded/partial | N/A（顺序追加） |
| 查询 | `decision list --topic X` | 扫文件 |
| 强制 | R18 强制 L1 implemented 后建 | 不强制 |

## Decision 创建流程

1. 触发条件：L1 spec 走到 `implemented`
2. 必走：

```bash
spec-manager decision create auth-L1 \
  --topic auth \
  --what "采用 JWT 而非 session" \
  --why "无状态扩展，便于多服务共享身份" \
  --criteria "AC-1,AC-2"
```

3. supersede：

```bash
# 旧决策被新决策取代
spec-manager decision supersede DC-001 --by DC-002
```

## ADR 创建流程（少数情况）

如果决策需要：
- 大段背景 / 备选方案对比 / 详细 trade-off
- 多人评审记录

则走 ADR：

```bash
mkdir -p adrs
cat > adrs/0007-use-paseto.md <<'EOF'
# 7. 用 PASETO 替代 JWT

## 背景
JWT 有 alg=none 等已知攻击面...

## 候选方案
1. 继续 JWT + 严格校验 alg
2. PASETO（平台无关安全 token）
3. 自研 session

## 决定
方案 2

## 影响
- 库替换：jose → paseto
- 决策卡片：DC-002

## 关联
- spec: auth-L1
- decision: DC-002
EOF
```

## 关联规则

- R18 L1 implemented 后必须建决策卡片（ADR 不替代）
