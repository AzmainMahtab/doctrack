# Backlog

Ordered. Tick `[x]` as work lands and mirror it in `../status/STATUS.md`.

## 0. Gate

- [ ] Review `../docs/ARCHITECTURE.md`; close OQ-6..7 in `../memory/DECISIONS.md`

## 1. Foundation

- [ ] pnpm workspace: `apps/api`, `apps/web`, `packages/contracts`
- [ ] `Makefile`, `docker-compose.yml` (mongo replica set, nats, redis, api, worker, web), `.env.example`
- [ ] `check:arch` (dependency-cruiser) rules for layers and module boundaries
- [ ] Shared kernel: `AppError` hierarchy + code catalogue, Problem Details error middleware, response helper (`{ data, meta }`), correlation id (`X-Request-Id`), pino, config validation, `/health` `/ready`
- [ ] OpenAPI generation from `packages/contracts`, `/openapi.json`, Swagger UI at `/docs`, route-vs-document contract test
- [ ] Rate limiter: Redis sliding-window Lua script, named policies per route, `RateLimit` / `RateLimit-Policy` / `Retry-After`, global per-IP policy before auth, exact `trust proxy`, proxy forwards client IP
- [ ] Mongo client with transaction helper; Redis client; NATS connection

## 2. Events

- [ ] Outbox collection, writer inside the unit of work
- [ ] Relay: change stream + poll fallback, lease claim, JetStream publish with `Nats-Msg-Id`
- [ ] Consumer base: durable consumer, `processed_events` idempotency, backoff, DLQ
- [ ] `worker.ts` entry point

## 3. Identity — AUTH-1..3

- [ ] User model, seeded admin and viewer
- [ ] Login, refresh rotation with family revocation, logout, `me`
- [ ] Permission guard on routes
- [ ] Token blacklist: `bl:<jti>` with TTL = remaining life on logout, checked in auth middleware; family revocation; `revoked-after` on deactivation
- [ ] Login limits: failed attempts per IP and per IP+email, reset on success, identical 429 body
- [ ] Next.js proxy + middleware, login page

## 4. Doctors — DOC-1..8

- [ ] Aggregate, repository, indexes, commands and queries
- [ ] List with search / filter / pagination
- [ ] `DoctorDirectory` port for patients
- [ ] Doctors page, doctor detail with patients, add and delete patient

## 5. Patients — PAT-1..6

- [ ] Aggregate, repository, indexes, commands and queries
- [ ] List with search / filter / pagination; edit; delete
- [ ] `doctors.patientCount` consumer
- [ ] Patients page

## 6. Analytics — DASH-1..6

- [ ] `analytics` consumers: `analytics_daily`, `analytics_totals`
- [ ] Dashboard queries and endpoints; Redis cache with consumer invalidation
- [ ] Rebuild command for the read model
- [ ] Dashboard UI: tiles, patients per doctor, time series, condition breakdown

## 7. Audit

- [ ] `audit` consumer and a read endpoint for admins

## 8. UX and performance — UX-*, PERF-*

- [ ] Layout, navigation, responsive at 390 / 768 / 1440
- [ ] Loading, empty and error states
- [ ] Query retry policy: no 4xx retries except 429 after `Retry-After`
- [ ] Debounced search, memoised rows, optimistic deletes, next-page prefetch
- [ ] `explain()` integration tests: no COLLSCAN on hot queries

## 9. Delivery

- [ ] Seed script with realistic volume (enough rows that indexes matter)
- [ ] Unit tests for domain and handlers; integration tests for outbox, relay, consumers, auth
- [ ] Deploy to the VPS; supply credentials
- [ ] `README.md` in the standardized template (DOCS-1..5) with desktop and mobile screenshots
