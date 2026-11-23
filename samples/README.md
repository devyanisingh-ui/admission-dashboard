# Sample files: Budget & Outreach bulk upload

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
