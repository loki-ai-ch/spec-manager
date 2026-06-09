# spec-manager

[![npm version](https://img.shields.io/npm/v/spec-manager)](https://www.npmjs.com/package/spec-manager)
[![CI](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/loki-ai-ch/spec-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Chinese version](readme_zh.md)

**Local-first spec-driven development platform.** Pure markdown + git storage. No network, no MCP, no backend.

---

## What it does

- **Four-layer funnel** — Requirements → Design → Implementation → Continuity, with human review gates at each layer
- **L0/L1/L2/L3 spec hierarchy** — vision / PRD / design / implementation spec
- **24 rules** with `applies_to` filtering — no need to load all 24 every time
- **Status machine** L1/L2 use `draft → confirmed`; L3 uses `draft → frozen → implemented`
- **Agent Task lifecycle** — `create → start → step → complete`, steps in spec frontmatter; R5 blocks complete if steps are skipped
- **Coding harness bridge** — export task context, report task progress, record verification evidence, and propose implementation-scope changes from CLI-friendly commands
- **Project integrity inspection** — scan for dangling references, conflicting active tasks, missing verifications/decisions, and stale parents; surfaced via `project doctor`
- **Lifecycle reconciliation** — dry-run/apply plans to retroactively mark historical L1/L2 specs as `implemented` and create missing decision records
- **Repository remediation** — versioned migrations that retroactively create decision records, integrity exemptions, and missing agent asset directories
- **File transactions** — atomic, rollback-capable multi-file writes with snapshot-and-restore semantics
- **Task invariants** — hard-safety checks: one active task per spec, only running tasks accept steps, successful verification required before completion
- **Decision cards** with `what/why/affectedCriteria` + topic query
- **Rule audit** with at-least-once local JSON accumulator
- **Delta specs** (OpenSpec-style `changes/<name>/` with ADDED/MODIFIED/REMOVED/RENAMED + archive merge)
- **Multi-agent setup** — auto-detect or explicitly install instructions for Claude Code, Codex, OpenCode, CodeBuddy, Cursor, and Windsurf
- **Interactive workflow view** — browse topics, specs, tasks, and next-step suggestions from one terminal UI
- **Shell completion** — install dynamic zsh/bash/fish completion for commands and spec codes
- **RFC 2119** keywords (SHALL/MUST/SHOULD) validation in acceptance criteria
- **Incident tracking** — rule violations drive rule evolution

> Full methodology: [docs/methodology.md](docs/methodology.md)

## Install

```bash
# Run directly (recommended)
npx spec-manager <command>

# Or install globally
npm install -g spec-manager
```

## AI Agent Setup

spec-manager is agent-agnostic: the CLI stores the source of truth locally, and AI tools only need a workflow entrypoint that enforces the same rules. Built-in setup supports Claude Code, Codex, OpenCode, CodeBuddy, and other `AGENTS.md`-compatible agents.

Not every tool has a native "skills" directory. spec-manager installs the closest equivalent for each platform: real skills where the platform supports them, and a project-level `AGENTS.md` workflow capsule where it does not.

### Recommended

```bash
cd my-project
spec-manager project init --name my-project
spec-manager project agents                 # auto-detect installed/configured agents
spec-manager project agents --provider all  # or install every supported provider
```

This writes:

| Provider | spec-manager entrypoint | Files |
|---|---|---|
| Claude Code | Native skill | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| Codex | `AGENTS.md` workflow capsule, not a native skill | `AGENTS.md` |
| OpenCode | `AGENTS.md` workflow capsule, not a native skill | `AGENTS.md` |
| CodeBuddy | Native skill | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |
| Cursor | Project rules | `.cursor/rules/spec-manager.mdc` |
| Windsurf | Project rules | `.windsurf/rules/spec-manager.md` |

Use a narrower install when needed:

```bash
spec-manager project agents --provider list
spec-manager project agents --dry-run
spec-manager project agents --provider all --dry-run
spec-manager project agents --provider codex,cursor,windsurf
spec-manager project agents --provider codebuddy --force
```

Use `--dry-run` to preview created, overwritten, and skipped files before touching the project.

References: [Codex `AGENTS.md`](https://github.com/openai/codex/blob/main/docs/agents_md.md), [OpenCode rules](https://opencode.ai/docs/rules/), [CodeBuddy skills](https://www.codebuddy.ai/docs/cli/skills).

For Codex CLI, do not look for a `skills` command or directory. Run Codex from the project root and it will read `AGENTS.md`. Ask it to "Use spec-manager ..." and the file acts as the spec-manager workflow entrypoint.

### Manual install

If you do not want to use the installer, copy the templates directly:

```bash
# Codex / OpenCode / AGENTS.md-compatible tools (skill-like workflow capsule)
cp path/to/spec-manager/templates/agents/AGENTS.md my-project/AGENTS.md

# Claude Code
mkdir -p my-project/.claude/skills/spec-manager
cp -r path/to/spec-manager/skill/* my-project/.claude/skills/spec-manager/
cp -r path/to/spec-manager/rules my-project/.claude/skills/spec-manager/rules
cp -r path/to/spec-manager/templates my-project/.claude/skills/spec-manager/templates
cp path/to/spec-manager/templates/agents/CLAUDE.md my-project/CLAUDE.md

# CodeBuddy
mkdir -p my-project/.codebuddy/skills/spec-manager
cp -r path/to/spec-manager/skill/subskills my-project/.codebuddy/skills/spec-manager/subskills
cp -r path/to/spec-manager/rules my-project/.codebuddy/skills/spec-manager/rules
cp -r path/to/spec-manager/templates my-project/.codebuddy/skills/spec-manager/templates
cp path/to/spec-manager/templates/agents/CODEBUDDY.md my-project/CODEBUDDY.md
cp path/to/spec-manager/templates/agents/codebuddy-skill/SKILL.md my-project/.codebuddy/skills/spec-manager/SKILL.md
```

### Start iterating

```bash
# Claude Code / CodeBuddy skill:
/spec-manager add user authentication feature

# Codex / OpenCode / other AGENTS.md agents:
Use spec-manager to add user authentication feature.
```

The AI will follow the L1→L2→L3→Task pipeline with human review gates at each layer. See [rules/](rules/) for the full 24-rule set.

## Quick start

```bash
cd my-project
spec-manager project init --name my-project
spec-manager project agents --provider all
spec-manager spec new L1 --topic auth --title "User authentication"  # auto-generates auth-L1
# write the body to ./l1.md, then:
spec-manager spec update auth-L1 --content ./l1.md \
  --ai-summary "OAuth 2.0 + JWT, 3 endpoints" --change-summary "Initial L1"
# wait for user review
spec-manager spec confirm <code>
# L2/L3 follow the same shape: spec new L2 --parent <L1 code>
```

Or use an AI agent configured with spec-manager:

```bash
/spec-manager add user authentication feature
```

## Easier workflows

For day-to-day use, these helper commands reduce command memorization:

```bash
spec-manager project doctor                 # check setup, agent files, skill assets, placeholders, audit, integrity
spec-manager project reconcile              # dry-run: retroactively mark historical specs as implemented + create missing decisions
spec-manager project remediate              # versioned migrations: decision records, integrity exemptions, missing agent assets
spec-manager flow status --topic auth       # show L1/L2/L3/Task progress and the next command
spec-manager view --topic auth              # interactively browse specs, tasks, and next steps
spec-manager guide "add user auth"          # print the next useful step for a request
spec-manager new feature --topic auth "User authentication"
spec-manager approve auth-L1                # L1/L2 draft→confirmed; L3 draft/confirmed→frozen
spec-manager run auth-L3.1.1 --plan ./plan.json
spec-manager template L1 --title "User authentication" > l1.md
spec-manager completion install zsh         # also supports bash and fish
spec-manager completion uninstall           # removes all installed completion scripts
```

Long-form commands remain available; the shortcuts only wrap the same rules and state machine.

| Command | Use it when | What it gives you |
|---|---|---|
| `project doctor` | You are unsure whether the project is ready | Setup checks plus integrity scan and concrete fix commands |
| `project reconcile` | Historical specs need retroactive status fixes | Dry-run/apply plan to mark L1/L2 as implemented + create missing decisions |
| `project remediate` | Project needs versioned migrations | Creates decision records, integrity exemptions, and missing agent assets |
| `flow status` | You need to know where a topic is blocked | L1/L2/L3/Task state and the next command |
| `view` | You want to explore workflow state interactively | Topic/spec/task browser with next-step suggestions |
| `guide` | You have a request but do not know which command starts it | The next useful step without changing files |
| `new feature` | You want the fastest safe way to start an L1 | Creates the L1 shell and prints the next update command |
| `approve` | The user has explicitly approved a spec | Advances L1/L2 `draft→confirmed` or L3 `draft/confirmed→frozen` |
| `run` | A frozen L3 is ready to execute | Creates and starts the task from a plan file |
| `template` | You need a draft file for L1/L2/L3 or `agent-plan` | Prints or writes the bundled template |
| `completion install/uninstall` | You want shell command and spec-code completion | Installs or removes zsh/bash/fish completion scripts |

Examples:

```bash
spec-manager project doctor
spec-manager flow status --topic auth
spec-manager template L2 --title "Invoice module" --output l2.md
spec-manager guide "add billing export"
```

After `completion install`, start a new shell session or reload that shell's completion configuration using the printed hint.

## Usage scenarios

### 1. Quick fix (typo / one-line change)

```bash
spec-manager spec show <code> --include-content     # read current spec
# edit the file directly, then:
spec-manager spec update <code> --content ./fixed.md --ai-summary "fix typo in AC-2" --change-summary "typo fix"
```

### 2. Research (browse existing specs)

```bash
spec-manager spec list                               # all specs
spec-manager spec list --level L1 --status confirmed  # filtered
spec-manager spec show <code>                         # metadata only (R19)
spec-manager decision list --topic auth               # decision history
```

### 3. Full feature (L1 → L2 → L3 → Task)

```bash
spec-manager spec new L1 --topic billing --title "Billing system"
spec-manager spec update <l1-code> --content ./l1.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm <l1-code>                   # user reviews

spec-manager spec new L2 --topic billing --title "Invoice module" --parent <l1-code>
spec-manager spec update <l2-code> --content ./l2.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm <l2-code>

spec-manager spec new L3 --topic billing --title "PDF generation" --parent <l2-code>
spec-manager spec update <l3-code> --content ./l3.md --ai-summary "..." --change-summary "init"
spec-manager spec confirm <l3-code>                   # one approval: draft → frozen

spec-manager task create <l3-code> --plan ./plan.json --auto-confirm
spec-manager task start T-001
spec-manager task step T-001 --no 1 --status succeeded --output-json '{"summary":"..."}'
spec-manager task complete T-001                      # cascades L3→L2→L1
```

### 4. Delta change (modify shipped spec)

```bash
spec-manager change new add-2fa --description "Add 2FA"
# edit changes/add-2fa/proposal.md + deltas/<code>.md
spec-manager change archive add-2fa                  # applies & archives
```

### 5. Postmortem (incident review)

```bash
spec-manager incident new --severity high --rule R5 --spec <code>
# fill in .spec-manager/incidents/INC-*.md
spec-manager incident list
```

## Tutorial — end-to-end feature

A realistic walk-through of taking a feature from idea to shipped code, using a "user authentication" feature as the running example. Each step maps to one CLI invocation plus a human review gate.

### 1. Initialize the project

```bash
mkdir my-project && cd my-project
git init
spec-manager project init --name my-project
```

This creates `.spec-manager/` (config + audit + incidents). Add `.spec-manager/audit.json` to `.gitignore` if you don't want the audit log in commits — or commit it, your call.

### 2. Write an L1 PRD (what & why)

```bash
spec-manager spec new L1 --topic auth --title "User authentication"
# → outputs: code auth-L1, file specs/auth/auth-L1.md
```

Before writing the L1 body, the agent should ask 3-4 PRE-WRITE questions (see `templates/L1-prd.md`): who is the user, what's the success metric, what's explicitly out of scope, and — if there's an active decision card on this topic — whether the new spec is consistent with it (`spec-manager decision list --topic auth`).

Then write the L1 body to a draft file and update:

```bash
cat > /tmp/auth-l1.md <<'EOF'
# User authentication — L1 PRD

## Background
... (user stories, MoSCoW ranking, acceptance criteria, scope boundaries)

EOF

spec-manager spec update auth-L1 \
  --content /tmp/auth-l1.md \
  --ai-summary "OAuth 2.0 + JWT, 3 endpoints: /login /refresh /me" \
  --change-summary "Initial L1"
```

`update` automatically runs warning-only validation (required sections + RFC 2119 keywords). **Don't advance the status yet** — `update` leaves it as `draft`.

### 3. Confirm the L1 (user approval gate)

```bash
spec-manager spec confirm auth-L1
# status: draft → confirmed
```

The user reviews the L1 body (`spec show auth-L1 --include-content`) and approves. Only then do you proceed to L2.

### 4. Write an L2 design (how)

L2s are scoped 1:1 or 1:2 against their L1, split by module boundary, not feature. Each L2 must bind to a parent L1.

```bash
spec-manager spec new L2 --topic auth --title "OAuth 2.0 backend design" --parent auth-L1
# → outputs: code auth-L2.1

# write L2 body (technical approach, module boundaries, interface contracts, L3 breakdown)
cat > /tmp/auth-l2.md <<'EOF'
# OAuth 2.0 backend design — L2

## Approach
...

## Interface contract
| Endpoint | Method | Input | Output | Error codes |
|---|---|---|---|---|
| /login | POST | {email, password} | {accessToken, refreshToken} | 401 |

## L3 breakdown
| L3 code | Scope | Prerequisite |
|---|---|---|
| auth-L3.1.1-jwt | JWT signing module | none |
| auth-L3.1.2-refresh | Refresh token module | auth-L3.1.1-jwt implemented |
EOF

spec-manager spec update auth-L2.1 \
  --content /tmp/auth-l2.md \
  --ai-summary "JWT sign/verify, refresh rotation, 3 endpoints" \
  --change-summary "Initial L2"
```

User reviews → `spec confirm auth-L2.1`.

### 5. Write L3 implementation specs (precise steps)

```bash
spec-manager spec new L3 --topic auth --title "JWT signing module" --parent auth-L2.1 --desc jwt
# → outputs: code auth-L3.1.1-jwt
```

L3 is where implementation precision lives: file paths, function signatures, planJson steps. Build the planJson as a separate file:

```bash
cat > /tmp/jwt-plan.json <<'EOF'
{
  "coveredSpecs": ["auth-L3.1.1-jwt"],
  "steps": [
    {"stepNo": 1, "stepType": "mcp_tool", "name": "Read parent L2 + sibling L1 historical spec, confirm no duplicate implementation"},
    {"stepNo": 2, "stepType": "mcp_tool", "name": "Create src/auth/jwt.ts implementing signJwt(payload, secret, ttl)"},
    {"stepNo": 3, "stepType": "mcp_tool", "name": "Create src/auth/__tests__/jwt.test.ts covering sign + verify + expiry"},
    {"stepNo": 4, "stepType": "mcp_tool", "name": "Verify: pnpm test src/auth/jwt.test.ts reports 0 failures"}
  ]
}
EOF

# validate a plan file before committing it to the L3
spec-manager spec validate-plan /tmp/jwt-plan.json

# after the L3 contains planJson, validate directly from the spec
spec-manager spec validate-plan --from-spec auth-L3.1.1-jwt

# write L3 body referencing the plan
cat > /tmp/jwt-l3.md <<'EOF'
# JWT signing module — L3

## Goal
Implements the "JWT signing" part of auth-L2.1's deliverables 1/2/3.

## Implementation steps
See /tmp/jwt-plan.json (4 steps; the last step must be a verification).
EOF

spec-manager spec update auth-L3.1.1-jwt \
  --content /tmp/jwt-l3.md \
  --ai-summary "signJwt/verifyJwt functions + unit tests + 4-step planJson" \
  --change-summary "Initial L3"
```

L3 needs one explicit user approval: `spec confirm auth-L3.1.1-jwt` advances it directly from `draft` to `frozen`. Historical L3 specs already in `confirmed` can still use `spec freeze`. `frozen` remains the prerequisite for creating an Agent Task.

### 6. Create and run the Agent Task

```bash
spec-manager task create auth-L3.1.1-jwt --plan /tmp/jwt-plan.json --auto-confirm
# → outputs: taskId T-001, file specs/auth/tasks/auth-L3.1.1-jwt-T-001.json

spec-manager task start T-001 --spec auth-L3.1.1-jwt

# optional: export a compact context packet for a coding harness / agent
spec-manager task context auth-L3.1.1-jwt --format text
spec-manager task context auth-L3.1.1-jwt --format json

# step 1
spec-manager task step T-001 --spec auth-L3.1.1-jwt --no 1 --type mcp_tool --name "Context gathering" \
  --status succeeded --output-json '{"summary":"read L2 + L1","read":["auth-L2.1"]}' --latency 1200
# ... repeat for each step

# shorthand for harnesses: write a structured progress report into the next/picked task step
spec-manager task report T-001 --spec auth-L3.1.1-jwt \
  --summary "Implemented JWT signing" \
  --files "src/auth/jwt.ts,src/auth/__tests__/jwt.test.ts" \
  --tests "npm test -- --run src/auth/__tests__/jwt.test.ts"

# record verification evidence before completion
spec-manager task verify T-001 --spec auth-L3.1.1-jwt \
  --command "npm test -- --run src/auth/__tests__/jwt.test.ts" \
  --exit-code 0 \
  --summary "JWT tests passed" \
  --covers-ac AC-1,AC-2

spec-manager task complete T-001 --spec auth-L3.1.1-jwt
# → L3 status: frozen → implemented
# → if all L3 children of L2 are implemented: L2 cascades to implemented
# → if all L2 children of L1 are implemented: L1 cascades to implemented
```

`task context` is designed for coding harnesses and agents that need a bounded work packet before editing. `task step` is the per-step report (with required `outputJson` per R15); `task report` is a compact harness-friendly wrapper around the same step recording model. `task verify` stores command, exit code, summary, artifacts, and covered ACs on the task. `task complete` triggers the cascade — it never goes the other way (R2).

Task history is immutable after `completed` or `failed`. A task can complete only after every planned step succeeds and at least one recorded verification has `exitCode=0`. The deprecated `task batch` command cannot synthesize successful execution records.

### 7. Record a decision card (R18: L1 implemented)

Once the L1 is `implemented`, you MUST record at least one decision card capturing the key what/why:

```bash
spec-manager decision create auth-L1 \
  --topic auth \
  --what "Adopt JWT over session" \
  --why "Stateless scaling, easier to share identity across services" \
  --criteria "AC-1,AC-2"
# → outputs: DC-001
```

`task complete` automatically prints an R18 checklist for any L1 that just cascaded to `implemented` — for each, it shows whether a decision card already exists and the exact CLI commands to create one (and `audit hit R18` to record the check).

```text
⚠ R18 (decision cards): these L1s just cascaded to implemented — verify a card exists:
  ✗ auth-L1 [auth] — pending
    spec-manager decision create auth-L1 \
      --topic auth --what "..." --why "..." --criteria AC-1,AC-2
    spec-manager audit hit R18 --spec auth-L1
  ✓ billing-L1 [billing] — 2 cards (active: 2)
    spec-manager audit hit R18 --spec billing-L1
```

**Query decisions** by topic or by AC reference (AC-7 — track which requirements have changed and why):

```bash
spec-manager decision list --topic auth
# ● DC-001 [auth]  Adopt JWT over session {AC-1,AC-2}
# ● DC-002 [auth]  Use refresh-token rotation

spec-manager decision list --criteria AC-1 --include-all
# ● DC-001 [auth]  Adopt JWT over session
# ○ DC-003 [auth]  Switch to PASETO (superseded by DC-005)
# ◐ DC-004 [auth]  Skip refresh-token (partial — see INC-20260604-001)
```

**Lifecycle** — three states, one transition path:

| From | To | Command | When |
|---|---|---|---|
| active | superseded | `decision supersede DC-001 --by DC-005` | new decision fully replaces old |
| active | partial | `decision set-partial DC-004 --reason "INC-...:AC-3 assumption no longer holds"` | part of the decision is no longer valid |
| (any) | (deleted) | `decision delete DC-001` | only if `active`; otherwise recover first |

**Edit** a card's `what`/`why`/`affectedCriteria` without changing its status:

```bash
spec-manager decision update DC-001 \
  --what "Adopt JWT with short TTL + refresh-token rotation" \
  --criteria "AC-1,AC-2,AC-3"
```

Use the [template](templates/decision.md) when writing the body manually (the CLI auto-renders this format).

### 8. Modify an existing spec (delta change)

When you need to change an already-shipped spec, use a change proposal — never edit the spec body directly:

```bash
spec-manager change new add-2fa --description "Add 2FA two-factor authentication"
# → creates changes/add-2fa/ (proposal.md + deltas/ + specs/)

# 1. edit changes/add-2fa/proposal.md (why + scope + risk)
# 2. write changes/add-2fa/deltas/<code>.md with ## MODIFIED Requirements
# 3. if ADDED, drop a placeholder at changes/add-2fa/specs/<topic>/<code>/<code>.md

spec-manager change archive add-2fa
# applies RENAMED→REMOVED→MODIFIED→ADDED in order, then moves changes/add-2fa/ to archive/
```

This gives you a full audit trail: who proposed what, when, and what the spec looked like before the change.

When an implementation discovers that the frozen L3 no longer matches reality, keep that deviation explicit and task-linked:

```bash
spec-manager change propose \
  --task T-001 \
  --spec auth-L3.1.1-jwt \
  --reason "The library exposes async key loading, but the L3 specified sync loading" \
  --impact "Update AC-2 and the verification command before merging"

spec-manager change list
spec-manager change show auth-l3-1-1-jwt-t-001-proposal

# after amending the L3, recording a decision, or splitting follow-up work
spec-manager change resolve auth-l3-1-1-jwt-t-001-proposal
```

Task-linked proposals live in `changes/<name>/proposal.md` with `status: unresolved|resolved`. `audit show` warns on unresolved task-linked proposals so implementation drift cannot disappear silently.

## Common commands

| Command | What it does |
|---|---|
| `spec-manager project init --name X` | Initialize `.spec-manager/` |
| `spec-manager project status` | Project overview (specs by level, recent activity) |
| `spec-manager project agents [--provider P] [--dry-run]` | Auto-detect or install agent workflow files |
| `spec-manager project doctor` | Setup + integrity checks with concrete fix commands |
| `spec-manager project reconcile [--dry-run]` | Retroactively mark historical L1/L2 as implemented + create missing decisions |
| `spec-manager project remediate [--dry-run]` | Versioned migrations: decisions, exemptions, missing agent assets |
| `spec-manager view [--topic X]` | Interactive topic/spec/task browser |
| `spec-manager completion install zsh\|bash\|fish` | Install shell and spec-code completion |
| `spec-manager spec list [--level L1] [--topic X] [--status draft]` | List specs (filterable) |
| `spec-manager spec show <code> [--include-content]` | View spec; default is narrow (metadata only, R19) |
| `spec-manager spec update <code> --content F --ai-summary S --change-summary R` | Write spec body |
| `spec-manager spec confirm \| freeze \| implement <code>` | Advance status (human-triggered) |
| `spec-manager spec validate <code>` | Re-run warning-only validation |
| `spec-manager spec validate-plan [file] [--from-spec <code>]` | Validate planJson from a file or L3 spec |
| `spec-manager spec add-relation <code> --target T --type based_on\|supersedes\|implements\|references` | Cross-spec reference |
| `spec-manager task create \| start \| step \| report \| verify \| complete \| fail \| list \| show \| context` | Agent Task lifecycle and coding harness bridge |
| `spec-manager decision create \| list \| show \| update \| set-partial \| supersede \| delete` | Decision cards (R18) |
| `spec-manager change new \| propose \| resolve \| archive \| list \| show` | Delta spec workflow and task-linked implementation change proposals |
| `spec-manager incident new \| list` | Rule violation tracking |
| `spec-manager audit hit \| report \| show` | Local rule audit |

Get full help any time: `spec-manager <command> --help`.

## File layout

Specs are stored flat — dotted codes (`auth-L2.1`, `auth-L3.1.1-jwt`) encode the hierarchy, so no nested directories are needed. `decisions/` and `tasks/` live at the topic level.

```
my-project/
├── .spec-manager/
│   ├── config.yaml
│   ├── audit.json
│   └── incidents/
├── specs/<topic>/
│   ├── <L1-code>.md
│   ├── <L2-code>.md
│   ├── <L3-code>[-desc].md
│   ├── decisions/               # R18: L1 implemented → decision cards
│   │   └── DC-001.md
│   └── tasks/                   # R3: L3 frozen → agent tasks
│       └── <specCode>-T-001.json
├── changes/<name>/
│   ├── proposal.md              # regular delta proposal or task-linked implementation proposal
│   ├── deltas/<code>.md
│   └── specs/<topic>/<code>/<code>.md  # ADDED placeholder
└── archive/<name>/               # merged changes
```

Spec codes follow `<topic>-L<N>[.<M>][-desc]` (e.g. `auth-L1`, `auth-L2.1`, `auth-L3.1.1-jwt`): the code self-documents the hierarchy — no need to trace parent directories. `spec new` auto-generates the code when `--code` is omitted. Use `--desc` to add a ≤15 char suffix for readability.

## Documentation

- [docs/methodology.md](docs/methodology.md) — the public-facing methodology

## Architecture

```
spec-manager/
├── src/                    TypeScript CLI source
│   ├── cli/                command implementations
│   ├── core/               spec IO, validation, state machine
│   └── schemas/            Zod schemas
├── templates/              L0/L1/L2/L3/proposal/decision/incident markdown
├── rules/                  24 markdown rules with YAML frontmatter
├── skill/                  Agent skill content (SKILL.md + 12 subskills)
├── docs/                   public docs
└── examples/               migration examples
```

## Design choices

- **Markdown + YAML frontmatter** over JSON or DB: git-friendly, human-readable, diff-able
- **Atomic file writes** (temp + rename) prevent half-written specs; **file transactions** extend this to multi-spec operations with rollback
- **Narrow view by default** (`spec show` returns metadata only, R19) — saves context
- **Warning-only validation** — never throws on content quality issues (per R22, R13); R22 blocks confirm/freeze if content is still placeholder
- **Local rule audit** — JSON file with at-least-once pending queue (no network to fail)
- **No DAG, strict tree** — L1→L2→L3→Task linear; delta changes are separate concept

## License

MIT
