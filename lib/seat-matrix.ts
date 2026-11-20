/**
 * Seat Matrix store: matrices created or updated in the dashboard, plus their change history.
 * 2026–27 starts from the mock matrix loaded for every location; 2027–28 has none until someone creates it.
 * Saved 2026–27 values feed back into every page through `setSeatOverrides` (see lib/context.tsx).
 */
import { CURRENT_CYCLE, CYCLE_CALENDAR, DATA_TODAY, locationById, type SeatField, type SeatValues, type Vertical, defaultSeatValues } from "./data";

/** An admission cycle, e.g. "2027-28". */
export type PlanCycle = string;
/** The cycle whose seats drive the live dashboard. */
export const LIVE_PLAN_CYCLE: PlanCycle = CURRENT_CYCLE;

export interface PlanCycleOption {
  value: PlanCycle;
  started: boolean;
  label: string;
  lock: string;
}
/**
 * Cycles that have a Seat Matrix, from the Masters cycle calendar: the live cycle and every later published one.
 * A cycle is "started" (Seat Matrix locked, changes need approval) once its lock date has passed.
 */
export function planCyclesFor(vertical: Vertical): PlanCycleOption[] {
  const list = CYCLE_CALENDAR.filter((c) => c.vertical === vertical && !c.draft && c.cycle >= LIVE_PLAN_CYCLE).sort((a, b) => a.cycle.localeCompare(b.cycle));
  const out = list.map((c) => {
    const started = c.cycle === LIVE_PLAN_CYCLE || +DATA_TODAY >= +new Date(c.seatLock);
    const t = c.cycle.replace("-", "–");
    return { value: c.cycle, started, label: `${t} · ${started ? "cycle started" : "setup open"}`, lock: started ? `Locked since ${c.seatLock}` : `Open for entry until ${c.seatLock}` };
  });
  if (!out.some((c) => c.value === LIVE_PLAN_CYCLE))
    out.unshift({ value: LIVE_PLAN_CYCLE, started: true, label: `${LIVE_PLAN_CYCLE.replace("-", "–")} · cycle started`, lock: "Locked" });
  return out;
}

export const SEAT_FIELDS: SeatField[] = ["continuing", "seats", "ewsSeats", "intake"];
export const FIELD_LABEL: Record<SeatField, string> = {
  intake: "Total intake", continuing: "Continuing", seats: "Seats for new admission", ewsSeats: "EWS/DG reserved",
};

