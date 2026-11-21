# Apeejay Admissions & Marketing MIS Dashboard

A web dashboard for tracking admissions across Apeejay schools and Higher Ed institutions — from the first enquiry to fee-paid enrolment — with seat planning, withdrawals, marketing reports and master-data management.

It brings together data from three source systems:

| System | What it provides |
|---|---|
| **LeadSquared** (CRM) | Leads, follow-ups, lead sources, counsellor activity |
| **SaaS** | Online application / registration forms |
| **FABS** | Fee-paid admissions, enrolment, withdrawals, student roster |

> **Phase 1 demo.** The app runs entirely in the browser on realistic, *deterministic* mock data (the same filters always give the same figures). There is no backend or database yet — see [Data and storage](#data-and-storage).

---

## Getting started

**Requirements:** Node.js 20 or later (18.18+ works) and npm.

```bash
git clone https://github.com/devyanisingh-ui/admission-dashboard.git
cd admission-dashboard
npm install
npm run dev
```

Open <http://localhost:3000>.

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create an optimised production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run Next.js linting |

> **Tip:** run only one dev server per project folder. Two servers sharing the same `.next` folder overwrite each other's build files and cause "ChunkLoadError". If that happens, stop the server, delete `.next`, and run `npm run dev` again.

---

## Features

### Dashboards and reports
- **Dashboard** — global filters (vertical, school / institution, board, grade, session, lead source, date range incl. custom start / end dates), admissions snapshot, quick insights, grade-wise vacancy, **current strength by school**, source performance, lead trend, end-to-end funnel, and a group comparison for multi-school roles.
- **Drill-down** — move from the whole group → vertical → school → grade → funnel stage → individual records, with breadcrumbs, measure switcher and shareable URLs.
- **Grade-wise Reports** (seats, vacancy and target achievement per grade), **Withdrawals** (reasons, months, grades, schools, register and strength movement).
- **Budget & Outreach** and **Social Media Reports** for marketing.
- **Download Centre** — every report as Excel (CSV) or a printable PDF, plus locked weekly / monthly snapshots.

### Operations
- **System Views** — raw records and sync status from each source system.
- **Alerts** — seat-fill, close-out, unmapped-admission and sync alerts.

### Setup
- **Seat Matrix & Targets** — create a seat matrix for a new cycle (copy last year, start blank or upload CSV), edit seats, request changes after the lock date, and approve them; saved seats feed seat fill and vacancies everywhere.
- **Masters** — create, update and deactivate / delete master data, with a full change log:
  - LeadSquared status → funnel stage mapping (with approval)
  - Schools / locations and their SaaS, LeadSquared and FABS codes
  - Grades & programmes per location
  - Lead sources and their reporting groups
  - Withdrawal reasons
  - Outreach activities that budgets and spend are entered against (renames carry entered figures with them)

  Changes apply across every page immediately. Records that already have history can only be deactivated, never hard-deleted.
- **Administration** — users, sync jobs and the audit log.

---

## Roles

Switch role from the menu in the top-right corner to preview what each user sees. Access follows the permission matrix in `lib/roles.ts`.

| Role | Scope |
|---|---|
| Admissions Counsellor | Own school |
| Location Admissions Head | Own school — can edit / request Seat Matrix changes |
| Principal / Head of Institution | Own school |
| Vertical Admissions Head | All schools in a vertical — approves Seat Matrix and status mapping changes |
| Group Leadership | All schools — personal details masked unless revealed |
| Central Admin / Support | All schools — maintains masters and the Seat Matrix |
| System Administrator (IT) | Administration and sync only |

---

## Data and storage

- **Mock data** is generated in `lib/data.ts` from a seeded random generator, so figures are stable between reloads. "Today" in the demo is **17 Nov 2026**.
- **Seat Matrix edits** and **Masters changes** are saved in the browser's `localStorage` (`seat-matrix-v1`, `masters-v1`). They survive a reload but are **not shared** between users or devices. To reset, use *Masters → Change log → Reset to source data*, or clear the site's storage.
- **Manually entered figures** — budget allocations and the spend log with spend, activities and leads per month (Budget & Outreach → Data entry), monthly platform figures and paid campaigns (Social Media → Data entry) and admission targets (Grade-wise Reports → Edit targets, or Seat Matrix & Targets) — are saved in `localStorage` under `marketing-data-v1`. Until a session is first edited it shows generated starting data. Entry is open to the Location Admissions Head (own school) and Central Admin; targets to the Vertical Admissions Head and Central Admin.
- The demo role is kept in `sessionStorage`.

In production these would be replaced by an API backed by the synced SaaS, LeadSquared and FABS data.

---

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router) and [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) for charts
- [lucide-react](https://lucide.dev/) icons

## Project structure

```
app/                 One folder per page (App Router)
  page.tsx           Dashboard
  drilldown/         Drill-down
  grades/            Grade-wise Reports
  strength/          Withdrawals & strength movement
  planning/          Seat Matrix & Targets
  masters/           Masters (one file per tab)
  reports/           Download Centre
  ...                Other reports, operations and admin pages
components/          Shared UI: shell & filters, charts, dashboard widgets, forms
lib/
  data.ts            Mock data, locations, unit stats, master lists
  dashboard.ts       Dashboard figures and quick insights for the current filters
  drilldown.ts       Drill-down hierarchy and records
  seat-matrix.ts     Seat Matrix store, cycles and CSV upload
  masters.ts         Master-data store, seeds and change log
  marketing.ts       Entered budget, spend, social and target data, plus report figures
  context.tsx        App state: role, filters, seat and master stores
  roles.ts           Roles and permission matrix
  reports.ts         Report definitions used by exports
```
