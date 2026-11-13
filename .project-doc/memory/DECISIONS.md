# Decisions

## Made

| ID | Date | Decision | Why |
|----|------|----------|-----|
| D-1 | 2026-11-13 | Records live in `.project-doc/`, plain Markdown | Agent, model and harness agnostic |
| D-2 | 2026-11-13 | Repo in `repo/doctrack/`, default branch `dev`; `main` is production only | Workspace git flow |
| D-3 | 2026-11-14 | Separate Next.js web app + standalone Express API, REST between them | Brief §6 reads both ways; the separate-server reading keeps the backend architecture explicit and independently scalable |
| D-4 | 2026-11-14 | pnpm workspaces: `apps/api`, `apps/web`, `packages/contracts`; root `Makefile` + `docker-compose.yml`. No Nx | Same shape as people-kit. Two apps and one package do not need a project graph. Module boundaries are enforced by `dependency-cruiser` (`check:arch`) |
| D-5 | 2026-11-14 | API is a modular monolith: Clean Architecture (ports & adapters) + DDD + CQRS, sliced by module | Maintainability and a path to extraction |
| D-6 | 2026-11-14 | Transactional outbox in MongoDB, relayed to NATS JetStream; durable, idempotent consumers keyed by event id | Events are published atomically with the data change; JetStream gives durable fan-out, dedup and replay. BullMQ was considered: it is a job queue, not an event broker, so fan-out needs one queue per subscriber |
| D-7 | 2026-11-14 | Two processes from one codebase: `api` (HTTP) and `worker` (outbox relay + consumers) | Scale and fail independently |
| D-8 | 2026-11-14 | Native MongoDB driver behind repository ports, replica set, explicit indexes / projections / aggregations | Multi-document transactions for the outbox; query shape is visible and testable |
| D-9 | 2026-11-14 | Auth: ES256 access + refresh JWT in httpOnly cookies, refresh rotation, blacklist in Redis (D-14); RBAC with roles `admin` and `viewer` mapped to permissions | Brief asks for authentication and authorization |
| D-10 | 2026-11-14 | Patient: name, dateOfBirth, gender, phone, email, condition (`stable`, `under_observation`, `critical`, `recovered`), diagnosis, admittedAt, doctorId | Gives the condition filter and charts meaning |
| D-11 | 2026-11-14 | Web data: TanStack Query; search/filter/page state in the URL (nuqs); same-origin API through the Next.js proxy; optimistic deletes | Shareable views, no CORS, no token in JS |
| D-12 | 2026-11-14 | Deploy: single VPS, docker compose, reverse proxy (Mongo, NATS, Redis, api, worker, web) | Lowest recurring cost; one command reproduces it |
| D-13 | 2026-11-14 | Charts: Recharts | Brief allows any library |
| D-14 | 2026-11-14 | Token blacklist in Redis: on logout the access and refresh `jti` are stored with TTL = remaining token life | Real logout without unbounded storage |
| D-15 | 2026-11-14 | Per-endpoint rate limiting in Redis (sliding window, Lua) with named policies; login counts failed attempts only; IETF draft `RateLimit` / `RateLimit-Policy` headers plus `Retry-After` on `429`; client IP forwarded by the Next.js proxy with an exact `trust proxy` | Protects login and write paths; shared across replicas; correct behind a proxy |
| D-16 | 2026-11-14 | Success `{ data, meta? }`; errors are RFC 9457 Problem Details with stable `code`, `requestId`, and fixed-type `errors` / `retryAfter` | A standard, predictable error shape |
| D-17 | 2026-11-14 | OpenAPI 3.1 generated from the Zod contracts, Swagger UI at `/docs`, contract test against registered routes | Documentation cannot drift from behaviour |
| D-18 | 2026-11-14 | Redis is a hard dependency with no fail-open path: when it is down, login and authenticated routes return `503` | A limiter that fails open invites brute force; a blacklist that fails open honours logged-out tokens |

## Open questions

| ID | Question | Default if unanswered |
|----|----------|-----------------------|
| OQ-6 | Is a doctor ever deleted? Brief lists no doctor delete | No delete; doctors can be deactivated. Their patients are never orphaned |
| OQ-7 | Does the dashboard need a date-range picker or fixed windows (7 / 30 / 90 days)? | Fixed windows plus a custom range |
