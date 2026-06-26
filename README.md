# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[中文说明](readme_zh.md)

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

Now ask your agent:

```text
Use spec-manager to add user authentication.
```

For Claude Code / CodeBuddy skills:

```text
/spec-manager add user authentication
```

The agent will create specs and ask for approval before implementation. You can stop there and inspect the files, or continue into a full task.

## MiMo-Code

MiMo-Code reads `AGENTS.md`, so setup is intentionally small:

```bash
npm install -g @mimo-ai/cli
spec-manager project agents --provider mimocode
mimocode
```

This installs the shared spec-manager workflow capsule into `AGENTS.md`.

## Agent Setup

If you do not want every provider, install only the one you use:

```bash
spec-manager project agents --provider list
spec-manager project agents --provider claude
spec-manager project agents --provider codex
spec-manager project agents --provider opencode
spec-manager project agents --provider mimocode
spec-manager project agents --provider codebuddy
spec-manager project agents --provider cursor
spec-manager project agents --provider windsurf
```

Preview changes first:

```bash
spec-manager project agents --provider mimocode --dry-run
```

| Provider | Entry point | Files |
|---|---|---|
| Claude Code | Native skill | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| Codex | `AGENTS.md` workflow capsule | `AGENTS.md` |
| OpenCode | `AGENTS.md` workflow capsule | `AGENTS.md` |
| MiMo-Code | `AGENTS.md` workflow capsule | `AGENTS.md` |
| CodeBuddy | Native skill | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |
| Cursor | Project rules | `.cursorrules` |
| Windsurf | Project rules | `.windsurfrules` |

## When You Want More Control

You can drive the workflow yourself without memorizing the full process:

```bash
spec-manager guide "add user authentication"     # prints the next useful step
spec-manager assist guide --request "add user authentication"  # local context + next-command recommendation
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
spec-manager spec new L3 --topic auth --parent auth-L2.1 --title "JWT implementation"
spec-manager task create auth-L3.1.1 --plan ./plan.json
```

Think of this as optional depth. Most people should start with `guide`, `new feature`, or an AI agent prompt.

## Design Context

For UI, visual, or styling work, you can add a root-level `DESIGN.md` to describe the product's design context. spec-manager treats this file as optional local context, not as an L2 technical design replacement.

- `spec-manager assist brief --request "<UI request>"` automatically includes Design Context when the request is design-relevant and `DESIGN.md` exists.
- L3 specs can use `@verify: design-lint(DESIGN.md)` to record DESIGN.md lint results as verification evidence.
- Schema lint reports invalid color, dimension, typography, and component token shapes as errors; unknown component properties are warnings. Fix findings by the reported path, such as `colors.primary` or `components.button-primary.animation`.
- The first version reads, summarizes, lints, and reports DESIGN.md; it does not generate UI, rewrite components, or depend on an external design CLI.

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
| `spec-manager guide "request"` | Get the next command for a request |
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
