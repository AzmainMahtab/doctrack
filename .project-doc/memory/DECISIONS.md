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
| D-19 | 2026-11-14 | Doctors are never deleted; deactivation (`isActive`) is deferred and their patients are never orphaned | Brief lists no doctor delete |
| D-20 | 2026-11-14 | Dashboard windows 7 / 30 / 90 days plus a custom range of at most 366 days | Brief gives no definition of date statistics |
| D-21 | 2026-11-14 | Swagger UI is public on the demo; seeded admin and viewer credentials are in the README | Reviewers can try the API |
| D-22 | 2026-11-14 | TypeScript pinned to 6.0.x | typescript-eslint 8 supports TypeScript below 6.1; 7.0 is out but not yet supported by the lint toolchain |
| D-23 | 2026-11-14 | Manual composition root (`container.ts`), no DI framework | Explicit wiring, no decorators or reflection; ports are plain abstract classes |
| D-24 | 2026-11-14 | `defineRoute()` declares an endpoint once: validation, handler, envelope and OpenAPI entry come from the same object | Documentation cannot drift; a test also checks nothing is mounted outside the registry |
| D-25 | 2026-11-14 | `packages/contracts` is consumed as TypeScript source (no build step) and bundled into the API by tsup | One source of truth with no publish or build ordering |
| D-26 | 2026-11-14 | MongoDB runs as a single-node replica set with keyfile auth on an internal network; Redis and NATS require passwords | Transactions need a replica set; services are never exposed publicly |
| D-27 | 2026-11-14 | `make dev` runs infrastructure in Docker and api, worker and web on the host with hot reload; `make up` runs everything in containers | Fast feedback loop; production parity when needed |
| D-28 | 2026-11-14 | `main` is the GitHub default branch and receives releases only (PR from `dev`); every feature and fix is a PR from `feature/<name>` into `dev` | Production stays stable; integration happens on `dev`. GitHub cannot default PRs to a non-default branch, so the base is stated explicitly |
| D-29 | 2026-11-14 | The outbox relay is driven by polling (default 1 s); a change stream on `outbox` inserts only wakes it early. The resume token is not persisted | Correctness never depends on the stream, so a missed change event costs at most one poll interval. The claim lease, not the stream, prevents two relays publishing one row |
| D-30 | 2026-11-14 | Dead letters go to a separate `DEAD_LETTERS` stream (`dlq.<consumer>`) published by the consumer runner at `max_deliver`, then the source message is terminated | The server only stops redelivering at `max_deliver`; it never moves the message. A separate stream has its own retention and depth metric |
| D-31 | 2026-11-14 | The worker serves `/health`, `/ready` and `/metrics` on `WORKER_PORT` (9090), internal network only | The worker has no other HTTP surface; compose and a scraper need one |
| D-32 | 2026-11-14 | A new durable consumer replays the whole stream (`deliver_policy: all`) | Projections can be rebuilt from history; handlers are idempotent |
| D-33 | 2026-11-14 | Sessions are revoked by session id: refresh-token reuse or logout-of-session writes `sid:<sessionId>` in Redis, and every token of that session is rejected; individual tokens are blacklisted by `bl:<jti>` | One key revokes a whole token family without enumerating access tokens |
| D-34 | 2026-11-14 | Deactivating a user stores `user:<id>:revoked-before` (a timestamp); tokens issued at or before it are rejected | Covers tokens whose ids were never recorded |
| D-35 | 2026-11-14 | The role is carried in the access token and mapped to permissions in code (`ROLE_PERMISSIONS`); the pipeline order is global IP limit, authentication, permission, route policy, handler | Deny by default; no database lookup per request |
| D-36 | 2026-11-14 | Each route declares its full path (`/api/v1/...`), `public`, `permission` and `rateLimit`; the middleware chain is built from the declaration | One declaration drives behaviour and OpenAPI |
| D-37 | 2026-11-14 | Cookies: `dt_access` (path `/`) and `dt_refresh` (path `/api/v1/auth`), httpOnly, SameSite=Lax, `Secure` from `COOKIE_SECURE` (default on in production) | The refresh token is only sent to the auth routes |
| D-38 | 2026-11-14 | Accounts are created by `make seed` (idempotent); demo passwords come from `SEED_*` variables | No self-registration (A-1) |
| D-39 | 2026-11-14 | Search matches word prefixes: each document stores lowercase, accent-stripped `searchTokens` (name, specialization, hospital / name, diagnosis) in an indexed array, and each query word is an anchored regex | Search-as-you-type that uses an index and combines with filters and sorts; a text index only matches whole words |
| D-40 | 2026-11-14 | Patients carry a copy of the doctor's name (`doctorName`), taken from the `DoctorDirectory` port when the patient is admitted | Doctors are immutable in v1, so the copy cannot go stale; list rows need no join. A future doctor edit must emit an event that updates it |
| D-41 | 2026-11-14 | `doctor.patientCount` is maintained by the `doctors-patient-count` consumer, which applies `patient.registered` (+1) and `patient.removed` (-1) in the same transaction as its idempotency marker | Modules stay decoupled; the count converges within the relay poll interval |
| D-42 | 2026-11-14 | `DoctorDirectory` is declared in the patients module and implemented by an adapter that imports the doctors module's `index.ts` | The consumer owns its port; the module boundary rule is respected |
| D-43 | 2026-11-14 | An unfiltered list total uses `estimatedDocumentCount()`; filtered totals use `countDocuments(filter)` | A full count of an unfiltered collection is a collection scan; the metadata count is constant time |
| D-44 | 2026-11-14 | Durable consumer names use hyphens, not dots (`doctors-patient-count`) | NATS rejects `.` in durable names |
| D-45 | 2026-11-14 | The read model is `analytics_totals` (one document: doctors, patients, per-condition counts) and `analytics_daily` (one document per UTC day counting records that currently exist and were registered that day). A removal decrements the registration day | A rebuild from the source collections is exact, the daily counts sum to the total, and the dashboard reads O(days) rows |
| D-46 | 2026-11-14 | `doctor.registered`, `patient.registered` and `patient.removed` carry `registeredOn` (UTC date of `createdAt`); the projection buckets by it, not by `occurredAt` | A midnight boundary cannot separate an event from its record |
| D-47 | 2026-11-14 | Patients per doctor is the top N of `doctors.patientCount` through the doctors module's public API, not a second counter | One source of truth; served by the `{patientCount:-1,_id:-1}` index |
| D-48 | 2026-11-14 | Dashboard responses are cached in Redis for 30 s under a versioned key; the projection consumer bumps the version in an `afterCommit` hook, after its transaction commits | Reads stay cheap and are fresh within the poll interval; invalidating before commit could cache stale data. The cache namespace is configurable so environments sharing a Redis cannot read each other's entries |
| D-49 | 2026-11-14 | `make rebuild-analytics` (`ARGS=--check` verifies only) recomputes the projection from the source collections in one transaction after waiting for the outbox and the projection consumer to be idle | Repairs drift and bulk-loads data written without events. A write committed between the idle check and the snapshot can be counted twice; `--check` reports it |
| D-50 | 2026-11-14 | The event envelope carries a nullable `actorId`, taken from the authenticated request; the audit log records one row per event keyed by event id, kept 365 days | Who did what, without personal data in events |
| D-51 | 2026-11-14 | Modules expose read-only public APIs (`DoctorsPublicApi`, `PatientsPublicApi`) for counts and rankings; analytics never reads another module's collections | Module boundaries hold for the rebuild too |
| D-52 | 2026-11-14 | The MongoDB container runs with `nofile` 64000 | At 1,024 open files MongoDB stopped accepting connections during the integration run |
| D-53 | 2026-11-14 | Identity events carry no email address (`user.logged_in` has the role only; `user.deactivated` is empty) | Event payloads flow into the stream and the audit log; personal data stays out |

## Open questions

None.
