# Spec-Driven Development

This repository uses `spec-manager`. CodeBuddy should follow the same workflow as `AGENTS.md` and use spec-manager commands for non-trivial work.

- All feature work should go through `spec-manager`.
- New work follows L1 PRD -> L2 Design -> L3 Impl -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- `confirm` and `freeze` are user review actions.

## Commands

```bash
npm run build
npm run lint
npm test
spec-manager project status
```

Use `src/cli/` for command registrations and `src/core/` for business logic.
