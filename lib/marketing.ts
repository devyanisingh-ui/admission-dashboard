/**
 * Marketing mock data: budget & outreach, social media and partners.
 * Lead and admission figures are apportioned from the same LeadSquared / FABS totals
 * used everywhere else, so cost per lead / admission stays consistent across pages.
 */
import {
  CYCLE_MONTHS, SEED_LOCATIONS, locationById, locationTotals, rng, SOURCE_GROUP_OF, SOURCE_GROUP_SHARE, SOURCE_GROUPS, sourceBreakdown, totalsFor,
  type Cycle, type SourceGroup,
} from "./data";
import { splitExact } from "./dashboard";

const between = (r: () => number, min: number, max: number) => min + r() * (max - min);

/* ------------------------------------------------------------------ */
/* Budget & outreach                                                   */
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

/** Annual outreach budget for a location, in ₹. */
function budgetAllocation(locId: string, cycle: Cycle) {
  const loc = locationById(locId);
  const r = rng("budget" + locId + cycle);
  return Math.round((loc.vertical === "Schools" ? between(r, 18, 30) : between(r, 45, 80)) * 100000);
}

export interface OutreachRow {
  type: string; group: SourceGroup; unit: string;
  allocated: number; spent: number; activities: number; leads: number; admissions: number; cpl: number; cpa: number;
}

/** Budget, actual spend and outcomes by activity type for the selected locations. */
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

export function outreachByActivity(locIds: string[], cycle: Cycle): OutreachRow[] {
  const outcomes = groupOutcomes(locIds, cycle);
  return OUTREACH_ACTIVITIES.map((a, i) => {
    let allocated = 0, spent = 0, activities = 0;
    for (const id of locIds) {
      const r = rng("act" + id + cycle + a.type);
      const alloc = budgetAllocation(id, cycle) * BUDGET_MIX[i];
      allocated += alloc;
      spent += alloc * between(r, 0.72, 1.08);
      activities += Math.round(between(r, 3, 14));
    }
    const { leads, admissions } = outcomes[a.group];
    return {
      ...a, allocated: Math.round(allocated), spent: Math.round(spent), activities, leads, admissions,
      cpl: leads ? spent / leads : 0, cpa: admissions ? spent / admissions : 0,
    };
  });
}

export function outreachTotals(locIds: string[], cycle: Cycle) {
  const rows = outreachByActivity(locIds, cycle);
  const sum = (k: "allocated" | "spent" | "activities" | "leads" | "admissions") => rows.reduce((s, r) => s + r[k], 0);
  const spent = sum("spent"), leads = sum("leads"), admissions = sum("admissions");
  return { allocated: sum("allocated"), spent, activities: sum("activities"), leads, admissions, cpl: leads ? spent / leads : 0, cpa: admissions ? spent / admissions : 0 };
}

/** Monthly spend vs plan across the admission cycle (Oct → Sep). */
export function outreachMonthly(locIds: string[], cycle: Cycle) {
  const t = outreachTotals(locIds, cycle);
  const shape = [0.1, 0.14, 0.15, 0.14, 0.12, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02, 0.02];
  const r = rng("spendm" + locIds.join() + cycle);
  return CYCLE_MONTHS.map((month, i) => ({
    month,
    planned: Math.round(t.allocated * shape[i]),
    spent: Math.round(t.spent * shape[i] * between(r, 0.8, 1.2)),
  }));
}

/* ------------------------------------------------------------------ */
/* Social media                                                        */
/* ------------------------------------------------------------------ */

