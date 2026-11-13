---
title: Doctor Tracker
subtitle: Secure admin portal to manage doctors and their patients, with an analytics dashboard
doc-type: Product Requirements Document
client: Doctor Tracker
date: 2026-11-14
version: v1.0
author: Azmain Mahtab
status: For approval
---

## 1. Summary

Administrative staff need one place to keep the list of doctors, the patients under each doctor, and a picture of how those numbers move over time. Today that is spread across files and memory, so finding a patient, checking a doctor's load or reporting totals takes manual counting.

Doctor Tracker is a web application behind a login. Staff create doctors, add and edit patients under them, search and filter both lists, and read a dashboard of totals, patients per doctor, registrations over time and patients by condition. The API is documented in Swagger and protects every route with authentication and role-based permissions.

Success is measured on a seeded dataset of 10,000 doctors and 100,000 patients: list and search responses under 300 ms at the 95th percentile, dashboard responses under 200 ms, no collection scan on any list query, and every acceptance criterion in section 5 passing.

## 2. Business Context

- **The business:** a medical administration team that registers doctors and tracks the patients assigned to each.
- **The problem today:** records are kept without a shared system; totals and per-doctor counts are counted by hand.
- **Why now:** the team needs a single, access-controlled source of truth that scales beyond a few hundred records.
- **Business objectives:**

| Objective | Measured by | Baseline today | Target | When |
|---|---|---|---|---|
| Lookup latency | p95 latency of `GET /doctors` and `GET /patients` with search + filter + page | not measured | < 300 ms at 10k doctors / 100k patients | release |
| Reporting latency | p95 latency of every `/dashboard/*` endpoint | manual counting | < 200 ms | release |
| Index discipline | hot queries with a `COLLSCAN` in `explain()` | n/a | 0 | release |
| Accessible UI | Lighthouse accessibility score on the three main pages | n/a | ≥ 95 | release |

## 3. Users

**Admin** — primary. Staff member who manages records.
- Context of use: desktop browser, office, several hours a day; occasionally a phone.
- What they do today instead: spreadsheets and manual counts.
- Needs, ranked: find a record in seconds; add and correct records; see totals at a glance.
- Would abandon it if: search is slow, or a correction takes more than three clicks.

**Viewer** — read-only staff member (management, auditors).
- Context of use: desktop and phone, short visits.
- What they do today instead: ask an admin for numbers.
- Needs, ranked: dashboard; look up a doctor or patient.
- Would abandon it if: write controls are shown and then refused.

## 4. Scope

### In scope — v1

| # | Capability | Priority | User | Rationale |
|---|---|---|---|---|
| AUTH-1..3 | Login, protected routes, authorization | Must | Both | Brief §2.1 |
| DOC-1 | Create a doctor | Must | Admin | Brief §2.2 |
| DOC-2..5 | List, search, filter, paginate doctors | Must | Both | Brief §2.2 |
| DOC-6 | View a doctor's patients | Must | Both | Brief §2.2 |
| DOC-7 | Add a patient under a doctor | Must | Admin | Brief §2.2 |
| DOC-8 | Delete a patient from a doctor's list | Must | Admin | Brief §2.2 |
| PAT-1..6 | Patient page: list, edit, delete, paginate, search, filter | Must | Both | Brief §2.3 |
| DASH-1..6 | Totals, patients per doctor, date statistics, charts | Must | Both | Brief §3 |
| UX-1..5 | Responsive layout, clear navigation | Must | Both | Brief §4 |
| PERF-1..7 | Indexed queries, pagination, validation, error handling | Must | n/a | Brief §5 |
| STK-1..5 | Next.js, Express, MongoDB, REST, data fetching strategy | Must | n/a | Brief §6 |
| API-1..3 | Uniform responses and errors, rate limiting, Swagger | Must | n/a | Product decision D-14..D-17 |
| DOCS-1..5 | README in the standard template | Must | n/a | Brief README section |
| AUD-1 | Audit log of changes (written, not shown in the UI) | Should | n/a | Architecture, D-5/D-6 |

### Out of scope

- Roles beyond admin and viewer; doctor or patient logins.
- Self-registration, password reset, social login, MFA.
- Appointments, scheduling, prescriptions, billing, medical records, file uploads.
- Email, SMS or push notifications.
- Multiple organisations (multi-tenancy) and languages other than English.
- A native mobile application.
- Editing user accounts from the UI; accounts are seeded.

