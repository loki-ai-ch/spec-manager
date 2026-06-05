# Sub-skill: Research（只读）

> 🛑 **硬红线**：本 skill 全程**只读**。如果用户意图是改文档/建 spec/写代码,必须先切到 prd/design/impl/quick 等子 skill。
> 以下工具/子命令**严禁**调用：
>
> | 类别 | 禁用的 CLI 子命令 |
> |---|---|
> | 写 spec | `spec new` / `spec update` / `spec confirm` / `spec freeze` / `spec implement` / `spec add-relation` / `spec delete` |
> | 写决策 | `decision create` / `decision update` / `decision set-partial` / `decision supersede` / `decision delete` |
> | 写 task | `task create` / `task start` / `task step` / `task complete` / `task fail` / `task wait` |
> | 写 change | `change new` / `change archive` |
> | 写 incident | `incident new` / `incident update` |
> | 写 audit | `audit hit` / `audit report` / `audit session` |
> | 项目级写 | `project init` / `dict register` |
>
> 若用户要"查完后顺手改一下",**先停下来切到对应写 skill**,不要在本 skill 里偷偷调 write 子命令。

## 路由自检

✓ 走本 skill 的信号：用户说"查 / 看 / 列 / 统计 / 了解 / 搜索 X"
✗ 不走的信号：用户说"新功能"（→ prd.md）等任何意图要改文档

## 流程

1. **仅用只读命令**：
   ```bash
   spec-manager spec list [--level L1] [--topic X] [--status draft]
   spec-manager spec show <code>                    # 默认 narrow 视图（R19）
   spec-manager spec show <code> --include-content  # 仅当 aiSummary 不够时
   spec-manager decision list --topic X
   spec-manager project status
   spec-manager audit show [--rule R1]
   ```
2. **禁止**：任何 `new` / `update` / `confirm` / `freeze` / `implement` / `add-relation` / `delete`
3. **R19 优先**：默认读 aiSummary 而非全文
