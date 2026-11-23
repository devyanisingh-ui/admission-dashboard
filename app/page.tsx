"use client";
import clsx from "clsx";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FunnelWide, HeatList, Heatmap, type HeatRow } from "@/components/charts";
import {
  DownloadReportsPanel, GradeVacancy, LeadTrend, QuickInsights, SnapshotCards, SourcePerformance,
} from "@/components/dashboard-widgets";
import { ExportButtons } from "@/components/export-buttons";
import { SchoolStrength } from "@/components/strength-widget";
import { WeeklySnapshots } from "@/components/weekly-snapshots";
import { Badge, Card, Guard, Note, Rag, fmt, fmtPct } from "@/components/ui";
import { rangeLabelOf, useApp } from "@/lib/context";
import { dashboardData } from "@/lib/dashboard";
import { kpis, locationById, locationUnits, schoolGrades, sumStats } from "@/lib/data";
import { drillHref } from "@/lib/drilldown";

export default function DashboardPage() {
  const { can } = useApp();
  const router = useRouter();
  // IT administrators have no dashboard access; send them to Administration.
  useEffect(() => {
    if (!can("view.location")) router.replace("/admin");
  }, [can, router]);
  return (
    <Guard perm="view.location">
      <Dashboard />
    </Guard>
  );
}

