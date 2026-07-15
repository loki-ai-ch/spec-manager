# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[中文说明](README.md)

**Make AI coding deliverable, reviewable, and traceable.** spec-manager is an SDD workflow layer for Claude Code, Codex, OpenCode, MiMo-Code, CodeBuddy, Cursor, Windsurf, and other coding agents.

You do not need to adopt a heavy process before trying it. Start with one project, one request, and turn agent output into repo-native delivery records.

## Why Use It

- **Less drift**: AI agents work against approved intent, design boundaries, and implementation targets instead of a vague prompt.
- **Better review**: specs, tasks, decisions, and verification records show what changed, why it changed, and how it was checked.
- **Portable memory**: the workflow lives in markdown/JSON files, so humans and different agents can resume from the same repo state.
- **Works with your agent**: install the right workflow file for Claude Code, Codex, OpenCode, MiMo-Code, CodeBuddy, Cursor, or Windsurf.

Everything is repo-native: markdown/JSON + git storage, no backend, no network dependency, no MCP requirement.

## How It Works

spec-manager keeps the work product in your repo: PRD, design, implementation spec, task history, decisions, and verification evidence.

For a typical request, the flow is:

`L1 PRD -> L2 Design -> L3 Impl -> Agent Task -> Verification`

That gives AI agents a frozen implementation target and gives humans a clear record of scope, rationale, execution, and verification.

## Adaptive Harness Governance

Some changes need speed; others need stronger proof that important acceptance criteria were actually verified.

- Task creation records a Profile snapshot, so later config changes do not rewrite the delivery contract.
- `standard` keeps the workflow lightweight while surfacing missing evidence as warnings.
- `governed` turns critical AC coverage into a completion gate for high-risk work.
- Read-only commands like `project profile recommend`, `project profile metrics`, `project workflow preview`, and `project readiness critical` help teams choose the right rigor and audit gaps without hidden automation.

Example:

```bash
spec-manager project profile recommend --request "Add SSO login"
spec-manager project readiness critical
```

## 3-Minute Start

```bash
# 1. Install or run directly
npm install -g spec-manager
# or: npx spec-manager <command>

# 2. Initialize your project
cd my-project
spec-manager project init --name my-project

# 3. Add instructions for your AI coding tool
spec-manager project agents --provider all
```

Then check the safe next step from your terminal:

```bash
spec-manager next "add user authentication"
spec-manager brief "add user authentication"
spec-manager dashboard
```

Or ask your agent:

```text
Use spec-manager to add user authentication.
```

For Claude Code / CodeBuddy skills:

```text
/spec-manager add user authentication
```

The agent will create specs and ask for approval before implementation. You can stop there and inspect the files, or continue into a full task.

Use terminal commands such as `next`, `brief`, and `dashboard` to inspect workflow state. Use chat requests such as `Use spec-manager to ...` or `/spec-manager ...` to have the agent advance the workflow.

## Single-Repo and Multi-Repo Specs

By default, spec-manager stores `.spec-manager/`, `specs/`, `changes/`, and `archive/` in the current project. That is still the simplest single-repo mode.

For a product line or multi-repo workspace, keep specs in a dedicated planning repo or shared specs directory, then point each code repo at that write root from `.spec-manager/config.yaml`:

```yaml
project_name: app-repo
specStore:
  id: product-planning
  path: ../product-specs
  mode: write
contextSources:
  - id: platform-specs
    path: ../platform-specs
    mode: read
```

- `executionRoot` is the code repo where the command runs.
- `writeRoot` is where spec/task/decision writes go after `specStore.path` is resolved.
- `contextSources` are read-only inputs for brief/dashboard/context, never write targets.

Before writing specs or tasks, verify the resolved roots:

```bash
spec-manager project context --json
spec-manager project store show
spec-manager project store doctor
spec-manager dashboard --json
```

Without `specStore`, existing single-repo behavior is unchanged. This version does not provide `--store <id|path>` overrides or automatic migration. For UI/design work, keep the managed design context in the resolved write root at `specs/DESIGN.md`; root `DESIGN.md` remains a legacy fallback.

## MiMo-Code

MiMo-Code reads `AGENTS.md`, so setup is intentionally small:

```bash
npm install -g @mimo-ai/cli
spec-manager mimocode install
mimocode
```

This installs the shared spec-manager workflow capsule into `AGENTS.md`.

## Agent Setup

Install every bundled agent entrypoint:

