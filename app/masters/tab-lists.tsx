"use client";

import clsx from "clsx";
import { Download, History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { ActiveBadge, ConfirmDialog, Field, inputCls, MasterEditor, MasterToolbar, NewBadge, RowActions } from "@/components/master-kit";
import { Badge, Button, Card } from "@/components/ui";
import { useApp } from "@/lib/context";
import { SOURCE_GROUPS, type SourceGroup } from "@/lib/data";
import { downloadCsv } from "@/lib/export";
import { describeChanges, newId, REASON_SCOPES, type ActivityRec, type AuditAction, type MasterKey, type ReasonRec, type SourceRec } from "@/lib/masters";
import { EditBadge, EmptyRow, sameText, tdc, thL, thR, useListFilter, type TabProps } from "./shared";
import { BulkUpload } from "@/components/bulk-upload";
import { activitySpec, reasonSpec, sourceSpec } from "./upload-specs";

type Confirm = { kind: "delete" | "deactivate"; id: string } | null;

const GROUP_TONE: Record<SourceGroup, string> = {
  RWA: "bg-emerald-50 text-emerald-700", "Preschool / Crèche": "bg-violet-50 text-violet-700", Digital: "bg-sky-50 text-sky-700",
  "Education Fairs": "bg-amber-50 text-amber-800", Corporate: "bg-slate-100 text-slate-700", Others: "bg-rose-50 text-rose-700",
};

/* ------------------------------------------------------------------ */
/* Lead sources                                                        */
/* ------------------------------------------------------------------ */

export function SourcesTab({ store, commit }: TabProps) {
  const { can } = useApp();
  const canEdit = can("locationMaster.edit");
  const f = useListFilter(store.sources, (s) => `${s.name} ${s.group}`);
  const [editing, setEditing] = useState<SourceRec | "new" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const target = confirm ? store.sources.find((s) => s.id === confirm.id) : undefined;

  const save = (next: SourceRec, before: SourceRec | null) => {
    commit((s) => ({ ...s, sources: before ? s.sources.map((x) => (x.id === before.id ? next : x)) : [...s.sources, next] }), {
      master: "Lead source", action: before ? "Updated" : "Created", record: next.name,
      detail: before ? describeChanges(before, next, { name: "Name", group: "Reporting group" }) : `Reporting group ${next.group}`,
    });
    setEditing(null);
  };
  const setActive = (r: SourceRec, active: boolean) =>
    commit((s) => ({ ...s, sources: s.sources.map((x) => (x.id === r.id ? { ...x, active } : x)) }), {
      master: "Lead source", action: active ? "Reactivated" : "Deactivated", record: r.name, detail: active ? "Available for new leads again" : "No longer offered for new leads; existing leads keep it",
    });
  const remove = (r: SourceRec) => commit((s) => ({ ...s, sources: s.sources.filter((x) => x.id !== r.id) }), { master: "Lead source", action: "Deleted", record: r.name, detail: "Had no leads" });

  return (
    <>
      <MasterToolbar
        q={f.q} setQ={f.setQ} placeholder="Search lead source or group"
        showInactive={f.showInactive} setShowInactive={f.setShowInactive} inactiveCount={f.inactiveCount}
        canEdit={canEdit} onAdd={() => setEditing("new")} addLabel="Add lead source" onUpload={() => setUploading(true)}
      />
      <Card title="Lead sources" subtitle="Each LeadSquared / SaaS lead source rolls up to one reporting group used by the Lead Source filter and source charts" bodyClass="p-0" actions={canEdit ? undefined : <EditBadge editable={false} />}>
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>Lead source</th>
                <th className={thL}>Reporting group</th>
                <th className={thL}>Status</th>
                <th className={thR}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.visible.map((s) => (
                <tr key={s.id} className={clsx("hover:bg-slate-50/70", !s.active && "bg-slate-50/60 text-slate-400")}>
                  <td className={clsx(tdc, "font-medium text-slate-900")}><span className="inline-flex items-center gap-1.5">{s.name}{s.custom && <NewBadge />}</span></td>
                  <td className={tdc}><span className={clsx("rounded-md px-2 py-0.5 text-xs font-medium", GROUP_TONE[s.group])}>{s.group}</span></td>
                  <td className={tdc}><ActiveBadge active={s.active} /></td>
                  <td className={tdc}>
                    <RowActions
                      canEdit={canEdit} active={s.active} inUse={!s.custom} label={s.name} inUseReason="Leads already use this source"
                      onEdit={() => setEditing(s)} onDelete={() => setConfirm({ kind: "delete", id: s.id })}
                      onToggleActive={() => (s.active ? setConfirm({ kind: "deactivate", id: s.id }) : setActive(s, true))}
                    />
                  </td>
                </tr>
              ))}
              {!f.visible.length && <EmptyRow cols={4}>No lead sources match.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <SourceEditor key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} all={store.sources} onClose={() => setEditing(null)} onSave={save} />}
      {uploading && <BulkUpload title="Upload lead sources" spec={sourceSpec(store, commit)} onClose={() => setUploading(false)} />}
      {confirm && target && (
        confirm.kind === "delete" ? (
          <ConfirmDialog title={`Delete ${target.name}?`} confirmLabel="Delete lead source" onConfirm={() => remove(target)} onClose={() => setConfirm(null)}>
            This permanently removes the lead source. No leads use it yet.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog tone="warn" title={`Deactivate ${target.name}?`} confirmLabel="Deactivate" onConfirm={() => setActive(target, false)} onClose={() => setConfirm(null)}>
            It won&apos;t be offered for new leads. Existing leads keep this source and still count in reports.
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function SourceEditor({ row, all, onClose, onSave }: { row: SourceRec | null; all: SourceRec[]; onClose: () => void; onSave: (r: SourceRec, before: SourceRec | null) => void }) {
  const [f, setF] = useState<SourceRec>(() => row ?? { id: "", name: "", group: "Digital", active: true, custom: true });
  const errors: string[] = [];
  if (!f.name.trim()) errors.push("Enter the lead source name.");
  else if (all.some((s) => s.id !== row?.id && sameText(s.name, f.name))) errors.push("A lead source with this name already exists.");
  return (
    <MasterEditor
      title={row ? `Edit ${row.name}` : "Add lead source"} errors={errors} saveLabel={row ? "Save changes" : "Add lead source"} onClose={onClose}
      onSave={() => onSave(row ? { ...f, name: f.name.trim() } : { ...f, name: f.name.trim(), id: newId("src", f.name) }, row)}
    >
      <Field label="Lead source" hint="As it appears in LeadSquared / SaaS"><input className={inputCls} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Instagram Ads" autoFocus /></Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Reporting group</span>
        <Dropdown<SourceGroup> ariaLabel="Reporting group" value={f.group} onChange={(v) => setF((x) => ({ ...x, group: v }))} options={SOURCE_GROUPS.map((g) => ({ value: g, label: g }))} />
        <span className="mt-1 block text-[11px] text-slate-400">Used by the Lead Source filter and the source charts</span>
      </div>
      {row && row.group !== f.group && !row.custom && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Existing leads from {row.name} will move from {row.group} to {f.group} in every report.</p>
      )}
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */
/* Withdrawal reasons                                                  */
/* ------------------------------------------------------------------ */

export function ReasonsTab({ store, commit }: TabProps) {
  const { can } = useApp();
  const canEdit = can("locationMaster.edit");
  const f = useListFilter(store.reasons, (r) => `${r.name} ${r.appliesTo}`);
  const [editing, setEditing] = useState<ReasonRec | "new" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const target = confirm ? store.reasons.find((s) => s.id === confirm.id) : undefined;

  const save = (next: ReasonRec, before: ReasonRec | null) => {
    commit((s) => ({ ...s, reasons: before ? s.reasons.map((x) => (x.id === before.id ? next : x)) : [...s.reasons, next] }), {
      master: "Withdrawal reason", action: before ? "Updated" : "Created", record: next.name,
      detail: before ? describeChanges(before, next, { name: "Name", appliesTo: "Applies to" }) : `Applies to ${next.appliesTo.toLowerCase()}`,
    });
    setEditing(null);
  };
  const setActive = (r: ReasonRec, active: boolean) =>
    commit((s) => ({ ...s, reasons: s.reasons.map((x) => (x.id === r.id ? { ...x, active } : x)) }), {
      master: "Withdrawal reason", action: active ? "Reactivated" : "Deactivated", record: r.name, detail: active ? "Offered again" : "No longer offered; past withdrawals keep it",
    });
  const remove = (r: ReasonRec) => commit((s) => ({ ...s, reasons: s.reasons.filter((x) => x.id !== r.id) }), { master: "Withdrawal reason", action: "Deleted", record: r.name, detail: "Had no withdrawals" });

  return (
    <>
      <MasterToolbar
        q={f.q} setQ={f.setQ} placeholder="Search withdrawal reason"
        showInactive={f.showInactive} setShowInactive={f.setShowInactive} inactiveCount={f.inactiveCount}
        canEdit={canEdit} onAdd={() => setEditing("new")} addLabel="Add reason" onUpload={() => setUploading(true)}
      />
      <Card title="Withdrawal reasons" subtitle="Reasons recorded against FABS withdrawals · used by the Withdrawals page and reports" bodyClass="p-0" actions={canEdit ? undefined : <EditBadge editable={false} />}>
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>Reason</th>
                <th className={thL}>Applies to</th>
                <th className={thL}>Status</th>
                <th className={thR}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.visible.map((r) => (
                <tr key={r.id} className={clsx("hover:bg-slate-50/70", !r.active && "bg-slate-50/60 text-slate-400")}>
                  <td className={clsx(tdc, "font-medium text-slate-900")}><span className="inline-flex items-center gap-1.5">{r.name}{r.custom && <NewBadge />}</span></td>
                  <td className={clsx(tdc, "text-slate-600")}>{r.appliesTo === "Both" ? "New admissions and existing students" : `${r.appliesTo}s only`}</td>
                  <td className={tdc}><ActiveBadge active={r.active} /></td>
                  <td className={tdc}>
                    <RowActions
                      canEdit={canEdit} active={r.active} inUse={!r.custom} label={r.name} inUseReason="Past withdrawals use this reason"
                      onEdit={() => setEditing(r)} onDelete={() => setConfirm({ kind: "delete", id: r.id })}
                      onToggleActive={() => (r.active ? setConfirm({ kind: "deactivate", id: r.id }) : setActive(r, true))}
                    />
                  </td>
                </tr>
              ))}
              {!f.visible.length && <EmptyRow cols={4}>No reasons match.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <ReasonEditor key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} all={store.reasons} onClose={() => setEditing(null)} onSave={save} />}
      {uploading && <BulkUpload title="Upload withdrawal reasons" spec={reasonSpec(store, commit)} onClose={() => setUploading(false)} />}
      {confirm && target && (
        confirm.kind === "delete" ? (
          <ConfirmDialog title={`Delete ${target.name}?`} confirmLabel="Delete reason" onConfirm={() => remove(target)} onClose={() => setConfirm(null)}>
            This permanently removes the reason. No withdrawals use it yet.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog tone="warn" title={`Deactivate ${target.name}?`} confirmLabel="Deactivate" onConfirm={() => setActive(target, false)} onClose={() => setConfirm(null)}>
            It won&apos;t be offered for new withdrawals. Past withdrawals keep this reason and still count in reports.
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function ReasonEditor({ row, all, onClose, onSave }: { row: ReasonRec | null; all: ReasonRec[]; onClose: () => void; onSave: (r: ReasonRec, before: ReasonRec | null) => void }) {
  const [f, setF] = useState<ReasonRec>(() => row ?? { id: "", name: "", appliesTo: "Both", active: true, custom: true });
  const errors: string[] = [];
  if (!f.name.trim()) errors.push("Enter the reason.");
  else if (all.some((s) => s.id !== row?.id && sameText(s.name, f.name))) errors.push("This reason already exists.");
  return (
    <MasterEditor
      title={row ? `Edit ${row.name}` : "Add withdrawal reason"} errors={errors} saveLabel={row ? "Save changes" : "Add reason"} onClose={onClose}
      onSave={() => onSave(row ? { ...f, name: f.name.trim() } : { ...f, name: f.name.trim(), id: newId("rsn", f.name) }, row)}
    >
      <Field label="Reason"><input className={inputCls} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Parent job transfer" autoFocus /></Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Applies to</span>
        <Dropdown<ReasonRec["appliesTo"]>
          ariaLabel="Applies to" value={f.appliesTo} onChange={(v) => setF((x) => ({ ...x, appliesTo: v }))}
          options={REASON_SCOPES.map((s) => ({ value: s, label: s === "Both" ? "New admissions and existing students" : `${s}s only` }))}
        />
      </div>
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */
/* Outreach activities                                                 */
/* ------------------------------------------------------------------ */

export function ActivitiesTab({ store, commit }: TabProps) {
  const { can, marketing, setMarketing } = useApp();
  const canEdit = can("locationMaster.edit");
  const f = useListFilter(store.activities, (a) => `${a.name} ${a.group} ${a.unit}`);
  const [editing, setEditing] = useState<ActivityRec | "new" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const target = confirm ? store.activities.find((s) => s.id === confirm.id) : undefined;
  // Activities with budgets or spend entered against them can't be deleted.
  const used = new Set(Object.values(marketing.cycles).flatMap((d) => [...(d?.budgets ?? []), ...(d?.spend ?? [])].map((r) => r.activity)));
  const inUse = (a: ActivityRec) => !a.custom || used.has(a.name);

  const save = (next: ActivityRec, before: ActivityRec | null) => {
    commit((s) => ({ ...s, activities: before ? s.activities.map((x) => (x.id === before.id ? next : x)) : [...s.activities, next] }), {
      master: "Outreach activity", action: before ? "Updated" : "Created", record: next.name,
      detail: before ? describeChanges(before, next, { name: "Name", group: "Reporting group", unit: "Counted as" }) : `Reporting group ${next.group} · counted as ${next.unit}`,
    });
    // Entered budgets and spend follow a rename.
    if (before && before.name !== next.name) {
      const rename = <T extends { activity: string }>(r: T): T => (r.activity === before.name ? { ...r, activity: next.name } : r);
      setMarketing((m) => ({
        ...m,
        cycles: Object.fromEntries(Object.entries(m.cycles).map(([c, d]) => [c, d && { ...d, budgets: d.budgets.map(rename), spend: d.spend.map(rename) }])),
      }));
    }
    setEditing(null);
  };
  const setActive = (r: ActivityRec, active: boolean) =>
    commit((s) => ({ ...s, activities: s.activities.map((x) => (x.id === r.id ? { ...x, active } : x)) }), {
      master: "Outreach activity", action: active ? "Reactivated" : "Deactivated", record: r.name,
      detail: active ? "Offered again for budgets and spend" : "No longer offered for new budgets and spend; entered figures still count",
    });
  const remove = (r: ActivityRec) =>
    commit((s) => ({ ...s, activities: s.activities.filter((x) => x.id !== r.id) }), { master: "Outreach activity", action: "Deleted", record: r.name, detail: "Had no budgets or spend" });

  return (
    <>
      <MasterToolbar
        q={f.q} setQ={f.setQ} placeholder="Search activity, group or unit"
        showInactive={f.showInactive} setShowInactive={f.setShowInactive} inactiveCount={f.inactiveCount}
        canEdit={canEdit} onAdd={() => setEditing("new")} addLabel="Add activity" onUpload={() => setUploading(true)}
      />
      <Card title="Outreach activities" subtitle="Activities that budgets and spend are entered against in Budget & Outreach · each feeds one lead-source reporting group" bodyClass="p-0" actions={canEdit ? undefined : <EditBadge editable={false} />}>
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>Activity</th>
                <th className={thL}>Reporting group</th>
                <th className={thL}>Counted as</th>
                <th className={thL}>Status</th>
                <th className={thR}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.visible.map((a) => (
                <tr key={a.id} className={clsx("hover:bg-slate-50/70", !a.active && "bg-slate-50/60 text-slate-400")}>
                  <td className={clsx(tdc, "font-medium text-slate-900")}><span className="inline-flex items-center gap-1.5">{a.name}{a.custom && <NewBadge />}</span></td>
                  <td className={tdc}><span className={clsx("rounded-md px-2 py-0.5 text-xs font-medium", GROUP_TONE[a.group])}>{a.group}</span></td>
                  <td className={clsx(tdc, "text-slate-600")}>{a.unit}</td>
                  <td className={tdc}><ActiveBadge active={a.active} /></td>
                  <td className={tdc}>
                    <RowActions
                      canEdit={canEdit} active={a.active} inUse={inUse(a)} label={a.name} inUseReason="Budgets or spend are entered against this activity"
                      onEdit={() => setEditing(a)} onDelete={() => setConfirm({ kind: "delete", id: a.id })}
                      onToggleActive={() => (a.active ? setConfirm({ kind: "deactivate", id: a.id }) : setActive(a, true))}
                    />
                  </td>
                </tr>
              ))}
              {!f.visible.length && <EmptyRow cols={5}>No activities match.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <ActivityEditor key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} all={store.activities} onClose={() => setEditing(null)} onSave={save} />}
      {uploading && <BulkUpload title="Upload outreach activities" spec={activitySpec(store, commit)} onClose={() => setUploading(false)} />}
      {confirm && target && (
        confirm.kind === "delete" ? (
          <ConfirmDialog title={`Delete ${target.name}?`} confirmLabel="Delete activity" onConfirm={() => remove(target)} onClose={() => setConfirm(null)}>
            This permanently removes the activity. No budgets or spend use it yet.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog tone="warn" title={`Deactivate ${target.name}?`} confirmLabel="Deactivate" onConfirm={() => setActive(target, false)} onClose={() => setConfirm(null)}>
            It won&apos;t be offered for new budgets or spend entries. Figures already entered keep this activity and still count in Budget &amp; Outreach.
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function ActivityEditor({ row, all, onClose, onSave }: { row: ActivityRec | null; all: ActivityRec[]; onClose: () => void; onSave: (r: ActivityRec, before: ActivityRec | null) => void }) {
  const [f, setF] = useState<ActivityRec>(() => row ?? { id: "", name: "", group: "Others", unit: "", active: true, custom: true });
  const errors: string[] = [];
  if (!f.name.trim()) errors.push("Enter the activity name.");
  else if (all.some((s) => s.id !== row?.id && sameText(s.name, f.name))) errors.push("An activity with this name already exists.");
  if (!f.unit.trim()) errors.push("Enter what is counted for this activity, e.g. events.");
  const clean = { ...f, name: f.name.trim(), unit: f.unit.trim().toLowerCase() };
  return (
    <MasterEditor
      title={row ? `Edit ${row.name}` : "Add outreach activity"} errors={errors} saveLabel={row ? "Save changes" : "Add activity"} onClose={onClose}
      onSave={() => onSave(row ? clean : { ...clean, id: newId("act", f.name) }, row)}
    >
      <Field label="Activity"><input className={inputCls} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="School van branding" autoFocus /></Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Reporting group</span>
        <Dropdown<SourceGroup> ariaLabel="Reporting group" value={f.group} onChange={(v) => setF((x) => ({ ...x, group: v }))} options={SOURCE_GROUPS.map((g) => ({ value: g, label: g }))} />
        <span className="mt-1 block text-[11px] text-slate-400">The lead-source group whose leads this activity drives</span>
      </div>
      <Field label="Counted as" hint="What the activity count in the spend log means (plural)"><input className={inputCls} value={f.unit} onChange={(e) => setF((x) => ({ ...x, unit: e.target.value }))} placeholder="events" /></Field>
      {row && row.name !== f.name.trim() && f.name.trim() && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">Budgets and spend already entered for {row.name} move to the new name.</p>
      )}
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */
/* Change log                                                          */
/* ------------------------------------------------------------------ */

const ACTION_TONE: Record<AuditAction, "green" | "blue" | "red" | "amber" | "violet" | "slate"> = {
  Created: "green", Updated: "blue", Deleted: "red", Deactivated: "amber", Reactivated: "violet", Approved: "green",
};
const MASTERS: MasterKey[] = ["Status mapping", "Location", "Grade / programme", "Lead source", "Withdrawal reason", "Outreach activity", "Cycle"];

export function AuditTab({ store, onReset, canReset }: { store: TabProps["store"]; onReset: () => void; canReset: boolean }) {
  const [master, setMaster] = useState<MasterKey | "All">("All");
  const [q, setQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const s = q.trim().toLowerCase();
  const rows = store.audit.filter((a) => (master === "All" || a.master === master) && (!s || `${a.record} ${a.detail} ${a.who}`.toLowerCase().includes(s)));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search record, change or person" className={clsx(inputCls, "sm:w-72")} />
        <Dropdown<MasterKey | "All"> size="sm" ariaLabel="Master" value={master} onChange={setMaster} options={[{ value: "All", label: "All masters" }, ...MASTERS.map((m) => ({ value: m, label: m }))]} />
        <div className="ml-auto flex gap-2">
          <Button size="sm" disabled={!store.audit.length} onClick={() => downloadCsv("masters-change-log", store.audit.map((a) => ({ When: a.at, Who: a.who, Master: a.master, Action: a.action, Record: a.record, Change: a.detail })))}>
            <Download size={13} /> Export
          </Button>
          {canReset && <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)}><RotateCcw size={13} /> Reset to source data</Button>}
        </div>
      </div>
      <Card title="Change log" subtitle="Every create, update, delete and (de)activation of master data — who, when, old → new" bodyClass="p-0">
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>When</th>
                <th className={thL}>Who</th>
                <th className={thL}>Master</th>
                <th className={thL}>Action</th>
                <th className={thL}>Record</th>
                <th className={thL}>Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id} className="align-top hover:bg-slate-50/70">
                  <td className={clsx(tdc, "whitespace-nowrap text-xs text-slate-500")}>{a.at}</td>
                  <td className={clsx(tdc, "whitespace-nowrap text-slate-700")}>{a.who}</td>
                  <td className={clsx(tdc, "whitespace-nowrap text-slate-600")}>{a.master}</td>
                  <td className={tdc}><Badge tone={ACTION_TONE[a.action]}>{a.action}</Badge></td>
                  <td className={clsx(tdc, "font-medium text-slate-900")}>{a.record}</td>
                  <td className={clsx(tdc, "text-xs text-slate-600")}>{a.detail}</td>
                </tr>
              ))}
              {!rows.length && (
                <EmptyRow cols={6}>
                  <History className="mx-auto mb-1 text-slate-300" size={20} />
                  {store.audit.length ? "No changes match." : "No master data has been changed yet."}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {confirmReset && (
        <ConfirmDialog title="Reset all master data?" confirmLabel="Reset" onConfirm={onReset} onClose={() => setConfirmReset(false)}>
          Every location, grade, status mapping, lead source, reason, outreach activity and cycle goes back to the source-system data, and this change log is cleared. This can&apos;t be undone.
        </ConfirmDialog>
      )}
    </>
  );
}
