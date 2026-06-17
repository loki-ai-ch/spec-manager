# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[中文说明](readme_zh.md)

**Make AI coding work traceable.** spec-manager is a local-first workflow layer for Claude Code, Codex, OpenCode, MiMo-Code, CodeBuddy, Cursor, Windsurf, and other coding agents.

You do not need to understand the full methodology before trying it. Start with one project, one request, and one command.

## Why Use It

- **Less chaos**: AI agents write code after a lightweight spec, not from a vague prompt.
- **Better handoff**: specs, tasks, decisions, and verification records live in markdown/JSON files in your repo.
- **Works with your agent**: install the right workflow file for Claude Code, Codex, OpenCode, MiMo-Code, CodeBuddy, Cursor, or Windsurf.

Everything is local: markdown + git storage, no backend, no network dependency, no MCP requirement.

## How It Works

spec-manager keeps the work product in your repo: PRD, design, implementation spec, task history, decisions, and verification evidence.

For a typical request, the flow is:

`L1 PRD -> L2 Design -> L3 Impl -> Agent Task -> Verification`

That gives AI agents a frozen implementation target and gives humans a clear record of what changed and why.

## Adaptive Harness Governance

Version `v0.4.2` adds a stronger path for tasks that need explicit evidence coverage.

- Task creation records a Profile snapshot.
- `standard` stays lightweight and reports missing coverage as warnings.
- `governed` requires critical AC in the frozen L3 and verification evidence that covers them.
- Read-only commands like `project profile recommend`, `project profile metrics`, `project workflow preview`, and `project readiness critical` help preview and audit without hiding gates.

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
