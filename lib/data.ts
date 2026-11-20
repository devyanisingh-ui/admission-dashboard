/**
 * Mock data layer for the Phase 1 UI.
 *
 * In production every number here comes from the sync service (SaaS / CRM / FABS
 * read via REST every 15 min + nightly reconciliation). This module generates
 * deterministic demo data with the same shape so the UI can be built and reviewed
 * before the integration is live. Replace the exported functions with API calls.
 */

export type Vertical = "Schools" | "Higher Ed";
export type Board = "CBSE" | "IB" | "UGC" | "AICTE";
export type Cycle = "2026-27" | "2025-26";
export const CYCLES: Cycle[] = ["2026-27", "2025-26"];
export const CURRENT_CYCLE: Cycle = "2026-27";

export interface Location {
  id: string;
  name: string;
  short: string;
  vertical: Vertical;
  board: Board;
  city: string;
  codes: { saas: string; crm: string; fabs: string };
  counsellors: string[];
  units: string[];
  /** Created in Masters — no source-system history, so every figure starts at zero. */
  isNew?: boolean;
  /** Unit display name → name it was loaded with (keeps mock data stable across renames); null = new unit. */
  unitSeed?: Record<string, string | null>;
}

/* ------------------------------------------------------------------ */
/* Deterministic random                                                */
/* ------------------------------------------------------------------ */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (r: () => number, min: number, max: number) => min + r() * (max - min);
export const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */
export const SCHOOL_GRADES = ["Nursery", "KG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const COUNSELLOR_POOL = [
  "Neha Arora", "Rohit Khanna", "Priya Nair", "Sandeep Malik", "Kavita Iyer", "Amit Sethi", "Pooja Bhatia",
  "Rahul Saxena", "Meenakshi Rao", "Vikas Chopra", "Shalini Gupta", "Deepak Joshi", "Ritu Bansal", "Manish Reddy",
  "Anjali Mehta", "Gaurav Kapoor", "Sonal Jain", "Tarun Agarwal", "Nidhi Verma", "Harish Pillai", "Swati Sharma",
  "Karan Malhotra", "Divya Menon", "Arvind Singh",
];

function mkLoc(
  id: string, name: string, short: string, vertical: Vertical, board: Board, city: string, units: string[], i: number,
): Location {
  return {
    id, name, short, vertical, board, city, units,
    codes: {
      saas: `SAAS-${short.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4)}`,
      crm: `${vertical === "Schools" ? "SCH" : "HE"}_${String(101 + i)}`,
      fabs: `F${String(i + 1).padStart(3, "0")}`,
    },
    counsellors: COUNSELLOR_POOL.slice((i * 3) % COUNSELLOR_POOL.length, ((i * 3) % COUNSELLOR_POOL.length) + 3),
  };
}

/** Locations as loaded from the source systems. */
export const SEED_LOCATIONS: Location[] = [
  mkLoc("saket", "Apeejay School, Saket", "Saket", "Schools", "CBSE", "New Delhi", SCHOOL_GRADES, 0),
  mkLoc("pitampura", "Apeejay School, Pitampura", "Pitampura", "Schools", "CBSE", "New Delhi", SCHOOL_GRADES, 1),
  mkLoc("sheikh-sarai", "Apeejay School, Sheikh Sarai", "Sheikh Sarai", "Schools", "CBSE", "New Delhi", SCHOOL_GRADES, 2),
  mkLoc("noida", "Apeejay School, Noida", "Noida", "Schools", "CBSE", "Noida", SCHOOL_GRADES, 3),
  mkLoc("faridabad", "Apeejay School, Faridabad", "Faridabad", "Schools", "CBSE", "Faridabad", SCHOOL_GRADES, 4),
  mkLoc("nerul", "Apeejay School, Nerul", "Nerul", "Schools", "CBSE", "Navi Mumbai", SCHOOL_GRADES, 5),
  mkLoc("intl", "Apeejay School International", "International", "Schools", "IB", "New Delhi", SCHOOL_GRADES, 6),
  mkLoc("asu", "Apeejay Stya University", "Stya University", "Higher Ed", "UGC", "Gurugram",
    ["B.Tech CSE – Y1", "BBA – Y1", "MBA – Y1", "B.Des – Y1", "LLB – Y1", "B.Sc Biotech – Y1"], 7),
  mkLoc("aim", "Apeejay Institute of Management", "AIMTC Jalandhar", "Higher Ed", "AICTE", "Jalandhar",
    ["MBA – Y1", "BBA – Y1", "MCA – Y1", "BCA – Y1"], 8),
  mkLoc("acfa", "Apeejay College of Fine Arts", "ACFA Jalandhar", "Higher Ed", "UGC", "Jalandhar",
    ["BFA – Y1", "BA – Y1", "B.Com – Y1", "MA Music – Y1"], 9),
  mkLoc("aid", "Apeejay Institute of Design", "Institute of Design", "Higher Ed", "UGC", "New Delhi",
    ["B.Des – Y1", "M.Des – Y1", "Diploma Interior – Y1"], 10),
];

/** Active locations — kept in step with the Masters (see `applyMasters`). */
export const LOCATIONS: Location[] = [...SEED_LOCATIONS];
/** Every location including inactive ones, so old links and saved data still resolve. */
const ALL_LOCATIONS = new Map<string, Location>(SEED_LOCATIONS.map((l) => [l.id, l]));
export const locationById = (id: string) => ALL_LOCATIONS.get(id) ?? LOCATIONS.find((l) => l.id === id)!;
export const allLocations = () => [...ALL_LOCATIONS.values()];
/** The name a unit's mock data is generated from, or null when the unit (or its location) has no history. */
export function unitSeedOf(locId: string, unit: string): string | null {
  const loc = ALL_LOCATIONS.get(locId);
  if (!loc || loc.isNew) return null;
  if (!loc.unitSeed) return unit;
  return unit in loc.unitSeed ? loc.unitSeed[unit] : null;
}
const hasHistory = (locId: string) => !locationById(locId)?.isNew;

/** LeadSquared lead sources (mock). Each rolls up into one of the reporting groups below. */
export const SEED_SOURCES = [
  "Website (SaaS form)", "Google Ads", "Meta Ads", "RWA activation", "Preschool / Crèche tie-up", "Education fair",
  "Corporate tie-up", "Walk-in", "Referral / Sibling", "Newspaper / Print",
];
const SOURCE_WEIGHTS = [0.08, 0.06, 0.04, 0.28, 0.22, 0.12, 0.08, 0.05, 0.05, 0.02];
const SOURCE_CONV = [1.0, 0.75, 0.6, 1.1, 1.35, 0.85, 1.2, 1.6, 2.0, 0.7];
/** Every lead source shown in reports (history + new ones from Masters). */
export const SOURCES: string[] = [...SEED_SOURCES];
/** Sources that existing leads carry, in load order (renames applied) — sample records pick from these. */
export const HIST_SOURCES: string[] = [...SEED_SOURCES];
let sourceIndex = new Map<string, number>(SEED_SOURCES.map((x, i) => [x, i]));
const srcWeight = (name: string) => (sourceIndex.has(name) ? SOURCE_WEIGHTS[sourceIndex.get(name)!] : 0);
const srcConv = (name: string) => (sourceIndex.has(name) ? SOURCE_CONV[sourceIndex.get(name)!] : 1);

/** Reporting groups used by the dashboard's source donut and the Lead Source filter. */
export const SOURCE_GROUPS = ["RWA", "Preschool / Crèche", "Digital", "Education Fairs", "Corporate", "Others"] as const;
export type SourceGroup = (typeof SOURCE_GROUPS)[number];
const SEED_SOURCE_GROUP_OF: Record<string, SourceGroup> = {
  "Website (SaaS form)": "Digital", "Google Ads": "Digital", "Meta Ads": "Digital", "RWA activation": "RWA",
  "Preschool / Crèche tie-up": "Preschool / Crèche", "Education fair": "Education Fairs", "Corporate tie-up": "Corporate",
  "Walk-in": "Others", "Referral / Sibling": "Others", "Newspaper / Print": "Others",
};
export const SOURCE_GROUP_OF: Record<string, SourceGroup> = { ...SEED_SOURCE_GROUP_OF };
export { SEED_SOURCE_GROUP_OF };
/** Share of leads coming from each source group (sums to 1). */
export const SOURCE_GROUP_SHARE = {} as Record<SourceGroup, number>;
function recomputeGroupShare() {
  for (const g of SOURCE_GROUPS) SOURCE_GROUP_SHARE[g] = 0;
  for (const x of SOURCES) SOURCE_GROUP_SHARE[SOURCE_GROUP_OF[x]] = (SOURCE_GROUP_SHARE[SOURCE_GROUP_OF[x]] ?? 0) + srcWeight(x);
}
recomputeGroupShare();

