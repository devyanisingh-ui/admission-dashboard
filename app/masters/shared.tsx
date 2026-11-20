"use client";

import clsx from "clsx";
import { Check, Lock, Pencil } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { AuditAction, MasterKey, MasterStore } from "@/lib/masters";

/** Applies a change to the master store and writes one audit entry for it. */
export type Commit = (
  update: (s: MasterStore) => MasterStore,
  log: { master: MasterKey; action: AuditAction; record: string; detail: string },
) => void;

export interface TabProps {
  store: MasterStore;
  commit: Commit;
}

export const thBase = "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500";
export const thL = `${thBase} text-left`;
export const thR = `${thBase} text-right`;
export const tdc = "px-3 py-2";

export function EditBadge({ editable, approver, label = "Editable" }: { editable: boolean; approver?: boolean; label?: string }) {
  if (editable) return <Badge tone="blue"><Pencil size={11} /> {label}</Badge>;
  if (approver) return <Badge tone="violet"><Check size={11} /> Approver</Badge>;
  return <Badge><Lock size={11} /> View only</Badge>;
}

export function FilterChip({ active, onClick, label, count, tone }: { active: boolean; onClick: () => void; label: string; count: number; tone: "slate" | "red" | "amber" | "green" }) {
  const dot = { slate: "bg-slate-400", red: "bg-rose-500", amber: "bg-amber-500", green: "bg-emerald-500" }[tone];
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition",
        active ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      <span className={clsx("h-2 w-2 rounded-full", dot)} />
      {label}
      <span className={clsx("rounded-full px-1.5 text-xs font-semibold tabular", active ? "bg-white" : "bg-slate-100")}>{count}</span>
    </button>
  );
}

/** Search text + "show inactive" state shared by every master list. */
export function useListFilter<T extends { active: boolean }>(rows: T[], text: (r: T) => string) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const s = q.trim().toLowerCase();
  const inactiveCount = rows.filter((r) => !r.active).length;
  const visible = rows.filter((r) => (showInactive || r.active) && (!s || text(r).toLowerCase().includes(s)));
  return { q, setQ, showInactive, setShowInactive, inactiveCount, visible };
}

export const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Empty-table row. */
export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-sm text-slate-500">{children}</td>
    </tr>
  );
}
