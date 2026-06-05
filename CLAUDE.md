# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Spec-Driven Development — No Vibe Coding

This project uses spec-driven development via `/spec-manager`.

- All feature work MUST go through `/spec-manager` — no direct code changes
- Never write implementation code without a frozen L3 spec
- Never skip human review gates — each layer (L1/L2/L3) requires explicit user approval
- Status transitions (confirm/freeze) are user actions, not AI actions

## Build & Test Commands

```bash
npm run build        # tsc → dist/
npm run lint         # tsc --noEmit (type-check only)
npm test             # vitest run
npm run test:watch   # vitest watch mode
npx vitest run src/core/__tests__/validate.test.ts   # run a single test file
```

The project requires Node >= 18 and uses ESM (`"type": "module"`). TypeScript target is ES2022 with strict mode.

## Architecture

Local-first spec-driven development CLI. Pure markdown + YAML frontmatter storage. No database, no network.

### Source Layout

- `src/cli/` — Commander.js command registrations (one file per domain: spec, task, decision, audit, change, incident, dict, project)
- `src/core/` — Business logic: spec IO, validation, status machine, frontmatter parsing, audit, paths, constants
- `src/schemas/` — Zod schemas for spec frontmatter, plan JSON, decision input
- `templates/` — Markdown templates for L0/L1/L2/L3 specs, proposals, decisions, incidents
- `rules/` — 24 governance rules as markdown with YAML frontmatter (`applies_to` filtering)
- `skill/` — Claude Code skill (`SKILL.md` + 12 subskills in `subskills/`)

### Key Patterns

- **Spec hierarchy**: L0 (vision) → L1 (PRD) → L2 (design) → L3 (implementation). Codes are dotted: `auth-L1`, `auth-L2.1`, `auth-L3.1.1-jwt`. The code self-documents the tree.
- **Status machine**: `draft → confirmed → frozen → implemented → archived`. Only `task complete` triggers `frozen → implemented`. User actions handle `draft → confirmed` and `confirmed → frozen`.
- **Atomic writes**: `writeSpec` writes to a temp file then renames — prevents half-written specs under concurrency.
- **Mtime cache**: `listAllSpecs` caches parsed frontmatter by file mtime. Call `invalidateSpecCache()` after external mutations.
- **Zod validation**: `SpecFrontmatterSchema` and `PlanJsonSchema` in `src/schemas/spec.ts` define the canonical shape. Frontmatter is parsed with `gray-matter`.
- **Warning-only validation**: Content quality checks (R22 placeholder detection, RFC 2119 keywords) emit warnings but never throw. R22 blocks `confirm`/`freeze` if content is still placeholder.

### Testing

Tests live in `src/core/__tests__/*.test.ts`. They use vitest and test against real filesystem operations (temp dirs). No mocking of the spec IO layer.

## Conventions

- All source is TypeScript with strict null checks and `noUnusedLocals`/`noUnusedParameters`.
- Constants (magic numbers) are centralized in `src/core/constants.ts`.
- CLI commands are registered via `registerX(program)` pattern in each `src/cli/*.ts` file, called from `src/cli/index.ts`.
- The public API entry point (`src/index.ts`) re-exports from `src/core/` and `src/schemas/` for third-party/test use.
- Spec files use `.md` extension with YAML frontmatter parsed by `gray-matter`.
- Task files use `.json` extension.
- Comments and code are in a mix of Chinese and English.