export const SOCIAL_PLATFORMS = ["Instagram", "Facebook", "YouTube", "LinkedIn", "Google Business"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
const PLATFORM_SHARE: Record<SocialPlatform, number> = { Instagram: 0.38, Facebook: 0.27, YouTube: 0.17, LinkedIn: 0.06, "Google Business": 0.12 };

export function socialByPlatform(locIds: string[], cycle: Cycle) {
  const digitalLeads = totalsFor(locIds, cycle).leads * SOURCE_GROUP_SHARE.Digital;
  return SOCIAL_PLATFORMS.map((p) => {
    const r = rng("soc" + p + locIds.join() + cycle);
    const reach = Math.round(locIds.length * between(r, 28000, 52000) * PLATFORM_SHARE[p] * 5);
    const impressions = Math.round(reach * between(r, 2.2, 3.4));
    const interactions = Math.round(impressions * between(r, 0.018, 0.045));
    const followers = Math.round(reach * between(r, 0.004, 0.012));
    const prospects = Math.round(digitalLeads * PLATFORM_SHARE[p] * 0.55);
    return { platform: p, reach, impressions, interactions, engagement: (interactions / impressions) * 100, followers, prospects };
  });
}

export function socialMonthly(locIds: string[], cycle: Cycle) {
  const rows = socialByPlatform(locIds, cycle);
  const reach = rows.reduce((s, r) => s + r.reach, 0);
  const prospects = rows.reduce((s, r) => s + r.prospects, 0);
  const shape = [0.07, 0.11, 0.13, 0.14, 0.13, 0.11, 0.09, 0.07, 0.05, 0.04, 0.03, 0.03];
  const r = rng("socm" + locIds.join() + cycle);
  return CYCLE_MONTHS.map((month, i) => {
    const j = between(r, 0.85, 1.15);
    return { month, reach: Math.round(reach * shape[i] * j), prospects: Math.round(prospects * shape[i] * j) };
  });
}

/** Share of the "Digital ads" outreach spend that goes to paid social campaigns (rest is search / display). */
export const SOCIAL_SHARE_OF_DIGITAL = 0.45;

/** Paid social spend for the selected schools — a slice of the Budget page's Digital ads spend. */
export function socialSpend(locIds: string[], cycle: Cycle) {
  const digital = outreachByActivity(locIds, cycle).find((a) => a.type === "Digital ads");
  return Math.round((digital?.spent ?? 0) * SOCIAL_SHARE_OF_DIGITAL);
}

/**
 * Campaigns, split from the platform totals so they always add up:
 * campaign prospects sum to total prospects, spend to the social spend, reach stays within platform reach.
 */
export function socialCampaigns(locIds: string[], cycle: Cycle) {
  const CAMPAIGNS: { name: string; platform: SocialPlatform; month: string }[] = [
    { name: "Nursery admissions open", platform: "Instagram", month: "Nov" },
    { name: "Campus walkthrough reels", platform: "Instagram", month: "Dec" },
    { name: "Open house invite", platform: "Facebook", month: "Dec" },
    { name: "Parent testimonials", platform: "YouTube", month: "Jan" },
    { name: "Board results showcase", platform: "Facebook", month: "May" },
    { name: "Scholarship test", platform: "Google Business", month: "Feb" },
    { name: "Early-bird fee offer", platform: "Facebook", month: "Jan" },
    { name: "Higher Ed info sessions", platform: "LinkedIn", month: "Apr" },
  ];
  const platforms = socialByPlatform(locIds, cycle);
  const r = rng("camp" + locIds.join() + cycle);
  const weights = CAMPAIGNS.map(() => 0.6 + r());
  const spendSplit = splitExact(socialSpend(locIds, cycle), weights.map((w) => w * (0.8 + r() * 0.4)));
  // Each platform's prospects and reach are shared among its campaigns (paid campaigns drive ~70% of prospects).
  const byPlatform = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => {
      const idx = CAMPAIGNS.map((c, i) => (c.platform === p ? i : -1)).filter((i) => i >= 0);
      const pl = platforms.find((x) => x.platform === p)!;
      const pros = splitExact(Math.round(pl.prospects * 0.7), idx.map((i) => weights[i]));
      const reach = splitExact(Math.round(pl.reach * 0.55), idx.map((i) => weights[i]));
      return [p, Object.fromEntries(idx.map((i, k) => [i, { prospects: pros[k], reach: reach[k] }]))];
    }),
  ) as Record<SocialPlatform, Record<number, { prospects: number; reach: number }>>;

  return CAMPAIGNS.map((c, i) => {
    const { prospects, reach } = byPlatform[c.platform][i];
    const clicks = Math.round(reach * (0.015 + r() * 0.02));
    const spend = spendSplit[i];
    return { ...c, spend, reach, clicks, leads: prospects, cpl: prospects ? spend / prospects : 0, ctr: reach ? (clicks / reach) * 100 : 0 };
  });
}

