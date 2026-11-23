/**
 * Bulk upload rules for the manually entered figures: budgets, spend, social media, campaigns and targets.
 * Each spec checks a CSV row the same way the matching Add form does, and imports the rows that pass
 * as new entries in one logged change. Existing entries are never overwritten (targets excepted:
 * a target is one value per grade, so an uploaded target replaces the current one).
 */
import { readChoice, readLocation, readMonth, readNumber, norm } from "@/lib/csv";
import { CYCLE_MONTHS, defaultTarget, locationById, locationUnits, type Cycle, type Location } from "@/lib/data";
import {
  ALL_ACTIVITIES, newEntryId, OUTREACH_ACTIVITIES, SOCIAL_PLATFORMS, targetKey,
  type BudgetRec, type CampaignRec, type CycleData, type SocialRec, type SpendRec,
} from "@/lib/marketing";
import type { UploadCheck, UploadColumn, UploadSpec } from "./bulk-upload";
import type { useEntryStore } from "./entry-kit";
import { fmt } from "./ui";

type Entry = ReturnType<typeof useEntryStore>;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

/** A whole number ≥ 0; blank gives `blank` (undefined = required). */
function whole(raw: string, label: string, blank?: number): number | string {
  if (!raw.trim()) return blank ?? `${label} is blank`;
  const v = readNumber(raw);
  if (!Number.isFinite(v)) return `${label} “${raw}” is not a number`;
  if (v < 0) return `${label} can't be negative`;
  if (!Number.isInteger(v)) return `${label} “${raw}” must be a whole number`;
  return v;
}
/** An amount ≥ 0 (rupees, rounded). */
function amount(raw: string, label: string): number | string {
  if (!raw.trim()) return `${label} is blank`;
  const v = readNumber(raw);
  if (!Number.isFinite(v)) return `${label} “${raw}” is not an amount`;
  return v < 0 ? `${label} can't be negative` : Math.round(v);
}
const isErr = (v: number | string): v is string => typeof v === "string";

const schoolCol = (locs: Location[]): UploadColumn => ({
  label: "School", required: true, aliases: ["Location", "Campus", "Institution"],
  help: `Short name, full name or a SaaS / LeadSquared / FABS code — e.g. ${locs.slice(0, 3).map((l) => l.short).join(", ")}`,
});
const monthCol: UploadColumn = { label: "Month", required: true, help: `Month of the cycle: ${CYCLE_MONTHS.join(", ")} (full names and numbers also work)` };
function school(raw: string, locs: Location[]): Location | string {
  if (!raw) return "School is blank";
  return readLocation(raw, locs) ?? `School “${raw}” isn't one you can enter figures for`;
}
function activity(raw: string): string {
  if (!raw) return "!Activity is blank";
  const a = ALL_ACTIVITIES.find((x) => norm(x.type) === norm(raw));
  if (!a) return `!Activity “${raw}” isn't in the Outreach activities master`;
  if (!a.active) return `!${a.type} is inactive in Masters`;
  return a.type;
}
const activityCol: UploadColumn = { label: "Activity", required: true, aliases: ["Outreach activity"], help: "" };
const withActivities = (c: UploadColumn): UploadColumn => ({ ...c, help: `An active outreach activity: ${OUTREACH_ACTIVITIES.map((a) => a.type).join(", ")}` });

/* ------------------------------------------------------------------ */
/* Budget & Outreach                                                   */
/* ------------------------------------------------------------------ */

export function budgetSpec(locs: Location[], data: CycleData, entry: Entry): UploadSpec<BudgetRec> {
  const have = new Set(data.budgets.map((b) => `${b.locationId}|${b.activity}`));
  return {
    what: "budget allocations", file: "budget-allocations",
    columns: [schoolCol(locs), withActivities(activityCol), { label: "Annual budget", required: true, aliases: ["Budget", "Allocated", "Amount"], help: "Rupees for the whole cycle, e.g. 250000 or ₹2,50,000" }],
    check: (r): UploadCheck<BudgetRec> => {
      const loc = school(r["School"], locs);
      if (typeof loc === "string") return { error: loc };
      const act = activity(r["Activity"]);
      if (act.startsWith("!")) return { error: act.slice(1) };
      const amt = amount(r["Annual budget"], "Annual budget");
      if (isErr(amt)) return { error: amt };
      if (have.has(`${loc.id}|${act}`)) return { error: `${loc.short} already has a ${act} budget — edit it instead` };
      return { key: `${loc.id}|${act}`, note: `${loc.short} · ${act} · ${inr(amt)}`, value: { id: "", locationId: loc.id, activity: act, allocated: amt, ...entry.stamp() } };
    },
    importRows: (rows, file) => {
      const recs = rows.map((r) => ({ ...r, id: newEntryId("b") }));
      entry.commit("Budget", "Created", `Bulk upload · ${file}`, `${plural(recs.length, "allocation", "allocations")} added · ${inr(recs.reduce((s, r) => s + r.allocated, 0))}`, (d) => ({ ...d, budgets: [...d.budgets, ...recs] }));
    },
    notes: <p>A school can have one budget per activity; rows for a pair that already has one are skipped.</p>,
  };
}

