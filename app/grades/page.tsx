"use client";

import clsx from "clsx";
import { AlertTriangle, Armchair, DoorOpen, GraduationCap, Pencil, Percent, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Heatmap, HeatList, type HeatRow } from "@/components/charts";
import { GradeVacancy, Panel, SnapshotCard, fillColor } from "@/components/dashboard-widgets";
import { ExportButtons } from "@/components/export-buttons";
import { TargetsEditor } from "@/components/targets-editor";
import { Button, Guard, PageHeader, ProgressBar, fmt, fmtPct } from "@/components/ui";
import { useApp } from "@/lib/context";
import { dashboardData } from "@/lib/dashboard";
import { locationById, locationUnits, pct, schoolGrades } from "@/lib/data";

export default function GradesPage() {
  return (
    <Guard perm="view.location">
      <Grades />
    </Guard>
  );
}

/** Below these, a grade needs attention. */
const FILL_WARN = 75;
const ACH_WARN = 80;

type Sort = "order" | "fill" | "target";
const SORTS: { id: Sort; label: string }[] = [
  { id: "order", label: "Grade order" },
  { id: "fill", label: "Lowest seat fill" },
  { id: "target", label: "Furthest behind target" },
];

interface GradeRow {
  unit: string;
  seats: number;
  net: number; // FABS enrolled − new-admission withdrawals
  applications: number;
  target: number;
  enrolled: number; // FABS enrolled (what targets are measured on)
}

