# Sample files for the bulk upload

## Budget & Outreach

Upload the files in this order. Each file mixes good rows with a few deliberate mistakes, so you can see both outcomes in the preview.

| # | File | Where to upload it | Expected preview |
|---|------|--------------------|------------------|
| 1 | `budget-outreach-1-activities.csv` | Masters › Outreach activities › Upload CSV | 2 ready (adds *School van branding* and *Radio spots*) |
| 2 | `budget-outreach-2-allocations.csv` | Budget & Outreach › Data entry › Budget allocations › Upload CSV | 8 ready, 3 with problems |
| 3 | `budget-outreach-3-spend.csv` | Budget & Outreach › Data entry › Spend log › Upload CSV | 18 ready, 6 with problems |

Step 1 is needed first: the starting data already has a budget for every school and the six standard activities, so the allocation rows use the two new activities.

Deliberate problem rows:

- **Allocations**
  - Saket · Digital ads: already has a budget
  - Dwarka: not a school in the dashboard
  - "ninety thousand": not an amount
- **Spend**
  - A repeat of the first row
  - Dwarka: not a school in the dashboard
  - "Billboards": not in the activities master
  - Month "Nox": not a month
  - A negative amount
  - "abc": not an amount

The good rows also show the formats the upload accepts:

- ₹ signs and Indian comma grouping
- A note containing a comma, in quotes
- Month written as "December" or "11"

If you upload file 3 a second time, its good rows are flagged as already uploaded, so spend isn't counted twice.

## Admission targets

Upload at **Seat Matrix & Targets › Admission targets › Upload CSV**. The figures are for session 2026–27, starting from the dashboard's starting targets. The two files change different grades, so you can upload either one, or both in either order.

| # | File | Expected preview |
|---|------|------------------|
| 1 | `admission-targets-1-full-template.csv` | 10 ready, 105 unchanged |
| 2 | `admission-targets-2-changes.csv` | 6 ready, 1 unchanged, 6 with problems |

**File 1** is the full template, the same as the upload's *Template* button gives: every grade and programme of all 11 schools, with 10 targets changed. Unchanged rows are left alone.

The 10 changes:

- Saket Nursery 117 → 125 and XI 68 → 72
- Pitampura KG 36 → 40
- Sheikh Sarai I 27 → 30
- Faridabad XI 73 → 70
- International Nursery 128 → 135
- Stya University MBA 118 → 125
- AIMTC Jalandhar BCA 120 → 110
- ACFA Jalandhar B.Com 164 → 170
- Institute of Design B.Des 55 → 60

**File 2** lists only the changes. Its good rows show other ways a school or grade can be written:

- "Class I"
- "Grade XI"
- the FABS code `F004` for Noida
- lower-case "nerul, kg"

Its deliberate problem rows:

- Saket "PhD": not offered there
- Dwarka: not a school in the dashboard
- A negative target
- A decimal target (20.5)
- A blank target
- A repeat of the first row

The Nerul I row matches the current target, so it shows as unchanged.

A grade has a single target, so an uploaded target replaces the current one. To go back to the starting figures, use *Grade-wise Reports › Edit targets › Reset to starting*.

## Social Media

The starting data already has figures for every school, platform and month, so monthly figures can only be added for a new school. File 1 adds one first: a Dwarka campus.

| # | File | Where to upload it | Expected preview |
|---|------|--------------------|------------------|
| 1 | `social-media-1-location.csv` | Masters › Locations › Upload CSV | 1 ready (adds *Apeejay School, Dwarka*) |
| 2 | `social-media-2-monthly-figures.csv` | Social Media › Data entry › Monthly platform figures › Upload CSV | 10 ready, 7 with problems |
| 3 | `social-media-3-campaigns.csv` | Social Media › Data entry › Paid campaigns › Upload CSV | 8 ready, 7 with problems |

File 3 doesn't use Dwarka, so you can upload it on its own.

**File 2** has Dwarka's figures for all five platforms in October and November. The good rows also show platform names in lower case and the month written as "November" or "11".

Its deliberate problem rows:

- Saket Instagram in November: figures already exist
- Rohini: not a school in the dashboard
- TikTok: not a platform in the dashboard
- Impressions lower than reach
- Interactions more than impressions
- Blank prospects
- A repeat of the first row

**File 3** adds eight new campaigns across schools and Higher Ed, including one with blank clicks and prospects (counted as 0).

Its deliberate problem rows:

- Saket "Board results showcase" in May: already exists
- Rohini: not a school in the dashboard
- Snapchat: not a platform in the dashboard
- Clicks more than reach
- A campaign name over 60 characters
- "free" as the spend
- A repeat of the first row
