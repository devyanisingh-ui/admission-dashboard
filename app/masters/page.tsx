"use client";

import clsx from "clsx";
import { AlertTriangle, Building2, Check, CheckCircle2, GitBranch, Layers, ListChecks, Megaphone, UserMinus, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Dropdown } from "@/components/dropdown";
import { ConfirmDialog, Field, inputCls, MasterEditor, MasterToolbar, NewBadge, RowActions } from "@/components/master-kit";
import { Badge, Button, Card, Guard, Note, PageHeader, Tabs, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import { DATA_TODAY, FUNNEL_STAGES, statusLeadCounts, type FunnelStage } from "@/lib/data";
import { describeChanges, nowLabel, seedMasters, type StatusRec } from "@/lib/masters";
import { AuditTab, ReasonsTab, SourcesTab } from "./tab-lists";
import { LocationsTab, UnitsTab } from "./tab-locations";
import { EditBadge, EmptyRow, FilterChip, sameText, tdc, thL, thR, useListFilter, type Commit, type TabProps } from "./shared";

export default function MastersPage() {
  return (
    <Guard perm="view.masters">
      <Masters />
    </Guard>
  );
}

type Tab = "status" | "locations" | "units" | "sources" | "reasons" | "log";

function Masters() {
  // Master data lives in the app context, so every page reads the same lists.
  const { filteredLocations, cycle, userName, can, masters: store, setMasters: setStore, seatVersion } = useApp();
  const [tab, setTab] = useState<Tab>("status");
  const [toast, setToast] = useState<string | null>(null);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3500);
  };
  const commit: Commit = (update, log) => {
    setStore((s) => {
      const next = update(s);
      const entry = { id: Math.random().toString(36).slice(2), at: nowLabel(), who: userName, ...log };
      return { ...next, audit: [entry, ...s.audit].slice(0, 300) };
    });
    flash(`${log.master} “${log.record}” ${log.action.toLowerCase()} · audit-logged`);
  };
  const reset = () => {
    setStore(() => seedMasters());
    flash("Master data reset to the source-system data");
  };

  const ids = filteredLocations.map((l) => l.id);
  // Same lead counts as System Views, following the Global Filters.
  const leadCounts = useMemo(
    () => statusLeadCounts(ids, cycle, filteredLocations.length > 0 && filteredLocations.every((l) => l.vertical === "Higher Ed")),
    [ids.join(), cycle, seatVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const statuses = store.statuses.filter((s) => s.active);
  const unmapped = statuses.filter((r) => !r.pendingApproval && (r.schools === "Unmapped" || r.higherEd === "Unmapped")).length;
  const pending = statuses.filter((r) => r.pendingApproval).length;
  const open = unmapped + pending;
  const activeLocs = store.locations.filter((l) => l.active);
  const activeUnits = store.units.filter((u) => u.active && activeLocs.some((l) => l.id === u.locId));
  const inactive = (n: number) => (n ? ` · ${n} inactive` : "");

  const tabProps: TabProps = { store, commit };

  return (
    <>
      <PageHeader title="Masters & configuration" subtitle="Maintained by the Central Admin / Support team · approvals by the Vertical Admissions Head · every change is audit-logged" />

      {/* Health of each master — click to open its tab */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        <HealthCard
          active={tab === "status"} onClick={() => setTab("status")} icon={ListChecks} tone={unmapped ? "rose" : pending ? "orange" : "green"}
          label="Status mapping" value={`${statuses.length - open} / ${statuses.length}`}
          sub={unmapped ? `${unmapped} need mapping${pending ? ` · ${pending} pending` : ""}` : pending ? `${pending} pending approval` : "All mapped and approved"}
        />
        <HealthCard
          active={tab === "locations"} onClick={() => setTab("locations")} icon={Building2} tone="green"
          label="Locations" value={activeLocs.length} sub={`Active${inactive(store.locations.length - activeLocs.length)}`}
        />
        <HealthCard
          active={tab === "units"} onClick={() => setTab("units")} icon={Layers} tone="blue"
          label="Grades & programmes" value={fmt(activeUnits.length)} sub={`Across ${activeLocs.length} locations`}
        />
        <HealthCard
          active={tab === "sources"} onClick={() => setTab("sources")} icon={Megaphone} tone="violet"
          label="Lead sources" value={store.sources.filter((s) => s.active).length} sub={`In 6 reporting groups${inactive(store.sources.filter((s) => !s.active).length)}`}
        />
        <HealthCard
          active={tab === "reasons"} onClick={() => setTab("reasons")} icon={UserMinus} tone="rose-soft"
          label="Withdrawal reasons" value={store.reasons.filter((s) => s.active).length} sub={`Active${inactive(store.reasons.filter((s) => !s.active).length)}`}
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "status", label: <>Status mapping {open > 0 && <Badge tone="red" className="ml-1">{open}</Badge>}</> },
          { id: "locations", label: "Locations" },
          { id: "units", label: "Grades & programmes" },
          { id: "sources", label: "Lead sources" },
          { id: "reasons", label: "Withdrawal reasons" },
          { id: "log", label: <>Change log {store.audit.length > 0 && <span className="ml-1 text-xs text-slate-400">{store.audit.length}</span>}</> },
        ]}
      />
      {tab === "status" && <StatusMappingTab {...tabProps} leadCounts={leadCounts} />}
      {tab === "locations" && <LocationsTab {...tabProps} />}
      {tab === "units" && <UnitsTab {...tabProps} />}
      {tab === "sources" && <SourcesTab {...tabProps} />}
      {tab === "reasons" && <ReasonsTab {...tabProps} />}
      {tab === "log" && <AuditTab store={store} onReset={reset} canReset={can("locationMaster.edit")} />}

      <p className="mt-4 text-[11px] text-slate-400">
        Changes apply across the dashboard straight away (filters, reports, Seat Matrix and System Views). Demo: master data is saved in this browser.
      </p>

      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="-mr-1 rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Status mapping                                                      */
/* ------------------------------------------------------------------ */

const STAGE_OPTIONS: FunnelStage[] = [...FUNNEL_STAGES, "Unmapped"];
type StatusFilter = "all" | "unmapped" | "pending" | "approved";
const stateOf = (r: StatusRec): Exclude<StatusFilter, "all"> =>
  r.pendingApproval ? "pending" : r.schools === "Unmapped" || r.higherEd === "Unmapped" ? "unmapped" : "approved";
const todayLabel = () => DATA_TODAY.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function StatusMappingTab({ store, commit, leadCounts }: TabProps & { leadCounts: Record<string, number> }) {
  const { can } = useApp();
  const canEdit = can("status.edit");
  const canApprove = can("status.approve");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<StatusRec | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "deactivate"; id: string } | null>(null);
  const f = useListFilter(store.statuses, (r) => r.status);
  const leads = (r: StatusRec) => leadCounts[r.status] ?? 0;
  const inUse = (r: StatusRec) => !r.custom || leads(r) > 0;

  const counted = f.visible;
  const counts = {
    all: counted.length,
    unmapped: counted.filter((r) => stateOf(r) === "unmapped").length,
    pending: counted.filter((r) => stateOf(r) === "pending").length,
    approved: counted.filter((r) => stateOf(r) === "approved").length,
  };
  const order = { unmapped: 0, pending: 1, approved: 2 };
  const visible = counted.filter((r) => filter === "all" || stateOf(r) === filter).sort((a, b) => order[stateOf(a)] - order[stateOf(b)] || Number(b.active) - Number(a.active));
  const target = confirm ? store.statuses.find((s) => s.id === confirm.id) : undefined;

  const setStage = (r: StatusRec, key: "schools" | "higherEd", stage: FunnelStage) =>
    commit((s) => ({ ...s, statuses: s.statuses.map((x) => (x.id === r.id ? { ...x, [key]: stage, pendingApproval: stage !== "Unmapped" } : x)) }), {
      master: "Status mapping", action: "Updated", record: r.status, detail: `${key === "schools" ? "Schools" : "Higher Ed"} stage: ${r[key]} → ${stage}${stage !== "Unmapped" ? " (pending approval)" : ""}`,
    });
  const approve = (r: StatusRec) =>
    commit((s) => ({ ...s, statuses: s.statuses.map((x) => (x.id === r.id ? { ...x, pendingApproval: false, approvedBy: "Vertical Admissions Head" } : x)) }), {
      master: "Status mapping", action: "Approved", record: r.status, detail: `Schools → ${r.schools} · Higher Ed → ${r.higherEd}`,
    });
  const save = (next: StatusRec, before: StatusRec | null) => {
    const mapped = next.schools !== "Unmapped" || next.higherEd !== "Unmapped";
    const changedStages = !before || before.schools !== next.schools || before.higherEd !== next.higherEd;
    const rec = { ...next, pendingApproval: changedStages ? mapped : next.pendingApproval };
    commit((s) => ({ ...s, statuses: before ? s.statuses.map((x) => (x.id === before.id ? rec : x)) : [...s.statuses, rec] }), {
      master: "Status mapping", action: before ? "Updated" : "Created", record: rec.status,
      detail: before
        ? describeChanges(before, rec, { status: "Status", schools: "Schools stage", higherEd: "Higher Ed stage" }) + (changedStages && mapped ? " (pending approval)" : "")
        : `Schools → ${rec.schools} · Higher Ed → ${rec.higherEd}${mapped ? " (pending approval)" : ""}`,
    });
    setEditing(null);
  };
  const setActive = (r: StatusRec, active: boolean) =>
    commit((s) => ({ ...s, statuses: s.statuses.map((x) => (x.id === r.id ? { ...x, active } : x)) }), {
      master: "Status mapping", action: active ? "Reactivated" : "Deactivated", record: r.status, detail: active ? "Counted in the funnel again" : "Retired — no longer expected from LeadSquared",
    });
  const remove = (r: StatusRec) =>
    commit((s) => ({ ...s, statuses: s.statuses.filter((x) => x.id !== r.id) }), { master: "Status mapping", action: "Deleted", record: r.status, detail: "Had no leads" });

  return (
    <>
      {counts.unmapped > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>{counts.unmapped} LeadSquared status{counts.unmapped === 1 ? " is" : "es are"} not mapped.</b> Leads with these statuses sit in the Unmapped bucket and
            are excluded from stage counts until mapped and approved.
          </div>
        </div>
      )}

      <MasterToolbar
        q={f.q} setQ={f.setQ} placeholder="Search LeadSquared status"
        showInactive={f.showInactive} setShowInactive={f.setShowInactive} inactiveCount={f.inactiveCount}
        canEdit={canEdit} onAdd={() => setEditing("new")} addLabel="Add status"
      >
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} tone="slate" />
        <FilterChip active={filter === "unmapped"} onClick={() => setFilter("unmapped")} label="Needs mapping" count={counts.unmapped} tone="red" />
        <FilterChip active={filter === "pending"} onClick={() => setFilter("pending")} label="Pending approval" count={counts.pending} tone="amber" />
        <FilterChip active={filter === "approved"} onClick={() => setFilter("approved")} label="Approved" count={counts.approved} tone="green" />
      </MasterToolbar>

      <Card
        title="LeadSquared status → dashboard funnel stage"
        subtitle="Statuses are pulled from the LeadSquared API · Schools and Higher Ed may map differently · a change takes effect once approved"
        bodyClass="p-0"
        actions={<EditBadge editable={canEdit} approver={canApprove} label="Editable — changes need approval" />}
      >
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>LeadSquared status</th>
                <th className={thR}>Leads</th>
                <th className={thL}>Schools stage</th>
                <th className={thL}>Higher Ed stage</th>
                <th className={thL}>First seen</th>
                <th className={thL}>State</th>
                <th className={thR}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const st = stateOf(r);
                const differs = r.schools !== r.higherEd;
                return (
                  <tr key={r.id} className={clsx(!r.active ? "bg-slate-50/60 text-slate-400" : st === "unmapped" ? "bg-rose-50/50" : st === "pending" ? "bg-amber-50/50" : "hover:bg-slate-50/70")}>
                    <td className={clsx(tdc, "font-medium")}>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {r.status}
                        {r.custom && <NewBadge />}
                        {differs && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600" title="Schools and Higher Ed map this status to different stages">
                            <GitBranch size={10} /> differs by vertical
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={clsx(tdc, "text-right tabular")}>{fmt(leads(r))}</td>
                    {(["schools", "higherEd"] as const).map((k) => (
                      <td key={k} className={tdc}>
                        {canEdit && r.active ? (
                          <Dropdown<FunnelStage>
                            size="sm" triggerWidth="w-52"
                            ariaLabel={`${r.status} – ${k === "schools" ? "Schools" : "Higher Ed"} stage`}
                            value={r[k]} onChange={(v) => v !== r[k] && setStage(r, k, v)}
                            tone={r[k] === "Unmapped" ? "danger" : "default"}
                            options={STAGE_OPTIONS.map((s) => ({ value: s, label: s }))}
                          />
                        ) : r[k] === "Unmapped" ? (
                          <Badge tone="red">Unmapped</Badge>
                        ) : (
                          r[k]
                        )}
                      </td>
                    ))}
                    <td className={clsx(tdc, "whitespace-nowrap text-xs text-slate-500")}>{r.firstSeen}</td>
                    <td className={tdc}>
                      {!r.active ? <Badge>Inactive</Badge> : st === "pending" ? <Badge tone="amber">Pending approval</Badge> : st === "unmapped" ? <Badge tone="red">Needs mapping</Badge> : <Badge tone="green">Approved</Badge>}
                    </td>
                    <td className={clsx(tdc, "whitespace-nowrap")}>
                      <div className="flex items-center justify-end gap-1">
                        {st === "pending" && r.active && canApprove && (
                          <Button size="sm" variant="primary" onClick={() => approve(r)}><Check size={12} /> Approve</Button>
                        )}
                        <RowActions
                          canEdit={canEdit} active={r.active} inUse={inUse(r)} label={r.status} inUseReason="Leads already have this status"
                          onEdit={() => setEditing(r)}
                          onDelete={() => setConfirm({ kind: "delete", id: r.id })}
                          onToggleActive={() => (r.active ? setConfirm({ kind: "deactivate", id: r.id }) : setActive(r, true))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && <EmptyRow cols={7}>No statuses match.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-3">
        <Note>Fee Paid / Enrolled and Withdrawn are not LeadSquared statuses — they come from FABS. Cold Lead maps to Lost.</Note>
      </div>

      {editing && (
        <StatusEditor key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} all={store.statuses} leads={editing === "new" ? 0 : leads(editing)} onClose={() => setEditing(null)} onSave={save} />
      )}
      {confirm && target && (
        confirm.kind === "delete" ? (
          <ConfirmDialog title={`Delete “${target.status}”?`} confirmLabel="Delete status" onConfirm={() => remove(target)} onClose={() => setConfirm(null)}>
            No leads have this status, so it can be removed. If LeadSquared sends it later it will reappear here as unmapped.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog tone="warn" title={`Deactivate “${target.status}”?`} confirmLabel="Deactivate" onConfirm={() => setActive(target, false)} onClose={() => setConfirm(null)}>
            {fmt(leads(target))} leads have this status. Deactivating marks it as retired in LeadSquared; those leads keep their history and current stage.
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function StatusEditor({ row, all, leads, onClose, onSave }: { row: StatusRec | null; all: StatusRec[]; leads: number; onClose: () => void; onSave: (r: StatusRec, before: StatusRec | null) => void }) {
  const [f, setF] = useState<StatusRec>(
    () => row ?? { id: "", status: "", schools: "Unmapped", higherEd: "Unmapped", leads: 0, firstSeen: todayLabel(), active: true, custom: true },
  );
  const nameLocked = !!row && (!row.custom || leads > 0);
  const errors: string[] = [];
  if (!f.status.trim()) errors.push("Enter the status exactly as it appears in LeadSquared.");
  else if (all.some((s) => s.id !== row?.id && sameText(s.status, f.status))) errors.push("This status is already in the list.");
  const stageField = (k: "schools" | "higherEd", label: string) => (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <Dropdown<FunnelStage> ariaLabel={label} value={f[k]} onChange={(v) => setF((x) => ({ ...x, [k]: v }))} tone={f[k] === "Unmapped" ? "danger" : "default"} options={STAGE_OPTIONS.map((s) => ({ value: s, label: s }))} />
    </div>
  );
  return (
    <MasterEditor
      title={row ? `Edit “${row.status}”` : "Add LeadSquared status"}
      subtitle="A new or changed mapping takes effect once the Vertical Admissions Head approves it"
      errors={errors}
      saveLabel={row ? "Save changes" : "Add status"}
      onClose={onClose}
      onSave={() => onSave(row ? { ...f, status: f.status.trim() } : { ...f, status: f.status.trim(), id: f.status.trim() }, row)}
    >
      <Field label="LeadSquared status" hint={nameLocked ? "Leads already use this name, so it can't be renamed here — rename it in LeadSquared" : "Must match LeadSquared exactly"}>
        <input className={inputCls} value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))} disabled={nameLocked} placeholder="Scholarship Test Booked" autoFocus={!nameLocked} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {stageField("schools", "Schools funnel stage")}
        {stageField("higherEd", "Higher Ed funnel stage")}
      </div>
      {f.schools === "Unmapped" && f.higherEd === "Unmapped" ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Leads with this status stay in the Unmapped bucket until it's mapped.</p>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Saving sends this mapping to the Vertical Admissions Head for approval.</p>
      )}
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */

const HEALTH_TONE = {
  green: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  rose: "bg-rose-100 text-rose-600",
  "rose-soft": "bg-rose-50 text-rose-500",
  blue: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
};

/** Summary card for one master; doubles as a shortcut to its tab. */
function HealthCard({
  active, onClick, icon: Icon, tone, label, value, sub,
}: { active: boolean; onClick: () => void; icon: typeof Building2; tone: keyof typeof HEALTH_TONE; label: string; value: ReactNode; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-start gap-3 rounded-xl border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition",
        active ? "border-brand-500 ring-2 ring-brand-500/15" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", HEALTH_TONE[tone])}><Icon size={17} /></span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-brand-900">{label}</span>
        <span className="block text-xl font-bold leading-tight tracking-tight text-slate-900 tabular">{value}</span>
        <span className={clsx("block truncate text-xs", tone === "rose" ? "text-rose-600" : tone === "orange" ? "text-orange-700" : "text-slate-500")}>{sub}</span>
      </span>
    </button>
  );
}