/* ------------------------------------------------------------------ */
/* Partners                                                            */
/* ------------------------------------------------------------------ */

export const PARTNER_TYPES = ["Preschool", "Crèche", "Corporate", "RWA"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];
/** Invented partner names for demo data. */
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

export interface Partner {
  id: string; name: string; type: PartnerType; locationId: string; since: string;
  leadsShared: number; admissions: number; conversion: number; active: boolean;
}

export function partnersFor(locIds: string[], cycle: Cycle): Partner[] {
  return locIds.flatMap((id) => {
    const loc = locationById(id);
    if (loc.isNew) return []; // no partner history yet
    const r = rng("partners" + id + cycle);
    const t = locationTotals(id, cycle);
    const types: PartnerType[] = loc.vertical === "Schools" ? ["Preschool", "Preschool", "Crèche", "RWA", "RWA", "Corporate"] : ["Corporate", "Corporate", "RWA"];
    // Each school gets its own slice of each name list (2 per type), so partner names never repeat across schools.
    const li = SEED_LOCATIONS.findIndex((l) => l.id === id);
    const seen: Record<PartnerType, number> = { Preschool: 0, Crèche: 0, Corporate: 0, RWA: 0 };
    return types.map((type, i) => {
      const list = PARTNER_NAMES[type];
      const name = list[(li * 2 + seen[type]++) % list.length];
      const share =
        type === "RWA" ? SOURCE_GROUP_SHARE.RWA / 2 : type === "Corporate" ? SOURCE_GROUP_SHARE.Corporate : SOURCE_GROUP_SHARE["Preschool / Crèche"] / 3;
      const leadsShared = Math.round(t.leads * share * between(r, 0.6, 1.2));
      const admissions = Math.round(leadsShared * between(r, 0.06, 0.22));
      return {
        id: `${id}-p${i}`, name, type, locationId: id,
        since: ["Apr 2024", "Jul 2024", "Jan 2025", "Jun 2025", "Oct 2025"][Math.floor(r() * 5)],
        leadsShared, admissions, conversion: leadsShared ? (admissions / leadsShared) * 100 : 0, active: r() > 0.12,
      };
    });
  });
}

/** Month-by-month leads shared and admissions for a set of partners (cycle Oct → Sep). */
export function partnerMonthly(partners: Partner[]) {
  const shape = [0.06, 0.12, 0.15, 0.16, 0.14, 0.11, 0.09, 0.07, 0.04, 0.03, 0.02, 0.01];
  return CYCLE_MONTHS.map((month, i) => {
    const row: { month: string; admissions: number } & Record<PartnerType, number> = {
      month, admissions: 0, Preschool: 0, Crèche: 0, Corporate: 0, RWA: 0,
    };
    for (const t of PARTNER_TYPES) row[t] = Math.round(partners.filter((p) => p.type === t).reduce((s, p) => s + p.leadsShared, 0) * shape[i]);
    row.admissions = Math.round(partners.reduce((s, p) => s + p.admissions, 0) * shape[Math.max(0, i - 1)]);
    return row;
  });
}

/** Cost per admission for a location (used in the leaderboard). */
export const costPerAdmission = (locId: string, cycle: Cycle) => outreachTotals([locId], cycle).cpa;
