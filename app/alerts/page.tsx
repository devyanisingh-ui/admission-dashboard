"use client";

import clsx from "clsx";
import { AlertOctagon, AlertTriangle, ArrowRight, Building2, Check, Info, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SnapshotCard } from "@/components/dashboard-widgets";
import { Dropdown } from "@/components/dropdown";
import { Badge, Note, PageHeader } from "@/components/ui";
import { useApp } from "@/lib/context";
import { buildAlerts, locationById, type Alert, type AlertSeverity } from "@/lib/data";

/** Where each alert type is fixed. */
const ACTIONS: Record<string, { label: string; href: string }> = {
  "Sync failure": { label: "View sync status", href: "/admin" },
  "Unmapped LeadSquared status": { label: "Map the status", href: "/masters" },
  "Grade close-out": { label: "View grade-wise report", href: "/grades" },
  "Unmapped > 48h": { label: "View in System Views", href: "/systems" },
  "Seat fill below trajectory": { label: "View seat fill by grade", href: "/grades" },
  "Source conversion drop": { label: "View source performance", href: "/" },
};

const SEV = {
  high: { label: "High", icon: AlertOctagon, bar: "bg-rose-500", icon_cls: "bg-rose-100 text-rose-600", chip: "red" as const },
  medium: { label: "Medium", icon: AlertTriangle, bar: "bg-amber-400", icon_cls: "bg-amber-100 text-amber-600", chip: "amber" as const },
  low: { label: "Low", icon: Info, bar: "bg-sky-400", icon_cls: "bg-sky-100 text-sky-600", chip: "blue" as const },
};
const SEV_ORDER: AlertSeverity[] = ["high", "medium", "low"];

