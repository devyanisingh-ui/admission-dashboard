"use client";

import { useMemo, useState } from "react";
import { SOURCE_COLORS } from "@/components/dashboard-widgets";
import { Dropdown } from "@/components/dropdown";
import { ConfirmDialog, Field, MasterEditor, inputCls } from "@/components/master-kit";
import {
  EntryActions, EntryBanner, EntryToast, EntryToolbar, NumberField, Pager, SegTabs, StampCell, inr, num, recentFirst, useEntryStore,
} from "@/components/entry-kit";
import { Card, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import { CYCLE_MONTHS, locationById, pct } from "@/lib/data";
import { cycleData, newEntryId, OUTREACH_ACTIVITIES, type BudgetRec, type SpendRec } from "@/lib/marketing";

const PAGE = 25;
const groupOf = (activity: string) => OUTREACH_ACTIVITIES.find((a) => a.type === activity)?.group ?? "Others";
const unitOf = (activity: string) => OUTREACH_ACTIVITIES.find((a) => a.type === activity)?.unit ?? "activities";
const th = "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500";

export function BudgetEntry() {
  const { filteredLocations, cycle, can, seatVersion } = useApp();
  const canEdit = can("marketing.edit");
  const entry = useEntryStore();
  const [view, setView] = useState<"alloc" | "spend">("spend");
  const ids = filteredLocations.map((l) => l.id);
  const data = useMemo(() => cycleData(cycle, entry.store), [cycle, seatVersion, entry.store]); // eslint-disable-line react-hooks/exhaustive-deps
  const idSet = new Set(ids);
  const budgets = data.budgets.filter((b) => idSet.has(b.locationId));
  const spend = data.spend.filter((s) => idSet.has(s.locationId));

  return (
    <>
      <EntryBanner canEdit={canEdit} starting={entry.starting} who="Location Admissions Head or Central Admin team">
        Enter each activity&apos;s annual budget, then log spend month by month. Leads and admissions per activity still come from LeadSquared and FABS.
      </EntryBanner>
      <div className="mb-3">
        <SegTabs
          value={view}
          onChange={setView}
          options={[
            { id: "spend", label: "Spend log", count: spend.length },
            { id: "alloc", label: "Budget allocations", count: budgets.length },
          ]}
        />
      </div>
      {view === "alloc" ? <Allocations rows={budgets} spend={spend} canEdit={canEdit} entry={entry} /> : <SpendLog rows={spend} canEdit={canEdit} entry={entry} />}
      <EntryToast text={entry.toast} onClose={entry.clearToast} />
    </>
  );
}

type Entry = ReturnType<typeof useEntryStore>;

function LocationFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { filteredLocations } = useApp();
  if (filteredLocations.length < 2) return null;
  return (
    <Dropdown size="sm" ariaLabel="School" value={value} onChange={onChange}
      options={[{ value: "all", label: "All schools" }, ...filteredLocations.map((l) => ({ value: l.id, label: l.short }))]} />
  );
}
function ActivityFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Dropdown size="sm" ariaLabel="Activity" value={value} onChange={onChange}
      options={[{ value: "all", label: "All activities" }, ...OUTREACH_ACTIVITIES.map((a) => ({ value: a.type, label: a.type }))]} />
  );
}
function ActivityName({ activity }: { activity: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[groupOf(activity)] }} />
      {activity}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Allocations                                                         */
/* ------------------------------------------------------------------ */

