# Architecture

Draft for review. Decisions are in `../memory/DECISIONS.md`.

## 1. System context

```
Browser ──► web (Next.js) ──proxy (forwards client IP)──► api (Express, internal network only) ──► MongoDB (replica set)
                                       │  │                 ▲
                                       │  └─► Redis         │
                                       │                    │ change stream / poll
                                       └─ outbox row ───► worker ──► NATS JetStream
                                          (same txn)         ▲            │
                                                             └─ consumers ◄┘
                                                    (counters, analytics, audit)
```

| Process | Responsibility | Scales by |
|---------|---------------|-----------|
| `web` | UI, same-origin proxy to the API | replicas |
| `api` | HTTP, commands, queries, writes data + outbox | replicas (stateless) |
| `worker` | outbox relay, JetStream consumers, projections | consumer count / partitioned relay |
| MongoDB | system of record, outbox, read models | replica set, then sharding on `doctorId` if needed |
| NATS | durable event streams | cluster |
| Redis | token blacklist, per-endpoint rate limit, short-lived query cache | single, then sentinel |

`api` and `worker` are one codebase with two entry points (`server.ts`, `worker.ts`), so they share domain code but deploy and scale separately.

## 2. Modules

| Module | Owns | Publishes | Consumes |
|--------|------|-----------|----------|
| `identity` | users, roles, permissions, sessions, refresh tokens | `UserLoggedIn` | none |
| `doctors` | doctor aggregate, doctor list/query | `DoctorRegistered`, `DoctorUpdated` | `PatientRegistered`, `PatientRemoved` (maintain `patientCount`) |
| `patients` | patient aggregate, patient list/query | `PatientRegistered`, `PatientUpdated`, `PatientConditionChanged`, `PatientRemoved` | none |
| `analytics` | dashboard read model | none | all doctor and patient events |
| `audit` | append-only audit log | none | all events |

Each module:

```
modules/<name>/
├── domain/          # entities, value objects, domain events, repository ports. No framework imports
├── application/     # commands, queries, handlers (CQRS), orchestration
├── infrastructure/  # Mongo repositories, mappers, adapters
├── presentation/    # Express routes, controllers, DTO mapping
└── index.ts         # the only importable surface of the module
```

Rules, enforced by `check:arch`:

- `presentation → application → domain`; `infrastructure` implements ports declared in `domain`.
- `domain` and `application` never import `express`, `mongodb`, `nats` or `redis`.
- A module never imports another module's internals. Cross-module reads go through a port exported from the owner's `index.ts` (for example `patients` asks `DoctorDirectory.exists(id)`, implemented by `doctors`); everything else is events.
- Ports are declared by the consumer and are abstract classes, which serve as both contract and DI token.

## 3. CQRS

- **Commands** (`RegisterDoctor`, `AdmitPatient`, `ChangePatientCondition`, `RemovePatient`) load an aggregate, apply the change, save it and its events in one transaction.
- **Queries** (`ListDoctors`, `ListPatients`, `GetDashboardSummary`) bypass aggregates. They are projections straight from indexed collections or the read model, returning only the fields listed.
- Reads and writes of the same module may hit the same collection; the analytics read model is a separate collection.

## 4. Write path and outbox

```
HTTP POST ─► validate (contracts) ─► authorize (permission) ─► command handler
   ─► session.withTransaction {
         repository.save(aggregate)
         outbox.insert(events)        // _id = eventId (UUIDv7)
      }
   ─► 201
```

The domain change and the event commit together or not at all. No dual-write.

## 5. Relay

- The relay loop claims a batch of rows (`pending`, or `claimed` with an expired lease), ordered by `_id`. A claim is an `updateMany` that stamps a unique `claimToken` and a lease (`leaseUntil`, default 30 s); two relays can never hold the same row.
- Each claimed row is published to JetStream at `evt.<event name>` with `Nats-Msg-Id = eventId`, so a retried publish inside the stream's 10-minute duplicate window is dropped by the broker.
- After the publishes succeed, the batch is marked `published`. Published rows expire through a TTL index (7 days).
- A publish failure releases the batch with a backoff lease (500 ms doubling to 60 s) and increments `attempts` on the failing row.
- **Polling is the correctness path** (default 1 s). A change stream on `outbox` inserts only wakes the loop early, so latency is low; it is reopened with backoff on error and its resume token is not stored (D-29).
- A relay that crashes after publishing but before marking leaves the rows `claimed`; after the lease expires any relay republishes them and the broker deduplicates.

