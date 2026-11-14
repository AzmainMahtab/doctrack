# Doctrack — Login Design Spec

**Canvas:** `/home/odin/Documents/doctrack.pen`, node `xrlWs` "Login 1440"
**Guidelines:** `../DESIGN-GUIDELINES.md`
**Status:** Ready for build
**Last updated:** 2026-11-14

## Purpose

Let a staff member sign in. Route `/login`; every other route redirects here without a session.
**Primary action:** Sign in.
**Secondary action:** none.

## Sections, in order

| # | Section | Canvas node | Purpose |
|---|---|---|---|
| 1 | Form column | `Form column` | Wordmark, heading, email and password fields, submit |
| 2 | Statement column | `Statement column` | One serif sentence on a sunken ground; authored silence, nothing else |

States drawn on `States 1440`: sign-in error (`Sign in error`), rate limited (`Rate limit notice`).

## Component inventory

| Component | Canvas node | Code path | Props | Used on |
|---|---|---|---|---|
| `LoginForm` | `Sign in form` | `apps/web/src/features/auth/components/login-form.tsx` | `action`, `error?`, `retryAfter?` | Login |
| `TextField` | `TextField` | `apps/web/src/components/ui/text-field.tsx` | `label`, `type`, `hint?`, `error?`, `autoComplete` | Login, drawers |
| `Button` (primary) | `ButtonPrimary` | `apps/web/src/components/ui/button.tsx` | `variant`, `icon?`, `loading?`, `fullWidth?` | Everywhere |
| `Alert` | `Alert` | `apps/web/src/components/ui/alert.tsx` | `tone`, `icon`, `children` | Login, lists |
| `StatementPanel` | `Statement column` | `apps/web/src/features/auth/components/statement-panel.tsx` | none (static copy) | Login at 1024 and up |

## Responsive behaviour

| | 390 | 768 | 1440 |
|---|---|---|---|
| Layout | Single column, form top-aligned with 32 px top padding | Single column, form centred vertically, 360 wide | Two columns, 720 each: form left, statement right |
| Statement column | Hidden | Hidden | Visible from 1024 up |
| Form width | Fill, 20 px gutters | 360 | 360 |
| Heading | `text-h1` 28 | 32 | 32 |
| Statement | n/a | n/a | `text-display` 64, bottom-left, 64 px padding |
| Button | Full width, 44 px target | Full width | Full width |

## Content requirements

| Slot | Limit | Notes |
|---|---|---|
| Heading | "Sign in" | Fixed |
| Subtitle | ≤ 70 chars | "Use the account your clinic administrator created for you." |
| Field labels | "Email", "Password" | Fixed |
| Password hint | ≤ 30 chars | "12 characters or more." Removed when an error is shown |
| Error | ≤ 90 chars | "Invalid email or password." for every credential failure (never says which); "Too many attempts. Try again in N seconds." for 429 with `Retry-After` |
| Statement | ≤ 32 chars | "Every patient, accounted for." |
| Statement caption | ≤ 60 chars | "One register for doctors and the patients under them." |

## Motion

| Element | Trigger | Move | Duration | Curve | Reduced motion |
|---|---|---|---|---|---|
| Error alert | Appears after a failed attempt | opacity 0 to 1 | 120 ms | `cubic-bezier(.25,.46,.45,.94)` | Appears at once |
| Submit button | Pending | label swaps to "Signing in", button disabled | 0 | n/a | Unchanged |

Nothing else animates. The statement does not move.

## Interaction

| Element | Behaviour | Without JavaScript |
|---|---|---|
| Form | Posts to the sign-in route handler, which calls `POST /api/v1/auth/login` through the Next.js proxy; on success redirects to the `next` parameter or `/dashboard` | A real `<form method="post">`; the route handler sets the cookies and redirects |
| Focus | Email focused on load | Native autofocus |
| Rate limit | Disables submit and counts down `retryAfter` | The error message states the wait; the form stays usable |

## SEO intent

- **Title:** `Sign in | Doctrack` (19 chars)
- **Meta description:** none; page is `noindex, nofollow`
- **H1:** "Sign in", in the form column
- **Heading outline:** h1 only
- **Structured data:** none

## Open questions

None.
