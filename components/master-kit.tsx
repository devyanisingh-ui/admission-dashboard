"use client";

import clsx from "clsx";
import { AlertTriangle, Archive, ArchiveRestore, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "./drawer";
import { Badge, Button } from "./ui";

/** Search, "show inactive" switch and the Add button above a master table. */
export function MasterToolbar({
  q, setQ, placeholder, showInactive, setShowInactive, inactiveCount, onAdd, addLabel, canEdit, children,
}: {
  q: string; setQ: (v: string) => void; placeholder: string;
  showInactive: boolean; setShowInactive: (v: boolean) => void; inactiveCount: number;
  onAdd?: () => void; addLabel?: string; canEdit: boolean; children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-72">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" />
        {q && <button onClick={() => setQ("")} aria-label="Clear search" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
      </label>
      {children}
      <label className={clsx("flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm", inactiveCount ? "text-slate-600" : "text-slate-400")}>
        <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} disabled={!inactiveCount} />
        Show inactive <span className="rounded-full bg-slate-100 px-1.5 text-xs tabular">{inactiveCount}</span>
      </label>
      {canEdit && onAdd && (
        <Button variant="primary" size="sm" className="ml-auto" onClick={onAdd}>
          <Plus size={13} /> {addLabel ?? "Add"}
        </Button>
      )}
    </div>
  );
}

export const ActiveBadge = ({ active }: { active: boolean }) => (active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>);
export const NewBadge = () => <span className="rounded bg-violet-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-violet-700">New</span>;

/**
 * Edit / Delete-or-Deactivate buttons for one row.
 * In-use records (with source-system history) can't be deleted — only deactivated and reactivated.
 */
export function RowActions({
  canEdit, active, inUse, onEdit, onDelete, onToggleActive, label, inUseReason,
}: {
  canEdit: boolean; active: boolean; inUse: boolean; onEdit: () => void; onDelete: () => void; onToggleActive?: () => void; label: string; inUseReason?: string;
}) {
  if (!canEdit) return null;
  const btn = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex justify-end gap-0.5">
      <button onClick={onEdit} className={clsx(btn, "text-slate-600 hover:bg-slate-100 hover:text-brand-700")} aria-label={`Edit ${label}`}>
        <Pencil size={12} /> Edit
      </button>
      {inUse ? (
        onToggleActive && (
          <button
            onClick={onToggleActive}
            className={clsx(btn, active ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50")}
            aria-label={`${active ? "Deactivate" : "Reactivate"} ${label}`}
            title={active ? `${inUseReason ?? "In use"} — it can be deactivated but not deleted` : "Make it available again"}
          >
            {active ? <Archive size={12} /> : <ArchiveRestore size={12} />} {active ? "Deactivate" : "Reactivate"}
          </button>
        )
      ) : (
        <button onClick={onDelete} className={clsx(btn, "text-rose-600 hover:bg-rose-50")} aria-label={`Delete ${label}`}>
          <Trash2 size={12} /> Delete
        </button>
      )}
    </div>
  );
}

/** Centred confirmation modal for destructive actions. */
export function ConfirmDialog({
  title, children, confirmLabel, tone = "danger", onConfirm, onClose,
}: { title: string; children: ReactNode; confirmLabel: string; tone?: "danger" | "warn"; onConfirm: () => void; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", tone === "danger" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600")}>
            {tone === "danger" ? <Trash2 size={16} /> : <AlertTriangle size={16} />}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h2>
            <div className="mt-1 text-sm text-slate-600">{children}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={clsx("rounded-lg px-3 py-1.5 text-sm font-medium text-white", tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Side-panel form used to create or edit any master record. */
export function MasterEditor({
  title, subtitle, errors, saveLabel, onSave, onClose, children,
}: { title: string; subtitle?: string; errors: string[]; saveLabel: string; onSave: () => void; onClose: () => void; children: ReactNode }) {
  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle ?? "Every change is audit-logged (who, when, old → new)"}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={errors.length > 0} onClick={onSave} title={errors[0]}>{saveLabel}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!errors.length) onSave(); }}>
        {children}
        {errors.length > 0 && (
          <div className="space-y-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
            {errors.map((e) => <p key={e} className="flex items-start gap-1.5"><AlertTriangle size={12} className="mt-px shrink-0" /> {e}</p>)}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/** Type a value and press Enter (or comma) to add it as a chip. */
export function ChipsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
  };
  return (
    <div className="flex min-h-[38px] flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="text-slate-400 hover:text-rose-600"><X size={11} /></button>
        </span>
      ))}
      <input
        placeholder={value.length ? "" : placeholder}
        className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none"
        onKeyDown={(e) => {
          const t = e.currentTarget;
          if ((e.key === "Enter" || e.key === ",") && t.value.trim()) { e.preventDefault(); add(t.value); t.value = ""; }
          else if (e.key === "Backspace" && !t.value && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={(e) => { if (e.target.value.trim()) { add(e.target.value); e.target.value = ""; } }}
      />
    </div>
  );
}
