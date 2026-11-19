# ADR-004: Database row-level security (G3) is deferred, with a concrete plan

**Status:** Accepted for now · **Date:** 2026-11-19

## Context
The fix-round asked for PostgreSQL Row Level Security as a second isolation layer behind the
application checks in `can()`. Tenant isolation is currently enforced in the application only, and is
covered by the isolation tests in `tests/security-regressions.test.ts` (test 1 and B2/B4/C1–C3).

The app uses one shared Drizzle `db` over a connection pool, connects as the table owner, and issues
queries from ~3,000 lines of route handlers. RLS only protects data if every request runs inside a
transaction that sets `app.org_id` / `app.user_uid` with `SET LOCAL`, and the app role is not the owner
and lacks `BYPASSRLS`. Retrofitting that across every handler in one pass would be a broad, risky change.

## Decision
Do not ship partial RLS that looks protective but is bypassed by the owner role. Keep application-level
isolation, keep it under test, and implement RLS as its own change.

## Plan (separate PR)
1. Add an `AsyncLocalStorage` request context and a `withTenant(tx => …)` helper that opens a transaction
   and runs `select set_config('app.org_id', $1, true), set_config('app.user_uid', $2, true)`.
2. Create a non-owner `wijaha_app` role without `BYPASSRLS`; migrations keep using the owner role.
3. Migration: `ENABLE` + `FORCE ROW LEVEL SECURITY` and policies on `projects`, `project_versions`,
   `results`, `queries`, `service_requests`, `invoices`, `subscriptions`, `simulation_runs`,
   `simulation_steps`, `shares`, `memberships`, `invitations`.
4. Move handlers to `withTenant`, highest-risk tables first.
5. Test: with `can()` stubbed to allow, cross-tenant reads still return zero rows.

## Consequences
Until then, a missed `can()` check in a new route is not caught by the database. The isolation test
suite is the safeguard, and new routes must be added to it.
