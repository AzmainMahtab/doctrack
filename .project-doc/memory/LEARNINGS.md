# Learnings

- The brief PDF's §6 Tech Stack is a merge of two versions of the text (extraction shows duplicated, overlapping lines). It cannot be read as one consistent statement. See OQ-1 in `DECISIONS.md`.
- The brief weights query optimization and Mongo indexing as heavily as UI. Index design belongs in `docs/DATA_MODEL.md` before any list endpoint is written.
- Behind a proxy every user shares the proxy's IP. Rate limiting by IP needs the proxy to forward the real client IP and the API to trust exactly those hops, otherwise one user can exhaust the limit for everyone, or a client can spoof the header.
- The `RateLimit` / `RateLimit-Policy` headers are an IETF draft, not an RFC; only `429` and `Retry-After` are stable. In the draft, `t` is seconds until reset, never an epoch timestamp.
- Login limits must count failed attempts and reset on success, and return the same body whether or not the account exists.
