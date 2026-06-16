---
code: roadmap-openspec-L3.1.4-completion
level: L3
title: Shell completion 安装与补全
topic: roadmap-openspec
parentCode: roadmap-openspec-L2.1
status: implemented
created: '2026-06-08T03:14:19.392Z'
updated: '2026-06-08T03:21:25.145Z'
aiSummary: >-
  实现 zsh/bash/fish completion 脚本生成、标准用户目录安装、统一卸载、静态命令与动态 spec code 补全，并增加
  core/CLI 测试和临时 home smoke
changeSummary: 'cascade: task complete'
steps:
  - stepNo: 1
    stepType: tool_action
    name: >-
      读取 roadmap-openspec-L3.1.4-completion、roadmap-openspec-L2.1 和
      templates/agent-plan.json 并完成文件级分析
    status: pending
  - stepNo: 2
    stepType: tool_action
    name: 新增 src/core/completion.ts 实现脚本生成安装路径和安装卸载
    status: pending
  - stepNo: 3
    stepType: tool_action
    name: 编辑 src/core/completion.ts 实现 zsh bash fish 命令与动态 spec code 补全
    status: pending
  - stepNo: 4
    stepType: tool_action
    name: 新增 src/cli/completion.ts 并编辑 src/cli/index.ts 注册 completion 命令
    status: pending
  - stepNo: 5
    stepType: tool_action
    name: 新增 src/core/__tests__/completion.test.ts 覆盖生成安装卸载
    status: pending
  - stepNo: 6
    stepType: tool_action
    name: 新增 src/cli/__tests__/completion.test.ts 覆盖 CLI 正反向行为
    status: pending
  - stepNo: 7
    stepType: tool_action
    name: 编辑 README.md 增加 shell completion 使用说明
    status: pending
  - stepNo: 8
    stepType: tool_action
    name: 运行 completion targeted tests、build、完整测试和临时 home smoke
    status: pending
---
# Shell completion 安装与补全 — 实施规格

## 目标

实施 `roadmap-openspec-L2.1` 的第四项交付物：新增 zsh/bash/fish shell completion 安装与卸载命令，补全一级命令、常用子命令、shell 参数和当前项目 spec code。

**前置依赖**: `roadmap-openspec-L3.1.2-agents` 已 implemented；`roadmap-openspec-L3.1.3-view` 已 implemented。

## 实施步骤

### Step 1 — 上下文收集与文件级分析

- 执行 `spec-manager spec show roadmap-openspec-L3.1.4-completion --include-content` 和 `spec-manager spec show roadmap-openspec-L2.1 --include-content`。
- 读取 `templates/agent-plan.json`，确认 planJson 字段名为 `stepNo` / `stepType` / `name`，且 `coveredSpecs` 包含当前 L3。
- 执行 Level 3 文件级分析(R23)：
  - 读取 `src/cli/index.ts`，确认 CLI 注册入口。
  - 读取 `src/core/spec-io.ts` 的 `listAllSpecs`，确认动态 spec code 来源。
  - 读取 `src/core/paths.ts` 的 `getPaths`，确认项目根定位。
  - 读取现有 CLI/core 测试 fixture，确认临时目录和 Commander 测试模式。
  - 检查代码库不存在 completion 实现或命令冲突。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 completion L3/L2/agent-plan、CLI 注册、spec 读取和测试基线分析","files":[]}
  ```

### Step 2 — 新增 completion 核心生成与安装模块

- 新增 `src/core/completion.ts`，导出：
  - `CompletionShell = 'zsh' | 'bash' | 'fish'`。
  - `COMPLETION_SHELLS` 固定顺序数组。
  - `completionInstallPath(shell, homeDir)`：返回各 shell 标准用户安装路径。
  - `generateCompletionScript(shell)`：生成对应脚本。
  - `installCompletion(shell, homeDir?)`：创建父目录并写入脚本，返回安装路径。
  - `uninstallCompletions(homeDir?)`：删除存在的三类脚本并返回 removed/missing 路径。
- 安装路径 SHALL 固定为：
  - zsh: `~/.zsh/completions/_spec-manager`
  - bash: `~/.local/share/bash-completion/completions/spec-manager`
  - fish: `~/.config/fish/completions/spec-manager.fish`
- `homeDir` 默认使用 Node `homedir()`；测试 MUST 注入临时目录，禁止写真实用户目录。
- 生成器 MUST 仅依赖 Node 标准库，不新增运行时依赖。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 completion 核心脚本生成、安装路径、安装和卸载模块","files":["src/core/completion.ts"]}
  ```

### Step 3 — 实现 zsh/bash/fish completion 脚本

