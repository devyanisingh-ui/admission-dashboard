/**
 * Master data maintained in the dashboard: locations, academic units, LeadSquared status mapping,
 * lead sources, withdrawal reasons, outreach activities and admission cycles — plus an audit log of every change.
 *
 * Records loaded from the source systems already have history (leads, admissions, withdrawals) pointing at them,
 * so they can only be deactivated. Records created here and not yet used can be deleted outright.
 */
import {
  SEED_ACTIVITIES, SEED_CYCLES, SEED_LOCATIONS, SEED_REASONS, SEED_SOURCE_GROUP_OF, SEED_SOURCES, SEED_STATUS_MAPPINGS,
  type Board, type CycleDef, type Location, type SourceGroup, type StatusMapping, type Vertical,
} from "./data";

export type Sys = "saas" | "crm" | "fabs";
export const SYSTEMS: Sys[] = ["saas", "crm", "fabs"];
export const SYS_LABEL: Record<Sys, string> = { saas: "SaaS", crm: "LeadSquared", fabs: "FABS" };
export const BOARDS: Record<Vertical, Board[]> = { Schools: ["CBSE", "IB"], "Higher Ed": ["UGC", "AICTE"] };

interface Base {
  id: string;
  active: boolean;
  /** Created in the dashboard (no source-system history yet). */
  custom?: boolean;
}
export interface LocationRec extends Base {
  name: string;
  short: string;
  vertical: Vertical;
  board: Board;
  city: string;
  codes: Record<Sys, string>;
}
export interface UnitRec extends Base {
  locId: string;
  name: string;
  codes: Record<Sys, string>;
  sections: string[];
}
export type StatusRec = Base & StatusMapping;
export interface SourceRec extends Base {
  name: string;
  group: SourceGroup;
}
export const REASON_SCOPES = ["Both", "New admission", "Existing student"] as const;
export interface ReasonRec extends Base {
  name: string;
  appliesTo: (typeof REASON_SCOPES)[number];
}
/** An outreach activity that budgets and spend are entered against (Budget & Outreach). */
export interface ActivityRec extends Base {
  name: string;
  /** Lead-source reporting group the activity feeds. */
  group: SourceGroup;
  /** What is counted for the activity, e.g. "campaigns" or "fairs". */
  unit: string;
}
export type CycleRec = Base & CycleDef;

export type MasterKey = "Status mapping" | "Location" | "Grade / programme" | "Lead source" | "Withdrawal reason" | "Outreach activity" | "Cycle";
export type AuditAction = "Created" | "Updated" | "Deleted" | "Deactivated" | "Reactivated" | "Approved";
export interface AuditRec {
  id: string;
  at: string;
  who: string;
  master: MasterKey;
  action: AuditAction;
  record: string;
  detail: string;
}

export interface MasterStore {
  locations: LocationRec[];
  units: UnitRec[];
  statuses: StatusRec[];
  sources: SourceRec[];
  reasons: ReasonRec[];
  activities: ActivityRec[];
  cycles: CycleRec[];
  audit: AuditRec[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const newId = (prefix: string, name: string) => `${prefix}-${slug(name) || "item"}-${Math.random().toString(36).slice(2, 6)}`;

/** System values for a unit as loaded from SaaS / LeadSquared / FABS. */
function seedUnitCodes(loc: Location, u: string): Record<Sys, string> {
  if (loc.vertical === "Higher Ed") {
    const p = u.replace(" – Y1", "");
    return { saas: p, crm: `${p.toUpperCase().replace(/[^A-Z]/g, "")}_Y1`, fabs: `${p} (Sem 1)` };
  }
  return { saas: ["Nursery", "KG"].includes(u) ? u : `Class ${u}`, crm: `GR-${u}`, fabs: u };
}
const seedSections = (loc: Location, u: string) =>
  ["XI", "XII"].includes(u) ? ["Science", "Commerce", "Humanities"] : loc.vertical === "Schools" ? ["A", "B", "C", "D"] : [];

export function seedMasters(): MasterStore {
  return {
    locations: SEED_LOCATIONS.map((l) => ({ id: l.id, name: l.name, short: l.short, vertical: l.vertical, board: l.board, city: l.city, codes: { ...l.codes }, active: true })),
    units: SEED_LOCATIONS.flatMap((l) => l.units.map((u) => ({ id: `${l.id}:${u}`, locId: l.id, name: u, codes: seedUnitCodes(l, u), sections: seedSections(l, u), active: true }))),
    statuses: SEED_STATUS_MAPPINGS.map((s) => ({ ...s, id: s.status, active: true })),
    sources: SEED_SOURCES.map((name) => ({ id: slug(name), name, group: SEED_SOURCE_GROUP_OF[name], active: true })),
    reasons: SEED_REASONS.map((name) => ({ id: slug(name), name, appliesTo: "Both" as const, active: true })),
    activities: SEED_ACTIVITIES.map((a) => ({ ...a, active: true })),
    cycles: SEED_CYCLES.map((c) => ({ ...c, id: `${c.vertical}|${c.cycle}`, active: true })),
    audit: [],
  };
}

/** Reads a saved store; anything missing or malformed falls back to the source data. */
export function reviveMasters(raw: unknown): MasterStore | null {
  const s = raw as Partial<MasterStore> | null;
  if (!s || typeof s !== "object") return null;
  const seed = seedMasters();
  const arr = <K extends keyof MasterStore>(k: K) => (Array.isArray(s[k]) ? (s[k] as MasterStore[K]) : seed[k]);
  return {
    locations: arr("locations"), units: arr("units"), statuses: arr("statuses"), sources: arr("sources"),
    reasons: arr("reasons"), activities: arr("activities"), cycles: arr("cycles"), audit: arr("audit"),
  };
}

export const STORAGE_KEY = "masters-v1";

export const nowLabel = () => {
  const d = new Date();
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** "field: old → new" lines for the audit log. */
export function describeChanges<T extends object>(before: T, after: T, labels: Partial<Record<keyof T, string>>): string {
  const out: string[] = [];
  for (const k of Object.keys(labels) as (keyof T)[]) {
    const a = before[k], b = after[k];
    const fmtV = (v: unknown) => (Array.isArray(v) ? v.join(", ") || "—" : typeof v === "object" && v ? Object.values(v).join(" / ") : String(v ?? "—"));
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${labels[k]}: ${fmtV(a)} → ${fmtV(b)}`);
  }
  return out.join(" · ") || "No changes";
}
