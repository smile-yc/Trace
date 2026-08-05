## Context

The daily record form already stores secondary tags as a single free-text `tags` field on `WorkRecord`. Existing search, report, and ledger behavior read that text directly, so this change should improve input ergonomics without changing the data model.

## Goals / Non-Goals

**Goals:**
- Keep secondary tags optional and editable as free text.
- Parse historical tags from existing records and show lightweight suggestions in the daily record form.
- Prefer tags from the currently selected project when a project is selected.
- Avoid duplicate tags when a suggestion is selected.
- Preserve existing record storage, APIs, exports, and report behavior.

**Non-Goals:**
- No database migration or new tag table.
- No global tag management page.
- No mandatory taxonomy or forced normalization beyond trimming and duplicate prevention.
- No change to workload, project, or report calculations.

## Decisions

### Decision 1: Build suggestions client-side from loaded records

The daily page already receives the current record list, and the form can use that data to derive suggestions. This avoids a new backend endpoint and keeps the feature responsive for a small personal dataset.

Alternative considered: add an API such as `/api/tag-suggestions`. That would centralize logic but adds backend surface area for behavior that can be computed locally from already loaded data.

### Decision 2: Preserve free-text tag storage

The `tags` value remains a comma-separated text field. Suggestion clicks only append text to the existing input.

Alternative considered: convert tags into a normalized array or table. That would be cleaner long term, but it is larger than this usability enhancement and risks affecting exports and filters.

### Decision 3: Rank project tags before general tags

When `projectId` is selected, suggestions from matching historical records should appear first. Remaining suggestions can be ranked by frequency and recency.

Alternative considered: only show project-specific suggestions. That would be too sparse for new projects or mixed work.

### Decision 4: Keep UI compact

Suggestions should appear as small clickable chips below the secondary tag input. The form should remain quick to scan and should not introduce a heavy dropdown or modal.

Alternative considered: replace the input with a full multi-select. That adds more interaction cost than the daily capture workflow needs.

## Risks / Trade-offs

- [Risk] Historical typo variants may appear as separate suggestions. -> Mitigation: trim values and de-duplicate case-insensitively while preserving the first readable label.
- [Risk] Too many tags may clutter the form. -> Mitigation: show a small capped list and prefer relevant/frequent/recent tags.
- [Risk] Client-side derivation could become expensive with very large datasets. -> Mitigation: memoize suggestions and keep parsing simple.
