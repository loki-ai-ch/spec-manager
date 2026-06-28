---
code: workflow-usability-hardening-L3.2.3
level: L3
title: Release Notes Inline Risk Guidance
topic: workflow-usability-hardening
parentCode: workflow-usability-hardening-L2.2
status: implemented
aiSummary: >-
  实施规格：增强 project docs check 对 gh release inline notes shell quoting 风险的只读提示，并推荐
  --notes-file。
coveredTasks:
  - T-001
steps:
  - stepNo: 1
    stepType: tool_action
    name: 读取规格并调查 release docs check 路径
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 实现 release notes inline risk detector
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 增加 release inline risk core 和 CLI 测试
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 更新 release subskill notes-file guidance
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 运行聚焦与全量验证
    status: pending
relations:
  - type: based_on
    target: workflow-usability-hardening-L2.2
created: '2026-06-28T01:32:25.148Z'
updated: '2026-06-28T01:40:49.225Z'
changeSummary: 'cascade: task-complete'
---
# Release Notes Inline Risk Guidance — 实施规格

## 目标

增强 `project docs check` 对发布说明写法的只读风险提示：当仓库文档或 release guidance 中出现 `gh release create --notes "..."` 这类内联 notes 写法，且内容可能包含反引号、命令替换或多行 shell quoting 风险时，输出 info finding，建议改用 notes 文件或 `--notes-file`。

## 范围

包含：

- 在 docs consistency report 中新增 release notes inline risk finding。
- 扫描发布相关文档：`README.md`、`readme_en.md`、`skill/subskills/release.md`、`docs/**/*.md`、`releases/**/*.md` 中的静态文本。
- 检测 `gh release create` 与 `--notes` 同行或相邻片段中的高风险字符，例如反引号、`$(`、多行 quoted notes。
- 输出 `docs.release-notes.inline-risk` info，包含文件路径和建议。
- 推荐 `--notes-file <file>` 或先写 `releases/vX.Y.Z-release.md`。
- 增加 core/CLI 测试覆盖 risky inline notes 和 safe notes-file。

不包含：

- 不执行 `gh`、不读取 GitHub release、不访问网络。
- 不自动修改 release 命令或生成 release notes 文件。
- 不实现完整 release automation。
- 不把 info 升级为阻塞 warning/error。

## 关键验收标准

1. **AC-1**: 当扫描到高风险 `gh release create --notes "..."` 写法时，report MUST 输出 `docs.release-notes.inline-risk` info。
2. **AC-2**: 当使用 `--notes-file` 或文档仅建议先写 release notes 文件时，report MUST 不输出 inline-risk finding。
3. **AC-3**: 检查 MUST 只读、离线、确定性，不执行 shell 或 git/GitHub 命令。
4. **AC-4**: text/json CLI 输出 MUST 复用现有 `DocsConsistencyReport` schema。
5. **AC-5**: release subskill 或 README guidance MUST 明确推荐 notes file，避免 shell quoting 风险。
6. **AC-6**: 聚焦测试、全量测试、lint、build MUST 通过。

## 受影响模块

| 模块 | 影响 |
|---|---|
| `src/core/docs-consistency.ts` | 增加 release notes inline risk 扫描 |
| `src/core/__tests__/docs-consistency.test.ts` | 覆盖 risky inline notes 与 safe notes-file |
| `src/cli/__tests__/project-docs.test.ts` | 覆盖 CLI 输出该 info finding |
| `skill/subskills/release.md` | 明确推荐 `--notes-file` |
| `README.md` / `readme_en.md` | 可选补充 docs check 发布前提示 |

## 实施步骤

1. 读取 docs consistency core、project docs CLI 测试、release subskill，确认现有 docs check 扫描模型。
2. 在 core 中新增 markdown 文件候选扫描与 release inline risk detector。
3. 将 inline risk finding 合入现有 report summary，不改变 exit code。
4. 增加 core/CLI 测试覆盖 risky inline notes、safe notes-file、JSON/text 输出。
5. 更新 release subskill guidance，推荐 notes file/`--notes-file`。
6. 运行聚焦测试与全量验证。

## 验证命令

```bash
npm test -- --run src/core/__tests__/docs-consistency.test.ts src/cli/__tests__/project-docs.test.ts
npm test
npm run lint
npm run build
node dist/cli/index.js project docs check --json
```

## 回滚策略

若 release notes inline risk 检测误报过多，回滚 detector、finding、测试和 release guidance；该能力只读，不涉及数据迁移。