const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(-n)}`);
const achTone = (a: number) => (a >= 95 ? "bg-emerald-500" : a >= ACH_WARN ? "bg-amber-400" : "bg-rose-500");

function Grades() {
  const { filteredLocations, cycle, seatVersion, can } = useApp();
  const [editTargets, setEditTargets] = useState(false);
  const ids = filteredLocations.map((l) => l.id);
  const d = useMemo(() => dashboardData({ ids, cycle, grade: "All", sourceGroup: "All", dateRange: "cycle" }), [ids.join(), cycle, seatVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const isSchools = d.gradeVertical === "Schools";
  const label = isSchools ? "Grade" : "Programme";
  const [picked, setSel] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("order");

  // One row per grade / programme across the selected locations of that vertical.
  const rows = useMemo(() => {
    const map = new Map<string, GradeRow>();
    for (const id of ids) {
      if (locationById(id).vertical !== d.gradeVertical) continue;
      for (const u of locationUnits(id, cycle)) {
        const key = u.unit.replace(" – Y1", "");
        const r = map.get(key) ?? { unit: key, seats: 0, net: 0, applications: 0, target: 0, enrolled: 0 };
        r.seats += u.seats;
        r.net += u.enrolled - u.withdrawnNew;
        r.applications += u.registered;
        r.target += u.target;
        r.enrolled += u.enrolled;
        map.set(key, r);
      }
    }
    return [...map.values()];
  }, [ids.join(), cycle, d.gradeVertical, seatVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop a highlight that no longer exists (e.g. after switching vertical).
  const sel = picked && rows.some((r) => r.unit === picked) ? picked : null;
  const tot = rows.reduce(
    (a, r) => ({ seats: a.seats + r.seats, net: a.net + r.net, applications: a.applications + r.applications, target: a.target + r.target, enrolled: a.enrolled + r.enrolled, vacancy: a.vacancy + Math.max(0, r.seats - r.net) }),
    { seats: 0, net: 0, applications: 0, target: 0, enrolled: 0, vacancy: 0 },
  );
  const fill = pct(tot.net, tot.seats);
  const ach = pct(tot.enrolled, tot.target);
  const lowFill = rows.filter((r) => r.seats && pct(r.net, r.seats) < FILL_WARN);
  const behind = rows.filter((r) => r.target && pct(r.enrolled, r.target) < ACH_WARN);

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sort === "fill") list.sort((a, b) => pct(a.net, a.seats) - pct(b.net, b.seats));
    if (sort === "target") list.sort((a, b) => a.enrolled - a.target - (b.enrolled - b.target));
    return list;
  }, [rows, sort]);

  const heatLocs = filteredLocations.filter((l) => l.vertical === d.gradeVertical);
  const heatRows: HeatRow[] = heatLocs.map((l) => ({
    id: l.id,
    label: l.short,
    cells: locationUnits(l.id, cycle).map((u) => ({ col: u.unit.replace(" – Y1", ""), net: u.enrolled - u.withdrawnNew, seats: u.seats })),
  }));

  const scopeName =
    filteredLocations.length === 1 ? filteredLocations[0].name : `${heatLocs.length} ${isSchools ? "schools" : "campuses"}`;
  const toggle = (unit: string) => setSel((s) => (s === unit ? null : unit));
  const th = "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500";
  const td = "whitespace-nowrap px-3 py-2 text-right tabular";
  const group = "px-3 pb-1 pt-2 text-left text-[10px] font-semibold uppercase tracking-wider";

  return (
    <>
      <PageHeader
        title="Grade-wise Reports"
        subtitle={
          <>
            <b className="font-semibold text-slate-700">{scopeName}</b> · seats, admissions, vacancies and targets by {label.toLowerCase()}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {can("targets.edit") && heatLocs.length > 0 && (
            <Button size="sm" onClick={() => setEditTargets(true)}><Pencil size={13} /> Edit targets</Button>
          )}
          <ExportButtons
            name={`grade-wise-${cycle}`}
            rows={() =>
              rows.map((r) => ({
                [label]: r.unit,
                "Seats for new admission": r.seats,
                "Admitted (net)": r.net,
                Vacancy: Math.max(0, r.seats - r.net),
                "Seat fill %": pct(r.net, r.seats).toFixed(1),
                Applications: r.applications,
                Target: r.target,
                "FABS enrolled": r.enrolled,
                "Gap to target": r.enrolled - r.target,
                "Achievement %": pct(r.enrolled, r.target).toFixed(1),
              }))
            }
          />
          </div>
        }
      />
      {editTargets && <TargetsEditor locations={heatLocs} initialId={heatLocs.length === 1 ? heatLocs[0].id : undefined} onClose={() => setEditTargets(false)} />}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <SnapshotCard theme="blue" icon={Armchair} label="Seats for new admission" value={tot.seats} change={null} sub={`Across ${rows.length} ${label.toLowerCase()}s`} />
        <SnapshotCard theme="violet" icon={GraduationCap} label="Admitted (net)" value={tot.net} change={null} sub="FABS enrolled − withdrawals" />
        <SnapshotCard theme={fill >= 82 ? "green" : fill >= 72 ? "orange" : "rose"} icon={Percent} label="Seat fill" value={fmtPct(fill)} change={null} sub="vs 82% trajectory" />
        <SnapshotCard theme="orange" icon={DoorOpen} label="Vacancies" value={tot.vacancy} change={null} sub={lowFill.length ? `${lowFill.length} ${label.toLowerCase()}${lowFill.length === 1 ? "" : "s"} below ${FILL_WARN}% fill` : `Every ${label.toLowerCase()} ${FILL_WARN}%+ filled`} />
        <SnapshotCard theme={ach >= 95 ? "green" : ach >= ACH_WARN ? "orange" : "rose"} icon={Target} label="Target achievement" value={fmtPct(ach, 0)} change={null} sub={`${fmt(tot.enrolled)} enrolled of ${fmt(tot.target)} target`} />
        <SnapshotCard theme={behind.length ? "rose" : "teal"} icon={AlertTriangle} label="Behind target" value={behind.length} change={null} sub={behind.length ? `Below ${ACH_WARN}%: ${behind.slice(0, 3).map((r) => r.unit).join(", ")}${behind.length > 3 ? "…" : ""}` : `All at ${ACH_WARN}%+ of target`} />
      </div>

      <GradeVacancy d={{ ...d, selectedGrade: sel }} layout="chart" onGrade={toggle} />

      <Panel
        className="mt-4"
        title={`${label}-wise detail`}
        sub={sel ? `${label} ${sel} highlighted — click again to clear` : `Click a bar or row to highlight a ${label.toLowerCase()}`}
        bodyClass="px-0 pb-0 pt-2"
        actions={
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="tablist" aria-label="Sort rows">
            {SORTS.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={sort === s.id}
                onClick={() => setSort(s.id)}
                className={clsx("whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition", sort === s.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[980px] text-sm">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2} className={clsx(th, "border-b border-slate-200 bg-slate-50 text-left align-bottom")}>{label}</th>
                <th colSpan={4} className={clsx(group, "border-l border-slate-200 bg-sky-50/70 text-sky-700")}>Seats &amp; vacancy</th>
                <th colSpan={5} className={clsx(group, "border-l border-slate-200 bg-violet-50/70 text-violet-700")}>Admission targets</th>
              </tr>
              <tr className="border-b border-slate-200">
                <th className={clsx(th, "border-l border-slate-200 bg-sky-50/40 text-right")}>Seats</th>
                <th className={clsx(th, "bg-sky-50/40 text-right")} title="FABS enrolled − new-admission withdrawals">Admitted (net)</th>
                <th className={clsx(th, "bg-sky-50/40 text-right")}>Vacancy</th>
                <th className={clsx(th, "bg-sky-50/40 text-left")}>Seat fill</th>
                <th className={clsx(th, "border-l border-slate-200 bg-violet-50/40 text-right")}>Applications</th>
                <th className={clsx(th, "bg-violet-50/40 text-right")}>Target</th>
                <th className={clsx(th, "bg-violet-50/40 text-right")} title="Fee paid, admission number generated">FABS enrolled</th>
                <th className={clsx(th, "bg-violet-50/40 text-right")}>Gap</th>
                <th className={clsx(th, "bg-violet-50/40 text-left")}>Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => {
                const f = pct(r.net, r.seats);
                const vac = Math.max(0, r.seats - r.net);
                const over = r.net - r.seats;
                const a = pct(r.enrolled, r.target);
                const gap = r.enrolled - r.target;
                const flagged = (r.seats > 0 && f < FILL_WARN) || (r.target > 0 && a < ACH_WARN);
                return (
                  <tr
                    key={r.unit}
                    onClick={() => toggle(r.unit)}
                    className={clsx(
                      "cursor-pointer transition-colors",
                      sel === r.unit ? "bg-brand-50" : sel ? "opacity-50 hover:opacity-80" : "hover:bg-slate-50",
                    )}
                  >
                    <td className={clsx("whitespace-nowrap border-l-2 px-3 py-2 font-medium text-slate-800", sel === r.unit ? "border-l-brand-500" : flagged ? "border-l-rose-300" : "border-l-transparent")}>
                      {r.unit}
                    </td>
                    <td className={clsx(td, "border-l border-slate-100 text-slate-600")}>{fmt(r.seats)}</td>
                    <td className={clsx(td, "font-semibold text-slate-900")}>{fmt(r.net)}</td>
                    <td className={clsx(td, vac ? "font-medium text-amber-700" : "text-slate-300")}>{fmt(vac)}</td>
                    <td className="px-3 py-2">
                      {r.seats ? (
                        <div className="flex items-center gap-2" title={over > 0 ? `${over} admitted over seats` : undefined}>
                          <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(f, 100)}%`, background: fillColor(f) }} />
                          </div>
                          <span className={clsx("w-10 shrink-0 text-right text-[13px] tabular", f > 100 ? "font-semibold text-violet-700" : f < FILL_WARN ? "font-semibold text-rose-600" : "text-slate-700")}>{f.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className={clsx(td, "border-l border-slate-100 text-slate-500")}>{fmt(r.applications)}</td>
                    <td className={clsx(td, "text-slate-600")}>{fmt(r.target)}</td>
                    <td className={clsx(td, "font-semibold text-slate-900")}>{fmt(r.enrolled)}</td>
                    <td className={clsx(td, "font-medium", gap >= 0 ? "text-emerald-700" : "text-rose-600")}>{signed(gap)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-[48px] flex-1"><ProgressBar value={Math.min(a, 100)} tone={achTone(a)} /></div>
                        <span className={clsx("w-10 shrink-0 text-right text-[13px] tabular", a < ACH_WARN ? "font-semibold text-rose-600" : "text-slate-700")}>{a.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-3 py-2.5">Total</td>
                <td className={clsx(td, "border-l border-slate-200 py-2.5")}>{fmt(tot.seats)}</td>
                <td className={clsx(td, "py-2.5")}>{fmt(tot.net)}</td>
                <td className={clsx(td, "py-2.5 text-amber-700")}>{fmt(tot.vacancy)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(fill, 100)}%`, background: fillColor(fill) }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[13px] tabular">{fill.toFixed(0)}%</span>
                  </div>
                </td>
                <td className={clsx(td, "border-l border-slate-200 py-2.5")}>{fmt(tot.applications)}</td>
                <td className={clsx(td, "py-2.5")}>{fmt(tot.target)}</td>
                <td className={clsx(td, "py-2.5")}>{fmt(tot.enrolled)}</td>
                <td className={clsx(td, "py-2.5", tot.enrolled >= tot.target ? "text-emerald-700" : "text-rose-600")}>{signed(tot.enrolled - tot.target)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-[48px] flex-1"><ProgressBar value={Math.min(ach, 100)} tone={achTone(ach)} /></div>
                    <span className="w-10 shrink-0 text-right text-[13px] tabular">{ach.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
          <span>
            Seat fill uses net admissions (after withdrawals); target achievement uses FABS enrolled against the targets entered here or in Seat Matrix &amp; Targets.
          </span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded-sm bg-rose-300" /> Below {FILL_WARN}% fill or {ACH_WARN}% of target</span>
        </div>
      </Panel>

      {heatRows.length > 1 && (
        <Panel className="mt-4" title={`Seat fill by ${isSchools ? "school" : "campus"} and ${label.toLowerCase()}`} sub="Net FABS admissions ÷ seats for new admission">
          {isSchools ? <Heatmap rows={heatRows} cols={schoolGrades()} footerLabel="All schools" /> : <HeatList rows={heatRows} />}
        </Panel>
      )}
    </>
  );
}
