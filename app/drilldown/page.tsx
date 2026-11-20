"use client";

import clsx from "clsx";
import {
  ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Home, Percent, Search, UserMinus,
  UserRoundSearch, Users, X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SnapshotCard } from "@/components/dashboard-widgets";
import { ExportButtons } from "@/components/export-buttons";
import { Dropdown } from "@/components/dropdown";
import { Badge, Guard, Pii, fmt } from "@/components/ui";
import { rangeLabelOf, useApp } from "@/lib/context";
import { locationById, SOURCE_GROUP_OF, type Vertical } from "@/lib/data";
import {
  childrenOf, FILL_AMBER, FILL_GREEN, levelOf, locationsOf, MEASURES, nodeStats, stageRecords, STAGES, stillAt, unitLabel,
  type ChildRow, type DrillPath, type DrillRecord, type LeadRecord, type Measure, type NodeStats, type Scope, type StageKey,
} from "@/lib/drilldown";

export default function DrilldownPage() {
  // Rendered in the browser only: the drill position lives in the URL and all figures are computed client-side.
  // (Server-streaming this Suspense boundary left it hidden on a direct page load.)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Guard perm="view.location">
      <Suspense fallback={null}>{mounted && <Drilldown />}</Suspense>
    </Guard>
  );
}

const axis = { fontSize: 11, fill: "#64748b" };
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };
const ragColor = (v: number) => (v >= FILL_GREEN ? "#059669" : v >= FILL_AMBER ? "#f59e0b" : "#e11d48");
const pctFmt = (v: number, d = 1) => `${v.toFixed(d)}%`;

/* ------------------------------------------------------------------ */
/* URL state                                                           */
/* ------------------------------------------------------------------ */

