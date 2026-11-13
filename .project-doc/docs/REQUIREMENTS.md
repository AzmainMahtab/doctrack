# Requirements

Source tags refer to sections of `context/raw/Fullstack_Task_Frontend_Focused_Updated_1.pdf`. Anything without a source is an assumption (see the end).

## Authentication — §2.1

| ID | Requirement |
|----|-------------|
| AUTH-1 | Only authenticated users can access the portal |
| AUTH-2 | Secure login |
| AUTH-3 | All routes protected by authentication and authorization |

## Doctors — §2.2

| ID | Requirement |
|----|-------------|
| DOC-1 | Admin creates a doctor: name, specialization, hospital, phone, email |
| DOC-2 | List all doctors |
| DOC-3 | Search doctors |
| DOC-4 | Filter doctors: date-wise and other relevant filters |
| DOC-5 | Paginate doctors |
| DOC-6 | View the patients of a doctor |
| DOC-7 | Add a new patient under a specific doctor |
| DOC-8 | Delete a patient from a doctor's patient list |

## Patients — §2.3

| ID | Requirement |
|----|-------------|
| PAT-1 | Dedicated patient page listing all patients |
| PAT-2 | Edit patient information |
| PAT-3 | Delete patients |
| PAT-4 | Pagination |
| PAT-5 | Search |
| PAT-6 | Filter: date-wise, patient condition, other relevant filters |

## Dashboard — §3

| ID | Requirement |
|----|-------------|
| DASH-1 | Total doctors |
| DASH-2 | Total patients |
| DASH-3 | Patients per doctor |
| DASH-4 | Date-based statistics |
| DASH-5 | Charts and graphs (any suitable library) |
| DASH-6 | Clean aggregation, optimized queries, meaningful insights |

## UI/UX — §4

| ID | Requirement |
|----|-------------|
| UX-1 | Modern, visually appealing UI |
| UX-2 | Clean layout, proper spacing and hierarchy |
| UX-3 | Responsive design |
| UX-4 | Smooth navigation |
| UX-5 | Clear navigation between Dashboard, Doctors, Patients |

## Performance and engineering — §5

| ID | Requirement |
|----|-------------|
| PERF-1 | Optimized DB queries for search, filter, pagination |
| PERF-2 | Proper MongoDB indexing |
| PERF-3 | Efficient query patterns |
| PERF-4 | Avoid unnecessary re-renders |
| PERF-5 | Clean folder structure |
| PERF-6 | Reusable components |
| PERF-7 | API validation and error handling |

## Stack — §6

| ID | Requirement |
|----|-------------|
| STK-1 | Next.js frontend |
| STK-2 | Node.js + Express backend, standalone server (D-3) |
| STK-3 | MongoDB |
| STK-4 | RESTful API design |
| STK-5 | Proper state management and data fetching strategy |

## README — standardized template

| ID | Requirement |
|----|-------------|
| DOCS-1 | Description: one-paragraph elevator pitch |
| DOCS-2 | Setup guide, step by step, with `.env.example` |
| DOCS-3 | System architecture: high-level data flow and service interactions |
| DOCS-4 | Technical decisions: deep dive into 2 specific decisions |
| DOCS-5 | Visual evidence: screenshots, desktop and mobile |

## Out of scope

Not requested by the brief; do not build without approval.

- Roles beyond admin (doctor / patient logins)
- Self-registration, password reset, social login
- Appointments, scheduling, prescriptions, billing
- Medical records, file uploads
- Notifications, email, SMS
- Multi-tenancy, internationalization
- Mobile native app

## Assumptions

| ID | Assumption | Reason |
|----|-----------|--------|
| A-1 | Roles `admin` and `viewer` (RBAC); accounts are seeded, not self-registered | Brief asks for authentication and authorization (D-9) |
| A-2 | Patient fields: name, dateOfBirth, gender, phone, email, condition (`stable`, `under_observation`, `critical`, `recovered`), diagnosis, admittedAt, doctorId | Brief names "patient condition" and "date-wise" filters but not the schema (D-10) |
| A-3 | A patient belongs to exactly one doctor | "Add new patients under a specific doctor" |
| A-4 | Deleting a doctor is not required; if built, it must handle their patients explicitly | Brief lists no doctor delete |
| A-5 | Date-based dashboard statistics = patients and doctors created per day/week/month | Brief gives no definition |
| A-6 | Doctor filters: specialization, hospital, created-date range | "Other relevant filters" |
| A-7 | Patient filters: condition, doctor, created-date range | "Other relevant filters" |