Delivery is at-least-once. Duplicates are handled at the consumer.

## 6. Consumers

- One **durable consumer per handler** on the `DOMAIN_EVENTS` stream (`evt.>`), created with explicit acks, `ack_wait` 30 s, `max_deliver` 5 and backoff `[1 s, 5 s, 30 s, 2 min]`. Each handler gets its own copy of every event it subscribes to, which is the fan-out BullMQ would not give natively. A new consumer replays the stream from the start (D-32).
- **Idempotency:** each message runs in one Mongo transaction that first inserts a `processed_events` marker `{ consumer, eventId }` (unique index) and then calls the handler. A duplicate marker means the event was already applied: the transaction aborts and the message is acknowledged. A handler failure rolls back both the effect and the marker.
- **Failure:** `nak` with the backoff delay until the last allowed delivery; then the runner publishes the original payload to `dlq.<consumer>` on the `DEAD_LETTERS` stream with `Doctrack-Error`, `-Reason`, `-Deliveries`, `-Event-Id` and `-Original-Subject` headers, and terminates the source message. A malformed envelope is dead-lettered on its first delivery (D-30).
- **Ordering:** the relay publishes in `_id` order, so the stream preserves outbox order for a single relay. Projections must not rely on it: they apply deltas, which commute.
- **Observability:** the worker serves `/metrics` with outbox pending count, oldest pending age, published total, per-consumer pending, and dead-letter depth (D-31).
- A reaction is an in-process handler **or** a durable consumer, never both.

## 7. Dashboard read model

`analytics_daily` holds one document per `{ date, doctorId, condition }` with counters (`registered`, `removed`). The dashboard queries read O(days × doctors) pre-aggregated rows, not O(patients).

| Widget | Source |
|--------|--------|
| Total doctors / patients | `analytics_totals` (single document, incremented) |
| Patients per doctor | `doctors.patientCount`, top N by index |
| Date-based statistics | `analytics_daily`, grouped by `$dateTrunc` |
| Condition breakdown | `analytics_daily` grouped by `condition` |

The projection is rebuildable: replaying the stream (or a one-off aggregation over `patients`) reproduces it. The projection can lag by milliseconds, and the UI states "updated at".

## 8. Authentication and authorization

- Login verifies an Argon2id hash, then issues an **access token** (15 min) and a **refresh token** (7 days) as ES256 JWTs with a `typ` claim and a `jti`, in httpOnly, Secure, SameSite=Lax cookies.
- Refresh **rotates** the token and stores its `jti`. Reuse of a rotated token revokes the whole token family.
- **RBAC:** a role maps to permissions, and routes declare the permission they need.
  - `admin`: `doctors:read|write`, `patients:read|write`, `dashboard:read`
  - `viewer`: `doctors:read`, `patients:read`, `dashboard:read`
- The web app's Next.js middleware gates pages; the API enforces independently. The browser only ever talks to the Next.js origin (proxy), so there is no CORS surface and no token reachable from JavaScript.

### Token blacklist

- On logout, the `jti` of the access token and of the refresh token is written to Redis as `bl:<jti>` with a TTL equal to the token's remaining life (`exp - now`). The entry disappears exactly when the token would have expired anyway, so the blacklist never grows without bound.
- The auth middleware checks `bl:<jti>` after verifying the signature and `typ`. A hit returns `401 TOKEN_REVOKED`.
- Refresh-token reuse detection revokes the whole session: `sid:<sessionId>` is written to Redis (TTL = refresh lifetime) and every access or refresh token carrying that `sid` is rejected (D-33).
- Deactivating a user writes `user:<id>:revoked-before` (a timestamp); tokens issued at or before it are rejected, which covers tokens whose `jti` was never seen (D-34).

### Rate limiting

- Per endpoint, in Redis, as a sliding-window counter in one Lua script (atomic, one round trip), shared by every `api` replica.
- Each route declares its policy next to its definition. The policies, their keys and limits are in `API_CONTRACT.md`.
- Order: global per-IP policy before authentication, then the route policy after it. The first exhausted policy rejects with `429`; a request rejected early consumes nothing from later policies.
- Login limits count **failed** attempts per IP and per IP + email, and reset on success, so a legitimate user is never locked out by successful logins. The `429` body is identical whether or not the account exists.
- Headers: `RateLimit-Policy`, `RateLimit` (IETF draft, structured fields, `t` in seconds) and `Retry-After` on rejection.
- **Client IP:** the Next.js proxy forwards the real client IP in `X-Forwarded-For` and discards client-supplied values; Express `trust proxy` names the exact hops. The API is reachable only on the internal network.

