# Spec-Driven Development

This project uses `spec-manager` via the `/spec-manager` skill.

- All feature work MUST go through `/spec-manager`; no direct code changes for non-trivial work.
- Never write implementation code without a frozen L3 spec.
- Never skip human review gates. L1, L2, and L3 each require explicit user approval.
- Status transitions (`confirm` and `freeze`) are user actions, not AI actions.
- For research, prefer `spec-manager spec show` metadata first, then `--include-content` when full context is required.

Use the installed `.claude/skills/spec-manager/` skill when the user invokes `/spec-manager` or approves the next spec-manager step.
