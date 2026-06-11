# Postmortem 子 skill — Blameless 复盘

## 用途

故障复盘（Blameless 风格）：
- 不指责个人，关注系统和流程
- 5 Whys 找根因
- 输出 action items → 改 spec / 改 runbook / 改规则

## 流程

1. 找到对应 incident：

```bash
spec-manager incident list --status resolved
```

2. 创建 postmortem：

```bash
mkdir -p postmortems
cat > postmortems/INC-20260604-001-postmortem.md <<'EOF'
# INC-20260604-001 复盘 — R15 step outputJson 缺 summary

## 时间线
- 10:41 任务开始
- 10:42 step 3 重试时漏掉 summary
- 10:45 发现并补 summary
- 10:50 task complete

## 5 Whys
1. 为什么 outputJson 缺 summary？—— Agent 模板里只在 happy path 加了
2. 为什么模板不一致？—— 模板没强制 summary
3. 为什么没强校验？—— CLI 没把 R15 warning 转 throw
4. 为什么没早发现？—— task show 不显示 warning
5. 为什么？—— R15 是软约束

## 根因
R15 是软约束（warning），缺乏 hard fail 机制

## Action Items
- [ ] spec-manager task step 校验 R15，缺 summary 时 hard fail（PR #123）
- [ ] skill impl.md 写明"outputJson 必含 summary"红线
- [ ] decision：升 R15 为 hard constraint？DC-003 待评估

## 关联
- incident: INC-20260604-001
- spec: auth-L3.1.1
- 规则: R15
EOF
```

3. 同步更新 runbook / decision / spec

## 决策错误的复盘

如果事故根因追溯到一张「错」的决策卡片（DC-XXX），复盘要补两件事：

```bash
# 1) 标记该决策为 partial（部分被取代/作废）
spec-manager decision set-partial DC-001 --reason "INC-20260604-001 复盘:AC-3 设计假设不成立"

# 2) 用新决策 supersede 旧的
spec-manager decision create <L1 code> \
  --topic <topic> \
  --what "改用 X 而非 Y" \
  --why "INC-20260604-001:旧决策 AC-3 在 <场景> 下不成立" \
  --criteria AC-3

spec-manager decision supersede DC-001 --by DC-002
```

这样多轮迭代后,`decision list --criteria AC-3` 能返回完整历史(active / superseded / partial)。

## 关联规则

- 关联 R18 决策卡片（重大改动的决策落库）
