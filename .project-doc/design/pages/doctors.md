# Doctrack — Doctors Design Spec

**Canvas:** `/home/odin/Documents/doctrack.pen`, nodes `rGGo2` "Doctors 1440", `v7TtgJ` "Add doctor drawer 1440", `ZrKnV` "Doctors 390"; states on `QRg14` "States 1440"
**Guidelines:** `../DESIGN-GUIDELINES.md`
**Status:** Ready for build
**Last updated:** 2026-11-14

## Purpose

Find a doctor, and register a new one. Route `/doctors`, permission `doctors:read` (the add button needs `doctors:write`).
**Primary action:** Add doctor (admin). For a viewer the primary action is opening a doctor.
**Secondary action:** filter and search the list.

## Sections, in order

| # | Section | Canvas node | Purpose |
|---|---|---|---|
| 1 | Title row | `Title row` | Page title, count sentence, Add doctor |
| 2 | Filter bar | `Filter bar` | Search, specialization, hospital, registered range, clear |
| 3 | Doctors table | `Doctors table` | Header, ten rows, pagination |
| 4 | Add doctor drawer | `Drawer` in `Add doctor drawer 1440` | Form to register a doctor |

## Component inventory

| Component | Canvas node | Code path | Props | Used on |
|---|---|---|---|---|
| `Sidebar`, `NavItem`, `MobileTopBar`, `PageTitle` | as on Dashboard | `apps/web/src/components/layout/` | as on Dashboard | All signed-in pages |
| `Button` (primary) | `ButtonPrimary` ("Add doctor") | `apps/web/src/components/ui/button.tsx` | `variant`, `icon`, `loading` | Doctors, Doctor detail |
| `Button` (ghost) | `ButtonGhost` ("Clear") | `apps/web/src/components/ui/button.tsx` | `variant`, `icon` | Filter bars |
| `SearchField` | `SearchField` | `apps/web/src/components/ui/search-field.tsx` | `value`, `placeholder`, `onChange` (debounced 300 ms) | Doctors, Patients, Doctor detail |
| `SelectField` | `SelectField` | `apps/web/src/components/ui/select-field.tsx` | `label`, `options`, `value` | Doctors, Patients |
| `DoctorsTable` | `Doctors table` | `apps/web/src/features/doctors/components/doctors-table.tsx` | `rows`, `sort`, `loading` | Doctors |
| `DoctorHeaderRow` | `DoctorHeaderRow` | `apps/web/src/features/doctors/components/doctors-table.tsx` (`DoctorsTableHeader`) | `sort`, `onSort` | Doctors, States |
| `DoctorRow` | `DoctorRow` | `apps/web/src/features/doctors/components/doctors-table.tsx` (`DoctorsTableRow`) | `doctor` | Doctors |
| `DoctorEntry` | `DoctorEntry` | `apps/web/src/features/doctors/components/doctor-entry.tsx` | `doctor` | Doctors below 768 |
| `Pagination` | `Pagination` | `apps/web/src/components/ui/pagination.tsx` | `page`, `limit`, `total`, `onPage` | All lists |
| `FormDrawer` | `FormDrawer` | `apps/web/src/components/ui/form-drawer.tsx` | `title`, `onClose`, `footer` | Add doctor, Edit patient, Add patient |
| `DoctorForm` | `Fields` in `FormDrawer` | `apps/web/src/features/doctors/components/doctor-form.tsx` | `onSubmit`, `errors` | Add doctor |
| `TextField` | `TextField` | `apps/web/src/components/ui/text-field.tsx` | `label`, `hint`, `error` | Forms |
| `EmptyState`, `SkeletonRow`, `Alert`, `Toast` | on `States 1440` | `apps/web/src/components/ui/` | see states | All lists |

## Responsive behaviour

| | 390 | 768 | 1440 |
|---|---|---|---|
| Navigation | Top bar and menu sheet | Top bar and menu sheet | Sidebar |
| Title row | Title and subtitle, Add doctor becomes a full-width button below | Title left, button right | Title left, button right |
| Filter bar | Search plus a Filters button that opens a sheet with the three selects and Clear | Search, two selects (Specialization, Hospital) and Clear; Registered range moves into the selects as a third row | One row: search fills, three selects, Clear |
| Table | Ledger entries (`DoctorEntry`): name and patient count on line one, "Specialization · Hospital" beneath, chevron | Columns Doctor, Specialization, Patients, chevron. Hospital and Registered dropped | All columns: Doctor (fills), Specialization 200, Hospital 220, Patients 88, Registered 120, chevron 40 |
| Row | 65 px entry | 52 | 52 |
| Pagination | "1 to 6 of 38", previous, "Page 1 of 7", next | Same as 1440 | Same |
| Drawer | Full-screen sheet | 480 wide from the right | 480 wide from the right |

## Content requirements

| Slot | Limit | Notes |
|---|---|---|
| Subtitle | ≤ 90 chars | "38 doctors on the register. Search, filter and open a doctor to see their patients." The number is `meta.total` |
| Doctor name | ≤ 100 chars | Truncated with an ellipsis, full in tooltip |
| Hospital | ≤ 120 chars | Longest real: "North Point Medical Centre"; truncate at the cell width |
| Specialization | ≤ 80 chars | Truncate |
| Search placeholder | ≤ 50 chars | "Search by name, specialization or hospital" |
| Empty title | ≤ 40 chars | "No doctors match these filters"; with no filters and no doctors: "No doctors on the register yet" with an Add doctor button |
| Form fields | Name 2 to 100, specialization 2 to 80, hospital 2 to 120, phone E.164, email 254 | Same limits as the API; errors map to `errors[].field` |

## Motion

| Element | Trigger | Move | Duration | Curve | Reduced motion |
|---|---|---|---|---|---|
| Row hover | Pointer | Background to `bg-sunken` | 120 ms | `cubic-bezier(.25,.46,.45,.94)` | Instant |
| Drawer | Open, close | translateX 24 px to 0 with opacity; scrim fades | 220 ms | `cubic-bezier(.23,1,.32,1)` | Opacity only, 80 ms |
| Page change | Pagination | Table keeps its height; rows swap | 0 | n/a | n/a |
| Toast "Doctor saved." | Save succeeds | translateY 8 px to 0 with opacity | 200 ms | `cubic-bezier(.23,1,.32,1)` | Opacity only |

## Interaction

| Element | Behaviour | Without JavaScript |
|---|---|---|
| Search, filters, sort, page | State lives in the URL (`q`, `specialization`, `hospital`, `from`, `to`, `sort`, `page`, `limit`); search is debounced 300 ms, the next page is prefetched | The filter bar is a `<form method="get">` with a submit button; pagination and sort are real links |
| Row | Whole row is a link to `/doctors/:id` (name is the anchor, the row stretches it) | Real anchor |
| Add doctor | Opens the drawer; submits with `POST /api/v1/doctors`; on `422` shows each field error and focuses the first; on `409` marks the email field "A doctor with this email already exists." | The button links to `/doctors/new`, a full page with the same form |
| Viewer | Add doctor is not rendered | n/a |

## States

Loading: header plus five `SkeletonRow`. Empty and error: `EmptyState` and `Alert` as drawn on `States 1440`. Rate limited: `Alert` stating the wait.

## SEO intent

- **Title:** `Doctors | Doctrack`
- **Meta description:** none; `noindex, nofollow`
- **H1:** "Doctors" in `PageTitle`
- **Heading outline:** h1 Doctors; the drawer title is an h2 inside a dialog
- **Structured data:** none

## Open questions

None.
