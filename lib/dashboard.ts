/**
 * Dashboard figures for the Global Filters (school(s), session, grade, lead source, date range).
 *
 * - Grade narrows to that grade/programme.
 * - Lead source scales leads, applications and admissions to that source group's share.
 * - Date range keeps only leads / admissions that arrived in those months of the cycle.
 * Seats, vacancies and withdrawals are capacity / roster figures, so only School and Grade affect them.
 */
import { rangeLabelOf, rangeWeightsOf, type DateRange, type DateSpan } from "./context";
import {
  CYCLE_MONTHS, leadTrend, locationById, locationUnits, pct, SOURCE_GROUP_OF, SOURCE_GROUPS, sourceBreakdown, sumStats,
  type Cycle, type SourceGroup, type Totals, type UnitStats, type Vertical,
} from "./data";

export interface DashboardFilters {
  ids: string[];
  cycle: Cycle;
  grade: string;
  sourceGroup: SourceGroup | "All";
  dateRange: DateRange;
  /** Start / end dates for a "custom" date range. */
  custom?: DateSpan;
}

const prevCycle = (c: Cycle): Cycle | null => (c === "2026-27" ? "2025-26" : null);

function unitsFor(ids: string[], cycle: Cycle, grade: string) {
  const all = ids.flatMap((id) => locationUnits(id, cycle).map((u) => ({ ...u, vertical: locationById(id).vertical as Vertical })));
  return grade === "All" ? all : all.filter((u) => u.unit === grade);
}

/** Monthly new leads and enrolments for the selected schools (Oct → Sep). */
function monthly(ids: string[], cycle: Cycle) {
  const tr = leadTrend(ids, cycle);
  return tr.map((m, i) => ({
    month: m.month,
    leads: m.newLeads,
    leadsLY: i ? m.leadsLY - tr[i - 1].leadsLY : m.leadsLY,
    enrolled: i ? m.enrolled - tr[i - 1].enrolled : m.enrolled,
  }));
}

