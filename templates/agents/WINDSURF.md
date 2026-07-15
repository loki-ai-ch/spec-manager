# spec-manager Workflow Capsule

This file is the spec-manager entrypoint for Windsurf. Windsurf reads project rules from `.windsurfrules`; route feature work through `spec-manager`.

This project uses `spec-manager` for spec-driven AI coding workflows. Specs, tasks, decisions, changes, and audit data are stored as markdown/JSON files in the repository.

## Unified Rules

- Feature work MUST go through `spec-manager`.
- New or non-trivial work follows L1 -> L2 -> L3 -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval (an explicit user approval) advances `draft -> frozen`.
- For new or non-trivial work, start with `spec-manager next "<work>"` to identify the safe next step, or `spec-manager brief "<work>"` to collect local context, lessons, risks, and the next command.
- Before writing any spec/task/decision, check `spec-manager project context --json` or `spec-manager dashboard --json` and confirm the resolved `writeRoot`; external `specStore.path` means writes go to that specs root, while `contextSources` are read-only.
- During execution use `spec-manager assist next <taskId> --spec <L3-code>` / `spec-manager assist drift <taskId> --spec <L3-code>` when useful; before final handoff use `spec-manager assist acceptance <taskId> --spec <L3-code>`, then `spec-manager assist delivery <taskId> --spec <L3-code>`.
- Before code edits, read the frozen L3 spec and create/start an Agent Task.
- When the user asks to "confirm and run", "create and execute the task", "continue executing this L3", or uses equivalent wording, prepare an explicit planJson file and use `spec-manager task run <L3-code> --plan <planFile>`.
- When the user only asks to confirm/freeze an L3 or gives `spec-manager spec confirm <L3-code>`, only run `spec-manager spec confirm <L3-code>` and stop; do not create a task automatically.
- planJson `coveredSpecs` MUST include the current L3 specCode.
- If adaptive workflow is enabled, Task creation records a `standard` or `governed` Profile snapshot; `governed` requires the frozen L3 to declare `## 关键验收标准` with valid AC IDs, and task complete requires successful verification evidence covering every critical AC. `standard` reports missing coverage as warnings. Use `spec-manager project profile recommend --request "<work>"` for a deterministic, explainable recommendation; it does not auto-enable adaptive workflow and is not a hidden gate. Use `spec-manager project profile metrics [--topic <topic>] [--json]` for a read-only governance report over Profile adoption, governed coverage gaps, standard warnings, and explicit overrides; metrics does not modify config or historical Tasks. Use `spec-manager project readiness critical [--topic <topic>] [--json]` for a read-only critical AC readiness report and repair suggestions; it must not auto-generate or insert critical AC. Before enabling adaptive workflow, use `spec-manager project workflow preview [--json]` for a read-only adoption preview; preview does not write config, migrate historical Tasks, or act as an enable gate.
- `quick` remains a restricted lightweight exception and does not create the full L1/L2/L3/Task chain.
- Validate L3 markdown plans with `spec-manager spec validate-plan --from-spec <L3-code>`.
- Record execution with `spec-manager task step`; finish with `spec-manager task complete`.

## Common Commands

```bash
spec-manager project status
spec-manager project context --json
spec-manager project store doctor
spec-manager next "<work>"
spec-manager brief "<work>"
spec-manager assist acceptance <taskId> --spec <L3-code>
spec-manager assist delivery <taskId> --spec <L3-code>
spec-manager spec list
spec-manager spec show <code> --include-content
spec-manager decision list --topic <topic>
spec-manager task list --topic <topic>
```

When the user asks for `/spec-manager <request>` or asks to use spec-manager, treat it as a request to follow this workflow.
