# Status

Updated: 2026-11-14

## Phase

P7 Hardening and delivery: only the VPS deploy and four criteria remain. Work on `feature/p7-acceptance`.

## Done

- P0 to P6 merged into `dev`
- P7 measured at 10,024 doctors and 100,029 patients: 0 of 13 hot list queries use `COLLSCAN`; p95 of list endpoints 5 to 37 ms, dashboard 3 to 4 ms; Lighthouse accessibility 100 on login, dashboard, doctors, doctor detail and patients
- `make seed-scale`, `make explain-check`, `make load-check`, `make deploy` (Caddy overlay)
- Security probes on the running stack: CSP with nonce, frame, sniffing, referrer and permissions headers; httpOnly cookies with `SameSite=Lax` and the refresh cookie scoped to `/api/v1/auth`; identical 401 body for unknown email and wrong password; a forged `X-Forwarded-For` does not change the limited address
- README with the five required sections and 4 desktop and 4 mobile screenshots

- PRD section 5: 45 of 49 criteria ticked, each traced in `docs/ACCEPTANCE.md`; integration 99 of 99, e2e 24 of 24, calm 503 state checked with Redis stopped; convergence after a write measured at about 60 ms

## Next

- Deploy to the VPS (needs host, domain and `.env` from the owner), run `make init && make up && make seed` on a clean clone, confirm the live link signs in with the seeded credentials (criterion at PRD line 253)
- Four criteria left unticked, listed in `docs/ACCEPTANCE.md`: Swagger authorize and execute, slow-API skeleton, chart 500 state, clean-machine setup

## Blockers

The VPS deploy needs details only the owner has.
