"use client";

import { useMemo, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { ConfirmDialog, Field, MasterEditor, inputCls } from "@/components/master-kit";
import {
  EntryActions, EntryBanner, EntryToast, EntryToolbar, NumberField, Pager, SegTabs, StampCell, inr, num, recentFirst, useEntryStore,
} from "@/components/entry-kit";
import { Card, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import { CYCLE_MONTHS, locationById } from "@/lib/data";
import { cycleData, newEntryId, SOCIAL_PLATFORMS, type CampaignRec, type SocialPlatform, type SocialRec } from "@/lib/marketing";
import { PLATFORM_COLOR } from "./colors";

const PAGE = 25;
const th = "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500";
type Entry = ReturnType<typeof useEntryStore>;

export function SocialEntry() {
  const { filteredLocations, cycle, can, seatVersion } = useApp();
  const canEdit = can("marketing.edit");
  const entry = useEntryStore();
  const [view, setView] = useState<"metrics" | "campaigns">("metrics");
  const data = useMemo(() => cycleData(cycle, entry.store), [cycle, seatVersion, entry.store]); // eslint-disable-line react-hooks/exhaustive-deps
  const idSet = new Set(filteredLocations.map((l) => l.id));
  const metrics = data.social.filter((r) => idSet.has(r.locationId));
  const campaigns = data.campaigns.filter((r) => idSet.has(r.locationId));

  return (
    <>
      <EntryBanner canEdit={canEdit} starting={entry.starting} who="Location Admissions Head or Central Admin team">
        Enter each platform&apos;s monthly figures from its insights export, and each paid campaign&apos;s results.
      </EntryBanner>
      <div className="mb-3">
        <SegTabs
          value={view}
          onChange={setView}
          options={[
            { id: "metrics", label: "Monthly platform figures", count: metrics.length },
            { id: "campaigns", label: "Paid campaigns", count: campaigns.length },
          ]}
        />
      </div>
      {view === "metrics" ? <Metrics rows={metrics} canEdit={canEdit} entry={entry} /> : <Campaigns rows={campaigns} canEdit={canEdit} entry={entry} />}
      <EntryToast text={entry.toast} onClose={entry.clearToast} />
    </>
  );
}

function Filters({ loc, setLoc, platform, setPlatform, month, setMonth }: {
  loc: string; setLoc: (v: string) => void; platform: string; setPlatform: (v: string) => void; month: string; setMonth: (v: string) => void;
}) {
  const { filteredLocations } = useApp();
  return (
    <>
      {filteredLocations.length > 1 && (
        <Dropdown size="sm" ariaLabel="School" value={loc} onChange={setLoc} options={[{ value: "all", label: "All schools" }, ...filteredLocations.map((l) => ({ value: l.id, label: l.short }))]} />
      )}
      <Dropdown size="sm" ariaLabel="Platform" value={platform} onChange={setPlatform} options={[{ value: "all", label: "All platforms" }, ...SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))]} />
      <Dropdown size="sm" ariaLabel="Month" value={month} onChange={setMonth} options={[{ value: "all", label: "All months" }, ...CYCLE_MONTHS.map((m) => ({ value: m, label: m }))]} />
    </>
  );
}

function PlatformName({ p }: { p: SocialPlatform }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLATFORM_COLOR[p] }} />
      {p}
    </span>
  );
}

/** Shared list state: search, filters and "show all". */
function useListState() {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [month, setMonth] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const reset = <T,>(f: (v: T) => void) => (v: T) => { f(v); setShowAll(false); };
  return {
    q, setQ: reset(setQ), loc, setLoc: reset(setLoc), platform, setPlatform: reset(setPlatform), month, setMonth: reset(setMonth), showAll, setShowAll,
    match: (r: { locationId: string; platform: string; month: string }, text: string) =>
      (loc === "all" || r.locationId === loc) && (platform === "all" || r.platform === platform) && (month === "all" || r.month === month) &&
      (!q.trim() || text.toLowerCase().includes(q.trim().toLowerCase())),
  };
}
type Sortable = { month: string; locationId: string; ts?: number; updatedAt: string; updatedBy: string };
const byMonthDesc = (a: Sortable, b: Sortable) =>
  recentFirst(a, b) || CYCLE_MONTHS.indexOf(b.month) - CYCLE_MONTHS.indexOf(a.month) || locationById(a.locationId).short.localeCompare(locationById(b.locationId).short);

