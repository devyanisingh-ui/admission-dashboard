"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EMPTY_STORE, overridesOf, reviveStore, type SeatStore } from "./seat-matrix";
import { reviveMasters, seedMasters, STORAGE_KEY as MASTERS_KEY, type MasterStore } from "./masters";
import { allLocations, applyMasters, CURRENT_CYCLE, CYCLE_MONTHS, LOCATIONS, locationById, setSeatOverrides, type Board, type Cycle, type Location, type SourceGroup, type Vertical } from "./data";

/** Date-range presets within the admission cycle (Oct → Sep). */
export type DateRange = "cycle" | "h1" | "h2" | "last6" | "last3" | "custom";
export const DATE_RANGES: { value: DateRange; label: string; months: [number, number] }[] = [
  { value: "cycle", label: "Full cycle (Oct – Sep)", months: [0, 11] },
  { value: "h1", label: "Oct – Mar", months: [0, 5] },
  { value: "h2", label: "Apr – Sep", months: [6, 11] },
  { value: "last6", label: "Last 6 months", months: [6, 11] },
  { value: "last3", label: "Last 3 months", months: [9, 11] },
  { value: "custom", label: "Custom range…", months: [0, 11] },
];

/** A custom range as ISO dates (yyyy-mm-dd), inclusive. */
export interface DateSpan { start: string; end: string }

const MS_DAY = 86_400_000;
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

/** First and last day of an academic session: 2026-27 runs 1 Oct 2025 – 30 Sep 2026. */
export function cycleBounds(cycle: Cycle): DateSpan {
  const y = Number(cycle.slice(0, 4)) - 1;
  return { start: `${y}-10-01`, end: `${y + 1}-09-30` };
}

/** Keeps a custom range inside the session; falls back to the whole session if nothing is left. */
export function clampSpan(span: DateSpan, cycle: Cycle): DateSpan {
  const b = cycleBounds(cycle);
  const start = span.start < b.start || span.start > b.end ? b.start : span.start;
  const end = span.end > b.end || span.end < b.start ? b.end : span.end;
  return start <= end ? { start, end } : b;
}

/**
 * Share of each session month (Oct … Sep) inside the range: 1 = whole month, 0 = none.
 * Data is held per month, so a part month counts in proportion to its days.
 */
export function rangeWeightsOf(range: DateRange, custom: DateSpan, cycle: Cycle): number[] {
  if (range !== "custom") {
    const [from, to] = DATE_RANGES.find((d) => d.value === range)!.months;
    return CYCLE_MONTHS.map((_, i) => (i >= from && i <= to ? 1 : 0));
  }
  const { start, end } = clampSpan(custom, cycle);
  const s = utc(start).getTime();
  const e = utc(end).getTime() + MS_DAY; // inclusive end
  const y = Number(cycle.slice(0, 4)) - 1;
  return CYCLE_MONTHS.map((_, i) => {
    const m0 = Date.UTC(i < 3 ? y : y + 1, (9 + i) % 12, 1);
    const m1 = Date.UTC(i < 3 ? y : y + 1, (9 + i) % 12 + 1, 1);
    const overlap = Math.max(0, Math.min(e, m1) - Math.max(s, m0));
    return overlap / (m1 - m0);
  });
}

/** Number of days in a custom range. */
export function spanDays(span: DateSpan) {
  return Math.round((utc(span.end).getTime() - utc(span.start).getTime()) / MS_DAY) + 1;
}

/** "12 Jan 2026", or "12 Jan" when short. */
export function fmtDate(isoDate: string, withYear = true) {
  const d = utc(isoDate);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${d.getUTCDate()} ${mon}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
}

/** Human label for the active range ("Last 3 months", "12 Jan 2026 – 3 Mar 2026"). */
export function rangeLabelOf(range: DateRange, custom: DateSpan, cycle: Cycle, short = false) {
  if (range !== "custom") return DATE_RANGES.find((d) => d.value === range)!.label;
  const { start, end } = clampSpan(custom, cycle);
  return start === end ? fmtDate(start, !short) : `${fmtDate(start, !short)} – ${fmtDate(end, !short)}`;
}

import { ROLES, can, type Permission, type RoleId } from "./roles";

/** Demo users: which location / vertical each role is scoped to. */
const ROLE_HOME: Record<RoleId, { locationId?: string; vertical?: Vertical; user: string }> = {
  counsellor: { locationId: "saket", vertical: "Schools", user: "Neha Arora" },
  locHead: { locationId: "saket", vertical: "Schools", user: "Sunil Mathur" },
  principal: { locationId: "saket", vertical: "Schools", user: "Dr. Rashmi Kaul" },
  verticalHead: { vertical: "Schools", user: "Anita Desai" },
  leadership: { user: "Group Leadership" },
  centralAdmin: { user: "Central Admin Desk" },
  sysAdmin: { user: "IT – Platform" },
};

