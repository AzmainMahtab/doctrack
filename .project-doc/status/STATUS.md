# Status

Updated: 2026-11-14

## Phase

P2 Identity complete on `feature/p2-identity` (not yet merged). Next: P3 Doctors and patients API.

## Done

- Records, PRD and phases (D-1..D-28); P0 Foundation and P1 Event backbone merged into `dev`
- P2 Identity: `identity` module (users, Argon2id, ES256 tokens with `typ` check, login, refresh with rotation and reuse detection, logout, `me`, deactivation), Redis token blacklist with TTL equal to remaining token life, session revocation by `sid`, role-based permissions (`admin`, `viewer`), request pipeline (global IP limit, authentication, permission, route policy), Redis sliding-window rate limiter with the six named policies and IETF draft headers, cookie handling, `make seed`
- P2 gate verified: 50 unit and 39 integration tests pass. On the running stack: login sets two httpOnly cookies, six bad logins give five 401s then a 429 with `Retry-After`, a logged-out access token returns `TOKEN_REVOKED`, and with Redis stopped login and `/auth/me` return 503 while `/health` stays 200

## Next

- Merge the P2 PR into `dev`
- P3 Doctors and patients API, on `feature/p3-doctors-patients` from `dev`: every route declares its permission, and the contract and `explain()` tests from PHASES.md apply

## Blockers

None.
