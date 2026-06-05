# Changelog

## [0.1.0] - 2026-06-05

Initial release.

### Added

- Four-layer spec funnel: L0 (vision) → L1 (PRD) → L2 (design) → L3 (implementation)
- Status machine: `draft → confirmed → frozen → implemented`
- 24 governance rules with `applies_to` filtering
- Agent Task lifecycle: `create → start → step → complete`
- Decision cards with `what/why/affectedCriteria` and topic query
- Delta spec support (OpenSpec-style `changes/<name>/`)
- Multi-agent setup: Claude Code, Codex, OpenCode, CodeBuddy
- CLI commands: `spec`, `task`, `decision`, `change`, `incident`, `audit`, `project`, `flow`
- Rule audit with local JSON accumulator
- RFC 2119 keyword validation in acceptance criteria
