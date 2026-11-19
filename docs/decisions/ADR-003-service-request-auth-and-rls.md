# ADR-003: Service Request Authentication Policy & PostgreSQL RLS Role Model

- **Status**: Accepted (Round 1 Security Hardening)
- **Date**: 2026-11-19

## 1. Context & Problem Statement

1. **Service Requests (`POST /api/service-requests` — Fix B3)**:
   Previously, `POST /api/service-requests` accepted unauthenticated requests and immediately marked fixed-price services (`SRV-YOUSEF-REVIEW`, 95 KWD) as `paid: true`, `status: 'in_progress'`, and wrote fake revenue rows into `revenue_ledger` and `invoices` without payment verification.
2. **Row-Level Security (`G3`)**:
   PostgreSQL table owners bypass standard `ENABLE ROW LEVEL SECURITY` unless `FORCE ROW LEVEL SECURITY` or a dedicated non-owner runtime role is used.

## 2. Decisions

### Decision A: Require Authentication on `POST /api/service-requests`
- `POST /api/service-requests` now requires an authenticated session (`401 Unauthorized` when unauthenticated) and enforces shared PostgreSQL rate limiting (`10` requests / 15 minutes per user).
- Every newly created service request is persisted with `status = 'new'` and `paid = false`.
- Fixed-price services create a server-side `billing_checkout_sessions` record and return a `checkoutUrl` / `checkoutSessionId`. Only a cryptographically verified webhook (`POST /api/billing/webhook`) transitions `service_requests.paid` to `true`, updates `status` to `'in_progress'`, and records `revenue_ledger` + `invoices` inside a single database transaction.
- Any `projectId` attached to a service request is verified against `can(actor, 'project:read', ...)` so a user can never attach another tenant's project.
- **Founder Confirmation Note**: Requiring authentication before submitting specialist quote/review requests prioritizes financial and CRM integrity over anonymous lead capture. Listed in `docs/reports/fix-round-1.md` for founder confirmation in case an unauthenticated lead-only intake form (with CAPTCHA and strict email verification) is desired in V2.

### Decision B: PostgreSQL RLS Runtime vs Admin Roles
- Cloud SQL provides two distinct PostgreSQL roles:
  - `SQL_ADMIN_USER` (`ai_studio_admin`): table owner, used strictly for schema migrations (`npm run db:migrate`) and scheduled retention jobs.
  - `SQL_USER` (`ai_studio_app_user`, `rolsuper = false`, `rolbypassrls = false`, non-owner): used by the Express application runtime pool (`src/db/index.ts`).
- Because `ai_studio_app_user` is neither superuser nor table owner, standard `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` strictly enforces tenant policies (`current_setting('app.user_uid', true)` and `current_setting('app.org_id', true)`) on application queries while allowing administrative maintenance via the admin connection.
