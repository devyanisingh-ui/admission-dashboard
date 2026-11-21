"use client";

import clsx from "clsx";
import {
  AlertTriangle, CheckCircle2, Database, FileClock, KeyRound, RefreshCw, Search, ShieldCheck, UserPlus, Users, XCircle,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Dropdown } from "@/components/dropdown";
import { Badge, Button, Guard, Note, PageHeader, fmt } from "@/components/ui";
import { useApp } from "@/lib/context";
import { AUDIT_LOG, LOCATIONS, SYNC_RUNS, SYNC_STATUS, USERS } from "@/lib/data";
import { ROLES, type RoleId } from "@/lib/roles";
import { PermissionMatrixPanel, grantCount } from "./permissions";
import { Panel, RoleBadge } from "./shared";

export default function AdminPage() {
  return (
    <Guard perm="view.admin">
      <Admin />
    </Guard>
  );
}

type Tab = "users" | "sync" | "audit";

function Admin() {
  const { can, role } = useApp();
  const allowed: Tab[] = [
    ...(can("users.edit") || can("users.request") ? (["users"] as Tab[]) : []),
    ...(can("view.sync") ? (["sync"] as Tab[]) : []),
    ...(can("view.audit") ? (["audit"] as Tab[]) : []),
  ];
  const [tabState, setTab] = useState<Tab>(allowed[0]);
  const tab = allowed.includes(tabState) ? tabState : allowed[0];

  const activeToday = USERS.filter((u) => u.lastActive.startsWith("Today")).length;
  const healthy = SYNC_STATUS.filter((s) => s.status === "ok").length;
  const failedRuns = SYNC_RUNS.filter((r) => r.result.startsWith("Failed")).length;
  const nightly = SYNC_RUNS.find((r) => r.type === "Nightly reconciliation");

  return (
    <>
      <PageHeader title="Administration" subtitle="Users and roles, data-source sync with LeadSquared, SaaS and FABS, and the audit trail of every change made in the dashboard" />

      <div className="mb-4 grid grid-cols-2 gap-3 2xl:grid-cols-4">
        <AdminCard
          disabled={!allowed.includes("users")} active={tab === "users"} onClick={() => setTab("users")}
          icon={Users} tone="blue" label="Users" value={USERS.length} sub={`${activeToday} active today · ${ROLES.length} roles`}
        />
        <AdminCard
          disabled={!allowed.includes("sync")} active={tab === "sync"} onClick={() => setTab("sync")}
          icon={Database} tone={healthy === SYNC_STATUS.length ? "green" : "orange"} label="Data sources" value={`${healthy} / ${SYNC_STATUS.length}`}
          sub={healthy === SYNC_STATUS.length ? "All syncing normally" : `${SYNC_STATUS.filter((s) => s.status !== "ok").map((s) => s.system).join(", ")} delayed · ${failedRuns} failed runs`}
        />
        <AdminCard
          disabled={!allowed.includes("sync")} active={false} onClick={() => setTab("sync")}
          icon={ShieldCheck} tone="green" label="Nightly reconciliation" value={nightly ? "Success" : "—"} sub={nightly ? `${nightly.at} · ${nightly.duration}` : "Not run yet"}
        />
        <AdminCard
          disabled={!allowed.includes("audit")} active={tab === "audit"} onClick={() => setTab("audit")}
          icon={FileClock} tone="violet" label="Audit log" value={AUDIT_LOG.length} sub={`Latest: ${AUDIT_LOG[0].action} · ${AUDIT_LOG[0].at}`}
        />
      </div>

      <div className="no-print mb-4 flex gap-1 border-b border-slate-200">
        {allowed.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition", tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {t === "users" ? "Users & roles" : t === "sync" ? "Sync & integrations" : "Audit log"}
          </button>
        ))}
      </div>

      {!tab && <Note>Your role can open Administration but has none of its sections (users &amp; roles, sync, audit log). Ask the System Administrator to adjust the permission matrix.</Note>}
      {tab === "users" && <UsersTab />}
      {tab === "sync" && <SyncTab />}
      {tab === "audit" && <AuditTab role={role} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

const CARD_TONE = {
  blue: "bg-sky-100 text-sky-600",
  green: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  violet: "bg-violet-100 text-violet-600",
};

function AdminCard({
  active, disabled, onClick, icon: Icon, tone, label, value, sub,
}: { active: boolean; disabled?: boolean; onClick: () => void; icon: typeof Users; tone: keyof typeof CARD_TONE; label: string; value: ReactNode; sub: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition disabled:cursor-default disabled:opacity-60",
        active ? "border-brand-500 ring-2 ring-brand-500/15" : "border-slate-200 enabled:hover:border-slate-300",
      )}
    >
      <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-full", CARD_TONE[tone])}><Icon size={19} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-brand-900">{label}</span>
        <span className="block text-2xl font-bold leading-tight tracking-tight text-slate-900 tabular">{value}</span>
        <span className={clsx("block truncate text-xs", tone === "orange" ? "text-orange-700" : "text-slate-500")}>{sub}</span>
      </span>
    </button>
  );
}

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500";

