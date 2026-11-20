"use client";

import clsx from "clsx";
import { AlertTriangle, ClipboardList, GraduationCap, Percent, Target, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FunnelWide } from "@/components/charts";
import { GradeVacancy, LeadTrend, Panel, SnapshotCard, SourcePerformance } from "@/components/dashboard-widgets";
import { Dropdown } from "@/components/dropdown";
import { ExportButtons } from "@/components/export-buttons";
import { LocationPicker, useCurrentLocation } from "@/components/location-picker";
import { Badge, Guard, PageHeader, ProgressBar, fmt, fmtPct } from "@/components/ui";
import { useApp } from "@/lib/context";
import { dashboardData } from "@/lib/dashboard";
import { buildAlerts, counsellorPerf, kpis, locationUnits, mappingQueue, pct, sumStats, SYNC_STATUS } from "@/lib/data";

export default function AdmissionsReportsPage() {
  return (
    <Guard perm="view.location">
      <AdmissionsReports />
    </Guard>
  );
}

function AdmissionsReports() {
  const { cycle, role, school, seatVersion } = useApp();
  const loc = useCurrentLocation();
  const [unitState, setUnit] = useState("All");
  const unit = unitState === "All" || loc.units.includes(unitState) ? unitState : "All";
  const unitLabel = loc.vertical === "Schools" ? "Grade" : "Programme";

  const allUnits = useMemo(() => locationUnits(loc.id, cycle), [loc.id, cycle, seatVersion]);
  const units = unit === "All" ? allUnits : allUnits.filter((u) => u.unit === unit);
  const t = sumStats(units);
  const k = kpis(t);
  const d = useMemo(() => dashboardData({ ids: [loc.id], cycle, grade: unit, sourceGroup: "All", dateRange: "cycle" }), [loc.id, cycle, unit, seatVersion]);
  const counsellors = useMemo(() => counsellorPerf(loc.id, cycle), [loc.id, cycle, seatVersion]);
  const insights = useMemo(() => buildAlerts(cycle).filter((a) => a.locationId === loc.id), [loc.id, cycle, seatVersion]);
  const openWork = useMemo(() => {
    const open = mappingQueue(loc.id).filter((m) => m.state === "suggested" || m.state === "unmatched");
    return { mapping: open.length, overdue: open.filter((m) => m.fabs.hoursSinceEntry > 48).length };
  }, [loc.id]);

  const visibleCounsellors = counsellors.filter((c) => role !== "counsellor" || c.name === "Neha Arora");
  const bestConv = Math.max(...visibleCounsellors.map((c) => c.conv), 1);
  const ch = d.change;

  return (
    <>
      <PageHeader
        title="Admissions Reports"
        subtitle={
          <>
            <b className="font-semibold text-slate-700">{loc.name}</b> · {loc.vertical} · {loc.board} · {loc.city} · session {cycle.replace("-", "–")}
            {unit !== "All" && <> · {unitLabel} <b className="font-semibold text-slate-700">{unit}</b></>}
          </>
        }
        actions={
          <>
            {school === "all" && <LocationPicker />}
            <Dropdown
              size="sm"
              ariaLabel={unitLabel}
              value={unit}
              onChange={setUnit}
              options={[{ value: "All", label: `All ${unitLabel.toLowerCase()}s` }, ...loc.units.map((u) => ({ value: u, label: u }))]}
            />
            <ExportButtons
              name={`${loc.id}-${cycle}-admissions`}
              rows={() =>
                allUnits.map((u) => ({
                  [unitLabel]: u.unit, Seats: u.seats, Target: u.target, Leads: u.leads, Registered: u.registered, Offers: u.offers,
                  "LeadSquared confirmed": u.crmConfirmed, "FABS enrolled": u.enrolled, "Withdrawn (new)": u.withdrawnNew,
                  Vacancy: Math.max(0, u.seats - (u.enrolled - u.withdrawnNew)), "Seat fill %": pct(u.enrolled - u.withdrawnNew, u.seats).toFixed(1),
                }))
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <SnapshotCard theme="blue" icon={Users} label="Total Leads" value={k.leads} change={ch("leads")} sub="Enquiries in LeadSquared" />
        <SnapshotCard theme="green" icon={ClipboardList} label="Applications" value={k.applications} change={ch("applications")} sub={`${fmtPct(k.leadToApp)} of leads`} />
        <SnapshotCard theme="violet" icon={UserCheck} label="Admission confirmed" value={k.crmConfirmed} change={null} sub={`${fmt(k.offers)} offers issued`} />
        <SnapshotCard theme="violet" icon={GraduationCap} label="Fee paid / Enrolled" value={k.enrolled} change={ch("admissions")} sub="Admission no. generated in FABS" />
        <SnapshotCard
          theme={k.seatFill < 72 ? "rose" : k.seatFill < 82 ? "orange" : "green"}
          icon={Percent}
          label="Seat fill"
          value={fmtPct(k.seatFill)}
          change={null}
          sub={`${fmt(k.vacancies)} vacancies of ${fmt(k.seats)} seats`}
        />
        <SnapshotCard theme="orange" icon={Target} label="Target achievement" value={fmtPct(k.targetAch)} change={null} sub={`${fmt(k.enrolled)} of ${fmt(t.target)} target`} />
      </div>

      {/* Secondary measures */}
      <div className="mt-3 grid grid-cols-2 divide-slate-100 rounded-xl border border-slate-200 bg-white text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Stat label="Net admissions" value={fmt(k.net)} sub="enrolled − new-adm. withdrawals" />
        <Stat label="Overall conversion" value={fmtPct(k.overall, 1)} sub={`app → admission ${fmtPct(k.appToAdm)}`} />
        <Stat label="Withdrawals" value={fmt(k.withdrawals)} sub={`${k.withdrawnNew} new · ${k.withdrawnExisting} existing`} href="/strength" />
        <Stat label="Pending fee" value={fmt(k.pending)} sub={`${t.pendingFee[2]} over 15 days`} tone={t.pendingFee[2] ? "warn" : undefined} />
        <Stat label="Unmapped FABS adm." value={fmt(k.unmapped)} sub="open the Mapping queue" href="/mapping" tone={k.unmapped ? "bad" : undefined} />
        <Stat label="EWS/DG fill" value={t.ewsSeats ? fmtPct(k.ewsFill, 0) : "—"} sub={t.ewsSeats ? `${t.ewsFilled} of ${t.ewsSeats} reserved` : "no reserved seats"} />
      </div>

      <Panel className="mt-4" title="Admissions funnel" sub="LeadSquared → SaaS → FABS · each stage read from one system of record">
        <FunnelWide t={t} />
      </Panel>

      <div className="mt-4 grid items-stretch gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <GradeVacancy d={d} />

        <Panel title="Needs attention" sub="alerts and open work for this school" className="h-full" bodyClass="px-0 pb-0 pt-1">
          <ul className="divide-y divide-slate-100">
            {insights.map((a) => (
              <li key={a.id} className="flex gap-2.5 px-4 py-2.5 text-sm">
                <AlertTriangle size={16} className={clsx("mt-0.5 shrink-0", a.severity === "high" ? "text-rose-500" : a.severity === "medium" ? "text-amber-500" : "text-slate-400")} />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{a.title}</div>
                  <div className="text-xs text-slate-500">{a.detail}</div>
                </div>
              </li>
            ))}
            {!insights.length && <li className="px-4 py-3 text-sm text-slate-500">No alerts for this school.</li>}
          </ul>
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 py-3">
            <TodoTile href="/mapping" label="Mapping queue" value={openWork.mapping} sub={openWork.overdue ? `${openWork.overdue} over 48 h` : "none overdue"} bad={openWork.overdue > 0} />
            <TodoTile label="Fee pending >15 days" value={t.pendingFee[2]} sub={`of ${fmt(k.pending)}`} bad={t.pendingFee[2] > 0} />
            <TodoTile href="/strength" label="Withdrawals" value={k.withdrawals} sub={`${k.withdrawnNew} new adm.`} bad={false} />
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Data freshness</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {SYNC_STATUS.map((s) => (
                <div key={s.system} className="flex items-center gap-1.5 text-slate-600">
                  <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", s.status === "ok" ? "bg-emerald-500" : "bg-amber-500")} />
                  <span className="truncate">{s.system}</span>
                  <span className={clsx("ml-auto shrink-0", s.status === "ok" ? "text-slate-400" : "font-medium text-amber-700")}>{s.minutesAgo}m</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid items-stretch gap-4 2xl:grid-cols-2">
        <SourcePerformance d={d} />
        <LeadTrend d={d} />
      </div>

      <Panel className="mt-4" title="Counsellor performance" sub="LeadSquared lead owner · conversion uses FABS admissions matched to a lead">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Counsellor</th>
                <th className="px-3 py-2 text-right font-medium">Leads owned</th>
                <th className="px-3 py-2 text-right font-medium">Offers</th>
                <th className="px-3 py-2 text-right font-medium">Confirmed</th>
                <th className="px-3 py-2 text-right font-medium">Enrolled</th>
                <th className="px-3 py-2 text-left font-medium">Lead → enrolled</th>
                <th className="px-3 py-2 text-left font-medium">Open mapping</th>
                <th className="px-3 py-2 text-left font-medium">Overdue follow-ups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...visibleCounsellors].sort((a, b) => b.conv - a.conv).map((c) => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.leads)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.offers)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.confirmed)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(c.enrolled)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-28"><ProgressBar value={c.conv} max={bestConv * 1.1} tone={c.conv === bestConv ? "bg-emerald-500" : "bg-brand-500"} /></div>
                      <span className={clsx("w-12", c.conv === bestConv && "font-semibold text-emerald-700")}>{fmtPct(c.conv, 1)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{c.pendingMapping ? <Link href="/mapping"><Badge tone="amber">{c.pendingMapping} open</Badge></Link> : <span className="text-slate-400">0</span>}</td>
                  <td className="px-3 py-2"><span className="text-xs text-slate-400" title="Needs LeadSquared activity history via API (open item #6)">Awaiting LeadSquared API</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {role === "counsellor" && <p className="mt-2 text-xs text-slate-500">Counsellors see their own row only.</p>}
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Stat({ label, value, sub, href, tone }: { label: string; value: string; sub: string; href?: string; tone?: "warn" | "bad" }) {
  const body = (
    <div className={clsx("px-3 py-2.5", href && "transition hover:bg-slate-50")}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={clsx("text-lg font-semibold tabular", tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-700" : "text-slate-900")}>{value}</div>
      <div className="truncate text-[11px] text-slate-500">{sub}{href && " →"}</div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function TodoTile({ label, value, sub, bad, href }: { label: string; value: number; sub: string; bad: boolean; href?: string }) {
  const body = (
    <div className={clsx("h-full rounded-lg border px-2.5 py-2 transition", bad ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50/60", href && "hover:border-brand-300")}>
      <div className="truncate text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular text-slate-900">{fmt(value)}</div>
      <div className={clsx("truncate text-[11px]", bad ? "text-amber-700" : "text-slate-400")}>{sub}{href && " →"}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
