# Trace Stage 2 Outcome Management Design

Date: 2026-07-14

Status: Approved through the confirmed top-level product design.

## Purpose

Stage 2 closes the chain from work input to project output. It replaces the narrow knowledge-asset model with one outcome model for formal deliverables, important problem resolutions, stage progress, and reusable assets.

## Product Rules

- Outcome types are `deliverable`, `problem_resolution`, `stage_progress`, and `reusable_asset`.
- Lifecycle states are `planned`, `in_progress`, `stage_result`, and `completed`.
- Archiving is independent from lifecycle state.
- A project is optional so non-project outcomes remain supported.
- An outcome can link to multiple work records, abilities, and milestones.
- Work hours and raw workload are derived from distinct linked records and are never edited on the outcome.
- Cross-outcome totals deduplicate shared records.
- Attachments and external links are not stored.
- Existing knowledge assets migrate once to reusable assets. Their title, summary, source record, project snapshot, product, tags, remark, and timestamps are preserved; legacy links remain only in the old table.

## Data Model

`outcomes` stores identity, type, state, dates, project identity and snapshot, background/goal, completed work, value/impact, personal role/contribution, report wording, product, tags, remark, archive state, and timestamps.

Relation tables store outcome-to-record, outcome-to-ability, and outcome-to-milestone links. `outcome_status_history` records every lifecycle transition with time and optional note.

Project merges move outcome project identity to the target while retaining the original project-name snapshot. Record deletion removes only its relation to an outcome. Project deletion remains unsupported.

## API

- `GET /api/outcomes` supports type, status, project, year, archive, and keyword filters.
- `GET /api/outcomes/:id` returns the outcome, linked records, abilities, milestones, status history, and deduplicated input totals.
- `POST /api/outcomes` creates an outcome and its relations transactionally.
- `PUT /api/outcomes/:id` updates details and replaces supplied relations transactionally.
- `POST /api/outcomes/:id/archive` and `/reactivate` manage archive state.
- Project summaries include associated outcomes.
- Export payloads include outcomes in the selected period or scope.

The legacy knowledge-asset endpoints remain read-compatible during Stage 2 but the frontend stops creating new legacy assets.

## Frontend

The Outcomes page provides compact filters, useful period totals, a create/edit form, and a scannable list. Project and record choices are searchable. Selecting records can infer the project, product, tags, and abilities without overwriting user edits.

Daily work and the ledger provide a prefilled "Create outcome" entry. Project details show linked outcomes and allow project-prefilled creation. Weekly, monthly, and yearly pages show period outcomes alongside work input; annual and monthly review text uses confirmed source data rather than inventing personal judgments.

## Validation

- Title is required; date ranges must be valid.
- Linked project, records, abilities, and milestones must exist.
- Linked project records must not silently change the outcome project.
- Status changes append history; ordinary edits do not.
- Migration is transactional, idempotent, and preserves legacy counts and original work totals.
- Tests cover fresh and legacy databases, API lifecycle, deduplication, project merge behavior, reporting, and exports.