### Deferred to a later phase

- Deactivating a doctor from the UI (the data model carries `isActive`; no delete exists, D-19).
- A screen for the audit log.
- CSV export of lists.

## 5. Functional Requirements

### Authentication and authorization

**FR-AUTH-1: Log in**
- **As an** Admin or Viewer **I need to** sign in with email and password **so that** I can reach the portal.
- **Behaviour:** the form posts to `POST /auth/login`. On success the API sets an access cookie and a refresh cookie (httpOnly, Secure, SameSite=Lax) and the app opens the dashboard. On failure the form shows one message and keeps the email.
- **Rules:** password 12–128 characters; Argon2id hash; access token 15 minutes; refresh token 7 days; a failed login returns the same body whether or not the email exists.
- **Acceptance criteria:**
  - [ ] Given valid credentials, when I submit, then I land on `/dashboard` and no token is readable from JavaScript.
  - [ ] Given a wrong password, when I submit, then I see "Invalid email or password", the response is `401 UNAUTHENTICATED` and the body is identical to the one for an unknown email.
  - [ ] Given 5 failed attempts for the same IP and email within 15 minutes, when I try a 6th, then I get `429 RATE_LIMITED` with `Retry-After`; a successful login resets the count.

**FR-AUTH-2: Stay signed in**
- **As a** user **I need** my session to continue without re-entering my password **so that** work is not interrupted.
- **Behaviour:** when the access token has expired the app calls `POST /auth/refresh`; the refresh token is rotated on every use.
- **Rules:** a rotated refresh token that is presented again revokes the entire token family.
- **Acceptance criteria:**
  - [ ] Given an expired access token and a valid refresh token, when I load a page, then the request succeeds after one transparent refresh.
  - [ ] Given a refresh token that was already rotated, when it is presented, then the API returns `401 TOKEN_REVOKED` and every token of that family is rejected afterwards.

**FR-AUTH-3: Log out**
- **As a** user **I need to** end my session **so that** a stolen cookie is useless.
- **Behaviour:** `POST /auth/logout` blacklists the `jti` of the access and refresh tokens in Redis with a TTL equal to each token's remaining life, clears the cookies and returns `204`.
- **Acceptance criteria:**
  - [ ] Given I logged out, when I replay my old access token, then the API returns `401 TOKEN_REVOKED` until the token's original expiry.
  - [ ] Given the blacklist entry's TTL elapsed, when I query Redis, then the key no longer exists.
  - [ ] Given Redis is unreachable, when I call any authenticated route, then I get `503 UNAVAILABLE` with `Retry-After`.

**FR-AUTH-4: Protected routes and permissions**
- **As the** system **I need to** deny every request that lacks authentication or permission **so that** data stays private.
- **Rules:** Admin holds `doctors:read|write`, `patients:read|write`, `dashboard:read`. Viewer holds the three `read` permissions. Every API route declares one permission. Pages are also gated by Next.js middleware.
- **Acceptance criteria:**
  - [ ] Given no cookie, when I request any page except `/login`, then I am redirected to `/login`; and any `/api/v1` route except `/auth/login` and `/health` returns `401`.
  - [ ] Given a Viewer, when they call `POST /doctors`, then the API returns `403 FORBIDDEN` and the UI shows no write controls.

### Doctors

**FR-DOC-1: Create a doctor**
- **As an** Admin **I need to** register a doctor **so that** patients can be assigned.
- **Rules:** `name` 2–100 characters; `specialization` 2–80; `hospital` 2–120; `phone` in E.164 format; `email` valid and unique (case-insensitive).
- **Behaviour:** `POST /doctors` returns `201` with the doctor; a `doctor.registered` event is written to the outbox in the same transaction.
- **Acceptance criteria:**
  - [ ] Given valid fields, when I submit, then the doctor appears at the top of the list and the dashboard doctor total increases by 1 within 2 seconds.
  - [ ] Given an email that already exists, when I submit, then the API returns `409 CONFLICT` and the form marks the email field.
  - [ ] Given an invalid phone, when I submit, then the API returns `422 VALIDATION_FAILED` with `errors[].field = "phone"`.