- 在 `generateCompletionScript` 中为三个 shell 生成独立脚本：
  - 补全一级命令：`project spec task decision change incident audit dict flow guide new approve run template view completion`。
  - 补全 `completion install` 的 shell 候选：`zsh bash fish`。
  - 补全常用二级命令，例如 `spec new/list/show/update/confirm/freeze/implement/validate/migrate-paths/validate-plan`、`task create/start/step/complete/fail/wait/show/list/batch`。
  - 当上下文需要 spec code 时，动态执行 `spec-manager spec list`，提取数据行第一列作为候选。
- 动态 spec code 获取 MUST 在补全触发时执行，不把安装时的 spec 列表固化进脚本。
- 脚本 SHOULD 在项目未初始化或命令失败时安静返回空候选，不污染 shell。
- 完成后 step_report outputJson:
  ```json
  {"summary":"实现 zsh/bash/fish 一级命令、子命令和动态 spec code 补全脚本","files":["src/core/completion.ts"]}
  ```

### Step 4 — 注册 completion CLI 命令

- 新增 `src/cli/completion.ts`，导出 `registerCompletionCommands(program)`。
- 注册：
  - `spec-manager completion install <shell>`
  - `spec-manager completion uninstall`
- `install <shell>`：
  - 仅接受 zsh/bash/fish；不支持值 SHALL 输出 `UNSUPPORTED_SHELL` 并 exit 2。
  - 调用 `installCompletion`，打印 shell、写入路径和 reload 提示。
- `uninstall`：
  - 调用 `uninstallCompletions` 删除全部已安装脚本。
  - 至少删除一个时打印 removed 路径。
  - 一个都未找到时 SHALL 输出 `COMPLETION_NOT_INSTALLED` 并 exit 2。
- 编辑 `src/cli/index.ts` 导入并注册 `registerCompletionCommands`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 completion install/uninstall CLI 并注册到主命令树","files":["src/cli/completion.ts","src/cli/index.ts"]}
  ```

### Step 5 — 增加核心生成与文件操作测试

- 新增 `src/core/__tests__/completion.test.ts`：
  - 断言三个 shell 的安装路径。
  - 断言三个脚本包含 `spec-manager`、一级命令、shell 候选和动态 `spec list` hook。
  - 断言 `installCompletion` 在临时 home 创建正确文件及父目录。
  - 断言 `uninstallCompletions` 删除存在文件并报告 missing 文件。
  - 断言测试过程不写真实 home。
- 测试不得依赖本机已安装的 zsh/bash/fish，也不得 source 用户配置。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 completion 脚本生成、安装路径、安装卸载核心测试","files":["src/core/__tests__/completion.test.ts"]}
  ```

### Step 6 — 增加 CLI 行为测试

- 新增 `src/cli/__tests__/completion.test.ts`：
  - 使用 Commander 注册 completion 命令。
  - 通过测试专用 homeDir 注入或环境变量注入临时 home，验证 `install zsh/bash/fish` 输出和文件创建。
  - 验证不支持 shell 输出 `UNSUPPORTED_SHELL` 且 exit 2。
  - 验证 `uninstall` 删除已安装脚本。
  - 验证未安装时 `uninstall` 输出 `COMPLETION_NOT_INSTALLED` 且 exit 2。
- 若采用环境变量注入，变量 MUST 仅用于测试/可移植安装路径覆盖，并在测试后恢复。
- 完成后 step_report outputJson:
  ```json
  {"summary":"新增 completion install/uninstall CLI 正反向测试","files":["src/cli/__tests__/completion.test.ts"]}
  ```

### Step 7 — 更新 README 与命令说明

- 编辑 `README.md`：
  - 在 easier workflows 或 CLI 概要中加入 completion 安装与卸载示例。
  - 明确支持 zsh/bash/fish。
  - 说明安装后需按输出提示 reload shell。
- 保持 `flow status`、`view` 和现有命令说明不变。
- 完成后 step_report outputJson:
  ```json
  {"summary":"更新 README 加入 zsh/bash/fish completion 安装卸载说明","files":["README.md"]}
  ```

### Step 8 — 构建、完整测试与 smoke 验证

- 运行 targeted tests：
  - `npm test -- --run src/core/__tests__/completion.test.ts src/cli/__tests__/completion.test.ts`
- 运行 `npm run build`。
- 运行完整 `npm test`。
- 使用临时 home smoke：
  - `HOME=<tmp> node dist/cli/index.js completion install zsh`
  - `HOME=<tmp> node dist/cli/index.js completion install bash`
  - `HOME=<tmp> node dist/cli/index.js completion install fish`
  - 检查三个脚本包含 `spec-manager spec list` 和预期一级命令。
  - `HOME=<tmp> node dist/cli/index.js completion uninstall`
  - 再次 uninstall，预期 `COMPLETION_NOT_INSTALLED`。
