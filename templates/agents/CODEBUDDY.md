# Spec-Driven Development

This project uses `spec-manager` for local-first spec-driven development. CodeBuddy should use the project skill at `.codebuddy/skills/spec-manager/` when the user asks for `/spec-manager` or asks to follow the spec-manager workflow.

## Rules

- Feature work MUST go through `spec-manager`; avoid direct code edits for non-trivial work.
- New or non-trivial work follows L1 PRD -> L2 Design -> L3 Impl -> Agent Task.
- Never write implementation code unless the relevant L3 spec is `frozen`.
- `confirm` and `freeze` are user review actions. Stop after writing spec content and wait for explicit approval.
- Before creating a new spec, inspect existing specs and decisions.
- Before code edits, read the relevant frozen L3 spec and create/start an Agent Task.
- Record each execution step with `spec-manager task step`; complete with `spec-manager task complete`.

## Useful Commands

```bash
spec-manager project status
spec-manager spec list
spec-manager spec show <code> --include-content
spec-manager decision list --topic <topic>
spec-manager task list --topic <topic>
```