interface AppState {
  role: RoleId;
  setRole: (r: RoleId) => void;
  userName: string;
  vertical: Vertical | "All";
  setVertical: (v: Vertical | "All") => void;
  board: Board | "All";
  setBoard: (b: Board | "All") => void;
  cycle: Cycle;
  setCycle: (c: Cycle) => void;
  /** Selected location for location-level pages. */
  locationId: string;
  setLocationId: (id: string) => void;
  /** Global "School" filter: one location or all allowed ones. */
  school: string;
  setSchool: (id: string) => void;
  /** Dashboard-level filters (Global Filters panel). */
  grade: string;
  setGrade: (g: string) => void;
  sourceGroup: SourceGroup | "All";
  setSourceGroup: (s: SourceGroup | "All") => void;
  dateRange: DateRange;
  setDateRange: (d: DateRange) => void;
  /** Start / end dates used when dateRange is "custom". */
  customRange: DateSpan;
  setCustomRange: (m: DateSpan) => void;
  /** Locations the role may see. */
  allowedLocations: Location[];
  /** Allowed locations after vertical / board filters. */
  filteredLocations: Location[];
  /** Seat Matrices created / updated in the dashboard (kept in this browser). */
  seatStore: SeatStore;
  setSeatStore: (f: (s: SeatStore) => SeatStore) => void;
  /** Master data (locations, grades, sources, reasons, status mapping, cycles) from the Masters page. */
  masters: MasterStore;
  setMasters: (f: (s: MasterStore) => MasterStore) => void;
  /** Bumps whenever saved seats or master data change, so memoised figures recompute. */
  seatVersion: number;
  lockedVertical: boolean;
  lockedLocation: boolean;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleId>("centralAdmin");
  const [vertical, setVertical] = useState<Vertical | "All">("All");
  const [board, setBoard] = useState<Board | "All">("All");
  const [cycle, setCycle] = useState<Cycle>(CURRENT_CYCLE);
  const [locationId, setLocationIdState] = useState<string>("saket");
  const [school, setSchoolState] = useState<string>("all");
  const [grade, setGrade] = useState("All");
  const [sourceGroup, setSourceGroup] = useState<SourceGroup | "All">("All");
  const [dateRange, setDateRange] = useState<DateRange>("cycle");
  const [customRange, setCustomRange] = useState<DateSpan>(cycleBounds(CURRENT_CYCLE));
  const [seat, setSeat] = useState<{ store: SeatStore; version: number }>({ store: EMPTY_STORE, version: 0 });

  // Overrides must be in place before anything re-renders with the new version.
  const setSeatStore = (f: (s: SeatStore) => SeatStore) =>
    setSeat((cur) => {
      const store = f(cur.store);
      if (store === cur.store) return cur;
      setSeatOverrides(overridesOf(store));
      try {
        localStorage.setItem("seat-matrix-v1", JSON.stringify(store));
      } catch {}
      return { store, version: cur.version + 1 };
    });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("seat-matrix-v1");
      if (raw) {
        const store = reviveStore(JSON.parse(raw));
        if (store) {
          setSeatOverrides(overridesOf(store));
          setSeat((cur) => ({ store, version: cur.version + 1 }));
        }
      }
    } catch {}
  }, []);

  // Master data: applied to the shared lists before anything re-renders with the new version.
  const [master, setMaster] = useState<{ store: MasterStore; version: number }>(() => ({ store: seedMasters(), version: 0 }));
  const setMasters = (f: (s: MasterStore) => MasterStore) =>
    setMaster((cur) => {
      const store = f(cur.store);
      if (store === cur.store) return cur;
      applyMasters(store);
      try {
        localStorage.setItem(MASTERS_KEY, JSON.stringify(store));
      } catch {}
      return { store, version: cur.version + 1 };
    });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MASTERS_KEY);
      const store = raw ? reviveMasters(JSON.parse(raw)) : null;
      if (store) {
        applyMasters(store);
        setMaster((cur) => ({ store, version: cur.version + 1 }));
      }
    } catch {}
  }, []);

  // Picking a school globally also drives single-location pages, and vice versa.
  const setSchool = (id: string) => {
    setSchoolState(id);
    if (id !== "all") setLocationIdState(id);
    setGrade("All");
  };
  const setLocationId = (id: string) => {
    setLocationIdState(id);
    setSchoolState((s) => (s === "all" ? s : id));
  };

  // Keep the demo role across page reloads.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("demo-role") as RoleId | null;
      if (saved && saved in ROLE_HOME) setRole(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRole = (r: RoleId) => {
    try {
      sessionStorage.setItem("demo-role", r);
    } catch {}
    setRoleState(r);
    const home = ROLE_HOME[r];
    if (home.locationId) setLocationIdState(home.locationId);
    setSchoolState(home.locationId ?? "all");
    setVertical(home.vertical ?? "All");
    setBoard("All");
    setGrade("All");
  };

  const value = useMemo<AppState>(() => {
    const home = ROLE_HOME[role];
    const scope = ROLES.find((x) => x.id === role)!.scope;
    // Inactive locations drop out of every picker; a Location Head always keeps their own school.
    const pool = LOCATIONS.length ? LOCATIONS : allLocations();
    const inVertical = pool.filter((l) => l.vertical === home.vertical);
    const allowedLocations =
      scope === "location"
        ? [locationById(home.locationId!)]
        : scope === "vertical"
          ? inVertical.length ? inVertical : allLocations().filter((l) => l.vertical === home.vertical)
          : [...pool];
    const effectiveSchool = school !== "all" && allowedLocations.some((l) => l.id === school) ? school : "all";
    const filteredLocations = allowedLocations.filter(
      (l) =>
        (effectiveSchool === "all" || l.id === effectiveSchool) &&
        (vertical === "All" || l.vertical === vertical) &&
        (board === "All" || l.board === board),
    );
    return {
      role, setRole, userName: home.user,
      vertical, setVertical, board, setBoard, cycle, setCycle,
      locationId: allowedLocations.some((l) => l.id === locationId) ? locationId : allowedLocations[0].id,
      setLocationId,
      school: effectiveSchool, setSchool,
      grade, setGrade, sourceGroup, setSourceGroup, dateRange, setDateRange, customRange, setCustomRange,
      allowedLocations, filteredLocations,
      seatStore: seat.store, setSeatStore, seatVersion: seat.version + master.version,
      masters: master.store, setMasters,
      lockedVertical: scope === "location" || scope === "vertical",
      lockedLocation: scope === "location",
      can: (p) => can(role, p),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, vertical, board, cycle, locationId, school, grade, sourceGroup, dateRange, customRange, seat, master]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
