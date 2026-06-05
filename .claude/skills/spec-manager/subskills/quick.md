# Sub-skill: Quick (≤5 步微调)

## 路由自检

✓ 走本 skill 的信号：用户说"修 typo / 改一行注释 / 调一个字符串 / 改 log level"
✗ 不走的信号：用户说"新功能"（→ prd.md）或"重构"（→ design.md + impl.md）

## 流程

1. **直接 Edit 源码**：用 `Read` 找到目标行，`Edit` 改一行
2. **验证**（如有）：`Bash` 跑相关测试
3. **报告**：告诉用户改了哪个文件的哪一行
4. **无需建任何 spec** — quick 不走完整 L1→L2→L3 流程

## 限制

- 步数 ≤ 5
- 单一文件
- 不涉及 schema 变更
- 不涉及 API 契约变更
- 不跨模块

超限则跳到 `prd.md` 走完整流程。

`git diff` 本身就是审计追踪。
