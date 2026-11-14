# Status

Updated: 2026-11-14

## Phase

P7 Hardening and delivery in progress on `feature/p7-hardening`.

## Done

- P0 to P6 merged into `dev`
- P7 measured at 10,024 doctors and 100,029 patients: 0 of 13 hot list queries use `COLLSCAN`; p95 of list endpoints 5 to 37 ms, dashboard 3 to 4 ms; Lighthouse accessibility 100 on login, dashboard, doctors, doctor detail and patients
- `make seed-scale`, `make explain-check`, `make load-check`, `make deploy` (Caddy overlay)
- Security probes on the running stack: CSP with nonce, frame, sniffing, referrer and permissions headers; httpOnly cookies with `SameSite=Lax` and the refresh cookie scoped to `/api/v1/auth`; identical 401 body for unknown email and wrong password; a forged `X-Forwarded-For` does not change the limited address
- README with the five required sections and 4 desktop and 4 mobile screenshots

## Next

- Deploy to the VPS (needs host, domain and `.env` from the owner), then confirm the live link signs in with the seeded credentials
- Trace each PRD section 5 criterion to a test or a measurement and tick it; none is ticked yet
- Run `make test-integration` and `make test-e2e` once more on the final branch
- Manual: stop Redis and confirm the calm 503 state in the UI

## Blockers

The VPS deploy needs details only the owner has.