export function spendSpec(locs: Location[], data: CycleData, entry: Entry): UploadSpec<SpendRec> {
  const sig = (s: Pick<SpendRec, "locationId" | "activity" | "month" | "amount" | "count" | "leads">) => `${s.locationId}|${s.activity}|${s.month}|${s.amount}|${s.count}|${s.leads}`;
  const have = new Set(data.spend.map(sig));
  return {
    what: "spend entries", file: "spend-log",
    columns: [
      schoolCol(locs), withActivities(activityCol), monthCol,
      { label: "Amount spent", required: true, aliases: ["Spend", "Amount"], help: "Rupees, e.g. 45000" },
      { label: "Activities run", aliases: ["Count", "Activities"], help: "How many were run (events, fairs, campaigns…); blank = 0" },
      { label: "Leads", aliases: ["Leads generated"], help: "Leads the activity generated; blank = 0" },
      { label: "Note", help: "Up to 120 characters" },
    ],
    check: (r): UploadCheck<SpendRec> => {
      const loc = school(r["School"], locs);
      if (typeof loc === "string") return { error: loc };
      const act = activity(r["Activity"]);
      if (act.startsWith("!")) return { error: act.slice(1) };
      const month = readMonth(r["Month"]);
      if (!month) return { error: r["Month"] ? `Month “${r["Month"]}” isn't recognised` : "Month is blank" };
      const amt = amount(r["Amount spent"], "Amount spent");
      if (isErr(amt)) return { error: amt };
      const count = whole(r["Activities run"], "Activities run", 0);
      if (isErr(count)) return { error: count };
      const leads = whole(r["Leads"], "Leads", 0);
      if (isErr(leads)) return { error: leads };
      const note = r["Note"].trim();
      if (note.length > 120) return { error: "Note is longer than 120 characters" };
      const value: SpendRec = { id: "", locationId: loc.id, activity: act, month, amount: amt, count, leads, note, ...entry.stamp() };
      if (have.has(sig(value))) return { error: "Same as an existing entry — looks already uploaded" };
      return { key: sig(value), note: `${loc.short} · ${act} · ${month} · ${inr(amt)}`, value };
    },
    importRows: (rows, file) => {
      const recs = rows.map((r) => ({ ...r, id: newEntryId("s") }));
      entry.commit("Spend", "Created", `Bulk upload · ${file}`, `${plural(recs.length, "entry", "entries")} added · ${inr(recs.reduce((s, r) => s + r.amount, 0))} · ${fmt(recs.reduce((s, r) => s + r.leads, 0))} leads`, (d) => ({ ...d, spend: [...d.spend, ...recs] }));
    },
    notes: <p>Rows identical to an entry already in the log (same school, activity, month and figures) are skipped, so uploading a file twice doesn&apos;t double the spend.</p>,
  };
}

/* ------------------------------------------------------------------ */
/* Social media                                                        */
/* ------------------------------------------------------------------ */

const METRICS = [
  { k: "reach", label: "Reach", help: "Unique accounts reached" },
  { k: "impressions", label: "Impressions", help: "Total views" },
  { k: "interactions", label: "Interactions", help: "Likes, comments, shares, saves" },
  { k: "followers", label: "Followers gained", help: "Net new followers", aliases: ["Followers"] },
  { k: "prospects", label: "Prospects", help: "Leads created in LeadSquared", aliases: ["Leads"] },
] as const;
const platformCol: UploadColumn = { label: "Platform", required: true, help: SOCIAL_PLATFORMS.join(", ") };

