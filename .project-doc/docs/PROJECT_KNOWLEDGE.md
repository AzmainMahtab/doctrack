# Project Knowledge — Doctor Tracker

Entry point. Read this first, then `ARCHITECTURE.md`.

## Product

Secure admin web app to manage doctors and their patients, with a dashboard of charts and aggregates. Source brief: `../context/raw/`. Summary: `../context/BUSINESS_CONTEXT.md`.

Three areas: **Dashboard**, **Doctors**, **Patients**, behind login.

## Stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict), Node 24, pnpm workspaces |
| Web | Next.js (App Router), TanStack Query, nuqs, Tailwind, Recharts |
| API | Express, Zod (from `packages/contracts`), pino, OpenAPI 3.1 via zod-to-openapi + Swagger UI |
| Database | MongoDB replica set, native driver |
| Broker | NATS JetStream behind a transactional outbox |
| Token blacklist / rate limit / cache | Redis |
| Tokens | ES256 JWT in httpOnly cookies |
| Quality | eslint, prettier, tsc, `check:arch` (dependency-cruiser), vitest |
| Runtime | docker compose, single VPS |

Decisions and their reasons: `../memory/DECISIONS.md`.

## Layout

```
doctrack/
├── AGENTS.md
├── Makefile
├── docker-compose.yml
├── .env.example
├── .project-doc/
├── apps/
│   ├── api/        # Express modular monolith; entry points server.ts and worker.ts
│   └── web/        # Next.js
└── packages/
    └── contracts/  # Zod schemas and DTO types shared by api and web
```

## Commands (planned, Makefile)

`make init` · `make up` · `make dev` · `make seed` · `make migrate` · `make check` · `make test` · `make test-integration`

## Documents

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Modules, layers, event flow, processes, failure handling |
| `REQUIREMENTS.md` | Requirement IDs traced to the brief, out-of-scope list, assumptions |
| `DATA_MODEL.md` | Collections, fields, indexes, query rules |
| `API_CONTRACT.md` | Endpoints |
| `../plan/BACKLOG.md` | Ordered work |
| `../status/STATUS.md` | Current state |

## Non-negotiables

- Auth and permission checks on every route, enforced server-side; logged-out tokens are blacklisted for their remaining life.
- Every route has a rate-limit policy and an OpenAPI entry; success responses use `{ data, meta }` and errors are RFC 9457 Problem Details.
- Redis is a hard dependency; nothing fails open.
- Every list endpoint paginates, and every filter/search/sort used is backed by an index.
- Dashboard numbers come from a pre-aggregated read model, not from counting documents per request.
- Events are written to the outbox in the same transaction as the data. Consumers are idempotent.
- A module is reached only through its `index.ts` or its published events.
- Responsive at 390 / 768 / 1440.
- A required `README.md` (five sections, `.env.example`, desktop + mobile screenshots) ships at the end.
