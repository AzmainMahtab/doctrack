# Doctrack — Design Guidelines

**Status:** FINAL for v1. Supersedes: none.
**Design file:** `/home/odin/Documents/doctrack.pen` (frames listed in each page spec)
**Last updated:** 2026-11-14

## 0. Character

Doctrack is a register. It is calm, ruled and exact: ink on paper, hairlines instead of boxes, figures set the way a printed ledger sets them. Every page says what it is counting in a sentence before it shows a chart. It is dense where staff scan lists, and quiet everywhere else.

It deliberately is not a card dashboard: no tiles of identical rounded boxes, no icon-in-a-circle, no gradients, no glass, no decorative illustration, no dark mode in v1. Colour is rare so that it means something.

**The one-sentence test:** "It's the clinic register where the page tells you in a sentence how many patients you have, and every list is a ruled ledger."

### Reference research (measured)

Measured with `teardown.mjs` at 1440 px on 2026-11-14.

| Reference | Measured | Decision taken | Why it fits here |
|---|---|---|---|
| linear.app | 4 px base unit; 1 px borders only; radius 4 to 12; Inter at weight 510 for display with tracking -0.022em; display 72 px against 14 px body (5.1×); accent colours cover under 1% of painted area | 4 px spacing base; radius policy of 4 px and pill; display tracking -0.02em; body 14 px; colour reserved for meaning | An admin tool that scans lists needs density and restraint; Linear is the benchmark for both |
| stripe.com | Near-black ink with a blue cast (`#061b31`) on white and a barely tinted surface (`#f8fafd`); muted ink at 6.3:1; display tracking -0.025em; 4 px base; radii 4 and 6 px; 1 px borders; monospace used for data | Ink and muted ink carry a blue cast (`#0F1A2A`, `#4B5870`); a quiet sunken surface; muted text kept above 6:1; figures treated as typography (tabular numerals) | Reads as precise financial print rather than marketing, which is the register we want for patient figures |

Not taken: Linear's dark ground (too heavy for long list work in a clinic), Stripe's light body weight (300 loses legibility at 14 px).

## 1. Colour

### Palette

| Token (`.pen` variable) | CSS variable | Value | Role |
|---|---|---|---|
| `bg` | `--color-bg` | `#FFFFFF` | Page and table ground |
| `bg-sunken` | `--color-bg-sunken` | `#F4F5F7` | Sidebar, track under bars, segmented selection, login statement column |
| `ink` | `--color-ink` | `#0F1A2A` | Primary text, headings |
| `ink-muted` | `--color-ink-muted` | `#4B5870` | Secondary text, table secondary cells, labels |
| `ink-subtle` | `--color-ink-subtle` | `#5E6A82` | Placeholders, hints, axis ticks, rank numbers |
| `border` | `--color-border` | `#DDE1E8` | Hairlines between rows and sections (decorative separation) |
| `border-input` | `--color-border-input` | `#7F8A9F` | Boundary of inputs, selects, segmented control, secondary button |
| `accent` | `--color-accent` | `#2145D6` | The one accent: primary button, links, active nav, chart series, focus ring |
| `accent-hover` | `--color-accent-hover` | `#1A37AE` | Primary button hover and pressed |
| `accent-ink` | `--color-accent-ink` | `#FFFFFF` | Text and icon on accent |
| `accent-wash` | `--color-accent-wash` | `#E9EEFC` | Active nav background |
| `danger` / `danger-ink` / `danger-wash` | `--color-danger*` | `#B3261E` / `#FFFFFF` / `#FBE9E7` | Destructive button, error alert ground |
| `stable` / `-wash` / `-ink` | `--color-stable*` | `#5E6A82` / `#EBEEF3` / `#3F4C66` | Condition: stable |
| `observation` / `-wash` / `-ink` | `--color-observation*` | `#B26A00` / `#FDF1DC` / `#7A4A00` | Condition: under observation |
| `critical` / `-wash` / `-ink` | `--color-critical*` | `#C4372E` / `#FBE9E7` / `#8C1C15` | Condition: critical, error text |
| `recovered` / `-wash` / `-ink` | `--color-recovered*` | `#2E8057` / `#E4F3EB` / `#1B5E40` | Condition: recovered |
| `scrim` | `--color-scrim` | `#0F1A2A99` | Behind dialog and drawer |