**FR-DOC-2: List, search, filter and paginate doctors**
- **As a** user **I need to** find doctors quickly **so that** I can open the right record.
- **Rules:** `limit` default 20, maximum 100; search `q` matches name, specialization and hospital, debounced 300 ms in the UI; filters `specialization`, `hospital`, `from`/`to` on `createdAt`; sort by `createdAt` (default, descending), `name` or `patientCount`; the state of search, filters, sort and page is in the URL.
- **Behaviour:** the response is `{ data, meta: { page, limit, total, totalPages } }`, and each row carries `id`, `name`, `specialization`, `hospital`, `patientCount`, `createdAt` only.
- **Acceptance criteria:**
  - [ ] Given 10,000 doctors, when I search, filter and page, then p95 latency is under 300 ms and `explain()` shows an index scan.
  - [ ] Given a filter that matches nothing, when the list loads, then the page shows an empty state with a "Clear filters" action and `meta.total` is 0.
  - [ ] Given I copy the URL of a filtered page, when another user with access opens it, then they see the same filters applied.

**FR-DOC-3: View a doctor and their patients**
- **As a** user **I need to** open a doctor **so that** I see their details and patients.
- **Behaviour:** `/doctors/:id` shows the doctor's fields and a paginated patient list (`GET /doctors/:id/patients`) with search and a condition filter.
- **Acceptance criteria:**
  - [ ] Given a doctor with 45 patients, when I open the page, then I see 20 rows, `total` 45 and 3 pages.
  - [ ] Given an id that does not exist, when I open the page, then I see a not-found state and the API returned `404 NOT_FOUND`.

**FR-DOC-4: Add a patient under a doctor**
- **As an** Admin **I need to** add a patient from the doctor's page **so that** the patient is assigned immediately.
- **Behaviour:** `POST /doctors/:id/patients` with the patient fields from FR-PAT; `patients` checks the doctor exists through the `DoctorDirectory` port.
- **Acceptance criteria:**
  - [ ] Given a valid patient, when I submit, then the row appears in the list and the doctor's `patientCount` becomes the new count within 2 seconds.
  - [ ] Given a doctor id that does not exist, when I submit, then the API returns `404 NOT_FOUND` and nothing is written.

**FR-DOC-5: Remove a patient from a doctor's list**
- **As an** Admin **I need to** remove a patient **so that** the list stays correct.
- **Behaviour:** `DELETE /doctors/:id/patients/:patientId` returns `204`. The UI removes the row immediately and restores it with an error toast if the call fails.
- **Acceptance criteria:**
  - [ ] Given a patient under the doctor, when I confirm deletion, then the row disappears, the API returns `204`, and `patientCount` decreases by 1 within 2 seconds.
  - [ ] Given the patient belongs to a different doctor, when the call is made, then the API returns `404 NOT_FOUND` and nothing is deleted.
  - [ ] Given the network fails, when I confirm deletion, then the row returns and an error toast appears.

### Patients

**FR-PAT-1: Patient fields**
- **Rules:** `name` 2–100 characters; `dateOfBirth` a past date, age ≤ 130 years; `gender` one of `female`, `male`, `other`; `phone` E.164; `email` valid; `condition` one of `stable`, `under_observation`, `critical`, `recovered`; `diagnosis` up to 500 characters; `admittedAt` not in the future; `doctorId` an existing doctor.

**FR-PAT-2: List, search, filter and paginate patients**
- **As a** user **I need to** search all patients **so that** I can find one without knowing their doctor.
- **Rules:** same pagination and URL-state rules as FR-DOC-2; search `q` matches name and diagnosis; filters `condition`, `doctorId`, `from`/`to` on `createdAt`; each row carries `id`, `name`, `condition`, `doctorId`, doctor name, `admittedAt`.
- **Acceptance criteria:**
  - [ ] Given 100,000 patients, when I search, filter by condition and page, then p95 latency is under 300 ms and `explain()` shows no `COLLSCAN`.
  - [ ] Given I filter by condition `critical` and doctor X, when the list loads, then every row matches both and `meta.total` equals that count.

**FR-PAT-3: Edit a patient**
- **As an** Admin **I need to** correct a patient's data **so that** records stay accurate.
- **Behaviour:** `PATCH /patients/:id` accepts any subset of the fields in FR-PAT-1; changing `condition` emits `patient.condition_changed`.
- **Acceptance criteria:**
  - [ ] Given I change a condition from `critical` to `stable`, when I save, then the row shows the new value and the condition breakdown on the dashboard reflects it within 2 seconds.
  - [ ] Given an invalid email, when I save, then the API returns `422 VALIDATION_FAILED` and the stored record is unchanged.

