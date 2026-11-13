# Learnings

- The brief PDF's §6 Tech Stack is a merge of two versions of the text (extraction shows duplicated, overlapping lines). It cannot be read as one consistent statement. See OQ-1 in `DECISIONS.md`.
- The brief weights query optimization and Mongo indexing as heavily as UI. Index design belongs in `docs/DATA_MODEL.md` before any list endpoint is written.
- Behind a proxy every user shares the proxy's IP. Rate limiting by IP needs the proxy to forward the real client IP and the API to trust exactly those hops, otherwise one user can exhaust the limit for everyone, or a client can spoof the header.
- The `RateLimit` / `RateLimit-Policy` headers are an IETF draft, not an RFC; only `429` and `Retry-After` are stable. In the draft, `t` is seconds until reset, never an epoch timestamp.
- Login limits must count failed attempts and reset on success, and return the same body whether or not the account exists.
- pnpm 12 blocks dependency build scripts until approved; `pnpm approve-builds esbuild '!@scarf/scarf'` writes `allowBuilds` into `pnpm-workspace.yaml`.
- Alpine images resolve `localhost` to IPv6 first, so health checks must use `127.0.0.1` when the service listens on IPv4 only.
- Mongo with a keyfile needs mode 400 and mongodb ownership; the entrypoint wrapper copies the mounted secret to `/data/configdb/keyfile` and fixes permissions.
- Host-side tools reach the replica set with `directConnection=true`, because the replica set advertises the in-network host name `mongo:27017`.
- dependency-cruiser: for npm packages the `to.path` is the resolved `node_modules/...` path, so rules match `node_modules/<name>/`, not the bare module name.
- Validation must collect issues from params, query and body together; failing on the first group hides errors from the client.
- NATS header values cannot contain line breaks; a Zod error message made the dead-letter publish fail until it was flattened to one line and truncated.
- Durable consumers created with `deliver_policy: all` replay old events, so integration tests give each consumer its own event area (`<name>.>`) instead of sharing one subject.
- A crashed relay leaves rows `claimed` until the lease expires (30 s by default); recovery is automatic, and rows already published are deduplicated by `Nats-Msg-Id`, so the stream holds one message per event.
- `MongoUnitOfWork` uses `session.withTransaction`, which may re-run the callback on a transient error, so work inside a transaction must be safe to repeat.