function Dashboard() {
  const app = useApp();
  const router = useRouter();
  const { filteredLocations, cycle, grade, sourceGroup, dateRange, customRange: custom, can } = app;
  const ids = filteredLocations.map((l) => l.id);
  const key = [ids.join(), cycle, grade, sourceGroup, dateRange, custom.start, custom.end, app.seatVersion].join("|");
  const d = useMemo(() => dashboardData({ ids, cycle, grade, sourceGroup, dateRange, custom }), [key]);
  const showGroup = can("view.group") && filteredLocations.length > 1;

  // Deep links into the Drill-down at the matching level.
  const single = filteredLocations.length === 1 ? filteredLocations[0] : null;
  const rawUnit = (label: string) =>
    filteredLocations.flatMap((l) => l.units).find((u) => u.replace(" – Y1", "") === label) ?? label;
  const openGrade = (label: string) => {
    const g = rawUnit(label);
    router.push(single ? drillHref({ vertical: single.vertical, loc: single.id, grade: g }) : drillHref({ vertical: d.gradeVertical, grade: g }));
  };
  const scopeHref = drillHref(
    single
      ? { vertical: single.vertical, loc: single.id, grade: grade !== "All" ? grade : undefined }
      : { vertical: app.vertical !== "All" ? app.vertical : undefined, grade: app.vertical !== "All" && grade !== "All" ? grade : undefined },
  );

  if (!filteredLocations.length) return <Note>No schools match the current filters.</Note>;

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-900">Admissions snapshot</h2>
            <span className="text-xs text-slate-500">
              {filteredLocations.length === 1 ? filteredLocations[0].name : `${filteredLocations.length} ${app.vertical === "Higher Ed" ? "institutions" : app.vertical === "Schools" ? "schools" : "schools & institutions"}`}
              {grade !== "All" && ` · ${grade.replace(" – Y1", "")}`}
              {sourceGroup !== "All" && ` · ${sourceGroup} leads`}
              {` · ${d.rangeMonths}`}
              {d.prev ? " · change vs same period last year" : ""}
            </span>
          </div>
          <SnapshotCards d={d} />

          <QuickInsights d={d} />

          <GradeVacancy d={d} onGrade={openGrade} />

          <WeeklySnapshots />

          <SchoolStrength />

          <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 2xl:grid-cols-2">
            <SourcePerformance d={d} />
            <LeadTrend d={d} />
          </div>
        </div>

        {/* Natural height, pinned while scrolling (capped at the window height on wide screens). */}
        <div className="relative">
          <div className="xl:sticky xl:top-20">
            <DownloadReportsPanel ids={ids} grades={d.grades.map((g) => g.unit)} />
          </div>
        </div>
      </div>

      <Card
        className="mt-5"
        title="End-to-end admissions funnel"
        actions={
          <Link href={scopeHref} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
            Drill down →
          </Link>
        }
        subtitle={`LeadSquared → SaaS → FABS · de-duplicated · ${[grade !== "All" ? grade.replace(" – Y1", "") : app.vertical === "Higher Ed" ? "all programmes" : "all grades", sourceGroup !== "All" ? `${sourceGroup} leads` : "all sources", d.rangeMonths].join(" · ")}`}
      >
        <FunnelWide
          t={d.funnel}
          stageHref={single && grade !== "All" ? (k) => drillHref({ vertical: single.vertical, loc: single.id, grade, stage: k }) : undefined}
        />
      </Card>

      {showGroup && <GroupSection />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Group / vertical comparison (group roles, more than one school)     */
/* ------------------------------------------------------------------ */

type SortKey = "leads" | "applications" | "enrolled" | "targetAch" | "seatFill" | "overall" | "withdrawals" | "unmapped";
const SORT_COLS: { key: SortKey; label: string; lowerIsBetter?: boolean }[] = [
  { key: "leads", label: "Leads" },
  { key: "applications", label: "Applications" },
  { key: "enrolled", label: "Enrolled" },
  { key: "targetAch", label: "Target ach." },
  { key: "seatFill", label: "Seat fill" },
  { key: "overall", label: "Conv." },
  { key: "withdrawals", label: "Withdrawals", lowerIsBetter: true },
  { key: "unmapped", label: "Unmapped", lowerIsBetter: true },
];

function GroupSection() {
  const { filteredLocations, cycle, vertical, grade, sourceGroup, dateRange, customRange } = useApp();
  const router = useRouter();
  const [heat, setHeat] = useState<"Schools" | "Higher Ed">(vertical === "Higher Ed" ? "Higher Ed" : "Schools");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "seatFill", desc: true });

  const rows = useMemo(
    () =>
      filteredLocations.filter((l) => grade === "All" || l.units.includes(grade)).map((l) => {
        // Leads, applications and admissions follow Grade, Lead source and Date range (as the cards above);
        // seats, targets and withdrawals are roster figures, so only Grade narrows them.
        const units = locationUnits(l.id, cycle).filter((u) => grade === "All" || u.unit === grade);
        const base = kpis(sumStats(units));
        const dd = dashboardData({ ids: [l.id], cycle, grade, sourceGroup, dateRange, custom: customRange });
        const k = {
          ...base,
          leads: dd.cur.leads, applications: dd.cur.applications, enrolled: dd.cur.admissions,
          overall: base.leads ? (dd.cur.admissions / Math.max(1, dd.cur.leads)) * 100 : 0,
        };
        return {
          loc: l, k,
          v: {
            leads: k.leads, applications: k.applications, enrolled: k.enrolled, targetAch: k.targetAch, seatFill: k.seatFill, overall: k.overall,
            withdrawals: k.withdrawals, unmapped: k.unmapped,
          } as Record<SortKey, number>,
        };
      }),
    [filteredLocations, cycle, grade, sourceGroup, dateRange, customRange],
  );
  const sorted = [...rows].sort((a, b) => (sort.desc ? b.v[sort.key] - a.v[sort.key] : a.v[sort.key] - b.v[sort.key]));
  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !SORT_COLS.find((c) => c.key === key)!.lowerIsBetter }));
  const onTrack = rows.filter((r) => r.k.seatFill >= 82).length;
  const atRisk = rows.filter((r) => r.k.seatFill < 72).length;

  const heatVerticals = (["Schools", "Higher Ed"] as const).filter((v) => filteredLocations.some((l) => l.vertical === v));
  const heatTab = heatVerticals.includes(heat) ? heat : (heatVerticals[0] ?? "Schools");
  // Heatmap cell → that school's grade; row total → the school; column total → the grade across the vertical.
  const openCell = (rowId: string | null, col: string | null) => {
    const loc = rowId ? locationById(rowId) : null;
    const unit = col ? (loc ? loc.units : filteredLocations.flatMap((l) => l.units)).find((u) => u.replace(" – Y1", "") === col) ?? col : undefined;
    router.push(drillHref(loc ? { vertical: loc.vertical, loc: loc.id, grade: unit } : { vertical: heatTab, grade: unit }));
  };
  const heatRows: HeatRow[] = filteredLocations
    .filter((l) => l.vertical === heatTab)
    .map((l) => ({
      id: l.id,
      label: l.short,
      cells: locationUnits(l.id, cycle).filter((u) => grade === "All" || u.unit === grade).map((u) => ({ col: u.unit.replace(" – Y1", ""), net: u.enrolled - u.withdrawnNew, seats: u.seats })),
    }));

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-slate-200 pb-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-900">Group performance</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Rank schools and spot under-filled grades · {filteredLocations.length} {vertical === "Higher Ed" ? "institutions" : "schools"}
            {grade !== "All" && ` · ${grade.replace(" – Y1", "")}`}{sourceGroup !== "All" && ` · ${sourceGroup} leads`}{dateRange !== "cycle" && ` · ${rangeLabelOf(dateRange, customRange, cycle)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700"><Rag value={90} green={82} amber={72} /> {onTrack} on track</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700"><Rag value={75} green={82} amber={72} /> {rows.length - onTrack - atRisk} watch</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700"><Rag value={60} green={82} amber={72} /> {atRisk} at risk</span>
        </div>
      </div>

      <Card
        title="School leaderboard"
        subtitle="Click a column to sort · RAG on seat fill vs 82% trajectory · click a school to open it in the Drill-down"
        bodyClass="p-0"
        actions={
          <ExportButtons
            name={`school-leaderboard-${cycle}`}
            rows={() =>
              sorted.map(({ loc, k, v }, i) => ({
                Rank: i + 1, School: loc.name, Vertical: loc.vertical, Board: loc.board, Leads: k.leads, Applications: k.applications, "FABS enrolled": k.enrolled,
                "Target ach. %": k.targetAch.toFixed(1), "Seat fill %": k.seatFill.toFixed(1), "Conversion %": k.overall.toFixed(1), Withdrawals: k.withdrawals,
                Unmapped: k.unmapped,
              }))
            }
          />
        }
      >
        <div className="max-h-[420px] overflow-auto scroll-thin">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_var(--color-slate-200)]">
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="w-10 px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">School</th>
                {SORT_COLS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-medium">
                    <button
                      onClick={() => setSortKey(c.key)}
                      className={clsx("inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800", sort.key === c.key && "text-brand-700")}
                      aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}
                    >
                      {c.label}
                      <span className={clsx("text-[9px]", sort.key === c.key ? "opacity-100" : "opacity-30")}>{sort.key === c.key && !sort.desc ? "▲" : "▼"}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(({ loc, k, v }, i) => (
                <tr key={loc.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Rag value={k.seatFill} green={82} amber={72} />
                      <div className="min-w-0">
                        <LocLink id={loc.id}><span className="font-medium text-brand-700">{loc.short}</span></LocLink>
                        <div className="text-[11px] text-slate-400">{loc.vertical} · {loc.board}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(k.leads)}</td>
                  <td className="px-3 py-2 text-right">{fmt(k.applications)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(k.enrolled)}</td>
                  <td className="px-3 py-2"><BarCell value={k.targetAch} good={95} ok={80} /></td>
                  <td className="px-3 py-2"><BarCell value={k.seatFill} good={82} ok={72} /></td>
                  <td className="px-3 py-2 text-right">{fmtPct(k.overall, 1)}</td>
                  <td className="px-3 py-2 text-right">{fmt(k.withdrawals)}</td>
                  <td className="px-3 py-2 text-right">{k.unmapped ? <Badge tone="red">{k.unmapped}</Badge> : <span className="text-slate-400">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-4"
        title="Seat fill heatmap"
        subtitle={heatTab === "Schools" ? "School × grade · net FABS admissions ÷ seats for new admission" : "Each campus's own first-year programmes · net FABS admissions ÷ seats"}
        actions={heatVerticals.length > 1 ? (
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {heatVerticals.map((v) => (
              <button key={v} onClick={() => setHeat(v)} className={clsx("rounded-md px-2.5 py-1 font-medium transition", heatTab === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {v}
              </button>
            ))}
          </div>
        ) : undefined}
      >
        {heatTab === "Schools" ? (
          <Heatmap rows={heatRows} cols={grade === "All" ? schoolGrades() : schoolGrades().filter((g) => g === grade)} footerLabel="All schools" onCell={openCell} />
        ) : (
          <HeatList rows={heatRows} onCell={openCell} />
        )}
      </Card>
    </section>
  );
}

/** Percentage with a small bar, coloured green / amber / red against thresholds. */
function BarCell({ value, good, ok }: { value: number; good: number; ok: number }) {
  return (
    <div className="ml-auto flex w-32 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full", value >= good ? "bg-emerald-500" : value >= ok ? "bg-amber-400" : "bg-rose-500")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={clsx("w-12 text-right text-sm", value < ok ? "font-semibold text-rose-600" : "text-slate-800")}>{value.toFixed(1)}%</span>
    </div>
  );
}

function LocLink({ id, children }: { id: string; children: React.ReactNode }) {
  const { setLocationId } = useApp();
  return (
    <Link href={drillHref({ vertical: locationById(id).vertical, loc: id })} onClick={() => setLocationId(id)} className="hover:underline" title="Open in Drill-down">
      {children}
    </Link>
  );
}
