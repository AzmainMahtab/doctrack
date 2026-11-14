# API Contract

REST, JSON, base path `/api/v1`. The machine-readable contract is the OpenAPI 3.1 document generated from `packages/contracts`, served at `/openapi.json` with Swagger UI at `/docs`. This file describes the rules; the endpoints below are the surface.

## Responses

Success is JSON with one of two shapes.

Single resource:

```json
{ "data": { "id": "…", "name": "…" } }
```

List:

```json
{
  "data": [ { "id": "…" } ],
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
}
```

No body (delete, logout): `204`.

Field names are `camelCase`; timestamps are ISO 8601 UTC strings; ids are UUIDv7 strings.

## Errors — RFC 9457 Problem Details

Every error is `Content-Type: application/problem+json`.

```json
{
  "type": "https://doctrack.app/problems/validation-failed",
  "title": "Request validation failed",
  "status": 422,
  "detail": "2 fields are invalid.",
  "instance": "/api/v1/doctors",
  "code": "VALIDATION_FAILED",
  "requestId": "01JC…",
  "errors": [
    { "field": "email", "message": "Invalid email" },
    { "field": "phone", "message": "Required" }
  ]
}
```

- `type`, `title`, `status`, `detail`, `instance` are the RFC 9457 members. `type` is a stable URI per problem.
- `code` is a stable machine-readable string; clients branch on it, never on `title` or `detail`.
- `requestId` equals the `X-Request-Id` response header and the log correlation id.
- `errors` exists only on `VALIDATION_FAILED` and is always an array of `{ field, message }`. `retryAfter` (integer seconds) exists only on `RATE_LIMITED` and `UNAVAILABLE`. A member never changes type.
- `detail` is safe to show and never carries stack traces, Mongo errors or internals; the full error is only in logs.

| Status | `code` | `type` suffix | When |
|--------|--------|---------------|------|
| 400 | `BAD_REQUEST` | `bad-request` | Malformed JSON or query |
| 401 | `UNAUTHENTICATED` | `unauthenticated` | Missing, invalid or expired token |
| 401 | `TOKEN_REVOKED` | `token-revoked` | Token was blacklisted (logged out) |
| 403 | `FORBIDDEN` | `forbidden` | Authenticated but lacks the permission |
| 404 | `NOT_FOUND` | `not-found` | Resource does not exist |
| 409 | `CONFLICT` | `conflict` | Unique constraint, e.g. doctor email already used |
| 422 | `VALIDATION_FAILED` | `validation-failed` | Body, query or params fail schema validation |
| 429 | `RATE_LIMITED` | `rate-limited` | A rate limit was exceeded |
| 500 | `INTERNAL_ERROR` | `internal-error` | Unexpected failure |
| 503 | `UNAVAILABLE` | `unavailable` | A dependency (Redis, Mongo) is down |

`type` is `https://doctrack.app/problems/<suffix>`.

## Rate limiting

Redis-backed, per endpoint. A request is checked against several policies in order; the first exhausted policy rejects it.

| Policy | Key | Limit | Counts |
|--------|-----|-------|--------|
| `ip-global` | client IP | 300 / 60 s | every request, before auth |
| `login-ip` | client IP | 20 / 15 min | failed logins |
| `login-account` | client IP + normalised email | 5 / 15 min | failed logins only; reset on success |
| `refresh` | user | 30 / 15 min | refresh calls |
| `user-read` | user | 120 / 60 s | `GET` |
| `user-write` | user | 60 / 60 s | `POST`, `PATCH`, `DELETE` |

Order: `ip-global` → authentication → the route's policy. A request rejected by an earlier policy consumes nothing from later ones. `/health` is exempt. A login `429` has the same body whether or not the account exists.

### Headers

Structured-field headers from the IETF `draft-ietf-httpapi-ratelimit-headers` (still a draft, so treat the format as subject to change):

```
RateLimit-Policy: "ip-global";q=300;w=60, "user-read";q=120;w=60
RateLimit: "user-read";r=87;t=34
```

- `RateLimit-Policy` lists every policy evaluated: `q` quota, `w` window in seconds.
- `RateLimit` reports the policy closest to exhaustion: `r` remaining, `t` seconds until it resets (a delta, never an epoch timestamp).
- A `429` also sends `Retry-After: <seconds>` (RFC 9110), equal to `t` of the policy that tripped, and the body carries the same value as `retryAfter`.