export const SEED_REASONS = [
  "Relocation", "Fee concerns", "Admission elsewhere", "Transport / distance", "Academic", "Health", "Other",
];
/** Every withdrawal reason shown in reports (history + new ones from Masters). */
export const WITHDRAWAL_REASONS: string[] = [...SEED_REASONS];
/** Reasons past withdrawals carry, in load order (renames applied). */
export const HIST_REASONS: string[] = [...SEED_REASONS];

/* ------------------------------------------------------------------ */
/* Unit-level stats                                                    */
/* ------------------------------------------------------------------ */
export interface UnitStats {
  locationId: string;
  unit: string;
  seats: number; // seats for new admission (Seat Matrix)
  intake: number; // total intake capacity
  continuing: number; // existing students continuing
  ewsSeats: number;
  ewsFilled: number;
  target: number;
  leads: number;
  contacted: number;
  registered: number;
  offers: number;
  crmConfirmed: number;
  enrolled: number; // FABS fee paid / admission no. generated
  enrolledMatched: number; // linked to a CRM lead
  unmapped: number; // FABS admissions not yet mapped
  directAdmissions: number; // marked "Direct admission – no CRM lead"
  pendingFee: [number, number, number]; // 0–7, 8–15, 15+ days
  lost: number;
  withdrawnNew: number;
  withdrawnExisting: number;
  leadsLY: number;
  enrolledLY: number;
}

/**
 * Mock Seat Matrix: seats for new admission per grade.
 * Entry grades (Nursery, XI) take most new students; every other grade has
 * lateral-entry seats from vacancies left by leavers.
 */
const SCHOOL_SEAT_RANGE: Record<string, [number, number]> = {
  Nursery: [100, 140], KG: [28, 42], I: [22, 34], II: [16, 26], III: [14, 24], IV: [14, 22], V: [12, 22],
  VI: [16, 28], VII: [12, 20], VIII: [10, 18], IX: [14, 24], X: [6, 12], XI: [60, 90], XII: [4, 10],
};
function seatsFor(loc: Location, unit: string, r: () => number) {
  if (loc.vertical === "Higher Ed") return Math.round(between(r, 40, 180) / 10) * 10;
  const [min, max] = SCHOOL_SEAT_RANGE[unit] ?? [10, 20];
  return Math.round(between(r, min, max));
}

/** Mock seat-fill level per location (centre of the random range). */
const FILL_BIAS: Record<string, number> = {
  saket: 0.88, pitampura: 0.85, "sheikh-sarai": 0.8, noida: 0.84, faridabad: 0.62, nerul: 0.78, intl: 0.7,
  asu: 0.8, aim: 0.7, acfa: 0.64, aid: 0.56,
};

/**
 * Mock funnel ratios (multipliers walking up the funnel from CRM-confirmed) by segment:
 * - CBSE schools: high-intent local enquiries, healthy lead → application.
 * - IB: fewer, better-qualified leads (high lead → app) but more offers declined on fees (lower offer → admission).
 * - Higher Ed: large top of funnel from ads and fairs, so lead → application is much lower.
 */
function funnelProfile(loc: Location) {
  if (loc.vertical === "Higher Ed") return { offers: [1.5, 1.9], registered: [1.4, 1.8], contacted: [2.4, 3.2] };
  if (loc.board === "IB") return { offers: [1.7, 2.1], registered: [1.1, 1.25], contacted: [1.3, 1.6] };
  return { offers: [1.25, 1.55], registered: [1.15, 1.4], contacted: [1.6, 2.1] };
}

/** The four Seat Matrix figures held per grade / programme. */
export type SeatField = "intake" | "continuing" | "seats" | "ewsSeats";
export type SeatValues = Record<SeatField, number>;

function mockSeatValues(loc: Location, unit: string, rBase: () => number): SeatValues {
  const seats = seatsFor(loc, unit, rBase);
  const continuing = loc.vertical === "Higher Ed" ? 0 : Math.round(between(rBase, 110, 170));
  const ewsSeats = loc.vertical === "Schools" && (unit === "Nursery" || unit === "KG") ? Math.round(seats * 0.25) : 0;
  return { seats, continuing, intake: seats + continuing, ewsSeats };
}
/** The Seat Matrix as first loaded (before any saved change). */
export function defaultSeatValues(locId: string, unit: string): SeatValues {
  const seed = unitSeedOf(locId, unit);
  if (seed === null) return { seats: 0, continuing: 0, intake: 0, ewsSeats: 0 };
  return mockSeatValues(locationById(locId), seed, rng(`${locId}|${seed}`));
}

/**
 * Saved Seat Matrix values (key "cycle|locId|unit"), set by the app context from the planning store.
 * They replace the capacity figures only: leads and admissions do not change when seats are edited.
 */
let seatOverrides = new Map<string, SeatValues>();
export function setSeatOverrides(next: Map<string, SeatValues>) {
  seatOverrides = next;
}

export function unitStats(locId: string, unit: string, cycle: Cycle): UnitStats {
  const base = baseUnitStats(locId, unit, cycle);
  const o = seatOverrides.get(`${cycle}|${locId}|${unit}`);
  if (!o) return base;
  const ewsFilled = Math.min(base.ewsFilled, o.ewsSeats);
  return { ...base, ...o, ewsFilled };
}

function emptyUnit(locId: string, unit: string): UnitStats {
  return {
    locationId: locId, unit, seats: 0, intake: 0, continuing: 0, ewsSeats: 0, ewsFilled: 0, target: 0,
    leads: 0, contacted: 0, registered: 0, offers: 0, crmConfirmed: 0, enrolled: 0, enrolledMatched: 0, unmapped: 0, directAdmissions: 0,
    pendingFee: [0, 0, 0], lost: 0, withdrawnNew: 0, withdrawnExisting: 0, leadsLY: 0, enrolledLY: 0,
  };
}

function baseUnitStats(locId: string, unit: string, cycle: Cycle): UnitStats {
  const loc = locationById(locId);
  // Units added in Masters have no history yet; renamed units keep the data they were loaded with.
  const seed = unitSeedOf(locId, unit);
  if (seed === null) return emptyUnit(locId, unit);
  const r = rng(`${locId}|${seed}|${cycle}`);
  const rBase = rng(`${locId}|${seed}`);
  const { seats, continuing, intake, ewsSeats } = mockSeatValues(loc, seed, rBase);
  const fill = Math.min(1.05, between(r, FILL_BIAS[loc.id] - 0.15, FILL_BIAS[loc.id] + 0.2));
  const p = funnelProfile(loc);
  const enrolled = Math.max(0, Math.round(seats * fill));
  const crmConfirmed = Math.round(enrolled * between(r, 1.03, 1.16));
  const offers = Math.round(crmConfirmed * between(r, p.offers[0], p.offers[1]));
  const registered = Math.round(offers * between(r, p.registered[0], p.registered[1]));
  const contacted = Math.round(registered * between(r, p.contacted[0], p.contacted[1]));
  const leads = Math.round(contacted * between(r, 1.08, 1.25));
  const unmapped = cycle === CURRENT_CYCLE ? Math.round(enrolled * between(r, 0, 0.07)) : 0;
  const directAdmissions = Math.round(enrolled * between(r, 0, 0.05));
  const enrolledMatched = Math.max(0, enrolled - unmapped - directAdmissions);
  const pendingTotal = Math.max(0, crmConfirmed - enrolledMatched);
  // Mock ageing: most pending fees are recent; a long tail is over 15 days.
  const p1 = Math.round(pendingTotal * between(r, 0.52, 0.66));
  const p2 = Math.round((pendingTotal - p1) * between(r, 0.55, 0.7));
  const withdrawnNew = Math.round(enrolled * between(r, 0.02, 0.07));
  const withdrawnExisting = Math.round(continuing * between(r, 0.01, 0.045));
  const target = Math.round(seats * between(rBase, 0.9, 1.0));
  const ewsFilled = Math.round(ewsSeats * between(r, 0.6, 1));
  return {
    locationId: locId, unit, seats, intake, continuing, ewsSeats, ewsFilled, target,
    leads, contacted, registered, offers, crmConfirmed, enrolled, enrolledMatched, unmapped, directAdmissions,
    pendingFee: [p1, p2, pendingTotal - p1 - p2],
    lost: Math.round((leads - crmConfirmed) * between(r, 0.45, 0.6)),
    withdrawnNew, withdrawnExisting,
    leadsLY: Math.round(leads * between(r, 0.78, 1.12)),
    enrolledLY: Math.round(enrolled * between(r, 0.82, 1.1)),
  };
}

