"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { roleLabel, type RoleId } from "@/lib/roles";

export const ROLE_TONE: Record<RoleId, string> = {
  counsellor: "bg-sky-50 text-sky-700 ring-sky-200",
  locHead: "bg-brand-50 text-brand-700 ring-brand-200",
  principal: "bg-violet-50 text-violet-700 ring-violet-200",
  verticalHead: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  leadership: "bg-amber-50 text-amber-800 ring-amber-200",
  centralAdmin: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sysAdmin: "bg-slate-100 text-slate-700 ring-slate-300",
};

export function RoleBadge({ role }: { role: string }) {
  return <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", ROLE_TONE[role as RoleId] ?? ROLE_TONE.sysAdmin)}>{roleLabel(role)}</span>;
}

export function Panel({ title, sub, actions, children, className, bodyClass }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-brand-900">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {actions}
      </header>
      <div className={bodyClass ?? "p-4"}>{children}</div>
    </section>
  );
}