```bash
spec-manager agents install
# alias
spec-manager skills install
```

If you do not want every platform, install only the one you use:

```bash
spec-manager claude install
spec-manager codex install
spec-manager cursor install
spec-manager install --platform kimi
```

Preview changes first:

```bash
spec-manager codex install --dry-run
spec-manager kilo install --dry-run
```

The older provider entrypoint remains available for scripts and advanced control:

```bash
spec-manager project agents --provider all
spec-manager project agents --provider codex
spec-manager project agents --provider list
```

Common platforms:

| Platform | Recommended command | Files |
|---|---|---|
| Claude Code | `spec-manager claude install` | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| CodeBuddy | `spec-manager codebuddy install` | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |
| Codex | `spec-manager codex install` | `AGENTS.md` |
| OpenCode | `spec-manager opencode install` | `AGENTS.md` |
| MiMo-Code | `spec-manager mimocode install` | `AGENTS.md` |
| Cursor | `spec-manager cursor install` | `.cursorrules` |
| Windsurf | `spec-manager windsurf install` | `.windsurfrules` |

More platforms can also use the same install surface. Platforms without a dedicated native format use **AGENTS-compatible fallback instructions**, meaning spec-manager writes generic `AGENTS.md` guidance and does not claim native IDE integration.

| Platform | Command |
|---|---|
| Kilo Code | `spec-manager kilo install` |
| GitHub Copilot CLI | `spec-manager copilot install` |
| VS Code Copilot Chat | `spec-manager vscode install` |
| Aider | `spec-manager aider install` |
| OpenClaw | `spec-manager claw install` |
| Factory Droid | `spec-manager droid install` |
| Trae | `spec-manager trae install` |
| Trae CN | `spec-manager trae-cn install` |
| Gemini CLI | `spec-manager gemini install` |
| Hermes | `spec-manager hermes install` |
| Kimi Code | `spec-manager kimi install` or `spec-manager install --platform kimi` |
| Amp | `spec-manager amp install` |
| Kiro IDE/CLI | `spec-manager kiro install` |
| Pi coding agent | `spec-manager pi install` |
| Devin CLI | `spec-manager devin install` |
| Google Antigravity | `spec-manager antigravity install` |

## When You Want More Control

You can drive the workflow yourself without memorizing the full process:

```bash
spec-manager next "add user authentication"      # prints the safe next step
spec-manager brief "add user authentication"     # local context + workflow next action
spec-manager dashboard                           # project/topic summary
spec-manager assist critique auth-L1             # review spec quality gaps before approval
spec-manager assist next T-001 --spec auth-L3.1.1 # task navigation and evidence summary
spec-manager assist drift T-001 --spec auth-L3.1.1 # compare changed files to declared scope
spec-manager assist acceptance T-001 --spec auth-L3.1.1 # summarize evidence, human acceptance, and residual risk
spec-manager assist delivery T-001 --spec auth-L3.1.1 # prepare a user-facing handoff summary
spec-manager new feature --topic auth "User authentication"
spec-manager flow status --topic auth            # see where the work is blocked
spec-manager view --topic auth                   # interactive browser
spec-manager project doctor                      # check setup and integrity
```

The full workflow is still available when you need it:

```bash
spec-manager spec new L1 --topic auth --title "User authentication"
spec-manager spec update auth-L1 --content ./l1.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm auth-L1
spec-manager spec new L2 --topic auth --parent auth-L1 --title "Auth design"
spec-manager spec confirm auth-L2.1
spec-manager spec new L3 --topic auth --parent auth-L2.1 --title "JWT implementation"
spec-manager spec confirm auth-L3.1.1
spec-manager task run auth-L3.1.1 --plan ./plan.json
```

`spec-manager spec confirm <L3>` only freezes the L3. It does not create a task automatically. When the user means "confirm and run", "create and execute the task", or "continue executing this L3", prefer `task run` to explicitly combine L3 freeze, task creation, and task start.

When the L3 is already frozen, create and start its task with one command:

```bash
spec-manager task create auth-L3.1.1 --plan ./plan.json --start
```

For advanced troubleshooting, the manual task lifecycle is still available:

```bash
spec-manager task create auth-L3.1.1 --plan ./plan.json
spec-manager task start T-001 --spec auth-L3.1.1
```

Think of this as optional depth. Most people should start with `next`, `brief`, `dashboard`, or an AI agent prompt. Compatibility commands such as `guide`, `assist guide`, and `flow status` remain available for scripts and advanced troubleshooting.

