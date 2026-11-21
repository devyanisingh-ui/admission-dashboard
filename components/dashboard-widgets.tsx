"use client";

import clsx from "clsx";
import {
  ArrowDown, ArrowUp, BarChart3, ChevronRight, ClipboardList, DoorOpen, Download, FileText, GraduationCap, Lightbulb, Megaphone, Share2,
  Target, TrendingDown, TrendingUp, UserMinus, Users, UserRoundSearch, Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp } from "@/lib/context";
import { quickInsights, type DashboardData, type Insight, type InsightKind } from "@/lib/dashboard";
import { CYCLE_MONTHS, CYCLES, pct, SOURCE_GROUPS, type Cycle } from "@/lib/data";
import { downloadCsv } from "@/lib/export";
import { SOCIAL_PLATFORMS, ALL_ACTIVITIES } from "@/lib/marketing";
import { REPORT_DEFS, type Row } from "@/lib/reports";
import { Dropdown } from "./dropdown";
import { fmt } from "./ui";

const axis = { fontSize: 11, fill: "#64748b" };
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };

/* ------------------------------------------------------------------ */
/* Snapshot cards                                                      */
/* ------------------------------------------------------------------ */

const SNAP_THEME = {
  blue: { bg: "bg-sky-50/70", border: "border-sky-100", icon: "bg-sky-100 text-sky-600" },
  green: { bg: "bg-emerald-50/70", border: "border-emerald-100", icon: "bg-emerald-100 text-emerald-600" },
  violet: { bg: "bg-violet-50/70", border: "border-violet-100", icon: "bg-violet-100 text-violet-600" },
  orange: { bg: "bg-orange-50/70", border: "border-orange-100", icon: "bg-orange-100 text-orange-600" },
  rose: { bg: "bg-rose-50/70", border: "border-rose-100", icon: "bg-rose-100 text-rose-600" },
  teal: { bg: "bg-teal-50/70", border: "border-teal-100", icon: "bg-teal-100 text-teal-600" },
};

export function SnapshotCard({
  theme, icon: Icon, label, value, change, sub, lowerIsBetter,
}: { theme: keyof typeof SNAP_THEME; icon: typeof Users; label: string; value: number | string; change: number | null; sub: string; lowerIsBetter?: boolean }) {
  const t = SNAP_THEME[theme];
  const good = change !== null && (lowerIsBetter ? change <= 0 : change >= 0);
  return (
    <div className={clsx("@container rounded-xl border p-3.5", t.bg, t.border)}>
      {/* Icon, name and figure share one line; the comparison and description sit underneath.
          The name never shrinks below its longest word, so it cannot run under the figure. */}
      <div className="flex items-center gap-2.5">
        <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", t.icon)}><Icon size={18} /></span>
        <span className="flex-1 text-[13px] font-semibold leading-tight text-brand-900 @2xs:text-sm">{label}</span>
        <span className="shrink-0 text-xl font-bold leading-none tracking-tight text-slate-900 tabular @2xs:text-2xl">{typeof value === "number" ? fmt(value) : value}</span>
      </div>
      <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
        {change !== null && (
          <span className={clsx("inline-flex shrink-0 items-center font-semibold", good ? "text-emerald-600" : "text-rose-600")} title="vs same period last year">
            {change >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(change).toFixed(0)}%
          </span>
        )}
        <span className="min-w-0">{sub}</span>
      </div>
    </div>
  );
}

export function SnapshotCards({ d }: { d: DashboardData }) {
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))]">
      <SnapshotCard theme="blue" icon={Users} label="Total Leads" value={d.cur.leads} change={d.change("leads")} sub="Enquiries received" />
      <SnapshotCard theme="green" icon={ClipboardList} label="Applications" value={d.cur.applications} change={d.change("applications")} sub="Applications submitted" />
      <SnapshotCard theme="violet" icon={GraduationCap} label="Admissions" value={d.cur.admissions} change={d.change("admissions")} sub="Confirmed admissions (fee paid)" />
      <SnapshotCard theme="orange" icon={UserRoundSearch} label="Vacancies Remaining" value={d.cur.vacancies} change={d.change("vacancies")} sub={`Against approved capacity of ${fmt(d.cur.seats)}`} lowerIsBetter />
      <SnapshotCard theme="rose" icon={UserMinus} label="Withdrawals" value={d.cur.withdrawals} change={d.change("withdrawals")} sub="Students withdrawn" lowerIsBetter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

