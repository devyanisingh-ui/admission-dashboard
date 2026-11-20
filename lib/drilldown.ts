/**
 * Drill-down model: Group → Vertical → School / Institution → Grade / Programme → Funnel stage → Records.
 *
 * Every level reuses dashboardData(), so a node's figures are exactly what the Dashboard shows for the same
 * scope and Session / Lead source / Date range. Records are generated so their count equals the stage figure.
 */
import { clampSpan, cycleBounds, DATE_RANGES, type DateRange, type DateSpan } from "./context";
import { dashboardData } from "./dashboard";
import {
  between, HIST_SOURCES, kpis, locationById, person, pick, rng, SOURCE_GROUP_OF,
  type Cycle, type Location, type SourceGroup, type Vertical,
} from "./data";

/* ------------------------------------------------------------------ */
/* Path                                                                */
/* ------------------------------------------------------------------ */

export const STAGES = [
  { key: "leads", label: "Enquiry", status: "New Lead", sys: "LeadSquared" },
  { key: "contacted", label: "Contacted", status: "Follow-up (Attempt 1–5)", sys: "LeadSquared" },
  { key: "registered", label: "Registered", status: "Registration Done", sys: "SaaS" },
  { key: "offers", label: "Offer issued", status: "Offer Letter", sys: "LeadSquared" },
  { key: "crmConfirmed", label: "Admission confirmed", status: "Admission / Orientation", sys: "LeadSquared" },
  { key: "enrolled", label: "Fee paid / Enrolled", status: "Fee paid (FABS)", sys: "FABS" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

/** Where the user is. Each field is set only from its level down. */
export interface DrillPath {
  vertical?: Vertical;
  loc?: string;
  /** Grade / programme unit name as stored (e.g. "Nursery", "MBA – Y1"). */
  grade?: string;
  stage?: StageKey;
}
export type Level = "group" | "vertical" | "school" | "grade" | "stage";

/** Link to a drill-down node (used by the Dashboard's deep links). */
export function drillHref(p: DrillPath) {
  const sp = new URLSearchParams();
  if (p.vertical) sp.set("v", p.vertical);
  if (p.loc) sp.set("loc", p.loc);
  if (p.grade) sp.set("g", p.grade);
  if (p.stage) sp.set("stage", p.stage);
  const q = sp.toString();
  return `/drilldown${q ? `?${q}` : ""}`;
}

export const levelOf = (p: DrillPath): Level => (p.stage ? "stage" : p.grade && p.loc ? "grade" : p.loc ? "school" : p.vertical ? "vertical" : "group");
export const unitLabel = (u: string) => u.replace(" – Y1", "");

export interface Scope {
  cycle: Cycle;
  sourceGroup: SourceGroup | "All";
  dateRange: DateRange;
  custom: DateSpan;
  /** Locations the role may see. */
  allowed: Location[];
}

/** Locations a node covers (respecting the role's scope). */
export function locationsOf(p: DrillPath, s: Scope) {
  if (p.loc) return s.allowed.filter((l) => l.id === p.loc);
  if (p.vertical) return s.allowed.filter((l) => l.vertical === p.vertical);
  return s.allowed;
}

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

export type Measure = "seatFill" | "admissions" | "conversion" | "leads";
export const MEASURES: { key: Measure; label: string; pct?: boolean }[] = [
  { key: "seatFill", label: "Seat fill", pct: true },
  { key: "admissions", label: "Admissions" },
  { key: "conversion", label: "Conversion %", pct: true },
  { key: "leads", label: "Leads" },
];
export const FILL_GREEN = 82;
export const FILL_AMBER = 72;

export interface NodeStats {
  leads: number;
  applications: number;
  admissions: number;
  conversion: number;
  seatFill: number;
  vacancies: number;
  withdrawals: number;
  seats: number;
  /** % change vs the same period last year, where a previous session exists. */
  change: { leads: number | null; applications: number | null; admissions: number | null; vacancies: number | null; withdrawals: number | null };
  funnel: Record<StageKey, number>;
  matched: number;
}

/** Figures for one node; `grade` narrows schools / vertical / group to that grade (a "focus"). */
export function nodeStats(ids: string[], grade: string | undefined, s: Scope): NodeStats {
  const d = dashboardData({ ids, cycle: s.cycle, grade: grade ?? "All", sourceGroup: s.sourceGroup, dateRange: s.dateRange, custom: s.custom });
  const k = kpis(d.totals);
  return {
    leads: d.cur.leads,
    applications: d.cur.applications,
    admissions: d.cur.admissions,
    conversion: d.cur.leads ? (d.cur.admissions / d.cur.leads) * 100 : 0,
    seatFill: k.seatFill,
    vacancies: d.cur.vacancies,
    withdrawals: d.cur.withdrawals,
    seats: d.cur.seats,
    change: {
      leads: d.change("leads"), applications: d.change("applications"), admissions: d.change("admissions"),
      vacancies: d.change("vacancies"), withdrawals: d.change("withdrawals"),
    },
    funnel: {
      leads: d.funnel.leads, contacted: d.funnel.contacted, registered: d.funnel.registered,
      offers: d.funnel.offers, crmConfirmed: d.funnel.crmConfirmed, enrolled: d.funnel.enrolled,
    },
    matched: d.funnel.enrolledMatched,
  };
}

export interface ChildRow {
  id: string;
  label: string;
  sub?: string;
  path: DrillPath;
  stats: NodeStats;
}

/** The next level down from a node (not used at grade / stage level, where the children are funnel stages). */
export function childrenOf(p: DrillPath, s: Scope): ChildRow[] {
  const lvl = levelOf(p);
  if (lvl === "group") {
    return (["Schools", "Higher Ed"] as Vertical[])
      .map((v) => ({ v, locs: s.allowed.filter((l) => l.vertical === v && (!p.grade || l.units.includes(p.grade))) }))
      .filter((x) => x.locs.length)
      .map(({ v, locs }) => ({
        id: v, label: v, sub: `${locs.length} ${v === "Schools" ? "schools" : "institutions"}`,
        path: { vertical: v, grade: p.grade }, stats: nodeStats(locs.map((l) => l.id), p.grade, s),
      }));
  }
  if (lvl === "vertical") {
    return locationsOf(p, s)
      .filter((l) => !p.grade || l.units.includes(p.grade))
      .map((l) => ({
        id: l.id, label: l.short, sub: `${l.board} · ${l.city}`,
        // A grade focus jumps straight to that grade at the chosen school.
        path: { vertical: l.vertical, loc: l.id, grade: p.grade }, stats: nodeStats([l.id], p.grade, s),
      }));
  }
  // School → its grades / programmes.
  const loc = locationById(p.loc!);
  return loc.units.map((u) => ({
    id: u, label: unitLabel(u), path: { vertical: loc.vertical, loc: loc.id, grade: u }, stats: nodeStats([loc.id], u, s),
  }));
}

/** Leads who reached a stage and have gone no further. Enrolled is final, so everyone stays. */
export function stillAt(f: Record<StageKey, number>, matched: number, key: StageKey) {
  const i = STAGES.findIndex((x) => x.key === key);
  if (key === "enrolled") return f.enrolled;
  const next = key === "crmConfirmed" ? Math.min(f.crmConfirmed, matched) : f[STAGES[i + 1].key];
  return Math.max(0, f[key] - next);
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export interface LeadRecord {
  kind: "lead";
  id: string;
  child: string;
  parent: string;
  mobile: string;
  source: string;
  counsellor: string;
  /** Furthest stage reached (current status). */
  current: StageKey;
  status: string;
  createdOn: string;
  createdIso: string;
  daysInStage: number;
}
export interface AdmissionRecord {
  kind: "admission";
  id: string;
  child: string;
  parent: string;
  mobile: string;
  source: string;
  counsellor: string;
  leadId: string | null;
  link: "Linked" | "Unmapped" | "Direct admission";
  feePaidOn: string;
  feePaidIso: string;
}
export type DrillRecord = LeadRecord | AdmissionRecord;

const TODAY = Date.UTC(2026, 10, 17);
const DAY = 86_400_000;
const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Calendar dates covered by a preset or custom range. */
export function rangeSpanOf(range: DateRange, custom: DateSpan, cycle: Cycle): DateSpan {
  if (range === "custom") return clampSpan(custom, cycle);
  const [from, to] = DATE_RANGES.find((d) => d.value === range)!.months;
  const y = Number(cycle.slice(0, 4)) - 1;
  const first = (i: number) => Date.UTC(i < 3 ? y : y + 1, (9 + i) % 12, 1);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { start: iso(first(from)), end: iso(first(to + 1 > 11 ? 12 : to + 1) - DAY) };
}

/**
 * Records behind one stage of one grade. Count = that stage's figure; the first `still` rows are still at the
 * stage, the rest have moved on in the same proportions as the funnel.
 */
export function stageRecords(locId: string, grade: string, stage: StageKey, st: NodeStats, s: Scope): DrillRecord[] {
  const loc = locationById(locId);
  const f = st.funnel;
  const span = rangeSpanOf(s.dateRange, s.custom, s.cycle);
  const b = cycleBounds(s.cycle);
  const t0 = Date.parse(`${span.start || b.start}T00:00:00Z`);
  const t1 = Math.min(Date.parse(`${span.end || b.end}T00:00:00Z`), TODAY);
  const r = rng(["drill", locId, grade, stage, s.cycle, s.sourceGroup, span.start, span.end].join("|"));
  const sources = s.sourceGroup === "All" ? HIST_SOURCES : HIST_SOURCES.filter((x) => SOURCE_GROUP_OF[x] === s.sourceGroup);
  const prefix = loc.codes.crm.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const date = () => t0 + Math.floor(r() * Math.max(1, (t1 - t0) / DAY + 1)) * DAY;

  if (stage === "enrolled") {
    const n = f.enrolled;
    const linked = Math.min(n, st.matched);
    const unmapped = Math.round((n - linked) * 0.6);
    return Array.from({ length: n }, (_, i): AdmissionRecord => {
      const p = person(r);
      const paid = date();
      const link: AdmissionRecord["link"] = i < linked ? "Linked" : i < linked + unmapped ? "Unmapped" : "Direct admission";
      return {
        kind: "admission" as const,
        id: `${loc.codes.fabs}/${s.cycle.slice(2, 4)}/${String(1000 + i).padStart(5, "0")}`,
        ...p,
        source: link === "Linked" ? pick(r, sources) : "—",
        counsellor: pick(r, loc.counsellors),
        leadId: link === "Linked" ? `L-${Math.floor(between(r, 200000, 299999))}` : null,
        link,
        feePaidOn: fmt(paid),
        feePaidIso: new Date(paid).toISOString().slice(0, 10),
      };
    }).sort((a, b) => b.feePaidIso.localeCompare(a.feePaidIso));
  }

  // How many of those who reached this stage are now at each later stage.
  const i0 = STAGES.findIndex((x) => x.key === stage);
  const leadStages = STAGES.slice(0, 5).map((x) => x.key);
  const atStage = leadStages.map((k, i) => (i < i0 ? 0 : stillAt(f, st.matched, k)));
  // Those who went on to enrol (matched) count as "Admission / Orientation" in LeadSquared.
  atStage[4] += i0 <= 4 ? Math.min(f.crmConfirmed, st.matched) : 0;
  const total = f[stage];
  const plan: StageKey[] = [];
  atStage.forEach((n, i) => { for (let k = 0; k < n; k++) plan.push(leadStages[i]); });
  while (plan.length < total) plan.push(leadStages[Math.max(i0, plan.length ? leadStages.indexOf(plan[plan.length - 1]) : i0)]);
  plan.length = total;

  return plan.map((cur, i) => {
    const p = person(r);
    const created = date();
    const age = Math.max(0, Math.round((TODAY - created) / DAY));
    const meta = STAGES.find((x) => x.key === cur)!;
    return {
      kind: "lead" as const,
      id: `L-${prefix}${String(200000 + Math.floor(between(r, 0, 99999))).slice(-6)}`,
      ...p,
      source: pick(r, sources),
      counsellor: pick(r, loc.counsellors),
      current: cur,
      status: cur === "contacted" ? `Attempt ${1 + Math.floor(r() * 5)}` : meta.status,
      createdOn: fmt(created),
      createdIso: new Date(created).toISOString().slice(0, 10),
      // Time since the last stage change: mostly 1–4 weeks with a tail past 30 days, never older than the lead.
      daysInStage: Math.max(1, Math.min(age, Math.round(1 + Math.pow(r(), 1.7) * 58) + (i % 3))),
    };
  }).sort((a, b) => b.createdIso.localeCompare(a.createdIso)); // newest first
}

