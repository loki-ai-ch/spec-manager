# Spec-Driven Development

This project uses `spec-manager` for local-first spec-driven development. CodeBuddy should use the project skill at `.codebuddy/skills/spec-manager/` when the user asks for `/spec-manager` or asks to follow the spec-manager workflow.

## Unified Rules

- Feature work MUST go through `spec-manager`.
- New or non-trivial work follows L1 -> L2 -> L3 -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval (an explicit user approval) advances `draft -> frozen`.
- Before creating a new spec, inspect existing specs and decisions.
- Before code edits, read the frozen L3 spec and create/start an Agent Task.
- planJson `coveredSpecs` MUST include the current L3 specCode.
- Validate L3 markdown plans with `spec-manager spec validate-plan --from-spec <L3-code>`.
- Record execution with `spec-manager task step`; finish with `spec-manager task complete`.

## Useful Commands

```bash
spec-manager project status
spec-manager spec list
spec-manager spec show <code> --include-content
spec-manager decision list --topic <topic>
spec-manager task list --topic <topic>
```
