# spec-manager Workflow Capsule

This file is the spec-manager entrypoint for Cursor. Cursor reads project rules from `.cursorrules`; route feature work through `spec-manager`.

This project uses `spec-manager` for local-first spec-driven development. Specs, tasks, decisions, changes, and audit data are stored as markdown/JSON files in the repository.

## Unified Rules

- Feature work MUST go through `spec-manager`.
- New or non-trivial work follows L1 -> L2 -> L3 -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval (an explicit user approval) advances `draft -> frozen`.
- Before code edits, read the frozen L3 spec and create/start an Agent Task.
- planJson `coveredSpecs` MUST include the current L3 specCode.
- Validate L3 markdown plans with `spec-manager spec validate-plan --from-spec <L3-code>`.
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
