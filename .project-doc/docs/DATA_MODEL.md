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
| --- | --- | --- |
| _id | uuid | |
| name | string | trimmed |
| nameLower | string | accent-stripped, lowercase; name sort key |
| specialization | string | |
| hospital | string | |
| phone | string | E.164 |
| email | string | unique, stored lowercase |
| patientCount | number | maintained by the `doctors-patient-count` consumer |
| isActive | boolean | always true in v1 (D-19) |
| searchTokens | string[] | lowercase words of name, specialization, hospital (max 32) |
| createdAt, updatedAt | Date | |

Indexes:

- `{ email: 1 }` unique
- `{ createdAt: -1, _id: -1 }` default sort and date filter
- `{ specialization: 1, createdAt: -1, _id: -1 }`
- `{ hospital: 1, createdAt: -1, _id: -1 }`
- `{ patientCount: -1, _id: -1 }` patients-per-doctor ranking
- `{ nameLower: 1, _id: 1 }` name sort
- `{ searchTokens: 1 }` word-prefix search (multikey)

## patients (A-2, A-3)

| Field | Type | Notes |
| --- | --- | --- |
| _id | uuid | |
| doctorId | uuid | |
| doctorName | string | copy taken when the patient is admitted (D-40) |
| name | string | trimmed |
| nameLower | string | name sort key |
| dateOfBirth | Date | UTC midnight |
| gender | `female` \| `male` \| `other` | |
| phone | string | E.164 |
| email | string | lowercase |
| condition | `stable` \| `under_observation` \| `critical` \| `recovered` | |
| diagnosis | string | up to 500 characters |
| admittedAt | Date | |
| searchTokens | string[] | lowercase words of name and diagnosis (max 32) |
| createdAt, updatedAt | Date | |

Indexes:

- `{ doctorId: 1, createdAt: -1, _id: -1 }` a doctor's patient list
- `{ doctorId: 1, condition: 1, createdAt: -1, _id: -1 }`
- `{ condition: 1, createdAt: -1, _id: -1 }`
- `{ createdAt: -1, _id: -1 }`
- `{ admittedAt: -1, _id: -1 }`
- `{ nameLower: 1, _id: 1 }`
- `{ searchTokens: 1 }`

No cross-collection foreign keys are enforced by the database; the patients module's `DoctorDirectory` port checks the doctor at write time.

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
| attempts | number | failed publish attempts |
| claimToken | uuid \| null | identifies the relay batch that holds the row |

Indexes: `{ status: 1, _id: 1 }` relay scan, `{ leaseUntil: 1 }` partial on `claimed`, `{ publishedAt: 1 }` TTL (7 days).

## processed_events

`{ consumer, eventId }` unique, `{ processedAt: 1 }` TTL (30 days). Written in the same transaction as the consumer's effect.

## analytics_totals

One document `{ _id: "totals", doctors, patients, conditions: { stable, under_observation, critical, recovered }, updatedAt }`, changed only with `$inc` by the projection consumer, or replaced by `make rebuild-analytics`. Reads clamp negative values to 0.

## analytics_daily

One document per UTC day: `{ _id: "YYYY-MM-DD", patients, doctors }`, the number of records that currently exist and were registered that day (D-45). The bucket is the event's `registeredOn`. The sum over all days equals the totals. Indexed by `_id` only; range reads use the `_id` range.

## audit_log

Append-only, one row per event: `{ _id: eventId, eventType, aggregateId, actorId, correlationId, occurredAt, payload }`.

Indexes: `{ aggregateId: 1, occurredAt: -1 }`, `{ occurredAt: -1 }`, TTL `{ occurredAt: 1 }` after 365 days.

## Query rules

- Lists use page + limit (capped at 100). `total` is `countDocuments(filter)`, or `estimatedDocumentCount()` when there is no filter (D-43). Every list uses a projection.
- Dashboard reads `analytics_*` and the top of `doctors.patientCount`, never `patients` or `doctors` in bulk.
- Every hot query is checked with `explain("executionStats")` in an integration test that fails on `COLLSCAN`.
- All writes that emit events use a session transaction that includes the outbox insert.