export function dashboardData(f: DashboardFilters) {
  const units = unitsFor(f.ids, f.cycle, f.grade);
  const allUnits = unitsFor(f.ids, f.cycle, "All");
  const t = sumStats(units);
  const tAll = sumStats(allUnits);
  const gradeShare = { leads: tAll.leads ? t.leads / tAll.leads : 0, enrolled: tAll.enrolled ? t.enrolled / tAll.enrolled : 0 };

  // Each month's share of the range (part months count by days), then only the months it touches.
  const weights = rangeWeightsOf(f.dateRange, f.custom ?? { start: "", end: "" }, f.cycle);
  const months = monthly(f.ids, f.cycle);
  const inRange = months
    .map((m, i) => ({ ...m, leads: m.leads * weights[i], leadsLY: m.leadsLY * weights[i], enrolled: m.enrolled * weights[i], w: weights[i] }))
    .filter((m) => m.w > 0);
  const from = weights.findIndex((w) => w > 0);
  const to = weights.length - 1 - [...weights].reverse().findIndex((w) => w > 0);
  const sum = (rows: typeof months, k: "leads" | "enrolled") => rows.reduce((s, r) => s + r[k], 0);
  const rangeLeads = sum(months, "leads") ? sum(inRange, "leads") / sum(months, "leads") : 1;
  const rangeEnrol = sum(months, "enrolled") ? sum(inRange, "enrolled") / sum(months, "enrolled") : 1;

  // Source groups from LeadSquared sources, scaled to the grade and date range.
  const bySource = sourceBreakdown(f.ids, f.cycle);
  const groupTotals = SOURCE_GROUPS.map((g) => {
    const rows = bySource.filter((s) => SOURCE_GROUP_OF[s.source] === g);
    return { group: g, leads: rows.reduce((s, r) => s + r.leads, 0), enrolled: rows.reduce((s, r) => s + r.enrolled, 0) };
  });
  const allSrcLeads = groupTotals.reduce((s, g) => s + g.leads, 0) || 1;
  const allSrcEnrolled = groupTotals.reduce((s, g) => s + g.enrolled, 0) || 1;
  const srcShare = f.sourceGroup === "All" ? { leads: 1, enrolled: 1 } : {
    leads: groupTotals.find((g) => g.group === f.sourceGroup)!.leads / allSrcLeads,
    enrolled: groupTotals.find((g) => g.group === f.sourceGroup)!.enrolled / allSrcEnrolled,
  };

  const scale = (x: { leads: number; registered: number; enrolled: number }, rl = rangeLeads, re = rangeEnrol) => ({
    leads: Math.round(x.leads * rl * srcShare.leads),
    applications: Math.round(x.registered * rl * srcShare.leads),
    admissions: Math.round(x.enrolled * re * srcShare.enrolled),
  });

  const vacancyOf = (us: UnitStats[]) => us.reduce((s, u) => s + Math.max(0, u.seats - (u.enrolled - u.withdrawnNew)), 0);

  // Split the snapshot's totals across source groups so the parts add up exactly to the cards.
  // Admissions by source are FABS admissions matched to a LeadSquared lead; direct / unmapped ones have no source.
  const leadsAll = Math.round(t.leads * rangeLeads);
  const matchedAll = Math.round(t.enrolledMatched * rangeEnrol);
  const enrolledAll = Math.round(t.enrolled * rangeEnrol);
  const leadsSplit = splitExact(leadsAll, groupTotals.map((g) => g.leads));
  const admSplit = splitExact(matchedAll, groupTotals.map((g) => g.enrolled));
  const sources = groupTotals.map((g, i) => ({
    group: g.group,
    leads: leadsSplit[i],
    admissions: admSplit[i],
    conversion: pct(admSplit[i], leadsSplit[i]),
  }));
  const unattributedAdmissions = Math.max(0, enrolledAll - matchedAll);
  const selSource = f.sourceGroup === "All" ? null : sources.find((s) => s.group === f.sourceGroup) ?? null;

  // With a lead source picked, the cards show exactly that source's row of the Source widget.
  const flow = selSource
    ? { leads: selSource.leads, applications: Math.round(t.registered * rangeLeads * (leadsAll ? selSource.leads / leadsAll : 0)), admissions: selSource.admissions }
    : { leads: leadsAll, applications: Math.round(t.registered * rangeLeads), admissions: enrolledAll };
  const cur = { ...flow, vacancies: vacancyOf(units), withdrawals: t.withdrawnNew + t.withdrawnExisting, seats: t.seats };

  const pc = prevCycle(f.cycle);
  let prev: typeof cur | null = null;
  if (pc) {
    const pUnits = unitsFor(f.ids, pc, f.grade);
    const pt = sumStats(pUnits);
    // Like this year: with a lead source picked, only admissions matched to that source count.
    prev = { ...scale({ leads: pt.leads, registered: pt.registered, enrolled: selSource ? pt.enrolledMatched : pt.enrolled }), vacancies: vacancyOf(pUnits), withdrawals: pt.withdrawnNew + pt.withdrawnExisting, seats: pt.seats };
  }
  const change = (k: keyof typeof cur) => (prev && prev[k] ? ((cur[k] - prev[k]) / prev[k]) * 100 : null);

  // Grade-wise rows: grades for schools, programmes for Higher Ed (one vertical at a time).
  const verticals = Array.from(new Set(allUnits.map((u) => u.vertical)));
  const gradeVertical: Vertical = verticals.length === 1 ? verticals[0] : "Schools";
  const gradeMap = new Map<string, { unit: string; intake: number; enrolled: number; applications: number }>();
  for (const u of allUnits.filter((x) => x.vertical === gradeVertical)) {
    const key = u.unit.replace(" – Y1", "");
    const row = gradeMap.get(key) ?? { unit: key, intake: 0, enrolled: 0, applications: 0 };
    row.intake += u.seats;
    row.enrolled += u.enrolled - u.withdrawnNew;
    row.applications += u.registered;
    gradeMap.set(key, row);
  }
  const grades = [...gradeMap.values()].map((g) => ({ ...g, vacancy: Math.max(0, g.intake - g.enrolled), fillPct: pct(g.enrolled, g.intake) }));
  const selectedGrade = f.grade === "All" ? null : f.grade.replace(" – Y1", "");

  // Monthly series, split so each adds up exactly to the snapshot cards for the same filters.
  const trendLeads = splitExact(cur.leads, inRange.map((m) => m.leads));
  const trendAdm = splitExact(cur.admissions, inRange.map((m) => m.enrolled));
  const lyTotal = prev ? prev.leads : Math.round(sum(inRange, "leads") * gradeShare.leads * srcShare.leads);
  const trendLY = splitExact(lyTotal, inRange.map((m) => m.leadsLY));
  const trend = inRange.map((m, i) => ({ month: m.month, leads: trendLeads[i], leadsLY: trendLY[i], admissions: trendAdm[i] }));

  // Funnel for the same filters: LeadSquared stages scale with the Leads card, the FABS stage equals Admissions.
  const leadFactor = t.leads ? cur.leads / t.leads : 0;
  const scaleBy = (x: number) => Math.round(x * leadFactor);
  const funnel: Totals = {
    ...t,
    leads: cur.leads,
    contacted: scaleBy(t.contacted),
    registered: cur.applications,
    offers: Math.min(cur.applications, scaleBy(t.offers)),
    crmConfirmed: Math.min(Math.min(cur.applications, scaleBy(t.offers)), scaleBy(t.crmConfirmed)),
    enrolled: cur.admissions,
    enrolledMatched: selSource ? cur.admissions : Math.round(t.enrolledMatched * rangeEnrol),
    lost: scaleBy(t.lost),
    // Unlinked FABS admissions have no LeadSquared source, so only the date range narrows them.
    unmapped: Math.round(t.unmapped * rangeEnrol),
  };
  // Pending fee follows the confirmed stage; ageing buckets keep their mix.
  const pendingAll = t.pendingFee[0] + t.pendingFee[1] + t.pendingFee[2];
  // "Linked" (confirmed − pending) can never exceed the matched admissions shown in the funnel.
  const pendingNow = Math.min(
    funnel.crmConfirmed,
    Math.max(funnel.crmConfirmed - funnel.enrolledMatched, Math.round(pendingAll * (t.crmConfirmed ? funnel.crmConfirmed / t.crmConfirmed : 0))),
  );
  const [p0, p1, p2] = splitExact(pendingNow, [...t.pendingFee]);
  funnel.pendingFee = [p0, p1, p2];

  return {
    cur, prev, change, funnel, selectedGrade, selectedSource: selSource, grades, gradeVertical, mixedVerticals: verticals.length > 1, sources, unattributedAdmissions, trend,
    rangeLabel: rangeLabelOf(f.dateRange, f.custom ?? { start: "", end: "" }, f.cycle),
    rangeMonths: f.dateRange === "custom" ? rangeLabelOf("custom", f.custom!, f.cycle, true) : `${CYCLE_MONTHS[from]} – ${CYCLE_MONTHS[to]}`,
    totals: t,
  };
}

