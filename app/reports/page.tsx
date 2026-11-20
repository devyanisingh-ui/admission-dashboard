"use client";

import clsx from "clsx";
import {
  AlertTriangle, BarChart3, CheckCircle2, X, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, Clock, FileSpreadsheet, FileText, Filter, GitMerge, GraduationCap,
  Handshake, Lock, Search, Share2, ShieldCheck, UserCheck, UserMinus, Users, Wallet,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Drawer } from "@/components/drawer";
import { Badge, Button, Card, Guard, Note, PageHeader, Rag, SourceTag, Tabs, fmt, fmtPct } from "@/components/ui";
import { useApp } from "@/lib/context";
import { downloadCsv, printReport } from "@/lib/export";
import { kpis, locationTotals, rng, SNAPSHOTS, totalsFor, type Cycle } from "@/lib/data";
import { REPORT_DEFS, type ReportDef } from "@/lib/reports";

export default function ReportsPage() {
  return (
    <Guard perm="view.reports">
      <Reports />
    </Guard>
  );
}

function Reports() {
  const [tab, setTab] = useState<"downloads" | "snapshots">("downloads");
  return (
    <>
      <PageHeader
        title="Download Centre"
        subtitle="Download reports as Excel (CSV) or PDF, and browse locked weekly / monthly snapshots"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "downloads", label: <>Reports <span className="ml-1 text-xs text-slate-400">{REPORT_DEFS.filter((r) => r.status !== "phase2").length}</span></> },
          { id: "snapshots", label: <>Weekly &amp; monthly snapshots <span className="ml-1 text-xs text-slate-400">{SNAPSHOTS.length}</span></> },
        ]}
      />
      {tab === "snapshots" ? <Snapshots /> : <Downloads />}
    </>
  );
}

type KindFilter = "all" | "Weekly" | "Monthly";