export function socialSpec(locs: Location[], data: CycleData, entry: Entry): UploadSpec<SocialRec> {
  const have = new Set(data.social.map((s) => `${s.locationId}|${s.platform}|${s.month}`));
  return {
    what: "monthly platform figures", file: "social-media-figures",
    columns: [schoolCol(locs), platformCol, monthCol, ...METRICS.map((m) => ({ label: m.label, required: true, help: `${m.help} (0 if none)`, aliases: "aliases" in m ? [...m.aliases] : undefined }))],
    check: (r): UploadCheck<SocialRec> => {
      const loc = school(r["School"], locs);
      if (typeof loc === "string") return { error: loc };
      const platform = readChoice(r["Platform"], SOCIAL_PLATFORMS);
      if (!platform) return { error: r["Platform"] ? `Platform “${r["Platform"]}” isn't one of ${SOCIAL_PLATFORMS.join(", ")}` : "Platform is blank" };
      const month = readMonth(r["Month"]);
      if (!month) return { error: r["Month"] ? `Month “${r["Month"]}” isn't recognised` : "Month is blank" };
      const v = {} as Record<(typeof METRICS)[number]["k"], number>;
      for (const m of METRICS) {
        const x = whole(r[m.label], m.label);
        if (isErr(x)) return { error: x };
        v[m.k] = x;
      }
      if (v.impressions < v.reach) return { error: "Impressions are lower than reach" };
      if (v.interactions > v.impressions) return { error: "Interactions are more than impressions" };
      const key = `${loc.id}|${platform}|${month}`;
      if (have.has(key)) return { error: `${platform} figures for ${loc.short} in ${month} already exist — edit them instead` };
      return { key, note: `${loc.short} · ${platform} · ${month}`, value: { id: "", locationId: loc.id, platform, month, ...v, ...entry.stamp() } };
    },
    importRows: (rows, file) => {
      const recs = rows.map((r) => ({ ...r, id: newEntryId("m") }));
      entry.commit("Social media", "Created", `Bulk upload · ${file}`, `${plural(recs.length, "month", "months")} of figures added · reach ${fmt(recs.reduce((s, r) => s + r.reach, 0))}`, (d) => ({ ...d, social: [...d.social, ...recs] }));
    },
    notes: <p>One row per school, platform and month. Rows for a month that already has figures are skipped.</p>,
  };
}

export function campaignSpec(locs: Location[], data: CycleData, entry: Entry): UploadSpec<CampaignRec> {
  const k = (locId: string, month: string, name: string) => `${locId}|${month}|${name.toLowerCase()}`;
  const have = new Set(data.campaigns.map((c) => k(c.locationId, c.month, c.name)));
  return {
    what: "campaigns", file: "paid-campaigns",
    columns: [
      { label: "Campaign", required: true, aliases: ["Campaign name", "Name"], help: "Campaign name, up to 60 characters" },
      schoolCol(locs), platformCol, monthCol,
      { label: "Spend", required: true, aliases: ["Amount spent", "Amount"], help: "Rupees" },
      { label: "Reach", required: true, help: "Unique accounts reached" },
      { label: "Clicks", help: "Blank = 0" },
      { label: "Prospects", aliases: ["Leads"], help: "Leads created; blank = 0" },
    ],
    check: (r): UploadCheck<CampaignRec> => {
      const name = r["Campaign"].trim();
      if (!name) return { error: "Campaign name is blank" };
      if (name.length > 60) return { error: "Campaign name is longer than 60 characters" };
      const loc = school(r["School"], locs);
      if (typeof loc === "string") return { error: loc };
      const platform = readChoice(r["Platform"], SOCIAL_PLATFORMS);
      if (!platform) return { error: r["Platform"] ? `Platform “${r["Platform"]}” isn't one of ${SOCIAL_PLATFORMS.join(", ")}` : "Platform is blank" };
      const month = readMonth(r["Month"]);
      if (!month) return { error: r["Month"] ? `Month “${r["Month"]}” isn't recognised` : "Month is blank" };
      const spend = amount(r["Spend"], "Spend");
      if (isErr(spend)) return { error: spend };
      const reach = whole(r["Reach"], "Reach");
      if (isErr(reach)) return { error: reach };
      const clicks = whole(r["Clicks"], "Clicks", 0);
      if (isErr(clicks)) return { error: clicks };
      const leads = whole(r["Prospects"], "Prospects", 0);
      if (isErr(leads)) return { error: leads };
      if (clicks > reach) return { error: "Clicks are more than reach" };
      const key = k(loc.id, month, name);
      if (have.has(key)) return { error: `“${name}” already exists for ${loc.short} in ${month}` };
      return { key, note: `${loc.short} · ${month} · ${inr(spend)}`, value: { id: "", name, locationId: loc.id, platform, month, spend, reach, clicks, leads, ...entry.stamp() } };
    },
    importRows: (rows, file) => {
      const recs = rows.map((r) => ({ ...r, id: newEntryId("c") }));
      entry.commit("Campaign", "Created", `Bulk upload · ${file}`, `${plural(recs.length, "campaign", "campaigns")} added · ${inr(recs.reduce((s, r) => s + r.spend, 0))}`, (d) => ({ ...d, campaigns: [...d.campaigns, ...recs] }));
    },
  };
}

