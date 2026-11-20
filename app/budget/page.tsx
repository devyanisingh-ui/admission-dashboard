"use client";

import clsx from "clsx";
import { AlertTriangle, Award, ClipboardList, GraduationCap, IndianRupee, PiggyBank, Target, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, SnapshotCard, SOURCE_COLORS } from "@/components/dashboard-widgets";
import { ExportButtons } from "@/components/export-buttons";
import { Guard, PageHeader, Tabs, fmt, fmtINR } from "@/components/ui";
import { BudgetEntry } from "./entry";
import { useApp } from "@/lib/context";
import { pct } from "@/lib/data";
import { outreachByActivity, outreachMonthly, outreachTotals, type OutreachRow } from "@/lib/marketing";

const axis = { fontSize: 11, fill: "#64748b" };
const lakhAxis = (v: number) => (v === 0 ? "₹0" : `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`);

export default function BudgetPage() {
  return (
    <Guard perm="view.marketing">
      <Budget />
    </Guard>
  );
}

function Budget() {
  const { filteredLocations, cycle, seatVersion, can } = useApp();
  const [tab, setTab] = useState<"report" | "entry">("report");
  const ids = filteredLocations.map((l) => l.id);
  const key = ids.join() + cycle + seatVersion;
  const rows = useMemo(() => outreachByActivity(ids, cycle), [key]);
  const t = useMemo(() => outreachTotals(ids, cycle), [key]);
  const monthly = useMemo(() => outreachMonthly(ids, cycle), [key]);
  const bySchool = useMemo(
    () => filteredLocations.map((l) => ({ loc: l, ...outreachTotals([l.id], cycle) })).sort((a, b) => a.cpa - b.cpa),
    [key],
  );
  const util = pct(t.spent, t.allocated);
  const withAdm = rows.filter((r) => r.admissions);
  const best = withAdm.reduce((a, r) => (r.cpa < a.cpa ? r : a), withAdm[0]);
  const worst = withAdm.reduce((a, r) => (r.cpa > a.cpa ? r : a), withAdm[0]);
  const over = rows.filter((r) => r.spent > r.allocated);

  return (
    <>
      <PageHeader
        title="Budget & Outreach"
        subtitle={`Budget and spend are entered by hand · leads from LeadSquared · admissions from FABS (matched to a lead) · session ${cycle.replace("-", "–")}`}
        actions={
          <ExportButtons
            name={`budget-outreach-${cycle}`}
            rows={() => rows.map((r) => ({ Activity: r.type, "Allocated (₹)": r.allocated, "Spent (₹)": r.spent, "Utilised %": pct(r.spent, r.allocated).toFixed(1), Activities: r.activities, Leads: r.leads, Admissions: r.admissions, "Cost per lead (₹)": Math.round(r.cpl), "Cost per admission (₹)": Math.round(r.cpa) }))}
          />
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "report", label: "Report" },
          { id: "entry", label: <>Data entry {can("marketing.edit") && <span className="ml-1 rounded bg-brand-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-700">Edit</span>}</> },
        ]}
      />
      {tab === "entry" ? <BudgetEntry /> : <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <SnapshotCard theme="blue" icon={Wallet} label="Budget allocated" value={fmtINR(t.allocated)} change={null} sub={`${filteredLocations.length} school${filteredLocations.length === 1 ? "" : "s"} · annual plan`} />
        <SnapshotCard theme="orange" icon={IndianRupee} label="Actual spend" value={fmtINR(t.spent)} change={null} sub={`${util.toFixed(0)}% of budget utilised`} />
        <SnapshotCard theme="blue" icon={PiggyBank} label="Budget remaining" value={fmtINR(Math.max(0, t.allocated - t.spent))} change={null} sub={t.spent > t.allocated ? "Over budget" : "Available for the rest of the cycle"} />
        <SnapshotCard theme="violet" icon={ClipboardList} label="Activities run" value={t.activities} change={null} sub="Campaigns, fairs, activations, events" />
        <SnapshotCard theme="green" icon={Users} label="Leads generated" value={t.leads} change={null} sub={`Cost per lead ${fmtINR(t.cpl)}`} />
        <SnapshotCard theme="rose" icon={GraduationCap} label="Admissions" value={t.admissions} change={null} sub={`Cost per admission ${fmtINR(t.cpa)}`} />
      </div>

      {/* Highlights */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {best && (
          <Highlight icon={Award} tone="green" title="Most efficient channel" value={best.type} detail={`${fmtINR(best.cpa)} per admission · ${fmt(best.admissions)} admissions`} />
        )}
        {worst && worst !== best && (
          <Highlight icon={Target} tone="amber" title="Costliest per admission" value={worst.type} detail={`${fmtINR(worst.cpa)} per admission — ${(worst.cpa / best.cpa).toFixed(1)}× the most efficient`} />
        )}
        <Highlight
          icon={AlertTriangle}
          tone={over.length ? "red" : "slate"}
          title="Over budget"
          value={over.length ? `${over.length} activit${over.length === 1 ? "y" : "ies"}` : "None"}
          detail={over.length ? over.map((r) => `${r.type} (+${fmtINR(r.spent - r.allocated)})`).join(" · ") : "Every activity is within its allocation"}
        />
      </div>

      <div className="mt-4 grid items-stretch gap-4 2xl:grid-cols-2">
        <Panel title="Budget utilisation by activity" sub="spend against allocation" className="h-full">
          <ul className="space-y-3.5">
            {rows.map((r) => <UtilisationRow key={r.type} r={r} />)}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-slate-200" /> Allocated</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-brand-500" /> Spent</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-400" /> Over 90%</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-rose-500" /> Over budget</span>
          </div>
        </Panel>

        <Panel title="Monthly spend vs plan" sub={`(Oct – Sep) · ${util.toFixed(0)}% of the annual plan spent`} className="h-full">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={lakhAxis} width={48} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [fmtINR(v), n]} cursor={{ fill: "#f1f5f9" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="spent" name="Actual spend" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Line dataKey="planned" name="Plan" stroke="#1e3a8a" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel className="mt-4" title="Outcomes by activity" sub="leads from the matching LeadSquared source group · admissions from FABS matched to a lead">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Activity</th>
                <th className="px-3 py-2 text-right font-medium">Spent</th>
                <th className="px-3 py-2 text-right font-medium">Activities</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
                <th className="px-3 py-2 text-right font-medium">Admissions</th>
                <th className="px-3 py-2 text-right font-medium">Conv.</th>
                <th className="px-3 py-2 text-left font-medium">Share of spend vs admissions</th>
                <th className="px-3 py-2 text-right font-medium">Cost / lead</th>
                <th className="px-3 py-2 text-right font-medium">Cost / admission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const spendShare = pct(r.spent, t.spent);
                const admShare = pct(r.admissions, t.admissions);
                return (
                  <tr key={r.type} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLORS[r.group] }} />
                        {r.type}
                      </div>
                      <div className="pl-[18px] text-[11px] text-slate-400">{r.group} leads</div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtINR(r.spent)}</td>
                    <td className="px-3 py-2 text-right">{r.activities} <span className="text-[11px] text-slate-400">{r.unit}</span></td>
                    <td className="px-3 py-2 text-right">{fmt(r.leads)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.admissions)}</td>
                    <td className="px-3 py-2 text-right">{pct(r.admissions, r.leads).toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      <ShareBars spend={spendShare} adm={admShare} />
                    </td>
                    <td className="px-3 py-2 text-right">{fmtINR(r.cpl)}</td>
                    <td className={clsx("px-3 py-2 text-right", r === best ? "font-semibold text-emerald-700" : r === worst ? "font-semibold text-rose-600" : "")}>{fmtINR(r.cpa)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{fmtINR(t.spent)}</td>
                <td className="px-3 py-2 text-right">{t.activities}</td>
                <td className="px-3 py-2 text-right">{fmt(t.leads)}</td>
                <td className="px-3 py-2 text-right">{fmt(t.admissions)}</td>
                <td className="px-3 py-2 text-right">{pct(t.admissions, t.leads).toFixed(1)}%</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fmtINR(t.cpl)}</td>
                <td className="px-3 py-2 text-right">{fmtINR(t.cpa)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Share bars: <span className="font-medium text-orange-600">spend</span> vs <span className="font-medium text-emerald-600">admissions</span> — a longer green bar means the channel brings more than its share of admissions.
          Green / red cost = cheapest / costliest per admission.
        </p>
      </Panel>

      {bySchool.length > 1 && (
        <Panel className="mt-4" title="By school" sub="sorted by cost per admission, lowest first">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">School</th>
                  <th className="px-3 py-2 text-right font-medium">Allocated</th>
                  <th className="px-3 py-2 text-right font-medium">Spent</th>
                  <th className="px-3 py-2 text-left font-medium">Utilised</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Admissions</th>
                  <th className="px-3 py-2 text-right font-medium">Cost / lead</th>
                  <th className="px-3 py-2 text-right font-medium">Cost / admission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bySchool.map((s, i) => {
                  const u = pct(s.spent, s.allocated);
                  return (
                    <tr key={s.loc.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.loc.short}</div>
                        <div className="text-[11px] text-slate-400">{s.loc.vertical} · {s.loc.board}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{fmtINR(s.allocated)}</td>
                      <td className="px-3 py-2 text-right">{fmtINR(s.spent)}</td>
                      <td className="px-3 py-2"><UtilBar value={u} /></td>
                      <td className="px-3 py-2 text-right">{fmt(s.leads)}</td>
                      <td className="px-3 py-2 text-right">{fmt(s.admissions)}</td>
                      <td className="px-3 py-2 text-right">{fmtINR(s.cpl)}</td>
                      <td className={clsx("px-3 py-2 text-right font-semibold", i === 0 && "text-emerald-700", i === bySchool.length - 1 && "text-rose-600")}>{fmtINR(s.cpa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      </>}
    </>
  );
}

/* ------------------------------------------------------------------ */

const HIGHLIGHT_TONE = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

function Highlight({ icon: Icon, tone, title, value, detail }: { icon: typeof Award; tone: keyof typeof HIGHLIGHT_TONE; title: string; value: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", HIGHLIGHT_TONE[tone])}><Icon size={17} /></span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{title}</div>
        <div className="text-sm font-semibold text-brand-900">{value}</div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

/** Allocation track with spend fill; turns amber over 90% and red when over budget. */
function UtilisationRow({ r }: { r: OutreachRow }) {
  const u = pct(r.spent, r.allocated);
  const over = r.spent > r.allocated;
  const scale = Math.max(1, r.allocated, r.spent);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[r.group] }} />
          <span className="truncate">{r.type}</span>
        </span>
        <span className="shrink-0 text-xs text-slate-500 tabular">
          <b className="text-slate-900">{fmtINR(r.spent)}</b> of {fmtINR(r.allocated)}
          <span className={clsx("ml-2 inline-block w-11 text-right font-semibold", over ? "text-rose-600" : u > 90 ? "text-amber-700" : "text-slate-700")}>{u.toFixed(0)}%</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className={clsx("absolute inset-y-0 left-0 rounded-full", over ? "bg-rose-500" : u > 90 ? "bg-amber-400" : "bg-brand-500")} style={{ width: `${(r.spent / scale) * 100}%` }} />
        {over && <div className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: `${(r.allocated / scale) * 100}%` }} title="Allocation" />}
      </div>
    </li>
  );
}

function ShareBars({ spend, adm }: { spend: number; adm: number }) {
  const max = 40;
  return (
    <div className="w-44 space-y-0.5 text-[10px] tabular">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, (spend / max) * 100)}%` }} /></div>
        <span className="w-8 text-right text-slate-500">{spend.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (adm / max) * 100)}%` }} /></div>
        <span className={clsx("w-8 text-right", adm > spend ? "font-semibold text-emerald-700" : "text-slate-500")}>{adm.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function UtilBar({ value }: { value: number }) {
  return (
    <div className="flex w-36 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full", value > 100 ? "bg-rose-500" : value > 90 ? "bg-amber-400" : "bg-brand-500")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={clsx("w-10 text-right text-xs", value > 100 && "font-semibold text-rose-600")}>{value.toFixed(0)}%</span>
    </div>
  );
}
