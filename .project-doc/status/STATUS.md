# Status

Updated: 2026-11-14

## Phase

P6 Web app complete on `feature/p6-web-app` (not yet merged). Next: P7 Hardening and delivery.

## Done

- Records, PRD and phases; P0 to P5 merged into `dev`
- P6: Next.js app (login, dashboard, doctors, doctor detail, patients), owned API proxy, `proxy.ts` auth gate with refresh and nonce CSP, TanStack Query with server prefetch, URL state, deferred optimistic delete with Undo, calm 429 and 503 states
- API additions: `GET /doctors/facets`; rate limits raised (D-67)
- Gate: `make check` green; `make test-integration` 99 passed; web unit tests 38 passed; Playwright J1 to J5, rate-limited sign-in, overflow and axe pass at 390 and 1440 (16 of 16)

## Next

- Merge the P6 PR into `dev`
- P7: seed 10k doctors and 100k patients, explain checks at scale, Lighthouse, security pass, VPS deploy, README with screenshots, `.env.example`

## Blockers

None.