/* ------------------------------------------------------------------ */
/* Admission targets                                                   */
/* ------------------------------------------------------------------ */

interface TargetRow { locId: string; unit: string; from: number; to: number }
const unitName = (u: string) => u.replace(/ – Y1$/, "");

/**
 * Targets for every grade / programme of the schools in `templateLocs` (pre-filled with today's figures);
 * rows can name any school in `locs`.
 */
export function targetSpec(locs: Location[], templateLocs: Location[], cycle: Cycle, entry: Entry): UploadSpec<TargetRow> {
  const unitsOf = new Map<string, ReturnType<typeof locationUnits>>();
  const units = (id: string) => unitsOf.get(id) ?? unitsOf.set(id, locationUnits(id, cycle)).get(id)!;
  return {
    what: "targets", file: `admission-targets-${cycle}`,
    columns: [
      schoolCol(locs),
      { label: "Grade / Programme", required: true, aliases: ["Grade", "Programme", "Class"], help: "As in the Seat Matrix, e.g. Nursery, I, XI, BBA" },
      { label: "Target", required: true, aliases: ["Admission target"], help: "New admissions targeted for the cycle (whole number)" },
    ],
    templateRows: () => templateLocs.flatMap((l) => units(l.id).map((u) => ({ School: l.short, "Grade / Programme": unitName(u.unit), Target: u.target }))),
    check: (r): UploadCheck<TargetRow> => {
      const loc = school(r["School"], locs);
      if (typeof loc === "string") return { error: loc };
      const raw = r["Grade / Programme"];
      if (!raw) return { error: "Grade / Programme is blank" };
      const n = norm(raw).replace(/^(class|grade)/, "");
      const u = units(loc.id).find((x) => norm(x.unit) === n || norm(unitName(x.unit)) === n);
      if (!u) return { error: `${loc.short} doesn't offer “${raw}”` };
      const to = whole(r["Target"], "Target");
      if (isErr(to)) return { error: to };
      const key = `${loc.id}|${u.unit}`;
      if (to === u.target) return { key, skip: `No change (${fmt(to)})` };
      return { key, note: `Target ${fmt(u.target)} → ${fmt(to)}`, value: { locId: loc.id, unit: u.unit, from: u.target, to } };
    },
    importRows: (rows, file) => {
      const schools = new Set(rows.map((r) => r.locId)).size;
      const detail = rows.slice(0, 8).map((r) => `${locationById(r.locId).short} ${unitName(r.unit)} ${r.from} → ${r.to}`).join(", ") + (rows.length > 8 ? `, +${rows.length - 8} more` : "");
      entry.commitStore("Target", "Updated", `Bulk upload · ${file} · ${plural(schools, "school", "schools")}`, detail, (s) => {
        const targets = { ...s.targets };
        for (const r of rows) {
          // Back to the starting figure: drop the override instead of storing a copy.
          if (r.to === defaultTarget(r.locId, r.unit, cycle)) delete targets[targetKey(cycle, r.locId, r.unit)];
          else targets[targetKey(cycle, r.locId, r.unit)] = r.to;
        }
        return { ...s, targets };
      });
    },
    notes: (
      <>
        <p>The template lists every grade / programme of the selected schools with today&apos;s targets — change the ones you need and upload it back.</p>
        <p>A grade has one target, so an uploaded target replaces the current one; unchanged rows are left alone. Session {cycle.replace("-", "–")}.</p>
      </>
    ),
  };
}

