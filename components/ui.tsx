"use client";

import clsx from "clsx";
import { Info, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/context";
import { roleLabel, type Permission } from "@/lib/roles";
import { Dropdown, type DropdownOption } from "./dropdown";

export const fmt = (n: number) => n.toLocaleString("en-IN");
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
/** Indian rupees, compact: ₹1.2 Cr, ₹24.5 L, ₹6,420. */
export const fmtINR = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title, subtitle, actions, children, className, bodyClass,
}: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={clsx("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-brand-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={clsx("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kpi({
  label, value, sub, delta, source, tone = "default", hint,
}: {
  label: string; value: ReactNode; sub?: ReactNode; delta?: number; source?: string; tone?: "default" | "warn" | "bad" | "good"; hint?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        tone === "warn" ? "border-amber-200" : tone === "bad" ? "border-rose-200" : tone === "good" ? "border-emerald-200" : "border-slate-200",
      )}
      title={hint}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {source && <SourceTag system={source} />}
      </div>
      <div className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        {delta !== undefined && <Delta value={delta} />}
        {sub}
      </div>
    </div>
  );
}

export function Delta({ value, suffix = "vs LY" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-medium", up ? "text-emerald-600" : "text-rose-600")}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {value.toFixed(1)}% <span className="font-normal text-slate-400">{suffix}</span>
    </span>
  );
}

const SYS_COLORS: Record<string, string> = {
  LeadSquared: "bg-violet-50 text-violet-700 ring-violet-200",
  SaaS: "bg-sky-50 text-sky-700 ring-sky-200",
  FABS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Dashboard: "bg-slate-100 text-slate-600 ring-slate-200",
  Computed: "bg-slate-100 text-slate-600 ring-slate-200",
};
export function SourceTag({ system }: { system: string }) {
  return (
    <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", SYS_COLORS[system] ?? SYS_COLORS.Computed)}>
      {system}
    </span>
  );
}

type BadgeTone = "slate" | "green" | "amber" | "red" | "blue" | "violet";
const BADGE: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700",
  blue: "bg-brand-50 text-brand-700",
  violet: "bg-violet-50 text-violet-700",
};
export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", BADGE[tone], className)}>{children}</span>;
}

export function Rag({ value, green, amber }: { value: number; green: number; amber: number }) {
  const tone = value >= green ? "bg-emerald-500" : value >= amber ? "bg-amber-400" : "bg-rose-500";
  return <span className={clsx("inline-block h-2.5 w-2.5 rounded-full", tone)} />;
}

export function Button({
  children, onClick, variant = "secondary", size = "md", disabled, title, type = "button", className,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md";
  disabled?: boolean; title?: string; type?: "button" | "submit"; className?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 scroll-thin">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
            value === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto scroll-thin", className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={clsx("whitespace-nowrap px-3 py-2", className)}>{children}</td>
);

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "phase2" }) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
        tone === "info" && "bg-brand-50 text-brand-800",
        tone === "warn" && "bg-amber-50 text-amber-800",
        tone === "phase2" && "bg-slate-100 text-slate-600",
      )}
    >
      <Info size={14} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Labelled dropdown — styled popover menu (see components/dropdown.tsx). */
export function Select<T extends string>(props: {
  value: T; onChange: (v: T) => void; options: DropdownOption<T>[]; label?: string; disabled?: boolean; className?: string;
}) {
  return <Dropdown {...props} />;
}

/** Wraps a page; shows a friendly message when the current role lacks access. */
export function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can, role } = useApp();
  if (can(perm)) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
      <Lock className="mx-auto text-slate-400" />
      <h2 className="mt-3 font-semibold text-slate-800">Not available for this role</h2>
      <p className="mt-1 text-sm text-slate-500">
        The permission matrix (§10.2) does not give <b>{roleLabel(role)}</b> access to this page. Switch role in the top bar to preview other users.
      </p>
    </div>
  );
}

/** PII field: masked for Group Leadership until revealed on demand. */
export function Pii({ value }: { value: string }) {
  const { can } = useApp();
  const [shown, setShown] = useState(false);
  if (can("pii") || shown) return <>{value}</>;
  if (can("pii.onDemand"))
    return (
      <button className="text-brand-600 hover:underline" onClick={() => setShown(true)} title="Reveal (access is audit-logged)">
        ••••••{value.slice(-2)} <span className="text-[10px]">reveal</span>
      </button>
    );
  return <span className="text-slate-400">hidden</span>;
}

export function ProgressBar({ value, max = 100, tone }: { value: number; max?: number; tone?: string }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={clsx("h-full rounded-full", tone ?? "bg-brand-500")} style={{ width: `${p}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}