/* ------------------------------------------------------------------ */
/* Monthly platform figures                                            */
/* ------------------------------------------------------------------ */

function Metrics({ rows, canEdit, entry }: { rows: SocialRec[]; canEdit: boolean; entry: Entry }) {
  const st = useListState();
  const [editing, setEditing] = useState<SocialRec | "new" | null>(null);
  const [deleting, setDeleting] = useState<SocialRec | null>(null);
  const list = rows
    .filter((r) => st.match(r, `${locationById(r.locationId).short} ${r.platform}`))
    .sort((a, b) => byMonthDesc(a, b) || SOCIAL_PLATFORMS.indexOf(a.platform) - SOCIAL_PLATFORMS.indexOf(b.platform));
  const shown = st.showAll ? list : list.slice(0, PAGE);
  const sum = (k: "reach" | "impressions" | "interactions" | "followers" | "prospects") => list.reduce((a, r) => a + r[k], 0);

  return (
    <Card bodyClass="p-4">
      <EntryToolbar q={st.q} setQ={st.setQ} placeholder="Search school or platform" onAdd={() => setEditing("new")} addLabel="Add month" canEdit={canEdit}>
        <Filters {...st} />
      </EntryToolbar>
      <div className="relative overflow-x-auto scroll-thin">
        <table className="w-full min-w-[900px] text-sm tabular">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={`${th} text-left`}>Month</th>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>Platform</th>
              <th className={`${th} text-right`}>Reach</th>
              <th className={`${th} text-right`}>Impressions</th>
              <th className={`${th} text-right`}>Interactions</th>
              <th className={`${th} text-right`}>Followers gained</th>
              <th className={`${th} text-right`}>Prospects</th>
              <th className={`${th} text-left`}>Last updated</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">{r.month}</td>
                <td className="px-3 py-2 text-slate-800">{locationById(r.locationId).short}</td>
                <td className="px-3 py-2"><PlatformName p={r.platform} /></td>
                <td className="px-3 py-2 text-right">{fmt(r.reach)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(r.impressions)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(r.interactions)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(r.followers)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(r.prospects)}</td>
                <td className="px-3 py-2"><StampCell s={r} /></td>
                <td className="px-3 py-2"><EntryActions canEdit={canEdit} label={`${r.platform} ${r.month}`} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">No monthly figures match.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Total · {fmt(list.length)} entr{list.length === 1 ? "y" : "ies"}</td>
                <td className="px-3 py-2 text-right">{fmt(sum("reach"))}</td>
                <td className="px-3 py-2 text-right">{fmt(sum("impressions"))}</td>
                <td className="px-3 py-2 text-right">{fmt(sum("interactions"))}</td>
                <td className="px-3 py-2 text-right">{fmt(sum("followers"))}</td>
                <td className="px-3 py-2 text-right">{fmt(sum("prospects"))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Pager shown={shown.length} total={list.length} showAll={st.showAll} setShowAll={st.setShowAll} />

      {editing && <MetricEditor row={editing === "new" ? null : editing} rows={rows} entry={entry} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete monthly figures?"
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            entry.commit("Social media", "Deleted", `${locationById(deleting.locationId).short} · ${deleting.platform} · ${deleting.month}`, `reach ${fmt(deleting.reach)} → —`, (d) => ({ ...d, social: d.social.filter((x) => x.id !== deleting.id) }))
          }
        >
          {deleting.platform} figures for {locationById(deleting.locationId).short} in {deleting.month} will be removed from the totals.
        </ConfirmDialog>
      )}
    </Card>
  );
}

