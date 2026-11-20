"use client";

import clsx from "clsx";
import {
  Bell, BarChart3, CalendarDays, Network, Database, Download, Handshake, LayoutDashboard, Menu,
  Settings2, Share2, SlidersHorizontal, Table2, UserMinus, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { clampSpan, cycleBounds, DATE_RANGES, fmtDate, rangeLabelOf, spanDays, useApp, type DateRange, type DateSpan } from "@/lib/context";
import {
  buildAlerts, CYCLES, schoolGrades, SOURCE_GROUPS, SYNC_STATUS, type Board, type Cycle, type SourceGroup, type Vertical,
} from "@/lib/data";
import { ROLES, type Permission, type RoleId } from "@/lib/roles";
import { Dropdown } from "./dropdown";

interface NavItem { href: string; label: string; icon: typeof Bell; perm: Permission; badge?: "alerts" }
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Dashboard",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, perm: "view.location" },
      { href: "/drilldown", label: "Drill-down", icon: Network, perm: "view.location" },
      { href: "/grades", label: "Grade-wise Reports", icon: BarChart3, perm: "view.location" },
      { href: "/budget", label: "Budget & Outreach", icon: Wallet, perm: "view.marketing" },
      { href: "/social", label: "Social Media Reports", icon: Share2, perm: "view.marketing" },
      { href: "/strength", label: "Withdrawals", icon: UserMinus, perm: "view.location" },
      { href: "/partners", label: "Partners Report", icon: Handshake, perm: "view.marketing" },
      { href: "/reports", label: "Download Centre", icon: Download, perm: "view.reports" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/systems", label: "System Views", icon: Database, perm: "view.systems" },
      { href: "/alerts", label: "Alerts", icon: Bell, perm: "view.location", badge: "alerts" },
    ],
  },
  {
    group: "Setup",
    items: [
      { href: "/planning", label: "Seat Matrix & Targets", icon: Table2, perm: "view.planning" },
      { href: "/masters", label: "Masters", icon: SlidersHorizontal, perm: "view.masters" },
      { href: "/admin", label: "Administration", icon: Settings2, perm: "view.admin" },
    ],
  },
];

