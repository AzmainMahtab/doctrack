# Doctrack — Dashboard Design Spec

**Canvas:** `/home/odin/Documents/doctrack.pen`, nodes `t0zsM` "Dashboard 1440" and `P8oGZ` "Dashboard 390"
**Guidelines:** `../DESIGN-GUIDELINES.md`
**Status:** Ready for build
**Last updated:** 2026-11-14

## Purpose

Say what the register holds today and how it is changing. Route `/dashboard`, permission `dashboard:read`.
**Primary action:** read the registration trend (change the window or interval).
**Secondary action:** open a doctor from the ranking.

## Sections, in order

| # | Section | Canvas node | Purpose |
|---|---|---|---|
| 1 | Sidebar | `Sidebar` | Navigation, account, sign out |
| 2 | Page title | `Page title` | Name of the page and a one-line promise |
| 3 | Register line | `Register line` | Totals as a sentence; critical and observation counts beneath. Quiet band before the peak |
| 4 | Registrations (peak) | `Registrations` | The chart: entity, window and interval controls, bars, axes. Most room on the page |
| 5 | Patients per doctor | `Patients per doctor` | Ranked list with proportional bars, top 10 |
| 6 | Patients by condition | `Conditions` | Stacked bar and legend rows with count and share |

Authored silence: the register line has no tiles around it and nothing beside it.

## Component inventory

| Component | Canvas node | Code path | Props | Used on |
|---|---|---|---|---|
| `Sidebar` | `Sidebar` | `apps/web/src/components/layout/sidebar.tsx` | `active`, `user` | All signed-in pages at 1024 up |
| `NavItem` | `NavItem` | `apps/web/src/components/layout/nav-item.tsx` | `href`, `icon`, `label`, `active` | Sidebar, menu sheet |
| `MobileTopBar` | `MobileTopBar` | `apps/web/src/components/layout/mobile-top-bar.tsx` | `onMenu` | All signed-in pages below 1024 |
| `PageTitle` | `PageTitle` | `apps/web/src/components/layout/page-title.tsx` | `title`, `subtitle` | All signed-in pages |
| `RegisterLine` | `Register line` | `apps/web/src/features/dashboard/components/register-line.tsx` | `doctors`, `patients`, `critical`, `observation`, `updatedAt` | Dashboard |
| `RegistrationsChart` | `Registrations` | `apps/web/src/features/dashboard/components/registrations-chart.tsx` | `series`, `entity`, `interval`, `window` | Dashboard |
| `SegmentedControl` | `Segmented …`, `Segment` | `apps/web/src/components/ui/segmented-control.tsx` | `options`, `value`, `onChange`, `label` | Dashboard |
| `RankRow` | `RankRow` | `apps/web/src/features/dashboard/components/rank-row.tsx` | `rank`, `name`, `count`, `max`, `href` | Dashboard |
| `ConditionBar` | `Condition bar` | `apps/web/src/features/dashboard/components/condition-bar.tsx` | `counts` | Dashboard |
| `ConditionLegendRow` | `LegendRow` | `apps/web/src/features/dashboard/components/condition-legend-row.tsx` | `condition`, `count`, `share` | Dashboard |
| `Alert` | `Alert` | `apps/web/src/components/ui/alert.tsx` | `tone`, `children` | Error state |
| `Button` (secondary) | `ButtonSecondary` | `apps/web/src/components/ui/button.tsx` | `variant`, `icon` | Retry |

## Responsive behaviour

| | 390 | 768 | 1440 |
|---|---|---|---|
| Navigation | Top bar (56) with menu sheet | Top bar with menu sheet | Sidebar 232 |
| Page gutter | 20 | 32 | 48 |
| Register line | Three lines, `text-h1` 28, figures in accent; detail below | One line at 32 | One line at 32 |
| Chart controls | Window control only (7, 30, 90 days); entity and interval fixed to patients and day, available in a "Chart options" disclosure | All three controls in one row | All three controls right of the title |
| Chart | 7 bars (window 7 default), height 160, three x ticks | 30 bars, height 220, five ticks | 30 bars, height 260, six ticks |
| Patients per doctor | Top 5, name, bar 96 wide, count | Top 10, bar 160 | Top 10, bar 200 |
| Conditions | Stacked under the ranking, bar full width | Beside the ranking, 360 wide | Beside the ranking, 400 wide |
| Type | h1 28, h2 24 | h1 30, h2 24 | h1 32, h2 24 |

## Content requirements

| Slot | Limit | Notes |
|---|---|---|
| Page subtitle | ≤ 90 chars | "What the register holds today. Figures update within a few seconds of a change." |
| Register line | ≤ 60 chars | "412 patients are on record with 38 doctors." Numbers are the API totals; singular and plural handled ("1 patient is on record with 1 doctor.") |
| Detail line | ≤ 100 chars | "17 patients are critical and 118 are under observation. Updated 14 Nov 2026, 09:23." Uses `updatedAt` |
| Chart caption | ≤ 120 chars | States what a bar is: records that still exist, counted on the day they were registered |
| Doctor name in ranking | ≤ 32 chars, truncated with an ellipsis | Full name in the tooltip and as the link's accessible name |
| Empty projection | n/a | Zeros are shown, `updatedAt` null reads "No activity yet." |

## Motion

| Element | Trigger | Move | Duration | Curve | Reduced motion |
|---|---|---|---|---|---|
| Chart bars | First data arrival only | scaleY 0 to 1 from the baseline, 12 ms stagger | 480 ms | `cubic-bezier(.23,1,.32,1)` | Full height immediately |
| Segment change | Click | Selected fill and weight change | 120 ms | `cubic-bezier(.25,.46,.45,.94)` | Instant |
| Series swap | Control change | Cross-fade old to new bars | 160 ms | `cubic-bezier(.25,.46,.45,.94)` | Instant swap |
| Rank bars | First data arrival | scaleX 0 to 1 from the left | 320 ms | `cubic-bezier(.23,1,.32,1)` | Full width |

Signature moment: the bars of the registration chart rising once.

## Interaction

| Element | Behaviour | Without JavaScript |
|---|---|---|
| Entity, window and interval controls | Update the URL query (`entity`, `window`, `interval`) and refetch; the chart keeps its previous series until the new one arrives | The controls are links to `?window=…`; the page is server rendered |
| Chart | Hover or focus a bar shows date and count in a tooltip; arrow keys move between bars | `<noscript>` and a "View as table" `<details>` list every point as a table (also the accessible alternative) |
| Rank row | Links to `/doctors/:id` | Real anchor |
| Cache | Responses cached 30 s and refreshed when an event is consumed | n/a |

## States

Loading: the sentence and each section show a skeleton the size of the final content (`SkeletonRow` pattern for the ranking). Error: `Alert` with a retry button above the affected section; other sections stay usable. Empty: zero totals and a flat chart with the baseline only.

## SEO intent

- **Title:** `Dashboard | Doctrack`
- **Meta description:** none; `noindex, nofollow`
- **H1:** "Dashboard" in `PageTitle`
- **Heading outline:** h1 Dashboard, h2 New registrations, h2 Patients per doctor, h2 Patients by condition. The register line is a `<p>`
- **Structured data:** none

## Open questions

None. The chart's "View as table" disclosure is specified here and drawn in P6 from the table pattern.