One accent. The four condition colours and `danger` are semantic states, not brand colours. A condition is never shown by colour alone: a tag always carries its text label, the chart legend always lists the label and count.

### Contrast (measured on the canvas and with the contrast audit; every shipping pair)

Text (≥ 4.5:1 body, ≥ 3:1 large):

| Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|
| `ink` | `bg` | 17.48:1 | Body, headings, table names | AAA |
| `ink` | `bg-sunken` | 16.02:1 | Sidebar wordmark, selected segment | AAA |
| `ink-muted` | `bg` | 7.17:1 | Secondary text | AAA |
| `ink-muted` | `bg-sunken` | 6.57:1 | Sidebar secondary | AA |
| `ink-subtle` | `bg` | 5.44:1 | Placeholders, hints, ticks | AA |
| `ink-subtle` | `bg-sunken` | 4.99:1 | Tagline in sidebar | AA |
| `ink-subtle` | `accent-wash` | 4.69:1 | Any subtle text inside active nav | AA |
| `accent` | `bg` | 7.27:1 | Links, active nav label, figures in the register line | AAA |
| `accent` | `accent-wash` | 6.27:1 | Active nav label | AA |
| `accent-ink` | `accent` | 7.27:1 | Primary button | AAA |
| `accent-ink` | `accent-hover` | 9.54:1 | Primary button hover | AAA |
| `danger-ink` | `danger` | 6.54:1 | Danger button | AA |
| `critical-ink` | `danger-wash` | 7.81:1 | Alert text | AAA |
| `critical-ink` | `bg` | 9.16:1 | Inline error and hint text | AAA |
| `stable-ink` | `stable-wash` | 7.41:1 | Tag text | AAA |
| `observation-ink` | `observation-wash` | 6.69:1 | Tag text | AA |
| `critical-ink` | `critical-wash` | 7.81:1 | Tag text | AAA |
| `recovered-ink` | `recovered-wash` | 6.73:1 | Tag text | AA |
| `bg` | `ink` | 17.48:1 | Toast text | AAA |

Non-text (≥ 3:1):

| Mark | Ground | Ratio | Use | Result |
|---|---|---|---|---|
| `border-input` | `bg` | 3.48:1 | Input, select and segmented boundaries | Pass |
| `border-input` | `bg-sunken` | 3.19:1 | Same, on a sunken ground | Pass |
| `accent` | `bg` | 7.27:1 | Focus ring, chart bars | Pass |
| `accent` | `bg-sunken` | 6.67:1 | Focus ring on sunken ground | Pass |
| `stable` dot | `stable-wash` | 4.68:1 | Tag dot | Pass |
| `observation` dot | `observation-wash` | 3.79:1 | Tag dot | Pass |
| `critical` dot | `critical-wash` | 4.55:1 | Tag dot | Pass |
| `recovered` dot | `recovered-wash` | 4.22:1 | Tag dot | Pass |
| `stable`, `observation`, `critical`, `recovered` | `bg` | 5.44, 4.24, 5.34, 4.84:1 | Condition bar segments, legend dots | Pass |

`border` (`#DDE1E8`, 1.31:1 on `bg`) separates rows only. It never marks the boundary of a control and never carries meaning on its own.

### Usage

About 90% `bg` and `bg-sunken`, 8% ink, 2% accent and semantic colour. The accent appears at most once per region as an action or an active state, plus the chart series. Condition colours appear only on tags, legend dots and the condition bar.

## 2. Type

**Display:** Newsreader (serif), weights 400 and 500. Page titles, section titles, the register line, the login statement, doctor name.
**Text:** IBM Plex Sans, weights 400, 500, 600. Everything else. Numerals in tables, ranks and counts use `font-variant-numeric: tabular-nums` so columns align.