const latestSync = SYNC_STATUS.reduce((a, b) => (b.minutesAgo < a.minutesAgo ? b : a));

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const ids = app.allowedLocations.map((l) => l.id);
    const alerts = buildAlerts(app.cycle).filter((a) => !a.locationId || ids.includes(a.locationId)).length;
    return { alerts };
  }, [app.allowedLocations, app.cycle]);

  const initials = app.userName.replace(/^(Dr\.|Prof\.)\s*/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const scopeName = app.lockedLocation ? app.allowedLocations[0].name : app.lockedVertical ? `${app.allowedLocations[0].vertical} — all campuses` : "Apeejay Education — all campuses";

  return (
    <div className="min-h-screen">
      {/* Top header */}
      <header className="no-print sticky top-0 z-40 bg-brand-900 text-white shadow-[0_2px_10px_rgba(11,37,81,0.25)]">
        <div className="flex h-16 items-center">
          <div className="flex h-full w-64 shrink-0 items-center gap-3 px-5 max-lg:w-auto">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <Logo />
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-wide">APEEJAY</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand-200">Education</div>
            </div>
          </div>
          <div className="hidden h-9 w-px bg-white/20 lg:block" />
          <div className="min-w-0 flex-1 px-6 max-md:hidden">
            <div className="truncate text-lg font-semibold">Admissions &amp; Marketing MIS Dashboard</div>
            <div className="truncate text-xs text-brand-200">
              Academic Session {app.cycle.replace("-", " – ")} · {scopeName}
            </div>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-4 pr-3 sm:pr-5">
            <div className="hidden items-center gap-2.5 xl:flex">
              <CalendarDays size={18} className="text-brand-200" />
              <div className="text-xs leading-tight">
                <div className="text-brand-200">Last updated</div>
                <div className="font-medium">{latestSync.lastSync}</div>
              </div>
            </div>
            <div className="hidden h-9 w-px bg-white/20 xl:block" />
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center max-sm:hidden rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/25">{initials}</span>
              <div className="leading-tight max-sm:hidden">
                <div className="text-[11px] text-brand-200">Welcome,</div>
                <div className="text-sm font-semibold">{app.userName}</div>
              </div>
              <Dropdown<RoleId>
                size="sm"
                ariaLabel="Viewing as"
                value={app.role}
                onChange={app.setRole}
                options={ROLES.map((r) => ({ value: r.id, label: r.label }))}
                triggerWidth="w-36 sm:w-44"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed bottom-0 left-0 top-16 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
          open ? "translate-x-0 shadow-xl" : "-translate-x-full",
        )}
      >
        <button className="absolute right-3 top-3 text-slate-500 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scroll-thin">
          {NAV.map((g) => {
            const items = g.items.filter((i) => app.can(i.perm) || (i.href === "/alerts" && app.role === "sysAdmin"));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                {g.group !== "Dashboard" && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</div>}
                <div className="space-y-0.5">
                  {items.map((i) => {
                    const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
                    const badge = i.badge ? counts[i.badge] : 0;
                    return (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                          active ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brand-600" />}
                        <i.icon size={18} className={clsx("shrink-0", active ? "text-brand-700" : "text-slate-500")} />
                        <span className="flex-1">{i.label}</span>
                        {badge > 0 && (
                          <span className={clsx("rounded-full px-1.5 text-[10px] font-semibold", i.badge === "alerts" ? "bg-rose-500 text-white" : "bg-amber-100 text-amber-800")}>
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500">
          <div className="mb-1.5 font-semibold uppercase tracking-wider text-slate-400">Data sources</div>
          {SYNC_STATUS.map((s) => (
            <div key={s.system} className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5">
                <span className={clsx("h-1.5 w-1.5 rounded-full", s.status === "ok" ? "bg-emerald-500" : "bg-amber-500")} />
                {s.system}
              </span>
              <span className={s.status === "ok" ? "" : "font-medium text-amber-700"}>{s.minutesAgo} min ago</span>
            </div>
          ))}
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-col lg:pl-64">
        <main className="flex-1 px-4 py-5 lg:px-6">
          {/* Administration is about users, sync and audit — school / session filters don't apply there. */}
          {app.role !== "sysAdmin" && !pathname.startsWith("/admin") && <GlobalFilters extended={pathname === "/"} drill={pathname.startsWith("/drilldown")} />}
          {children}
        </main>
        <footer className="no-print px-6 pb-5 text-[11px] text-slate-400">
          Demo data · read-only integration with LeadSquared, SaaS and FABS · wrong data is corrected in the source system and flows in on the next sync.
        </footer>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <path d="M4 26 C10 20 16 8 30 4 C24 10 20 18 18 30 C14 24 9 24 4 26 Z" fill="#f59e0b" />
      <path d="M4 26 C10 23 15 24 18 30 C12 27 8 27 4 26 Z" fill="#fff" opacity=".85" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * Global Filters panel shown at the top of every page; the Dashboard adds Grade / Programme, Lead source and Date range.
 * Vertical comes first and drives the rest: "Schools" shows the Schools dropdown, "Higher Ed" the Higher Ed dropdown,
 * and Board, Grade / Programme follow the same vertical.
 */
function GlobalFilters({ extended, drill }: { extended: boolean; drill?: boolean }) {
  const app = useApp();
  // Drill-down: the breadcrumb picks vertical / school / grade, so only the time and source filters remain.
  if (drill) return <DrillFilters />;
  const v = app.vertical;
  const inVertical = app.allowedLocations.filter((l) => v === "All" || l.vertical === v);
  const boards = Array.from(new Set(inVertical.map((l) => l.board)));
  const locations = inVertical.filter((l) => app.board === "All" || l.board === app.board);
  const selected = app.allowedLocations.find((l) => l.id === app.school);

  // Grades for schools; programmes for Higher Ed (the chosen campus's, or every campus's in view).
  const units =
    v === "All" && !selected
      ? []
      : selected
        ? selected.units
        : v === "Schools"
          ? schoolGrades()
          : Array.from(new Set(locations.flatMap((l) => l.units)));
  const unitLabel = (u: string) => u.replace(" – Y1", "");

  const isHE = v === "Higher Ed";
  const locLabel = v === "Schools" ? "School" : isHE ? "Higher Ed institution" : "School / Institution";
  const boardLabel = v === "Schools" ? "Board" : isHE ? "Approval body" : "Board / Approval body";
  const gradeLabel = isHE || selected?.vertical === "Higher Ed" ? "Programme" : "Grade";
  const full = "flex w-full";

  return (
    <section className="no-print mb-5 rounded-xl border border-slate-200 bg-white px-4 pb-3.5 pt-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-900">Global filters</h2>
      <div className={clsx("grid gap-3", extended ? "grid-cols-2 md:grid-cols-4 2xl:grid-cols-7" : "grid-cols-2 md:grid-cols-4")}>
        <Field label="Vertical">
          <Dropdown<Vertical | "All">
            className={full} triggerWidth="w-full" ariaLabel="Vertical" disabled={app.lockedVertical}
            value={v}
            onChange={(nv) => { app.setVertical(nv); app.setBoard("All"); app.setSchool("all"); app.setGrade("All"); }}
            options={(["All", "Schools", "Higher Ed"] as const).map((x) => ({
              value: x,
              label: x === "All" ? "All verticals" : x,
              hint: `${app.allowedLocations.filter((l) => x === "All" || l.vertical === x).length}`,
            }))}
          />
        </Field>

        {/* Depends on Vertical: the Schools list or the Higher Ed list. */}
        <Field label={locLabel}>
          {v === "All" && !selected && !app.lockedLocation ? (
            <Dropdown
              className={full} triggerWidth="w-full" ariaLabel={locLabel} disabled
              value="all" onChange={() => {}}
              options={[{ value: "all", label: "Select a vertical first" }]}
            />
          ) : (
            <Dropdown
              className={full} triggerWidth="w-full" ariaLabel={locLabel} disabled={app.lockedLocation}
              value={app.school}
              onChange={app.setSchool}
              options={[
                ...(app.lockedLocation ? [] : [{ value: "all", label: `All ${isHE ? "institutions" : "schools"} (${locations.length})` }]),
                ...(app.lockedLocation && selected ? [selected] : locations).map((l) => ({ value: l.id, label: l.name, hint: l.board })),
              ]}
            />
          )}
        </Field>

        <Field label={boardLabel}>
          <Dropdown<Board | "All">
            className={full} triggerWidth="w-full" ariaLabel={boardLabel} disabled={app.lockedLocation || boards.length < 2}
            value={app.board}
            onChange={(b) => { app.setBoard(b); app.setSchool("all"); }}
            options={[{ value: "All", label: v === "All" ? "All boards & bodies" : isHE ? "All approval bodies" : "All boards" }, ...boards.map((b) => ({ value: b, label: b }))]}
          />
        </Field>

        {extended && (
          <Field label={gradeLabel}>
            <Dropdown
              className={full} triggerWidth="w-full" ariaLabel={gradeLabel} disabled={!units.length}
              value={units.includes(app.grade) ? app.grade : "All"}
              onChange={app.setGrade}
              options={
                units.length
                  ? [{ value: "All", label: gradeLabel === "Programme" ? "All programmes" : "All grades" }, ...units.map((u) => ({ value: u, label: unitLabel(u) }))]
                  : [{ value: "All", label: "Select a vertical first" }]
              }
            />
          </Field>
        )}

        <Field label="Academic session">
          <Dropdown<Cycle>
            className={full} triggerWidth="w-full" ariaLabel="Academic session"
            value={app.cycle}
            onChange={app.setCycle}
            options={CYCLES.map((c) => ({ value: c, label: c.replace("-", " – "), hint: c === "2026-27" ? "current" : "backfill" }))}
          />
        </Field>

        {extended && (
          <>
            <Field label="Lead source">
              <Dropdown<SourceGroup | "All">
                className={full} triggerWidth="w-full" ariaLabel="Lead source"
                value={app.sourceGroup}
                onChange={app.setSourceGroup}
                options={[{ value: "All", label: "All sources" }, ...SOURCE_GROUPS.map((s) => ({ value: s, label: s }))]}
              />
            </Field>
            <DateRangeField />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Date range filter: presets, plus "Custom range…" which opens a start / end date picker.
 * Dates are limited to the selected academic session.
 */
function DateRangeField() {
  const app = useApp();
  const [draft, setDraft] = useState<DateSpan | null>(null);
  const bounds = cycleBounds(app.cycle);
  const open = () => setDraft(clampSpan(app.customRange, app.cycle));
  const valid = !!draft && !!draft.start && !!draft.end && draft.start <= draft.end && draft.start >= bounds.start && draft.end <= bounds.end;
  const apply = () => {
    if (!draft || !valid) return;
    app.setCustomRange(draft);
    app.setDateRange("custom");
    setDraft(null);
  };

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=listbox]")) setDraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft]);

  const custom = app.dateRange === "custom";
  // Quarter shortcuts within the session.
  const y = Number(app.cycle.slice(0, 4)) - 1;
  const quarters: { label: string; span: DateSpan }[] = [
    { label: "Oct–Dec", span: { start: `${y}-10-01`, end: `${y}-12-31` } },
    { label: "Jan–Mar", span: { start: `${y + 1}-01-01`, end: `${y + 1}-03-31` } },
    { label: "Apr–Jun", span: { start: `${y + 1}-04-01`, end: `${y + 1}-06-30` } },
    { label: "Jul–Sep", span: { start: `${y + 1}-07-01`, end: `${y + 1}-09-30` } },
  ];
  const input =
    "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 [color-scheme:light]";

  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <span className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
        Date range
        {custom && !draft && (
          <button type="button" onClick={open} className="font-medium text-brand-700 hover:underline">
            Edit
          </button>
        )}
      </span>
      <Dropdown<DateRange>
        className="flex w-full" triggerWidth="w-full" ariaLabel="Date range"
        value={app.dateRange}
        onChange={(v) => (v === "custom" ? open() : app.setDateRange(v))}
        options={DATE_RANGES.map((d) => ({
          value: d.value,
          label: d.value === "custom" && custom ? rangeLabelOf("custom", app.customRange, app.cycle) : d.label,
        }))}
      />

      {draft && (
        <div role="dialog" aria-label="Custom date range" className="absolute right-0 top-full z-30 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-brand-900">Custom date range</span>
            <span className="text-[10px] text-slate-400">Session {app.cycle.replace("-", " – ")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] text-slate-500">Start date</span>
              <input
                type="date" className={input} aria-label="Start date"
                min={bounds.start} max={draft.end || bounds.end} value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] text-slate-500">End date</span>
              <input
                type="date" className={input} aria-label="End date"
                min={draft.start || bounds.start} max={bounds.end} value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {[...quarters, { label: "Whole session", span: bounds }].map((q) => {
              const on = draft.start === q.span.start && draft.end === q.span.end;
              return (
                <button
                  key={q.label} type="button" onClick={() => setDraft(q.span)}
                  className={clsx("rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", on ? "bg-brand-50 text-brand-800 ring-brand-300" : "text-slate-600 ring-slate-200 hover:bg-slate-50")}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <p className={clsx("mt-2 text-[11px]", valid ? "text-slate-500" : "font-medium text-rose-600")}>
            {valid
              ? <>{spanDays(draft)} day{spanDays(draft) === 1 ? "" : "s"} · {rangeLabelOf("custom", draft, app.cycle)}</>
              : `Pick dates between ${fmtDate(bounds.start)} and ${fmtDate(bounds.end)}, with the end on or after the start.`}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Figures are recorded monthly — a part month counts in proportion to its days.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-md px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={apply} disabled={!valid} className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Global Filters on the Drill-down page: Session, Lead source and Date range. */
function DrillFilters() {
  const app = useApp();
  return (
    <section className="no-print mb-5 rounded-xl border border-slate-200 bg-white px-4 pb-3.5 pt-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-900">Global filters</h2>
        <span className="text-[11px] text-slate-500">Vertical, school and grade are chosen with the breadcrumb below</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:max-w-4xl">
        <Field label="Academic session">
          <Dropdown<Cycle>
            className="flex w-full" triggerWidth="w-full" ariaLabel="Academic session"
            value={app.cycle}
            onChange={app.setCycle}
            options={CYCLES.map((c) => ({ value: c, label: c.replace("-", " – "), hint: c === "2026-27" ? "current" : "backfill" }))}
          />
        </Field>
        <Field label="Lead source">
          <Dropdown<SourceGroup | "All">
            className="flex w-full" triggerWidth="w-full" ariaLabel="Lead source"
            value={app.sourceGroup}
            onChange={app.setSourceGroup}
            options={[{ value: "All", label: "All sources" }, ...SOURCE_GROUPS.map((x) => ({ value: x, label: x }))]}
          />
        </Field>
        <DateRangeField />
      </div>
    </section>
  );
}
