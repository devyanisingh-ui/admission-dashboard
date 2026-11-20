"use client";

import clsx from "clsx";
import { CheckCircle2, Info, Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { nowLabel } from "@/lib/seat-matrix";
import { useApp } from "@/lib/context";
import { editCycle, isStartingData, newEntryId, type CycleData, type EntryArea, type EntryLog, type MarketingStore, type Stamp } from "@/lib/marketing";
import { Field, inputCls } from "./master-kit";
import { Badge, Button } from "./ui";

/**
 * Saves a change to the manually entered figures for the current cycle, logs it and shows a toast.
 * `stamp()` gives the "last updated" fields for a record being saved.
 */
export function useEntryStore() {
  const { cycle, userName, marketing, setMarketing } = useApp();
  const [toast, setToast] = useState<string | null>(null);
  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3500);
  };
  const log = (area: EntryArea, action: EntryLog["action"], record: string, change: string): EntryLog => ({
    id: newEntryId("log"), at: nowLabel(), who: userName, area, action, record, change,
  });
  /** Change this cycle's records. */
  const commit = (area: EntryArea, action: EntryLog["action"], record: string, change: string, f: (d: CycleData) => CycleData) => {
    setMarketing((s) => editCycle(s, cycle, f, log(area, action, record, change)));
    flash(`${area} “${record}” ${action.toLowerCase()}`);
  };
  /** Change something outside the cycle records (e.g. targets). */
  const commitStore = (area: EntryArea, action: EntryLog["action"], record: string, change: string, f: (s: MarketingStore) => MarketingStore) => {
    setMarketing((s) => {
      const next = f(s);
      return { ...next, log: [log(area, action, record, change), ...next.log].slice(0, 300) };
    });
    flash(`${area} “${record}” ${action.toLowerCase()}`);
  };
  const stamp = (): Stamp => ({ updatedAt: nowLabel(), updatedBy: userName, ts: Date.now() });
  return { commit, commitStore, stamp, toast, clearToast: () => setToast(null), starting: isStartingData(cycle, marketing), store: marketing };
}

export function EntryToast({ text, onClose }: { text: string | null; onClose: () => void }) {
  if (!text) return null;
  return (
    <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
      <span>{text}</span>
      <button onClick={onClose} aria-label="Dismiss" className="-mr-1 rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>
    </div>
  );
}

/** Banner at the top of a data-entry tab: who can edit, and whether the cycle still shows starting data. */
export function EntryBanner({ canEdit, starting, who, children }: { canEdit: boolean; starting: boolean; who: string; children?: ReactNode }) {
  return (
    <div className={clsx("mb-4 flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 text-sm", canEdit ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 bg-slate-50 text-slate-600")}>
      {canEdit ? <Info size={16} className="mt-0.5 shrink-0" /> : <Lock size={15} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <span className="font-medium">{canEdit ? "Figures on this page are entered by hand." : `View only — entered by the ${who}.`}</span>{" "}
        <span className="text-xs opacity-80">{children}</span>
        {starting && <span className="ml-1 text-xs opacity-80">This cycle still shows the starting data; your first change saves a copy you can edit.</span>}
      </div>
    </div>
  );
}

/** Small segmented control for switching record types. */
export function SegTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={clsx("whitespace-nowrap rounded-md px-3 py-1 font-medium transition", value === o.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
        >
          {o.label}
          {o.count !== undefined && <span className={clsx("ml-1.5 text-xs tabular", value === o.id ? "text-white/80" : "text-slate-400")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Search box, filters and the Add button above a data-entry table. */
export function EntryToolbar({
  q, setQ, placeholder, children, onAdd, addLabel, canEdit,
}: { q: string; setQ: (v: string) => void; placeholder: string; children?: ReactNode; onAdd: () => void; addLabel: string; canEdit: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-64">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" />
        {q && <button onClick={() => setQ("")} aria-label="Clear search" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
      </label>
      {children}
      {canEdit ? (
        <Button variant="primary" size="sm" className="ml-auto" onClick={onAdd}><Plus size={13} /> {addLabel}</Button>
      ) : (
        <Badge className="ml-auto"><Lock size={11} /> View only</Badge>
      )}
    </div>
  );
}

/** Edit and Delete buttons for one row. */
export function EntryActions({ canEdit, label, onEdit, onDelete }: { canEdit: boolean; label: string; onEdit: () => void; onDelete: () => void }) {
  if (!canEdit) return null;
  const btn = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition";
  return (
    <div className="flex justify-end gap-0.5">
      <button onClick={onEdit} className={clsx(btn, "text-slate-600 hover:bg-slate-100 hover:text-brand-700")} aria-label={`Edit ${label}`}><Pencil size={12} /> Edit</button>
      <button onClick={onDelete} className={clsx(btn, "text-rose-600 hover:bg-rose-50")} aria-label={`Delete ${label}`}><Trash2 size={12} /> Delete</button>
    </div>
  );
}

/** "Updated by" cell. */
export function StampCell({ s }: { s: Stamp }) {
  const initial = s.updatedBy === "Initial load";
  return (
    <div className="whitespace-nowrap text-[11px] leading-tight">
      <div className={initial ? "text-slate-400" : "text-slate-600"}>{initial ? "Starting data" : s.updatedBy}</div>
      {!initial && <div className="text-slate-400">{s.updatedAt}</div>}
    </div>
  );
}

/** Whole-number input that keeps the typed text (so it can be cleared while editing). */
export function NumberField({
  label, value, onChange, hint, prefix, className,
}: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; prefix?: string; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">{prefix}</span>}
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className={clsx(inputCls, "text-right tabular", prefix && "pl-7")}
        />
      </div>
    </Field>
  );
}

/** Exact rupees for data-entry screens, e.g. ₹1,25,000. */
export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Most recently edited first; starting data keeps its own order after that. */
export const recentFirst = (a: Stamp, b: Stamp) => (b.ts ?? 0) - (a.ts ?? 0);

/** Reads a NumberField value; NaN when empty. */
export const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

/** "Show all" footer for long tables. */
export function Pager({ shown, total, showAll, setShowAll }: { shown: number; total: number; showAll: boolean; setShowAll: (f: (v: boolean) => boolean) => void }) {
  if (total <= shown && !showAll) return null;
  return (
    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
      <span>Showing {fmtCount(shown)} of {fmtCount(total)}</span>
      <button onClick={() => setShowAll((v) => !v)} className="rounded-md px-2.5 py-1 font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
        {showAll ? "Show fewer" : `Show all ${fmtCount(total)}`}
      </button>
    </div>
  );
}
const fmtCount = (n: number) => n.toLocaleString("en-IN");
