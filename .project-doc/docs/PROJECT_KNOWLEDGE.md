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
├── docker-compose.yml  (+ docker-compose.dev.yml)
├── .env.example
├── infra/mongo/
├── .project-doc/
├── apps/
│   ├── api/        # Express modular monolith; entry points server.ts and worker.ts
│   └── web/        # Next.js
└── packages/
    └── contracts/  # Zod schemas and DTO types shared by api and web
```

## Commands

| Command | Purpose |
|---------|---------|
| `make init` | `.env` with generated secrets, Mongo keyfile, install dependencies |
| `make up` / `make down` | Full stack in Docker; web on `:3000`, Swagger at `http://localhost:8080/docs` |
| `make dev` | Infrastructure in Docker, api + worker + web on the host with hot reload |
| `make check` | lint, format, typecheck, `check:arch`, unit tests, build |
| `make test-integration` | Tests against real MongoDB, Redis and NATS |
| `make migrate` | Ensure MongoDB indexes |
| `make seed` | Create the demo accounts `admin@doctrack.dev` and `viewer@doctrack.dev` (passwords from `SEED_*` in `.env`) |
| `make rebuild-analytics` | Recompute the dashboard read model; `ARGS=--check` only verifies |
| `make test-integration TEST=<name>` | Run one integration file |
| worker metrics | `docker compose exec worker wget -qO- http://127.0.0.1:9090/metrics` |

## Documents

| File | Purpose |
|------|---------|
| `PRD.md` | Product requirements with acceptance criteria |
| `ARCHITECTURE.md` | Modules, layers, event flow, processes, failure handling |
| `REQUIREMENTS.md` | Requirement IDs traced to the brief, out-of-scope list, assumptions |
| `DATA_MODEL.md` | Collections, fields, indexes, query rules |
| `API_CONTRACT.md` | Endpoints |
| `../design/DESIGN-GUIDELINES.md` | The design system: tokens, contrast table, type, space, motion, component rules |
| `../design/pages/*.md` | One spec per page: sections, component inventory with code paths, responsive behaviour at 390 / 768 / 1440, motion, interaction |
| `../plan/PHASES.md` | Development phases P0–P7 with gates |
| `../plan/BACKLOG.md` | Phase checklist |
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