| Token | CSS | 390 → 1440 | Tracking | Line height | Use |
|---|---|---|---|---|---|
| `text-display` | `clamp(2.5rem, 1.94rem + 2.29vw, 4rem)` | 40 → 64 | -0.02em | 1.05 | Login statement (one per page) |
| `text-figure` | `clamp(2.25rem, 1.97rem + 1.14vw, 3rem)` | 36 → 48 | -0.02em | 1 | Doctor patient total |
| `text-h1` | `clamp(1.75rem, 1.66rem + 0.38vw, 2rem)` | 28 → 32 | -0.02em | 1.15 | Page titles, the register line |
| `text-h2` | `1.5rem` | 24 | -0.01em | 1.2 | Section titles |
| `text-h3` | `1.125rem` | 18 | 0 | 1.3 | Reserved for subsections |
| `text-body` | `0.875rem` | 14 | 0 | 1.5 | Tables, forms, buttons, body copy |
| `text-small` | `0.8125rem` | 13 | 0 | 1.4 | Meta, hints, pagination, captions |
| `text-caption` | `0.75rem` | 12 | 0.05em, uppercase for table headers and field facts | 1.3 | Table headers, tags, axis ticks |

- Display against body is 64 / 14 = 4.6×; the scale is 12, 13, 14, 18, 24, 32, 48, 64.
- Display and h1 and h2 use Newsreader weight 500 (the register line uses 400); body and UI use Plex Sans.
- Measure for running text is 60 to 75 characters; the longest paragraph in the product is a 90 character page subtitle.
- Never below 12 px. Tap targets, not type, grow on mobile.
- The sentence of the register line is one line at 1440 and wraps on three lines at 390 with the two figures in `accent`.

## 3. Space

Base unit 4 px, working steps of 8. Admin density is deliberate: the Doctors and Patients tables are the compact density mode; forms and dialogs use the same row and control sizes.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4 | Icon to label inside tags |
| `space-2` | 8 | Control gaps, filter chips |
| `space-3` | 12 | Gap between filter controls, field label to input |
| `space-4` | 16 | Cell gap, form field gap |
| `space-5` | 24 | Between blocks inside a section, drawer padding |
| `space-6` | 32 | Between title row and content, 768 gutter |
| `space-7` | 48 | Page gutter at 1440, section gap |
| `space-8` | 64 | Login statement padding |

| Fixed size | Value |
|---|---|
| Control height | 40 |
| Table row height | 52 (header 40) |
| Sidebar width | 232 |
| Icon | 16 inline, 18 in nav and actions |
| Tap target | 44 minimum on touch (mobile controls pad out to 44 in code; the canvas draws the 40 visual) |

Rhythm: title row to filter bar 24; filter bar to table 24; section to section 40 to 48; register line gap 8; label to value in facts 4.

## 4. Grid and breakpoints

| Breakpoint | Width | Page gutter | Navigation | Content |
|---|---|---|---|---|
| Mobile | 390 | 20 | Top bar with menu sheet | One column; tables become ledger entries |
| Tablet | 768 | 32 | Top bar with menu sheet | One column; tables lose low-priority columns |
| Desktop | 1440 | 48 | Persistent 232 px sidebar from 1024 up | Content fills `1440 - 232 - 96 = 1112`, maximum 1112 centred beyond 1440 |

Deliberate breaks from a plain stack: the dashboard opens with a sentence at display scale instead of tiles; the chart takes the full content width and the most vertical room (the peak); the login is an asymmetric split with an empty serif statement column (authored silence).

## 5. Motion

Motion only confirms or orients. Nothing animates the login statement, page titles or table content on load. Continuous motion uses `transform` and `opacity` only.

