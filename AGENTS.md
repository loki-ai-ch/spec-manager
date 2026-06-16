# spec-manager Workflow Capsule

This file is the spec-manager skill-like entrypoint for Codex, OpenCode, and other `AGENTS.md`-compatible tools. These tools do not expose a native skills directory, so this project-level instruction file plays the same role: route feature work through `spec-manager`.

This project uses `spec-manager` for local-first spec-driven development. Specs, tasks, decisions, changes, and audit data are stored as markdown/JSON files in the repository.

## Mandatory Workflow

- Feature work MUST go through `spec-manager`; do not jump directly from a user request to implementation code.
- New or non-trivial work follows L1 PRD -> L2 Design -> L3 Impl -> Agent Task.
- Never write implementation code unless the relevant L3 spec is `frozen`.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval advances `draft -> frozen`. After writing spec content, stop and wait for approval.
- Before creating a new spec, inspect existing specs and decisions with `spec-manager spec list` and `spec-manager decision list --topic <topic>`.
- Before code edits, read the relevant frozen L3 spec and create/start an Agent Task.
- If adaptive workflow is enabled, Task creation records a `standard` or `governed` Profile snapshot; `governed` requires the frozen L3 to declare `## 关键验收标准` with valid AC IDs, and task complete requires successful verification evidence covering every critical AC. `standard` reports missing coverage as warnings. Use `spec-manager project profile recommend --request "<work>"` for a deterministic, explainable recommendation; it does not auto-enable adaptive workflow and is not a hidden gate. Use `spec-manager project profile metrics [--topic <topic>] [--json]` for a read-only governance report over Profile adoption, governed coverage gaps, standard warnings, and explicit overrides; metrics does not modify config or historical Tasks. Use `spec-manager project readiness critical [--topic <topic>] [--json]` for a read-only critical AC readiness report and repair suggestions; it must not auto-generate or insert critical AC. Before enabling adaptive workflow, use `spec-manager project workflow preview [--json]` for a read-only adoption preview; preview does not write config, migrate historical Tasks, or act as an enable gate.
- `quick` remains a restricted lightweight exception and does not create the full L1/L2/L3/Task chain.
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
