# Spec-Driven Development

This project uses `spec-manager` via the `/spec-manager` skill.

- Feature work MUST go through `spec-manager`.
- New or non-trivial work follows L1 -> L2 -> L3 -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval (an explicit user approval) advances `draft -> frozen`.
- For new or non-trivial work, generate an Agent Brief first with `spec-manager assist guide --request "<work>"` to collect local context, lessons, risks, and the next command.
- During execution use `spec-manager assist next <taskId> --spec <L3-code>` / `spec-manager assist drift <taskId> --spec <L3-code>` when useful; before final handoff use `spec-manager assist acceptance <taskId> --spec <L3-code>`, then `spec-manager assist delivery <taskId> --spec <L3-code>`.
- Before code edits, read the frozen L3 spec and create/start an Agent Task.
- planJson `coveredSpecs` MUST include the current L3 specCode.
- If adaptive workflow is enabled, Task creation records a `standard` or `governed` Profile snapshot; `governed` requires the frozen L3 to declare `## 关键验收标准` with valid AC IDs, and task complete requires successful verification evidence covering every critical AC. `standard` reports missing coverage as warnings. Use `spec-manager project profile recommend --request "<work>"` for a deterministic, explainable recommendation; it does not auto-enable adaptive workflow and is not a hidden gate. Use `spec-manager project profile metrics [--topic <topic>] [--json]` for a read-only governance report over Profile adoption, governed coverage gaps, standard warnings, and explicit overrides; metrics does not modify config or historical Tasks. Use `spec-manager project readiness critical [--topic <topic>] [--json]` for a read-only critical AC readiness report and repair suggestions; it must not auto-generate or insert critical AC. Before enabling adaptive workflow, use `spec-manager project workflow preview [--json]` for a read-only adoption preview; preview does not write config, migrate historical Tasks, or act as an enable gate.
- `quick` remains a restricted lightweight exception and does not create the full L1/L2/L3/Task chain.
- Validate L3 markdown plans with `spec-manager spec validate-plan --from-spec <L3-code>`.
- Record execution with `spec-manager task step`; finish with `spec-manager task complete`.
- For research, prefer `spec-manager spec show` metadata first, then `--include-content` when full context is required.

Use the installed `.claude/skills/spec-manager/` skill when the user invokes `/spec-manager` or approves the next spec-manager step.