## Design Context

For UI, visual, or styling work, add `specs/DESIGN.md` to describe the managed specs design context. spec-manager treats this file as optional local context, not as an L2 technical design replacement. A root-level `DESIGN.md` is still supported as a legacy fallback when `specs/DESIGN.md` does not exist.

- `spec-manager brief "<UI request>"` automatically includes Design Context when the request is design-relevant and `specs/DESIGN.md` exists, falling back to root `DESIGN.md`.
- `spec-manager assist design-template` writes a starter `specs/DESIGN.md`; it refuses to overwrite unless `--force` is passed. Use `--out DESIGN.md` only for the legacy root path.
- `spec-manager assist design-export --format tokens-json` exports normalized tokens from the default design context; use `--path DESIGN.md` or `--path specs/DESIGN.md` to force an explicit file. Use `--format dtcg-json` for the current DESIGN.md schema's DTCG JSON subset, `--format tailwind-json` for Tailwind v3 `theme.extend`, or `--format tailwind-css` for a Tailwind v4 `@theme` block. `--out <file>` writes the export locally.
- L3 specs can use `@verify: design-lint(DESIGN.md)` to record DESIGN.md lint results as verification evidence.
- Review-oriented L3 specs can use `@verify: design-diff(DESIGN.before.md, DESIGN.md)` to compare two explicit DESIGN.md files. The rule fails only when the after file increases lint errors/warnings, either file is missing, or a design token is removed; added/modified tokens and section prose changes are reported as structural diff summary.
- Schema lint reports invalid color, dimension, typography, and component token shapes as errors; unknown component properties are warnings. Fix findings by the reported path, such as `colors.primary` or `components.button-primary.animation`.
- Parser, lint, export, and diff behavior is covered by a small conformance fixture set under `src/core/__tests__/fixtures/design-context/`. These fixtures are copied into this repository for tests only and do not vendor or invoke the external DESIGN.md project.
- Agent Brief adds non-blocking Design Guidance for UI requests with DESIGN.md: read prose first, prefer specific inspiration, respect do/don't constraints, and treat unknown sections as possible design intent. `assist critique` may also emit an advisory for UI/design specs that do not state how agents should use DESIGN.md prose.
- The first version reads, summarizes, lints, diffs, exports, and reports DESIGN.md; it does not generate UI, rewrite components, modify Tailwind config files, judge visual quality, or depend on an external design CLI.

## Core Ideas

- **L1**: what and why
- **L2**: technical design
- **L3**: implementation plan
- **Task**: agent execution with step records and verification
- **Decision card**: why an important choice was made
- **Delta change**: change an already shipped spec without losing history

## Common Commands

| Command | Use it for |
|---|---|
| `spec-manager project init --name X` | Create `.spec-manager/` |
| `spec-manager project agents [--provider P]` | Install agent workflow files |
| `spec-manager project doctor` | Check setup and repository integrity |
| `spec-manager project docs check` | Check README, package files, agent guidance, and generated asset boundaries before release |
| `spec-manager next "request"` | Get the safe next command for a request |
| `spec-manager brief "request"` | Generate an Agent Brief and workflow next action |
| `spec-manager dashboard` | Show project/topic workflow summary |
| `spec-manager guide "request"` | Compatibility entry: get the next command for a request |
| `spec-manager new feature --topic T "Title"` | Start a lightweight L1 |
| `spec-manager flow status --topic T` | See progress and blockers |
| `spec-manager spec list` | List specs |
| `spec-manager spec show <code> --include-content` | Read a spec |
| `spec-manager task list --topic T` | List tasks |
| `spec-manager decision list --topic T` | List decisions |

Run any command with `--help` for details.

## Files It Creates

```text
my-project/
├── .spec-manager/
│   ├── config.yaml
│   ├── audit.json
│   └── incidents/
├── specs/<topic>/
│   ├── <L1-code>.md
│   ├── <L2-code>.md
│   ├── <L3-code>[-desc].md
│   ├── decisions/
│   │   └── DC-001.md
│   └── tasks/
│       └── <specCode>-T-001.json
├── changes/<name>/
└── archive/<name>/
```

Spec codes are readable by design: `auth-L1`, `auth-L2.1`, `auth-L3.1.1-jwt`.

## Learn More

- [Methodology](docs/methodology.md)
- [Rules](rules/)
- [Templates](templates/)
- [Decision template](templates/decision.md)

## License

MIT