**FR-PAT-4: Delete a patient**
- **As an** Admin **I need to** delete a patient **so that** removed records are gone.
- **Behaviour:** `DELETE /patients/:id` returns `204`; the UI behaves as in FR-DOC-5.
- **Acceptance criteria:**
  - [ ] Given an existing patient, when I confirm, then a following `GET /patients/:id` returns `404 NOT_FOUND`.
  - [ ] Given a Viewer, when they call the endpoint, then the API returns `403 FORBIDDEN`.

### Dashboard

**FR-DASH-1: Totals**
- **Behaviour:** `GET /dashboard/summary` returns total doctors and total patients, read from `analytics_totals`.
- **Acceptance criteria:**
  - [ ] Given a seeded dataset, when the projection has settled, then both totals equal `countDocuments` on the source collections.
  - [ ] Given a response time budget of 200 ms, when I load the dashboard, then p95 of the call is under 200 ms.

**FR-DASH-2: Patients per doctor**
- **Behaviour:** `GET /dashboard/patients-per-doctor` returns the top 10 doctors by patient count as a bar chart, with names.
- **Acceptance criteria:**
  - [ ] Given doctors with different counts, when I load the chart, then bars are sorted descending and each value equals that doctor's `patientCount`.
  - [ ] Given fewer than 10 doctors, when I load the chart, then only existing doctors are shown.

**FR-DASH-3: Registrations over time**
- **Behaviour:** `GET /dashboard/timeseries` returns patients (and doctors) created per day, week or month for a window of 7, 30 or 90 days or a custom `from`/`to`; days without data return 0.
- **Rules:** a custom range is at most 366 days.
- **Acceptance criteria:**
  - [ ] Given the 30-day window, when I load the chart, then the series has exactly 30 daily points, with zeros where nothing was created.
  - [ ] Given a custom range longer than 366 days, when I submit, then the API returns `422 VALIDATION_FAILED`.

**FR-DASH-4: Patients by condition**
- **Behaviour:** `GET /dashboard/conditions` returns counts for the four conditions, shown as a chart with a table alternative for screen readers.
- **Acceptance criteria:**
  - [ ] Given any dataset, when I load it, then the four counts sum to total patients.
  - [ ] Given the projection is rebuilt with `make rebuild-analytics`, when it finishes, then the counts are identical to before the rebuild.

### Platform

**FR-API-1: Uniform responses and errors**
- **Rules:** success is `{ data, meta? }`; errors are RFC 9457 Problem Details with `code`, `requestId` and, where relevant, `errors[]` or `retryAfter`; every response carries `X-Request-Id`; catalogue and examples are in `API_CONTRACT.md`.
- **Acceptance criteria:**
  - [ ] Given any failing request, when I read the response, then `Content-Type` is `application/problem+json` and `code` is one of the ten catalogued values.
  - [ ] Given an unexpected exception, when it occurs, then the body is `500 INTERNAL_ERROR` with no stack trace and the log line carries the same `requestId`.

**FR-API-2: Rate limiting**
- **Rules:** the policies in `API_CONTRACT.md`; headers `RateLimit-Policy`, `RateLimit` and, on rejection, `Retry-After`; client IP comes from the proxy's `X-Forwarded-For` and nothing else.
- **Acceptance criteria:**
  - [ ] Given 61 write requests from one user within 60 seconds, when the 61st arrives, then it receives `429 RATE_LIMITED` and `Retry-After` between 1 and 60.
  - [ ] Given a request with a forged `X-Forwarded-For` sent directly to the API from outside the proxy network, when it arrives, then the forged value is ignored.

**FR-API-3: Swagger documentation**
- **Rules:** OpenAPI 3.1 generated from the Zod contracts, served at `/openapi.json`, UI at `/docs`.
- **Acceptance criteria:**
  - [ ] Given the registered routes, when the contract test runs, then every route is in the document and every documented route is registered.
  - [ ] Given I open `/docs`, when I authorize with the seeded admin, then I can execute `GET /doctors` from the page.

### Interface

**FR-UX-1: Navigation and layout**
- **Behaviour:** persistent navigation between Dashboard, Doctors and Patients; the layout is designed at 390, 768 and 1440 px; the active section is indicated.
- **Acceptance criteria:**
  - [ ] Given a 390 px viewport, when I use any page, then there is no horizontal scrolling and every action is reachable.
  - [ ] Given I use only the keyboard, when I move through a page, then focus order follows reading order and focus is visible.

