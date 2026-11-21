"use client";

import clsx from "clsx";
import { Percent, Search, TrendingUp, UserMinus, UserRoundX, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C } from "@/components/charts";
import { Panel, SnapshotCard } from "@/components/dashboard-widgets";
import { Dropdown } from "@/components/dropdown";
import { ExportButtons } from "@/components/export-buttons";
import { Badge, Guard, PageHeader, ProgressBar, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import {
  locationUnits, pct, strengthMovement, totalsFor, WITHDRAWAL_REASONS, withdrawalRecords,
} from "@/lib/data";

const axis = { fontSize: 11, fill: "#64748b" };
const NEW = "#e11d48";
const EXISTING = "#fda4af";
const PAGE = 10;

export default function WithdrawalsPage() {
  return (
    <Guard perm="view.location">
      <Withdrawals />
    </Guard>
  );
}

function Withdrawals() {
  const { filteredLocations, cycle, seatVersion } = useApp();
  const locs = filteredLocations;
  const ids = locs.map((l) => l.id);
  const key = ids.join() + cycle;

  const t = useMemo(() => totalsFor(ids, cycle), [key, seatVersion]);
  const movement = useMemo(() => strengthMovement(ids, cycle), [key]);
  const records = useMemo(() => withdrawalRecords(ids), [ids.join()]);

  const opening = movement[0]?.opening ?? 0;
  const closing = movement.at(-1)?.closing ?? 0;
  const closingLY = movement.at(-1)?.closingLY ?? 0;
  const wTotal = t.withdrawnNew + t.withdrawnExisting;
  const wRate = pct(wTotal, opening + t.enrolled);
  const newRate = pct(t.withdrawnNew, t.enrolled);
  const exRate = pct(t.withdrawnExisting, t.continuing);
  const ytd = movement.reduce((a, m) => ({ enrol: a.enrol + m.enrolments, wNew: a.wNew + m.withdrawnNew, wEx: a.wEx + m.withdrawnExisting }), { enrol: 0, wNew: 0, wEx: 0 });

  const peakMonth = movement.reduce((a, m) => (m.withdrawals > a.withdrawals ? m : a), movement[0]);

  // Grade / programme breakdown only when one school or institution is selected.
  const single = locs.length === 1 ? locs[0] : null;
  const unitWord = single?.vertical === "Higher Ed" ? "programme" : "grade";
  const byUnit = useMemo(
    () =>
      single
        ? locationUnits(single.id, cycle).map((u) => ({
            unit: u.unit, strength: u.continuing + u.enrolled - u.withdrawnNew - u.withdrawnExisting,
            base: u.continuing + u.enrolled, wNew: u.withdrawnNew, wEx: u.withdrawnExisting,
          }))
        : [],
    [key, seatVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const rateMax = Math.max(6, ...byUnit.map((u) => pct(u.wNew + u.wEx, u.base)));

  return (
    <>
      <PageHeader
        title="Withdrawals"
        subtitle={`Students leaving and when — plus strength movement · FABS withdrawals and roster · session ${cycle.replace("-", "–")}`}
        actions={
          <ExportButtons
            name={`withdrawals-${cycle}`}
            rows={() => [
              ...movement.map((m) => ({ Section: "Month", Month: m.month, [single ? "Grade / programme" : "Scope"]: single ? "All" : `${locs.length} locations`, "New admission": m.withdrawnNew, "Existing student": m.withdrawnExisting, Total: m.withdrawnNew + m.withdrawnExisting })),
              ...byUnit.map((u) => ({ Section: "Grade / programme", Month: "Year to date", "Grade / programme": u.unit, "New admission": u.wNew, "Existing student": u.wEx, Total: u.wNew + u.wEx })),
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
        <SnapshotCard theme="rose" icon={UserMinus} label="Withdrawals" value={wTotal} change={null} sub={`${wRate.toFixed(1)}% of students on roll this year`} />
        <SnapshotCard theme="rose" icon={UserRoundX} label="New-admission withdrawn" value={t.withdrawnNew} change={null} sub={`${newRate.toFixed(1)}% of ${fmt(t.enrolled)} new admissions`} />
        <SnapshotCard theme="orange" icon={Percent} label="Existing-student withdrawn" value={t.withdrawnExisting} change={null} sub={`${exRate.toFixed(1)}% of ${fmt(t.continuing)} continuing students`} />
        <SnapshotCard theme="blue" icon={Users} label="Current strength" value={closing} change={closingLY ? ((closing - closingLY) / closingLY) * 100 : null} sub="Active students on the FABS roster" />
        <SnapshotCard theme="green" icon={TrendingUp} label="Net change since 1 Apr" value={`${closing - opening >= 0 ? "+" : "−"}${fmt(Math.abs(closing - opening))}`} change={null} sub={`+${fmt(ytd.enrol)} enrolled · −${fmt(ytd.wNew + ytd.wEx)} withdrawn`} />
      </div>

      {/* When students leave — and, for one school, from which grade */}
      <div className={clsx("mt-4 grid items-stretch gap-4", single && "2xl:grid-cols-2")}>
        <Panel title="Withdrawals by month" sub={`(Apr – Nov) · peak in ${peakMonth?.month ?? "—"}`} className="h-full">
          <ResponsiveContainer width="100%" height={single ? 330 : 280}>
            <BarChart data={movement} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f1f5f9" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="withdrawnNew" name="New admission" stackId="m" fill={NEW} maxBarSize={single ? 30 : 40} isAnimationActive={false} />
              <Bar dataKey="withdrawnExisting" name="Existing student" stackId="m" fill={EXISTING} radius={[3, 3, 0, 0]} maxBarSize={single ? 30 : 40} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          {!single && <p className="mt-2 text-[11px] text-slate-500">Pick a school in the Global Filters to see withdrawals by grade.</p>}
        </Panel>

        {single && (
          <Panel title={`Withdrawals by ${unitWord}`} sub={`${single.short} · rate = withdrawals ÷ students on roll this year`} className="h-full">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[440px] table-fixed text-sm tabular">
                <colgroup><col className="w-[22%]" /><col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col /></colgroup>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">{unitWord === "grade" ? "Grade" : "Programme"}</th>
                    <th className="px-3 py-2 text-right font-medium">Strength</th>
                    <th className="px-3 py-2 text-right font-medium">New adm.</th>
                    <th className="px-3 py-2 text-right font-medium">Existing</th>
                    <th className="py-2 pl-3 text-left font-medium">Withdrawal rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byUnit.map((u) => {
                    const rate = pct(u.wNew + u.wEx, u.base);
                    return (
                      <tr key={u.unit} className="hover:bg-slate-50/70">
                        <td className="truncate py-2 pr-3 font-medium text-slate-800">{u.unit.replace(/ – Y1$/, "")}</td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{fmt(u.strength)}</td>
                        <td className={clsx("px-3 py-1.5 text-right", u.wNew ? "text-rose-600" : "text-slate-300")}>{u.wNew}</td>
                        <td className={clsx("px-3 py-1.5 text-right", u.wEx ? "text-rose-400" : "text-slate-300")}>{u.wEx}</td>
                        <td className="py-1.5 pl-3"><RateBar rate={rate} max={rateMax} /></td>
                      </tr>
                    );
                  })}
                  {!byUnit.length && <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">No grades or programmes for this school.</td></tr>}
                </tbody>
              </table>
            </div>
            <RateLegend />
          </Panel>
        )}
      </div>

      <WithdrawalRegister records={records} />

      {/* Strength movement */}
      <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-brand-900">Strength movement</h2>
          <p className="mt-0.5 text-xs text-slate-500">Opening strength on 1 April + new enrolments − withdrawals = closing strength</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Opening <b className="tabular text-slate-900">{fmt(opening)}</b></span>
          <span className="text-slate-400">→</span>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">Closing <b className="tabular">{fmt(closing)}</b></span>
        </div>
      </div>
      <div className="grid items-stretch gap-4 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Monthly movement" sub="bars: enrolments up, withdrawals down · lines: closing strength vs last year" className="h-full">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={movement.map((m) => ({ ...m, wNewNeg: -m.withdrawnNew, wExNeg: -m.withdrawnExisting }))} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(Math.abs(v))} />
              <YAxis
                yAxisId="r" orientation="right" tick={axis} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                domain={[(min: number) => Math.max(0, Math.floor((min * 0.97) / 100) * 100), (max: number) => Math.ceil((max * 1.01) / 100) * 100]}
              />
              <ReferenceLine yAxisId="l" y={0} stroke="#cbd5e1" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => fmt(Math.abs(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
              <Bar yAxisId="l" stackId="m" dataKey="enrolments" name="New enrolments" fill={C.green} maxBarSize={26} isAnimationActive={false} />
              <Bar yAxisId="l" stackId="m" dataKey="wNewNeg" name="Withdrawn – new" fill={NEW} maxBarSize={26} isAnimationActive={false} />
              <Bar yAxisId="l" stackId="m" dataKey="wExNeg" name="Withdrawn – existing" fill={EXISTING} maxBarSize={26} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="closing" name="Closing strength" stroke={C.brand} strokeWidth={2.4} dot={{ r: 3 }} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="closingLY" name="Closing – last year" stroke={C.slate} strokeDasharray="5 4" strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Month by month" className="h-full">
          <table className="w-full text-right text-sm tabular">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider">
                <th colSpan={3} />
                <th colSpan={2} className="rounded-t-md bg-rose-50 px-2 pt-1.5 text-center text-rose-700">Withdrawn</th>
                <th />
              </tr>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 text-left font-medium">Month</th>
                <th className="px-2 py-2 font-medium">Opening</th>
                <th className="px-2 py-2 font-medium">Enrolled</th>
                <th className="bg-rose-50/60 px-2 py-2 font-medium">New adm.</th>
                <th className="bg-rose-50/60 px-2 py-2 font-medium">Existing</th>
                <th className="py-2 pl-2 font-medium">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movement.map((m) => (
                <tr key={m.month} className={clsx("hover:bg-slate-50/70", m.month === peakMonth?.month && "bg-rose-50/30")}>
                  <td className="py-1.5 pr-2 text-left font-medium">
                    {m.month}
                    {m.month === peakMonth?.month && <span className="ml-1.5 text-[10px] font-semibold uppercase text-rose-600">peak</span>}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{fmt(m.opening)}</td>
                  <td className="px-2 py-1.5 text-emerald-700">+{fmt(m.enrolments)}</td>
                  <td className="px-2 py-1.5 text-rose-600">−{fmt(m.withdrawnNew)}</td>
                  <td className="px-2 py-1.5 text-rose-400">−{fmt(m.withdrawnExisting)}</td>
                  <td className="py-1.5 pl-2 font-semibold">{fmt(m.closing)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="py-1.5 pr-2 text-left">YTD</td>
                <td className="px-2 py-1.5">{fmt(opening)}</td>
                <td className="px-2 py-1.5 text-emerald-700">+{fmt(ytd.enrol)}</td>
                <td className="px-2 py-1.5 text-rose-600">−{fmt(ytd.wNew)}</td>
                <td className="px-2 py-1.5 text-rose-400">−{fmt(ytd.wEx)}</td>
                <td className="py-1.5 pl-2">{fmt(closing)}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

const rateTone = (r: number) => (r >= 5 ? "bg-rose-500" : r >= 3 ? "bg-amber-400" : "bg-emerald-500");

function RateBar({ rate, max }: { rate: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[48px] flex-1"><ProgressBar value={rate} max={max} tone={rateTone(rate)} /></div>
      <span className={clsx("w-11 shrink-0 text-right text-xs tabular", rate >= 5 ? "font-semibold text-rose-600" : rate >= 3 ? "text-amber-700" : "text-slate-600")}>{rate.toFixed(1)}%</span>
    </div>
  );
}

function RateLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
      <span>Withdrawal rate</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-emerald-500" /> under 3%</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-amber-400" /> 3–5%</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-rose-500" /> 5% or more</span>
    </div>
  );
}

type WRecord = ReturnType<typeof withdrawalRecords>[number];

function WithdrawalRegister({ records }: { records: WRecord[] }) {
  const [type, setType] = useState<"All" | "New admission" | "Existing student">("All");
  const [reason, setReason] = useState("All");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const s = q.trim().toLowerCase();
  const filtered = records.filter(
    (r) => (type === "All" || r.type === type) && (reason === "All" || r.reason === reason) && (!s || `${r.child} ${r.admNo}`.toLowerCase().includes(s)),
  );
  const shown = showAll ? filtered : filtered.slice(0, PAGE);

  return (
    <Panel
      className="mt-4"
      title="Withdrawal register"
      sub="recent withdrawals from FABS · corrections are made in FABS · refund status awaits a FABS field (open item #7)"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-56">
          <Search size={13} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or admission no." className="w-full text-xs outline-none" />
        </label>
        <Dropdown<"All" | "New admission" | "Existing student">
          size="sm" ariaLabel="Type" value={type} onChange={setType}
          options={[{ value: "All", label: "All types" }, { value: "New admission", label: "New admission" }, { value: "Existing student", label: "Existing student" }]}
        />
        <Dropdown size="sm" ariaLabel="Reason" value={reason} onChange={setReason} options={[{ value: "All", label: "All reasons" }, ...WITHDRAWAL_REASONS.map((r) => ({ value: r, label: r }))]} />
        {(type !== "All" || reason !== "All" || q) && (
          <button onClick={() => { setType("All"); setReason("All"); setQ(""); }} className="text-xs font-medium text-brand-700 hover:underline">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} of {records.length} withdrawals</span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[900px] table-fixed text-sm tabular">
          <colgroup>
            <col className="w-[15%]" /><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left font-medium">Admission no.</th>
              <th className="px-3 py-2 text-left font-medium">Student</th>
              <th className="px-3 py-2 text-left font-medium">School</th>
              <th className="px-3 py-2 text-left font-medium">Grade / programme</th>
              <th className="px-3 py-2 text-left font-medium">Withdrawn on</th>
              <th className="px-3 py-2 text-left font-medium">Reason</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.admNo} className="hover:bg-slate-50">
                <td className="truncate px-3 py-2.5 font-mono text-xs text-slate-600">{r.admNo}</td>
                <td className="truncate px-3 py-2.5 font-medium text-slate-900">{r.child}</td>
                <td className="truncate px-3 py-2.5 text-slate-600">{r.location}</td>
                <td className="truncate px-3 py-2.5 text-slate-700">{r.unit.replace(/ – Y1$/, "")}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{r.date}</td>
                <td className="truncate px-3 py-2.5"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{r.reason}</span></td>
                <td className="px-3 py-2.5">
                  <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium", r.type === "New admission" ? "text-rose-700" : "text-slate-600")}>
                    <span className="h-2 w-2 rounded-full" style={{ background: r.type === "New admission" ? NEW : EXISTING }} />
                    {r.type}
                  </span>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">No withdrawals match.</td></tr>}
          </tbody>
        </table>
      </div>
      {filtered.length > PAGE && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Showing {shown.length} of {filtered.length}</span>
          <button onClick={() => setShowAll((v) => !v)} className="rounded-md px-2.5 py-1 font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
            {showAll ? "Show fewer" : `Show all ${filtered.length}`}
          </button>
        </div>
      )}
    </Panel>
  );
}
