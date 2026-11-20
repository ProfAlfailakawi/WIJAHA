# WIJAHA tools (all free, browser-side unless noted)

| Route | What it does | Where data lives | Honest limits |
|---|---|---|---|
| `/live` | Event-day run sheet (3 templates), live countdown, delay buttons, 7 emergency playbooks, fullscreen + wake lock | Nothing stored | Templates are generic; emergency steps are advisory |
| `/voice` | Scripted guest personas (sheikh, ambassador, angry guest) speak via browser speech synthesis; you answer by voice (browser speech recognition) or text; keyword rubric scores | Nothing stored | Scoring is a transparent keyword rubric, not AI and not an assessment of competence. Speech recognition depends on the browser |
| `/photo-check` | Guided checklist per photo type (hall, table, podium, invitation), pins on the photo, annotated PNG | Photo never leaves the browser | Review is manual; the photo is not analysed automatically (that would need paid vision AI) |
| `/org-protocol` | Load an organisation manual (.docx/.txt/.md or paste); lexical passage search that quotes the manual verbatim | `localStorage` only | Not a server-side enterprise tier: no sharing across users, no paraphrase, no PDF |
| `/learn`, `/verify/:code` | 6 modules, 15-question exam graded on the server, HMAC-signed certificate code, public verification page | Code is stateless (name, score, date inside the signed code) | No revocation list; issuing the same certificate again is possible by retaking; training certificate, not an accreditation. Rotating `SESSION_SECRET` invalidates old certificates |

Exam answer key: `src/server/certificate/certificate.ts` (never sent to the browser). Rate limits: 20 exam submissions/hour and 60 verifications/minute per IP.

Tests: `src/shared/tools/*.test.ts`, `src/server/certificate/certificate.test.ts`, browser suite `scripts/e2e/ttest.cjs`.

## Added later
- `/event`: one event file (name, type, date, venue, host, dress code, RSVP) produces the invitation text (Arabic/English, Hijri date approximate), a calendar `.ics` with two reminders, a readiness list, and a clash check against partners' national/religious days (partners chosen in the radar) and weekends. Stored in the browser only.
- `/live?t=<template>&s=<YYYY-MM-DDTHH:mm>`: shareable link. It carries the schedule at the moment of copying (including delays); it is not a live-synced session, so a later delay must be shared again.
- `/review`: honest content-review status page (which sets are approved, which are AI drafts awaiting an expert).
- Installable app (PWA): manifest, icons and a service worker; pages visited once open offline. API calls are never cached, so the exam and verification need a connection.
- Not built (costs money, needs an owner decision): AI photo analysis and an AI-driven conversational guest.
