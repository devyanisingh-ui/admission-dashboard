"use client";

import clsx from "clsx";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { kpis, type Totals } from "@/lib/data";
import { fmt, SourceTag } from "./ui";

export const C = {
  brand: "#2553b8",
  brandLight: "#93b4f5",
  amber: "#f59e0b",
  green: "#10b981",
  rose: "#f43f5e",
  slate: "#94a3b8",
  violet: "#8b5cf6",
  sky: "#0ea5e9",
};

const axis = { fontSize: 11, fill: "#64748b" };
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };

/** Central de-duplicated funnel: each stage read from exactly one system. */
export function Funnel({ t }: { t: Totals }) {
  const k = kpis(t);
  const stages = [
    { label: "Enquiry", value: t.leads, sys: "LeadSquared" },
    { label: "Contacted / In follow-up", value: t.contacted, sys: "LeadSquared" },
    { label: "Registered", value: t.registered, sys: "SaaS" },
    { label: "Offer Issued", value: t.offers, sys: "LeadSquared" },
    { label: "Admission Confirmed (LeadSquared)", value: t.crmConfirmed, sys: "LeadSquared" },
    { label: "Fee Paid / Enrolled", value: t.enrolled, sys: "FABS" },
  ];
  const max = stages[0].value || 1;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const prev = i ? stages[i - 1].value : 0;
          const conv = i ? (s.value / (prev || 1)) * 100 : 100;
          const w = Math.max(6, (s.value / max) * 100);
          return (
            <div key={s.label}>
              {i > 0 && (
                <div className="ml-[136px] pb-0.5 text-[10px] text-slate-400 sm:ml-[184px]">
                  ↓ {conv.toFixed(1)}% carried · <span className="text-rose-500">{(100 - conv).toFixed(1)}% drop-off</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-[124px] shrink-0 text-right text-xs leading-tight text-slate-600 sm:w-[172px]">
                  {s.label}
                  <div className="mt-0.5"><SourceTag system={s.sys} /></div>
                </div>
                <div className="relative flex h-8 flex-1 items-center gap-1.5">
                  <div
                    className={clsx("flex h-full items-center rounded-md px-2 text-xs font-semibold text-white tabular", i === 5 ? "bg-emerald-600" : i === 4 ? "bg-brand-700" : "bg-brand-500")}
                    style={{ width: `${w}%`, opacity: i === 5 || i === 4 ? 1 : 1 - i * 0.1 }}
                  >
                    {w >= 22 && fmt(s.value)}
                  </div>
                  {/* Short bars can't fit the number — show it beside the bar instead. */}
                  {w < 22 && <span className="text-xs font-semibold text-slate-800 tabular">{fmt(s.value)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2.5">
        <PendingFee t={t} pending={k.pending} />
        <SideBucket title="Unmapped FABS admissions" sub="Awaiting CRM ↔ FABS link — excluded from conversion %" value={t.unmapped} tone={t.unmapped ? "rose" : "slate"} />
        <SideBucket title="Lost (incl. Cold Lead)" sub="LeadSquared" value={t.lost} tone="slate" />
        <SideBucket title="Withdrawn" sub={`FABS · ${t.withdrawnNew} new adm. · ${t.withdrawnExisting} existing`} value={t.withdrawnNew + t.withdrawnExisting} tone="slate" />
      </div>
    </div>
  );
}

const AGE_BUCKETS = [
  { label: "0–7 days", bar: "bg-amber-300", text: "text-amber-800" },
  { label: "8–15 days", bar: "bg-orange-400", text: "text-orange-800" },
  { label: "Over 15 days", bar: "bg-rose-500", text: "text-rose-700" },
];

/**
 * Pending Fee = CRM-confirmed leads (Admission / Orientation) with no linked FABS admission yet,
 * aged by days since the counsellor marked Admission in CRM.
 */
function PendingFee({ t, pending }: { t: Totals; pending: number }) {
  const linked = t.crmConfirmed - pending;
  const maybePaid = Math.min(t.unmapped, pending);
  return (
    <div className="h-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-700">Pending Fee</span>
        <span className="text-lg font-semibold tabular">{fmt(pending)}</span>
      </div>
      <div className="text-[11px] leading-snug text-slate-500">
        CRM-confirmed leads with no linked FABS admission
        <span className="block tabular text-slate-400">
          {fmt(t.crmConfirmed)} confirmed − {fmt(linked)} linked
        </span>
      </div>

      {/* Ageing: stacked proportion bar + counts */}
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {AGE_BUCKETS.map((b, i) => (
          <div key={b.label} className={b.bar} style={{ width: `${pending ? (t.pendingFee[i] / pending) * 100 : 0}%` }} />
        ))}
      </div>
      <dl className="mt-1.5 space-y-0.5 text-[11px]">
        {AGE_BUCKETS.map((b, i) => (
          <div key={b.label} className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-slate-600">
              <span className={clsx("h-2 w-2 rounded-sm", b.bar)} />
              {b.label}
            </dt>
            <dd className={clsx("tabular font-semibold", i === 2 ? b.text : "text-slate-800")}>
              {fmt(t.pendingFee[i])}
              <span className="ml-1 font-normal text-slate-400">{pending ? Math.round((t.pendingFee[i] / pending) * 100) : 0}%</span>
            </dd>
          </div>
        ))}
      </dl>
      {maybePaid > 0 && (
        <p className="mt-1.5 border-t border-amber-200/70 pt-1.5 text-[11px] leading-snug text-amber-800">
          Up to {fmt(maybePaid)} may already be paid — they match the unmapped FABS admissions.
        </p>
      )}
    </div>
  );
}

function SideBucket({ title, sub, value, tone, children }: { title: string; sub: string; value: number; tone: "amber" | "rose" | "slate"; children?: React.ReactNode }) {
  return (
    <div className={clsx("h-full rounded-lg border px-3 py-2.5", tone === "amber" ? "border-amber-200 bg-amber-50/40" : tone === "rose" ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-slate-50/60")}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-700">{title}</span>
        <span className="text-lg font-semibold tabular">{fmt(value)}</span>
      </div>
      <div className="text-[11px] text-slate-500">{sub}</div>
      {children}
    </div>
  );
}

const FUNNEL_STEPS = [
  { key: "leads", label: "Enquiry", detail: "All leads, de-duplicated", sys: "LeadSquared", color: "#1e40af" },
  { key: "contacted", label: "Contacted", detail: "In follow-up · Attempt 1–5", sys: "LeadSquared", color: "#1d4ed8" },
  { key: "registered", label: "Registered", detail: "Registration form submitted", sys: "SaaS", color: "#2563eb" },
  { key: "offers", label: "Offer issued", detail: "Offer Letter", sys: "LeadSquared", color: "#3b82f6" },
  { key: "crmConfirmed", label: "Admission confirmed", detail: "Admission / Orientation", sys: "LeadSquared", color: "#4f46e5" },
  { key: "enrolled", label: "Fee paid / Enrolled", detail: "Admission no. generated", sys: "FABS", color: "#059669" },
] as const;

/**
 * Full-width, left-to-right step funnel for wide layouts (Dashboard).
 * Each step shows its count, share of enquiries and a proportional bar; connectors show carry-over and drop-off.
 * The outcome buckets (Pending Fee, Unmapped, Lost, Withdrawn) sit in a row underneath.
 */
/** `stageHref` turns each stage card into a link (e.g. into the Drill-down). */
export function FunnelWide({ t, stageHref }: { t: Totals; stageHref?: (key: (typeof FUNNEL_STEPS)[number]["key"]) => string | undefined }) {
  const values = FUNNEL_STEPS.map((s) => t[s.key]);
  const max = values[0] || 1;
  const overall = max ? (t.enrolled / max) * 100 : 0;
  // Largest drop between consecutive stages, to call out where most leads are lost.
  const drops = values.slice(1).map((v, i) => (values[i] ? 100 - (v / values[i]) * 100 : 0));
  const worst = drops.indexOf(Math.max(...drops)) + 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
        <span>
          Overall conversion <b className="text-sm text-slate-900 tabular">{overall.toFixed(1)}%</b> <span className="text-slate-400">(enquiry → enrolled)</span>
        </span>
        <span>
          Biggest drop-off <b className="text-rose-600">{FUNNEL_STEPS[worst - 1].label} → {FUNNEL_STEPS[worst].label}</b>{" "}
          <span className="tabular">({drops[worst - 1].toFixed(0)}%)</span>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(5,minmax(0,1fr)_52px)_minmax(0,1fr)] 2xl:gap-0">
        {FUNNEL_STEPS.map((s, i) => {
          const v = values[i];
          const conv = i ? (values[i - 1] ? (v / values[i - 1]) * 100 : 0) : 100;
          const share = (v / max) * 100;
          return (
            <Fragment key={s.key}>
              {i > 0 && (
                <div className="hidden flex-col items-center justify-center text-center 2xl:flex" aria-hidden>
                  <span className="text-[11px] font-semibold text-slate-700 tabular">{conv.toFixed(0)}%</span>
                  <svg width="30" height="12" viewBox="0 0 30 12" className="my-0.5 text-slate-300">
                    <path d="M0 6h26M21 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className={clsx("text-[10px] tabular", i === worst ? "font-semibold text-rose-600" : "text-rose-400")}>−{(100 - conv).toFixed(0)}%</span>
                </div>
              )}
              <StageBox href={stageHref?.(s.key)} className={clsx("flex flex-col rounded-xl border p-3", i === 5 ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/50")}>
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: s.color }}>{i + 1}</span>
                  <span className="truncate text-xs font-semibold text-brand-900">{s.label}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <SourceTag system={s.sys} />
                  <span className="truncate text-[10px] text-slate-400">{s.detail}</span>
                </div>
                <div className="mt-2 text-2xl font-bold leading-none tracking-tight text-slate-900 tabular">{fmt(v)}</div>
                <div className="mt-1 text-[11px] text-slate-500 tabular">{share.toFixed(share < 10 ? 1 : 0)}% of enquiries</div>
                <div className="mt-auto pt-2.5">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, background: s.color }} />
                  </div>
                </div>
                {i > 0 && (
                  <div className="mt-1.5 text-[10px] text-slate-500 2xl:hidden">
                    {conv.toFixed(0)}% of previous step · <span className="text-rose-500">−{(100 - conv).toFixed(0)}%</span>
                  </div>
                )}
              </StageBox>
            </Fragment>
          );
        })}
      </div>

    </div>
  );
}

const kFmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

export function TrendChart({ data }: { data: { month: string; leads: number; leadsLY: number; enrolled?: number; newLeads?: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={kFmt} />
        {data[0]?.newLeads !== undefined && <YAxis yAxisId="m" orientation="right" tick={axis} tickLine={false} axisLine={false} tickFormatter={kFmt} />}
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
        {data[0]?.newLeads !== undefined && (
          <Bar yAxisId="m" dataKey="newLeads" name="New leads in month (right axis)" fill={C.brandLight} fillOpacity={0.55} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        )}
        <Line type="monotone" dataKey="leads" name="Cumulative leads – this cycle" stroke={C.brand} strokeWidth={2.4} dot={{ r: 2.5 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="leadsLY" name="Same period last cycle" stroke={C.slate} strokeDasharray="5 4" strokeWidth={1.8} dot={false} isAnimationActive={false} />
        {data[0]?.enrolled !== undefined && (
          <Line type="monotone" dataKey="enrolled" name="Cumulative enrolled (FABS)" stroke={C.green} strokeWidth={2.2} dot={false} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function GroupedBar({
  data, xKey, bars, height = 260, layout = "horizontal", yAxisWidth = 130,
}: {
  data: Record<string, unknown>[]; xKey: string; bars: { key: string; name: string; color: string; stack?: string }[]; height?: number;
  layout?: "horizontal" | "vertical"; yAxisWidth?: number;
}) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: vertical ? 0 : -8, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="#eef2f7" vertical={vertical} horizontal={!vertical} />
        {/* Recharts only finds axes among direct children — no fragments here. */}
        {vertical ? (
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        ) : (
          <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} interval={0} />
        )}
        {vertical ? (
          <YAxis type="category" dataKey={xKey} tick={axis} tickLine={false} axisLine={false} width={yAxisWidth} interval={0} />
        ) : (
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} stackId={b.stack} radius={b.stack ? 0 : [3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Seat-fill heatmap                                                   */
/* ------------------------------------------------------------------ */
export interface HeatCell { col: string; net: number; seats: number }
export interface HeatRow { id: string; label: string; cells: HeatCell[] }

const HEAT_SCALE: { min: number; label: string; cls: string }[] = [
  { min: 100.5, label: "Over 100", cls: "bg-violet-500 text-white" },
  { min: 95, label: "95–100", cls: "bg-emerald-600 text-white" },
  { min: 85, label: "85–95", cls: "bg-emerald-400 text-white" },
  { min: 75, label: "75–85", cls: "bg-emerald-200 text-emerald-900" },
  { min: 65, label: "65–75", cls: "bg-amber-200 text-amber-900" },
  { min: 50, label: "50–65", cls: "bg-orange-300 text-orange-950" },
  { min: -Infinity, label: "Below 50", cls: "bg-rose-400 text-white" },
];
const heatClass = (v: number) => HEAT_SCALE.find((s) => v >= s.min)!.cls;
const fill = (c: { net: number; seats: number }) => (c.seats ? (c.net / c.seats) * 100 : 0);
const total = (cells: HeatCell[]) => cells.reduce((a, c) => ({ net: a.net + c.net, seats: a.seats + c.seats }), { net: 0, seats: 0 });
const tip = (row: string, col: string, c: { net: number; seats: number }) =>
  `${row} · ${col}\nSeat fill ${fill(c).toFixed(0)}% — ${c.net} net admissions of ${c.seats} seats${c.net > c.seats ? ` (${c.net - c.seats} over)` : ` (${c.seats - c.net} vacant)`}`;

function HeatLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
      <span>Seat fill %</span>
      {[...HEAT_SCALE].reverse().map((s) => (
        <span key={s.label} className="flex items-center gap-1">
          <span className={clsx("h-2.5 w-4 rounded-sm", s.cls.split(" ")[0])} />
          {s.label}
        </span>
      ))}
      <span className="ml-auto text-slate-400">Hover a cell for seats and admissions</span>
    </div>
  );
}

/**
 * Matrix heatmap (rows × shared columns), sized to fit its card, with a Total column and an "All" row.
 * Used for Schools, where every location has the same grades.
 */
/** `onCell(rowId, col)`: makes cells clickable; null row = column total, null col = row total. */
export function Heatmap({
  rows: rawRows, cols, footerLabel = "All locations", onCell,
}: { rows: HeatRow[]; cols: string[]; footerLabel?: string; onCell?: (rowId: string | null, col: string | null) => void }) {
  // Tolerate rows without cells (e.g. a location with no Seat Matrix yet) instead of crashing the page.
  const rows = rawRows.map((r) => ({ ...r, cells: r.cells ?? [] }));
  const colTotals = cols.map((c) => total(rows.flatMap((r) => r.cells.filter((x) => x.col === c))));
  const grand = total(rows.flatMap((r) => r.cells));
  const Cell = ({ c, row, col, strong, go }: { c?: { net: number; seats: number }; row: string; col: string; strong?: boolean; go?: () => void }) =>
    !c || !c.seats ? (
      <td className="rounded bg-slate-50 py-1.5 text-center text-slate-300">–</td>
    ) : (
      <td
        title={tip(row, col, c) + (go ? " · click to drill down" : "")}
        onClick={go}
        className={clsx("rounded py-1.5 text-center tabular", go ? "cursor-pointer hover:ring-2 hover:ring-brand-500 hover:ring-offset-1" : "cursor-default", strong ? "font-bold" : "font-semibold", heatClass(fill(c)))}
      >
        {fill(c).toFixed(0)}
      </td>
    );
  const on = (r: string | null, c: string | null) => (onCell ? () => onCell(r, c) : undefined);
  return (
    <div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-[3px] text-[11px]">
          <colgroup>
            <col className="w-[104px]" />
            {cols.map((c) => <col key={c} />)}
            <col className="w-[52px]" />
          </colgroup>
          <thead>
            <tr className="text-slate-500">
              <th />
              {cols.map((c) => (
                <th key={c} title={c} className="truncate pb-1 text-center font-medium">
                  {c.length > 4 ? c.slice(0, 3) : c}
                </th>
              ))}
              <th className="pb-1 text-center font-semibold text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="truncate pr-1 text-xs font-medium text-slate-700" title={r.label}>{r.label}</td>
                {cols.map((col) => <Cell key={col} c={r.cells.find((x) => x.col === col)} row={r.label} col={col} go={on(r.id, col)} />)}
                <Cell c={total(r.cells)} row={r.label} col="All grades" strong go={on(r.id, null)} />
              </tr>
            ))}
            <tr>
              <td className="truncate pr-1 pt-1 text-xs font-semibold text-slate-800">{footerLabel}</td>
              {cols.map((col, i) => <Cell key={col} c={colTotals[i]} row={footerLabel} col={col} strong go={on(null, col)} />)}
              <Cell c={grand} row={footerLabel} col="All grades" strong go={on(null, null)} />
            </tr>
          </tbody>
        </table>
      </div>
      <HeatLegend />
    </div>
  );
}

/**
 * Ragged heatmap: each row lists its own columns (e.g. a campus's own programmes),
 * avoiding a sparse matrix when rows don't share the same units.
 */
export function HeatList({ rows, onCell }: { rows: HeatRow[]; onCell?: (rowId: string | null, col: string | null) => void }) {
  return (
    <div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const cells = r.cells ?? [];
          const t = total(cells);
          return (
            <div key={r.id} className="grid items-center gap-2 sm:grid-cols-[150px_1fr_64px]">
              <div className="text-xs font-medium text-slate-700">{r.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {cells.map((c) => (
                  <div
                    key={c.col} title={tip(r.label, c.col, c)} onClick={onCell ? () => onCell(r.id, c.col) : undefined}
                    className={clsx("min-w-[92px] rounded-md px-2 py-1 text-[11px] leading-tight", onCell ? "cursor-pointer hover:ring-2 hover:ring-brand-500" : "cursor-default", heatClass(fill(c)))}
                  >
                    <div className="truncate opacity-90">{c.col}</div>
                    <div className="text-sm font-semibold tabular">{fill(c).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
              <div title={tip(r.label, "All programmes", t)} className={clsx("rounded-md px-2 py-1 text-center text-[11px] leading-tight", heatClass(fill(t)))}>
                <div className="opacity-90">Total</div>
                <div className="text-sm font-bold tabular">{fill(t).toFixed(0)}%</div>
              </div>
            </div>
          );
        })}
      </div>
      <HeatLegend />
    </div>
  );
}

/** A funnel stage card; a link (with hover state) when the stage can be drilled into. */
function StageBox({ href, className, children }: { href?: string; className: string; children: ReactNode }) {
  return href ? (
    <Link href={href} title="Drill down to this stage's records" className={clsx(className, "transition hover:border-brand-400 hover:shadow-sm")}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
