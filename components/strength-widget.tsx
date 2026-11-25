"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "@/lib/context";
import { DATA_TODAY, locationUnits, pct, strengthMovement, type Location } from "@/lib/data";
import { drillHref } from "@/lib/drilldown";
import { Panel } from "./dashboard-widgets";
import { fmt } from "./ui";

/**
 * Current strength = students continuing from last year + new admissions (FABS) − withdrawals, as of today.
 * Capacity = total intake from the Seat Matrix (continuing + seats for new admission).
 */
interface Row {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  strength: number;
  capacity: number;
  opening: number;
  newAdm: number;
  withdrawn: number;
  lastYear: number | null;
}

const utilTone = (u: number) => (u >= 90 ? "bg-emerald-500" : u >= 80 ? "bg-amber-400" : "bg-rose-500");
const utilText = (u: number) => (u >= 90 ? "text-emerald-700" : u >= 80 ? "text-amber-700" : "text-rose-600");
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const asOf = DATA_TODAY.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function schoolRow(l: Location, cycle: Parameters<typeof locationUnits>[1], grade: string): Row {
  const units = locationUnits(l.id, cycle).filter((u) => grade === "All" || u.unit === grade);
  const sum = (f: (u: (typeof units)[number]) => number) => units.reduce((s, u) => s + f(u), 0);
  const opening = sum((u) => u.continuing);
  const newAdm = sum((u) => u.enrolled);
  const withdrawn = sum((u) => u.withdrawnNew + u.withdrawnExisting);
  // Last year's figure is only kept per school, not per grade.
  const lastYear = grade === "All" ? (strengthMovement([l.id], cycle).at(-1)?.closingLY ?? null) : null;
  return {
    key: l.id, label: l.short, sub: `${l.vertical === "Schools" ? l.board : l.vertical} · ${l.city}`,
    href: drillHref({ vertical: l.vertical, loc: l.id, grade: grade !== "All" ? grade : undefined }),
    strength: opening + newAdm - withdrawn, capacity: sum((u) => u.intake), opening, newAdm, withdrawn, lastYear,
  };
}

function gradeRows(l: Location, cycle: Parameters<typeof locationUnits>[1], grade: string): Row[] {
  return locationUnits(l.id, cycle)
    .filter((u) => grade === "All" || u.unit === grade)
    .map((u) => ({
      key: u.unit, label: u.unit.replace(" – Y1", ""),
      href: drillHref({ vertical: l.vertical, loc: l.id, grade: u.unit }),
      strength: u.continuing + u.enrolled - u.withdrawnNew - u.withdrawnExisting,
      capacity: u.intake, opening: u.continuing, newAdm: u.enrolled, withdrawn: u.withdrawnNew + u.withdrawnExisting, lastYear: null,
    }));
}