export function Panel({ title, sub, actions, children, className, bodyClass }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
        <div>
          <h2 className="text-base font-bold text-brand-900">
            {title}
            {sub && <span className="ml-1.5 text-xs font-normal text-slate-500">{sub}</span>}
          </h2>
        </div>
        {actions}
      </header>
      <div className={clsx("px-4 pb-4 pt-2", bodyClass)}>{children}</div>
    </section>
  );
}

function LegendDot({ color, label, diamond }: { color: string; label: string; diamond?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className={clsx("h-2.5 w-2.5", diamond ? "rotate-45" : "rounded-full")} style={{ background: color }} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Grade-wise vacancy & admissions                                     */
/* ------------------------------------------------------------------ */

export const fillColor = (p: number) => (p > 100 ? "#8b5cf6" : p >= 95 ? "#059669" : p >= 85 ? "#34d399" : p >= 75 ? "#fbbf24" : "#f43f5e");
const FILL_TRAJECTORY = 82;

/**
 * Grade-wise approved intake, enrolments and vacancy.
 * "split" (dashboard): chart and table side by side on wide screens. "stacked": table under the chart.
 */
/** `onGrade`: makes bars and rows clickable (the Dashboard opens that grade in the Drill-down). */
export function GradeVacancy({ d, layout = "split", onGrade }: { d: DashboardData; layout?: "split" | "stacked" | "chart"; onGrade?: (unit: string) => void }) {
  const pickGrade = onGrade ? (_: unknown, i: number) => onGrade(d.grades[i].unit) : undefined;
  const [view, setView] = useState<"seats" | "fill">("seats");
  const label = d.gradeVertical === "Schools" ? "Grade" : "Programme";
  const total = d.grades.reduce((a, g) => ({ intake: a.intake + g.intake, enrolled: a.enrolled + g.enrolled, vacancy: a.vacancy + g.vacancy }), { intake: 0, enrolled: 0, vacancy: 0 });
  const totalFill = pct(total.enrolled, total.intake);
  const fillMax = Math.max(100, Math.ceil(Math.max(...d.grades.map((g) => g.fillPct)) / 10) * 10);
  const fillTicks = [0, 25, 50, 75, 100, ...(fillMax > 100 ? [fillMax] : [])];
  // Grade filter: keep every grade for context, but highlight the chosen one.
  const sel = d.selectedGrade && d.grades.some((g) => g.unit === d.selectedGrade) ? d.selectedGrade : null;
  const op = (unit: string) => (!sel || unit === sel ? 1 : 0.25);
  const selRow = sel ? d.grades.find((g) => g.unit === sel)! : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-brand-900">{label}-wise Vacancy &amp; Admissions</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmt(total.enrolled)} enrolled of {fmt(total.intake)} approved intake · <b className="text-slate-700">{fmt(total.vacancy)} seats remaining</b> · {totalFill.toFixed(0)}% filled
            {d.mixedVerticals && <span className="text-slate-400"> · schools only (choose Higher Ed in Vertical for programmes)</span>}
            {selRow && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                {label} {selRow.unit}: {fmt(selRow.enrolled)} / {fmt(selRow.intake)} · {fmt(selRow.vacancy)} left
              </span>
            )}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="tablist" aria-label="Chart view">
          {(["seats", "fill"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={clsx("rounded-md px-2.5 py-1 font-medium transition", view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
            >
              {v === "seats" ? "Seats" : "Fill %"}
            </button>
          ))}
        </div>
      </header>

      <div className={clsx("grid gap-4 px-4 pb-4 pt-3", layout === "split" && "2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] 2xl:items-start")}>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1">
            {view === "seats" ? (
              <>
                <LegendDot color="#93c5fd" label="Approved intake" />
                <LegendDot color="#1d4ed8" label="Enrolled" />
                <LegendDot color="#f59e0b" label="Vacancy" diamond />
              </>
            ) : (
              <>
                <LegendDot color="#059669" label="95%+" />
                <LegendDot color="#34d399" label="85–95%" />
                <LegendDot color="#fbbf24" label="75–85%" />
                <LegendDot color="#f43f5e" label="Below 75%" />
                <LegendDot color="#8b5cf6" label="Over 100%" />
                <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-4 border-t-2 border-dashed border-slate-500" /> {FILL_TRAJECTORY}% trajectory</span>
              </>
            )}
          </div>
          <ResponsiveContainer width="100%" height={layout === "split" ? 330 : layout === "chart" ? 300 : 260}>
            {view === "seats" ? (
              <ComposedChart data={d.grades} margin={{ top: 10, right: 4, left: -14, bottom: 0 }} barGap={2} barCategoryGap="18%">
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="unit" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={(v: number, n: string) => [fmt(v), n]} />
                <Bar dataKey="intake" name="Approved intake" fill="#93c5fd" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} onClick={pickGrade} cursor={onGrade ? "pointer" : undefined}>
                  {d.grades.map((g) => <Cell key={g.unit} fill="#93c5fd" fillOpacity={op(g.unit)} />)}
                </Bar>
                <Bar dataKey="enrolled" name="Enrolled" fill="#1d4ed8" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} onClick={pickGrade} cursor={onGrade ? "pointer" : undefined}>
                  {d.grades.map((g) => <Cell key={g.unit} fill="#1d4ed8" fillOpacity={op(g.unit)} />)}
                </Bar>
                <Line dataKey="vacancy" name="Vacancy" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3.5, fill: "#f59e0b", strokeWidth: 0 }} isAnimationActive={false} />
              </ComposedChart>
            ) : (
              <BarChart data={d.grades} margin={{ top: 10, right: 4, left: -14, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="unit" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, fillMax]} ticks={fillTicks} interval={0} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={(v: number) => [`${v.toFixed(0)}%`, "Seat fill"]} />
                <ReferenceLine y={FILL_TRAJECTORY} stroke="#64748b" strokeDasharray="5 4" />
                <Bar dataKey="fillPct" name="Seat fill" radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} onClick={pickGrade} cursor={onGrade ? "pointer" : undefined}>
                  {d.grades.map((g) => <Cell key={g.unit} fill={fillColor(g.fillPct)} fillOpacity={op(g.unit)} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {layout !== "chart" && <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs tabular">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">{label}</th>
                <th className="px-3 py-2 text-right font-semibold">Approved intake</th>
                <th className="px-3 py-2 text-right font-semibold">Enrolled</th>
                <th className="px-3 py-2 text-right font-semibold">Vacancy</th>
                <th className="py-2 pl-3 pr-4 text-right font-semibold">Fill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.grades.map((g) => (
                <tr
                  key={g.unit}
                  onClick={onGrade ? () => onGrade(g.unit) : undefined}
                  title={onGrade ? `Drill down into ${g.unit}` : undefined}
                  className={clsx(sel === g.unit ? "bg-brand-50 font-semibold" : sel ? "text-slate-400 opacity-60" : "hover:bg-slate-50", onGrade && "cursor-pointer")}
                >
                  <td className="px-3 py-1 font-medium text-slate-700">{g.unit}</td>
                  <td className="px-3 py-1 text-right text-slate-600">{fmt(g.intake)}</td>
                  <td className="px-3 py-1 text-right">{fmt(g.enrolled)}</td>
                  <td className={clsx("px-3 py-1 text-right", g.vacancy ? "font-medium text-amber-700" : "text-slate-300")}>{fmt(g.vacancy)}</td>
                  <td className="py-1 pl-3 pr-4 text-right">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: fillColor(g.fillPct) }} />
                      <span className={clsx("w-9", g.fillPct > 100 ? "font-semibold text-violet-700" : g.fillPct < 75 ? "font-semibold text-rose-600" : "text-slate-700")}>
                        {g.fillPct.toFixed(0)}%
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-3 py-1.5 text-right">{fmt(total.intake)}</td>
                <td className="px-3 py-1.5 text-right">{fmt(total.enrolled)}</td>
                <td className="px-3 py-1.5 text-right text-amber-700">{fmt(total.vacancy)}</td>
                <td className="py-1.5 pl-3 pr-4 text-right">
                  <span className="inline-block w-9">{totalFill.toFixed(0)}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Source-wise performance                                             */
/* ------------------------------------------------------------------ */

export const SOURCE_COLORS: Record<string, string> = {
  RWA: "#1d4ed8", "Preschool / Crèche": "#60a5fa", Digital: "#10b981", "Education Fairs": "#f97316", Corporate: "#8b5cf6", Others: "#94a3b8",
};

export function SourcePerformance({ d }: { d: DashboardData }) {
  const { sourceGroup } = useApp();
  const total = d.sources.reduce((s, x) => s + x.leads, 0);
  const selected = sourceGroup === "All" ? null : d.sources.find((s) => s.group === sourceGroup) ?? null;
  const maxShare = Math.max(1, ...d.sources.map((s) => s.leads));
  const best = [...d.sources].filter((s) => s.leads >= 20).sort((a, b) => b.conversion - a.conversion)[0];

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3.5">
        <h2 className="text-base font-bold text-brand-900">Source-wise Performance</h2>
        <span className="text-xs text-slate-500">LeadSquared source · {d.rangeMonths}</span>
      </header>

      <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-3 px-4 pb-3 pt-2">
        {/* Donut */}
        <div className="relative mx-auto h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={d.sources} dataKey="leads" nameKey="group" innerRadius={48} outerRadius={72} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                {d.sources.map((s) => (
                  <Cell key={s.group} fill={SOURCE_COLORS[s.group]} opacity={!selected || selected.group === s.group ? 1 : 0.2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${fmt(v)} leads`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-lg font-bold leading-tight text-brand-900 tabular">{fmt(selected ? selected.leads : total)}</div>
              <div className="text-[10px] leading-tight text-slate-500">{selected ? `${selected.group} leads` : "Total leads"}</div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <table className="min-w-[260px] flex-1 text-xs tabular">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400">
              <th className="pb-1 text-left font-medium">Source</th>
              <th className="pb-1 text-right font-medium">Leads</th>
              <th className="pb-1 pl-3 text-left font-medium">Share</th>
              <th className="pb-1 text-right font-medium" title="FABS admissions matched to a LeadSquared lead">Adm.</th>
              <th className="pb-1 text-right font-medium">Conv.</th>
            </tr>
          </thead>
          <tbody>
            {d.sources.map((s) => {
              const share = total ? (s.leads / total) * 100 : 0;
              const dim = selected && selected.group !== s.group;
              return (
                <tr key={s.group} className={clsx(dim && "opacity-35", selected?.group === s.group && "font-semibold")}>
                  <td className="py-[3px] pr-2">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[s.group] }} />
                      {s.group}
                    </span>
                  </td>
                  <td className="py-[3px] text-right text-slate-800">{fmt(s.leads)}</td>
                  <td className="py-[3px] pl-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full" style={{ width: `${(s.leads / maxShare) * 100}%`, background: SOURCE_COLORS[s.group] }} />
                      </span>
                      <span className="w-8 text-right font-semibold text-slate-900">{share.toFixed(0)}%</span>
                    </span>
                  </td>
                  <td className="py-[3px] text-right text-slate-700">{fmt(s.admissions)}</td>
                  <td className={clsx("py-[3px] text-right", best?.group === s.group ? "font-semibold text-emerald-700" : "text-slate-600")}>{s.conversion.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        Conv. = matched admissions ÷ leads{best && <> · best: <b className="text-emerald-700">{best.group}</b></>}
        {d.unattributedAdmissions > 0 && <> · +{fmt(d.unattributedAdmissions)} admissions have no LeadSquared source (direct / unmapped)</>}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Lead trend                                                          */
/* ------------------------------------------------------------------ */

const kShort = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

/**
 * Monthly leads (LeadSquared) and admissions (FABS) across the selected date range.
 * Admissions use their own right-hand scale so their shape is readable next to much larger lead counts.
 */
export function LeadTrend({ d }: { d: DashboardData }) {
  const showLY = !!d.prev;
  const leads = d.trend.reduce((s, m) => s + m.leads, 0);
  const leadsLY = d.trend.reduce((s, m) => s + m.leadsLY, 0);
  const admissions = d.trend.reduce((s, m) => s + m.admissions, 0);
  const vsLY = showLY && leadsLY ? ((leads - leadsLY) / leadsLY) * 100 : null;
  const peak = d.trend.reduce((a, m) => (m.leads > a.leads ? m : a), d.trend[0] ?? { month: "—", leads: 0, leadsLY: 0, admissions: 0 });

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3.5">
        <h2 className="text-base font-bold text-brand-900">Lead Trend</h2>
        <span className="text-xs text-slate-500">LeadSquared leads · FABS admissions · {d.rangeMonths}</span>
      </header>

      {/* Headline figures for the range */}
      <dl className="mx-4 mt-2 grid grid-cols-4 divide-x divide-slate-100 rounded-lg bg-slate-50 py-1.5 text-center">
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Leads</dt>
          <dd className="text-sm font-semibold text-slate-900 tabular">
            {fmt(leads)}
            {vsLY !== null && (
              <span className={clsx("ml-1 text-[11px] font-semibold", vsLY >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {vsLY >= 0 ? "↑" : "↓"}{Math.abs(vsLY).toFixed(0)}%
              </span>
            )}
          </dd>
        </div>
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Admissions</dt>
          <dd className="text-sm font-semibold text-slate-900 tabular">{fmt(admissions)}</dd>
        </div>
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Conversion</dt>
          <dd className="text-sm font-semibold text-slate-900 tabular">{pct(admissions, leads).toFixed(1)}%</dd>
        </div>
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Peak month</dt>
          <dd className="text-sm font-semibold text-slate-900">{peak.month}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2.5">
        <LegendDot color="#3b82f6" label="Leads" />
        {showLY && (
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-4 border-t-2 border-dashed border-slate-400" /> Leads last year
          </span>
        )}
        <LegendDot color="#16a34a" label="Admissions (right axis)" />
      </div>

      <div className="min-h-[200px] flex-1 px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} />
            <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} width={38} tickFormatter={kShort} allowDecimals={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ ...axis, fill: "#16a34a" }} tickLine={false} axisLine={false} width={34} tickFormatter={kShort} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, n: string) => [fmt(v), n]}
              labelFormatter={(l: string) => {
                const m = d.trend.find((x) => x.month === l);
                return m && m.leads ? `${l} · conversion ${pct(m.admissions, m.leads).toFixed(1)}%` : l;
              }}
            />
            <Area yAxisId="l" type="monotone" dataKey="leads" name="Leads" stroke="#3b82f6" strokeWidth={2.2} fill="url(#leadFill)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} isAnimationActive={false} />
            {showLY && (
              <Line yAxisId="l" type="monotone" dataKey="leadsLY" name="Leads last year" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            )}
            <Line yAxisId="r" type="monotone" dataKey="admissions" name="Admissions" stroke="#16a34a" strokeWidth={2.2} dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Quick insights                                                      */
/* ------------------------------------------------------------------ */

const INSIGHT_TONE: Record<Insight["tone"], { tile: string; icon: string; value: string }> = {
  good: { tile: "border-emerald-100 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-600", value: "text-emerald-700" },
  bad: { tile: "border-rose-100 bg-rose-50/60", icon: "bg-rose-100 text-rose-600", value: "text-rose-700" },
  info: { tile: "border-sky-100 bg-sky-50/60", icon: "bg-sky-100 text-sky-600", value: "text-slate-900" },
  accent: { tile: "border-violet-100 bg-violet-50/60", icon: "bg-violet-100 text-violet-600", value: "text-slate-900" },
  warn: { tile: "border-amber-100 bg-amber-50/60", icon: "bg-amber-100 text-amber-600", value: "text-slate-900" },
};
const INSIGHT_ICON: Record<InsightKind, typeof Users> = { trend: TrendingUp, source: Megaphone, conversion: GraduationCap, vacancy: DoorOpen };

export function QuickInsights({ d }: { d: DashboardData }) {
  const items = quickInsights(d);
  if (!items.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex items-center gap-2 px-4 pt-3.5">
        <Lightbulb size={18} className="text-brand-700" />
        <h2 className="text-base font-bold text-brand-900">Quick Insights</h2>
        <span className="text-xs text-slate-400">for the current filters</span>
      </header>
      <div className={clsx("grid gap-3 px-4 pb-4 pt-3 sm:grid-cols-2", items.length >= 4 ? "2xl:grid-cols-4" : items.length === 3 && "2xl:grid-cols-3")}>
        {items.map((it) => {
          const th = INSIGHT_TONE[it.tone];
          const Icon = it.kind === "trend" && it.tone === "bad" ? TrendingDown : INSIGHT_ICON[it.kind];
          const body = (
            <>
              <div className="flex items-center gap-2">
                <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-full", th.icon)}><Icon size={14} /></span>
                <span className="truncate text-xs font-medium text-slate-600">{it.label}</span>
                {it.href && <ChevronRight size={14} className="ml-auto shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />}
              </div>
              <div className={clsx("mt-2 truncate text-lg font-bold leading-tight tracking-tight tabular", th.value)} title={it.value}>{it.value}</div>
              <div className="mt-0.5 text-xs leading-snug text-slate-500">{it.detail}</div>
            </>
          );
          const cls = clsx("group min-w-0 rounded-lg border px-3 py-2.5", th.tile);
          return it.href ? (
            <Link key={it.kind} href={it.href} className={clsx(cls, "transition hover:shadow-sm hover:brightness-[0.98]")}>{body}</Link>
          ) : (
            <div key={it.kind} className={cls}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Download reports panel                                              */
/* ------------------------------------------------------------------ */

type FilterKey = "session" | "grade" | "source" | "month" | "activity" | "platform";
interface PanelReport { id: string; title: string; desc: string; icon: typeof Users; color: string; href: string; filters: FilterKey[] }

const PANEL_REPORTS: PanelReport[] = [
  { id: "mis", title: "Admissions MIS", desc: "Leads, applications, admissions, withdrawals", icon: BarChart3, color: "bg-brand-700", href: "/drilldown", filters: ["session", "grade", "source"] },
  { id: "vacancy", title: "Grade-wise Vacancy", desc: "Approved intake, enrolled, remaining seats", icon: Users, color: "bg-emerald-500", href: "/grades", filters: ["session", "grade"] },
  { id: "targets", title: "Grade-wise Admissions", desc: "Target vs actual admissions", icon: GraduationCap, color: "bg-violet-500", href: "/grades", filters: ["session", "grade"] },
  { id: "budget", title: "Budget & Outreach", desc: "Allocation, actual spend, activities, leads", icon: Wallet, color: "bg-orange-500", href: "/budget", filters: ["session", "activity"] },
  { id: "social", title: "Social Media", desc: "Reach, impressions, interactions, prospects", icon: Share2, color: "bg-teal-600", href: "/social", filters: ["platform", "month"] },
  { id: "withdrawals", title: "Withdrawals", desc: "Withdrawals by location and reason", icon: UserMinus, color: "bg-rose-500", href: "/strength", filters: ["session"] },
];

/** Narrows exported rows by the panel's quick filters, using whichever matching column the report has. */
function applyFilters(rows: Row[], f: Partial<Record<FilterKey, string>>) {
  const cols: Record<FilterKey, string[]> = {
    session: [], grade: ["Grade / programme", "Grade"], source: ["Source group"], month: ["Month"], activity: ["Activity"], platform: ["Platform"],
  };
  return rows.filter((r) =>
    (Object.keys(f) as FilterKey[]).every((k) => {
      const v = f[k];
      if (!v || v === "All") return true;
      const col = cols[k].find((c) => c in r);
      return !col || String(r[col]) === v || r[col] === "All";
    }),
  );
}

function ReportRow({ r, ids, grades }: { r: PanelReport; ids: string[]; grades: string[] }) {
  const app = useApp();
  const [f, setF] = useState<Partial<Record<FilterKey, string>>>({ session: app.cycle });
  const def = REPORT_DEFS.find((x) => x.id === r.id)!;
  const opts: Record<FilterKey, { value: string; label: string }[]> = {
    session: CYCLES.map((c) => ({ value: c, label: c.replace("-", "–") })),
    grade: [{ value: "All", label: "All grades" }, ...grades.map((g) => ({ value: g, label: g }))],
    source: [{ value: "All", label: "All sources" }, ...SOURCE_GROUPS.map((s) => ({ value: s, label: s }))],
    month: [{ value: "All", label: "All months" }, ...CYCLE_MONTHS.map((m) => ({ value: m, label: m }))],
    activity: [{ value: "All", label: "All activities" }, ...ALL_ACTIVITIES.map((a) => ({ value: a.type, label: a.type }))],
    platform: [{ value: "All", label: "All platforms" }, ...SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))],
  };
  const download = () => {
    const cycle = (f.session ?? app.cycle) as Cycle;
    const rows = applyFilters(def.build!(ids, cycle), f);
    downloadCsv(`${r.id}-${cycle}`, rows);
  };
  return (
    <li className="px-4 py-3 transition-colors hover:bg-slate-50/70">
      <div className="flex items-start gap-3">
        <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-full text-white", r.color)}><r.icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <Link href={r.href} className="group flex items-center justify-between">
            <span className="text-sm font-semibold text-brand-900 group-hover:underline">{r.title}</span>
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
          <p className="text-xs text-slate-500">{r.desc}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {r.filters.map((k) => (
              <Dropdown
                key={k}
                size="sm"
                ariaLabel={`${r.title} ${k}`}
                value={f[k] ?? (k === "session" ? app.cycle : "All")}
                onChange={(v) => setF((x) => ({ ...x, [k]: v }))}
                options={opts[k]}
              />
            ))}
            {app.can("export") && (
              <button
                onClick={download}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                <Download size={13} /> Download
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function DownloadReportsPanel({ ids, grades }: { ids: string[]; grades: string[] }) {
  const app = useApp();
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:max-h-[calc(100vh-6rem)]">
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3.5">
        <Download size={26} className="mt-0.5 text-brand-800" />
        <div>
          <h2 className="text-base font-bold text-brand-900">Download Reports</h2>
          <p className="text-xs text-slate-500">Select a category to view and download detailed reports.</p>
        </div>
      </header>
      {!app.can("export") && <p className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">Your role can view reports but not download them.</p>}
      {/* Rows keep their natural height; on wide screens the panel is capped at the window and the list scrolls. */}
      <ul className="flex min-h-0 flex-col divide-y divide-slate-100 overflow-y-auto scroll-thin xl:flex-1">
        {PANEL_REPORTS.map((r) => <ReportRow key={r.id} r={r} ids={ids} grades={grades} />)}
      </ul>
      <div className="border-t border-slate-100 px-4 py-2.5 text-right">
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          <FileText size={13} /> All reports & snapshots
        </Link>
      </div>
    </section>
  );
}
