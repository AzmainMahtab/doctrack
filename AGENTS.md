# AGENTS.md

Doctor Tracker — admin web app to manage doctors and their patients, with a analytics dashboard.

All durable project records live in `.project-doc/`. Plain Markdown, no tool-specific formats. Any agent, model or harness (Claude Code, opencode, Cursor, Aider, a human) uses the same files.

## Read before starting

1. `.project-doc/docs/PROJECT_KNOWLEDGE.md` — what the product is, scope, stack, conventions
2. `.project-doc/status/STATUS.md` — where the work stands right now
3. `.project-doc/memory/DECISIONS.md` — decisions already made and open questions
4. `.project-doc/docs/ARCHITECTURE.md` — modules, event flow, processes
5. `.project-doc/plan/BACKLOG.md` — ordered work

## Update as work lands

- `status/STATUS.md` after every meaningful change
- `memory/DECISIONS.md` when a decision is made or an open question is closed
- `memory/LEARNINGS.md` for non-obvious things discovered
- `plan/BACKLOG.md` to tick off or reorder tasks

Stale status is worse than none.

## Rules

- Every requirement traces to `.project-doc/context/raw/`. Anything not in the brief is a labelled assumption in `docs/REQUIREMENTS.md`.
- No comments in code unless asked.
- Never commit unless asked. Never commit on `dev` or `main`; branch `feature/<name>` first.
- Branch flow: feature → `dev` → `main` (production only).
- Run the stack's quality gate (lint + typecheck + tests) before declaring work done.
