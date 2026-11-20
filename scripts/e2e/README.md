# Browser checks (Playwright, run on demand)

They need a running site; none of them run in CI.

| Script | What it checks | Usage |
|---|---|---|
| `e2e.cjs` | Pages, search to result, demo login, language and dark mode, a full practice scenario, DOCX export, accessibility | `BASE=https://wijaha.web.app node scripts/e2e/e2e.cjs ./shots` |
| `vtest.cjs` | The visual library: PNG/SVG export, animation, Arabic and English, axe | `node scripts/e2e/vtest.cjs https://wijaha.web.app` |
| `rtest.cjs` | Visual aids inside real results (reception path, majlis plan, share card) | `BASE=https://wijaha.web.app node scripts/e2e/rtest.cjs` |
| `cardfit.cjs` | The share card never overflows with long Arabic or English text | `BASE=http://127.0.0.1:5199 node scripts/e2e/cardfit.cjs` (Vite dev server) |
