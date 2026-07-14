# Trace Stage 2 Outcome Management Implementation Plan

Date: 2026-07-14

Design: `docs/superpowers/specs/2026-07-14-outcome-management-design.md`

## Tasks

1. Add failing migration and repository tests for outcomes, relation tables, status history, knowledge-asset migration, and deduplicated totals.
2. Add backend outcome contracts and migration `2026071402`, then implement transactional repository operations and project merge handling.
3. Add failing API tests, then implement filtered CRUD, detail, archive/reactivate, validation, and project summary integration.
4. Add frontend contracts, API client, filtering and period-summary helpers with unit tests.
5. Replace the knowledge-asset page with the outcome workspace; add searchable project/record linking and full create/edit/archive flows.
6. Add prefilled creation entry points from daily work, the ledger, and project details.
7. Integrate outcomes into week/month/year reviews and Word/PDF/Excel exports, with source-period and shared-record deduplication tests.
8. Update requirements, architecture, and README to mark Stage 2 complete and document the compatibility boundary.
9. Run `pnpm run test`, `pnpm run typecheck`, and `pnpm run build`; then verify desktop and mobile flows in the local browser.
10. Commit scoped changes, fast-forward local `main`, rerun verification, and leave GitHub untouched.