export default function AlertsPage() {
  const { cycle, filteredLocations, role, setLocationId } = useApp();
  const [sev, setSev] = useState<AlertSeverity | "all">("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [showAcked, setShowAcked] = useState(false);
  const ids = filteredLocations.map((l) => l.id);

  // Alerts each role receives (as per the permission matrix), scoped to the Global Filters.
  const all = useMemo(
    () =>
      buildAlerts(cycle).filter((a) => {
        if (a.locationId && !ids.includes(a.locationId)) return false;
        if (role === "sysAdmin") return a.type === "Sync failure";
        if (role === "counsellor") return a.type === "Unmapped > 48h";
        if (role === "leadership") return a.severity === "high" || a.type === "Source conversion drop";
        return true;
      }),
    [cycle, role, ids.join()],
  );

  const active = all.filter((a) => !acked.has(a.id));
  const count = (s: AlertSeverity) => active.filter((a) => a.severity === s).length;
  const schoolsAffected = new Set(active.filter((a) => a.locationId).map((a) => a.locationId)).size;
  const types = Array.from(new Set(all.map((a) => a.type)));
  const s = q.trim().toLowerCase();
  const list = all.filter(
    (a) =>
      (showAcked || !acked.has(a.id)) &&
      (sev === "all" || a.severity === sev) &&
      (type === "all" || a.type === type) &&
      (!s || `${a.title} ${a.detail} ${a.locationId ? locationById(a.locationId).short : ""}`.toLowerCase().includes(s)),
  );
  // Group by type, most severe groups first.
  const groups = types
    .map((t) => ({ type: t, items: list.filter((a) => a.type === t).sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)) }))
    .filter((g) => g.items.length)
    .sort((a, b) => SEV_ORDER.indexOf(a.items[0].severity) - SEV_ORDER.indexOf(b.items[0].severity) || b.items.length - a.items.length);

  const toggleAck = (id: string) => setAcked((x) => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle={`Raised by the rules engine on each sync and daily · delivered in-app · ${filteredLocations.length === 1 ? filteredLocations[0].name : `${filteredLocations.length} schools`}`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SnapshotCard theme="rose" icon={AlertOctagon} label="High" value={count("high")} change={null} sub="Act today — data or targets at risk" />
        <SnapshotCard theme="orange" icon={AlertTriangle} label="Medium" value={count("medium")} change={null} sub="Needs attention this week" />
        <SnapshotCard theme="blue" icon={Info} label="Low" value={count("low")} change={null} sub="For information" />
        <SnapshotCard theme="violet" icon={Building2} label="Schools affected" value={schoolsAffected} change={null} sub={`${active.length} open alert${active.length === 1 ? "" : "s"} · ${acked.size} acknowledged`} />
      </div>

      {/* Filters */}
      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        {(["all", ...SEV_ORDER] as const).map((k) => {
          const n = k === "all" ? active.length : count(k);
          return (
            <button
              key={k}
              onClick={() => setSev(k)}
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition",
                sev === k ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {k !== "all" && <span className={clsx("h-2 w-2 rounded-full", SEV[k].bar)} />}
              {k === "all" ? "All" : SEV[k].label}
              <span className={clsx("rounded-full px-1.5 text-xs font-semibold tabular", sev === k ? "bg-white" : "bg-slate-100")}>{n}</span>
            </button>
          );
        })}
        <Dropdown size="sm" ariaLabel="Type" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...types.map((t) => ({ value: t, label: t }))]} />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)} className="accent-brand-600" />
          Show acknowledged
        </label>
        <label className="ml-auto flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-72">
          <Search size={14} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search alerts or schools" className="w-full text-sm outline-none" />
        </label>
      </div>

      {!groups.length && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          <Check className="mx-auto mb-2 text-emerald-500" />
          No alerts match — nothing to act on.
        </div>
      )}

      <div className="grid items-start gap-4 2xl:grid-cols-2">
        {groups.map((g) => {
          const action = ACTIONS[g.type];
          return (
            <section key={g.type} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-[15px] font-semibold text-brand-900">{g.type}</h2>
                <span className="text-xs text-slate-500">{g.items.length} alert{g.items.length === 1 ? "" : "s"}</span>
              </header>
              <ul className="divide-y divide-slate-100">
                {g.items.map((a) => (
                  <AlertRow
                    key={a.id}
                    a={a}
                    acked={acked.has(a.id)}
                    onAck={() => toggleAck(a.id)}
                    action={action}
                    onOpen={() => a.locationId && setLocationId(a.locationId)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <Note tone="phase2">Email digest delivery is not yet decided (open item #8); WhatsApp is a later integration. Acknowledging hides an alert for you in this session only.</Note>
        <Note tone="phase2">“No follow-up for 72 hours” needs LeadSquared activity data via API (open item #6).</Note>
      </div>
    </>
  );
}

function AlertRow({ a, acked, onAck, action, onOpen }: { a: Alert; acked: boolean; onAck: () => void; action?: { label: string; href: string }; onOpen: () => void }) {
  const sv = SEV[a.severity];
  return (
    <li className={clsx("relative flex gap-3 px-4 py-3 pl-5", acked && "opacity-55")}>
      <span className={clsx("absolute inset-y-0 left-0 w-1", sv.bar)} aria-hidden />
      <span className={clsx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", sv.icon_cls)}><sv.icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{a.title}</span>
          <Badge tone={sv.chip}>{sv.label}</Badge>
          {a.locationId && <Badge tone="slate">{locationById(a.locationId).short}</Badge>}
          {acked && <Badge tone="green"><Check size={11} /> Acknowledged</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-slate-600">{a.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[11px] text-slate-400">Raised {a.raised} · to {a.audience}</span>
          <span className="ml-auto flex gap-1.5">
            {action && (
              <Link
                href={action.href}
                onClick={onOpen}
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                {action.label} <ArrowRight size={12} />
              </Link>
            )}
            <button onClick={onAck} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              {acked ? <><RotateCcw size={12} /> Reopen</> : <><Check size={12} /> Acknowledge</>}
            </button>
          </span>
        </div>
      </div>
    </li>
  );
}
