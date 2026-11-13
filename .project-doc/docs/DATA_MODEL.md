# Data Model (MongoDB)

Draft. Public identity is a UUIDv7 `id`; Mongo `_id` is the same value for aggregates. Dates are UTC.

## users

| Field | Type | Notes |
|-------|------|-------|
| _id | uuid | |
| email | string | unique, lowercase |
| passwordHash | string | Argon2id |
| role | `admin` \| `viewer` | |
| isActive | boolean | |
| createdAt | Date | |

Indexes: `{ email: 1 }` unique.

## refresh_tokens

| Field | Type |
|-------|------|
| _id | uuid (`jti`) |
| userId | uuid |
| familyId | uuid |
| rotatedAt | Date \| null |
| expiresAt | Date |

Indexes: `{ userId: 1 }`, `{ familyId: 1 }`, `{ expiresAt: 1 }` TTL.

## doctors

| Field | Type | Notes |
|-------|------|-------|
| _id | uuid | |
| name | string | |
| specialization | string | |
| hospital | string | |
| phone | string | |
| email | string | unique |
| patientCount | number | projection maintained by a consumer |
| createdAt, updatedAt | Date | |

Indexes:

- `{ email: 1 }` unique
- `{ createdAt: -1, _id: -1 }` default sort and date filter
- `{ specialization: 1, createdAt: -1 }`
- `{ hospital: 1, createdAt: -1 }`
- `{ patientCount: -1 }` patients-per-doctor ranking
- text index on `name`, `specialization`, `hospital`

## patients

| Field | Type | Notes |
|-------|------|-------|
| _id | uuid | |
| doctorId | uuid | |
| name | string | |
| dateOfBirth | Date | |
| gender | `female` \| `male` \| `other` | |
| phone | string | |
| email | string | |
| condition | `stable` \| `under_observation` \| `critical` \| `recovered` | |
| diagnosis | string | |
| admittedAt | Date | |
| createdAt, updatedAt | Date | |

Indexes:

- `{ doctorId: 1, createdAt: -1, _id: -1 }` a doctor's patient list
- `{ condition: 1, createdAt: -1 }`
- `{ createdAt: -1, _id: -1 }`
- `{ admittedAt: -1 }`
- text index on `name`, `diagnosis`

No cross-collection foreign keys are enforced by the database; the `doctors` module's `DoctorDirectory` port checks existence at write time.

## outbox

| Field | Type | Notes |
|-------|------|-------|
| _id | uuid | event id (UUIDv7) |
| type | string | e.g. `patient.registered` |
| aggregateId | uuid | |
| payload | object | |
| meta | object | `correlationId`, `occurredAt`, `actorId` |
| status | `pending` \| `claimed` \| `published` | |
| leaseUntil | Date \| null | |
| publishedAt | Date \| null | |

Indexes: `{ status: 1, _id: 1 }` relay scan, `{ leaseUntil: 1 }` partial on `claimed`, `{ publishedAt: 1 }` TTL (7 days).

## processed_events

`{ consumer, eventId }` unique, `{ processedAt: 1 }` TTL (30 days). Written in the same transaction as the consumer's effect.

## analytics_daily

| Field | Type |
|-------|------|
| _id | `"<yyyy-mm-dd>:<doctorId>:<condition>"` |
| date | Date (day) |
| doctorId | uuid |
| condition | enum |
| registered | number |
| removed | number |

Indexes: `{ date: 1 }`, `{ doctorId: 1, date: 1 }`.

## analytics_totals

Single document `{ _id: "totals", doctors, patients, updatedAt }`, incremented with `$inc`.

## audit_log

Append-only: `{ _id, eventType, aggregateId, actorId, correlationId, occurredAt, payload }`. Indexes: `{ aggregateId: 1, occurredAt: -1 }`, `{ occurredAt: -1 }`.

## Query rules

- Lists use page + limit (capped at 100) with `total` from a count over the same filter; projection on every list.
- Dashboard reads `analytics_*`, never `patients` or `doctors` in bulk.
- Every hot query is checked with `explain("executionStats")` in an integration test that fails on `COLLSCAN`.
- All writes that emit events use a session transaction that includes the outbox insert.
