"use client";

import clsx from "clsx";
import { useState } from "react";
import { useCurrentLocation } from "@/components/location-picker";
import { ActiveBadge, ChipsInput, ConfirmDialog, Field, inputCls, MasterEditor, MasterToolbar, NewBadge, RowActions } from "@/components/master-kit";
import { Dropdown } from "@/components/dropdown";
import { Card, Note, SourceTag } from "@/components/ui";
import { useApp } from "@/lib/context";
import type { Board, Vertical } from "@/lib/data";
import { BOARDS, describeChanges, newId, SYS_LABEL, SYSTEMS, type LocationRec, type Sys, type UnitRec } from "@/lib/masters";
import { EditBadge, EmptyRow, plural, sameText, tdc, thL, thR, useListFilter, type TabProps } from "./shared";

type Confirm = { kind: "delete" | "deactivate"; id: string } | null;

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

export function LocationsTab({ store, commit }: TabProps) {
  const { can } = useApp();
  const canEdit = can("locationMaster.edit");
  const [vertical, setVertical] = useState<Vertical | "All">("All");
  const rows = store.locations.filter((l) => vertical === "All" || l.vertical === vertical);
  const f = useListFilter(rows, (l) => `${l.name} ${l.short} ${l.city} ${Object.values(l.codes).join(" ")}`);
  const [editing, setEditing] = useState<LocationRec | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const unitsOf = (id: string) => store.units.filter((u) => u.locId === id);
  const target = confirm ? store.locations.find((l) => l.id === confirm.id) : undefined;

  const save = (next: LocationRec, before: LocationRec | null) => {
    if (before) {
      commit((s) => ({ ...s, locations: s.locations.map((l) => (l.id === before.id ? next : l)) }), {
        master: "Location", action: "Updated", record: next.name,
        detail: describeChanges(before, next, { name: "Name", short: "Short name", board: "Board", city: "City", vertical: "Vertical", codes: "Codes (SaaS / LSQ / FABS)" }),
      });
    } else {
      commit((s) => ({ ...s, locations: [...s.locations, next] }), {
        master: "Location", action: "Created", record: next.name, detail: `${next.vertical} · ${next.board} · ${next.city} · codes ${Object.values(next.codes).join(" / ")}`,
      });
    }
    setEditing(null);
  };
  const setActive = (l: LocationRec, active: boolean) =>
    commit((s) => ({ ...s, locations: s.locations.map((x) => (x.id === l.id ? { ...x, active } : x)) }), {
      master: "Location", action: active ? "Reactivated" : "Deactivated", record: l.name, detail: active ? "Available in pickers again" : "Hidden from pickers; history kept",
    });
  const remove = (l: LocationRec) => {
    const n = unitsOf(l.id).length;
    commit((s) => ({ ...s, locations: s.locations.filter((x) => x.id !== l.id), units: s.units.filter((u) => u.locId !== l.id) }), {
      master: "Location", action: "Deleted", record: l.name, detail: n ? `Also removed ${plural(n, "grade / programme")}` : "No grades / programmes",
    });
  };

  return (
    <>
      <MasterToolbar
        q={f.q} setQ={f.setQ} placeholder="Search name, city or code"
        showInactive={f.showInactive} setShowInactive={f.setShowInactive} inactiveCount={f.inactiveCount}
        canEdit={canEdit} onAdd={() => setEditing("new")} addLabel="Add location"
      >
        <Dropdown<Vertical | "All">
          size="sm" ariaLabel="Vertical" value={vertical} onChange={setVertical}
          options={[{ value: "All", label: "All verticals" }, { value: "Schools", label: "Schools" }, { value: "Higher Ed", label: "Higher Ed" }]}
        />
      </MasterToolbar>

      <Card
        title="School / Location Master"
        subtitle="Maps each system's own location code to one dashboard location · codes must be unique within each system"
        bodyClass="p-0"
        actions={canEdit ? undefined : <EditBadge editable={false} />}
      >
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>Location</th>
                <th className={thL}>Vertical · board</th>
                <th className={thL}>City</th>
                {SYSTEMS.map((s) => <th key={s} className={thL}><SourceTag system={SYS_LABEL[s]} /> <span className="ml-1">code</span></th>)}
                <th className={thR}>Units</th>
                <th className={thL}>Status</th>
                <th className={thR}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.visible.map((l) => (
                <tr key={l.id} className={clsx("hover:bg-slate-50/70", !l.active && "bg-slate-50/60 text-slate-400")}>
                  <td className={tdc}>
                    <div className="flex items-center gap-1.5 font-medium text-slate-900">{l.name}{l.custom && <NewBadge />}</div>
                    <div className="font-mono text-[10px] text-slate-400">{l.short} · {l.id.toUpperCase()}</div>
                  </td>
                  <td className={clsx(tdc, "text-slate-600")}>{l.vertical} · {l.board}</td>
                  <td className={clsx(tdc, "text-slate-600")}>{l.city}</td>
                  {SYSTEMS.map((s) => <td key={s} className={clsx(tdc, "font-mono text-xs")}>{l.codes[s]}</td>)}
                  <td className={clsx(tdc, "text-right tabular")}>{unitsOf(l.id).filter((u) => u.active).length}</td>
                  <td className={tdc}><ActiveBadge active={l.active} /></td>
                  <td className={tdc}>
                    <RowActions
                      canEdit={canEdit} active={l.active} inUse={!l.custom} label={l.name} inUseReason="Has leads and admissions in the source systems"
                      onEdit={() => setEditing(l)}
                      onDelete={() => setConfirm({ kind: "delete", id: l.id })}
                      onToggleActive={() => (l.active ? setConfirm({ kind: "deactivate", id: l.id }) : setActive(l, true))}
                    />
                  </td>
                </tr>
              ))}
              {!f.visible.length && <EmptyRow cols={9}>No locations match.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-3"><Note>New locations start with no data. Leads and admissions appear once the codes match records in SaaS, LeadSquared and FABS on the next sync.</Note></div>

      {editing && <LocationEditor key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} all={store.locations} onClose={() => setEditing(null)} onSave={save} />}
      {confirm && target && (
        confirm.kind === "delete" ? (
          <ConfirmDialog title={`Delete ${target.name}?`} confirmLabel="Delete location" onConfirm={() => remove(target)} onClose={() => setConfirm(null)}>
            This permanently removes the location{unitsOf(target.id).length ? <> and its <b>{plural(unitsOf(target.id).length, "grade / programme")}</b></> : null}. It has no history yet, so nothing else is affected.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog tone="warn" title={`Deactivate ${target.name}?`} confirmLabel="Deactivate" onConfirm={() => setActive(target, false)} onClose={() => setConfirm(null)}>
            It will be hidden from filters and pickers. Its leads, admissions and history are kept, and you can reactivate it at any time.
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function LocationEditor({ row, all, onClose, onSave }: { row: LocationRec | null; all: LocationRec[]; onClose: () => void; onSave: (r: LocationRec, before: LocationRec | null) => void }) {
  const [f, setF] = useState<LocationRec>(
    () => row ?? { id: "", name: "", short: "", vertical: "Schools", board: "CBSE", city: "", codes: { saas: "", crm: "", fabs: "" }, active: true, custom: true },
  );
  const set = <K extends keyof LocationRec>(k: K, v: LocationRec[K]) => setF((x) => ({ ...x, [k]: v }));
  const others = all.filter((l) => l.id !== row?.id);
  const errors: string[] = [];
  if (!f.name.trim()) errors.push("Enter the location's full name.");
  if (!f.short.trim()) errors.push("Enter a short name (shown in charts and filters).");
  if (!f.city.trim()) errors.push("Enter the city.");
  if (f.name.trim() && others.some((l) => sameText(l.name, f.name))) errors.push("Another location already has this name.");
  if (f.short.trim() && others.some((l) => sameText(l.short, f.short))) errors.push("Another location already uses this short name.");
  for (const s of SYSTEMS) {
    if (!f.codes[s].trim()) errors.push(`Enter the ${SYS_LABEL[s]} code.`);
    else {
      const clash = others.find((l) => sameText(l.codes[s], f.codes[s]));
      if (clash) errors.push(`${SYS_LABEL[s]} code ${f.codes[s]} is already used by ${clash.short}.`);
    }
  }
  const locked = !!row && !row.custom; // vertical of a location with history can't change

  return (
    <MasterEditor
      title={row ? `Edit ${row.name}` : "Add location"}
      errors={errors}
      saveLabel={row ? "Save changes" : "Add location"}
      onClose={onClose}
      onSave={() => {
        const clean = { ...f, name: f.name.trim(), short: f.short.trim(), city: f.city.trim(), codes: { saas: f.codes.saas.trim(), crm: f.codes.crm.trim(), fabs: f.codes.fabs.trim() } };
        onSave(row ? clean : { ...clean, id: newId("loc", clean.short) }, row);
      }}
    >
      <Field label="Full name"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Apeejay School, Dwarka" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Short name" hint="Shown in charts and filters"><input className={inputCls} value={f.short} onChange={(e) => set("short", e.target.value)} placeholder="Dwarka" /></Field>
        <Field label="City"><input className={inputCls} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="New Delhi" /></Field>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">Vertical</span>
          <Dropdown<Vertical>
            ariaLabel="Vertical" value={f.vertical} disabled={locked}
            onChange={(v) => setF((x) => ({ ...x, vertical: v, board: BOARDS[v][0] }))}
            options={[{ value: "Schools", label: "Schools" }, { value: "Higher Ed", label: "Higher Ed" }]}
          />
          {locked && <span className="mt-1 block text-[11px] text-slate-400">Fixed once the location has data</span>}
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">{f.vertical === "Schools" ? "Board" : "Approval body"}</span>
          <Dropdown<Board> ariaLabel="Board" value={f.board} onChange={(v) => set("board", v)} options={BOARDS[f.vertical].map((b) => ({ value: b, label: b }))} />
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Source-system codes</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SYSTEMS.map((s) => (
            <Field key={s} label={SYS_LABEL[s]}>
              <input className={clsx(inputCls, "font-mono")} value={f.codes[s]} onChange={(e) => set("codes", { ...f.codes, [s]: e.target.value })} placeholder={s === "saas" ? "SAAS-DWAR" : s === "crm" ? "SCH_112" : "F012"} />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Records from each system are matched to this location by these codes.</p>
      </div>
    </MasterEditor>
  );
}

/* ------------------------------------------------------------------ */
/* Grades & programmes                                                 */
/* ------------------------------------------------------------------ */

export function UnitsTab({ store, commit }: TabProps) {
  const { can } = useApp();
  const canEdit = can("locationMaster.edit");
  const current = useCurrentLocation();
  const [locId, setLocId] = useState(() => (store.locations.some((l) => l.id === current.id) ? current.id : store.locations[0]?.id ?? ""));
  const loc = store.locations.find((l) => l.id === locId) ?? store.locations[0];
  const rows = store.units.filter((u) => u.locId === loc?.id);
  const f = useListFilter(rows, (u) => `${u.name} ${Object.values(u.codes).join(" ")} ${u.sections.join(" ")}`);
  const [editing, setEditing] = useState<UnitRec | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  if (!loc) return <Card title="Grades & programmes"><p className="text-sm text-slate-500">Add a location first.</p></Card>;

  const isSchool = loc.vertical === "Schools";
  const word = isSchool ? "grade" : "programme";
  const target = confirm ? rows.find((u) => u.id === confirm.id) : undefined;
  const label = (u: UnitRec) => `${loc.short} · ${u.name}`;

  const save = (next: UnitRec, before: UnitRec | null) => {
    if (before) {
      commit((s) => ({ ...s, units: s.units.map((u) => (u.id === before.id ? next : u)) }), {
        master: "Grade / programme", action: "Updated", record: label(next),
        detail: describeChanges(before, next, { name: "Name", codes: "Values (SaaS / LSQ / FABS)", sections: isSchool ? "Sections / streams" : "Batches" }),
      });
    } else {
      commit((s) => ({ ...s, units: [...s.units, next] }), {
        master: "Grade / programme", action: "Created", record: label(next), detail: `Values ${Object.values(next.codes).join(" / ")}${next.sections.length ? ` · ${next.sections.join(", ")}` : ""}`,
      });
    }
    setEditing(null);
  };
  const setActive = (u: UnitRec, active: boolean) =>
    commit((s) => ({ ...s, units: s.units.map((x) => (x.id === u.id ? { ...x, active } : x)) }), {
      master: "Grade / programme", action: active ? "Reactivated" : "Deactivated", record: label(u), detail: active ? "Available again" : "Hidden from pickers; history kept",
    });
  const remove = (u: UnitRec) =>
    commit((s) => ({ ...s, units: s.units.filter((x) => x.id !== u.id) }), { master: "Grade / programme", action: "Deleted", record: label(u), detail: "Had no history" });

  return (
    <>
      <MasterToolbar
        q={f.q} setQ={f.setQ} placeholder={`Search ${word} or system value`}
        showInactive={f.showInactive} setShowInactive={f.setShowInactive} inactiveCount={f.inactiveCount}
        canEdit={canEdit && loc.active} onAdd={() => setEditing("new")} addLabel={`Add ${isSchool ? "grade" : "programme"}`}
      >
        <Dropdown<string>
          size="sm" ariaLabel="Location" value={loc.id} onChange={setLocId} triggerWidth="w-56"
          options={store.locations.map((l) => ({ value: l.id, label: `${l.short}${l.active ? "" : " (inactive)"}`, hint: l.vertical === "Schools" ? l.board : "HE" }))}
        />
      </MasterToolbar>

      <Card
        title={`${loc.name} — academic units`}
        subtitle={isSchool ? "Academic unit = grade (+ sections / streams) · each system's value maps to one unit" : "Academic unit = programme + year · each system's value maps to one unit"}
        bodyClass="p-0"
        actions={canEdit ? undefined : <EditBadge editable={false} />}
      >
        {!loc.active && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">This location is inactive — reactivate it to add {word}s.</div>}
        <div className="relative overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className={thL}>{isSchool ? "Grade" : "Programme"}</th>
                {SYSTEMS.map((s) => <th key={s} className={thL}><SourceTag system={SYS_LABEL[s]} /> <span className="ml-1">value</span></th>)}
                <th className={thL}>{isSchool ? "Sections / streams" : "Batches"}</th>
                <th className={thL}>Status</th>
                <th className={thR}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.visible.map((u) => (
                <tr key={u.id} className={clsx("hover:bg-slate-50/70", !u.active && "bg-slate-50/60 text-slate-400")}>
                  <td className={clsx(tdc, "font-medium text-slate-900")}><span className="inline-flex items-center gap-1.5">{u.name}{u.custom && <NewBadge />}</span></td>
                  {SYSTEMS.map((s) => <td key={s} className={clsx(tdc, "font-mono text-xs text-slate-700")}>{u.codes[s]}</td>)}
                  <td className={tdc}>
                    {u.sections.length ? (
                      <div className="flex flex-wrap gap-1">{u.sections.map((x) => <span key={x} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{x}</span>)}</div>
                    ) : (
                      <span className="text-xs text-slate-400">Single batch</span>
                    )}
                  </td>
                  <td className={tdc}><ActiveBadge active={u.active} /></td>
                  <td className={tdc}>
                    <RowActions
                      canEdit={canEdit} active={u.active} inUse={!u.custom} label={label(u)} inUseReason="Has students and admissions"
                      onEdit={() => setEditing(u)}
                      onDelete={() => setConfirm({ kind: "delete", id: u.id })}
                      onToggleActive={() => (u.active ? setConfirm({ kind: "deactivate", id: u.id }) : setActive(u, true))}
                    />
                  </td>
                </tr>
              ))}
              {!f.visible.length && <EmptyRow cols={7}>No {word}s match.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <UnitEditor
          key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} siblings={rows}
          locId={loc.id} isSchool={isSchool} onClose={() => setEditing(null)} onSave={save}
        />
      )}
      {confirm && target && (
        confirm.kind === "delete" ? (
          <ConfirmDialog title={`Delete ${target.name}?`} confirmLabel={`Delete ${word}`} onConfirm={() => remove(target)} onClose={() => setConfirm(null)}>
            This permanently removes {target.name} from {loc.short}. It has no students or admissions yet.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog tone="warn" title={`Deactivate ${target.name}?`} confirmLabel="Deactivate" onConfirm={() => setActive(target, false)} onClose={() => setConfirm(null)}>
            {target.name} at {loc.short} will be hidden from pickers and the Seat Matrix for new cycles. Existing students and history are kept.
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function UnitEditor({
  row, siblings, locId, isSchool, onClose, onSave,
}: { row: UnitRec | null; siblings: UnitRec[]; locId: string; isSchool: boolean; onClose: () => void; onSave: (r: UnitRec, before: UnitRec | null) => void }) {
  const [f, setF] = useState<UnitRec>(() => row ?? { id: "", locId, name: "", codes: { saas: "", crm: "", fabs: "" }, sections: [], active: true, custom: true });
  const others = siblings.filter((u) => u.id !== row?.id);
  const word = isSchool ? "grade" : "programme";
  const errors: string[] = [];
  if (!f.name.trim()) errors.push(`Enter the ${word} name.`);
  else if (others.some((u) => sameText(u.name, f.name))) errors.push(`This location already has a ${word} called ${f.name.trim()}.`);
  for (const s of SYSTEMS as Sys[]) {
    if (!f.codes[s].trim()) errors.push(`Enter the ${SYS_LABEL[s]} value.`);
    else {
      const clash = others.find((u) => sameText(u.codes[s], f.codes[s]));
      if (clash) errors.push(`${SYS_LABEL[s]} value ${f.codes[s]} already maps to ${clash.name}.`);
    }
  }
  // Suggest system values from the name the first time it's typed.
  const suggest = (name: string) =>
    isSchool ? { saas: ["Nursery", "KG"].includes(name) ? name : `Class ${name}`, crm: `GR-${name}`, fabs: name } : { saas: name, crm: `${name.toUpperCase().replace(/[^A-Z]/g, "")}_Y1`, fabs: `${name} (Sem 1)` };

  return (
    <MasterEditor
      title={row ? `Edit ${row.name}` : `Add ${word}`}
      errors={errors}
      saveLabel={row ? "Save changes" : `Add ${word}`}
      onClose={onClose}
      onSave={() => {
        const clean = { ...f, name: f.name.trim(), codes: { saas: f.codes.saas.trim(), crm: f.codes.crm.trim(), fabs: f.codes.fabs.trim() } };
        onSave(row ? clean : { ...clean, id: `${locId}:${clean.name}:${Math.random().toString(36).slice(2, 6)}` }, row);
      }}
    >
      <Field label={isSchool ? "Grade" : "Programme and year"} hint={isSchool ? "e.g. Nursery, KG, I … XII" : "e.g. B.Com (Hons) – Y1"}>
        <input
          className={inputCls} value={f.name} autoFocus
          onChange={(e) => {
            const name = e.target.value;
            const untouched = !row && SYSTEMS.every((s) => !f.codes[s] || f.codes[s] === suggest(f.name.trim().replace(" – Y1", ""))[s]);
            setF((x) => ({ ...x, name, codes: untouched && name.trim() ? suggest(name.trim().replace(" – Y1", "")) : x.codes }));
          }}
        />
      </Field>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Value in each system</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SYSTEMS.map((s) => (
            <Field key={s} label={SYS_LABEL[s]}>
              <input className={clsx(inputCls, "font-mono")} value={f.codes[s]} onChange={(e) => setF((x) => ({ ...x, codes: { ...x.codes, [s]: e.target.value } }))} />
            </Field>
          ))}
        </div>
        {!row && <p className="mt-2 text-[11px] text-slate-500">Filled in from the name — change them if a system uses something different.</p>}
      </div>
      <Field label={isSchool ? "Sections / streams" : "Batches"} hint="Type and press Enter to add each one">
        <ChipsInput value={f.sections} onChange={(v) => setF((x) => ({ ...x, sections: v }))} placeholder={isSchool ? "A, B, C or Science, Commerce" : "Morning, Evening"} />
      </Field>
    </MasterEditor>
  );
}