export type CreateMethod = "mock" | "copy" | "blank" | "upload";
export interface MatrixMeta {
  method: CreateMethod;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface StoredMatrix {
  rows: Record<string, SeatValues>;
  meta: MatrixMeta;
}
export interface SeatChange {
  unit: string;
  field: SeatField;
  from: number;
  to: number;
}
export interface HistoryEntry {
  id: string;
  at: string;
  who: string;
  cycle: PlanCycle;
  locId: string;
  action: "created" | "updated" | "approved";
  summary: string;
  changes: SeatChange[];
}
/** A Location Head's proposed change to a started cycle, approved or rejected by the Vertical Head. */
export interface ChangeRequest {
  id: string; locId: string; location: string; cycle: PlanCycle; unit: string; field: SeatField; from: number; to: number; by: string;
  status: "pending" | "approved" | "rejected";
}
export interface SeatStore {
  matrices: Record<string, StoredMatrix>;
  history: HistoryEntry[];
  requests: ChangeRequest[];
}
const seedRequests = (): ChangeRequest[] => {
  const from = defaultSeatValues("pitampura", "XI").seats;
  return [{ id: "r0", locId: "pitampura", location: "Pitampura", cycle: "2026-27", unit: "XI", field: "seats", from, to: from + 12, by: "Location Head, Pitampura", status: "pending" }];
};
export const EMPTY_STORE: SeatStore = { matrices: {}, history: [], requests: seedRequests() };
/** Reads a saved store, filling anything an older version did not keep. */
export function reviveStore(raw: unknown): SeatStore | null {
  const s = raw as Partial<SeatStore> | null;
  if (!s || typeof s.matrices !== "object" || !Array.isArray(s.history)) return null;
  return { matrices: s.matrices, history: s.history, requests: Array.isArray(s.requests) ? s.requests : seedRequests() };
}

const key = (cycle: PlanCycle, locId: string) => `${cycle}|${locId}`;
export const nowLabel = () => {
  const d = new Date();
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const uid = () => Math.random().toString(36).slice(2, 10);

export const blankValues = (): SeatValues => ({ intake: 0, continuing: 0, seats: 0, ewsSeats: 0 });
/** Intake is always continuing + seats for new admission. */
export const withIntake = (v: Omit<SeatValues, "intake"> & Partial<SeatValues>): SeatValues => ({ ...v, intake: v.continuing + v.seats });

export interface MatrixView {
  exists: boolean;
  rows: Record<string, SeatValues>;
  meta: MatrixMeta | null;
}

/** The matrix for a location and cycle, or `exists: false` when it has not been created yet. */
export function matrixOf(store: SeatStore, cycle: PlanCycle, locId: string): MatrixView {
  const saved = store.matrices[key(cycle, locId)];
  if (saved) return { exists: true, rows: saved.rows, meta: saved.meta };
  if (cycle === LIVE_PLAN_CYCLE) {
    const loc = locationById(locId);
    return {
      exists: true,
      rows: Object.fromEntries(loc.units.map((u) => [u, defaultSeatValues(locId, u)])),
      meta: { method: "mock", createdBy: "Central Admin (initial load)", createdAt: "1 Oct 2025, 10:00" },
    };
  }
  return { exists: false, rows: {}, meta: null };
}

export function diffRows(before: Record<string, SeatValues>, after: Record<string, SeatValues>): SeatChange[] {
  const out: SeatChange[] = [];
  for (const [unit, v] of Object.entries(after))
    for (const f of SEAT_FIELDS) {
      const from = before[unit]?.[f] ?? 0;
      if (v[f] !== from) out.push({ unit, field: f, from, to: v[f] });
    }
  return out;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
function summarise(changes: SeatChange[]) {
  const units = new Set(changes.map((c) => c.unit));
  const seatDelta = changes.filter((c) => c.field === "seats").reduce((s, c) => s + c.to - c.from, 0);
  return `${plural(units.size, "row")} changed${seatDelta ? ` · seats ${seatDelta > 0 ? "+" : "−"}${Math.abs(seatDelta)}` : ""}`;
}

export function createMatrix(
  store: SeatStore, cycle: PlanCycle, locId: string, rows: Record<string, SeatValues>, method: CreateMethod, who: string,
): SeatStore {
  const at = nowLabel();
  const seats = Object.values(rows).reduce((s, r) => s + r.seats, 0);
  const how = { copy: "copied from 2026–27", blank: "started blank", upload: "uploaded from CSV", mock: "" }[method];
  return {
    ...store,
    matrices: { ...store.matrices, [key(cycle, locId)]: { rows, meta: { method, createdBy: who, createdAt: at } } },
    history: [
      { id: uid(), at, who, cycle, locId, action: "created", summary: `Seat Matrix created (${how}) · ${seats} seats`, changes: [] },
      ...store.history,
    ],
  };
}

/** Saves edited rows over the current matrix; returns the store unchanged when nothing differs. */
export function updateMatrix(
  store: SeatStore, cycle: PlanCycle, locId: string, next: Record<string, SeatValues>, who: string, action: "updated" | "approved" = "updated",
): SeatStore {
  const cur = matrixOf(store, cycle, locId);
  const changes = diffRows(cur.rows, next);
  if (!changes.length) return store;
  const at = nowLabel();
  return {
    ...store,
    matrices: {
      ...store.matrices,
      [key(cycle, locId)]: { rows: { ...cur.rows, ...next }, meta: { ...(cur.meta ?? { method: "blank", createdBy: who, createdAt: at }), updatedBy: who, updatedAt: at } },
    },
    history: [{ id: uid(), at, who, cycle, locId, action, summary: summarise(changes), changes }, ...store.history],
  };
}

/** Flattens saved live-cycle matrices for `setSeatOverrides`. */
export function overridesOf(store: SeatStore) {
  const m = new Map<string, SeatValues>();
  for (const [k, v] of Object.entries(store.matrices)) {
    const [cycle, locId] = k.split("|");
    if (cycle !== LIVE_PLAN_CYCLE) continue;
    for (const [unit, vals] of Object.entries(v.rows)) m.set(`${cycle}|${locId}|${unit}`, vals);
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* CSV template / upload                                               */
/* ------------------------------------------------------------------ */

export const CSV_HEAD = { unit: "Grade / Programme", continuing: "Continuing", seats: "Seats for new admission", ewsSeats: "EWS/DG reserved" };

export function templateRows(units: string[], rows: Record<string, SeatValues>) {
  return units.map((u) => ({
    [CSV_HEAD.unit]: u,
    [CSV_HEAD.continuing]: rows[u]?.continuing ?? 0,
    [CSV_HEAD.seats]: rows[u]?.seats ?? 0,
    [CSV_HEAD.ewsSeats]: rows[u]?.ewsSeats ?? 0,
  }));
}

function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t" || c === ";") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ParsedUpload {
  rows: Record<string, SeatValues>;
  matched: number;
  missing: string[];
  unknown: string[];
  errors: string[];
}

/** Parses a filled-in template. Rows are matched to the location's grades / programmes by name. */
export function parseSeatCsv(text: string, units: string[]): ParsedUpload {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const errors: string[] = [];
  if (lines.length < 2) return { rows: {}, matched: 0, missing: units, unknown: [], errors: ["The file has no data rows."] };
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const ci = { unit: col("grade", "programme", "unit", "class"), continuing: col("continuing"), seats: col("seats for new", "new admission", "seats"), ews: col("ews", "dg") };
  if (ci.unit < 0 || ci.seats < 0) return { rows: {}, matched: 0, missing: units, unknown: [], errors: ['Columns "Grade / Programme" and "Seats for new admission" are required. Download the template to see the layout.'] };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byNorm = new Map(units.map((u) => [norm(u), u]));
  const rows: Record<string, SeatValues> = {};
  const unknown: string[] = [];
  const num = (raw: string | undefined, line: number, label: string) => {
    if (raw === undefined || raw === "") return 0;
    const v = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) { errors.push(`Row ${line}: ${label} "${raw}" is not a whole number.`); return 0; }
    return v;
  };
  lines.slice(1).forEach((l, i) => {
    const cells = splitCsvLine(l);
    const name = cells[ci.unit] ?? "";
    if (!name) return;
    const unit = byNorm.get(norm(name)) ?? byNorm.get(norm(name + " – Y1"));
    if (!unit) { unknown.push(name); return; }
    const line = i + 2;
    const v = withIntake({
      continuing: ci.continuing >= 0 ? num(cells[ci.continuing], line, "Continuing") : 0,
      seats: num(cells[ci.seats], line, "Seats"),
      ewsSeats: ci.ews >= 0 ? num(cells[ci.ews], line, "EWS/DG") : 0,
    });
    if (v.ewsSeats > v.seats) errors.push(`Row ${line} (${unit}): EWS/DG reserved (${v.ewsSeats}) is more than seats (${v.seats}).`);
    rows[unit] = v;
  });
  const missing = units.filter((u) => !rows[u]);
  return { rows, matched: Object.keys(rows).length, missing, unknown, errors };
}