- 完成后 step_report outputJson:
  ```json
  {"summary":"完成 completion targeted tests、build、完整测试和临时 home smoke 验证","files":[]}
  ```

## 验证命令

```bash
# 正向验证: targeted tests
npm test -- --run src/core/__tests__/completion.test.ts src/cli/__tests__/completion.test.ts
# 预期输出包含: Test Files  2 passed

# 正向验证: build
npm run build
# 预期 exit code: 0

# 正向验证: 完整测试
npm test
# 预期输出包含: Test Files
# 预期输出不包含: failed

# 正向 smoke: 安装三个 shell completion
HOME=/tmp/spec-manager-completion-smoke node dist/cli/index.js completion install zsh
HOME=/tmp/spec-manager-completion-smoke node dist/cli/index.js completion install bash
HOME=/tmp/spec-manager-completion-smoke node dist/cli/index.js completion install fish
# 预期输出分别包含: zsh / bash / fish 和 installed

# 正向 smoke: 卸载全部 completion
HOME=/tmp/spec-manager-completion-smoke node dist/cli/index.js completion uninstall
# 预期输出包含: removed

# 反向验证: 不支持 shell
HOME=/tmp/spec-manager-completion-smoke node dist/cli/index.js completion install powershell
# 预期 exit code: 2
# 预期输出包含: UNSUPPORTED_SHELL

# 反向验证: 未安装时卸载
HOME=/tmp/spec-manager-completion-smoke node dist/cli/index.js completion uninstall
# 预期 exit code: 2
# 预期输出包含: COMPLETION_NOT_INSTALLED
```

## step_report 模板

```json
{
  "taskId": "<task id>",
  "stepNo": 1,
  "stepType": "tool_action",
  "status": "succeeded",
  "toolName": "<实际调用的工具名>",
  "latencyMs": "<实际耗时>",
  "outputJson": "{\"summary\":\"<完成内容>\",\"files\":[\"<变更文件>\"]}"
}
```

## planJson (final)

```json
{
  "coveredSpecs": ["roadmap-openspec-L3.1.4-completion"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 roadmap-openspec-L3.1.4-completion、roadmap-openspec-L2.1 和 templates/agent-plan.json 并完成文件级分析"},
    {"stepNo": 2, "stepType": "tool_action", "name": "新增 src/core/completion.ts 实现脚本生成安装路径和安装卸载"},
    {"stepNo": 3, "stepType": "tool_action", "name": "编辑 src/core/completion.ts 实现 zsh bash fish 命令与动态 spec code 补全"},
    {"stepNo": 4, "stepType": "tool_action", "name": "新增 src/cli/completion.ts 并编辑 src/cli/index.ts 注册 completion 命令"},
    {"stepNo": 5, "stepType": "tool_action", "name": "新增 src/core/__tests__/completion.test.ts 覆盖生成安装卸载"},
    {"stepNo": 6, "stepType": "tool_action", "name": "新增 src/cli/__tests__/completion.test.ts 覆盖 CLI 正反向行为"},
    {"stepNo": 7, "stepType": "tool_action", "name": "编辑 README.md 增加 shell completion 使用说明"},
    {"stepNo": 8, "stepType": "tool_action", "name": "运行 completion targeted tests、build、完整测试和临时 home smoke"}
  ]
}
```

autoConfirm: `false`。理由：任务会写入用户 shell completion 标准路径；虽然测试和 smoke 使用临时 home，实施记录仍需人工可审计。

## 回滚方案

| 场景 | 回滚操作 | 预估耗时 |
|---|---|---|
| 生成脚本导致 shell 补全报错 | 执行 `spec-manager completion uninstall`，回退 completion 模块与 CLI 注册 | < 10 min |
| 安装路径不适配用户环境 | 卸载标准路径脚本，保留生成器并在后续规格增加自定义路径 | < 10 min |
| 动态 spec code 补全性能不足 | 暂时移除动态 hook，仅保留静态命令补全 | < 10 min |
| 测试误写真实 home | 立即删除写入文件，强制测试注入临时 home 并增加路径断言 | < 10 min |

## 执行风险

| 风险 | 应对 |
|---|---|
| zsh 用户未配置 `~/.zsh/completions` 到 fpath | install 输出明确 reload/fpath 提示；不自动修改 `.zshrc` |
| bash-completion 未安装 | 脚本仍写入标准目录，CLI 输出依赖提示，不修改 shell rc |
| shell 脚本语法差异导致生成器复杂 | 三个 shell 使用独立模板字符串和独立包含性测试 |
| `spec-manager spec list` 输出格式变化影响动态候选 | 解析仅取数据行第一列，并用测试固定当前契约 |