export type DashboardData = ReturnType<typeof dashboardData>;

/** Plain-language insights for the Quick Insights strip. */
export type InsightKind = "trend" | "source" | "conversion" | "vacancy";
export interface Insight {
  kind: InsightKind;
  tone: "good" | "bad" | "info" | "accent" | "warn";
  /** Short label above the value, e.g. "Top lead source". */
  label: string;
  /** The headline figure, e.g. "+4%" or "Grade XI · 51%". */
  value: string;
  /** One supporting line. */
  detail: string;
  /** Where to look next, if anywhere. */
  href?: string;
}

/** Up to four headline insights for the current filters. */
export function quickInsights(d: DashboardData): Insight[] {
  const out: Insight[] = [];
  const n = (x: number) => x.toLocaleString("en-IN");
  const unitName = (u: string) => `${d.gradeVertical === "Schools" ? "Grade " : ""}${u}`;

  const adm = d.change("admissions");
  if (adm !== null && d.prev)
    out.push({
      kind: "trend", tone: adm >= 0 ? "good" : "bad",
      label: "Admissions vs last year",
      value: `${adm >= 0 ? "+" : "−"}${Math.abs(adm).toFixed(Math.abs(adm) < 1 ? 1 : 0)}%`,
      detail: `${n(d.prev.admissions)} → ${n(d.cur.admissions)} in the same period`,
      href: "/drilldown",
    });

  const total = d.sources.reduce((s, x) => s + x.leads, 0) || 1;
  const ranked = [...d.sources].sort((a, b) => b.leads - a.leads);
  const sel = d.selectedSource;
  if (sel) {
    // A lead source is picked: describe that source rather than the overall leader.
    const rank = ranked.findIndex((s) => s.group === sel.group) + 1;
    const avg = (d.sources.reduce((s, x) => s + x.admissions, 0) / total) * 100;
    out.push({
      kind: "source", tone: "info",
      label: `${sel.group} leads`,
      value: `#${rank} of ${d.sources.length}`,
      detail: `${((sel.leads / total) * 100).toFixed(0)}% of leads · converts ${sel.conversion.toFixed(1)}% vs ${avg.toFixed(1)}% avg`,
    });
  } else if (ranked[0])
    out.push({
      kind: "source", tone: "info",
      label: "Top lead source",
      value: ranked[0].group,
      detail: `${((ranked[0].leads / total) * 100).toFixed(0)}% of all leads · ${n(ranked[0].leads)} leads`,
    });

  const pool = d.selectedGrade ? d.grades.filter((g) => g.unit === d.selectedGrade) : d.grades;
  const conv = [...pool].filter((g) => g.applications >= 10).sort((a, b) => pct(b.enrolled, b.applications) - pct(a.enrolled, a.applications))[0];
  // Ranking grades only makes sense when no single grade is picked.
  if (conv && !d.selectedGrade)
    out.push({
      kind: "conversion", tone: "accent",
      label: "Best conversion",
      value: `${unitName(conv.unit)} · ${pct(conv.enrolled, conv.applications).toFixed(0)}%`,
      detail: `${n(conv.applications)} applications → ${n(conv.enrolled)} admissions`,
      href: "/grades",
    });

  const vac = [...pool].filter((g) => g.intake >= 10).sort((a, b) => a.fillPct - b.fillPct)[0];
  if (vac)
    out.push({
      kind: "vacancy", tone: "warn",
      label: d.selectedGrade ? "Seats remaining" : "Lowest seat fill",
      value: `${unitName(vac.unit)} · ${vac.vacancy} left`,
      detail: `${n(vac.enrolled)} enrolled of ${n(vac.intake)} seats · ${vac.fillPct.toFixed(0)}% filled`,
      href: "/grades",
    });
  return out;
}

/** Splits an integer total across weights (largest remainder) so the parts sum exactly to the total. */
export function splitExact(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}