**FR-UX-2: Loading, empty and error states**
- **Behaviour:** every list and chart has a skeleton while loading, an empty state, and an error state with a retry; a `429` shows the wait time and retries once after `Retry-After`.
- **Acceptance criteria:**
  - [ ] Given the API is slowed to 2 seconds, when a list loads, then a skeleton is shown and layout does not shift when data arrives.
  - [ ] Given the API returns `500`, when a chart loads, then an error state with a retry control is shown and the rest of the page remains usable.

**FR-DOCS-1: README**
- **Behaviour:** `README.md` has the five required sections: Description, Setup Guide with `.env.example`, System Architecture, Technical Decisions (two, in depth), Visual Evidence (desktop and mobile screenshots).
- **Acceptance criteria:**
  - [ ] Given a clean machine with Docker, when I follow the setup guide, then `make up` starts the stack and I can sign in with the seeded admin.
  - [ ] Given the README, when I count screenshots, then there are at least 3 desktop and 3 mobile images.

## 6. User Journeys

**J1 — Sign in and read the dashboard.** Open the app → redirected to `/login` → enter credentials → dashboard with totals and charts. Failure branches: wrong password (message, no enumeration); 5 failed attempts (rate-limited message with wait time); API unavailable (error state).

**J2 — Register a doctor and add a patient.** Doctors → Add doctor → fill the form → doctor appears in the list → open the doctor → Add patient → patient appears and `patientCount` updates → dashboard totals update. Failure branches: duplicate email (field error); validation errors (field errors); network failure (form kept, error toast).

**J3 — Find, correct and remove a patient.** Patients → search by name → filter by condition → open the row → edit the condition → save → delete a different patient → confirm → row disappears. Failure branches: delete fails (row restored); the record was already removed by someone else (not-found toast and the list refreshes).

**J4 — Log out.** Open the user menu → Log out → redirected to `/login`; the previous access token is rejected for the rest of its life.

**J5 — Viewer.** Sign in → dashboard, doctors and patients are readable → write controls are not rendered; a direct write call returns `403`.

## 7. Data

Fields, indexes and rules: `DATA_MODEL.md`.

| Entity | Key fields | Relationships | States | Retention |
|---|---|---|---|---|
| User | email, role | none | active, inactive | until removed |
| Doctor | name, specialization, hospital, email | has many Patients | active, inactive | until removed |
| Patient | name, condition, diagnosis, admittedAt | belongs to one Doctor | condition: stable, under_observation, critical, recovered | until deleted |
| Event (outbox) | type, payload | n/a | pending, claimed, published | 7 days after publish |
| Audit entry | eventType, actorId | n/a | append-only | 365 days |
| Analytics rows | date, doctorId, condition, counters | n/a | rebuildable | derived |

Invariants:
- A patient always references an existing doctor.
- `doctor.patientCount` equals the number of that doctor's patients once projections have settled (target under 2 seconds).
- A doctor's email is unique, case-insensitively; a user's email is unique.
- The domain write and its event commit in one transaction or not at all.

Personal data: patient name, date of birth, phone, email and diagnosis. Logs carry ids, never these fields. Passwords are stored only as Argon2id hashes.

## 8. Integrations

No external systems. Infrastructure services owned by the project:

| System | Direction | What it does | Auth | API exists? | Owner of credentials | Risk |
|---|---|---|---|---|---|---|
| MongoDB (replica set) | internal | data, outbox, read models | credentials in env | verified | project | transactions need a replica set |
| NATS JetStream | internal | event streams | credentials in env | verified | project | one more service to run |
| Redis | internal | token blacklist, rate limits, cache | credentials in env | verified | project | hard dependency; outage returns `503` |

## 9. Non-Functional Requirements

