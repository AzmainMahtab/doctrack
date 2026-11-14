# Doctrack — Patients Design Spec

**Canvas:** `/home/odin/Documents/doctrack.pen`, nodes `u8rkc` "Patients 1440", `Q1pysK` "Edit patient drawer 1440", `i1AhU7` "Patients 390"; states on `QRg14` "States 1440"
**Guidelines:** `../DESIGN-GUIDELINES.md`
**Status:** Ready for build
**Last updated:** 2026-11-14

## Purpose

Find any patient across all doctors, correct a record, or remove one. Route `/patients`, permission `patients:read` (edit and delete need `patients:write`). Patients are added from a doctor's page, which the subtitle says.
**Primary action:** edit a patient (admin). For a viewer: open the record through search.
**Secondary action:** delete a patient (confirmed).

## Sections, in order

| # | Section | Canvas node | Purpose |
|---|---|---|---|
| 1 | Title row | `Title row` | Title and the count sentence; no create button here |
| 2 | Filter bar | `Filter bar` | Search, condition, doctor, registered range, clear |
| 3 | Patients table | `Patients table` | Header, ten rows, pagination |
| 4 | Edit patient drawer | `Drawer` in `Edit patient drawer 1440` | Edit fields |
| 5 | Delete dialog | `Delete patient dialog` on `States 1440` | Confirm removal |

## Component inventory

| Component | Canvas node | Code path | Props | Used on |
|---|---|---|---|---|
| Layout components | as on Dashboard | `apps/web/src/components/layout/` | | All signed-in pages |
| `SearchField`, `SelectField`, `Button` (ghost) | as on Doctors | `apps/web/src/components/ui/` | | Filter bars |
| `PatientsTable` | `Patients table` | `apps/web/src/features/patients/components/patients-table.tsx` | `rows`, `showDoctor`, `onEdit`, `onDelete` | Patients, Doctor detail |
| `PatientHeaderRow` | `PatientHeaderRow` | same file (`PatientsTableHeader`) | `showDoctor` | Patients, Doctor detail |
| `PatientRow` | `PatientRow` | same file (`PatientsTableRow`) | `patient`, `showDoctor`, `canWrite` | Patients, Doctor detail |
| `PatientEntry` | `PatientEntry` | `apps/web/src/features/patients/components/patient-entry.tsx` | `patient` | Patients below 768 |
| `ConditionTag` | `ConditionTag` | `apps/web/src/components/ui/condition-tag.tsx` | `condition` (one of four) | Tables, entries |
| `IconButton` | `IconButton` | `apps/web/src/components/ui/icon-button.tsx` | `icon`, `label` (required `aria-label`), `onClick` | Row actions, drawers |
| `PatientForm` | `Fields` in `FormDrawer` | `apps/web/src/features/patients/components/patient-form.tsx` | `patient?`, `onSubmit`, `errors` | Edit patient, Add patient |
| `FormDrawer` | `FormDrawer` | `apps/web/src/components/ui/form-drawer.tsx` | `title`, `onClose`, `footer` | Edit patient |
| `ConfirmDialog` | `ConfirmDialog` | `apps/web/src/components/ui/confirm-dialog.tsx` | `title`, `body`, `confirmLabel`, `tone` | Delete patient |
| `Toast` | `Toast` | `apps/web/src/components/ui/toast.tsx` | `message`, `action?` | Delete, save |
| `Pagination`, `EmptyState`, `SkeletonRow`, `Alert` | as on Doctors | `apps/web/src/components/ui/` | | All lists |

## Responsive behaviour

| | 390 | 768 | 1440 |
|---|---|---|---|
| Navigation | Top bar and menu sheet | Top bar and menu sheet | Sidebar |
| Filter bar | Search plus Filters button (sheet with condition, doctor, range, Clear) | Search, condition and doctor selects, Clear; range on its own row | One row |
| Table | Ledger entries: name and condition tag on line one, "Doctor · Admitted date" beneath; tapping an entry opens a bottom sheet with Edit and Delete | Columns Patient, Condition, Doctor, actions (Admitted dropped) | Patient (fills), Condition 140, Doctor 200, Admitted 120, actions 88 |
| Row actions | In the sheet | Edit and Delete icon buttons | Edit and Delete icon buttons |
| Drawer | Full-screen sheet | 480 from the right | 480 from the right |
| Dialog | Bottom-anchored, full width | Centred, 440 | Centred, 440 |

## Content requirements

| Slot | Limit | Notes |
|---|---|---|
| Subtitle | ≤ 90 chars | "412 patients across 38 doctors. New patients are added from a doctor's page." |
| Patient name | ≤ 100 chars | Truncate in the cell; full in tooltip |
| Condition label | one of "Stable", "Under observation", "Critical", "Recovered" | Longest is "Under observation"; the 140 px column is sized for it |
| Search placeholder | ≤ 40 chars | "Search by name or diagnosis" |
| Dialog title | ≤ 40 chars | "Delete this patient?" |
| Dialog body | ≤ 120 chars | Names the patient and the doctor, says it cannot be undone |
| Toast | ≤ 60 chars | "Patient deleted." with Undo while the request is deferred 5 s |
| Rows never show | | Phone, email, date of birth or diagnosis. They appear only in the edit drawer and the detail response |

## Motion

| Element | Trigger | Move | Duration | Curve | Reduced motion |
|---|---|---|---|---|---|
| Row removal | Delete confirmed | Row fades and the rows below close up with transform only | 180 ms | `cubic-bezier(.25,.46,.45,.94)` | Instant removal |
| Dialog | Open | opacity and scale 0.98 to 1 | 160 ms | `cubic-bezier(.23,1,.32,1)` | Opacity only |
| Drawer | Open, close | as Doctors | 220 ms | `cubic-bezier(.23,1,.32,1)` | Opacity only |
| Toast | Delete | translateY 8 px to 0 with opacity | 200 ms | `cubic-bezier(.23,1,.32,1)` | Opacity only |
| Row action hover | Pointer | Icon colour to `ink` | 120 ms | `cubic-bezier(.25,.46,.45,.94)` | Instant |

## Interaction

| Element | Behaviour | Without JavaScript |
|---|---|---|
| Filters, search, sort, page | URL state (`q`, `condition`, `doctorId`, `from`, `to`, `sort`, `page`, `limit`); debounced search; next page prefetched | `<form method="get">` and real links |
| Delete | Optimistic: the row disappears, the request runs, a failure restores it with the failure toast. The dialog blocks until confirmed | A confirmation page at `/patients/:id/delete` with a POST button |
| Edit | Drawer prefilled from `GET /patients/:id`, `PATCH` with only changed fields; `422` field errors shown inline; an empty change closes the drawer without a request | `/patients/:id/edit` full page with the same form |
| Viewer | Edit and Delete are not rendered | n/a |

## States

As drawn on `States 1440`: loading skeleton rows, empty ("No patients match these filters"), error alert with retry, confirm dialog and toasts.

## SEO intent

- **Title:** `Patients | Doctrack`
- **Meta description:** none; `noindex, nofollow`
- **H1:** "Patients"
- **Heading outline:** h1 Patients; drawer and dialog titles are h2 inside their dialogs
- **Structured data:** none

## Open questions

None.
