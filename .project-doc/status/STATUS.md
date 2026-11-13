# Status

Updated: 2026-11-14

## Phase

P1 Event backbone complete on `feature/p1-event-backbone`. Next: P2 Identity.

## Done

- Records, PRD and phases (D-1..D-28); git flow recorded and merged (PR #1)
- P0 Foundation, released to `main`
- P1 Event backbone: unit of work and transaction context, outbox event bus, relay (claim lease, poll plus change-stream wake-up), JetStream streams (`DOMAIN_EVENTS`, `DEAD_LETTERS`), durable consumer runner with idempotency, retry and dead-lettering, worker `/health` `/ready` `/metrics`, `check:arch` rule that only `platform/messaging` imports NATS
- P1 gate verified: 36 unit and 19 integration tests pass; on the running stack 510 outbox rows reached the stream exactly once each, including after killing the worker mid-batch (recovery after the 30 s lease)

## Next

- Merge the P1 PR into `dev`
- P2 Identity, on `feature/p2-identity` from `dev`

## Blockers

None.
