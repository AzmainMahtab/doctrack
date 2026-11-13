# Development Phases

Phases are ordered by dependency, not by calendar. Each is a vertical slice with one gate. One feature branch per phase, `feature/p<N>-<name>`, merged into `dev` when its gate passes. The gate always includes `make check` green.

Requirement IDs refer to `../docs/REQUIREMENTS.md` and `../docs/PRD.md`.

| # | Phase | Depends on |
|---|-------|------------|
| P0 | Foundation | none |
| P1 | Event backbone | P0 |
| P2 | Identity | P0 |
| P3 | Doctors and patients API | P1, P2 |
| P4 | Analytics and audit | P3 |
| P5 | Design system | none, runs beside P1–P4 |
| P6 | Web app | P5, API contracts from P2–P4 |
| P7 | Hardening and delivery | P4, P6 |

## P0 — Foundation

Delivers
- pnpm workspace: `apps/api`, `apps/web`, `packages/contracts`
- `docker-compose.yml`: MongoDB replica set with init script, NATS with JetStream, Redis, api, worker, web
- `Makefile`: `init`, `up`, `dev`, `down`, `seed`, `migrate`, `check`, `test`, `test-integration`
- `.env.example` and validated config
- Shared kernel: `AppError` hierarchy and code catalogue, Problem Details middleware, response helper, request id, pino
- `/health`, `/ready`
- OpenAPI generation from `packages/contracts`, `/openapi.json`, Swagger UI at `/docs`
- `check:arch` (dependency-cruiser): layer and module-boundary rules
- GitHub Actions: lint, typecheck, `check:arch`, unit tests

Gate
- `make up` starts every service and `/ready` reports Mongo, Redis and NATS reachable
- A planted forbidden import makes `check:arch` fail
- A thrown `AppError` and an unexpected exception both return correct Problem Details with `X-Request-Id`

## P1 — Event backbone

Delivers
- Unit of work with a session transaction; outbox writer
- Relay: change stream with persisted resume token, poll fallback, lease-based claim, JetStream publish with `Nats-Msg-Id`
- JetStream stream and durable consumer base: idempotency through `processed_events`, backoff, `max_deliver`, dead-letter subject
- `worker.ts` entry point; metrics for outbox lag, pending, DLQ depth

Gate (integration tests)
- A write produces exactly one effect even when the event is published twice
- Killing the relay between publish and mark-published causes a re-publish and still one effect
- A failing handler reaches the DLQ after `max_deliver`
- Two relays running concurrently never publish the same row

## P2 — Identity (FR-AUTH-1..4, FR-API-2)

Delivers
- `identity` module: users, seeded admin and viewer, Argon2id
- Login, refresh with rotation and family revocation, logout, `me`
- Token blacklist in Redis with TTL equal to remaining life; `revoked-after` for deactivated users
- RBAC permission guard declared per route
- Rate limiter: Lua sliding window, named policies, headers, failed-login counting, exact `trust proxy`

Gate (integration tests)
- Logout → replayed token returns `401 TOKEN_REVOKED`; entry expires with the token
- Reusing a rotated refresh token revokes the family
- Viewer gets `403` on every write route
- Sixth failed login returns `429` with `Retry-After`; success resets the counter
- A forged `X-Forwarded-For` from outside the proxy network is ignored
- Redis stopped → authenticated routes and login return `503`; `/ready` fails; `/health` stays up

## P3 — Doctors and patients API (FR-DOC-1..5, FR-PAT-1..4, FR-API-1, FR-API-3)

Delivers
- `doctors` and `patients` modules: aggregates, repositories, commands, queries, all indexes from `DATA_MODEL.md`
- `DoctorDirectory` port exported by `doctors`, used by `patients`
- Nested routes under `/doctors/:id/patients`
- `patientCount` consumer in `doctors`
- Zod contracts for every request and response; OpenAPI entries with the `Problem` schema

Gate
- Contract test: every registered route is in the OpenAPI document and the reverse
- Integration test: list queries on the 10k / 100k seed use an index (`explain()` has no `COLLSCAN`)
- Adding and deleting patients keeps `patientCount` equal to the true count after the consumer settles
- Validation, conflict and not-found cases return the documented codes

## P4 — Analytics and audit (FR-DASH-1..4, AUD-1)

Delivers
- `analytics` module: consumers building `analytics_daily` and `analytics_totals`; `make rebuild-analytics`
- Dashboard endpoints; Redis cache with short TTL, invalidated by the consumer
- `audit` module: append-only consumer

Gate
- On the seeded dataset the projection equals a fresh aggregation over the source collections
- A rebuild reproduces identical numbers
- Dashboard p95 under 200 ms on 100,000 patients
- Out-of-order and duplicate events leave the projection unchanged

## P5 — Design system (PRD §10)

Delivers
- `design/DESIGN-GUIDELINES.md`: tokens, type scale, spacing, breakpoints, motion table, measured contrast table, component rules
- Page specs under `design/pages/`: login, dashboard, doctors, doctor detail, patients, each with a component inventory and behaviour at 390 / 768 / 1440
- Design in Pencil, reviewed before code

Gate
- Every ink/ground pair meets contrast (4.5:1 body, 3:1 large and UI)
- Every element maps to a named component in an inventory
- Design review passes

## P6 — Web app (FR-UX-1..2 and every UI part of the FRs)

Delivers
- Next.js shell, same-origin proxy that forwards the client IP, middleware gating pages
- Login, layout and navigation, dashboard with charts and table alternatives, doctors list and detail, patients list
- TanStack Query with key factories, URL state through nuqs, debounced search, memoised rows, next-page prefetch
- Optimistic deletes with rollback; `429` handling that waits `Retry-After`; skeleton, empty and error states

Gate
- `tsc`, eslint, `next build` pass
- Playwright journeys J1–J5 pass at 390 and 1440 px
- axe reports no serious or critical violations on the main pages
- No horizontal scrolling at 390 px

## P7 — Hardening and delivery

Delivers
- Seed script for 10,000 doctors and 100,000 patients
- Load check against the latency targets; Lighthouse on the main pages
- Security pass: headers and CSP, cookie flags, enumeration, rate-limit bypass attempts
- Deploy to the VPS with compose and a reverse proxy
- `README.md` in the required template with desktop and mobile screenshots and `.env.example`
- Records updated: status, decisions, learnings

Gate
- Every acceptance criterion in PRD §5 is ticked
- Latency, accessibility and `COLLSCAN` targets from PRD §2 are met and recorded
- The live link works with the seeded credentials; a clean clone runs with `make init && make up && make seed`
