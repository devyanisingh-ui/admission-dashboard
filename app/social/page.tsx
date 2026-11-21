"use client";

import clsx from "clsx";
import { Eye, Heart, IndianRupee, MousePointerClick, Radio, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dropdown } from "@/components/dropdown";
import { Panel, SnapshotCard } from "@/components/dashboard-widgets";
import { ExportButtons } from "@/components/export-buttons";
import { Guard, PageHeader, Tabs, fmt, fmtINR } from "@/components/ui";
import { PLATFORM_COLOR } from "./colors";
import { SocialEntry } from "./entry";
import { useApp } from "@/lib/context";
import { CYCLE_MONTHS, locationById, pct } from "@/lib/data";
import {
  SOCIAL_PLATFORMS, socialByPlatform, socialCampaigns, socialMonthly, socialSpend, type SocialPlatform,
} from "@/lib/marketing";

const axis = { fontSize: 11, fill: "#64748b" };
const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}k` : String(v));

export default function SocialPage() {
  return (
    <Guard perm="view.marketing">
      <Social />
    </Guard>
  );
}

type CampSort = "leads" | "spend" | "reach" | "cpl" | "month";

function Social() {
  const { filteredLocations, cycle, seatVersion, can } = useApp();
  const [tab, setTab] = useState<"report" | "entry">("report");
  const ids = filteredLocations.map((l) => l.id);
  const key = ids.join() + cycle + seatVersion;
  const multi = filteredLocations.length > 1;
  const platforms = useMemo(() => socialByPlatform(ids, cycle), [key]);
  const monthly = useMemo(() => socialMonthly(ids, cycle), [key]);
  const campaigns = useMemo(() => socialCampaigns(ids, cycle), [key]);
  const spend = useMemo(() => socialSpend(ids, cycle), [key]);
  const [platform, setPlatform] = useState<SocialPlatform | "All">("All");
  const [sort, setSort] = useState<CampSort>("leads");

  const sum = (f: "reach" | "impressions" | "interactions" | "followers" | "prospects") => platforms.reduce((s, p) => s + p[f], 0);
  const reach = sum("reach"), impressions = sum("impressions"), interactions = sum("interactions"), prospects = sum("prospects");
  const engagement = pct(interactions, impressions);
  const topProspects = platforms.reduce((a, p) => (p.prospects > a.prospects ? p : a), platforms[0]);
  const topEngagement = platforms.reduce((a, p) => (p.engagement > a.engagement ? p : a), platforms[0]);

  const shown = campaigns
    .filter((c) => platform === "All" || c.platform === platform)
    .sort((a, b) => (sort === "cpl" ? a.cpl - b.cpl : sort === "month" ? CYCLE_MONTHS.indexOf(a.month) - CYCLE_MONTHS.indexOf(b.month) : b[sort] - a[sort]));
  const camp = shown.reduce((a, c) => ({ spend: a.spend + c.spend, reach: a.reach + c.reach, clicks: a.clicks + c.clicks, leads: a.leads + c.leads }), { spend: 0, reach: 0, clicks: 0, leads: 0 });
  const bestCpl = Math.min(...campaigns.filter((c) => c.leads).map((c) => c.cpl));

  return (
    <>
      <PageHeader
        title="Social Media Reports"
        subtitle={`Reach, engagement and prospects by platform and campaign · figures are entered by hand from each platform's insights export · session ${cycle.replace("-", "–")}`}
        actions={
          <ExportButtons
            name={`social-media-${cycle}`}
            rows={() => platforms.map((p) => ({ Platform: p.platform, Reach: p.reach, Impressions: p.impressions, Interactions: p.interactions, "Engagement %": p.engagement.toFixed(2), "Followers gained": p.followers, Prospects: p.prospects }))}
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
      {tab === "entry" ? <SocialEntry /> : <>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))]">
        <SnapshotCard theme="blue" icon={Radio} label="Reach" value={compact(reach)} change={null} sub="Unique accounts reached" />
        <SnapshotCard theme="violet" icon={Eye} label="Impressions" value={compact(impressions)} change={null} sub={`${(impressions / Math.max(1, reach)).toFixed(1)} views per account`} />
        <SnapshotCard theme="rose" icon={Heart} label="Interactions" value={compact(interactions)} change={null} sub={`${engagement.toFixed(2)}% engagement rate`} />
        <SnapshotCard theme="orange" icon={UserPlus} label="Followers gained" value={fmt(sum("followers"))} change={null} sub="New followers this session" />
        <SnapshotCard theme="green" icon={MousePointerClick} label="Prospects" value={fmt(prospects)} change={null} sub="Leads created in LeadSquared" />
        <SnapshotCard theme="blue" icon={IndianRupee} label="Paid social spend" value={fmtINR(spend)} change={null} sub={`${fmtINR(spend / Math.max(1, prospects))} per prospect`} />
      </div>

      <div className="mt-4 grid items-stretch gap-4 2xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <Panel title="By platform" sub={`top for prospects: ${topProspects.platform} · best engagement: ${topEngagement.platform}`} className="h-full">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 text-left font-medium">Platform</th>
                  <th className="px-3 py-2 text-right font-medium">Reach</th>
                  <th className="px-3 py-2 text-right font-medium">Impressions</th>
                  <th className="px-3 py-2 text-right font-medium">Interactions</th>
                  <th className="px-3 py-2 text-right font-medium">Engagement</th>
                  <th className="px-3 py-2 text-right font-medium">Followers</th>
                  <th className="py-2 pl-3 text-left font-medium">Prospects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...platforms].sort((a, b) => b.prospects - a.prospects).map((p) => (
                  <tr key={p.platform}>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_COLOR[p.platform] }} />
                        {p.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{compact(p.reach)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{compact(p.impressions)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{compact(p.interactions)}</td>
                    <td className={clsx("px-3 py-2.5 text-right", p === topEngagement && "font-semibold text-emerald-700")}>{p.engagement.toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{fmt(p.followers)}</td>
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-right font-semibold">{fmt(p.prospects)}</span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${(p.prospects / Math.max(1, topProspects.prospects)) * 100}%`, background: PLATFORM_COLOR[p.platform] }} />
                        </div>
                        <span className="w-8 text-right text-[11px] text-slate-400">{pct(p.prospects, prospects).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  <td className="px-3 py-2 text-right">{compact(reach)}</td>
                  <td className="px-3 py-2 text-right">{compact(impressions)}</td>
                  <td className="px-3 py-2 text-right">{compact(interactions)}</td>
                  <td className="px-3 py-2 text-right">{engagement.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{fmt(sum("followers"))}</td>
                  <td className="py-2 pl-3"><span className="inline-block w-10 text-right">{fmt(prospects)}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Monthly reach & prospects" sub="(Oct – Sep)" className="h-full">
          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} width={42} />
              <YAxis yAxisId="r" orientation="right" tick={{ ...axis, fill: "#16a34a" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [fmt(v), n]} cursor={{ fill: "#f1f5f9" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar yAxisId="l" dataKey="reach" name="Reach" fill="#93c5fd" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="prospects" name="Prospects (right axis)" stroke="#16a34a" strokeWidth={2.2} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Paid campaigns"
        sub={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} entered${multi ? ` across ${new Set(campaigns.map((c) => c.locationId)).size} schools` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown<CampSort>
              size="sm"
              ariaLabel="Sort campaigns"
              value={sort}
              onChange={setSort}
              options={[
                { value: "leads", label: "Most prospects" },
                { value: "cpl", label: "Lowest cost / prospect" },
                { value: "spend", label: "Highest spend" },
                { value: "reach", label: "Highest reach" },
                { value: "month", label: "By month" },
              ]}
            />
            <Dropdown<SocialPlatform | "All">
              size="sm"
              ariaLabel="Platform"
              value={platform}
              onChange={setPlatform}
              options={[{ value: "All", label: "All platforms" }, ...SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))]}
            />
          </div>
        }
      >
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Campaign</th>
                {multi && <th className="px-3 py-2 text-left font-medium">School</th>}
                <th className="px-3 py-2 text-left font-medium">Platform</th>
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Spend</th>
                <th className="px-3 py-2 text-right font-medium">Reach</th>
                <th className="px-3 py-2 text-right font-medium">Clicks</th>
                <th className="px-3 py-2 text-right font-medium">CTR</th>
                <th className="px-3 py-2 text-right font-medium">Prospects</th>
                <th className="px-3 py-2 text-right font-medium">Cost / prospect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  {multi && <td className="px-3 py-2 text-slate-600">{locationById(c.locationId).short}</td>}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[c.platform] }} />
                      {c.platform}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{c.month}</td>
                  <td className="px-3 py-2 text-right">{fmtINR(c.spend)}</td>
                  <td className="px-3 py-2 text-right">{compact(c.reach)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.clicks)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{c.ctr.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(c.leads)}</td>
                  <td className={clsx("px-3 py-2 text-right", c.cpl === bestCpl && "font-semibold text-emerald-700")}>{c.leads ? fmtINR(c.cpl) : "—"}</td>
                </tr>
              ))}
              {shown.length > 0 && (
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={multi ? 4 : 3}>Total{platform !== "All" && ` · ${platform}`}</td>
                  <td className="px-3 py-2 text-right">{fmtINR(camp.spend)}</td>
                  <td className="px-3 py-2 text-right">{compact(camp.reach)}</td>
                  <td className="px-3 py-2 text-right">{fmt(camp.clicks)}</td>
                  <td className="px-3 py-2 text-right">{pct(camp.clicks, camp.reach).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">{fmt(camp.leads)}</td>
                  <td className="px-3 py-2 text-right">{camp.leads ? fmtINR(camp.spend / camp.leads) : "—"}</td>
                </tr>
              )}
              {!shown.length && (
                <tr><td colSpan={multi ? 10 : 9} className="px-3 py-6 text-center text-sm text-slate-500">No paid campaigns on {platform}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Campaign prospects are part of each platform&apos;s total prospects (the rest come from organic posts). Green = lowest cost per prospect.
          Add or correct figures in the Data entry tab.
        </p>
      </Panel>
      </>}
    </>
  );
}
