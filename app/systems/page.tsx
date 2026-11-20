"use client";

import clsx from "clsx";
import { AlertTriangle, Building2, CheckCircle2, ChevronDown, Database, FileText, GitMerge, GraduationCap, Hourglass, Link2, UserCheck, UserMinus, Users, UserX, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { SnapshotCard } from "@/components/dashboard-widgets";
import { Badge, Card, Guard, Note, PageHeader, Pii, Table, Td, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import {
  crmSample, fabsSample, FUNNEL_STAGES, LOCATIONS, locationTotals, locationUnits, mappingQueue, saasSample, sourceBreakdown,
  STATUS_MAPPINGS, statusLeadCounts, SYNC_STATUS, totalsFor, type FunnelStage, type Location,
} from "@/lib/data";

type Sys = "SaaS" | "LeadSquared" | "FABS";
type T = ReturnType<typeof totalsFor>;

const SYSTEMS: { id: Sys; role: string; icon: typeof Database; bar: string }[] = [
  { id: "SaaS", role: "Registration forms on school websites", icon: FileText, bar: "bg-sky-500" },
  { id: "LeadSquared", role: "All leads, statuses and counsellors", icon: Database, bar: "bg-violet-500" },
  { id: "FABS", role: "Fee payment, roster and withdrawals", icon: Wallet, bar: "bg-emerald-500" },
];

/** Resolves a system's location code to the School Master name. */
const codeName = (sys: "saas" | "crm" | "fabs", code: string) => LOCATIONS.find((l) => l.codes[sys] === code)?.short ?? "Unknown code";

export default function SystemsPage() {
  return (
    <Guard perm="view.systems">
      <Systems />
    </Guard>
  );
}

function Systems() {
  const { filteredLocations, allowedLocations, cycle, seatVersion } = useApp();
  const locs = filteredLocations.length ? filteredLocations : allowedLocations;
  const ids = locs.map((l) => l.id);
  const [tab, setTab] = useState<Sys>("LeadSquared");
  const t = useMemo(() => totalsFor(ids, cycle), [ids.join(), cycle, seatVersion]);
  const sync = SYNC_STATUS.find((s) => s.system === tab)!;

  return (
    <>
      <PageHeader
        title="System Views"
        subtitle="Raw counts as each source system reports them, using its own codes. Views may overlap — the central funnel never double-counts."
      />

      {/* System picker: doubles as a sync-health summary */}
      <div role="tablist" className="grid gap-3 md:grid-cols-3">
        {SYSTEMS.map((s) => {
          const st = SYNC_STATUS.find((x) => x.system === s.id)!;
          const active = tab === s.id;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(s.id)}
              className={clsx(
                "flex items-start gap-3 rounded-xl border bg-white p-3.5 text-left transition",
                active ? "border-brand-500 ring-2 ring-brand-500/15" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white", s.bar)}>
                <s.icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{s.id}</span>
                  {st.status === "ok" ? (
                    <Badge tone="green"><CheckCircle2 size={11} /> Synced {st.minutesAgo} min ago</Badge>
                  ) : (
                    <Badge tone="amber"><AlertTriangle size={11} /> Delayed · {st.minutesAgo} min</Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{s.role}</span>
                <span className="mt-1 block text-xs text-slate-400 tabular">{fmt(st.records)} records held</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={clsx(
          "mb-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2 text-xs",
          sync.status === "ok" ? "border-slate-200 bg-white text-slate-600" : "border-amber-200 bg-amber-50 text-amber-800",
        )}
      >
        {sync.status === "ok" ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} />}
        <span>
          <b>{tab}</b> last successful sync {sync.lastSync}
        </span>
        <span className="opacity-80">· {sync.note}</span>
        <span className="ml-auto opacity-80">Next run {sync.nextRun} · nightly reconciliation 02:00 IST</span>
      </div>

      {tab === "SaaS" && <SaasView locs={locs} t={t} />}
      {tab === "LeadSquared" && <CrmView locs={locs} t={t} />}
      {tab === "FABS" && <FabsView locs={locs} t={t} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function BarList({ rows, color, unit }: { rows: { label: string; sub?: string; value: number }[]; color: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label + (r.sub ?? "")}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-slate-700">
              {r.label}
              {r.sub && <span className="ml-1.5 font-mono text-[10px] text-slate-400">{r.sub}</span>}
            </span>
            <span className="shrink-0 tabular">
              <b className="font-semibold text-slate-900">{fmt(r.value)}</b>
              {unit && <span className="text-slate-400"> {unit}</span>}
              <span className="ml-1.5 text-slate-400">{total ? Math.round((r.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={clsx("h-full rounded-full", color)} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A system location code with the School Master name it resolves to. */
function Code({ sys, code }: { sys: "saas" | "crm" | "fabs"; code: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-mono text-xs">{code}</span>
      <span className="ml-1.5 text-xs text-slate-400">{codeName(sys, code)}</span>
    </span>
  );
}

function TotalRow({ cells }: { cells: ReactNode[] }) {
  return (
    <tr className="bg-slate-50 font-semibold">
      {cells.map((c, i) => <Td key={i}>{c}</Td>)}
    </tr>
  );
}

/** Top grades / programmes by a metric, across the selected locations. */
function topUnits(locs: Location[], cycle: Parameters<typeof locationUnits>[1], metric: "registered" | "enrolled", n = 10) {
  const map = new Map<string, number>();
  for (const l of locs)
    for (const u of locationUnits(l.id, cycle)) {
      const label = l.vertical === "Schools" ? `Grade ${u.unit}` : u.unit.replace(" – Y1", "");
      map.set(label, (map.get(label) ?? 0) + u[metric]);
    }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, n);
}

/* ------------------------------------------------------------------ */
/* SaaS                                                                */
/* ------------------------------------------------------------------ */

function SaasView({ locs, t }: { locs: Location[]; t: T }) {
  const { cycle } = useApp();
  const ids = locs.map((l) => l.id);
  const rows = useMemo(() => saasSample(ids), [ids.join()]);
  const byLoc = locs.map((l) => {
    const reg = locationTotals(l.id, cycle).registered;
    const forms = Math.round(reg * 1.04);
    return { loc: l, forms, linked: reg, pending: forms - reg };
  });
  const sum = (k: "forms" | "linked" | "pending") => byLoc.reduce((s, r) => s + r[k], 0);
  const units = useMemo(() => topUnits(locs, cycle, "registered"), [ids.join(), cycle]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SnapshotCard theme="blue" icon={FileText} label="Registration forms" value={sum("forms")} change={null} sub="Submitted on school websites" />
        <SnapshotCard theme="green" icon={Link2} label="Linked to a LeadSquared lead" value={sum("linked")} change={null} sub="SaaS form ID stored on the lead" />
        <SnapshotCard theme={sum("pending") ? "orange" : "green"} icon={Hourglass} label="Not yet in LeadSquared" value={sum("pending")} change={null} sub="Waiting for the SaaS → LeadSquared sync" />
        <SnapshotCard theme="violet" icon={Building2} label="Schools reporting" value={locs.length} change={null} sub="With a mapped SaaS location code" />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Registrations by location" subtitle="SaaS location codes, resolved through the School Master" bodyClass="p-0">
          <Table head={["Location", "SaaS code", "Forms", "In LeadSquared", "Not yet in LeadSquared", "Share"]}>
            {byLoc.map((r) => (
              <tr key={r.loc.id}>
                <Td className="font-medium">{r.loc.short}</Td>
                <Td className="font-mono text-xs text-slate-500">{r.loc.codes.saas}</Td>
                <Td className="font-semibold">{fmt(r.forms)}</Td>
                <Td>{fmt(r.linked)}</Td>
                <Td className={r.pending ? "text-amber-700" : "text-slate-400"}>{fmt(r.pending)}</Td>
                <Td className="w-40">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${(r.forms / Math.max(...byLoc.map((x) => x.forms))) * 100}%` }} />
                  </div>
                </Td>
              </tr>
            ))}
            {byLoc.length > 1 && <TotalRow cells={["All", "", fmt(sum("forms")), fmt(sum("linked")), fmt(sum("pending")), ""]} />}
          </Table>
        </Card>
        <Card className="xl:col-span-2" title="Top grades & programmes" subtitle="By registration forms submitted">
          <BarList rows={units} color="bg-sky-500" />
        </Card>
      </div>

      <Card className="mt-4" title="Latest registration forms" subtitle="Most recent first" bodyClass="p-0">
        <Table head={["Form ID", "Child", "Parent", "Mobile", "SaaS location", "Grade / programme", "Submitted", "In LeadSquared"]}>
          {rows.map((r) => (
            <tr key={r.formId}>
              <Td className="font-mono text-xs">{r.formId}</Td>
              <Td className="font-medium">{r.child}</Td>
              <Td>{r.parent}</Td>
              <Td><Pii value={r.mobile} /></Td>
              <Td><Code sys="saas" code={r.location} /></Td>
              <Td>{r.unit}</Td>
              <Td>{r.submitted}</Td>
              <Td>{r.syncedToCrm ? <Badge tone="green">Yes</Badge> : <Badge tone="amber">Pending</Badge>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* LeadSquared                                                                 */
/* ------------------------------------------------------------------ */

function CrmView({ locs, t }: { locs: Location[]; t: T }) {
  const { cycle } = useApp();
  const ids = locs.map((l) => l.id);
  const rows = useMemo(() => crmSample(ids), [ids.join()]);
  const sources = useMemo(() => sourceBreakdown(ids, cycle), [ids.join(), cycle]);
  const onlyHigherEd = locs.every((l) => l.vertical === "Higher Ed");
  // Shared with Masters so both pages show the same lead count per status.
  const counts = statusLeadCounts(locs.map((l) => l.id), cycle, onlyHigherEd);

  // Group raw statuses by the funnel stage they map to; unmapped first so they can't be missed.
  const groups = useMemo(() => {
    const order: FunnelStage[] = ["Unmapped", ...FUNNEL_STAGES];
    return order
      .map((stage) => {
        const items = STATUS_MAPPINGS.filter((m) => (onlyHigherEd ? m.higherEd : m.schools) === stage).map((m) => ({
          status: m.status,
          leads: counts[m.status],
        }));
        return { stage, items, total: items.reduce((s, i) => s + i.leads, 0) };
      })
      .filter((g) => g.items.length);
  }, [ids.join(), cycle, onlyHigherEd]);
  const maxStatus = Math.max(1, ...groups.flatMap((g) => g.items.map((i) => i.leads)));
  // Stage groups start collapsed except Unmapped, which needs action.
  const [open, setOpen] = useState<Set<FunnelStage>>(() => new Set<FunnelStage>(["Unmapped"]));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SnapshotCard theme="blue" icon={Users} label="Leads (all sources)" value={t.leads} change={null} sub="After LeadSquared de-duplication" />
        <SnapshotCard theme="violet" icon={FileText} label="Offer Letter" value={t.offers} change={null} sub="Status: Offer Letter" />
        <SnapshotCard theme="green" icon={UserCheck} label="Admission / Orientation" value={t.crmConfirmed} change={null} sub="Marked by counsellors" />
        <SnapshotCard theme="rose" icon={UserX} label="Cold / lost" value={t.lost} change={null} sub={`${((t.lost / Math.max(1, t.leads)) * 100).toFixed(0)}% of leads`} />
      </div>

      {/* Three equal columns on wide screens; status list stacks above the two bar lists on narrower ones. */}
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-3 2xl:items-stretch">
        <Card
          title="Leads by LeadSquared status"
          subtitle={`Raw LeadSquared statuses grouped by the funnel stage they map to (${onlyHigherEd ? "Higher Ed" : "Schools"} mapping)`}
          bodyClass="p-0"
          actions={
            <button onClick={() => setOpen(open.size === groups.length ? new Set(["Unmapped"]) : new Set(groups.map((g) => g.stage)))} className="rounded-md px-2 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
              {open.size === groups.length ? "Collapse" : "Expand all"}
            </button>
          }
        >
          <table className="w-full text-sm tabular">
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.stage} stage={g.stage} total={g.total} items={g.items} max={maxStatus} share={(g.total / Math.max(1, t.leads)) * 100} open={open.has(g.stage)} onToggle={() => setOpen((s) => { const n = new Set(s); n.has(g.stage) ? n.delete(g.stage) : n.add(g.stage); return n; })} />
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4 2xl:contents 2xl:space-y-0">
          <Card title="Leads by source" subtitle="LeadSquared source field">
            <BarList rows={[...sources].sort((a, b) => b.leads - a.leads).map((s) => ({ label: s.source, value: s.leads }))} color="bg-violet-500" />
          </Card>
          <Card title="Leads by location" subtitle="LeadSquared location codes, resolved through the School Master">
            <BarList
              rows={locs
                .map((l) => ({ label: l.short, sub: l.codes.crm, value: locationTotals(l.id, cycle).leads }))
                .sort((a, b) => b.value - a.value)}
              color="bg-violet-400"
            />
          </Card>
        </div>
      </div>

      <Card className="mt-4" title="Recently modified leads" subtitle="Most recent first" bodyClass="p-0">
        <Table head={["Lead ID", "Child", "Mobile", "LeadSquared location", "Grade / programme", "Source", "Status", "Owner", "SaaS form", "Modified"]}>
          {rows.map((r) => (
            <tr key={r.leadId}>
              <Td className="font-mono text-xs">{r.leadId}</Td>
              <Td className="font-medium">{r.child}</Td>
              <Td><Pii value={r.mobile} /></Td>
              <Td><Code sys="crm" code={r.location} /></Td>
              <Td>{r.unit}</Td>
              <Td>{r.source}</Td>
              <Td>{r.status}</Td>
              <Td>{r.owner}</Td>
              <Td className="font-mono text-xs text-slate-500">{r.saasFormId}</Td>
              <Td>{r.modified}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="mt-3">
        <Note tone="phase2">Follow-up / call activity history is not shown — depends on whether the LeadSquared API exposes it (open item #6).</Note>
      </div>
    </>
  );
}

function GroupRows({
  stage, total, items, max, share, open, onToggle,
}: { stage: FunnelStage; total: number; items: { status: string; leads: number }[]; max: number; share: number; open: boolean; onToggle: () => void }) {
  const unmapped = stage === "Unmapped";
  return (
    <>
      <tr
        className={clsx("cursor-pointer border-b transition", unmapped ? "border-rose-200 bg-rose-50 hover:bg-rose-100/70" : "border-slate-100 hover:bg-slate-50")}
        onClick={onToggle}
        aria-expanded={open}
      >
        <td className="py-2.5 pl-4 pr-2">
          <span className={clsx("flex items-center gap-2 text-sm font-semibold", unmapped ? "text-rose-700" : "text-slate-800")}>
            <ChevronDown size={15} className={clsx("shrink-0 transition-transform", !open && "-rotate-90", unmapped ? "text-rose-500" : "text-slate-400")} />
            {unmapped && <AlertTriangle size={13} />}
            {unmapped ? "Unmapped" : stage}
            <span className="text-xs font-normal text-slate-400">{items.length} status{items.length === 1 ? "" : "es"}</span>
          </span>
          {unmapped && <span className="ml-[23px] block text-[11px] font-normal text-rose-600">Not counted in any stage until mapped in Masters</span>}
        </td>
        <td className="w-[38%] px-2 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={clsx("h-full rounded-full", unmapped ? "bg-rose-400" : "bg-violet-500")} style={{ width: `${Math.max(1, Math.min(100, share))}%` }} />
            </div>
            <span className="w-10 text-right text-[11px] text-slate-500 tabular">{share < 1 ? share.toFixed(1) : share.toFixed(0)}%</span>
          </div>
        </td>
        <td className={clsx("px-4 py-2.5 text-right text-sm font-semibold tabular", unmapped ? "text-rose-700" : "text-slate-900")}>{fmt(total)}</td>
      </tr>
      {open &&
        items.map((i) => (
          <tr key={i.status} className={clsx("border-b border-slate-100", unmapped ? "bg-rose-50/40" : "bg-slate-50/50")}>
            <td className="py-1.5 pl-11 pr-2 text-slate-600">{i.status}</td>
            <td className="w-[38%] px-2 py-1.5">
              <div className="mr-12 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={clsx("h-full rounded-full", unmapped ? "bg-rose-300" : "bg-violet-300")} style={{ width: `${(i.leads / max) * 100}%` }} />
              </div>
            </td>
            <td className="px-4 py-1.5 text-right text-slate-600 tabular">{fmt(i.leads)}</td>
          </tr>
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* FABS                                                                */
/* ------------------------------------------------------------------ */

function FabsView({ locs, t }: { locs: Location[]; t: T }) {
  const { cycle } = useApp();
  const ids = locs.map((l) => l.id);
  const rows = useMemo(() => fabsSample(ids), [ids.join()]);
  const strength = t.continuing + t.enrolled - t.withdrawnNew - t.withdrawnExisting;
  const byLoc = locs.map((l) => {
    const lt = locationTotals(l.id, cycle);
    const w = lt.withdrawnNew + lt.withdrawnExisting;
    const open = mappingQueue(l.id).filter((m) => m.state === "suggested" || m.state === "unmatched").length;
    return { loc: l, enrolled: lt.enrolled, roster: lt.continuing + lt.enrolled - w, w, unmapped: lt.unmapped, open };
  });
  const sum = (k: "enrolled" | "roster" | "w" | "unmapped") => byLoc.reduce((s, r) => s + r[k], 0);
  const units = useMemo(() => topUnits(locs, cycle, "enrolled"), [ids.join(), cycle]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SnapshotCard theme="green" icon={GraduationCap} label="New admissions (fee paid)" value={t.enrolled} change={null} sub="Admission no. generated" />
        <SnapshotCard theme="blue" icon={Users} label="Active roster" value={strength} change={null} sub="Current strength" />
        <SnapshotCard theme="rose" icon={UserMinus} label="Withdrawals" value={t.withdrawnNew + t.withdrawnExisting} change={null} sub={`${t.withdrawnNew} new · ${t.withdrawnExisting} existing`} />
        <SnapshotCard theme={t.unmapped ? "orange" : "green"} icon={GitMerge} label="Unmapped to LeadSquared" value={t.unmapped} change={null} sub="Awaiting Admission Mapping" />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="FABS by location" subtitle="FABS location codes, resolved through the School Master" bodyClass="p-0">
          <Table head={["Location", "FABS code", "New admissions", "Active roster", "Withdrawals", "Unmapped to LeadSquared"]}>
            {byLoc.map((r) => (
              <tr key={r.loc.id}>
                <Td className="font-medium">{r.loc.short}</Td>
                <Td className="font-mono text-xs text-slate-500">{r.loc.codes.fabs}</Td>
                <Td>{fmt(r.enrolled)}</Td>
                <Td className="font-semibold">{fmt(r.roster)}</Td>
                <Td className={r.w ? "text-rose-600" : "text-slate-400"}>{fmt(r.w)}</Td>
                <Td>{r.unmapped ? <Badge tone="red">{r.unmapped}</Badge> : <span className="text-slate-400">0</span>}</Td>
              </tr>
            ))}
            {byLoc.length > 1 && <TotalRow cells={["All", "", fmt(sum("enrolled")), fmt(sum("roster")), fmt(sum("w")), fmt(sum("unmapped"))]} />}
          </Table>
        </Card>
        <Card className="xl:col-span-2" title="Top grades & programmes" subtitle="By new admissions (fee paid)">
          <BarList rows={units} color="bg-emerald-500" />
        </Card>
      </div>

      <Card className="mt-4" title="Latest FABS student records" subtitle="Most recent fee payments first · academic year as stored in FABS" bodyClass="p-0">
        <Table head={["Admission no.", "Student", "FABS location", "Grade / programme", "Academic year", "Fee paid", "Status", "Withdrawal reason"]}>
          {rows.map((r) => (
            <tr key={r.admNo}>
              <Td className="font-mono text-xs">{r.admNo}</Td>
              <Td className="font-medium">{r.child}</Td>
              <Td><Code sys="fabs" code={r.location} /></Td>
              <Td>{r.unit}</Td>
              <Td>{r.academicYear.replace("-", "–")}</Td>
              <Td>{r.feePaid}</Td>
              <Td>{r.status === "Active" ? <Badge tone="green">Active</Badge> : <Badge tone="red">Withdrawn</Badge>}</Td>
              <Td className={r.reason === "—" ? "text-slate-400" : ""}>{r.reason}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="mt-3">
        <Note>
          FABS has no LeadSquared lead ID — each new admission is linked through Admission Mapping. Admission category (EWS/DG) and refund status are pending
          confirmation (open item #7).
        </Note>
      </div>
    </>
  );
}