export type Totals = Omit<UnitStats, "locationId" | "unit">;

export function sumStats(list: UnitStats[]): Totals {
  const t: Totals = {
    seats: 0, intake: 0, continuing: 0, ewsSeats: 0, ewsFilled: 0, target: 0, leads: 0, contacted: 0, registered: 0,
    offers: 0, crmConfirmed: 0, enrolled: 0, enrolledMatched: 0, unmapped: 0, directAdmissions: 0,
    pendingFee: [0, 0, 0], lost: 0, withdrawnNew: 0, withdrawnExisting: 0, leadsLY: 0, enrolledLY: 0,
  };
  for (const s of list) {
    for (const k of Object.keys(t) as (keyof Totals)[]) {
      if (k === "pendingFee") {
        t.pendingFee = [t.pendingFee[0] + s.pendingFee[0], t.pendingFee[1] + s.pendingFee[1], t.pendingFee[2] + s.pendingFee[2]];
      } else {
        (t[k] as number) += s[k] as number;
      }
    }
  }
  return t;
}

export function locationUnits(locId: string, cycle: Cycle) {
  return locationById(locId).units.map((u) => unitStats(locId, u, cycle));
}
export function locationTotals(locId: string, cycle: Cycle) {
  return sumStats(locationUnits(locId, cycle));
}
export function totalsFor(locIds: string[], cycle: Cycle) {
  return sumStats(locIds.flatMap((id) => locationUnits(id, cycle)));
}

/* Derived KPIs */
export function kpis(t: Totals) {
  const pending = t.pendingFee[0] + t.pendingFee[1] + t.pendingFee[2];
  const net = t.enrolled - t.withdrawnNew;
  return {
    leads: t.leads,
    applications: t.registered,
    offers: t.offers,
    crmConfirmed: t.crmConfirmed,
    enrolled: t.enrolled,
    withdrawals: t.withdrawnNew + t.withdrawnExisting,
    withdrawnNew: t.withdrawnNew,
    withdrawnExisting: t.withdrawnExisting,
    net,
    seats: t.seats,
    vacancies: Math.max(0, t.seats - net),
    seatFill: pct(net, t.seats),
    leadToApp: pct(t.registered, t.leads),
    appToAdm: pct(t.enrolledMatched, t.registered),
    overall: pct(t.enrolledMatched, t.leads),
    targetAch: pct(t.enrolled, t.target),
    pending,
    unmapped: t.unmapped,
    leadsVsLY: pct(t.leads - t.leadsLY, t.leadsLY),
    enrolledVsLY: pct(t.enrolled - t.enrolledLY, t.enrolledLY),
    ewsFill: pct(t.ewsFilled, t.ewsSeats),
  };
}
export function pct(a: number, b: number) {
  return b ? (a / b) * 100 : 0;
}

/* ------------------------------------------------------------------ */
/* Time series                                                         */
/* ------------------------------------------------------------------ */
export const CYCLE_MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

/**
 * Mock seasonality — share of a cycle's leads / enrolments arriving each month (Oct → Sep).
 * Schools peak Nov–Feb (Nursery & entry-class admissions); Higher Ed peaks Apr–Jul (after board results).
 */
const LEAD_SEASON: Record<Vertical, number[]> = {
  Schools: [0.08, 0.13, 0.15, 0.16, 0.13, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02],
  "Higher Ed": [0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.13, 0.17, 0.17, 0.13, 0.08, 0.04],
};
const ENROL_SEASON: Record<Vertical, number[]> = {
  Schools: [0.0, 0.02, 0.06, 0.12, 0.16, 0.18, 0.18, 0.12, 0.07, 0.05, 0.03, 0.01],
  "Higher Ed": [0.0, 0.0, 0.01, 0.02, 0.03, 0.04, 0.06, 0.12, 0.2, 0.25, 0.19, 0.08],
};
/** Last cycle ran slightly earlier in Schools (admissions opened mid-Sep). */
const LY_SHIFT: Record<Vertical, number[]> = {
  Schools: [1.25, 1.15, 1.05, 1.0, 0.95, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  "Higher Ed": [1, 1, 1, 1, 1, 1, 0.95, 1.05, 1.05, 1, 0.95, 0.95],
};

export function leadTrend(locIds: string[], cycle: Cycle) {
  const r = rng(locIds.join(",") + cycle + "trend");
  const monthly = CYCLE_MONTHS.map(() => ({ leads: 0, leadsLY: 0, enrolled: 0 }));
  for (const id of locIds) {
    const v = locationById(id).vertical;
    const t = locationTotals(id, cycle);
    // Normalise LY shape so it still sums to the LY total.
    const lyShape = LEAD_SEASON[v].map((s, i) => s * LY_SHIFT[v][i]);
    const lySum = lyShape.reduce((a, b) => a + b, 0);
    CYCLE_MONTHS.forEach((_, i) => {
      const j = between(r, 0.88, 1.12);
      monthly[i].leads += t.leads * LEAD_SEASON[v][i] * j;
      monthly[i].leadsLY += (t.leadsLY * lyShape[i]) / lySum * between(r, 0.9, 1.1);
      monthly[i].enrolled += t.enrolled * ENROL_SEASON[v][i] * j;
    });
  }
  const totals = sumStats(locIds.flatMap((id) => locationUnits(id, cycle)));
  let cum = 0, cumLY = 0, cumEnr = 0;
  return CYCLE_MONTHS.map((month, i) => {
    cum += monthly[i].leads;
    cumLY += monthly[i].leadsLY;
    cumEnr += monthly[i].enrolled;
    return {
      month,
      newLeads: Math.round(monthly[i].leads),
      leads: Math.round(Math.min(cum, totals.leads)),
      leadsLY: Math.round(Math.min(cumLY, totals.leadsLY)),
      enrolled: Math.round(Math.min(cumEnr, totals.enrolled)),
    };
  });
}

export function sourceBreakdown(locIds: string[], cycle: Cycle) {
  const t = totalsFor(locIds, cycle);
  const wSum = SOURCES.reduce((a, x) => a + srcWeight(x) * srcConv(x), 0) || 1;
  return SOURCES.map((s) => {
    const w = srcWeight(s), cv = srcConv(s);
    const leads = Math.round(t.leads * w);
    const registered = Math.round(t.registered * w * (0.8 + cv * 0.2));
    const enrolled = Math.round((t.enrolledMatched * w * cv) / wSum);
    const r = rng(s + cycle + locIds.join());
    return { source: s, leads, registered, enrolled, conv: pct(enrolled, leads), convLastMonth: pct(enrolled, leads) * between(r, 0.85, 1.45) };
  });
}

export function counsellorPerf(locId: string, cycle: Cycle) {
  const loc = locationById(locId);
  const t = locationTotals(locId, cycle);
  const r = rng(locId + "c" + cycle);
  const shares = loc.counsellors.map(() => between(r, 0.7, 1.3));
  const sSum = shares.reduce((a, b) => a + b, 0);
  return loc.counsellors.map((name, i) => {
    const sh = shares[i] / sSum;
    const eff = between(r, 0.8, 1.2);
    const leads = Math.round(t.leads * sh);
    const enrolled = Math.round(t.enrolledMatched * sh * eff);
    return {
      name, leads,
      offers: Math.round(t.offers * sh * eff),
      confirmed: Math.round(t.crmConfirmed * sh * eff),
      enrolled,
      conv: pct(enrolled, leads),
      pendingMapping: loc.isNew ? 0 : Math.round(between(r, 0, 5)),
    };
  });
}

/**
 * Mock reason mix (order = WITHDRAWAL_REASONS). New admissions mostly drop out because they got a
 * seat elsewhere or over fees; existing students mostly leave because the family relocates.
 */
const REASON_MIX = {
  newAdmission: [0.14, 0.22, 0.34, 0.14, 0.05, 0.03, 0.08],
  existing: [0.38, 0.17, 0.14, 0.11, 0.1, 0.04, 0.06],
};
function pickWeighted(r: () => number, weights: number[]) {
  let x = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) < 0) return i;
  return weights.length - 1;
}