export function SchoolStrength() {
  const { filteredLocations, cycle, grade, seatVersion } = useApp();
  const single = filteredLocations.length === 1 ? filteredLocations[0] : null;
  const ids = filteredLocations.map((l) => l.id).join();

  const rows = useMemo(
    () => (single ? gradeRows(single, cycle, grade) : filteredLocations.map((l) => schoolRow(l, cycle, grade))),
    [ids, cycle, grade, seatVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Schools by strength, largest first; a single school's grades read best in grade order.
  const sorted = useMemo(() => (single ? rows : [...rows].sort((a, b) => b.strength - a.strength)), [rows, single]);

  const tot = rows.reduce(
    (a, r) => ({ strength: a.strength + r.strength, capacity: a.capacity + r.capacity, opening: a.opening + r.opening, newAdm: a.newAdm + r.newAdm, withdrawn: a.withdrawn + r.withdrawn }),
    { strength: 0, capacity: 0, opening: 0, newAdm: 0, withdrawn: 0 },
  );
  const lyRows = rows.filter((r) => r.lastYear !== null);
  // Last year is kept per school, so a single school's grade view uses the school's own figure.
  const lastYear = single
    ? grade === "All" ? (strengthMovement([single.id], cycle).at(-1)?.closingLY ?? null) : null
    : lyRows.length === rows.length && rows.length ? lyRows.reduce((s, r) => s + (r.lastYear ?? 0), 0) : null;
  const vsLY = lastYear ? ((tot.strength - lastYear) / lastYear) * 100 : null;
  const util = pct(tot.strength, tot.capacity);
  const maxCap = Math.max(1, ...rows.map((r) => Math.max(r.capacity, r.strength)));
  const unitWord = single?.vertical === "Higher Ed" ? "Programme" : "Grade";
  const title = single ? `Current strength — ${single.short}` : "Current strength by school";

  return (
    <Panel
      title={title}
      sub={`FABS roster as of ${asOf} · ${single ? `by ${unitWord.toLowerCase()}` : "continuing + new admissions − withdrawals"}${grade !== "All" ? ` · ${grade.replace(" – Y1", "")}` : ""}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/strength" className="hidden whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 sm:inline-flex">
            Movement →
          </Link>
        </div>
      }
    >
      {/* Totals */}
      <div className="mb-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Current strength" icon>
          <span className="text-xl font-bold tracking-tight text-slate-900 tabular">{fmt(tot.strength)}</span>
          {vsLY !== null && (
            <span className={clsx("ml-1.5 inline-flex items-center text-xs font-semibold", vsLY >= 0 ? "text-emerald-600" : "text-rose-600")} title={`Last year: ${fmt(lastYear!)}`}>
              {vsLY >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(vsLY).toFixed(1)}% vs LY
            </span>
          )}
        </Stat>
        <Stat label="Capacity (total intake)">
          <span className="text-base font-semibold text-slate-900 tabular">{fmt(tot.capacity)}</span>
          <span className={clsx("ml-1.5 text-xs font-semibold tabular", utilText(util))}>{util.toFixed(0)}% utilised</span>
        </Stat>
        <Stat label="Net change since 1 Apr">
          <span className={clsx("text-base font-semibold tabular", tot.strength - tot.opening >= 0 ? "text-emerald-700" : "text-rose-600")}>{signed(tot.strength - tot.opening)}</span>
          <span className="ml-1.5 text-xs text-slate-500 tabular">from {fmt(tot.opening)}</span>
        </Stat>
        <Stat label="Joined · left">
          <span className="text-base font-semibold text-emerald-700 tabular">+{fmt(tot.newAdm)}</span>
          <span className="mx-1 text-slate-300">·</span>
          <span className="text-base font-semibold text-rose-600 tabular">−{fmt(tot.withdrawn)}</span>
        </Stat>
      </div>

      {/* Rows: capped height, scrolls inside with the header pinned */}
      <div className="max-h-[248px] overflow-auto scroll-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="sticky top-0 z-[1] whitespace-nowrap bg-white text-[11px] uppercase tracking-wide text-slate-500 shadow-[inset_0_-1px_0_#e2e8f0]">
              <th className="py-1.5 pr-3 text-left font-medium">{single ? unitWord : "School"}</th>
              <th className="px-3 py-1.5 text-left font-medium">Strength vs capacity</th>
              <th className="px-3 py-1.5 text-right font-medium">Strength</th>
              <th className="px-3 py-1.5 text-right font-medium">Capacity</th>
              <th className="px-3 py-1.5 text-right font-medium" title="Current strength ÷ total intake">Utilised</th>
              <th className="py-1.5 pl-3 text-right font-medium" title="Since 1 April: new admissions − withdrawals">Net change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r) => {
              const u = pct(r.strength, r.capacity);
              const change = r.strength - r.opening;
              return (
                <tr key={r.key} className="group whitespace-nowrap hover:bg-slate-50/70" title={r.sub}>
                  <td className="py-1.5 pr-3">
                    {r.href ? (
                      <Link href={r.href} className="font-medium text-slate-800 hover:text-brand-700 hover:underline" title="Open in Drill-down">{r.label}</Link>
                    ) : (
                      <span className="font-medium text-slate-800">{r.label}</span>
                    )}
                    {r.sub && <span className="ml-1.5 hidden text-[11px] text-slate-400 2xl:inline">{r.sub}</span>}
                  </td>
                  <td className="w-[34%] px-3 py-1.5">
                    <div
                      className="relative h-2.5 rounded-full bg-slate-100"
                      title={`${fmt(r.strength)} of ${fmt(r.capacity)} · ${fmt(r.opening)} continuing + ${fmt(r.newAdm)} new − ${fmt(r.withdrawn)} withdrawn`}
                    >
                      {/* capacity outline, then strength fill on the same scale */}
                      <div className="absolute inset-y-0 left-0 rounded-full border border-slate-300 bg-white" style={{ width: `${(r.capacity / maxCap) * 100}%` }} />
                      <div className={clsx("absolute inset-y-0 left-0 rounded-full", r.capacity ? utilTone(u) : "bg-slate-300")} style={{ width: `${(Math.min(r.strength, r.capacity || r.strength) / maxCap) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-900 tabular">{fmt(r.strength)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 tabular">{r.capacity ? fmt(r.capacity) : "—"}</td>
                  <td className={clsx("px-3 py-1.5 text-right text-xs font-semibold tabular", r.capacity ? utilText(u) : "text-slate-400")}>{r.capacity ? `${u.toFixed(0)}%` : "—"}</td>
                  <td className={clsx("py-1.5 pl-3 text-right text-xs font-medium tabular", change > 0 ? "text-emerald-700" : change < 0 ? "text-rose-600" : "text-slate-400")}>{signed(change)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-500">No students for the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full border border-slate-300 bg-white" /> Capacity</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-emerald-500" /> 90%+ utilised</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-400" /> 80–90%</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-rose-500" /> below 80%</span>
        {rows.length > 6 && <span className="ml-auto">{rows.length} {single ? unitWord.toLowerCase() + "s" : "schools"} · scroll for more</span>}
        {!single && rows.length <= 6 && <span className="ml-auto">Click a school to drill down</span>}
      </div>
    </Panel>
  );
}

function Stat({ label, icon, children }: { label: string; icon?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        {icon && <Users size={12} className="text-brand-600" />}
        {label}
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline">{children}</div>
    </div>
  );
}
