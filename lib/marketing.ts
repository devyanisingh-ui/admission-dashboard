/**
 * Marketing data: budget & outreach, social media and partners.
 *
 * These figures are entered by hand in the dashboard (Data entry tabs) and saved in the
 * marketing store. Until a cycle is first edited, it shows starting data generated below.
 * Leads per outreach activity are entered with each spend entry; admissions per activity
 * (used only for the dashboard leaderboard's cost per admission) still come from FABS.
 */
import {
  CYCLE_MONTHS, SEED_LOCATIONS, locationTotals, rng, SOURCE_GROUP_OF, SOURCE_GROUP_SHARE, SOURCE_GROUPS, sourceBreakdown, totalsFor,
  type Cycle, type SourceGroup,
} from "./data";
import { splitExact } from "./dashboard";

const between = (r: () => number, min: number, max: number) => min + r() * (max - min);

/* ------------------------------------------------------------------ */
/* Reference lists                                                     */
/* ------------------------------------------------------------------ */

export const OUTREACH_ACTIVITIES: { type: string; group: SourceGroup; unit: string }[] = [
  { type: "Digital ads", group: "Digital", unit: "campaigns" },
  { type: "RWA activations", group: "RWA", unit: "activations" },
  { type: "Preschool tie-ups", group: "Preschool / Crèche", unit: "partner events" },
  { type: "Education fairs", group: "Education Fairs", unit: "fairs" },
  { type: "Corporate tie-ups", group: "Corporate", unit: "sessions" },
  { type: "Print, outdoor & events", group: "Others", unit: "placements" },
];
/** Share of each location's budget allocated to each activity (same order as OUTREACH_ACTIVITIES). */
const BUDGET_MIX = [0.3, 0.16, 0.14, 0.16, 0.08, 0.16];
/** How an annual allocation is planned across the cycle (Oct → Sep). */
export const PLAN_SHAPE = [0.1, 0.14, 0.15, 0.14, 0.12, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02];
const SOCIAL_SHAPE = [0.07, 0.11, 0.13, 0.14, 0.13, 0.11, 0.09, 0.07, 0.05, 0.04, 0.03, 0.03];
const PARTNER_SHAPE = [0.06, 0.12, 0.15, 0.16, 0.14, 0.11, 0.09, 0.07, 0.04, 0.03, 0.02, 0.01];

