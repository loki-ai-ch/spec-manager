# Spec-Driven Development

This repository uses `spec-manager`. CodeBuddy should follow the same workflow as `AGENTS.md` and use spec-manager commands for non-trivial work.

- All feature work should go through `spec-manager`.
- New work follows L1 PRD -> L2 Design -> L3 Impl -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- `confirm` and `freeze` are user review actions.
- If adaptive workflow is enabled, Task creation records a `standard` or `governed` Profile snapshot; `governed` requires the frozen L3 to declare `## 关键验收标准` with valid AC IDs, and task complete requires successful verification evidence covering every critical AC. `standard` reports missing coverage as warnings. Use `spec-manager project profile recommend --request "<work>"` for a deterministic, explainable recommendation; it does not auto-enable adaptive workflow and is not a hidden gate. Use `spec-manager project profile metrics [--topic <topic>] [--json]` for a read-only governance report over Profile adoption, governed coverage gaps, standard warnings, and explicit overrides; metrics does not modify config or historical Tasks. Use `spec-manager project readiness critical [--topic <topic>] [--json]` for a read-only critical AC readiness report and repair suggestions; it must not auto-generate or insert critical AC. Before enabling adaptive workflow, use `spec-manager project workflow preview [--json]` for a read-only adoption preview; preview does not write config, migrate historical Tasks, or act as an enable gate.
- `quick` remains a restricted lightweight exception and does not create the full L1/L2/L3/Task chain.

## Commands

```bash
npm run build
npm run lint
npm test
spec-manager project status
```

Use `src/cli/` for command registrations and `src/core/` for business logic.
