---
name: spec-manager
description: Spec-driven project iteration workflow: L1 PRD -> L2 Design -> L3 Impl -> Agent Task, with human review gates at each layer.
allowed-tools: Read, Write, Grep, Glob, Bash(spec-manager:*), Bash(git:*)
---

# spec-manager

Use this skill when the user invokes `/spec-manager`, asks for a new feature, PRD, technical design, implementation spec, agent task, iteration plan, test plan, release notes, runbook, postmortem, ADR, or delta change.

## Entry Points

- `/spec-manager <request>` — start from the user's requirement and route to the right subskill.
- `/spec-manager run <taskId>` — execute an existing Agent Task.

## Route Table

| Signal | Subskill |
|---|---|
| typo / one-line edit / log level | [subskills/quick.md](subskills/quick.md) |
| inspect / list / search / stats | [subskills/research.md](subskills/research.md) |
| requirement / new feature / user story | [subskills/prd.md](subskills/prd.md) |
| technical plan / architecture / API design | [subskills/design.md](subskills/design.md) |
| implementation / coding / planJson | [subskills/impl.md](subskills/impl.md) |
| plan / milestone / schedule | [subskills/plan.md](subskills/plan.md) |
| test plan / QA / cases | [subskills/testplan.md](subskills/testplan.md) |
| release / changelog | [subskills/release.md](subskills/release.md) |
| runbook / oncall | [subskills/runbook.md](subskills/runbook.md) |
| postmortem / RCA | [subskills/postmortem.md](subskills/postmortem.md) |
| ADR / why choose X | [subskills/adr.md](subskills/adr.md) |
| delta / change / increment | [subskills/change.md](subskills/change.md) |

If intent is unclear, ask the user one concise clarification question before taking action.

## Hard Rules

- Do not write implementation code without a frozen L3 spec.
- Stop after writing L1/L2/L3 content and wait for explicit user approval.
- Status transitions (`confirm` and `freeze`) are user actions.
- Agent Tasks can only be created from frozen L3 specs.
- Before code edits, read the relevant spec and inspect the actual source files.

## Bundled References

- Rules: [rules/](rules/)
- Templates: [templates/](templates/)
