# Status

Updated: 2026-11-14

## Phase

P4 Analytics and audit complete on `feature/p4-analytics-audit` (not yet merged). Next: P5 Design system.

## Done

- Records, PRD and phases; P0 to P3 merged into `dev`
- P4: `analytics` module (projection consumer, dashboard routes, Redis cache with post-commit invalidation, reconcile and rebuild), `audit` module (one row per event with the acting user, 365-day retention), `registeredOn` on registration and removal events, `actorId` on the event envelope, public count APIs on the doctors and patients modules, `make rebuild-analytics`
- P4 gate verified: 90 API unit tests, 17 contract tests and 98 integration tests pass. On 1,000 doctors and 100,000 patients every dashboard endpoint has a p95 under 200 ms, cached and uncached. The projection equals a fresh aggregation after a mixed live workload, a rebuild is identical on a second run, duplicate and out-of-order events converge. On the running stack the dashboard follows adds, edits and deletes within the poll interval, `make rebuild-analytics ARGS=--check` reports no drift, and all consumers show 0 pending with 0 dead letters
- Defects the tests found: staff email in `user.logged_in` events (removed), MongoDB hitting the 1,024 open-file limit (raised to 64,000), a cache shared across test databases (namespaced)

## Next

- Merge the P4 PR into `dev`
- P5 Design system (guidelines, tokens, contrast table, page specs) before any UI code
- P7 reruns the `explain()` checks at 10,000 doctors and 100,000 patients with the seed script

## Blockers

None.