/* ------------------------------------------------------------------ */
/* Users & roles                                                       */
/* ------------------------------------------------------------------ */

function UsersTab() {
  const { can, permissions } = useApp();
  const [focusRole, setFocusRole] = useState<RoleId | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleId | "all">("all");
  const s = q.trim().toLowerCase();
  const users = USERS.filter((u) => (roleFilter === "all" || u.role === roleFilter) && (!s || `${u.name} ${u.email} ${u.scope}`.toLowerCase().includes(s)));
  const initials = (n: string) => n.replace(/^(Dr\.|Prof\.)\s*/, "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Panel
        className="min-w-0"
        title="Users and role assignment"
        sub="The System Administrator assigns roles on Central Admin request · access is scoped by Vertical → Location"
        bodyClass="p-0"
        actions={
          can("users.edit") ? <Button size="sm" variant="primary"><UserPlus size={13} /> Add user</Button> : <Button size="sm"><UserPlus size={13} /> Request user change</Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-64">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or scope" className="w-full text-xs outline-none" />
          </label>
          <Dropdown<RoleId | "all">
            size="sm" ariaLabel="Role" value={roleFilter} onChange={setRoleFilter}
            options={[{ value: "all", label: "All roles" }, ...ROLES.map((r) => ({ value: r.id, label: r.label }))]}
          />
          <span className="ml-auto text-xs text-slate-500">{users.length} of {USERS.length} users</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={th}>User</th>
                <th className={th}>Role</th>
                <th className={th}>Scope</th>
                <th className={th}>Last active</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const today = u.lastActive.startsWith("Today");
                return (
                  <tr key={u.name} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{initials(u.name)}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{u.name}</div>
                          <div className="truncate text-xs text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                    <td className="px-3 py-2.5 text-slate-600">{u.scope}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <span className={clsx("h-1.5 w-1.5 rounded-full", today ? "bg-emerald-500" : "bg-slate-300")} />
                        {u.lastActive}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{can("users.edit") && <Button size="sm" variant="ghost">Edit</Button>}</td>
                  </tr>
                );
              })}
              {!users.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3">
          <Note tone="phase2">SSO (Google Workspace / Microsoft 365) is undecided for Phase 1 (open item #9). Higher Ed role names are to be confirmed (open item #5).</Note>
        </div>
      </Panel>

      <Panel title="Roles" sub="Scope, users and permissions per role · click a role to highlight it in the matrix · Higher Ed equivalent in grey" bodyClass="p-2">
        <ul className="space-y-0.5">
          {ROLES.map((r) => {
            const n = USERS.filter((u) => u.role === r.id).length;
            const p = grantCount(permissions.matrix, r.id);
            return (
              <li key={r.id}>
                <button
                  onClick={() => setFocusRole(focusRole === r.id ? null : r.id)}
                  aria-pressed={focusRole === r.id}
                  className={clsx("flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left", focusRole === r.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50")}
                >
                  <div className="min-w-0">
                    <RoleBadge role={r.id} />
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {r.scope === "location" ? "Own location" : r.scope === "vertical" ? "One vertical" : r.scope === "all" ? "All locations" : "System"}
                      {r.higherEd !== "—" && r.higherEd !== r.label && <> · Higher Ed: {r.higherEd}</>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-slate-700 tabular">{n} user{n === 1 ? "" : "s"}</div>
                    <div className="text-[11px] text-slate-400 tabular">{p} permission{p === 1 ? "" : "s"}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <PermissionMatrixPanel focusRole={focusRole} onFocusRole={setFocusRole} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sync & integrations                                                 */
/* ------------------------------------------------------------------ */

function SyncTab() {
  const { can } = useApp();
  const [running, setRunning] = useState<string | null>(null);
  const [sys, setSys] = useState("all");
  const run = (s: string) => {
    setRunning(s);
    setTimeout(() => setRunning(null), 1800);
  };
  const runs = SYNC_RUNS.filter((r) => sys === "all" || r.system === sys || r.system === "All");

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-3">
        {SYNC_STATUS.map((s) => {
          const ok = s.status === "ok";
          return (
            <div key={s.system} className={clsx("rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", ok ? "border-slate-200" : "border-amber-300")}>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-brand-900">{s.system}</span>
                {ok ? <Badge tone="green"><CheckCircle2 size={11} /> Healthy</Badge> : <Badge tone="amber"><AlertTriangle size={11} /> Degraded</Badge>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-slate-400">Last success</dt><dd className="font-medium text-slate-800">{s.lastSync.split(", ")[1]} · {s.minutesAgo} min ago</dd></div>
                <div><dt className="text-slate-400">Next run</dt><dd className="font-medium text-slate-800">{s.nextRun}</dd></div>
                <div><dt className="text-slate-400">Records held</dt><dd className="font-medium text-slate-800 tabular">{fmt(s.records)}</dd></div>
                <div><dt className="text-slate-400">Method</dt><dd className="font-medium text-slate-800">{ok ? s.note : "Incremental"}</dd></div>
              </dl>
              {!ok && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">{s.note}</p>}
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" disabled={!can("sync.run") || running === s.system} onClick={() => run(s.system)} title={can("sync.run") ? undefined : "System Administrator only"}>
                  <RefreshCw size={13} className={running === s.system ? "animate-spin" : ""} /> {running === s.system ? "Running…" : "Re-run sync"}
                </Button>
                {can("sync.run") && <Button size="sm" variant="ghost"><KeyRound size={13} /> Credentials</Button>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Schedule">
          <ul className="space-y-3 text-sm">
            <ScheduleItem when="Every 15 minutes" what="Incremental sync" detail="Modified-since filters; webhooks where available" />
            <ScheduleItem when="Daily · 02:00 IST" what="Nightly full reconciliation" detail="Catches deletions, back-dated edits and status reversals" />
            <ScheduleItem when="Monday · 09:00 IST" what="Weekly snapshot frozen" detail="Locked for reviews and the Download Centre" />
            <ScheduleItem when="Before go-live" what="Historical backfill" detail="Sessions 2025–26 and 2026–27 from all three systems" />
          </ul>
        </Panel>

        <Panel
          title="Recent runs"
          bodyClass="p-0"
          actions={
            <Dropdown size="sm" ariaLabel="System" value={sys} onChange={setSys} options={[{ value: "all", label: "All systems" }, ...SYNC_STATUS.map((s) => ({ value: s.system, label: s.system }))]} />
          }
        >
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>When</th>
                  <th className={th}>System</th>
                  <th className={th}>Type</th>
                  <th className={clsx(th, "text-right")}>Records</th>
                  <th className={clsx(th, "text-right")}>Duration</th>
                  <th className={th}>Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r, i) => {
                  const failed = r.result.startsWith("Failed");
                  const [head, ...rest] = r.result.split(/ [–-] /);
                  return (
                    <tr key={i} className={clsx(failed && "bg-rose-50/40")}>
                      <td className="px-3 py-2 text-slate-600">{r.at}</td>
                      <td className="px-3 py-2 font-medium">{r.system}</td>
                      <td className="px-3 py-2 text-slate-600">{r.type}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.records)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{r.duration}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          {failed ? <Badge tone="red"><XCircle size={11} /> {head}</Badge> : <Badge tone="green"><CheckCircle2 size={11} /> {head}</Badge>}
                          {rest.length > 0 && <span className="text-xs text-slate-500">{rest.join(" – ")}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function ScheduleItem({ when, what, detail }: { when: string; what: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
      <div>
        <div className="font-medium text-slate-900">{what} <span className="ml-1 text-xs font-normal text-slate-500">{when}</span></div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

function AuditTab({ role }: { role: RoleId }) {
  const { allowedLocations } = useApp();
  const own = allowedLocations.map((l) => l.short);
  const base = role === "locHead" ? AUDIT_LOG.filter((a) => own.includes(a.location)) : AUDIT_LOG;
  const actions = Array.from(new Set(base.map((a) => a.action)));
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const rows = useMemo(
    () => base.filter((a) => (action === "all" || a.action === action) && (!s || `${a.who} ${a.target} ${a.change} ${a.location}`.toLowerCase().includes(s))),
    [base, action, s],
  );

  return (
    <Panel
      title="Audit log"
      sub={`Mappings, Seat Matrix, targets, masters and users — who, when, old → new${role === "locHead" ? " · your location only" : ""}`}
      bodyClass="p-0"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 focus-within:border-brand-500 sm:w-56">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search who, what or where" className="w-full text-xs outline-none" />
          </label>
          <Dropdown size="sm" ariaLabel="Action" value={action} onChange={setAction} options={[{ value: "all", label: "All actions" }, ...actions.map((a) => ({ value: a, label: a }))]} />
        </div>
      }
    >
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={th}>When</th>
              <th className={th}>Who</th>
              <th className={th}>Action</th>
              <th className={th}>Location</th>
              <th className={th}>Target</th>
              <th className={th}>Old → new</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a, i) => {
              const [from, to] = a.change.split(" → ");
              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 tabular">{a.at}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{a.who}</div>
                    <div className="text-[11px] text-slate-400">{a.role}</div>
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={/undone|overrid|rejected/i.test(a.action) ? "amber" : /created|approved|confirmed/i.test(a.action) ? "green" : "blue"}>{a.action}</Badge></td>
                  <td className="px-3 py-2.5 text-slate-600">{a.location === "—" ? <span className="text-slate-300">Group</span> : a.location}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{a.target}</td>
                  <td className="px-3 py-2.5 text-sm">
                    {to !== undefined ? (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400 line-through decoration-slate-300">{from}</span>
                        <span className="text-slate-300">→</span>
                        <span className="font-medium text-slate-900">{to}</span>
                      </span>
                    ) : (
                      a.change
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">No audit entries match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-slate-400">{rows.length} of {base.length} entries · {LOCATIONS.length} locations covered · entries cannot be edited or deleted</p>
    </Panel>
  );
}