export const SOCIAL_PLATFORMS = ["Instagram", "Facebook", "YouTube", "LinkedIn", "Google Business"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
const PLATFORM_SHARE: Record<SocialPlatform, number> = { Instagram: 0.38, Facebook: 0.27, YouTube: 0.17, LinkedIn: 0.06, "Google Business": 0.12 };

export const PARTNER_TYPES = ["Preschool", "Crèche", "Corporate", "RWA"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Share of the "Digital ads" outreach spend that went to paid social campaigns in the starting data. */
const SOCIAL_SHARE_OF_DIGITAL = 0.45;

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export interface Stamp { updatedAt: string; updatedBy: string; /** ms since epoch of the last edit; 0 for starting data. */ ts?: number }
/** Annual budget for one outreach activity at one location. */
export interface BudgetRec extends Stamp { id: string; locationId: string; activity: string; allocated: number }
/** A spend entry: money spent, activities run and leads generated for one activity in one month. */
export interface SpendRec extends Stamp { id: string; locationId: string; activity: string; month: string; amount: number; count: number; leads: number; note: string }
/** Monthly figures for one social platform at one location (from the platform's insights export). */
export interface SocialRec extends Stamp {
  id: string; locationId: string; platform: SocialPlatform; month: string;
  reach: number; impressions: number; interactions: number; followers: number; prospects: number;
}
export interface CampaignRec extends Stamp {
  id: string; locationId: string; name: string; platform: SocialPlatform; month: string;
  spend: number; reach: number; clicks: number; leads: number;
}
export interface PartnerRec extends Stamp {
  id: string; locationId: string; name: string; type: PartnerType; since: string;
  leadsShared: number; admissions: number; active: boolean;
}
export interface CycleData { budgets: BudgetRec[]; spend: SpendRec[]; social: SocialRec[]; campaigns: CampaignRec[]; partners: PartnerRec[] }

export type EntryArea = "Budget" | "Spend" | "Social media" | "Campaign" | "Partner" | "Target";
export interface EntryLog { id: string; at: string; who: string; area: EntryArea; action: "Created" | "Updated" | "Deleted"; record: string; change: string }

export interface MarketingStore {
  /** Entered data per cycle; a cycle not yet edited shows its starting data. */
  cycles: Partial<Record<Cycle, CycleData>>;
  /** Admission targets, key "cycle|locId|unit". */
  targets: Record<string, number>;
  log: EntryLog[];
}

export const MARKETING_KEY = "marketing-data-v1";
export const EMPTY_MARKETING: MarketingStore = { cycles: {}, targets: {}, log: [] };

export function reviveMarketing(raw: unknown): MarketingStore | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<MarketingStore>;
  if (typeof r.cycles !== "object" || typeof r.targets !== "object" || !Array.isArray(r.log)) return null;
  const cycles = { ...(r.cycles ?? {}) } as Partial<Record<Cycle, CycleData>>;
  for (const c of Object.keys(cycles) as Cycle[]) {
    const d = cycles[c];
    if (!d || d.spend.every((x) => typeof x.leads === "number")) continue;
    const seeded = new Map(seedCycle(c).spend.map((x) => [x.id, x.leads]));
    cycles[c] = { ...d, spend: d.spend.map((x) => (typeof x.leads === "number" ? x : { ...x, leads: seeded.get(x.id) ?? 0 })) };
  }
  return { cycles, targets: r.targets ?? {}, log: r.log };
}

export const newEntryId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const targetKey = (cycle: Cycle, locId: string, unit: string) => `${cycle}|${locId}|${unit}`;

/** The store the report functions read; set by the app context whenever it changes. */
let current: MarketingStore = EMPTY_MARKETING;
export function setMarketingData(store: MarketingStore) {
  current = store;
}

/** Records for a cycle — entered data if the cycle has been edited, otherwise its starting data. */
export function cycleData(cycle: Cycle, store: MarketingStore = current): CycleData {
  return store.cycles[cycle] ?? seedCycle(cycle);
}

/** Whether a cycle still shows the starting data (nothing entered yet). */
export const isStartingData = (cycle: Cycle, store: MarketingStore = current) => !store.cycles[cycle];

/** Applies a change to one cycle's records and logs it (the starting data is copied in on the first edit). */
export function editCycle(store: MarketingStore, cycle: Cycle, f: (d: CycleData) => CycleData, log: EntryLog): MarketingStore {
  return { ...store, cycles: { ...store.cycles, [cycle]: f(cycleData(cycle, store)) }, log: [log, ...store.log].slice(0, 300) };
}

/* ------------------------------------------------------------------ */
/* Starting data                                                       */
/* ------------------------------------------------------------------ */

const SEED_STAMP: Stamp = { updatedAt: "Initial data", updatedBy: "Initial load" };
const seedCache = new Map<Cycle, CycleData>();

/** Invented partner names for the starting data. */
const PARTNER_NAMES: Record<PartnerType, string[]> = {
  Preschool: [
    "Little Sprouts Preschool", "Tiny Tots Play School", "Blue Bells Montessori", "Sunshine Kids Corner", "Bright Beginnings Preschool",
    "Tender Buds Play School", "First Steps Montessori", "Busy Bees Preschool", "Apple Tree Kindergarten", "Little Wonders Preschool",
    "Dream Castle Play School", "Happy Hearts Preschool", "Rainbow Valley Montessori", "Kidzone Garden School", "Twinkle Stars Preschool",
    "Bloom Buds Play School", "Learning Leaf Preschool", "Giggles Kindergarten", "Pebbles Play School", "Crayons Montessori",
    "Little Explorers Preschool", "Butterfly Garden Play School",
  ],
  Crèche: [
    "Rainbow Kids Crèche", "Happy Feet Day Care", "Cuddles Crèche", "Snuggle Nest Day Care", "Teddy Care Crèche", "Little Nest Day Care",
    "Hugs & Smiles Crèche", "Baby Steps Day Care", "Kangaroo Kids Crèche", "Cocoon Day Care", "Tiny Hands Crèche", "Mother Hen Day Care",
    "Peekaboo Crèche", "Sunbeam Day Care", "Nestling Crèche", "Toddler Town Day Care", "Lullaby Crèche", "Hopscotch Day Care",
    "Wee Care Crèche", "Puddle Ducks Day Care", "Honeycomb Crèche", "Bumble Day Care",
  ],
  Corporate: [
    "Tech Park Employee Network", "City Hospital Staff Welfare", "Metro Office Complex HR", "Riverside Bank Staff Club", "Skyline IT Campus HR",
    "Green Energy Ltd Employee Forum", "National Insurance Staff Association", "Airport Authority Staff Welfare", "Steel Works Officers Club",
    "Pharma Park Employee Network", "Defence Colony Officers Mess", "Railway Officers Association", "Telecom Tower Staff Forum",
    "Auto Hub Employee Welfare", "Textile Mills Staff Club", "Govt Secretariat Staff Welfare", "University Faculty Club", "Logistics Park HR Forum",
    "Media House Employee Network", "Retail Group Staff Welfare", "Cement Works Officers Club", "Power Grid Staff Association",
  ],
  RWA: [
    "Block J RWA", "Green Avenue RWA", "Lake View Residents Association", "Sector 21 RWA", "Rose Garden RWA", "Model Town RWA",
    "Civil Lines Residents Association", "Palm Grove RWA", "Sunrise Enclave RWA", "Shanti Nagar RWA", "Ashok Vihar RWA",
    "Defence Enclave RWA", "Silver Oak Residents Association", "Park View RWA", "Golf Links RWA", "Maple Heights RWA",
    "Garden Estate RWA", "Lotus Towers RWA", "Hill View Residents Association", "Royal Palms RWA", "Sector 45 RWA", "Orchid Greens RWA",
  ],
};

const CAMPAIGN_TEMPLATES: { name: string; platform: SocialPlatform; month: string; higherEd?: boolean; schools?: boolean }[] = [
  { name: "Nursery admissions open", platform: "Instagram", month: "Nov", schools: true },
  { name: "Campus walkthrough reels", platform: "Instagram", month: "Dec" },
  { name: "Open house invite", platform: "Facebook", month: "Dec" },
  { name: "Parent testimonials", platform: "YouTube", month: "Jan", schools: true },
  { name: "Board results showcase", platform: "Facebook", month: "May", schools: true },
  { name: "Scholarship test", platform: "Google Business", month: "Feb" },
  { name: "Early-bird fee offer", platform: "Facebook", month: "Jan" },
  { name: "Programme info sessions", platform: "LinkedIn", month: "Apr", higherEd: true },
  { name: "Alumni success stories", platform: "YouTube", month: "Mar", higherEd: true },
];

function seedCycle(cycle: Cycle): CycleData {
  const cached = seedCache.get(cycle);
  if (cached) return cached;
  const data: CycleData = { budgets: [], spend: [], social: [], campaigns: [], partners: [] };
  for (const loc of SEED_LOCATIONS) {
    if (loc.isNew) continue;
    const id = loc.id;

    // Budget allocation and monthly spend per activity.
    const r0 = rng("budget" + id + cycle);
    const annual = Math.round((loc.vertical === "Schools" ? between(r0, 18, 30) : between(r0, 45, 80)) * 100000);
    let digitalSpent = 0;
    const startLeads = groupOutcomes([id], cycle);
    OUTREACH_ACTIVITIES.forEach((a, i) => {
      const r = rng("act" + id + cycle + a.type);
      const allocated = Math.round(annual * BUDGET_MIX[i]);
      const spent = Math.round(allocated * between(r, 0.72, 1.08));
      const count = Math.round(between(r, 3, 14));
      if (a.type === "Digital ads") digitalSpent = spent;
      data.budgets.push({ id: `b-${cycle}-${id}-${i}`, locationId: id, activity: a.type, allocated, ...SEED_STAMP });
      const amounts = splitExact(spent, PLAN_SHAPE.map((s) => s * between(r, 0.8, 1.2)));
      const counts = splitExact(count, PLAN_SHAPE);
      const leads = splitExact(startLeads[a.group].leads, amounts.some(Boolean) ? amounts : PLAN_SHAPE);
      CYCLE_MONTHS.forEach((month, m) => {
        if (!amounts[m] && !counts[m] && !leads[m]) return;
        data.spend.push({ id: `s-${cycle}-${id}-${i}-${m}`, locationId: id, activity: a.type, month, amount: amounts[m], count: counts[m], leads: leads[m], note: "", ...SEED_STAMP });
      });
    });

    // Social media: monthly figures per platform.
    const digitalLeads = locationTotals(id, cycle).leads * SOURCE_GROUP_SHARE.Digital;
    const rm = rng("socm" + id + cycle);
    const monthW = SOCIAL_SHAPE.map((s) => s * between(rm, 0.85, 1.15));
    const platformTotals = {} as Record<SocialPlatform, { reach: number; prospects: number }>;
    for (const p of SOCIAL_PLATFORMS) {
      const r = rng("soc" + p + id + cycle);
      const reach = Math.round(between(r, 28000, 52000) * PLATFORM_SHARE[p] * 5);
      const impressions = Math.round(reach * between(r, 2.2, 3.4));
      const interactions = Math.round(impressions * between(r, 0.018, 0.045));
      const followers = Math.round(reach * between(r, 0.004, 0.012));
      const prospects = Math.round(digitalLeads * PLATFORM_SHARE[p] * 0.55);
      platformTotals[p] = { reach, prospects };
      const split = (n: number) => splitExact(n, monthW);
      const [re, im, it, fo, pr] = [split(reach), split(impressions), split(interactions), split(followers), split(prospects)];
      CYCLE_MONTHS.forEach((month, m) => {
        data.social.push({
          id: `m-${cycle}-${id}-${p}-${m}`, locationId: id, platform: p, month,
          reach: re[m], impressions: im[m], interactions: it[m], followers: fo[m], prospects: pr[m], ...SEED_STAMP,
        });
      });
    }

    // Paid campaigns: four per location, sharing the platform totals and a slice of the Digital ads spend.
    const rc = rng("camp" + id + cycle);
    const pool = CAMPAIGN_TEMPLATES.filter((c) => (loc.vertical === "Schools" ? !c.higherEd : !c.schools));
    const picked = [...pool].map((c) => ({ c, k: rc() })).sort((a, b) => a.k - b.k).slice(0, 4).map((x) => x.c);
    const weights = picked.map(() => 0.6 + rc());
    const spendSplit = splitExact(Math.round(digitalSpent * SOCIAL_SHARE_OF_DIGITAL), weights);
    picked.forEach((c, i) => {
      const same = picked.map((x, j) => (x.platform === c.platform ? weights[j] : 0));
      const share = weights[i] / same.reduce((a, b) => a + b, 0);
      const reach = Math.round(platformTotals[c.platform].reach * 0.55 * share);
      data.campaigns.push({
        id: `c-${cycle}-${id}-${i}`, locationId: id, name: c.name, platform: c.platform, month: c.month,
        spend: spendSplit[i], reach, clicks: Math.round(reach * (0.015 + rc() * 0.02)),
        leads: Math.round(platformTotals[c.platform].prospects * 0.7 * share), ...SEED_STAMP,
      });
    });

    // Partners.
    const rp = rng("partners" + id + cycle);
    const t = locationTotals(id, cycle);
    const types: PartnerType[] = loc.vertical === "Schools" ? ["Preschool", "Preschool", "Crèche", "RWA", "RWA", "Corporate"] : ["Corporate", "Corporate", "RWA"];
    // Each school gets its own slice of each name list (2 per type), so names never repeat across schools.
    const li = SEED_LOCATIONS.findIndex((l) => l.id === id);
    const seen: Record<PartnerType, number> = { Preschool: 0, Crèche: 0, Corporate: 0, RWA: 0 };
    types.forEach((type, i) => {
      const list = PARTNER_NAMES[type];
      const share = type === "RWA" ? SOURCE_GROUP_SHARE.RWA / 2 : type === "Corporate" ? SOURCE_GROUP_SHARE.Corporate : SOURCE_GROUP_SHARE["Preschool / Crèche"] / 3;
      const leadsShared = Math.round(t.leads * share * between(rp, 0.6, 1.2));
      data.partners.push({
        id: `p-${cycle}-${id}-${i}`, locationId: id, name: list[(li * 2 + seen[type]++) % list.length], type,
        leadsShared, admissions: Math.round(leadsShared * between(rp, 0.06, 0.22)),
        since: ["Apr 2024", "Jul 2024", "Jan 2025", "Jun 2025", "Oct 2025"][Math.floor(rp() * 5)],
        active: rp() > 0.12, ...SEED_STAMP,
      });
    });
  }
  seedCache.set(cycle, data);
  return data;
}

const inLocs = <T extends { locationId: string }>(rows: T[], locIds: string[]) => {
  const set = new Set(locIds);
  return rows.filter((r) => set.has(r.locationId));
};

/* ------------------------------------------------------------------ */
/* Budget & outreach                                                   */
/* ------------------------------------------------------------------ */

export interface OutreachRow {
  type: string; group: SourceGroup; unit: string;
  allocated: number; spent: number; activities: number; leads: number; admissions: number; cpl: number; cpa: number;
}

/**
 * Leads and matched admissions per source group — the same split the Dashboard's Source-wise widget uses,
 * so each outreach activity's outcomes match it exactly.
 */
function groupOutcomes(locIds: string[], cycle: Cycle) {
  const t = totalsFor(locIds, cycle);
  const bySource = sourceBreakdown(locIds, cycle);
  const w = SOURCE_GROUPS.map((g) => bySource.filter((s) => SOURCE_GROUP_OF[s.source] === g));
  const leads = splitExact(t.leads, w.map((rows) => rows.reduce((s, r) => s + r.leads, 0)));
  const adm = splitExact(t.enrolledMatched, w.map((rows) => rows.reduce((s, r) => s + r.enrolled, 0)));
  return Object.fromEntries(SOURCE_GROUPS.map((g, i) => [g, { leads: leads[i], admissions: adm[i] }])) as Record<SourceGroup, { leads: number; admissions: number }>;
}

/** Budget, spend, activities and leads (all entered) by activity type; admissions (FABS) only feed cost per admission. */
export function outreachByActivity(locIds: string[], cycle: Cycle): OutreachRow[] {
  const d = cycleData(cycle);
  const budgets = inLocs(d.budgets, locIds);
  const spend = inLocs(d.spend, locIds);
  const outcomes = groupOutcomes(locIds, cycle);
  return OUTREACH_ACTIVITIES.map((a) => {
    const allocated = budgets.filter((b) => b.activity === a.type).reduce((s, b) => s + b.allocated, 0);
    const mine = spend.filter((x) => x.activity === a.type);
    const spent = mine.reduce((s, x) => s + x.amount, 0);
    const activities = mine.reduce((s, x) => s + x.count, 0);
    const leads = mine.reduce((s, x) => s + (x.leads ?? 0), 0);
    const { admissions } = outcomes[a.group];
    return { ...a, allocated, spent, activities, leads, admissions, cpl: leads ? spent / leads : 0, cpa: admissions ? spent / admissions : 0 };
  });
}

export function outreachTotals(locIds: string[], cycle: Cycle) {
  const rows = outreachByActivity(locIds, cycle);
  const sum = (k: "allocated" | "spent" | "activities" | "leads" | "admissions") => rows.reduce((s, r) => s + r[k], 0);
  const spent = sum("spent"), leads = sum("leads"), admissions = sum("admissions");
  return { allocated: sum("allocated"), spent, activities: sum("activities"), leads, admissions, cpl: leads ? spent / leads : 0, cpa: admissions ? spent / admissions : 0 };
}

/** Monthly spend (entered) vs plan (annual allocation spread over the cycle) — Oct → Sep. */
export function outreachMonthly(locIds: string[], cycle: Cycle) {
  const d = cycleData(cycle);
  const allocated = inLocs(d.budgets, locIds).reduce((s, b) => s + b.allocated, 0);
  const spend = inLocs(d.spend, locIds);
  return CYCLE_MONTHS.map((month, i) => ({
    month,
    planned: Math.round(allocated * PLAN_SHAPE[i]),
    spent: spend.filter((x) => x.month === month).reduce((s, x) => s + x.amount, 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Social media                                                        */
/* ------------------------------------------------------------------ */

export function socialByPlatform(locIds: string[], cycle: Cycle) {
  const rows = inLocs(cycleData(cycle).social, locIds);
  return SOCIAL_PLATFORMS.map((p) => {
    const mine = rows.filter((r) => r.platform === p);
    const sum = (k: "reach" | "impressions" | "interactions" | "followers" | "prospects") => mine.reduce((s, r) => s + r[k], 0);
    const impressions = sum("impressions"), interactions = sum("interactions");
    return {
      platform: p, reach: sum("reach"), impressions, interactions,
      engagement: impressions ? (interactions / impressions) * 100 : 0, followers: sum("followers"), prospects: sum("prospects"),
    };
  });
}

export function socialMonthly(locIds: string[], cycle: Cycle) {
  const rows = inLocs(cycleData(cycle).social, locIds);
  return CYCLE_MONTHS.map((month) => {
    const mine = rows.filter((r) => r.month === month);
    return { month, reach: mine.reduce((s, r) => s + r.reach, 0), prospects: mine.reduce((s, r) => s + r.prospects, 0) };
  });
}

/** Paid campaigns with derived cost per prospect and click-through rate. */
export function socialCampaigns(locIds: string[], cycle: Cycle) {
  return inLocs(cycleData(cycle).campaigns, locIds).map((c) => ({
    ...c, cpl: c.leads ? c.spend / c.leads : 0, ctr: c.reach ? (c.clicks / c.reach) * 100 : 0,
  }));
}

/** Paid social spend for the selected schools — the sum of the entered campaigns. */
export function socialSpend(locIds: string[], cycle: Cycle) {
  return inLocs(cycleData(cycle).campaigns, locIds).reduce((s, c) => s + c.spend, 0);
}

/* ------------------------------------------------------------------ */
/* Partners                                                            */
/* ------------------------------------------------------------------ */

export interface Partner extends PartnerRec { conversion: number }

export function partnersFor(locIds: string[], cycle: Cycle): Partner[] {
  return inLocs(cycleData(cycle).partners, locIds).map((p) => ({ ...p, conversion: p.leadsShared ? (p.admissions / p.leadsShared) * 100 : 0 }));
}

/** Month-by-month leads shared and admissions for a set of partners (cycle Oct → Sep), spread from their cycle totals. */
export function partnerMonthly(partners: Partner[]) {
  return CYCLE_MONTHS.map((month, i) => {
    const row: { month: string; admissions: number } & Record<PartnerType, number> = {
      month, admissions: 0, Preschool: 0, Crèche: 0, Corporate: 0, RWA: 0,
    };
    for (const t of PARTNER_TYPES) row[t] = Math.round(partners.filter((p) => p.type === t).reduce((s, p) => s + p.leadsShared, 0) * PARTNER_SHAPE[i]);
    row.admissions = Math.round(partners.reduce((s, p) => s + p.admissions, 0) * PARTNER_SHAPE[Math.max(0, i - 1)]);
    return row;
  });
}

/** Cost per admission for a location (used in the leaderboard). */
export const costPerAdmission = (locId: string, cycle: Cycle) => outreachTotals([locId], cycle).cpa;