const METRIC_FIELDS = [
  { k: "reach", label: "Reach", hint: "Unique accounts reached" },
  { k: "impressions", label: "Impressions", hint: "Total views" },
  { k: "interactions", label: "Interactions", hint: "Likes, comments, shares, saves" },
  { k: "followers", label: "Followers gained", hint: "Net new followers" },
  { k: "prospects", label: "Prospects", hint: "Leads created in LeadSquared" },
] as const;
type MetricKey = (typeof METRIC_FIELDS)[number]["k"];

function MetricEditor({ row, rows, entry, onClose }: { row: SocialRec | null; rows: SocialRec[]; entry: Entry; onClose: () => void }) {
  const { filteredLocations } = useApp();
  const [f, setF] = useState({
    locationId: row?.locationId ?? filteredLocations[0]?.id ?? "", platform: (row?.platform ?? "Instagram") as SocialPlatform, month: row?.month ?? "Nov",
    ...(Object.fromEntries(METRIC_FIELDS.map(({ k }) => [k, row ? String(row[k]) : ""])) as Record<MetricKey, string>),
  });
  const v = Object.fromEntries(METRIC_FIELDS.map(({ k }) => [k, num(f[k])])) as Record<MetricKey, number>;
  const dup = rows.find((r) => r.id !== row?.id && r.locationId === f.locationId && r.platform === f.platform && r.month === f.month);
  const errors = [
    !f.locationId && "Pick a school.",
    ...METRIC_FIELDS.filter(({ k }) => Number.isNaN(v[k])).map(({ label }) => `Enter ${label.toLowerCase()} (0 if none).`),
    v.impressions < v.reach && "Impressions can't be lower than reach.",
    v.interactions > v.impressions && "Interactions can't be more than impressions.",
    dup && `${f.platform} figures for ${locationById(f.locationId).short} in ${f.month} already exist — edit that entry instead.`,
  ].filter(Boolean) as string[];
  const name = `${locationById(f.locationId)?.short ?? ""} · ${f.platform} · ${f.month}`;

  const save = () => {
    const rec: SocialRec = { id: row?.id ?? newEntryId("m"), locationId: f.locationId, platform: f.platform, month: f.month, ...v, ...entry.stamp() };
    if (row) {
      const changed = METRIC_FIELDS.filter(({ k }) => row[k] !== v[k]).map(({ k, label }) => `${label} ${fmt(row[k])} → ${fmt(v[k])}`);
      entry.commit("Social media", "Updated", name, changed.join(", ") || "No figure changed", (d) => ({ ...d, social: d.social.map((x) => (x.id === row.id ? rec : x)) }));
    } else {
      entry.commit("Social media", "Created", name, `reach ${fmt(v.reach)}, prospects ${fmt(v.prospects)}`, (d) => ({ ...d, social: [...d.social, rec] }));
    }
    onClose();
  };

  return (
    <MasterEditor title={row ? "Edit monthly figures" : "Add monthly figures"} subtitle="One platform, one school, one month — from the platform's insights export" errors={errors} saveLabel={row ? "Save changes" : "Add figures"} onSave={save} onClose={onClose}>
      <Field label="School">
        <Dropdown ariaLabel="School" value={f.locationId} onChange={(x) => setF((s) => ({ ...s, locationId: x }))} options={filteredLocations.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Platform">
          <Dropdown<SocialPlatform> ariaLabel="Platform" value={f.platform} onChange={(x) => setF((s) => ({ ...s, platform: x }))} options={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))} />
        </Field>
        <Field label="Month">
          <Dropdown ariaLabel="Month" value={f.month} onChange={(x) => setF((s) => ({ ...s, month: x }))} options={CYCLE_MONTHS.map((m) => ({ value: m, label: m }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {METRIC_FIELDS.map(({ k, label, hint }) => (
          <NumberField key={k} label={label} hint={hint} value={f[k]} onChange={(x) => setF((s) => ({ ...s, [k]: x }))} />
        ))}
      </div>
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */
/* Paid campaigns                                                      */
/* ------------------------------------------------------------------ */

function Campaigns({ rows, canEdit, entry }: { rows: CampaignRec[]; canEdit: boolean; entry: Entry }) {
  const st = useListState();
  const [editing, setEditing] = useState<CampaignRec | "new" | null>(null);
  const [deleting, setDeleting] = useState<CampaignRec | null>(null);
  const list = rows.filter((r) => st.match(r, `${r.name} ${locationById(r.locationId).short} ${r.platform}`)).sort(byMonthDesc);
  const shown = st.showAll ? list : list.slice(0, PAGE);
  const tot = list.reduce((a, r) => ({ spend: a.spend + r.spend, reach: a.reach + r.reach, clicks: a.clicks + r.clicks, leads: a.leads + r.leads }), { spend: 0, reach: 0, clicks: 0, leads: 0 });

  return (
    <Card bodyClass="p-4">
      <EntryToolbar q={st.q} setQ={st.setQ} placeholder="Search campaign, school or platform" onAdd={() => setEditing("new")} addLabel="Add campaign" canEdit={canEdit}>
        <Filters {...st} />
      </EntryToolbar>
      <div className="relative overflow-x-auto scroll-thin">
        <table className="w-full min-w-[900px] text-sm tabular">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={`${th} text-left`}>Campaign</th>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>Platform</th>
              <th className={`${th} text-left`}>Month</th>
              <th className={`${th} text-right`}>Spend</th>
              <th className={`${th} text-right`}>Reach</th>
              <th className={`${th} text-right`}>Clicks</th>
              <th className={`${th} text-right`}>Prospects</th>
              <th className={`${th} text-left`}>Last updated</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                <td className="px-3 py-2 text-slate-700">{locationById(r.locationId).short}</td>
                <td className="px-3 py-2"><PlatformName p={r.platform} /></td>
                <td className="px-3 py-2 text-slate-500">{r.month}</td>
                <td className="px-3 py-2 text-right font-semibold">{inr(r.spend)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.reach)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(r.clicks)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(r.leads)}</td>
                <td className="px-3 py-2"><StampCell s={r} /></td>
                <td className="px-3 py-2"><EntryActions canEdit={canEdit} label={r.name} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">No campaigns match.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={4}>Total · {fmt(list.length)} campaign{list.length === 1 ? "" : "s"}</td>
                <td className="px-3 py-2 text-right">{inr(tot.spend)}</td>
                <td className="px-3 py-2 text-right">{fmt(tot.reach)}</td>
                <td className="px-3 py-2 text-right">{fmt(tot.clicks)}</td>
                <td className="px-3 py-2 text-right">{fmt(tot.leads)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Pager shown={shown.length} total={list.length} showAll={st.showAll} setShowAll={st.setShowAll} />

      {editing && <CampaignEditor row={editing === "new" ? null : editing} rows={rows} entry={entry} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete campaign?"
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            entry.commit("Campaign", "Deleted", `${deleting.name} · ${locationById(deleting.locationId).short}`, `${inr(deleting.spend)} → —`, (d) => ({ ...d, campaigns: d.campaigns.filter((x) => x.id !== deleting.id) }))
          }
        >
          <b>{deleting.name}</b> at {locationById(deleting.locationId).short} ({inr(deleting.spend)}, {fmt(deleting.leads)} prospects) will be removed.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function CampaignEditor({ row, rows, entry, onClose }: { row: CampaignRec | null; rows: CampaignRec[]; entry: Entry; onClose: () => void }) {
  const { filteredLocations } = useApp();
  const [f, setF] = useState({
    name: row?.name ?? "", locationId: row?.locationId ?? filteredLocations[0]?.id ?? "", platform: (row?.platform ?? "Instagram") as SocialPlatform, month: row?.month ?? "Nov",
    spend: row ? String(row.spend) : "", reach: row ? String(row.reach) : "", clicks: row ? String(row.clicks) : "", leads: row ? String(row.leads) : "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const spend = num(f.spend), reach = num(f.reach), clicks = num(f.clicks), leads = num(f.leads);
  const name = f.name.trim();
  const dup = rows.find((r) => r.id !== row?.id && r.locationId === f.locationId && r.month === f.month && r.name.toLowerCase() === name.toLowerCase());
  const errors = [
    !name && "Enter the campaign name.",
    name.length > 60 && "Keep the name under 60 characters.",
    !f.locationId && "Pick a school.",
    Number.isNaN(spend) && "Enter the spend.",
    Number.isNaN(reach) && "Enter the reach.",
    Number.isNaN(clicks) && "Enter the clicks (0 if none).",
    Number.isNaN(leads) && "Enter the prospects (0 if none).",
    clicks > reach && "Clicks can't be more than reach.",
    dup && `“${name}” already exists for ${locationById(f.locationId).short} in ${f.month}.`,
  ].filter(Boolean) as string[];

  const save = () => {
    const rec: CampaignRec = { id: row?.id ?? newEntryId("c"), name, locationId: f.locationId, platform: f.platform, month: f.month, spend, reach, clicks, leads, ...entry.stamp() };
    const label = `${name} · ${locationById(f.locationId).short}`;
    if (row) {
      const changes = [
        row.name !== name && `name “${row.name}” → “${name}”`,
        row.spend !== spend && `spend ${inr(row.spend)} → ${inr(spend)}`,
        row.reach !== reach && `reach ${fmt(row.reach)} → ${fmt(reach)}`,
        row.clicks !== clicks && `clicks ${fmt(row.clicks)} → ${fmt(clicks)}`,
        row.leads !== leads && `prospects ${fmt(row.leads)} → ${fmt(leads)}`,
        (row.platform !== f.platform || row.month !== f.month || row.locationId !== f.locationId) && "details changed",
      ].filter(Boolean);
      entry.commit("Campaign", "Updated", label, changes.join(", ") || "No change", (d) => ({ ...d, campaigns: d.campaigns.map((x) => (x.id === row.id ? rec : x)) }));
    } else {
      entry.commit("Campaign", "Created", label, `${inr(spend)} · ${fmt(leads)} prospects`, (d) => ({ ...d, campaigns: [...d.campaigns, rec] }));
    }
    onClose();
  };

  return (
    <MasterEditor title={row ? "Edit campaign" : "Add campaign"} subtitle="A paid social campaign and its results" errors={errors} saveLabel={row ? "Save changes" : "Add campaign"} onSave={save} onClose={onClose}>
      <Field label="Campaign name">
        <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={70} className={inputCls} placeholder="Nursery admissions open" />
      </Field>
      <Field label="School">
        <Dropdown ariaLabel="School" value={f.locationId} onChange={(v) => set("locationId", v)} options={filteredLocations.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Platform">
          <Dropdown<SocialPlatform> ariaLabel="Platform" value={f.platform} onChange={(v) => set("platform", v)} options={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))} />
        </Field>
        <Field label="Month">
          <Dropdown ariaLabel="Month" value={f.month} onChange={(v) => set("month", v)} options={CYCLE_MONTHS.map((m) => ({ value: m, label: m }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Spend (₹)" prefix="₹" value={f.spend} onChange={(v) => set("spend", v)} hint={Number.isNaN(spend) ? "Whole rupees" : inr(spend)} />
        <NumberField label="Reach" value={f.reach} onChange={(v) => set("reach", v)} />
        <NumberField label="Clicks" value={f.clicks} onChange={(v) => set("clicks", v)} />
        <NumberField label="Prospects" value={f.leads} onChange={(v) => set("leads", v)} hint="Leads created in LeadSquared" />
      </div>
    </MasterEditor>
  );
}