function Allocations({ rows, spend, canEdit, entry }: { rows: BudgetRec[]; spend: SpendRec[]; canEdit: boolean; entry: Entry }) {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("all");
  const [act, setAct] = useState("all");
  const [editing, setEditing] = useState<BudgetRec | "new" | null>(null);
  const [deleting, setDeleting] = useState<BudgetRec | null>(null);
  const spentOf = (b: BudgetRec) => spend.filter((s) => s.locationId === b.locationId && s.activity === b.activity).reduce((a, s) => a + s.amount, 0);

  const s = q.trim().toLowerCase();
  const list = rows
    .filter((r) => (loc === "all" || r.locationId === loc) && (act === "all" || r.activity === act) && (!s || `${locationById(r.locationId).short} ${r.activity}`.toLowerCase().includes(s)))
    .sort((a, b) => recentFirst(a, b) || locationById(a.locationId).short.localeCompare(locationById(b.locationId).short) || OUTREACH_ACTIVITIES.findIndex((x) => x.type === a.activity) - OUTREACH_ACTIVITIES.findIndex((x) => x.type === b.activity));
  const total = list.reduce((a, r) => a + r.allocated, 0);
  const totalSpent = list.reduce((a, r) => a + spentOf(r), 0);

  return (
    <Card bodyClass="p-4">
      <EntryToolbar q={q} setQ={setQ} placeholder="Search school or activity" onAdd={() => setEditing("new")} addLabel="Add allocation" canEdit={canEdit}>
        <LocationFilter value={loc} onChange={setLoc} />
        <ActivityFilter value={act} onChange={setAct} />
      </EntryToolbar>
      <div className="relative overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] text-sm tabular">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>Activity</th>
              <th className={`${th} text-right`}>Annual budget</th>
              <th className={`${th} text-right`}>Spent so far</th>
              <th className={`${th} text-right`}>Utilised</th>
              <th className={`${th} text-left`}>Last updated</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => {
              const spent = spentOf(r);
              const u = pct(spent, r.allocated);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{locationById(r.locationId).short}</td>
                  <td className="px-3 py-2"><ActivityName activity={r.activity} /></td>
                  <td className="px-3 py-2 text-right font-semibold">{inr(r.allocated)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{inr(spent)}</td>
                  <td className={`px-3 py-2 text-right ${u > 100 ? "font-semibold text-rose-600" : u > 90 ? "text-amber-700" : "text-slate-600"}`}>{r.allocated ? `${u.toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-2"><StampCell s={r} /></td>
                  <td className="px-3 py-2">
                    <EntryActions canEdit={canEdit} label={`${r.activity} budget`} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">No budget allocations match.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>Total · {list.length} allocation{list.length === 1 ? "" : "s"}</td>
                <td className="px-3 py-2 text-right">{inr(total)}</td>
                <td className="px-3 py-2 text-right">{inr(totalSpent)}</td>
                <td className="px-3 py-2 text-right">{total ? `${pct(totalSpent, total).toFixed(0)}%` : "—"}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editing && <AllocationEditor row={editing === "new" ? null : editing} rows={rows} entry={entry} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete budget allocation?"
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            entry.commit("Budget", "Deleted", `${locationById(deleting.locationId).short} · ${deleting.activity}`, `${inr(deleting.allocated)} → —`, (d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== deleting.id) }))
          }
        >
          The {inr(deleting.allocated)} budget for <b>{deleting.activity}</b> at {locationById(deleting.locationId).short} will be removed. Spend entries for it are kept.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function AllocationEditor({ row, rows, entry, onClose }: { row: BudgetRec | null; rows: BudgetRec[]; entry: Entry; onClose: () => void }) {
  const { filteredLocations } = useApp();
  const [f, setF] = useState({ locationId: row?.locationId ?? filteredLocations[0]?.id ?? "", activity: row?.activity ?? OUTREACH_ACTIVITIES[0].type, allocated: row ? String(row.allocated) : "" });
  const amount = num(f.allocated);
  const dup = rows.find((r) => r.id !== row?.id && r.locationId === f.locationId && r.activity === f.activity);
  const errors = [
    !f.locationId && "Pick a school.",
    Number.isNaN(amount) && "Enter the annual budget.",
    dup && `${locationById(f.locationId).short} already has a ${f.activity} budget — edit that one instead.`,
  ].filter(Boolean) as string[];
  const name = `${locationById(f.locationId)?.short ?? ""} · ${f.activity}`;

  const save = () => {
    const rec: BudgetRec = { id: row?.id ?? newEntryId("b"), locationId: f.locationId, activity: f.activity, allocated: amount, ...entry.stamp() };
    if (row) {
      entry.commit("Budget", "Updated", name, `${inr(row.allocated)} → ${inr(amount)}`, (d) => ({ ...d, budgets: d.budgets.map((b) => (b.id === row.id ? rec : b)) }));
    } else {
      entry.commit("Budget", "Created", name, `— → ${inr(amount)}`, (d) => ({ ...d, budgets: [...d.budgets, rec] }));
    }
    onClose();
  };

  return (
    <MasterEditor title={row ? "Edit budget allocation" : "Add budget allocation"} subtitle="Annual outreach budget for one activity at one school" errors={errors} saveLabel={row ? "Save changes" : "Add allocation"} onSave={save} onClose={onClose}>
      <Field label="School">
        <Dropdown ariaLabel="School" value={f.locationId} onChange={(v) => setF((x) => ({ ...x, locationId: v }))} disabled={!!row} options={filteredLocations.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
      <Field label="Activity">
        <Dropdown ariaLabel="Activity" value={f.activity} onChange={(v) => setF((x) => ({ ...x, activity: v }))} disabled={!!row} options={OUTREACH_ACTIVITIES.map((a) => ({ value: a.type, label: a.type }))} />
      </Field>
      <NumberField label="Annual budget (₹)" prefix="₹" value={f.allocated} onChange={(v) => setF((x) => ({ ...x, allocated: v }))} hint={Number.isNaN(amount) ? "Whole rupees" : inr(amount)} />
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */
/* Spend log                                                           */
/* ------------------------------------------------------------------ */

function SpendLog({ rows, canEdit, entry }: { rows: SpendRec[]; canEdit: boolean; entry: Entry }) {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("all");
  const [act, setAct] = useState("all");
  const [month, setMonth] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<SpendRec | "new" | null>(null);
  const [deleting, setDeleting] = useState<SpendRec | null>(null);

  const s = q.trim().toLowerCase();
  const list = rows
    .filter(
      (r) =>
        (loc === "all" || r.locationId === loc) && (act === "all" || r.activity === act) && (month === "all" || r.month === month) &&
        (!s || `${locationById(r.locationId).short} ${r.activity} ${r.note}`.toLowerCase().includes(s)),
    )
    // Latest edits first, then latest month, school and activity.
    .sort((a, b) => recentFirst(a, b) || CYCLE_MONTHS.indexOf(b.month) - CYCLE_MONTHS.indexOf(a.month) || locationById(a.locationId).short.localeCompare(locationById(b.locationId).short) || a.activity.localeCompare(b.activity));
  const shown = showAll ? list : list.slice(0, PAGE);
  const tot = list.reduce((a, r) => ({ amount: a.amount + r.amount, count: a.count + r.count }), { amount: 0, count: 0 });

  return (
    <Card bodyClass="p-4">
      <EntryToolbar q={q} setQ={(v) => { setQ(v); setShowAll(false); }} placeholder="Search school, activity or note" onAdd={() => setEditing("new")} addLabel="Add spend" canEdit={canEdit}>
        <LocationFilter value={loc} onChange={(v) => { setLoc(v); setShowAll(false); }} />
        <ActivityFilter value={act} onChange={(v) => { setAct(v); setShowAll(false); }} />
        <Dropdown size="sm" ariaLabel="Month" value={month} onChange={(v) => { setMonth(v); setShowAll(false); }} options={[{ value: "all", label: "All months" }, ...CYCLE_MONTHS.map((m) => ({ value: m, label: m }))]} />
      </EntryToolbar>
      <div className="relative overflow-x-auto scroll-thin">
        <table className="w-full min-w-[820px] text-sm tabular">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={`${th} text-left`}>Month</th>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>Activity</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={`${th} text-right`}>Activities run</th>
              <th className={`${th} text-left`}>Note</th>
              <th className={`${th} text-left`}>Last updated</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">{r.month}</td>
                <td className="px-3 py-2 text-slate-800">{locationById(r.locationId).short}</td>
                <td className="px-3 py-2"><ActivityName activity={r.activity} /></td>
                <td className="px-3 py-2 text-right font-semibold">{inr(r.amount)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.count)} <span className="text-[11px] text-slate-400">{unitOf(r.activity)}</span></td>
                <td className="max-w-[220px] truncate px-3 py-2 text-slate-500" title={r.note}>{r.note || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2"><StampCell s={r} /></td>
                <td className="px-3 py-2">
                  <EntryActions canEdit={canEdit} label={`${r.activity} spend for ${r.month}`} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">No spend entries match.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Total · {fmt(list.length)} entr{list.length === 1 ? "y" : "ies"}</td>
                <td className="px-3 py-2 text-right">{inr(tot.amount)}</td>
                <td className="px-3 py-2 text-right">{fmt(tot.count)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Pager shown={shown.length} total={list.length} showAll={showAll} setShowAll={setShowAll} />

      {editing && <SpendEditor row={editing === "new" ? null : editing} entry={entry} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete spend entry?"
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            entry.commit("Spend", "Deleted", `${locationById(deleting.locationId).short} · ${deleting.activity} · ${deleting.month}`, `${inr(deleting.amount)} → —`, (d) => ({ ...d, spend: d.spend.filter((x) => x.id !== deleting.id) }))
          }
        >
          {inr(deleting.amount)} spent on <b>{deleting.activity}</b> at {locationById(deleting.locationId).short} in {deleting.month} will be removed from the totals.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function SpendEditor({ row, entry, onClose }: { row: SpendRec | null; entry: Entry; onClose: () => void }) {
  const { filteredLocations } = useApp();
  const [f, setF] = useState({
    locationId: row?.locationId ?? filteredLocations[0]?.id ?? "", activity: row?.activity ?? OUTREACH_ACTIVITIES[0].type, month: row?.month ?? "Nov",
    amount: row ? String(row.amount) : "", count: row ? String(row.count) : "", note: row?.note ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const amount = num(f.amount);
  const count = num(f.count);
  const errors = [
    !f.locationId && "Pick a school.",
    Number.isNaN(amount) && "Enter the amount spent.",
    Number.isNaN(count) && `Enter the number of ${unitOf(f.activity)} run (0 if none).`,
    f.note.length > 120 && "Keep the note under 120 characters.",
  ].filter(Boolean) as string[];
  const name = `${locationById(f.locationId)?.short ?? ""} · ${f.activity} · ${f.month}`;

  const save = () => {
    const rec: SpendRec = { id: row?.id ?? newEntryId("s"), locationId: f.locationId, activity: f.activity, month: f.month, amount, count, note: f.note.trim(), ...entry.stamp() };
    if (row) {
      entry.commit("Spend", "Updated", name, `${inr(row.amount)} → ${inr(amount)}`, (d) => ({ ...d, spend: d.spend.map((x) => (x.id === row.id ? rec : x)) }));
    } else {
      entry.commit("Spend", "Created", name, `— → ${inr(amount)}`, (d) => ({ ...d, spend: [...d.spend, rec] }));
    }
    onClose();
  };

  return (
    <MasterEditor title={row ? "Edit spend entry" : "Add spend entry"} subtitle="Money spent and activities run in one month" errors={errors} saveLabel={row ? "Save changes" : "Add entry"} onSave={save} onClose={onClose}>
      <Field label="School">
        <Dropdown ariaLabel="School" value={f.locationId} onChange={(v) => set("locationId", v)} options={filteredLocations.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Activity">
          <Dropdown ariaLabel="Activity" value={f.activity} onChange={(v) => set("activity", v)} options={OUTREACH_ACTIVITIES.map((a) => ({ value: a.type, label: a.type }))} />
        </Field>
        <Field label="Month">
          <Dropdown ariaLabel="Month" value={f.month} onChange={(v) => set("month", v)} options={CYCLE_MONTHS.map((m) => ({ value: m, label: m }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Amount spent (₹)" prefix="₹" value={f.amount} onChange={(v) => set("amount", v)} hint={Number.isNaN(amount) ? "Whole rupees" : inr(amount)} />
        <NumberField label={`Activities run (${unitOf(f.activity)})`} value={f.count} onChange={(v) => set("count", v)} />
      </div>
      <Field label="Note (optional)" hint="e.g. vendor, invoice number or event name">
        <input value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={140} className={inputCls} placeholder="Sector 21 RWA Diwali stall" />
      </Field>
    </MasterEditor>
  );
}
