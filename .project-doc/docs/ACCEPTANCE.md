# Acceptance trace

Evidence for each ticked acceptance criterion in `PRD.md` section 5. Line numbers refer to `PRD.md`. Test names are from `apps/api/src/**` (`*.int.test.ts` run with `make test-integration`), `apps/web/src/**` (`make test`) and `apps/web/e2e/` (`make test-e2e`). "Measured" and "live check" entries come from the running stack at 10,024 doctors and 100,029 patients on 2026-11-15.

| Line | Criterion | Evidence |
|------|-----------|----------|
| 94 | Given valid credentials, when I submit, then I land on `/dashboard` and no token is readable from JavaScript. | identity.int: signs in, sets httpOnly cookies and exposes no token in the body; e2e J1 |
| 95 | Given a wrong password, when I submit, then I see "Invalid email or password", the response is `401 UNAUTHENTI… | identity.int: wrong password and unknown email, same body; e2e J1 shows the message |
| 96 | Given 5 failed attempts for the same IP and email within 15 minutes, when I try a 6th, then I get `429 RATE_LI… | identity.int: counts failed logins per IP and email, 429 on the sixth, success resets; e2e rate limited sign-in |
| 103 | Given an expired access token and a valid refresh token, when I load a page, then the request succeeds after o… | identity.int: rotates the pair; live check: a page request carrying only the refresh cookie returns 200 and fresh cookies (proxy refresh) |
| 104 | Given a refresh token that was already rotated, when it is presented, then the API returns `401 TOKEN_REVOKED`… | identity.int: revokes the whole session when a rotated refresh token is presented again |
| 110 | Given I logged out, when I replay my old access token, then the API returns `401 TOKEN_REVOKED` until the toke… | identity.int: rejects the old access and refresh tokens after logout; e2e J4 (TOKEN_REVOKED) |
| 111 | Given the blacklist entry's TTL elapsed, when I query Redis, then the key no longer exists. | identity.int: the entry expires with the token |
| 112 | Given Redis is unreachable, when I call any authenticated route, then I get `503 UNAVAILABLE` with `Retry-Afte… | identity.int: 503 for login and authenticated routes, readiness fails, /health up; live check with Redis stopped: 503, Retry-After 5, calm notice on the page |
| 118 | Given no cookie, when I request any page except `/login`, then I am redirected to `/login`; and any `/api/v1`… | live check: no cookie gives a 307 to /login?next=…, API routes give 401; e2e J1 |
| 119 | Given a Viewer, when they call `POST /doctors`, then the API returns `403 FORBIDDEN` and the UI shows no write… | doctors.int: viewer reads, cannot write; e2e J5 (no write controls, 403) |
| 128 | Given valid fields, when I submit, then the doctor appears at the top of the list and the dashboard doctor tot… | doctors.int: creates a doctor and writes the event; measured: dashboard doctor total +1 in 60 ms; e2e J2 |
| 129 | Given an email that already exists, when I submit, then the API returns `409 CONFLICT` and the form marks the… | doctors.int: duplicate email in any case returns 409; doctor-form-drawer maps it to the email field |
| 130 | Given an invalid phone, when I submit, then the API returns `422 VALIDATION_FAILED` with `errors[].field = "ph… | doctors.int: 422 with field errors; drawer maps body.phone to the phone field |
| 137 | Given 10,000 doctors, when I search, filter and page, then p95 latency is under 300 ms and `explain()` shows a… | doctors explain.int (index scan on every list shape); make load-check p95 7.8 ms at 10,024 doctors |
| 138 | Given a filter that matches nothing, when the list loads, then the page shows an empty state with a "Clear fil… | e2e acceptance: empty state with Clear filters; doctors.int: total 0 |
| 139 | Given I copy the URL of a filtered page, when another user with access opens it, then they see the same filter… | e2e acceptance: a copied filtered URL reproduces the filters in another session; live check: filters are server-rendered |
| 145 | Given a doctor with 45 patients, when I open the page, then I see 20 rows, `total` 45 and 3 pages. | patients.int: pagination meta and last partial page; doctor patient list uses the same pagination (20 per page) |
| 146 | Given an id that does not exist, when I open the page, then I see a not-found state and the API returned `404… | doctors.int: 404 for an unknown id; e2e acceptance: not-found page with a 404 status |
| 152 | Given a valid patient, when I submit, then the row appears in the list and the doctor's `patientCount` becomes… | patients.int: patientCount equals the real count; measured: patientCount updated in 61 ms |
| 153 | Given a doctor id that does not exist, when I submit, then the API returns `404 NOT_FOUND` and nothing is writ… | patients.int: 404 for an unknown doctor and nothing is written |
| 159 | Given a patient under the doctor, when I confirm deletion, then the row disappears, the API returns `204`, and… | patients.int: deletes a patient, then 404s; measured: patientCount back in 60 ms; e2e J3 |
| 160 | Given the patient belongs to a different doctor, when the call is made, then the API returns `404 NOT_FOUND` a… | patients.int: refuses to delete another doctor's patient |
| 161 | Given the network fails, when I confirm deletion, then the row returns and an error toast appears. | deferred-delete unit: a failed commit restores the row and reports the failure (toast); e2e J3 covers Undo |
| 172 | Given 100,000 patients, when I search, filter by condition and page, then p95 latency is under 300 ms and `exp… | patients explain.int (no COLLSCAN); make load-check p95 18 ms at 100,029 patients |
| 173 | Given I filter by condition `critical` and doctor X, when the list loads, then every row matches both and `met… | patients.int: filters by condition, doctor and combinations |
| 179 | Given I change a condition from `critical` to `stable`, when I save, then the row shows the new value and the… | analytics.live.int: follows condition changes; measured: dashboard condition count +1 in 59 ms |
| 180 | Given an invalid email, when I save, then the API returns `422 VALIDATION_FAILED` and the stored record is unc… | patients.int: rejects invalid edits and leaves the record unchanged |
| 186 | Given an existing patient, when I confirm, then a following `GET /patients/:id` returns `404 NOT_FOUND`. | patients.int: deletes a patient, then 404s |
| 187 | Given a Viewer, when they call the endpoint, then the API returns `403 FORBIDDEN`. | patients.int: blocks viewers from editing and deleting |
| 194 | Given a seeded dataset, when the projection has settled, then both totals equal `countDocuments` on the source… | analytics.live.int: projection equals a fresh aggregation; make rebuild-analytics --check matches at scale |
| 195 | Given a response time budget of 200 ms, when I load the dashboard, then p95 of the call is under 200 ms. | analytics.perf.int: p95 under 200 ms; make load-check 3 to 4 ms |
| 200 | Given doctors with different counts, when I load the chart, then bars are sorted descending and each value equ… | analytics.read.int: ranks doctors, caps the list |
| 201 | Given fewer than 10 doctors, when I load the chart, then only existing doctors are shown. | analytics.read.int: shows only existing doctors when there are few |
| 207 | Given the 30-day window, when I load the chart, then the series has exactly 30 daily points, with zeros where… | timeseries.test: exactly 30 points for a 30-day window; analytics.read.int: one point per day |
| 208 | Given a custom range longer than 366 days, when I submit, then the API returns `422 VALIDATION_FAILED`. | analytics.read.int: rejects invalid ranges and windows |
| 213 | Given any dataset, when I load it, then the four counts sum to total patients. | live check at 100,035 patients: condition counts sum to the total |
| 214 | Given the projection is rebuilt with `make rebuild-analytics`, when it finishes, then the counts are identical… | analytics.read.int: reproduces identical numbers on a second run; rebuild at scale prints a clean --check |
| 221 | Given any failing request, when I read the response, then `Content-Type` is `application/problem+json` and `co… | http.test: every AppError maps to its status and code; Problem Details on every error |
| 222 | Given an unexpected exception, when it occurs, then the body is `500 INTERNAL_ERROR` with no stack trace and t… | http.test: hides internals of unexpected errors; request id on the body and the header |
| 227 | Given 61 write requests from one user within 60 seconds, when the 61st arrives, then it receives `429 RATE_LIM… | identity.int: limits writes per user and reports both policies in the headers |
| 228 | Given a request with a forged `X-Forwarded-For` sent directly to the API from outside the proxy network, when… | identity.int: keys the global limit on the proxy-appended client IP, not on spoofed leading entries |
| 233 | Given the registered routes, when the contract test runs, then every route is in the document and every docume… | openapi.test: documents every defined route and nothing else; mounts every defined route |
| 241 | Given a 390 px viewport, when I use any page, then there is no horizontal scrolling and every action is reacha… | e2e: layout holds at the viewport width on every page, at 390 px |
| 242 | Given I use only the keyboard, when I move through a page, then focus order follows reading order and focus is… | e2e acceptance: tab order on the sign-in form follows reading order and every stop has a visible ring; axe passes |
| 254 | Given the README, when I count screenshots, then there are at least 3 desktop and 3 mobile images. | README has 4 desktop and 4 mobile screenshots |

## Not yet ticked

| Line | Why |
|------|-----|
| 234 | `/docs` renders, but authorizing with the cookie scheme and executing `GET /doctors` from the page has not been tried |
| 247 | the loading skeleton exists and measured layout shift is 0.001, but a 2 s slowdown has not been tested |
| 248 | the section error component with retry exists, but a 500 on a chart has not been simulated |
| 253 | a clean clone running `make init && make up && make seed` is part of the deploy step |
