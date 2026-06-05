# spec-manager Workflow Capsule

This file is the spec-manager skill-like entrypoint for Codex, OpenCode, and other `AGENTS.md`-compatible tools. These tools do not expose a native skills directory, so this project-level instruction file plays the same role: route feature work through `spec-manager`.

This project uses `spec-manager` for local-first spec-driven development. Specs, tasks, decisions, changes, and audit data are stored as markdown/JSON files in the repository.

## Mandatory Workflow

- Feature work MUST go through `spec-manager`; do not jump directly from a user request to implementation code.
- New or non-trivial work follows L1 PRD -> L2 Design -> L3 Impl -> Agent Task.
- Never write implementation code unless the relevant L3 spec is `frozen`.
- `draft -> confirmed` and `confirmed -> frozen` are user review actions. After writing spec content, stop and wait for explicit user approval.
- Before creating a new spec, inspect existing specs and decisions with `spec-manager spec list` and `spec-manager decision list --topic <topic>`.
- Before code edits, read the relevant frozen L3 spec and create/start an Agent Task.
- Record execution with `spec-manager task step`; finish with `spec-manager task complete`.

## Common Commands

```bash
spec-manager project status
spec-manager spec list
spec-manager spec show <code> --include-content
spec-manager decision list --topic <topic>
spec-manager task list --topic <topic>
```

When the user asks for `/spec-manager <request>` or asks to use spec-manager, treat it as a request to follow this workflow.
