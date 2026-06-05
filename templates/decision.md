<!-- ========== Stage Charter: Decision Card ==========
Value: 知识沉淀 — 回答"为什么这么做/不这么做",支撑后续 L1 的 Q4 历史决策查询
Time horizon: 长期(直到被 supersede)
Target reader: 未来 Claude 在做类似需求时的参照(尤其 L1 PRE-WRITE Q4)
Must NOT have:
  - 文件路径 / DDL / planJson → 不属于本层
  - 详细 trade-off / 备选方案 → 走 ADR
  - 设计原则 → 写在 L1 正文的"设计原则"段落
Soft boundary: 决策卡片是结构化记录;多决策关联同一 topic 时用 supersededById 串联

Lifecycle:
  active (新建) → superseded (被新决策取代,supersede 命令)
                  → partial  (部分被取代,set-partial 命令,需 --reason)

触发条件(R18): L1 spec 状态推进到 implemented 后,**必须**至少 1 张
查询入口: `spec-manager decision list --topic <topic> --criteria AC-1`
========== -->

# {{id}} — {{what}}

> 关联 spec: **{{docCode}}**  |  topic: **{{topic}}**  |  状态: **{{status}}**{{supersededByLine}}

## 决定

<决定了什么,1-3 句话。不要写"我们决定..."这种铺垫,直接给结论。≤500 字>

## 为什么

<为什么做这个决定。引用证据(数据/事故/约束/权衡),≤500 字。可选,但强烈建议填写>

## 影响的验收标准

<这条决策改变了哪些 AC,以及改变方式(新增/修改/废止)。AC 编号必须与 L1 spec 验收标准段落中的编号一致。可选,但建议填写以支持 requirement 维度追溯>

- AC-...
- AC-...

## 关联

- spec: {{docCode}}
- topic: {{topic}}
- 状态: {{status}}{{supersededLink}}
