# Spec-Driven Development

This project uses `spec-manager` via the `/spec-manager` skill.

- Feature work MUST go through `spec-manager`.
- New or non-trivial work follows L1 -> L2 -> L3 -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- L1/L2 approval advances `draft -> confirmed`; one explicit L3 approval (an explicit user approval) advances `draft -> frozen`.
- Before code edits, read the frozen L3 spec and create/start an Agent Task.
- planJson `coveredSpecs` MUST include the current L3 specCode.
- Validate L3 markdown plans with `spec-manager spec validate-plan --from-spec <L3-code>`.
- Record execution with `spec-manager task step`; finish with `spec-manager task complete`.
- For research, prefer `spec-manager spec show` metadata first, then `--include-content` when full context is required.

Use the installed `.claude/skills/spec-manager/` skill when the user invokes `/spec-manager` or approves the next spec-manager step.