### Redis is a hard dependency

The blacklist and the limiter both need Redis. When it is unreachable, login and every authenticated route return `503 UNAVAILABLE` with `Retry-After`; `/ready` fails; `/health` stays up. There is no fail-open path: a limiter that fails open invites brute force on login, and a blacklist that fails open honours logged-out tokens.

## 9. Responses, errors, observability, health, documentation

- **Success** is `{ data, meta? }`. **Errors** are RFC 9457 Problem Details (`application/problem+json`) with stable `code`, `requestId`, and `errors` / `retryAfter` extension members of fixed type. Controllers return data and never write the response shape by hand: a response helper and the error middleware are the only places it is produced. Rules and the code catalogue are in `API_CONTRACT.md`.
- **One error model.** An `AppError` hierarchy in `shared/` (`ValidationError`, `NotFoundError`, `ConflictError`, `UnauthenticatedError`, `ForbiddenError`, `RateLimitedError`, `UnavailableError`, …) with a stable `code`. Domain and application code throw these, never HTTP exceptions. A single Express error middleware maps them to Problem Details; an unknown error becomes `500 INTERNAL_ERROR` with no internals in the body, and the full error is logged.
- **Validation** happens at the route boundary with the Zod schemas from `packages/contracts`; failures become `422 VALIDATION_FAILED` with `errors: [{ field, message }]`.
- **Swagger / OpenAPI.** The OpenAPI 3.1 document is generated from the same Zod schemas that validate requests, served at `/openapi.json` with Swagger UI at `/docs`. `Problem` is a shared schema referenced by every error response. A contract test fails if the registered routes and the document disagree.
- **Correlation id** generated at the edge, returned as `X-Request-Id`, carried in logs, in the problem body and in event metadata, so a request can be traced through the outbox into the consumers.
- pino JSON logs. `/health` (liveness) and `/ready` (Mongo, Redis, NATS reachable). Metrics: outbox lag, consumer pending, DLQ depth, rate-limit rejections per policy.

## 10. Query performance

- Every list endpoint takes `page`/`limit` (capped), returns `total`, uses a projection and a compound index that matches filter then sort.
- Search: a text index for word search, plus prefix match on name.
- Indexes are listed per collection in `DATA_MODEL.md`. Each hot query is verified with `explain("executionStats")` in an integration test that fails on `COLLSCAN`.
- Redis caches the dashboard summary with a short TTL, invalidated by the analytics consumer.

## 11. Frontend

```
apps/web/src/
├── app/                 # routes: (auth)/login, (app)/dashboard, doctors, doctors/[id], patients
├── features/            # doctors, patients, dashboard, auth: components, hooks, queries
├── components/ui/       # primitives
└── lib/                 # api client, query keys, url-state helpers
```

- TanStack Query for server state; query keys are factories per feature.
- Search, filters and page live in the URL (nuqs), so views are shareable and back/forward work. Search input is debounced.
- Tables use memoised rows and stable callbacks. The next page is prefetched.
- Deletes are optimistic with rollback on error.
- The query `retry` callback never retries a 4xx except `429`; on `429` it waits `Retry-After` and retries once, and mutations show the wait time.
- Requirement coverage: Dashboard/Doctors/Patients navigation, loading / empty / error states, 390 / 768 / 1440.

## 12. Scaling path

1. Today: one VPS, every service on compose.
2. `api` and `worker` replicas behind the proxy; Mongo and NATS move to managed or clustered.
3. Heavy modules (`analytics`) become their own deployment, because they already consume only events and read only their own collection.
4. If `patients` grows large, shard on `doctorId` (the dominant access pattern).

## 13. Trade-offs recorded

| Choice | Cost accepted |
|--------|---------------|
| Outbox + broker | More moving parts than a direct call, in exchange for atomicity and replay |
| NATS instead of BullMQ | One more service than reusing Redis, in exchange for streams, fan-out and replay |
| Projection read model | Eventual consistency of the dashboard, in exchange for constant-cost reads |
| Native driver | More boilerplate than an ODM, in exchange for visible query shape and clean domain |
| Monolith, not services | One deploy unit, in exchange for lower operational cost with boundaries that allow extraction |