| What | Duration | Easing (value) |
|---|---|---|
| Hover and focus colour change | 120 ms | `cubic-bezier(.25, .46, .45, .94)` |
| Dialog open | 160 ms | `cubic-bezier(.23, 1, .32, 1)` |
| Drawer open and close | 220 ms | `cubic-bezier(.23, 1, .32, 1)` |
| Toast enter | 200 ms | `cubic-bezier(.23, 1, .32, 1)` |
| Row removed (delete) | 180 ms | `cubic-bezier(.25, .46, .45, .94)` |
| Chart bars first render | 480 ms, 12 ms stagger across at most 30 bars | `cubic-bezier(.23, 1, .32, 1)` |

Signature moment: the registration chart grows its bars from the baseline once when data first arrives, so the page feels like a count being tallied. It does not replay on refetch.

`prefers-reduced-motion: reduce`: transitions collapse to opacity changes of 80 ms or none; the chart renders at full height immediately; the drawer appears without sliding.

## 6. Components

| Property | Policy |
|---|---|
| Radius | 4 px on every surface and control; 2 px on chart bars and tracks; fully rounded on condition tags. Nothing else. |
| Borders | 1 px hairlines. Rows are ruled, not boxed. A container has either a hairline or a fill, never both, with the dialog as the only exception. |
| Shadow | None. One exception: the confirm dialog carries `0 8px 24px #0F1A2A33` over the scrim. |
| Gradient | None. |
| Icons | Lucide, 16 or 18 px, 1.5 px stroke, `ink-muted` by default; the icon never replaces a label for an action that is not universally understood (edit and delete rows use icon buttons with `aria-label` and tooltips). |
| Focus | 2 px `accent` outline, 2 px offset, on `:focus-visible`. Inputs also thicken their border to `accent`. |
| Tables | Header row at 40, data rows at 52, hairline under each row, no zebra, no cell borders. Numerals right-aligned and tabular. Row opens its detail on click and Enter. |
| Forms | Label above the field, hint below, error replaces the hint in `critical-ink` with a `critical` border. Required fields are not starred; optional ones say "optional". |
| Charts | Bars use `accent`. Gridlines are `border`, the baseline `border-input`. Every chart has a data table alternative. |
| Images | None in v1. |

## 7. Voice

Sentence case everywhere, including buttons and table headers (headers are set uppercase by style only). Say what happens: "Add doctor", "Delete patient", "Save changes", never "Submit" or "OK". Errors say what happened and what to do, never blame: "We couldn't load the doctors. Check your connection and try again." Dates read `14 Nov 2026`. The register line is a sentence with figures: "412 patients are on record with 38 doctors." No exclamation marks, no emoji, no em dashes in product copy.

## 8. Award-bar review (honest)

Scored 0 to 3 as an operational tool, not a showcase page:

| Axis | Score | Why |
|---|---|---|
| Idea | 2 | The register concept (sentence plus ruled ledger) carries every page; the login is the only place it is not tested |
| Typographic range | 2 | Display 64 against 14 body (4.6×) with tracking and line height set per step; serif for naming, sans for data |
| Spatial depth | 1 | Deliberately flat. Depth is reserved for the dialog and drawer over a scrim |
| Motion choreography | 2 | Distinct jobs (confirm, orient, tally) with real curves and a reduced-motion state |
| Restraint | 3 | One accent, no gradient, no shadow outside the dialog, no cards, no icon circles; three things deliberately not done: dark mode, card tiles, decorative imagery |
| Craft detail | 2 | Tabular numerals, accent selection colour, focus rings, optical figure alignment in the register line |

Total 12. Spatial depth is below 2 by decision: layering a clinical register would add noise, so it is recorded as a conscious omission, not an oversight.

- No two adjacent bands behave the same way on the dashboard: sentence, full-width chart, then a ranked list beside a stacked bar.
- Peak: the registrations chart (most room, preceded by the quiet sentence block). Close: the lower band resolves in the conditions bar and a one-line note; nothing trails off.

## 9. Open items

- Dark mode, print stylesheet and a high-contrast theme are out of scope for v1.
- The chart's "View as table" disclosure and the mobile row action sheet are specified in the page specs and drawn in P6 from existing patterns (table rows, dialog).
