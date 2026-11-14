# Doctrack — Doctor detail Design Spec

**Canvas:** `/home/odin/Documents/doctrack.pen`, node `byPDq` "Doctor detail 1440"
**Guidelines:** `../DESIGN-GUIDELINES.md`
**Status:** Ready for build
**Last updated:** 2026-11-14

## Purpose

Show one doctor and the patients under them, and add or remove those patients. Route `/doctors/[id]`, permission `doctors:read` and `patients:read` (write actions need `patients:write`).
**Primary action:** Add patient (admin).
**Secondary action:** search this doctor's patients; remove one.

## Sections, in order

| # | Section | Canvas node | Purpose |
|---|---|---|---|
| 1 | Breadcrumb | `Breadcrumb` | Back to Doctors |
| 2 | Doctor header | `Doctor header` | Name in serif, role line, the patient total as one figure |
| 3 | Facts | `Facts` | Phone, email, registered date, status in a ruled strip |
| 4 | Patients header | `Patients header` | Section title and Add patient |
| 5 | Filter bar | `Filter bar` | Search and condition for this doctor's patients only |
| 6 | Doctor patients table | `Doctor patients table` | The same patient table without the Doctor column, with pagination |

## Component inventory

| Component | Canvas node | Code path | Props | Used on |
|---|---|---|---|---|
| `Breadcrumb` | `Breadcrumb` | `apps/web/src/components/layout/breadcrumb.tsx` | `items` | Detail pages |
| `DoctorHeader` | `Doctor header` | `apps/web/src/features/doctors/components/doctor-header.tsx` | `name`, `specialization`, `hospital`, `patientCount` | Doctor detail |
| `FactStrip` | `Facts` | `apps/web/src/components/ui/fact-strip.tsx` | `facts: {label, value}[]` | Doctor detail |
| `PatientsTable` | `Doctor patients table` | `apps/web/src/features/patients/components/patients-table.tsx` | `showDoctor={false}` | Doctor detail, Patients |
| `PatientForm` in `FormDrawer` | add variant of the Edit patient drawer | `apps/web/src/features/patients/components/patient-form.tsx` | `doctorId` | Doctor detail |
| `SearchField`, `SelectField`, `Button`, `ConditionTag`, `IconButton`, `Pagination`, `ConfirmDialog`, `Toast`, `EmptyState`, `Alert` | as on Patients | `apps/web/src/components/ui/` | | |

The Add patient drawer is the Edit patient drawer with an empty form, the title "Add patient" and the button "Save patient"; fields are name, date of birth, gender, phone, email, condition, diagnosis and admission date.

## Responsive behaviour

| | 390 | 768 | 1440 |
|---|---|---|---|
| Header | Name, role line, then the patient total under them | Name left, total right | Name left, total right |
| Facts | Two rows of two | Two columns, two rows | Four columns in one strip |
| Patients header | Title, then Add patient full width | Title left, button right | Title left, button right |
| Filter bar | Search and a Filters button | Search and condition select | Search and condition select |
| Table | `PatientEntry` ledger entries | Patient, Condition, actions | Patient (fills), Condition 140, Admitted 120, actions 88 |
| Type | name 28, total 36 | name 32, total 48 | name 32, total 48 |

## Content requirements

| Slot | Limit | Notes |
|---|---|---|
| Doctor name | ≤ 100 chars | Wraps to two lines at 390; never truncated in the header |
| Role line | ≤ 120 chars | "{specialization} at {hospital}" |
| Patient total | integer | From `patientCount`; label "patient" or "patients" |
| Email | ≤ 254 chars | Wraps, never truncated |
| Status | "Active" | Only value in v1 |
| Table | as Patients | No Doctor column |

## Motion

As Patients for rows, dialog, drawer and toast. The patient total changes by cross-fading the figure in 160 ms (`cubic-bezier(.25,.46,.45,.94)`) when it updates after an add or delete; reduced motion swaps it instantly. Nothing else animates.

## Interaction

| Element | Behaviour | Without JavaScript |
|---|---|---|
| Add patient | Drawer, `POST /api/v1/doctors/:id/patients`; the new row appears at the top; the total follows within the poll interval | Link to `/doctors/:id/patients/new` |
| Remove | `DELETE /api/v1/doctors/:id/patients/:patientId` after confirmation | `/doctors/:id/patients/:patientId/delete` |
| Unknown doctor | `404` renders a not-found state ("This doctor is not on the register") with a link back | Same |
| Viewer | Add and remove controls not rendered | n/a |

## SEO intent

- **Title:** `{Doctor name} | Doctrack`
- **Meta description:** none; `noindex, nofollow`
- **H1:** the doctor's name
- **Heading outline:** h1 name, h2 Patients
- **Structured data:** none

## Open questions

- Editing a doctor is not in v1 (decision D-19 and the brief). If it is added, patient rows carry a copy of the doctor's name that must be refreshed by an event (recorded in `memory/LEARNINGS.md`).
