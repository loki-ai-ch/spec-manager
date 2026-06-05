# spec-manager

[Chinese version](readme_zh.md)

**Local-first spec-driven development platform.** Pure markdown + git storage. No network, no MCP, no backend.

---

## What it does

- **Four-layer funnel** — Requirements → Design → Implementation → Continuity, with human review gates at each layer
- **L0/L1/L2/L3 spec hierarchy** — vision / PRD / design / implementation spec
- **24 rules** with `applies_to` filtering — no need to load all 24 every time
- **Status machine** `draft → confirmed → frozen → implemented`
- **Agent Task lifecycle** — `create → start → step → complete`, steps in spec frontmatter; R5 blocks complete if steps are skipped
- **Decision cards** with `what/why/affectedCriteria` + topic query
- **Rule audit** with at-least-once local JSON accumulator
- **Delta specs** (OpenSpec-style `changes/<name>/` with ADDED/MODIFIED/REMOVED/RENAMED + archive merge)
- **Multi-agent setup** — one command installs Claude Code, Codex, OpenCode, and CodeBuddy instructions
- **RFC 2119** keywords (SHALL/MUST/SHOULD) validation in acceptance criteria
- **Incident tracking** — rule violations drive rule evolution

> Full methodology: [docs/methodology.md](docs/methodology.md)

## Install

```bash
# Clone and install globally
git clone https://github.com/loki/spec-manager.git
cd spec-manager
npm install
npm run build
npm install -g .

# Or run without installing
npx spec-manager <command>
```

## AI Agent Setup

spec-manager is agent-agnostic: the CLI stores the source of truth locally, and AI tools only need project instructions that enforce the workflow. Built-in setup supports Claude Code, Codex, OpenCode, CodeBuddy, and other `AGENTS.md`-compatible agents.

### Recommended

```bash
cd my-project
spec-manager project init --name my-project
spec-manager project agents --provider all
```

This writes:

| Provider | Files |
|---|---|
| Claude Code | `CLAUDE.md`, `.claude/skills/spec-manager/` |
| Codex | `AGENTS.md` |
| OpenCode | `AGENTS.md` |
| CodeBuddy | `CODEBUDDY.md`, `.codebuddy/skills/spec-manager/` |

Use a narrower install when needed:

```bash
spec-manager project agents --provider codex,opencode
spec-manager project agents --provider codebuddy --force
```

References: [Codex `AGENTS.md`](https://github.com/openai/codex/blob/main/docs/agents_md.md), [OpenCode rules](https://opencode.ai/docs/rules/), [CodeBuddy skills](https://www.codebuddy.ai/docs/cli/skills).

### Manual install

If you do not want to use the installer, copy the templates directly:

```bash
# Codex / OpenCode / AGENTS.md-compatible tools
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
spec-manager spec confirm <l3-code>
spec-manager spec freeze <l3-code>                    # frozen → can create task

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

# validate the planJson before committing to the L3
spec-manager spec validate-plan /tmp/jwt-plan.json

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

L3 needs two confirmations: `spec confirm auth-L3.1.1-jwt`, then `spec freeze auth-L3.1.1-jwt`. `frozen` is the prerequisite for creating an Agent Task.

### 6. Create and run the Agent Task

```bash
spec-manager task create auth-L3.1.1-jwt --plan /tmp/jwt-plan.json --auto-confirm
# → outputs: taskId T-001, file specs/auth/tasks/auth-L3.1.1-jwt-T-001.json

spec-manager task start T-001 --spec auth-L3.1.1-jwt
# step 1
spec-manager task step T-001 --spec auth-L3.1.1-jwt --no 1 --type mcp_tool --name "Context gathering" \
  --status succeeded --output-json '{"summary":"read L2 + L1","read":["auth-L2.1"]}' --latency 1200
# ... repeat for each step

spec-manager task complete T-001 --spec auth-L3.1.1-jwt
# → L3 status: frozen → implemented
# → if all L3 children of L2 are implemented: L2 cascades to implemented
# → if all L2 children of L1 are implemented: L1 cascades to implemented
```

`task step` is the per-step report (with required `outputJson` per R15); `task complete` triggers the cascade — it never goes the other way (R2).

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

## Common commands

| Command | What it does |
|---|---|
| `spec-manager project init --name X` | Initialize `.spec-manager/` |
| `spec-manager project status` | Project overview (specs by level, recent activity) |
| `spec-manager spec list [--level L1] [--topic X] [--status draft]` | List specs (filterable) |
| `spec-manager spec show <code> [--include-content]` | View spec; default is narrow (metadata only, R19) |
| `spec-manager spec update <code> --content F --ai-summary S --change-summary R` | Write spec body |
| `spec-manager spec confirm \| freeze \| implement <code>` | Advance status (human-triggered) |
| `spec-manager spec validate <code>` | Re-run warning-only validation |
| `spec-manager spec add-relation <code> --target T --type based_on\|supersedes\|implements\|references` | Cross-spec reference |
| `spec-manager task create \| start \| step \| complete \| fail \| list \| show` | Agent Task lifecycle |
| `spec-manager decision create \| list \| show \| update \| set-partial \| supersede \| delete` | Decision cards (R18) |
| `spec-manager change new \| archive \| list \| show` | Delta spec workflow |
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
│   ├── <L1-code>-<date>.md
│   ├── <L2-code>-<date>.md
│   ├── <L3-code>[-desc]-<date>.md
│   ├── decisions/               # R18: L1 implemented → decision cards
│   │   └── DC-001.md
│   └── tasks/                   # R3: L3 frozen → agent tasks
│       └── <specCode>-T-001.json
├── changes/<name>/
│   ├── proposal.md
│   ├── deltas/<code>.md
│   └── specs/<topic>/<code>/<code>.md  # ADDED placeholder
└── archive/<name>/               # merged changes
```

Spec codes follow `<topic>-L<N>[.<M>][-desc]` (e.g. `auth-L1`, `auth-L2.1`, `auth-L3.1.1-jwt`): the code self-documents the hierarchy — no need to trace parent directories. `spec new` auto-generates the code when `--code` is omitted. Use `--desc` to add a ≤15 char suffix for readability.

## Documentation

- [docs/methodology.md](docs/methodology.md) — the public-facing methodology
- [docs/commands.md](docs/commands.md) — full CLI reference

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
- **Atomic file writes** (temp + rename) prevent half-written specs
- **Narrow view by default** (`spec show` returns metadata only, R19) — saves context
- **Warning-only validation** — never throws on content quality issues (per R22, R13); R22 blocks confirm/freeze if content is still placeholder
- **Local rule audit** — JSON file with at-least-once pending queue (no network to fail)
- **No DAG, strict tree** — L1→L2→L3→Task linear; delta changes are separate concept

## License

MIT