Example:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 34
RateLimit-Policy: "ip-global";q=300;w=60, "user-read";q=120;w=60
RateLimit: "user-read";r=0;t=34

{ "type": "https://doctrack.app/problems/rate-limited", "title": "Too many requests",
  "status": 429, "detail": "Rate limit exceeded. Retry in 34 seconds.",
  "instance": "/api/v1/patients", "code": "RATE_LIMITED", "requestId": "01JC…", "retryAfter": 34 }
```

### Client IP

The browser reaches only the Next.js proxy. The proxy sets `X-Forwarded-For` to the real client IP and discards any client-supplied value. Express `trust proxy` is set to the exact proxy hops, never `true`, and the API is reachable only on the internal network. Without this every user would share the proxy's IP and one user could exhaust the global limit for everyone.

### Redis unavailable

Redis is a hard dependency (blacklist and limiter). When it is down, login and every authenticated route return `503 UNAVAILABLE` with `Retry-After`; `/ready` fails; `/health` stays up. There is no fail-open path.

## Auth

| Method | Path | Permission | Purpose |
|--------|------|-----------|---------|
| POST | `/auth/login` | public | email + password; sets httpOnly cookies |
| POST | `/auth/refresh` | refresh cookie | rotate tokens |
| POST | `/auth/logout` | authenticated | blacklist access and refresh tokens for their remaining life; clear cookies |
| GET | `/auth/me` | authenticated | current user and permissions |

## Doctors

| Method | Path | Permission | Purpose |
|--------|------|-----------|---------|
| GET | `/doctors` | `doctors:read` | list. Query: `page`, `limit`, `q` (word prefixes), `specialization`, `hospital`, `from`, `to` (created date, inclusive), `sort` (`-createdAt` default, `createdAt`, `name`, `-name`, `-patientCount`) |
| POST | `/doctors` | `doctors:write` | create |
| GET | `/doctors/:id` | `doctors:read` | one doctor |
| GET | `/doctors/:id/patients` | `patients:read` | that doctor's patients. Query: `page`, `limit`, `q`, `condition` |
| POST | `/doctors/:id/patients` | `patients:write` | add a patient under the doctor |
| DELETE | `/doctors/:id/patients/:patientId` | `patients:write` | remove a patient from the doctor |

## Patients

| Method | Path | Permission | Purpose |
|--------|------|-----------|---------|
| GET | `/patients` | `patients:read` | list. Query: `page`, `limit`, `q`, `condition`, `doctorId`, `from`, `to`, `sort` |
| GET | `/patients/:id` | `patients:read` | one patient |
| PATCH | `/patients/:id` | `patients:write` | edit |
| DELETE | `/patients/:id` | `patients:write` | delete |

## Dashboard

All dashboard routes need `dashboard:read` and are cached for 30 s (refreshed as soon as the projection consumes an event).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard/summary` | `{ doctors, patients, updatedAt }` |
| GET | `/dashboard/patients-per-doctor` | top doctors by patient count. Query: `limit` (1–20, default 10). Rows `{ doctorId, name, patientCount }` |
| GET | `/dashboard/timeseries` | `{ entity, interval, from, to, points: [{ date, count }] }`. Query: `entity` (`patients` default, `doctors`), `interval` (`day` default, `week`, `month`), and either `window` (7, 30 default, 90 days ending today) or `from` and `to` (at most 366 days). Gaps are zero-filled; week buckets start on Monday, month buckets on the 1st, both labelled by their start date |
| GET | `/dashboard/conditions` | `{ counts: { stable, under_observation, critical, recovered }, total }` |

A series counts records that currently exist, by the day they were registered.

## Operational

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | liveness, no auth, not rate limited |
| GET | `/ready` | Mongo, Redis, NATS reachable |
| GET | `/docs` | Swagger UI |
| GET | `/openapi.json` | OpenAPI 3.1 document |

## Documentation rules

- The OpenAPI document is generated from the same Zod schemas that validate requests (`@asteasolutions/zod-to-openapi`), so documentation cannot drift from behaviour.
- Every route declares: summary, tags, permission, request schema, every response status with its schema (including the `Problem` schema and `429`), and the cookie security scheme.
- A contract test fails the build if a registered Express route is missing from the document, or a documented route is not registered.
- Swagger UI is enabled in development and on the deployed demo; it ships with a seeded viewer and admin login documented in the README.