function Snapshots() {
  const { can, filteredLocations, cycle, seatVersion } = useApp();
  const [open, setOpen] = useState<Snapshot | null>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const ids = filteredLocations.map((l) => l.id);
  const live = useMemo(() => kpis(totalsFor(ids, cycle)), [ids.join(), cycle, seatVersion]);
  const list = SNAPSHOTS.filter((s) => kind === "all" || s.kind === kind);

  const rowsOf = (s: Snapshot) => snapshotRows(s, filteredLocations, cycle);
  const exportSnap = (s: Snapshot) => downloadCsv(`snapshot-${s.id}`, rowsOf(s));
  const printSnap = (s: Snapshot) => printReport(`Snapshot — ${s.label}`, `Frozen ${s.frozen} · ${filteredLocations.length} locations`, rowsOf(s));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
        <CalendarClock size={16} />
        <span>Next automatic snapshot <b>Monday 23 Nov 2026, 9:00 am IST</b></span>
        <span className="text-xs text-brand-700/80">Snapshots are locked — back-dated edits in source systems only appear in later snapshots.</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["all", "Weekly", "Monthly"] as KindFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={clsx(
              "rounded-lg border px-3 py-1.5 text-sm transition",
              kind === k ? "border-brand-500 bg-brand-50 font-medium text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {k === "all" ? "All" : k}
            <span className="ml-1.5 text-xs text-slate-400">{k === "all" ? SNAPSHOTS.length : SNAPSHOTS.filter((s) => s.kind === k).length}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{filteredLocations.length} locations · cycle {cycle.replace("-", "–")}</span>
      </div>

      <Card bodyClass="p-0">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-medium">Snapshot</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
                <th className="px-3 py-2 text-right font-medium">FABS enrolled</th>
                <th className="px-3 py-2 text-right font-medium">Change vs previous</th>
                <th className="px-3 py-2 text-left font-medium">Seat fill</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular">
              {list.map((s) => {
                const f = snapshotFactor(s);
                const prev = SNAPSHOTS.slice(SNAPSHOTS.indexOf(s) + 1).find((x) => x.kind === s.kind);
                const enrolled = Math.round(live.enrolled * f);
                const delta = prev ? enrolled - Math.round(live.enrolled * snapshotFactor(prev)) : null;
                const fill = live.seatFill * f;
                return (
                  <tr key={s.id} className={clsx("cursor-pointer transition-colors hover:bg-slate-50", open?.id === s.id && "bg-brand-50/70 hover:bg-brand-50/70")} onClick={() => setOpen(s)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{s.label}</div>
                      <div className="text-xs text-slate-500"><Lock size={10} className="mr-1 inline" />Frozen {s.frozen}</div>
                    </td>
                    <td className="px-3 py-2.5"><Badge tone={s.kind === "Weekly" ? "blue" : "violet"}>{s.kind}</Badge></td>
                    <td className="px-3 py-2.5 text-right">{fmt(Math.round(live.leads * f))}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmt(enrolled)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {delta === null ? <span className="text-slate-300">—</span> : <span className={delta >= 0 ? "text-emerald-700" : "text-rose-600"}>{delta >= 0 ? "+" : "−"}{fmt(Math.abs(delta))} enrolled</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Rag value={fill} green={82} amber={72} />
                        <span>{fmtPct(fill)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => setOpen(s)}>View</Button>
                        {can("export") && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => printSnap(s)} title="PDF"><FileText size={13} /> PDF</Button>
                            <Button size="sm" variant="ghost" onClick={() => exportSnap(s)} title="Excel"><FileSpreadsheet size={13} /> Excel</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-3">
        <Note tone="phase2">Weekly commentary, principal approval, presentation mode, PowerPoint export and the action tracker are Phase 2.</Note>
      </div>
      <SnapshotDrawer snap={open} onClose={() => setOpen(null)} onNavigate={setOpen} />
    </>
  );
}

type Snapshot = (typeof SNAPSHOTS)[number];

function snapshotRows(s: Snapshot, locs: { id: string; name: string }[], cycle: Cycle) {
  const f = snapshotFactor(s);
  return locs.map((l) => {
    const k = kpis(locationTotals(l.id, cycle));
    return { Snapshot: s.label, Location: l.name, Leads: Math.round(k.leads * f), Applications: Math.round(k.applications * f), "FABS Enrolled": Math.round(k.enrolled * f), "Seat Fill %": Number((k.seatFill * f).toFixed(1)) };
  });
}

/** Mock frozen values: each older snapshot holds a slightly smaller cumulative position. */
function snapshotFactor(snap: Snapshot) {
  return 1 - SNAPSHOTS.indexOf(snap) * 0.025 - rng(snap.id)() * 0.01;
}

const SNAP_METRICS: { key: keyof ReturnType<typeof kpis>; label: string; source: string; pct?: boolean; lowerIsBetter?: boolean }[] = [
  { key: "leads", label: "Total Leads", source: "LeadSquared" },
  { key: "applications", label: "Applications", source: "SaaS" },
  { key: "crmConfirmed", label: "LeadSquared Confirmed", source: "LeadSquared" },
  { key: "enrolled", label: "FABS Enrolled", source: "FABS" },
  { key: "net", label: "Net Admissions", source: "FABS" },
  { key: "seatFill", label: "Seat Fill", source: "Computed", pct: true },
  { key: "pending", label: "Pending Fee", source: "Computed", lowerIsBetter: true },
  { key: "withdrawals", label: "Withdrawals", source: "FABS", lowerIsBetter: true },
];

function SnapshotDrawer({ snap, onClose, onNavigate }: { snap: Snapshot | null; onClose: () => void; onNavigate: (s: Snapshot) => void }) {
  const { filteredLocations, cycle, can, seatVersion } = useApp();
  const ids = filteredLocations.map((l) => l.id);
  const live = useMemo(() => kpis(totalsFor(ids, cycle)), [ids.join(), cycle, seatVersion]);
  if (!snap) return null;

  const idx = SNAPSHOTS.indexOf(snap);
  // Compare with the previous snapshot of the same kind (weekly vs weekly, monthly vs monthly).
  const prev = SNAPSHOTS.slice(idx + 1).find((s) => s.kind === snap.kind);
  const f = snapshotFactor(snap);
  const fPrev = prev ? snapshotFactor(prev) : null;
  const newer = SNAPSHOTS[idx - 1];
  const older = SNAPSHOTS[idx + 1];

  const value = (key: (typeof SNAP_METRICS)[number]["key"], factor: number) => live[key] * factor;

  const exportRows = () => snapshotRows(snap, filteredLocations, cycle);

  return (
    <Drawer
      open
      onClose={onClose}
      title={snap.label}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={snap.kind === "Weekly" ? "blue" : "violet"}>{snap.kind}</Badge>
          <span><Lock size={10} className="mr-1 inline" />Frozen {snap.frozen}</span>
          <span>· {filteredLocations.length} locations</span>
        </span>
      }
      headerExtra={
        <div className="flex items-center gap-0.5">
          <IconBtn label="Newer snapshot" disabled={!newer} onClick={() => newer && onNavigate(newer)}><ChevronLeft size={16} /></IconBtn>
          <IconBtn label="Older snapshot" disabled={!older} onClick={() => older && onNavigate(older)}><ChevronRight size={16} /></IconBtn>
        </div>
      }
      footer={
        can("export") ? (
          <>
            <Button size="sm" onClick={() => printReport(`Snapshot — ${snap.label}`, `Frozen ${snap.frozen} · ${filteredLocations.length} locations`, exportRows())}><FileText size={13} /> PDF</Button>
            <Button size="sm" onClick={() => downloadCsv(`snapshot-${snap.id}`, exportRows())}><FileSpreadsheet size={13} /> Excel</Button>
            <span className="ml-auto text-[11px] text-slate-400">Locked · figures do not change</span>
          </>
        ) : (
          <span className="text-[11px] text-slate-400">Locked snapshot · your role can view but not export</span>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        {SNAP_METRICS.map((m) => {
          const v = value(m.key, f);
          const p = fPrev !== null ? value(m.key, fPrev) : null;
          const change = p !== null ? (m.pct ? v - p : p ? ((v - p) / p) * 100 : 0) : null;
          const good = change !== null && (m.lowerIsBetter ? change <= 0 : change >= 0);
          return (
            <div key={m.key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{m.label}</span>
                <SourceTag system={m.source} />
              </div>
              <div className="mt-1 text-xl font-semibold tabular tracking-tight text-slate-900">
                {m.pct ? fmtPct(v) : fmt(Math.round(v))}
              </div>
              {change !== null && (
                <div className={`mt-0.5 text-[11px] tabular ${good ? "text-emerald-600" : "text-rose-600"}`}>
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(1)}
                  {m.pct ? " pp" : "%"} <span className="text-slate-400">vs {prev!.kind === "Weekly" ? "prev. week" : "prev. month"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">By location</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Location</th>
              <th className="px-3 py-2 text-right font-medium">Enrolled</th>
              <th className="px-3 py-2 text-right font-medium">Seat fill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular">
            {filteredLocations.map((l) => {
              const k = kpis(locationTotals(l.id, cycle));
              const fill = k.seatFill * f;
              return (
                <tr key={l.id}>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Rag value={fill} green={82} amber={72} />
                      <span className="truncate">{l.short}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(Math.round(k.enrolled * f))}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{fmtPct(fill)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Frozen copy of the dashboard at {snap.frozen}. Back-dated edits in SaaS, CRM or FABS after this time appear only in later snapshots.
      </p>
    </Drawer>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}



/** Icon and colour per report, matching the Dashboard's Download Reports panel. */
const REPORT_LOOK: Record<string, { icon: typeof Users; tint: string }> = {
  mis: { icon: BarChart3, tint: "bg-brand-50 text-brand-700 ring-brand-100" },
  vacancy: { icon: Users, tint: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  targets: { icon: GraduationCap, tint: "bg-violet-50 text-violet-600 ring-violet-100" },
  funnel: { icon: Filter, tint: "bg-sky-50 text-sky-600 ring-sky-100" },
  withdrawals: { icon: UserMinus, tint: "bg-rose-50 text-rose-600 ring-rose-100" },
  strength: { icon: Users, tint: "bg-teal-50 text-teal-600 ring-teal-100" },
  "withdrawal-list": { icon: ClipboardList, tint: "bg-rose-50 text-rose-500 ring-rose-100" },
  budget: { icon: Wallet, tint: "bg-orange-50 text-orange-600 ring-orange-100" },
  social: { icon: Share2, tint: "bg-teal-50 text-teal-600 ring-teal-100" },
  partners: { icon: Handshake, tint: "bg-violet-50 text-violet-600 ring-violet-100" },
  counsellor: { icon: UserCheck, tint: "bg-sky-50 text-sky-600 ring-sky-100" },
  ews: { icon: ShieldCheck, tint: "bg-slate-100 text-slate-600 ring-slate-200" },
  "mapping-audit": { icon: GitMerge, tint: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const GROUPS = ["Admissions", "Strength & withdrawals", "Marketing & outreach", "People & process"] as const;
type Group = (typeof GROUPS)[number];

/** What every export covers — taken from the Global Filters. */
function ScopeBar() {
  const { filteredLocations, cycle, vertical, board, can } = useApp();
  const one = filteredLocations.length === 1 ? filteredLocations[0] : null;
  const unit = vertical === "Higher Ed" ? "institution" : vertical === "Schools" ? "school" : "location";
  const chips = [
    { label: "Vertical", value: vertical === "All" ? "All verticals" : vertical },
    { label: one ? (one.vertical === "Schools" ? "School" : "Institution") : "Locations", value: one ? one.short : `${filteredLocations.length} ${unit}s` },
    ...(board !== "All" ? [{ label: "Board", value: board }] : []),
    { label: "Session", value: cycle.replace("-", "–") },
  ];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exports include</span>
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">
          <span className="text-slate-500">{c.label}</span>
          <b className="font-semibold text-slate-800">{c.value}</b>
        </span>
      ))}
      <span className="text-xs text-slate-400">Change these in Global Filters above</span>
      {!can("export") && (
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          <Lock size={11} /> Your role can view snapshots but not download reports
        </span>
      )}
    </div>
  );
}

function Downloads() {
  const { can, filteredLocations, cycle } = useApp();
  const canExport = can("export");
  const ids = filteredLocations.map((l) => l.id);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group | "all">("all");
  const [toast, setToast] = useState<{ text: ReactNode; tone: "ok" | "warn" } | null>(null);
  const [done, setDone] = useState<Record<string, "Excel" | "PDF">>({});

  const rowCounts = useMemo(
    () => Object.fromEntries(REPORT_DEFS.filter((r) => r.build).map((r) => [r.id, r.build!(ids, cycle).length])),
    [ids.join(), cycle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const s = q.trim().toLowerCase();
  const all = REPORT_DEFS.filter((r) => r.status !== "phase2");
  const matching = all.filter((r) => !s || `${r.name} ${r.desc} ${r.sources.join(" ")}`.toLowerCase().includes(s));
  const visible = matching.filter((r) => group === "all" || r.group === group);
  const later = REPORT_DEFS.filter((r) => r.status === "phase2");
  const scopeText = `${filteredLocations.length === 1 ? filteredLocations[0].name : `${filteredLocations.length} locations`} · session ${cycle.replace("-", "–")}`;

  const flash = (text: ReactNode, tone: "ok" | "warn" = "ok") => {
    const t = { text, tone };
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  };
  const exportExcel = (r: ReportDef) => {
    const rows = r.build!(ids, cycle);
    downloadCsv(`${r.id}-${cycle}`, rows);
    setDone((d) => ({ ...d, [r.id]: "Excel" }));
    flash(<>Downloaded <b>{r.name}</b> — {fmt(rows.length)} rows (CSV, opens in Excel)</>);
  };
  const exportPdf = (r: ReportDef) => {
    const ok = printReport(r.name, scopeText, r.build!(ids, cycle));
    if (ok) setDone((d) => ({ ...d, [r.id]: "PDF" }));
    flash(ok ? <>Printing <b>{r.name}</b> — choose “Save as PDF” as the printer</> : "Printing is not available in this browser.", ok ? "ok" : "warn");
  };

  return (
    <>
      <ScopeBar />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 lg:w-80">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports, e.g. vacancy or FABS" className="w-full bg-transparent text-sm outline-none" />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={13} /></button>
          )}
        </label>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Report group">
          {(["all", ...GROUPS] as const).map((g) => {
            const n = matching.filter((r) => g === "all" || r.group === g).length;
            return (
              <button
                key={g}
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                  group === g ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {g === "all" ? "All reports" : g}
                <span className={clsx("rounded-full px-1.5 text-[10px] tabular", group === g ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!visible.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <Search className="mx-auto text-slate-300" size={22} />
          <p className="mt-2 text-sm font-medium text-slate-700">No reports match{q ? ` “${q}”` : ""}{group !== "all" ? ` in ${group}` : ""}</p>
          <button onClick={() => { setQ(""); setGroup("all"); }} className="mt-1 text-sm text-brand-600 hover:underline">Clear search and filters</button>
        </div>
      )}

      <div className="space-y-6">
        {GROUPS.map((g) => {
          const reports = visible.filter((r) => r.group === g);
          if (!reports.length) return null;
          return (
            <section key={g}>
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="text-[15px] font-bold text-brand-900">{g}</h2>
                <span className="text-xs text-slate-400">{reports.length} report{reports.length === 1 ? "" : "s"}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {reports.map((r) => (
                  <ReportCard key={r.id} r={r} rows={rowCounts[r.id] ?? 0} canExport={canExport} done={done[r.id]} onExcel={() => exportExcel(r)} onPdf={() => exportPdf(r)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {later.length > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-sm">
          <span className="mr-2 inline-flex items-center gap-1.5 font-medium text-slate-600"><Clock size={14} /> Coming in Phase 2</span>
          {later.map((r) => <span key={r.id} className="mr-1.5 rounded-md bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">{r.name}</span>)}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={clsx(
            "fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg",
            toast.tone === "ok" ? "border-emerald-200 bg-white text-slate-700" : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          {toast.tone === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="-mr-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={13} /></button>
        </div>
      )}
    </>
  );
}

function ReportCard({ r, rows, canExport, done, onExcel, onPdf }: { r: ReportDef; rows: number; canExport: boolean; done?: "Excel" | "PDF"; onExcel: () => void; onPdf: () => void }) {
  const look = REPORT_LOOK[r.id] ?? { icon: FileText, tint: "bg-slate-100 text-slate-600 ring-slate-200" };
  const empty = !rows;
  return (
    <article className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset", look.tint)}>
          <look.icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-semibold leading-snug text-brand-900">{r.name}</h3>
            {r.status === "partial" && <Badge tone="amber">Partial</Badge>}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{r.desc}</p>
        </div>
      </div>

      {r.note && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
          <AlertTriangle size={12} className="mt-px shrink-0" /> {r.note}
        </p>
      )}

      <div className="min-h-3 flex-1" />
      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1">{r.sources.map((x) => <SourceTag key={x} system={x} />)}</div>
          <p className="text-[11px] tabular">
            {done ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 size={11} /> {done === "PDF" ? "Sent to print" : "Downloaded"} · {fmt(rows)} rows</span>
            ) : (
              <span className={empty ? "text-amber-700" : "text-slate-500"}>{empty ? "No rows for these filters" : `${fmt(rows)} rows`}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" disabled={!canExport || empty} onClick={onPdf} title={canExport ? "Open a printable copy — save it as PDF" : "Your role cannot download reports"}><FileText size={13} /> PDF</Button>
          <Button size="sm" variant="primary" disabled={!canExport || empty} onClick={onExcel} title={canExport ? "Download as CSV (opens in Excel)" : "Your role cannot download reports"}><FileSpreadsheet size={13} /> Excel</Button>
        </div>
      </div>
    </article>
  );
}
