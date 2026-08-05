## 1. OpenSpec

- [x] 1.1 Create proposal for secondary tag suggestions.
- [x] 1.2 Define behavior spec for deriving, ranking, and appending tag suggestions.
- [x] 1.3 Define lightweight frontend design and non-goals.

## 2. Implementation

- [x] 2.1 Add reusable frontend utilities to parse record tags, rank project-specific suggestions before general suggestions, and append tags without duplicates.
- [x] 2.2 Pass historical records into the daily `RecordForm` without changing existing submit behavior.
- [x] 2.3 Render compact clickable suggestion chips below the secondary tag input.
- [x] 2.4 Keep manual tag entry unchanged and preserve existing comma-separated storage.

## 3. Verification

- [x] 3.1 Add focused tests for tag parsing, ranking, duplicate prevention, and form structure.
- [x] 3.2 Run OpenSpec strict validation.
- [x] 3.3 Run focused frontend tests plus the existing test suite/typecheck/build needed to confirm the app still runs.
