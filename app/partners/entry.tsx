"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { ConfirmDialog, Field, MasterEditor, inputCls } from "@/components/master-kit";
import { NumberField, num, type useEntryStore } from "@/components/entry-kit";
import { fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import { cycleData, newEntryId, PARTNER_TYPES, type PartnerRec, type PartnerType } from "@/lib/marketing";
import { locationById } from "@/lib/data";

type Entry = ReturnType<typeof useEntryStore>;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = Array.from({ length: 10 }, (_, i) => String(2026 - i));

export function PartnerEditor({ row, entry, onClose }: { row: PartnerRec | null; entry: Entry; onClose: () => void }) {
  const { filteredLocations, cycle } = useApp();
  const [sinceM, sinceY] = (row?.since ?? "Nov 2026").split(" ");
  const [f, setF] = useState({
    name: row?.name ?? "", type: (row?.type ?? "Preschool") as PartnerType, locationId: row?.locationId ?? filteredLocations[0]?.id ?? "",
    sinceM, sinceY, leadsShared: row ? String(row.leadsShared) : "", admissions: row ? String(row.admissions) : "", active: row?.active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const name = f.name.trim();
  const leads = num(f.leadsShared), adm = num(f.admissions);
  const all = cycleData(cycle, entry.store).partners;
  const dup = all.find((p) => p.id !== row?.id && p.locationId === f.locationId && p.name.toLowerCase() === name.toLowerCase());
  const errors = [
    !name && "Enter the partner's name.",
    name.length > 70 && "Keep the name under 70 characters.",
    !f.locationId && "Pick a school.",
    Number.isNaN(leads) && "Enter leads shared (0 if none yet).",
    Number.isNaN(adm) && "Enter admissions (0 if none yet).",
    adm > leads && "Admissions can't be more than leads shared.",
    dup && `${locationById(f.locationId).short} already has a partner called “${name}”.`,
  ].filter(Boolean) as string[];

  const save = () => {
    const rec: PartnerRec = {
      id: row?.id ?? newEntryId("p"), name, type: f.type, locationId: f.locationId, since: `${f.sinceM} ${f.sinceY}`,
      leadsShared: leads, admissions: adm, active: f.active, ...entry.stamp(),
    };
    if (row) {
      const changes = [
        row.name !== name && `name “${row.name}” → “${name}”`,
        row.type !== f.type && `type ${row.type} → ${f.type}`,
        row.locationId !== f.locationId && `school ${locationById(row.locationId).short} → ${locationById(f.locationId).short}`,
        row.since !== rec.since && `since ${row.since} → ${rec.since}`,
        row.leadsShared !== leads && `leads ${fmt(row.leadsShared)} → ${fmt(leads)}`,
        row.admissions !== adm && `admissions ${fmt(row.admissions)} → ${fmt(adm)}`,
        row.active !== f.active && (f.active ? "reactivated" : "deactivated"),
      ].filter(Boolean);
      entry.commit("Partner", "Updated", name, changes.join(", ") || "No change", (d) => ({ ...d, partners: d.partners.map((p) => (p.id === row.id ? rec : p)) }));
    } else {
      entry.commit("Partner", "Created", name, `${f.type} · ${locationById(f.locationId).short}`, (d) => ({ ...d, partners: [...d.partners, rec] }));
    }
    onClose();
  };

  return (
    <MasterEditor title={row ? "Edit partner" : "Add partner"} subtitle={`Referral partner and its results for session ${cycle.replace("-", "–")}`} errors={errors} saveLabel={row ? "Save changes" : "Add partner"} onSave={save} onClose={onClose}>
      <Field label="Partner name">
        <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className={inputCls} placeholder="Little Sprouts Preschool" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Dropdown<PartnerType> ariaLabel="Partner type" value={f.type} onChange={(v) => set("type", v)} options={PARTNER_TYPES.map((t) => ({ value: t, label: t }))} />
        </Field>
        <Field label="Partner since">
          <div className="grid grid-cols-2 gap-1.5">
            <Dropdown ariaLabel="Month" value={f.sinceM} onChange={(v) => set("sinceM", v)} options={MONTHS.map((m) => ({ value: m, label: m }))} />
            <Dropdown ariaLabel="Year" value={f.sinceY} onChange={(v) => set("sinceY", v)} options={YEARS.map((y) => ({ value: y, label: y }))} />
          </div>
        </Field>
      </div>
      <Field label="School">
        <Dropdown ariaLabel="School" value={f.locationId} onChange={(v) => set("locationId", v)} options={filteredLocations.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Leads shared" value={f.leadsShared} onChange={(v) => set("leadsShared", v)} hint="Referrals this session" />
        <NumberField label="Admissions" value={f.admissions} onChange={(v) => set("admissions", v)} hint={!Number.isNaN(leads) && !Number.isNaN(adm) && leads ? `${((adm / leads) * 100).toFixed(0)}% conversion` : "Fee paid in FABS"} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
        Active partnership
      </label>
    </MasterEditor>
  );
}

export function DeletePartner({ row, entry, onClose }: { row: PartnerRec; entry: Entry; onClose: () => void }) {
  return (
    <ConfirmDialog
      title="Delete partner?"
      confirmLabel="Delete"
      onClose={onClose}
      onConfirm={() => entry.commit("Partner", "Deleted", row.name, `${row.type} · ${locationById(row.locationId).short} → —`, (d) => ({ ...d, partners: d.partners.filter((p) => p.id !== row.id) }))}
    >
      <b>{row.name}</b> and its {fmt(row.leadsShared)} leads / {fmt(row.admissions)} admissions will be removed from this session&apos;s report.
      {row.active && " To keep its history, edit it and untick “Active partnership” instead."}
    </ConfirmDialog>
  );
}
