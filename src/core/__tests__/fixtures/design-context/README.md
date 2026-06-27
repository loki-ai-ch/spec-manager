# Design Context Conformance Fixtures

These fixtures are a small, vendored compatibility set for the spec-manager
DESIGN.md parser, linter, exporter, and diff helpers. Tests must read these
files from this repository only; they must not depend on a sibling checkout of
`/Users/loki/code/github/design.md`.

## Sources

- `examples/paws-and-paths.md` from
  `/Users/loki/code/github/design.md/examples/paws-and-paths/DESIGN.md`
- `examples/atmospheric-glass.md` from
  `/Users/loki/code/github/design.md/examples/atmospheric-glass/DESIGN.md`
- `examples/totality-festival.md` from
  `/Users/loki/code/github/design.md/examples/totality-festival/DESIGN.md`
- `parity/heritage.md` from
  `/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures/HERITAGE.md`
- `parity/alpine-observatory.md` from
  `/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures/ALPINE_OBSERVATORY.md`
- `invalid/no-frontmatter.md` from
  `/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures/NO_FRONTMATTER.md`
- `invalid/out-of-order.md` from
  `/Users/loki/code/github/design.md/packages/cli/src/linter/fixtures/OUT_OF_ORDER.md`
- `invalid/broken-ref.md`, `invalid/bad-schema.md`, and `parity/diff-*.md`
  are local spec-manager parity fixtures.

## Selection Rules

- Keep the set small and stable; do not vendor the full upstream repository.
- Prefer assertions over key fields and finding identities instead of large
  snapshots.
- Add local parity fixtures when spec-manager has behavior that upstream
  examples do not isolate.
- Update this README when replacing a copied upstream fixture.