function useDrillState() {
  const params = useSearchParams();
  const router = useRouter();
  const app = useApp();

  // The role's own scope is the top of the breadcrumb; nothing above it can be opened.
  const home = app.allowedLocations[0];
  const root: DrillPath = app.lockedLocation ? { vertical: home.vertical, loc: home.id } : app.lockedVertical ? { vertical: home.vertical } : {};

  const raw = {
    vertical: (params.get("v") as Vertical | null) ?? undefined,
    loc: params.get("loc") ?? undefined,
    grade: params.get("g") ?? undefined,
    stage: (params.get("stage") as StageKey | null) ?? undefined,
  };
  // Validate against what the role may see; anything invalid is dropped from that level down.
  const path: DrillPath = { ...root };
  const vOk = (["Schools", "Higher Ed"] as Vertical[]).includes(raw.vertical!) && app.allowedLocations.some((l) => l.vertical === raw.vertical);
  if (!root.vertical && vOk) path.vertical = raw.vertical;
  const loc = app.allowedLocations.find((l) => l.id === raw.loc && (!path.vertical || l.vertical === path.vertical));
  if (!root.loc && loc && path.vertical) path.loc = loc.id;
  if (raw.grade) {
    const pool = path.loc ? [locationById(path.loc)] : locationsOf(path, scopeLite(app.allowedLocations));
    if (pool.some((l) => l.units.includes(raw.grade!))) path.grade = raw.grade;
  }
  if (path.loc && path.grade && STAGES.some((s) => s.key === raw.stage)) path.stage = raw.stage;

  const measure = (MEASURES.find((m) => m.key === params.get("m"))?.key ?? "seatFill") as Measure;
  const asc = params.get("dir") === "asc";
  const still = params.get("still") === "1";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("p")) || 1);
  // Record-table filters and sort (kept in the URL so a filtered list can be shared).
  const counsellor = params.get("c") ?? "";
  const source = params.get("src") ?? "";
  const sort = (["new", "old", "wait"] as const).find((x) => x === params.get("sort")) ?? "new";
  const size = [25, 50, 100].find((n) => n === Number(params.get("n"))) ?? 25;

  const build = (p: DrillPath, extra: Record<string, string | undefined> = {}) => {
    const sp = new URLSearchParams();
    if (p.vertical) sp.set("v", p.vertical);
    if (p.loc) sp.set("loc", p.loc);
    if (p.grade) sp.set("g", p.grade);
    if (p.stage) sp.set("stage", p.stage);
    const keep = { m: measure !== "seatFill" ? measure : undefined, dir: asc ? "asc" : undefined, ...extra };
    for (const [k, v] of Object.entries(keep)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/drilldown${s ? `?${s}` : ""}`;
  };
  /** Moving between levels adds a history entry so Back works; view tweaks replace it. */
  const go = (p: DrillPath) => router.push(build(p), { scroll: false });
  const tweak = (extra: Record<string, string | undefined>) =>
    router.replace(
      build(path, {
        still: still ? "1" : undefined, q: q || undefined, c: counsellor || undefined, src: source || undefined,
        sort: sort !== "new" ? sort : undefined, n: size !== 25 ? String(size) : undefined, ...extra,
      }),
      { scroll: false },
    );

  return { path, root, measure, asc, still, q, page, counsellor, source, sort, size, go, tweak };
}
const scopeLite = (allowed: ReturnType<typeof useApp>["allowedLocations"]) =>
  ({ allowed, cycle: "2026-27", sourceGroup: "All", dateRange: "cycle", custom: { start: "", end: "" } }) as Scope;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Drilldown() {
  const app = useApp();
  const st = useDrillState();
  const { path } = st;
  const lvl = levelOf(path);
  const scope: Scope = { cycle: app.cycle, sourceGroup: app.sourceGroup, dateRange: app.dateRange, custom: app.customRange, allowed: app.allowedLocations };
  const scopeKey = [app.cycle, app.sourceGroup, app.dateRange, app.customRange.start, app.customRange.end, app.allowedLocations.map((l) => l.id).join(), app.seatVersion].join("|");
  const pathKey = [path.vertical, path.loc, path.grade, path.stage].join("|");

  const ids = locationsOf(path, scope).map((l) => l.id);
  const stats = useMemo(() => nodeStats(ids, path.grade, scope), [pathKey, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const children = useMemo(() => (lvl === "group" || lvl === "vertical" || lvl === "school" ? childrenOf(path, scope) : []), [pathKey, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isHE = path.vertical === "Higher Ed" || (path.loc && locationById(path.loc).vertical === "Higher Ed");
  const gradeWord = isHE ? "Programme" : "Grade";
  const range = rangeLabelOf(app.dateRange, app.customRange, app.cycle);

  return (
    <>
      <Breadcrumb
        st={st}
        isHE={!!isHE}
        context={[`Session ${app.cycle.replace("-", " – ")}`, app.sourceGroup === "All" ? "All sources" : `${app.sourceGroup} leads`, range]}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <SnapshotCard theme="blue" icon={Users} label="Leads" value={stats.leads} change={stats.change.leads} sub="Enquiries (LeadSquared)" />
        <SnapshotCard theme="green" icon={ClipboardList} label="Applications" value={stats.applications} change={stats.change.applications} sub="Registrations (SaaS)" />
        <SnapshotCard theme="violet" icon={GraduationCap} label="Admissions" value={stats.admissions} change={stats.change.admissions} sub={`${pctFmt(stats.conversion)} of leads · fee paid (FABS)`} />
        <SnapshotCard theme="teal" icon={Percent} label="Seat fill" value={stats.seats ? pctFmt(stats.seatFill, 0) : "—"} change={null} sub={stats.seats ? `Net admissions ÷ ${fmt(stats.seats)} seats` : "No seats in the Seat Matrix"} />
        <SnapshotCard theme="orange" icon={UserRoundSearch} label="Vacancies" value={stats.vacancies} change={stats.change.vacancies} sub="Seats still open" lowerIsBetter />
        <SnapshotCard theme="rose" icon={UserMinus} label="Withdrawals" value={stats.withdrawals} change={stats.change.withdrawals} sub="New + existing students" lowerIsBetter />
      </div>

      {(lvl === "group" || lvl === "vertical" || lvl === "school") && (
        <ChildrenView rows={children} st={st} level={lvl} gradeWord={gradeWord} />
      )}
      {lvl === "grade" && <StagesView stats={stats} st={st} />}
      {lvl === "stage" && <RecordsView stats={stats} st={st} scope={scope} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Breadcrumb                                                          */
/* ------------------------------------------------------------------ */

const LEVELS = ["Group", "Vertical", "School", "Grade", "Stage", "Records"];

function Breadcrumb({ st, isHE, context }: { st: ReturnType<typeof useDrillState>; isHE: boolean; context: string[] }) {
  const { path, root, go } = st;
  const crumbs: { label: string; sub: string; to: DrillPath; locked: boolean }[] = [];
  if (!root.vertical) crumbs.push({ label: "Apeejay Group", sub: "Group", to: {}, locked: false });
  if (path.vertical) crumbs.push({ label: path.vertical, sub: "Vertical", to: { vertical: path.vertical }, locked: !!root.loc });
  if (path.loc) {
    const l = locationById(path.loc);
    crumbs.push({ label: l.short, sub: l.vertical === "Higher Ed" ? "Institution" : "School", to: { vertical: path.vertical, loc: path.loc }, locked: false });
  }
  if (path.loc && path.grade) {
    crumbs.push({ label: unitLabel(path.grade), sub: path.vertical === "Higher Ed" ? "Programme" : "Grade", to: { vertical: path.vertical, loc: path.loc, grade: path.grade }, locked: false });
  }
  if (path.stage) crumbs.push({ label: STAGES.find((s) => s.key === path.stage)!.label, sub: "Funnel stage", to: path, locked: false });
  // Hide crumbs above the role's scope (a Location Head starts at their school).
  const visible = crumbs.filter((c) => !c.locked);
  const up = visible.length > 1 ? visible[visible.length - 2].to : null;
  // A grade "focus" above school level shows as a removable chip.
  const focus = !path.loc && path.grade;

  // What the next click opens, shown as a hint after the last crumb.
  const lvl = levelOf(path);
  const next =
    lvl === "group" ? "a vertical" : lvl === "vertical" ? (isHE ? "an institution" : "a school") : lvl === "school" ? (isHE ? "a programme" : "a grade") : lvl === "grade" ? "a funnel stage" : null;
  const depth = ["group", "vertical", "school", "grade", "stage"].indexOf(lvl) + (lvl === "stage" ? 1 : 0);
  const levelNames = LEVELS.map((l) => (isHE && l === "School" ? "Institution" : isHE && l === "Grade" ? "Programme" : l));

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-2.5 pt-3">
        <div>
          <h1 className="text-lg font-bold leading-tight text-brand-900">Drill-down</h1>
          <p className="text-xs text-slate-500">Start from the group and click any bar or row to go one level deeper</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {context.map((c) => (
            <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{c}</span>
          ))}
        </div>
      </div>

      <nav aria-label="Drill path" className="no-print flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
        <button
          type="button" disabled={!up} onClick={() => up && go(up)} title="Up one level" aria-label="Up one level"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-35"
        >
          <ChevronLeft size={16} />
        </button>
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          {visible.map((c, i) => {
            const last = i === visible.length - 1;
            return (
              <li key={c.sub} className="flex items-center gap-0.5">
                {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
                <button
                  type="button" disabled={last} onClick={() => go(c.to)} aria-current={last ? "page" : undefined}
                  className={clsx("flex flex-col items-start rounded-lg px-2.5 py-1 text-left transition", last ? "bg-brand-600 text-white" : "hover:bg-slate-100")}
                >
                  <span className={clsx("text-[10px] font-medium uppercase tracking-wide", last ? "text-brand-100" : "text-slate-400")}>{c.sub}</span>
                  <span className={clsx("flex items-center gap-1 text-sm font-semibold", last ? "text-white" : "text-brand-700")}>
                    {i === 0 && !root.vertical && <Home size={13} />}
                    {c.label}
                  </span>
                </button>
              </li>
            );
          })}
          {next && (
            <li className="flex items-center gap-0.5">
              <ChevronRight size={14} className="text-slate-300" />
              <span className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-400">Choose {next} below</span>
            </li>
          )}
          {focus && (
            <li className="ml-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                {path.vertical === "Higher Ed" ? "Programme" : "Grade"} focus: {unitLabel(path.grade!)}
                <button type="button" onClick={() => go({ ...path, grade: undefined })} aria-label="Clear grade focus" className="rounded-full p-0.5 hover:bg-amber-100">
                  <X size={12} />
                </button>
              </span>
            </li>
          )}
        </ol>
        {/* Depth indicator: where this level sits in the six-level path. */}
        <div className="hidden items-center gap-1.5 lg:flex" aria-label={`Level ${depth + 1} of ${LEVELS.length}: ${levelNames[depth]}`}>
          {levelNames.map((l, i) => (
            <span key={l} title={l} className={clsx("h-1.5 rounded-full transition-all", i === depth ? "w-6 bg-brand-600" : i < depth ? "w-3 bg-brand-300" : "w-3 bg-slate-200")} />
          ))}
          <span className="ml-1 text-[11px] text-slate-500">{levelNames[depth]}</span>
        </div>
      </nav>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Group / vertical / school: compare the level below                  */
/* ------------------------------------------------------------------ */

const measureValue = (s: NodeStats, m: Measure) => (m === "seatFill" ? s.seatFill : m === "conversion" ? s.conversion : m === "admissions" ? s.admissions : s.leads);

function ChildrenView({ rows, st, level, gradeWord }: { rows: ChildRow[]; st: ReturnType<typeof useDrillState>; level: "group" | "vertical" | "school"; gradeWord: string }) {
  const { measure, asc, go, tweak } = st;
  const m = MEASURES.find((x) => x.key === measure)!;
  const sorted = [...rows].sort((a, b) => (asc ? 1 : -1) * (measureValue(a.stats, measure) - measureValue(b.stats, measure)));
  const what = level === "group" ? "verticals" : level === "vertical" ? (st.path.vertical === "Higher Ed" ? "institutions" : "schools") : `${gradeWord.toLowerCase()}s`;
  const chartData = sorted.map((r) => ({ name: r.label, value: Number(measureValue(r.stats, measure).toFixed(1)) }));
  const onTrack = rows.filter((r) => r.stats.seatFill >= FILL_GREEN).length;
  const atRisk = rows.filter((r) => r.stats.seatFill < FILL_AMBER).length;

  const setMeasure = (k: Measure) => tweak({ m: k === "seatFill" ? undefined : k, dir: undefined });
  const header = (k: Measure, label: string) => (
    <button
      type="button"
      onClick={() => (k === measure ? tweak({ m: k === "seatFill" ? undefined : k, dir: asc ? undefined : "asc" }) : setMeasure(k))}
      className={clsx("inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800", k === measure && "text-brand-700")}
    >
      {label}
      {k === measure && (asc ? <ArrowUpNarrowWide size={12} /> : <ArrowDownWideNarrow size={12} />)}
    </button>
  );

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-bold capitalize text-brand-900">{what} compared</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {rows.length} {what} · ranked by {m.label.toLowerCase()} · click a bar or row to drill in
            {measure === "seatFill" && <> · <span className="text-emerald-700">{onTrack} on track</span> · <span className="text-rose-600">{atRisk} at risk</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="tablist" aria-label="Measure">
            {MEASURES.map((x) => (
              <button
                key={x.key} type="button" role="tab" aria-selected={measure === x.key} onClick={() => setMeasure(x.key)}
                className={clsx("rounded-md px-2.5 py-1 font-medium transition", measure === x.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {x.label}
              </button>
            ))}
          </div>
          <button
            type="button" onClick={() => tweak({ m: measure === "seatFill" ? undefined : measure, dir: asc ? undefined : "asc" })}
            title={asc ? "Lowest first" : "Highest first"}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {asc ? <ArrowUpNarrowWide size={15} /> : <ArrowDownWideNarrow size={15} />}
          </button>
        </div>
      </header>

      {!rows.length ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">Nothing to show at this level for the current filters.</p>
      ) : (
        <div className="space-y-4 p-4">
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/40 px-3 pb-2 pt-3">
            {measure === "seatFill" && (
              <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <Legend color="#059669" label={`${FILL_GREEN}%+ on track`} />
                <Legend color="#f59e0b" label={`${FILL_AMBER}–${FILL_GREEN}% watch`} />
                <Legend color="#e11d48" label={`Below ${FILL_AMBER}% at risk`} />
              </div>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 22, right: 8, left: -8, bottom: 0 }} barCategoryGap={sorted.length > 8 ? "18%" : "30%"}>
                <CartesianGrid stroke="#e8edf3" vertical={false} />
                <XAxis dataKey="name" tick={{ ...axis, fill: "#334155" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => (m.pct ? `${v}%` : fmt(v))} domain={m.pct ? [0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)] : [0, "auto"]} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#eef2ff" }} formatter={(v: number) => [m.pct ? pctFmt(v) : fmt(v), m.label]} />
                {measure === "seatFill" && (
                  <ReferenceLine y={FILL_GREEN} stroke="#64748b" strokeDasharray="4 4" label={{ value: `${FILL_GREEN}% trajectory`, position: "insideTopRight", fontSize: 10, fill: "#64748b" }} />
                )}
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} cursor="pointer" onClick={(_: unknown, i: number) => go(sorted[i].path)}>
                  <LabelList dataKey="value" position="top" fontSize={11} fill="#334155" formatter={(v: number) => (m.pct ? `${v.toFixed(0)}%` : fmt(v))} />
                  {sorted.map((r) => (
                    <Cell key={r.id} fill={measure === "seatFill" ? ragColor(r.stats.seatFill) : "#2563eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-200 scroll-thin">
            <table className="w-full text-sm tabular">
              <thead className="bg-slate-50 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{level === "group" ? "Vertical" : level === "vertical" ? (st.path.vertical === "Higher Ed" ? "Institution" : "School") : gradeWord}</th>
                  <th className="px-3 py-2 text-right font-medium">{header("leads", "Leads")}</th>
                  <th className="px-3 py-2 text-right font-medium">Apps</th>
                  <th className="px-3 py-2 text-right font-medium">{header("admissions", "Adm.")}</th>
                  <th className="px-3 py-2 text-right font-medium">{header("conversion", "Conv.")}</th>
                  <th className="px-3 py-2 text-right font-medium">{header("seatFill", "Seat fill")}</th>
                  <th className="px-3 py-2 text-right font-medium">Vacant</th>
                  <th className="px-3 py-2 text-right font-medium">Withdr.</th>
                  <th className="px-3 py-2 text-right font-medium" title="Admissions vs same period last year">vs LY</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((r) => {
                  const s = r.stats;
                  const ch = s.change.admissions;
                  return (
                    <tr key={r.id} onClick={() => go(r.path)} className="cursor-pointer hover:bg-brand-50/50" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go(r.path)}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-brand-700">{r.label}</div>
                        {r.sub && <div className="text-[11px] text-slate-400">{r.sub}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(s.leads)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(s.applications)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(s.admissions)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{pctFmt(s.conversion)}</td>
                      <td className="px-3 py-2">
                        <div className="ml-auto flex w-28 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.seatFill)}%`, background: ragColor(s.seatFill) }} />
                          </div>
                          <span className={clsx("w-10 text-right", s.seatFill < FILL_AMBER ? "font-semibold text-rose-600" : "text-slate-800")}>{s.seats ? pctFmt(s.seatFill, 0) : "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700">{fmt(s.vacancies)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(s.withdrawals)}</td>
                      <td className={clsx("px-3 py-2 text-right text-xs font-semibold", ch === null ? "text-slate-300" : ch >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {ch === null ? "—" : `${ch >= 0 ? "↑" : "↓"}${Math.abs(ch).toFixed(0)}%`}
                      </td>
                      <td className="pr-2 text-slate-300"><ChevronRight size={15} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Grade: the six funnel stages                                        */
/* ------------------------------------------------------------------ */

const STAGE_COLORS = ["#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#4f46e5", "#059669"];

function StagesView({ stats, st }: { stats: NodeStats; st: ReturnType<typeof useDrillState> }) {
  const f = stats.funnel;
  const top = f.leads || 1;
  const rows = STAGES.map((s, i) => ({
    ...s,
    reached: f[s.key],
    still: stillAt(f, stats.matched, s.key),
    share: (f[s.key] / top) * 100,
    step: i ? (f[STAGES[i - 1].key] ? (f[s.key] / f[STAGES[i - 1].key]) * 100 : 0) : 100,
    color: STAGE_COLORS[i],
  }));
  const steps = rows.slice(1).map((r) => 100 - r.step);
  const worst = steps.indexOf(Math.max(...steps)) + 1;
  const open = (k: StageKey) => st.go({ ...st.path, stage: k });

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-brand-900">Funnel stages</h2>
          <p className="mt-0.5 text-xs text-slate-500">LeadSquared → SaaS → FABS · each stage counts everyone who reached it · click a stage to open its records</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            Overall conversion <b className="tabular">{pctFmt(top ? (f.enrolled / top) * 100 : 0)}</b>
          </span>
          {worst > 0 && (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700">
              Biggest drop: {rows[worst - 1].label} → {rows[worst].label} (−{steps[worst - 1].toFixed(0)}%)
            </span>
          )}
        </div>
      </header>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] text-sm tabular">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2 text-left font-medium">Stage</th>
              <th className="w-[34%] px-3 py-2 text-left font-medium">Share of enquiries</th>
              <th className="px-3 py-2 text-right font-medium">Reached</th>
              <th className="px-3 py-2 text-right font-medium" title="Reached this stage and gone no further">Still here</th>
              <th className="px-3 py-2 text-right font-medium">Of previous</th>
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr
                key={r.key} onClick={() => open(r.key)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(r.key)}
                className="group cursor-pointer hover:bg-brand-50/40"
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: r.color }}>{i + 1}</span>
                    <span>
                      <span className="block font-semibold text-slate-900 group-hover:text-brand-700">{r.label}</span>
                      <span className="block text-[11px] text-slate-400">{r.sys} · {r.status}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, r.share)}%`, background: r.color }} />
                    </div>
                    <span className="w-11 text-right text-xs text-slate-500">{r.share.toFixed(r.share < 10 ? 1 : 0)}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-base font-bold text-slate-900">{fmt(r.reached)}</td>
                <td className="px-3 py-2.5 text-right text-slate-600">{r.key === "enrolled" ? "—" : fmt(r.still)}</td>
                <td className={clsx("px-3 py-2.5 text-right", i === worst ? "font-semibold text-rose-600" : "text-slate-600")}>{i ? pctFmt(r.step, 0) : "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-700 opacity-60 group-hover:opacity-100">
                    Records <ChevronRight size={14} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: records                                                      */
/* ------------------------------------------------------------------ */

function RecordsView({ stats, st, scope }: { stats: NodeStats; st: ReturnType<typeof useDrillState>; scope: Scope }) {
  const { can } = useApp();
  const { path, still, q, page, counsellor, source, sort, size, tweak } = st;
  const stage = STAGES.find((s) => s.key === path.stage)!;
  const isAdm = stage.key === "enrolled";
  const loc = locationById(path.loc!);
  const all = useMemo(
    () => stageRecords(path.loc!, path.grade!, stage.key, stats, scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path.loc, path.grade, stage.key, scope.cycle, scope.sourceGroup, scope.dateRange, scope.custom.start, scope.custom.end, stats.funnel[stage.key]],
  );

  // Stage summary.
  const here = all.filter((r): r is LeadRecord => r.kind === "lead" && r.current === stage.key);
  const stillCount = isAdm ? all.length : here.length;
  const waits = here.map((r) => r.daysInStage).sort((a, b) => a - b);
  const median = waits.length ? waits[Math.floor(waits.length / 2)] : 0;
  const over30 = waits.filter((d) => d > 30).length;
  const countLink = (l: string) => all.filter((r) => r.kind === "admission" && r.link === l).length;
  const linked = countLink("Linked");

  // Filters → sort → page.
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const s = q.trim().toLowerCase();
  const sources = Array.from(new Set(all.map((r) => r.source).filter((x) => x !== "—"))).sort();
  let rows: DrillRecord[] = still && !isAdm ? here : all;
  if (counsellor) rows = rows.filter((r) => r.counsellor === counsellor);
  if (source) rows = rows.filter((r) => r.source === source);
  if (s) rows = rows.filter((r) => `${r.id} ${r.child} ${r.parent} ${r.mobile} ${r.source} ${r.counsellor}`.toLowerCase().includes(s));
  const dateOf = (r: DrillRecord) => (r.kind === "lead" ? r.createdIso : r.feePaidIso);
  const waitOf = (r: DrillRecord) => (r.kind === "lead" && r.current === stage.key ? r.daysInStage : -1);
  rows = [...rows].sort((a, b) =>
    sort === "old" ? dateOf(a).localeCompare(dateOf(b)) : sort === "wait" ? waitOf(b) - waitOf(a) : dateOf(b).localeCompare(dateOf(a)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const pg = Math.min(page, pages);
  const shown = rows.slice((pg - 1) * size, pg * size);
  const filtered = !!(counsellor || source || s);
  const clear = () => tweak({ c: undefined, src: undefined, q: undefined, p: undefined });

  const showPii = can("pii");
  const mask = (v: string) => (showPii ? v : "hidden");
  const exportRows = () =>
    rows.map((r): Record<string, string | number> =>
      r.kind === "lead"
        ? {
            "Lead ID": r.id, Child: mask(r.child), Parent: mask(r.parent), Mobile: mask(r.mobile), Source: r.source, Counsellor: r.counsellor,
            Status: r.status, "Created on": r.createdOn, "Days in stage": r.current === stage.key ? r.daysInStage : "",
          }
        : {
            "Admission no.": r.id, Child: mask(r.child), Parent: mask(r.parent), Mobile: mask(r.mobile), "Fee paid on": r.feePaidOn,
            Link: r.link, "Lead ID": r.leadId ?? "", Source: r.source, Counsellor: r.counsellor,
          },
    );

  const th = "sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  // Date header toggles newest / oldest; "Waiting" sorts longest first.
  const dateHeader = (label: string) => (
    <button
      type="button"
      onClick={() => tweak({ sort: sort === "new" ? "old" : undefined, p: undefined })}
      className={clsx("inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800", sort !== "wait" && "text-brand-700")}
    >
      {label}
      {sort !== "wait" && (sort === "old" ? <ArrowUpNarrowWide size={12} /> : <ArrowDownWideNarrow size={12} />)}
    </button>
  );
  const waitHeader = (
    <button
      type="button"
      onClick={() => tweak({ sort: sort === "wait" ? undefined : "wait", p: undefined })}
      className={clsx("inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800", sort === "wait" && "text-brand-700")}
    >
      Waiting
      {sort === "wait" && <ArrowDownWideNarrow size={12} />}
    </button>
  );

  const summary = isAdm
    ? [
        { k: "Admissions", v: fmt(all.length), sub: "fee paid in FABS" },
        { k: "Linked to a lead", v: fmt(linked), sub: `${all.length ? ((linked / all.length) * 100).toFixed(0) : 0}% matched in LeadSquared` },
        { k: "Unmapped", v: fmt(countLink("Unmapped")), sub: "not yet linked to a lead", warn: countLink("Unmapped") > 0 },
        { k: "Direct admissions", v: fmt(countLink("Direct admission")), sub: "no LeadSquared lead" },
      ]
    : [
        { k: "Reached this stage", v: fmt(all.length), sub: `${pctFmt(stats.funnel.leads ? (all.length / stats.funnel.leads) * 100 : 0, 0)} of enquiries` },
        { k: "Still at this stage", v: fmt(stillCount), sub: `${all.length ? ((stillCount / all.length) * 100).toFixed(0) : 0}% not yet moved on` },
        { k: "Median wait", v: stillCount ? `${median} days` : "—", sub: "for leads still here" },
        { k: "Waiting over 30 days", v: fmt(over30), sub: over30 ? "follow these up first" : "none overdue", warn: over30 > 0 },
      ];

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: STAGE_COLORS[STAGES.indexOf(stage)] }}
          >
            {STAGES.indexOf(stage) + 1}
          </span>
          <div>
            <h2 className="text-base font-bold text-brand-900">
              {stage.label} <span className="font-medium text-slate-300">·</span> {isAdm ? "FABS admissions" : "LeadSquared leads"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {loc.short} · {unitLabel(path.grade!)} · {isAdm ? "fee paid within the selected dates" : "leads created within the selected dates"} · source of record: {stage.sys}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons name={`drilldown-${path.loc}-${unitLabel(path.grade!)}-${stage.key}`.replace(/[^\w-]+/g, "-")} rows={exportRows} />
        </div>
      </header>

      {/* Stage summary */}
      <dl className="mx-4 mt-3 grid grid-cols-2 rounded-lg border border-slate-100 bg-slate-50/60 sm:grid-cols-4 sm:divide-x sm:divide-slate-100">
        {summary.map((x) => (
          <div key={x.k} className="px-3 py-2">
            <dt className="text-[11px] text-slate-500">{x.k}</dt>
            <dd className={clsx("text-lg font-bold leading-tight tabular", x.warn ? "text-rose-600" : "text-slate-900")}>{x.v}</dd>
            <dd className="text-[11px] text-slate-400">{x.sub}</dd>
          </div>
        ))}
      </dl>

      {/* Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-slate-100 px-4 py-2.5">
        {!isAdm && (
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="tablist" aria-label="Which leads">
            {[
              { on: !still, label: "Reached", n: all.length, v: undefined },
              { on: still, label: "Still here", n: stillCount, v: "1" },
            ].map((t) => (
              <button
                key={t.label} type="button" role="tab" aria-selected={t.on} onClick={() => tweak({ still: t.v, p: undefined })}
                className={clsx("rounded-md px-2.5 py-1 font-medium transition", t.on ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {t.label} <span className={clsx("ml-0.5 rounded-full px-1.5 tabular", t.on ? "bg-white/20" : "bg-slate-100")}>{fmt(t.n)}</span>
              </button>
            ))}
          </div>
        )}
        <Dropdown
          size="sm" ariaLabel="Counsellor" value={counsellor || "all"}
          onChange={(v) => tweak({ c: v === "all" ? undefined : v, p: undefined })}
          options={[{ value: "all", label: "All counsellors" }, ...loc.counsellors.map((c) => ({ value: c, label: c }))]}
        />
        <Dropdown
          size="sm" ariaLabel="Source" value={source || "all"}
          onChange={(v) => tweak({ src: v === "all" ? undefined : v, p: undefined })}
          options={[{ value: "all", label: "All sources" }, ...sources.map((x) => ({ value: x, label: x }))]}
        />
        <Dropdown
          size="sm" ariaLabel="Sort" value={sort}
          onChange={(v) => tweak({ sort: v === "new" ? undefined : v, p: undefined })}
          options={[
            { value: "new", label: isAdm ? "Latest fee paid" : "Newest first" },
            { value: "old", label: isAdm ? "Earliest fee paid" : "Oldest first" },
            ...(isAdm ? [] : [{ value: "wait", label: "Longest waiting" }]),
          ]}
        />
        {filtered && (
          <button type="button" onClick={clear} className="text-xs font-medium text-brand-700 hover:underline">
            Clear filters
          </button>
        )}
        <label className="ml-auto flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-72">
          <Search size={14} className="text-slate-400" />
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              tweak({ q: e.target.value || undefined, p: undefined });
            }}
            placeholder={isAdm ? "Search admission no., name or mobile" : "Search lead ID, name or mobile"}
            className="w-full text-xs outline-none"
          />
          {text && (
            <button type="button" onClick={() => tweak({ q: undefined, p: undefined })} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </label>
      </div>

      {/* Table: the header stays in view while rows scroll */}
      <div className="max-h-[640px] overflow-auto scroll-thin">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
          <thead>
            {isAdm ? (
              <tr>
                <th className={clsx(th, "pl-4")}>Admission no.</th>
                <th className={th}>Student</th>
                <th className={th}>Mobile</th>
                <th className={th}>{dateHeader("Fee paid on")}</th>
                <th className={th}>LeadSquared link</th>
                <th className={th}>Source</th>
                <th className={clsx(th, "pr-4")}>Counsellor</th>
              </tr>
            ) : (
              <tr>
                <th className={clsx(th, "pl-4")}>Lead ID</th>
                <th className={th}>Student</th>
                <th className={th}>Mobile</th>
                <th className={th}>Source</th>
                <th className={th}>Counsellor</th>
                <th className={th}>Current status</th>
                <th className={th}>{dateHeader("Created on")}</th>
                <th className={clsx(th, "pr-4 text-right")}>{waitHeader}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {shown.map((r, i) => <RecordRow key={`${r.id}-${i}`} r={r} stage={stage.key} />)}
            {!shown.length && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                  No records match{filtered ? " these filters" : ""}.
                  {filtered && (
                    <button type="button" onClick={clear} className="ml-1 font-medium text-brand-700 hover:underline">
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="tabular">
            {rows.length ? (
              <>
                Showing <b className="text-slate-700">{fmt((pg - 1) * size + 1)}–{fmt(Math.min(pg * size, rows.length))}</b> of <b className="text-slate-700">{fmt(rows.length)}</b>
              </>
            ) : (
              "0 records"
            )}
          </span>
          <span className="flex items-center gap-1.5">
            Rows per page
            <Dropdown
              size="sm" ariaLabel="Rows per page" value={String(size)}
              onChange={(v) => tweak({ n: v === "25" ? undefined : v, p: undefined })}
              options={[25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </span>
          {!showPii && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Personal details masked for your role</span>}
        </div>
        <Pager page={pg} pages={pages} onPage={(n) => tweak({ p: n > 1 ? String(n) : undefined })} />
      </footer>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
        Demo records generated to match the stage figure. Personal details follow §10: Leadership can reveal on demand, and every reveal is audit-logged.
      </p>
    </section>
  );
}

const SOURCE_DOT: Record<string, string> = {
  RWA: "#1d4ed8", "Preschool / Crèche": "#60a5fa", Digital: "#10b981", "Education Fairs": "#f97316", Corporate: "#8b5cf6", Others: "#94a3b8",
};
const initialsOf = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const td = "border-b border-slate-100 px-3 py-2.5 align-middle";

function Student({ child, parent }: { child: string; parent: string }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-slate-900"><Pii value={child} /></div>
      <div className="text-[11px] text-slate-500">Parent · <Pii value={parent} /></div>
    </div>
  );
}

function SourceCell({ source }: { source: string }) {
  if (source === "—") return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_DOT[SOURCE_GROUP_OF[source]] ?? "#94a3b8" }} />
      {source}
    </span>
  );
}

function CounsellorCell({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-slate-700">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700">{initialsOf(name)}</span>
      {name}
    </span>
  );
}

function RecordRow({ r, stage }: { r: DrillRecord; stage: StageKey }) {
  if (r.kind === "admission") {
    return (
      <tr className="hover:bg-slate-50/80">
        <td className={clsx(td, "pl-4 font-mono text-xs font-medium text-slate-700")}>{r.id}</td>
        <td className={td}><Student child={r.child} parent={r.parent} /></td>
        <td className={clsx(td, "whitespace-nowrap text-slate-600 tabular")}><Pii value={r.mobile} /></td>
        <td className={clsx(td, "whitespace-nowrap text-slate-600 tabular")}>{r.feePaidOn}</td>
        <td className={td}>
          <div className="flex flex-col items-start gap-0.5">
            <Badge tone={r.link === "Linked" ? "green" : r.link === "Unmapped" ? "red" : "slate"}>{r.link}</Badge>
            {r.leadId && <span className="font-mono text-[11px] text-slate-400">{r.leadId}</span>}
          </div>
        </td>
        <td className={td}><SourceCell source={r.source} /></td>
        <td className={clsx(td, "pr-4")}><CounsellorCell name={r.counsellor} /></td>
      </tr>
    );
  }
  const here = r.current === stage;
  const idx = STAGES.findIndex((s) => s.key === r.current);
  const age = r.daysInStage;
  return (
    <tr className={clsx("hover:bg-slate-50/80", here && "bg-amber-50/30")}>
      <td className={clsx(td, "relative pl-4 font-mono text-xs font-medium text-slate-700")}>
        {here && <span className="absolute inset-y-0 left-0 w-[3px] bg-amber-400" aria-hidden />}
        {r.id}
      </td>
      <td className={td}><Student child={r.child} parent={r.parent} /></td>
      <td className={clsx(td, "whitespace-nowrap text-slate-600 tabular")}><Pii value={r.mobile} /></td>
      <td className={td}><SourceCell source={r.source} /></td>
      <td className={td}><CounsellorCell name={r.counsellor} /></td>
      <td className={td}>
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={here ? "amber" : idx >= 4 ? "green" : "blue"}>{r.status}</Badge>
          <span className="text-[11px] text-slate-400">{here ? "Still at this stage" : `Moved on to ${STAGES[idx].label}`}</span>
        </div>
      </td>
      <td className={clsx(td, "whitespace-nowrap text-slate-600 tabular")}>{r.createdOn}</td>
      <td className={clsx(td, "pr-4 text-right")}>
        {here ? (
          <span
            className={clsx(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular",
              age > 30 ? "bg-rose-50 text-rose-700" : age > 7 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700",
            )}
          >
            {age} day{age === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

/** Numbered pagination: first, last, and one either side of the current page. */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  const btn = "grid h-7 min-w-7 place-items-center rounded-md px-2 text-xs font-medium tabular";
  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      <button
        type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"
        className={clsx(btn, "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40")}
      >
        <ChevronLeft size={14} />
      </button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-0.5 text-slate-400">…</span>}
          <button
            type="button" onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}
            className={clsx(btn, n === page ? "bg-brand-600 text-white" : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"
        className={clsx(btn, "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40")}
      >
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}