- **Performance:** p95 under 300 ms for list, search and filter calls and under 200 ms for dashboard calls, measured on 10,000 doctors and 100,000 patients with one `api` replica; first contentful paint under 1.5 s on a throttled 4G profile for the dashboard; page-size cap 100.
- **Availability:** single VPS, 99% monthly target; a Redis, Mongo or NATS outage is reported by `/ready` and returns `503`, never a wrong answer.
- **Security:** ES256 JWT with `typ` claim checked on every parse; httpOnly, Secure, SameSite=Lax cookies; Argon2id; role permissions on every route; blacklist on logout; per-endpoint rate limits; `helmet` headers and a strict CSP on the web app; all input validated by the shared Zod schemas; secrets only in environment variables.
- **Privacy and compliance:** health-related personal data is minimised to the fields in FR-PAT-1; no personal data in logs or error bodies; the deployment owner is the data controller; formal regulatory compliance (for example HIPAA) is outside v1.
- **Accessibility:** WCAG 2.2 AA; verified with axe on the three main pages and a keyboard-only pass; charts have a table alternative.
- **Browsers and devices:** latest two versions of Chrome, Firefox, Safari and Edge; iOS Safari and Android Chrome latest two; layouts at 390, 768 and 1440 px.
- **Localisation:** English; dates shown in the browser's locale, stored in UTC.
- **Observability:** JSON logs with `requestId`; `/health` and `/ready`; metrics for outbox lag, consumer pending, DLQ depth and rate-limit rejections.

## 10. Design Direction

Intended feel: calm, dense, precise. A restrained palette with one accent colour, two typefaces at most, real whitespace, and tables that stay readable at 100 rows. The brand inputs and references are not yet chosen.

Design gate: `DESIGN-GUIDELINES.md` (tokens, type scale, a measured contrast table, motion rules) and a page spec for each of login, dashboard, doctors, doctor detail and patients (component inventory plus behaviour at 390, 768 and 1440 px) must exist before any UI code is written. This is phase P5 in `plan/PHASES.md`.

## 11. Release Plan

| Phase | Contains | Gate |
|---|---|---|
| P0 Foundation | workspace, compose, shared kernel, Swagger skeleton, arch checks, CI | stack boots, `/ready` green |
| P1 Event backbone | outbox, relay, JetStream, idempotent consumers | write → event → effect exactly once, survives restart |
| P2 Identity | login, refresh, logout, blacklist, RBAC, rate limits | the auth acceptance criteria pass |
| P3 Doctors and patients API | aggregates, queries, indexes, `patientCount` | contract tests, no `COLLSCAN` |
| P4 Analytics and audit | projections, dashboard API, cache, audit | projection equals fresh aggregation; latency targets |
| P5 Design system | guidelines and page specs | documents complete |
| P6 Web app | all screens | typecheck, lint, build, Playwright journeys |
| P7 Hardening and delivery | seed volume, load, Lighthouse, deploy, README | all criteria in section 5 ticked; live link works |

Details: `plan/PHASES.md`.

## 12. Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Dashboard is eventually consistent | Certain | Low | state "updated at"; target lag under 2 s; rebuild command | Engineering |
| Replica set needed for transactions is misconfigured on the VPS | Medium | High | compose service with `--replSet` and an init script; `/ready` checks it | Engineering |
| Outbox relay duplicates or stalls | Medium | High | `Nats-Msg-Id` dedup, idempotent consumers, lag metric and alert | Engineering |
| Rate-limit headers are an IETF draft and may change | Medium | Low | isolated in one module; `Retry-After` and `429` are the stable contract | Engineering |
| Redis outage blocks login and all authenticated calls | Low | High | hard dependency by design, `/ready`, restart policy, documented | Engineering |
| Architecture is heavier than the feature set needs | Medium | Medium | each part has a feature that needs it (dashboard read model, counters, audit); documented trade-offs | Engineering |
| Proxy IP handling is wrong and users share one rate limit | Medium | High | exact `trust proxy`, integration test with forged header | Engineering |

## 13. Assumptions

1. Roles are `admin` and `viewer`; accounts are seeded, not self-registered.
2. A patient belongs to exactly one doctor.
3. Patient fields are those in FR-PAT-1.
4. Doctors are never deleted; deactivation is deferred (D-19).
5. "Date-based statistics" means records created per day, week or month (D-20).
6. Doctor filters are specialization, hospital and created date; patient filters are condition, doctor and created date.
7. The dashboard windows are 7, 30 and 90 days plus a custom range of at most 366 days (D-20).
8. Swagger UI is public on the demo; seeded credentials are in the README (D-21).
9. The service runs on one VPS with Docker Compose.
10. The brief's technology section is read as: separate Next.js app and Express API over REST (D-3).

## 14. Open Questions

None blocking.

## 15. Approval

| Name | Role | Approves | Date |
|---|---|---|---|
| Azmain Mahtab | Owner | Scope and phases | |
