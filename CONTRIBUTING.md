# Contributing to spec-manager

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/loki-ai-ch/spec-manager.git
cd spec-manager
npm install
```

## Commands

```bash
npm run build        # Compile TypeScript → dist/
npm run lint         # Type-check only (tsc --noEmit)
npm test             # Run all tests
npm run test:watch   # Watch mode
```

## Project Structure

- `src/cli/` — Commander.js command registrations
- `src/core/` — Business logic (spec IO, validation, status machine, audit)
- `src/schemas/` — Zod schemas
- `templates/` — Markdown templates for specs and agent setup
- `rules/` — Governance rules as markdown with YAML frontmatter

## Submitting Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Ensure `npm run lint`, `npm run build`, and `npm test` all pass.
4. Submit a pull request.

## Commit Messages

Use clear, descriptive commit messages. Conventional commits are welcome but not required.

## Reporting Issues

Use the [GitHub issue tracker](https://github.com/loki-ai-ch/spec-manager/issues). Please use the issue templates provided.
