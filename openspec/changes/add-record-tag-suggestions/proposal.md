## Why

Daily records often reuse the same secondary tags across consecutive work on the same project or topic. Manually retyping those tags slows down quick daily capture and increases spelling/format inconsistency.

## What Changes

- Add lightweight secondary tag suggestions to the daily record form.
- Automatically derive suggestions from existing daily record `tags` values.
- Keep the tag field optional and editable; users can still type new tags manually.
- Let users click historical tags to append them to the current record without duplicates.
- Prefer project-related historical tags when the current record is associated with a project, while still allowing general suggestions.
- Do not change the stored record shape, workload calculation, report semantics, or existing tag text format.

## Capabilities

### New Capabilities
- `record-tag-suggestions`: Suggest reusable secondary tags for daily records based on historical record tags.

### Modified Capabilities

## Impact

- Frontend daily record form and supporting record utilities.
- Frontend tests for tag parsing, suggestion ranking, and form structure.
- No backend API or database migration required because existing `tags` text remains the source of truth.