export function withdrawalsByReason(locIds: string[], cycle: Cycle) {
  const units = locIds.flatMap((id) => locationUnits(id, cycle));
  const rows = WITHDRAWAL_REASONS.map((reason) => ({ reason, newAdmission: 0, existing: 0 }));
  const rowOf = (i: number) => rows.find((x) => x.reason === HIST_REASONS[i]) ?? rows[i];
  for (const u of units) {
    const r = rng(u.locationId + (unitSeedOf(u.locationId, u.unit) ?? u.unit) + "w" + cycle);
    for (let i = 0; i < u.withdrawnNew; i++) rowOf(pickWeighted(r, REASON_MIX.newAdmission)).newAdmission++;
    for (let i = 0; i < u.withdrawnExisting; i++) rowOf(pickWeighted(r, REASON_MIX.existing)).existing++;
  }
  return rows;
}

/** Academic year to date (session starts 1 April; data as of 17 Nov). */
export const ACADEMIC_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

/**
 * Mock monthly movement profiles (Apr → Nov), per vertical.
 * - Schools: most new students join the roster when the session starts in April; lateral entries trickle in.
 *   Existing students leave mostly at session start (Apr) and mid-year (Jul, after summer relocations);
 *   new admissions mostly withdraw in May–Jul once they get a seat elsewhere.
 * - Higher Ed: first-year students join Jul–Sep; withdrawals follow in Aug–Oct (refund window, other offers).
 */
const MOVEMENT_PROFILE: Record<Vertical, { enrol: number[]; wNew: number[]; wExisting: number[] }> = {
  Schools: {
    enrol: [0.58, 0.11, 0.07, 0.09, 0.06, 0.04, 0.03, 0.02],
    wNew: [0.08, 0.2, 0.22, 0.18, 0.12, 0.09, 0.06, 0.05],
    wExisting: [0.24, 0.12, 0.09, 0.17, 0.12, 0.1, 0.09, 0.07],
  },
  "Higher Ed": {
    enrol: [0.0, 0.0, 0.03, 0.28, 0.41, 0.2, 0.06, 0.02],
    wNew: [0.0, 0.0, 0.0, 0.1, 0.3, 0.32, 0.18, 0.1],
    wExisting: [0.14, 0.12, 0.12, 0.14, 0.14, 0.12, 0.12, 0.1],
  },
};

