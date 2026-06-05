# Spec-Driven Development

This repository uses `spec-manager` for local-first spec-driven development.

- All feature work should go through `spec-manager`; avoid direct code changes for non-trivial work.
- New work follows L1 PRD -> L2 Design -> L3 Impl -> Agent Task.
- Never write implementation code without a frozen L3 spec.
- `confirm` and `freeze` are user review actions. Stop after writing spec content and wait for explicit approval.

## Build & Test

```bash
npm run build
npm run lint
npm test
npx vitest run src/core/__tests__/validate.test.ts
```

The project requires Node >= 18, ESM, TypeScript ES2022, and strict mode.

## Layout

- `src/cli/` - Commander.js command registrations
- `src/core/` - spec IO, validation, status machine, audit, paths
- `src/schemas/` - Zod schemas
- `templates/` - spec and agent instruction templates
- `rules/` - governance rules
- `skill/` - Claude/CodeBuddy-compatible spec-manager skill content
