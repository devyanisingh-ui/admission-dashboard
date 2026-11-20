"use client";

import clsx from "clsx";
import { Award, GraduationCap, Handshake, Percent, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dropdown } from "@/components/dropdown";
import { Panel, SnapshotCard } from "@/components/dashboard-widgets";
import { ExportButtons } from "@/components/export-buttons";
import { Badge, Guard, PageHeader, ProgressBar, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import { locationById, pct } from "@/lib/data";
import { partnerMonthly, partnersFor, PARTNER_TYPES, type Partner, type PartnerType } from "@/lib/marketing";

const axis = { fontSize: 11, fill: "#64748b" };
const TYPE_COLOR: Record<PartnerType, string> = { Preschool: "#3b82f6", Crèche: "#93c5fd", Corporate: "#8b5cf6", RWA: "#1e3a8a" };
const PAGE = 12;

export default function PartnersPage() {
  return (
    <Guard perm="view.marketing">
      <Partners />
    </Guard>
  );
}

type SortKey = "leadsShared" | "admissions" | "conversion" | "since";

function Partners() {
  const { filteredLocations, cycle } = useApp();
  const ids = filteredLocations.map((l) => l.id);
  const partners = useMemo(() => partnersFor(ids, cycle), [ids.join(), cycle]);
  const monthly = useMemo(() => partnerMonthly(partners), [partners]);

  const [type, setType] = useState<PartnerType | "All">("All");
  const [school, setSchool] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<SortKey>("leadsShared");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const leads = partners.reduce((s, p) => s + p.leadsShared, 0);
  const admissions = partners.reduce((s, p) => s + p.admissions, 0);
  const active = partners.filter((p) => p.active).length;
  const top = partners.reduce<Partner | null>((a, p) => (!a || p.admissions > a.admissions ? p : a), null);

  const byType = PARTNER_TYPES.map((t) => {
    const ps = partners.filter((p) => p.type === t);
    const l = ps.reduce((s, p) => s + p.leadsShared, 0);
    const a = ps.reduce((s, p) => s + p.admissions, 0);
    const best = ps.reduce<Partner | null>((x, p) => (!x || p.admissions > x.admissions ? p : x), null);
    return { type: t, count: ps.length, active: ps.filter((p) => p.active).length, leads: l, admissions: a, conv: pct(a, l), best };
  }).filter((r) => r.count);
  const bestConvType = byType.reduce((a, r) => (r.conv > a.conv ? r : a), byType[0]);

  const s = q.trim().toLowerCase();
  const filtered = partners
    .filter(
      (p) =>
        (type === "All" || p.type === type) &&
        (school === "all" || p.locationId === school) &&
        (status === "all" || (status === "active") === p.active) &&
        (!s || p.name.toLowerCase().includes(s)),
    )
    .sort((a, b) => (sort === "since" ? Date.parse(`01 ${a.since}`) - Date.parse(`01 ${b.since}`) : b[sort] - a[sort]));
  const shown = showAll ? filtered : filtered.slice(0, PAGE);
  const maxLeads = Math.max(1, ...partners.map((p) => p.leadsShared));
  const ft = filtered.reduce((a, p) => ({ leads: a.leads + p.leadsShared, adm: a.adm + p.admissions }), { leads: 0, adm: 0 });

  return (
    <>
      <PageHeader
        title="Partners Report"
        subtitle={`Preschools, crèches, corporates and RWAs that refer families · leads shared are tracked in LeadSquared, admissions in FABS · session ${cycle.replace("-", "–")}`}
        actions={
          <ExportButtons
            name={`partners-${cycle}`}
            rows={() => filtered.map((p) => ({ Partner: p.name, Type: p.type, School: locationById(p.locationId).short, Since: p.since, "Leads shared": p.leadsShared, Admissions: p.admissions, "Conversion %": p.conversion.toFixed(1), Status: p.active ? "Active" : "Inactive" }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
        <SnapshotCard theme="violet" icon={Handshake} label="Connected partners" value={partners.length} change={null} sub={`${active} active · ${partners.length - active} inactive`} />
        <SnapshotCard theme="blue" icon={Users} label="Leads shared" value={leads} change={null} sub={`${fmt(Math.round(leads / Math.max(1, partners.length)))} per partner on average`} />
        <SnapshotCard theme="green" icon={GraduationCap} label="Admissions" value={admissions} change={null} sub="Fee paid in FABS" />
        <SnapshotCard theme="orange" icon={Percent} label="Conversion" value={`${pct(admissions, leads).toFixed(0)}%`} change={null} sub="Leads shared → admissions" />
        <SnapshotCard theme="rose" icon={Award} label="Top partner" value={top ? fmt(top.admissions) : "—"} change={null} sub={top ? `admissions · ${top.name}` : "No partners"} />
      </div>

      <div className="mt-4 grid items-stretch gap-4 2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel title="Leads shared by month" sub="(by partner type, Oct – Sep) · admissions on the right axis" className="h-full">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 0, left: -6, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ ...axis, fill: "#16a34a" }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f1f5f9" }} formatter={(v: number, n: string) => [fmt(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              {PARTNER_TYPES.filter((t) => byType.some((b) => b.type === t)).map((t) => (
                <Bar key={t} yAxisId="l" dataKey={t} stackId="p" fill={TYPE_COLOR[t]} maxBarSize={28} isAnimationActive={false} />
              ))}
              <Line yAxisId="r" dataKey="admissions" name="Admissions" stroke="#16a34a" strokeWidth={2.2} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By partner type" sub={bestConvType ? `best conversion: ${bestConvType.type}` : undefined} className="h-full">
          <ul className="space-y-3.5">
            {byType.map((r) => (
              <li key={r.type}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[r.type] }} />
                    {r.type}
                    <span className="text-xs font-normal text-slate-400">{r.count} partners · {r.active} active</span>
                  </span>
                  <span className={clsx("text-sm font-semibold tabular", r === bestConvType ? "text-emerald-700" : "text-slate-900")}>{r.conv.toFixed(0)}%</span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full" style={{ width: `${pct(r.leads, leads)}%`, background: TYPE_COLOR[r.type] }} title="Share of leads shared" />
                </div>
                <div className="mt-1 flex justify-between gap-3 text-[11px] text-slate-500 tabular">
                  <span>{fmt(r.leads)} leads ({pct(r.leads, leads).toFixed(0)}%) · {fmt(r.admissions)} admissions</span>
                  {r.best && <span className="truncate text-right" title={r.best.name}>Top: {r.best.name}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Connected partners"
        sub={`${filtered.length} of ${partners.length} · ${fmt(ft.leads)} leads · ${fmt(ft.adm)} admissions`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-56">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setShowAll(false); }} placeholder="Search partner" className="w-full text-xs outline-none" />
          </label>
          <Dropdown<PartnerType | "All">
            size="sm" ariaLabel="Partner type" value={type} onChange={(v) => { setType(v); setShowAll(false); }}
            options={[{ value: "All", label: "All types" }, ...PARTNER_TYPES.map((t) => ({ value: t, label: t }))]}
          />
          {filteredLocations.length > 1 && (
            <Dropdown
              size="sm" ariaLabel="School" value={school} onChange={(v) => { setSchool(v); setShowAll(false); }}
              options={[{ value: "all", label: "All schools" }, ...filteredLocations.map((l) => ({ value: l.id, label: l.short }))]}
            />
          )}
          <Dropdown<"all" | "active" | "inactive">
            size="sm" ariaLabel="Status" value={status} onChange={(v) => { setStatus(v); setShowAll(false); }}
            options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
          />
          <span className="ml-auto" />
          <Dropdown<SortKey>
            size="sm" ariaLabel="Sort" value={sort} onChange={setSort}
            options={[
              { value: "leadsShared", label: "Most leads shared" },
              { value: "admissions", label: "Most admissions" },
              { value: "conversion", label: "Best conversion" },
              { value: "since", label: "Longest partnership" },
            ]}
          />
        </div>

        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Partner</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">School</th>
                <th className="px-3 py-2 text-left font-medium">Since</th>
                <th className="px-3 py-2 text-left font-medium">Leads shared</th>
                <th className="px-3 py-2 text-right font-medium">Admissions</th>
                <th className="px-3 py-2 text-right font-medium">Conversion</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className={clsx("font-medium", p.active ? "text-slate-900" : "text-slate-500")}>{p.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[p.type] }} />
                      {p.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{locationById(p.locationId).short}</td>
                  <td className="px-3 py-2 text-slate-500">{p.since}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right">{fmt(p.leadsShared)}</span>
                      <div className="w-24"><ProgressBar value={p.leadsShared} max={maxLeads} /></div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(p.admissions)}</td>
                  <td className={clsx("px-3 py-2 text-right font-semibold", p.conversion >= 18 ? "text-emerald-700" : p.conversion < 10 ? "text-rose-600" : "text-slate-800")}>{p.conversion.toFixed(0)}%</td>
                  <td className="px-3 py-2">{p.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">No partners match.</td></tr>
              )}
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
        <p className="mt-2 text-[11px] text-slate-500">Conversion: green 18%+, red under 10%. Partner names are invented demo data.</p>
      </Panel>
    </>
  );
}