/** Splits an integer total across buckets by weight (largest remainder) so the parts sum exactly. */
function spread(total: number, weights: number[], r: () => number) {
  const w = weights.map((x) => x * (x ? between(r, 0.85, 1.15) : 0));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map((x) => (total * x) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

export interface MovementRow {
  month: string;
  opening: number;
  enrolments: number;
  withdrawnNew: number;
  withdrawnExisting: number;
  withdrawals: number;
  closing: number;
  closingLY: number;
  netChange: number;
}

/**
 * Monthly strength movement: opening + new enrolments − withdrawals = closing.
 * Month figures add up exactly to the FABS totals used elsewhere on the page.
 */
export function strengthMovement(locIds: string[], cycle: Cycle): MovementRow[] {
  const n = ACADEMIC_MONTHS.length;
  const enrol = Array(n).fill(0), wNew = Array(n).fill(0), wEx = Array(n).fill(0);
  const enrolLY = Array(n).fill(0), wLY = Array(n).fill(0);
  let opening = 0, openingLY = 0;
  for (const id of locIds) {
    const v = locationById(id).vertical;
    const p = MOVEMENT_PROFILE[v];
    const t = locationTotals(id, cycle);
    const r = rng("mv" + id + cycle);
    opening += t.continuing;
    spread(t.enrolled, p.enrol, r).forEach((x, i) => (enrol[i] += x));
    spread(t.withdrawnNew, p.wNew, r).forEach((x, i) => (wNew[i] += x));
    spread(t.withdrawnExisting, p.wExisting, r).forEach((x, i) => (wEx[i] += x));
    // Same period last year: slightly smaller opening roster, last cycle's enrolments.
    openingLY += Math.round(t.continuing * between(r, 0.95, 0.99));
    spread(t.enrolledLY, p.enrol, r).forEach((x, i) => (enrolLY[i] += x));
    spread(Math.round((t.withdrawnNew + t.withdrawnExisting) * between(r, 0.9, 1.25)), p.wExisting, r).forEach((x, i) => (wLY[i] += x));
  }
  let open = opening, openLY = openingLY;
  return ACADEMIC_MONTHS.map((month, i) => {
    const withdrawals = wNew[i] + wEx[i];
    const closing = open + enrol[i] - withdrawals;
    const closingLY = openLY + enrolLY[i] - wLY[i];
    const row = { month, opening: open, enrolments: enrol[i], withdrawnNew: wNew[i], withdrawnExisting: wEx[i], withdrawals, closing, closingLY, netChange: closing - open };
    open = closing;
    openLY = closingLY;
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* People / record samples                                             */
/* ------------------------------------------------------------------ */
const FIRST = ["Aarav", "Vihaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Shaurya", "Atharv", "Ananya", "Diya", "Aadhya", "Saanvi", "Myra", "Pari", "Anika", "Navya", "Kiara", "Ira", "Riya", "Kabir", "Advik", "Meher", "Tara", "Vivaan", "Rudra", "Siya", "Avni", "Dhruv"];
const LAST = ["Sharma", "Verma", "Gupta", "Mehta", "Kapoor", "Malhotra", "Singh", "Arora", "Bansal", "Chopra", "Jain", "Khanna", "Nair", "Iyer", "Reddy", "Bhatia", "Sethi", "Agarwal", "Saxena", "Joshi"];
const PARENT = ["Rajesh", "Sunita", "Anil", "Kavya", "Manoj", "Rekha", "Suresh", "Neelam", "Vikram", "Preeti", "Ashok", "Shweta"];

export function person(r: () => number) {
  const last = pick(r, LAST);
  const y = 2026 - Math.floor(between(r, 3, 17));
  const dob = `${String(Math.floor(between(r, 1, 28))).padStart(2, "0")}-${String(Math.floor(between(r, 1, 12))).padStart(2, "0")}-${y}`;
  return {
    child: `${pick(r, FIRST)} ${last}`,
    parent: `${pick(r, PARENT)} ${last}`,
    mobile: `9${Math.floor(between(r, 100000000, 999999999))}`,
    dob,
  };
}

export const CRM_STATUSES = [
  "New Enquiry", "Attempt 1", "Attempt 2", "Attempt 3", "Attempt 4", "Attempt 5", "Interested", "Campus Visit Scheduled",
  "Campus Visit Done", "Counselling Done", "Registration Done", "Application Fee Paid", "Offer Letter", "Orientation",
  "Admission", "Cold Lead", "Not Interested", "Seat Not Available", "Junk", "Duplicate", "Entrance Test Scheduled", "Waitlisted",
];

export const FUNNEL_STAGES = [
  "Enquiry", "Contacted / In follow-up", "Registered", "Offer Issued", "Admission Confirmed", "Lost",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number] | "Unmapped";

export interface StatusMapping {
  status: string;
  schools: FunnelStage;
  higherEd: FunnelStage;
  leads: number;
  firstSeen: string;
  approvedBy?: string;
  pendingApproval?: boolean;
}

const UNMAPPED_LEADS: Record<string, number> = { "Entrance Test Scheduled": 128, Waitlisted: 41 };

export const SEED_STATUS_MAPPINGS: StatusMapping[] = (() => {
  const m: Record<string, [FunnelStage, FunnelStage]> = {
    "New Enquiry": ["Enquiry", "Enquiry"],
    "Attempt 1": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Attempt 2": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Attempt 3": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Attempt 4": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Attempt 5": ["Contacted / In follow-up", "Contacted / In follow-up"],
    Interested: ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Campus Visit Scheduled": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Campus Visit Done": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Counselling Done": ["Contacted / In follow-up", "Contacted / In follow-up"],
    "Registration Done": ["Registered", "Registered"],
    "Application Fee Paid": ["Registered", "Registered"],
    "Offer Letter": ["Offer Issued", "Offer Issued"],
    Orientation: ["Admission Confirmed", "Admission Confirmed"],
    Admission: ["Admission Confirmed", "Admission Confirmed"],
    "Cold Lead": ["Lost", "Lost"],
    "Not Interested": ["Lost", "Lost"],
    "Seat Not Available": ["Lost", "Offer Issued"],
    Junk: ["Lost", "Lost"],
    Duplicate: ["Lost", "Lost"],
    "Entrance Test Scheduled": ["Unmapped", "Unmapped"],
    Waitlisted: ["Unmapped", "Unmapped"],
  };
  const r = rng("statuses");
  return CRM_STATUSES.map((s) => ({
    status: s,
    schools: m[s][0],
    higherEd: m[s][1],
    // Unmapped counts are fixed so they agree with the "new CRM status" alerts (128 and 41 leads).
    leads: UNMAPPED_LEADS[s] ?? Math.round(between(r, 20, 2400)),
    firstSeen: m[s][0] === "Unmapped" ? (s === "Waitlisted" ? "16 Nov 2026, 18:15" : "17 Nov 2026, 09:45") : "01 Apr 2025",
    approvedBy: m[s][0] === "Unmapped" ? undefined : "Head of Admissions – Schools",
  }));
})();

/** Live status mapping — kept in step with the Masters. */
export const STATUS_MAPPINGS: StatusMapping[] = SEED_STATUS_MAPPINGS.map((m) => ({ ...m }));

/**
 * Leads per LeadSquared status for a set of schools — one source for System Views and Masters.
 * Mapped statuses are scaled so they add up to the schools' lead total; unmapped statuses are scaled
 * by the schools' share of group leads, so the whole group shows the same 128 / 41 as the alerts.
 */
export function statusLeadCounts(locIds: string[], cycle: Cycle, higherEdOnly = false): Record<string, number> {
  const stageOf = (m: StatusMapping) => (higherEdOnly ? m.higherEd : m.schools);
  const totalLeads = totalsFor(locIds, cycle).leads;
  const groupLeads = totalsFor(LOCATIONS.map((l) => l.id), cycle).leads || 1;
  const unmapped = STATUS_MAPPINGS.filter((m) => stageOf(m) === "Unmapped");
  const mapped = STATUS_MAPPINGS.filter((m) => stageOf(m) !== "Unmapped");
  const out: Record<string, number> = {};
  let unmappedTotal = 0;
  for (const m of unmapped) {
    out[m.status] = Math.round(m.leads * (totalLeads / groupLeads));
    unmappedTotal += out[m.status];
  }
  const rawMapped = mapped.reduce((s, m) => s + m.leads, 0) || 1;
  for (const m of mapped) out[m.status] = Math.round((m.leads * (totalLeads - unmappedTotal)) / rawMapped);
  return out;
}

/* ---------------- Mapping queue ---------------- */
export type MatchField = "mobile" | "child" | "dob" | "location" | "grade";
export interface FabsAdmission {
  admNo: string;
  child: string;
  parent: string;
  mobile: string;
  dob: string;
  unit: string;
  feePaidOn: string;
  hoursSinceEntry: number;
}
export interface CrmLead {
  leadId: string;
  saasFormId?: string;
  child: string;
  parent: string;
  mobile: string;
  dob: string;
  unit: string;
  status: string;
  counsellor: string;
  source: string;
  createdOn: string;
}
export interface MappingItem {
  id: string;
  locationId: string;
  fabs: FabsAdmission;
  candidate?: CrmLead;
  score?: number;
  matched?: MatchField[];
  state: "suggested" | "unmatched" | "linked" | "direct" | "rejected";
  method?: "auto" | "confirmed" | "manual" | "direct";
  linkedBy?: string;
  linkedAt?: string;
}

function dateAgo(days: number, base = new Date("2026-11-17T10:30:00+05:30")) {
  const d = new Date(base.getTime() - days * 86400000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function mutate(r: () => number, p: ReturnType<typeof person>, field: MatchField) {
  if (field === "mobile") return { ...p, mobile: p.mobile.slice(0, 6) + Math.floor(between(r, 1000, 9999)) };
  if (field === "child") return { ...p, child: p.child.replace(/a/, "aa").replace(/i$/, "ee") };
  if (field === "dob") return { ...p, dob: p.dob.replace(/^\d\d/, String(Math.floor(between(r, 1, 28))).padStart(2, "0")) };
  return p;
}

export function mappingQueue(locId: string): MappingItem[] {
  if (!hasHistory(locId)) return [];
  const loc = locationById(locId);
  const r = rng("map" + locId);
  const items: MappingItem[] = [];
  let n = 0;
  const mkFabs = (p: ReturnType<typeof person>, hours: number): FabsAdmission => ({
    admNo: `${loc.codes.fabs}/26/${String(1400 + n).padStart(5, "0")}`,
    ...p,
    unit: pick(r, loc.units.slice(0, Math.min(loc.units.length, loc.vertical === "Schools" ? 3 : 6))),
    feePaidOn: dateAgo(hours / 24),
    hoursSinceEntry: hours,
  });
  const mkLead = (p: ReturnType<typeof person>, unit: string, status = "Admission"): CrmLead => ({
    leadId: `L-${Math.floor(between(r, 200000, 299999))}`,
    saasFormId: r() > 0.4 ? `SF-${Math.floor(between(r, 10000, 99999))}` : undefined,
    ...p,
    unit,
    status,
    counsellor: pick(r, loc.counsellors),
    source: pick(r, HIST_SOURCES),
    createdOn: dateAgo(between(r, 20, 140)),
  });
  // suggested
  for (let i = 0; i < 7; i++, n++) {
    const p = person(r);
    const hours = Math.round(between(r, 2, 80));
    const fabs = mkFabs(p, hours);
    const miss: MatchField = pick(r, ["mobile", "child", "dob"] as MatchField[]);
    const lead = mkLead(mutate(r, p, miss), fabs.unit, pick(r, ["Admission", "Orientation", "Offer Letter"]));
    const matched = (["mobile", "child", "dob", "location", "grade"] as MatchField[]).filter((f) => f !== miss);
    items.push({ id: `m${locId}${n}`, locationId: locId, fabs, candidate: lead, matched, score: Math.round(between(r, 72, 92)), state: "suggested" });
  }
  // unmatched
  for (let i = 0; i < 5; i++, n++) {
    const p = person(r);
    items.push({ id: `m${locId}${n}`, locationId: locId, fabs: mkFabs(p, Math.round(between(r, 6, 110))), state: "unmatched" });
  }
  // linked
  for (let i = 0; i < 18; i++, n++) {
    const p = person(r);
    const fabs = mkFabs(p, Math.round(between(r, 50, 900)));
    const method = i < 12 ? "auto" : i < 16 ? "confirmed" : "manual";
    items.push({
      id: `m${locId}${n}`, locationId: locId, fabs,
      candidate: mkLead(p, fabs.unit),
      matched: ["mobile", "child", "dob", "location", "grade"],
      score: method === "auto" ? 100 : Math.round(between(r, 70, 90)),
      state: "linked", method,
      linkedBy: method === "auto" ? "Matching engine" : pick(r, loc.counsellors),
      linkedAt: dateAgo(fabs.hoursSinceEntry / 24 - 0.5),
    });
  }
  return items;
}

/**
 * Mock "near misses" for an unmatched FABS admission — the reasons auto-matching failed in real life:
 * the lead was captured under a short / alternate first name with the other parent's mobile,
 * or the family enquired for a sibling first.
 */
export function crmCandidatesFor(locId: string, fabs: FabsAdmission): CrmLead[] {
  const loc = locationById(locId);
  const r = rng("cand" + fabs.admNo);
  const [first, ...rest] = fabs.child.split(" ");
  const surname = rest.join(" ");
  const base = { counsellor: pick(r, loc.counsellors), source: pick(r, HIST_SOURCES) };
  return [
    {
      ...base,
      leadId: `L-${Math.floor(between(r, 200000, 299999))}`,
      saasFormId: `SF-${Math.floor(between(r, 10000, 99999))}`,
      child: `${first.slice(0, Math.max(3, first.length - 2))} ${surname}`,
      parent: fabs.parent,
      mobile: `9${Math.floor(between(r, 100000000, 999999999))}`,
      dob: fabs.dob,
      unit: fabs.unit,
      status: "Admission",
      createdOn: dateAgo(between(r, 20, 90)),
    },
    {
      ...base,
      leadId: `L-${Math.floor(between(r, 200000, 299999))}`,
      child: `${pick(r, FIRST)} ${surname}`,
      parent: fabs.parent,
      mobile: fabs.mobile,
      dob: fabs.dob.replace(/\d{4}$/, (y) => String(Number(y) + 3)),
      unit: pick(r, loc.units),
      status: "Offer Letter",
      createdOn: dateAgo(between(r, 30, 160)),
    },
  ];
}

/** CRM leads a counsellor can search when linking manually. */
export function crmSearchPool(locId: string): CrmLead[] {
  if (!hasHistory(locId)) return [];
  const loc = locationById(locId);
  const r = rng("pool" + locId);
  return Array.from({ length: 40 }, () => {
    const p = person(r);
    return {
      leadId: `L-${Math.floor(between(r, 200000, 299999))}`,
      saasFormId: r() > 0.5 ? `SF-${Math.floor(between(r, 10000, 99999))}` : undefined,
      ...p,
      unit: pick(r, loc.units),
      status: pick(r, ["Admission", "Orientation", "Offer Letter", "Registration Done", "Attempt 3"]),
      counsellor: pick(r, loc.counsellors),
      source: pick(r, HIST_SOURCES),
      createdOn: dateAgo(between(r, 10, 200)),
    };
  });
}

/* ---------------- Raw system samples ---------------- */
export function saasSample(allIds: string[]) {
  const locIds = allIds.filter((id) => hasHistory(id) && locationById(id).units.length);
  if (!locIds.length) return [];
  const r = rng("saas" + locIds.join());
  return Array.from({ length: 12 }, (_, i) => {
    const loc = locationById(pick(r, locIds));
    const p = person(r);
    return {
      formId: `SF-${Math.floor(between(r, 10000, 99999))}`, child: p.child, parent: p.parent, mobile: p.mobile,
      location: loc.codes.saas, unit: pick(r, loc.units), submitted: dateAgo(i * 0.3 + r()),
      syncedToCrm: r() > 0.08,
    };
  });
}
export function crmSample(allIds: string[]) {
  const locIds = allIds.filter((id) => hasHistory(id) && locationById(id).units.length);
  if (!locIds.length) return [];
  const r = rng("crm" + locIds.join());
  return Array.from({ length: 12 }, (_, i) => {
    const loc = locationById(pick(r, locIds));
    const p = person(r);
    return {
      leadId: `L-${Math.floor(between(r, 200000, 299999))}`, child: p.child, mobile: p.mobile, location: loc.codes.crm,
      unit: pick(r, loc.units), source: pick(r, HIST_SOURCES), status: pick(r, CRM_STATUSES.slice(0, 20)),
      owner: pick(r, loc.counsellors), modified: dateAgo(i * 0.2 + r() * 0.2),
      saasFormId: r() > 0.6 ? `SF-${Math.floor(between(r, 10000, 99999))}` : "—",
    };
  });
}
export function fabsSample(allIds: string[]) {
  const locIds = allIds.filter((id) => hasHistory(id) && locationById(id).units.length);
  if (!locIds.length) return [];
  const r = rng("fabs" + locIds.join());
  return Array.from({ length: 12 }, (_, i) => {
    const loc = locationById(pick(r, locIds));
    const p = person(r);
    const wd = r() > 0.82;
    return {
      admNo: `${loc.codes.fabs}/26/${String(Math.floor(between(r, 100, 1600))).padStart(5, "0")}`, child: p.child,
      location: loc.codes.fabs, unit: pick(r, loc.units), academicYear: "2026-27", feePaid: dateAgo(i * 0.5 + r()),
      status: wd ? "Withdrawn" : "Active", reason: wd ? pick(r, HIST_REASONS) : "—",
    };
  });
}

export function withdrawalRecords(allIds: string[]) {
  const locIds = allIds.filter((id) => hasHistory(id) && locationById(id).units.length);
  if (!locIds.length) return [];
  const r = rng("wdr" + locIds.join());
  return Array.from({ length: 14 }, (_, i) => {
    const loc = locationById(pick(r, locIds));
    const p = person(r);
    const unit = pick(r, loc.units);
    // Only students admitted this cycle can be "new admission"; entry grades and first-year programmes have no existing students.
    const entryUnit = loc.vertical === "Higher Ed" || unit === "Nursery";
    const isNew = entryUnit || r() > 0.6;
    const joined = isNew ? 26 : Math.max(18, 26 - Math.max(1, loc.units.indexOf(unit)));
    const reason = HIST_REASONS[pickWeighted(r, isNew ? REASON_MIX.newAdmission : REASON_MIX.existing)];
    return {
      admNo: `${loc.codes.fabs}/${joined}/${String(Math.floor(between(r, 100, 1600))).padStart(5, "0")}`,
      child: p.child, location: loc.short, unit, date: dateAgo(i * 4 + r() * 3),
      reason, type: isNew ? "New admission" : "Existing student",
    };
  });
}

/* ---------------- Sync, alerts, users, audit ---------------- */
export const SYNC_STATUS = [
  { system: "SaaS", lastSync: "18 Nov 2026, 10:24", minutesAgo: 6, status: "ok" as const, records: 18452, nextRun: "10:39", note: "Incremental · modified-since" },
  { system: "LeadSquared", lastSync: "18 Nov 2026, 10:21", minutesAgo: 9, status: "ok" as const, records: 64210, nextRun: "10:36", note: "Incremental + webhooks" },
  { system: "FABS", lastSync: "18 Nov 2026, 09:51", minutesAgo: 39, status: "warning" as const, records: 22987, nextRun: "Retrying 10:36", note: "2 consecutive runs failed (HTTP 504)" },
];

export const SYNC_RUNS = [
  { at: "18 Nov, 10:24", system: "SaaS", type: "Incremental", records: 38, duration: "4s", result: "Success" },
  { at: "18 Nov, 10:21", system: "LeadSquared", type: "Incremental", records: 212, duration: "11s", result: "Success" },
  { at: "18 Nov, 10:21", system: "FABS", type: "Incremental", records: 0, duration: "60s", result: "Failed – HTTP 504 Gateway Timeout" },
  { at: "18 Nov, 10:06", system: "FABS", type: "Incremental", records: 0, duration: "60s", result: "Failed – HTTP 504 Gateway Timeout" },
  { at: "18 Nov, 10:09", system: "SaaS", type: "Incremental", records: 41, duration: "5s", result: "Success" },
  { at: "18 Nov, 10:06", system: "LeadSquared", type: "Incremental", records: 187, duration: "9s", result: "Success" },
  { at: "18 Nov, 09:51", system: "FABS", type: "Incremental", records: 64, duration: "14s", result: "Success" },
  { at: "18 Nov, 02:00", system: "All", type: "Nightly reconciliation", records: 105649, duration: "22m 14s", result: "Success – 31 back-dated edits, 4 deletions" },
];

export type AlertSeverity = "high" | "medium" | "low";
export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  detail: string;
  locationId?: string;
  raised: string;
  audience: string;
}
export function buildAlerts(cycle: Cycle): Alert[] {
  const out: Alert[] = [
    { id: "a1", severity: "high", type: "Sync failure", title: "FABS sync failing", detail: "2 consecutive incremental runs failed (HTTP 504). Enrolment and withdrawal figures may be up to 39 minutes old.", raised: "17 Nov, 10:21", audience: "System Admin, Central Admin" },
    { id: "a2", severity: "medium", type: "Unmapped LeadSquared status", title: "New LeadSquared status: “Entrance Test Scheduled”", detail: "128 leads carry a status not in the Status Mapping master. They appear in the Unmapped bucket until mapped.", raised: "17 Nov, 09:45", audience: "Central Admin" },
    { id: "a3", severity: "medium", type: "Unmapped LeadSquared status", title: "New LeadSquared status: “Waitlisted”", detail: "41 leads carry a status not in the Status Mapping master.", raised: "16 Nov, 18:15", audience: "Central Admin" },
  ];
  for (const loc of LOCATIONS) {
    const units = locationUnits(loc.id, cycle);
    const k = kpis(sumStats(units));
    if (k.seats > 0 && k.seatFill < 70)
      out.push({ id: "sf" + loc.id, severity: "high", type: "Seat fill below trajectory", title: `${loc.short}: seat fill ${k.seatFill.toFixed(0)}% vs 82% trajectory`, detail: `Seat fill is more than 10 pp below the target trajectory for this point in the cycle.`, locationId: loc.id, raised: "17 Nov, 06:00", audience: "Location Head, Principal, Vertical Head" });
    const close = units.filter((u) => u.seats >= 10 && u.seats - (u.enrolled - u.withdrawnNew) <= u.seats * 0.1 && u.seats - (u.enrolled - u.withdrawnNew) > 0);
    for (const u of close.slice(0, 1))
      out.push({ id: "co" + loc.id + u.unit, severity: "low", type: "Grade close-out", title: `${loc.short} · ${u.unit}: ${u.seats - (u.enrolled - u.withdrawnNew)} seats left`, detail: `Fewer than 10% of seats for new admission remain.`, locationId: loc.id, raised: "17 Nov, 06:00", audience: "Location Head, Principal" });
    const unm = mappingQueue(loc.id).filter((m) => (m.state === "suggested" || m.state === "unmatched") && m.fabs.hoursSinceEntry > 48).length;
    if (unm)
      out.push({ id: "um" + loc.id, severity: "medium", type: "Unmapped > 48h", title: `${loc.short}: ${unm} FABS admissions unmapped for over 48 hours`, detail: "Link them to LeadSquared leads or mark as Direct admission in the Mapping Queue.", locationId: loc.id, raised: "17 Nov, 10:00", audience: "Counsellors, Location Head" });
  }
  out.push({ id: "src1", severity: "medium", type: "Source conversion drop", title: "Meta Ads conversion down 27% vs last month (Group)", detail: "Lead-to-admission conversion for Meta Ads fell from 2.6% to 1.9%.", raised: "17 Nov, 06:00", audience: "Vertical Heads, Group Leadership" });
  return out;
}

export const USERS = [
  { name: "Neha Arora", email: "neha.arora@…", role: "counsellor", scope: "Saket", lastActive: "Today, 10:12" },
  { name: "Rohit Khanna", email: "rohit.khanna@…", role: "counsellor", scope: "Saket", lastActive: "Today, 09:40" },
  { name: "Sunil Mathur", email: "sunil.mathur@…", role: "locHead", scope: "Saket", lastActive: "Today, 10:02" },
  { name: "Dr. Rashmi Kaul", email: "rashmi.kaul@…", role: "principal", scope: "Saket", lastActive: "Yesterday" },
  { name: "Anita Desai", email: "anita.desai@…", role: "verticalHead", scope: "Schools (all)", lastActive: "Today, 08:55" },
  { name: "Prof. Rakesh Bhalla", email: "rakesh.bhalla@…", role: "verticalHead", scope: "Higher Ed (all)", lastActive: "14 Nov" },
  { name: "Group Leadership", email: "leadership@…", role: "leadership", scope: "All", lastActive: "Today, 09:00" },
  { name: "Central Admin Desk", email: "admissions.support@…", role: "centralAdmin", scope: "All", lastActive: "Today, 10:20" },
  { name: "IT – Platform", email: "it.platform@…", role: "sysAdmin", scope: "System", lastActive: "Today, 10:22" },
];

export const AUDIT_LOG = [
  { at: "18 Nov, 10:14", who: "Neha Arora", role: "Counsellor", location: "Saket", action: "Mapping confirmed", target: "F001/26/01412 ↔ L-245117", change: "Suggested → Linked (confirmed)" },
  { at: "18 Nov, 10:02", who: "Sunil Mathur", role: "Location Admissions Head", location: "Saket", action: "Mapping overridden", target: "F001/26/01388", change: "L-231004 → L-231877" },
  { at: "18 Nov, 09:50", who: "Central Admin Desk", role: "Central Admin", location: "—", action: "Status mapping proposed", target: "“Entrance Test Scheduled”", change: "Unmapped → Registered (pending approval)" },
  { at: "16 Nov, 17:31", who: "Rohit Khanna", role: "Counsellor", location: "Saket", action: "Direct admission marked", target: "F001/26/01379", change: "Unmatched → Direct admission – no CRM lead" },
  { at: "16 Nov, 15:05", who: "Anita Desai", role: "Vertical Admissions Head", location: "Pitampura", action: "Seat Matrix change approved", target: "Grade XI seats", change: "60 → 72" },
  { at: "16 Nov, 11:40", who: "Anita Desai", role: "Vertical Admissions Head", location: "Noida", action: "Target updated", target: "Nursery target", change: "110 → 118" },
  { at: "15 Nov, 16:22", who: "IT – Platform", role: "System Admin", location: "—", action: "User created", target: "Kavita Iyer", change: "— → Counsellor (Sheikh Sarai)" },
  { at: "15 Nov, 12:10", who: "Central Admin Desk", role: "Central Admin", location: "Nerul", action: "Location code mapped", target: "FABS code", change: "— → F006" },
];

export const SNAPSHOTS = [
  { id: "s1", label: "Week 47 · Mon 16 Nov 2026", frozen: "16 Nov 2026, 09:00 IST", kind: "Weekly" },
  { id: "s2", label: "Week 46 · Mon 09 Nov 2026", frozen: "09 Nov 2026, 09:00 IST", kind: "Weekly" },
  { id: "s3", label: "Week 45 · Mon 02 Nov 2026", frozen: "02 Nov 2026, 09:00 IST", kind: "Weekly" },
  { id: "m1", label: "October 2026", frozen: "02 Nov 2026, 09:00 IST", kind: "Monthly" },
  { id: "s4", label: "Week 44 · Mon 26 Oct 2026", frozen: "26 Oct 2026, 09:00 IST", kind: "Weekly" },
  { id: "s5", label: "Week 43 · Mon 19 Oct 2026", frozen: "19 Oct 2026, 09:00 IST", kind: "Weekly" },
  { id: "m2", label: "September 2026", frozen: "05 Oct 2026, 09:00 IST", kind: "Monthly" },
];
export type Snapshot = (typeof SNAPSHOTS)[number];
/** When the next weekly snapshot is frozen. */
export const NEXT_SNAPSHOT = "Monday 23 Nov 2026, 9:00 am IST";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Weeks between a snapshot's freeze date and the latest snapshot. */
function weeksBack(snap: Snapshot) {
  const at = (s: Snapshot) => {
    const [d, m, y] = s.frozen.split(",")[0].split(" ");
    return Date.UTC(Number(y), MON.indexOf(m), Number(d));
  };
  return (at(SNAPSHOTS[0]) - at(snap)) / (7 * 86_400_000);
}

/** Mock frozen values: each older snapshot holds a slightly smaller cumulative position (by freeze date). */
export function snapshotFactor(snap: Snapshot) {
  return 1 - weeksBack(snap) * 0.025 - rng(snap.id)() * 0.01;
}

export const REPORTS = [
  { name: "Admissions MIS", desc: "Leads → enrolled by location and grade/programme", status: "ok" },
  { name: "Grade-wise Vacancy", desc: "Seats for new admission, net admissions, vacancies", status: "ok" },
  { name: "Grade-wise Admissions (target vs actual)", desc: "FABS-enrolled vs dashboard targets", status: "ok" },
  { name: "Funnel & Conversion", desc: "Stage counts, drop-off %, Pending Fee, Unmapped", status: "ok" },
  { name: "Withdrawals", desc: "By reason, grade, new vs existing", status: "ok" },
  { name: "Current Strength & Movement", desc: "Opening + enrolments − withdrawals = closing", status: "ok" },
  { name: "Counsellor Productivity", desc: "Leads owned, conversions (follow-up metrics pending CRM API)", status: "partial" },
  { name: "EWS/DG Compliance", desc: "Reserved vs filled — depends on FABS category field", status: "partial" },
  { name: "Admission Mapping Audit", desc: "Every link with who, when and method", status: "ok" },
  { name: "Budget & Outreach", desc: "Phase 2", status: "phase2" },
  { name: "Social Media", desc: "Phase 2", status: "phase2" },
  { name: "Partners", desc: "Phase 2", status: "phase2" },
];

export interface CycleDef {
  vertical: "Schools" | "Higher Ed";
  cycle: string;
  opens: string;
  seatLock: string;
  closes: string;
  fabsYear: string;
  /** Not yet published — hidden from session pickers until approved. */
  draft: boolean;
  /** Historic cycle loaded from source systems after the fact. */
  backfilled?: boolean;
}

/** Admission cycles. Each one's phase comes from its dates (see `cyclePhase`), so it stays in step with today. */
export const SEED_CYCLES: CycleDef[] = [
  { vertical: "Schools", cycle: "2027-28", opens: "01 Oct 2026", seatLock: "15 Dec 2026", closes: "30 Sep 2027", fabsYear: "2027-28", draft: false },
  { vertical: "Higher Ed", cycle: "2027-28", opens: "01 Dec 2026", seatLock: "15 Jan 2027", closes: "31 Oct 2027", fabsYear: "2027-28", draft: false },
  { vertical: "Schools", cycle: "2026-27", opens: "01 Oct 2025", seatLock: "15 Nov 2025", closes: "30 Sep 2026", fabsYear: "2026-27", draft: false },
  { vertical: "Higher Ed", cycle: "2026-27", opens: "01 Dec 2025", seatLock: "15 Jan 2026", closes: "31 Oct 2026", fabsYear: "2026-27", draft: false },
  { vertical: "Schools", cycle: "2025-26", opens: "01 Oct 2024", seatLock: "15 Nov 2024", closes: "30 Sep 2025", fabsYear: "2025-26", draft: false, backfilled: true },
  { vertical: "Higher Ed", cycle: "2025-26", opens: "01 Dec 2024", seatLock: "15 Jan 2025", closes: "31 Oct 2025", fabsYear: "2025-26", draft: false, backfilled: true },
];

/** Live cycle calendar — kept in step with the Masters. */
export const CYCLE_CALENDAR: CycleDef[] = SEED_CYCLES.map((c) => ({ ...c }));

/** The demo's "today" — data is as of this date. */
export const DATA_TODAY = new Date("2026-11-17");

export type CyclePhase = "Draft" | "Upcoming" | "Open · Seat Matrix setup" | "Open" | "Closed";
/**
 * Where a cycle stands on a given day:
 * before it opens → Upcoming; open until the Seat Matrix lock → Open · Seat Matrix setup;
 * lock to close → Open; after it closes → Closed. Unpublished cycles stay Draft.
 */
export function cyclePhase(c: Pick<CycleDef, "opens" | "seatLock" | "closes" | "draft">, today: Date = DATA_TODAY): CyclePhase {
  if (c.draft) return "Draft";
  const t = +today;
  if (t < +new Date(c.opens)) return "Upcoming";
  if (t > +new Date(c.closes)) return "Closed";
  return t < +new Date(c.seatLock) ? "Open · Seat Matrix setup" : "Open";
}
export const isOpenPhase = (p: CyclePhase) => p === "Open" || p === "Open · Seat Matrix setup";

/* ------------------------------------------------------------------ */
/* Master data from the Masters page                                   */
/* ------------------------------------------------------------------ */

/** Ordered grade list across active schools (load order first, then grades added in Masters). */
export function schoolGrades(): string[] {
  const seen: string[] = [];
  for (const l of LOCATIONS) if (l.vertical === "Schools") for (const u of l.units) if (!seen.includes(u)) seen.push(u);
  const rank = (u: string) => {
    const i = SCHOOL_GRADES.indexOf(u);
    return i < 0 ? SCHOOL_GRADES.length : i;
  };
  return seen.sort((a, b) => rank(a) - rank(b));
}

/**
 * Points every list the dashboards read at the Masters data:
 * locations (active only), their grades / programmes, lead sources, withdrawal reasons, status mapping and cycles.
 * Lists are updated in place, so modules holding a reference see the change; callers bump a version to re-render.
 */
export function applyMasters(m: import("./masters").MasterStore) {
  // Locations and their units
  ALL_LOCATIONS.clear();
  const active: Location[] = [];
  m.locations.forEach((rec, k) => {
    const seed = SEED_LOCATIONS.find((l) => l.id === rec.id);
    const units = m.units.filter((u) => u.locId === rec.id && u.active);
    const unitSeed: Record<string, string | null> = {};
    for (const u of units) unitSeed[u.name] = seed && !u.custom && u.id.startsWith(rec.id + ":") ? u.id.slice(rec.id.length + 1) : null;
    const base = seed ?? mkLoc(rec.id, rec.name, rec.short, rec.vertical, rec.board, rec.city, [], SEED_LOCATIONS.length + k);
    const loc: Location = {
      ...base, name: rec.name, short: rec.short, vertical: rec.vertical, board: rec.board, city: rec.city,
      codes: { ...rec.codes }, units: units.map((u) => u.name), unitSeed, isNew: !seed,
    };
    ALL_LOCATIONS.set(loc.id, loc);
    if (rec.active) active.push(loc);
  });
  LOCATIONS.splice(0, LOCATIONS.length, ...active);

  // Lead sources: loaded ones keep their lead share (even when inactive); new ones start at zero.
  const loadedSrc = m.sources.filter((x) => !x.custom);
  const histSrc = loadedSrc.length === SEED_SOURCES.length ? loadedSrc.map((x) => x.name) : [...SEED_SOURCES];
  HIST_SOURCES.splice(0, HIST_SOURCES.length, ...histSrc);
  sourceIndex = new Map(histSrc.map((x, i) => [x, i]));
  SOURCES.splice(0, SOURCES.length, ...histSrc, ...m.sources.filter((x) => x.custom && x.active).map((x) => x.name));
  for (const key of Object.keys(SOURCE_GROUP_OF)) delete SOURCE_GROUP_OF[key];
  for (const x of m.sources) SOURCE_GROUP_OF[x.name] = x.group;
  for (const x of SOURCES) SOURCE_GROUP_OF[x] ??= SEED_SOURCE_GROUP_OF[x] ?? "Others";
  recomputeGroupShare();

  // Withdrawal reasons
  const loadedRsn = m.reasons.filter((x) => !x.custom);
  const histRsn = loadedRsn.length === SEED_REASONS.length ? loadedRsn.map((x) => x.name) : [...SEED_REASONS];
  HIST_REASONS.splice(0, HIST_REASONS.length, ...histRsn);
  WITHDRAWAL_REASONS.splice(0, WITHDRAWAL_REASONS.length, ...histRsn, ...m.reasons.filter((x) => x.custom && x.active).map((x) => x.name));

  // Status mapping and cycles
  STATUS_MAPPINGS.splice(0, STATUS_MAPPINGS.length, ...m.statuses.map(({ id: _i, active: _a, custom: _c, ...rest }) => rest));
  CYCLE_CALENDAR.splice(0, CYCLE_CALENDAR.length, ...m.cycles.map(({ id: _i, active: _a, custom: _c, ...rest }) => rest));
}
