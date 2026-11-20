"use client";

import clsx from "clsx";
import { Check, History, Info, Lock, RotateCcw, Search, ShieldAlert, X } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/master-kit";
import { Dropdown } from "@/components/dropdown";
import { Badge, Button, Note } from "@/components/ui";
import { useApp } from "@/lib/context";
import { downloadCsv } from "@/lib/export";
import {
  DEFAULT_MATRIX, PERMISSION_GROUPS, PERMISSIONS, ROLES, lockedReason, matrixChanges, permissionDef, setGrant,
  type GrantChange, type Permission, type PermissionGroup, type PermissionMatrix, type RoleId,
} from "@/lib/roles";
import { nowLabel } from "@/lib/seat-matrix";
import { Panel, ROLE_TONE } from "./shared";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const roleShort = (id: RoleId) => ROLES.find((r) => r.id === id)!.short;
const describe = (c: GrantChange) => `${c.on ? "Granted" : "Removed"} “${permissionDef(c.perm).label}” ${c.on ? "to" : "from"} ${roleShort(c.role)}`;

function summarise(changes: GrantChange[]) {
  const roles = [...new Set(changes.map((c) => roleShort(c.role)))];
  const on = changes.filter((c) => c.on).length, off = changes.length - on;
  return [on && `${on} granted`, off && `${off} removed`].filter(Boolean).join(", ") + ` · ${roles.join(", ")}`;
}

/** Permission count per role, for the Roles list. */
export const grantCount = (matrix: PermissionMatrix, role: RoleId) => PERMISSIONS.filter((d) => matrix[d.id].includes(role)).length;

type Notice = { tone: "info" | "warn"; text: ReactNode } | null;

/**
 * Role × permission matrix. The System Administrator (users.edit) edits it; changes are drafted, then saved
 * with an audit entry. Everyone else with access to this tab sees it read-only.
 */
export function PermissionMatrixPanel({ focusRole, onFocusRole }: { focusRole: RoleId | null; onFocusRole: (r: RoleId | null) => void }) {
  const { can, permissions, setPermissions, userName } = useApp();
  const canEdit = can("users.edit");
  const saved = permissions.matrix;
  const [draft, setDraft] = useState<PermissionMatrix | null>(null);
  const [group, setGroup] = useState<PermissionGroup | "all">("all");
  const [q, setQ] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const working = draft ?? saved;
  const pending = matrixChanges(saved, working);
  const custom = matrixChanges(DEFAULT_MATRIX, saved);
  const isCustom = (p: Permission, r: RoleId) => saved[p].includes(r) !== DEFAULT_MATRIX[p].includes(r);

  const s = q.trim().toLowerCase();
  const visible = PERMISSIONS.filter(
    (d) =>
      (group === "all" || d.group === group) &&
      (!s || `${d.label} ${d.description} ${d.id}`.toLowerCase().includes(s)) &&
      (!onlyCustom || ROLES.some((r) => isCustom(d.id, r.id) || working[d.id].includes(r.id) !== saved[d.id].includes(r.id))),
  );
  const groups = PERMISSION_GROUPS.filter((g) => visible.some((d) => d.group === g));

  const toggle = (role: RoleId, perm: Permission) => {
    const on = !working[perm].includes(role);
    const res = setGrant(working, role, perm, on);
    setDraft(matrixChanges(saved, res.matrix).length ? res.matrix : null);
    const label = (ps: Permission[]) => ps.map((p) => `“${permissionDef(p).label}”`).join(", ");
    if (res.alsoGranted.length || res.alsoRevoked.length)
      setNotice({
        tone: "warn",
        text: (
          <>
            {on ? "Granting" : "Removing"} “{permissionDef(perm).label}” for <b>{roleShort(role)}</b> also{" "}
            {res.alsoGranted.length > 0 && <>granted {label(res.alsoGranted)} (required)</>}
            {res.alsoGranted.length > 0 && res.alsoRevoked.length > 0 && " and "}
            {res.alsoRevoked.length > 0 && <>removed {label(res.alsoRevoked)} ({on ? "cannot be held together" : "depends on it"})</>}.
          </>
        ),
      });
    else setNotice(null);
  };

  const commit = (next: PermissionMatrix, changes: GrantChange[], summary: string) => {
    setPermissions((st) => ({ matrix: next, log: [{ id: Math.random().toString(36).slice(2, 10), at: nowLabel(), who: userName, summary, changes }, ...st.log].slice(0, 100) }));
  };
  const save = () => {
    if (!pending.length) return;
    commit(working, pending, summarise(pending));
    setDraft(null);
    setNotice({ tone: "info", text: <>Permissions saved — {plural(pending.length, "change")} audit-logged. Menus and pages update straight away for those roles.</> });
  };
  const discard = () => { setDraft(null); setNotice(null); };
  const reset = () => {
    const changes = matrixChanges(saved, DEFAULT_MATRIX);
    if (changes.length) commit(DEFAULT_MATRIX, changes, `Reset to the default matrix (§10.2) · ${plural(changes.length, "change")}`);
    setDraft(null);
    setNotice({ tone: "info", text: changes.length ? `Reset to the default matrix — ${plural(changes.length, "change")} audit-logged.` : "Already matches the default matrix." });
  };
  const exportCsv = () =>
    downloadCsv(
      "role-permissions",
      PERMISSIONS.map((d) => ({
        Module: d.group, Permission: d.label, Code: d.id, Description: d.description,
        ...Object.fromEntries(ROLES.map((r) => [r.label, working[d.id].includes(r.id) ? "Yes" : "No"])),
      })),
    );

  return (
    <Panel
      className="min-w-0 2xl:col-span-2"
      title="Permission matrix"
      sub={canEdit ? "Tick what each role can do · actions need the screen they live on, so related permissions switch together" : "What each role can do · only the System Administrator changes this — raise a request for changes"}
      bodyClass="p-0"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {custom.length > 0 ? <Badge tone="amber">{plural(custom.length, "change")} from default</Badge> : <Badge tone="green">Default matrix (§10.2)</Badge>}
          <Button size="sm" onClick={exportCsv}>Export CSV</Button>
          {canEdit && (
            <>
              <Button size="sm" variant="ghost" disabled={!custom.length && !pending.length} onClick={() => setConfirmReset(true)}><RotateCcw size={13} /> Reset to default</Button>
              {pending.length > 0 && <Button size="sm" variant="ghost" onClick={discard}>Discard</Button>}
              <Button size="sm" variant="primary" disabled={!pending.length} onClick={save}><Check size={13} /> {pending.length ? `Save ${plural(pending.length, "change")}` : "Save changes"}</Button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 sm:w-64">
          <Search size={13} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions" className="w-full text-xs outline-none" />
        </label>
        <Dropdown<PermissionGroup | "all">
          size="sm" ariaLabel="Module" value={group} onChange={setGroup}
          options={[{ value: "all", label: "All modules" }, ...PERMISSION_GROUPS.map((g) => ({ value: g, label: g }))]}
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} className="accent-brand-600" />
          Only rows changed from default
        </label>
        {focusRole && (
          <button onClick={() => onFocusRole(null)} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
            Highlighting {roleShort(focusRole)} <X size={11} />
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">{plural(visible.length, "permission")} · {ROLES.length} roles</span>
      </div>

      {notice && <div className="border-b border-slate-100 px-4 py-2.5"><Note tone={notice.tone}>{notice.text}</Note></div>}

      <div className="max-h-[640px] overflow-auto scroll-thin">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">Permission</th>
              {ROLES.map((r) => (
                <th key={r.id} className={clsx("w-[92px] px-1 py-2 text-center", focusRole === r.id && "bg-brand-50")}>
                  <button
                    onClick={() => onFocusRole(focusRole === r.id ? null : r.id)}
                    title={`${r.label} · ${r.scope === "location" ? "own location" : r.scope === "vertical" ? "one vertical" : r.scope === "all" ? "all locations" : "system"} · click to highlight`}
                    className={clsx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ring-1 ring-inset", ROLE_TONE[r.id])}
                  >
                    {r.short}
                  </button>
                  <div className="mt-0.5 text-[10px] font-normal text-slate-400 tabular">{grantCount(working, r.id)} / {PERMISSIONS.length}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr className="bg-slate-50">
                  <td colSpan={ROLES.length + 1} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g}</td>
                </tr>
                {visible.filter((d) => d.group === g).map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-800">{d.label}</span>
                        {d.sensitive && <span title="Sensitive — personal data, other users' access or live integrations" className="text-rose-500"><ShieldAlert size={13} /></span>}
                        <code className="text-[10px] text-slate-400">{d.id}</code>
                      </div>
                      <p className="text-xs text-slate-500">{d.description}</p>
                      {(d.requires || d.excludes) && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {d.requires && <>Needs {d.requires.map((r) => `“${permissionDef(r).label}”`).join(", ")}</>}
                          {d.requires && d.excludes && " · "}
                          {d.excludes && <>Not with {d.excludes.map((r) => `“${permissionDef(r).label}”`).join(", ")}</>}
                        </p>
                      )}
                    </td>
                    {ROLES.map((r) => (
                      <td key={r.id} className={clsx("px-1 py-2 text-center align-middle", focusRole === r.id && "bg-brand-50/60")}>
                        <Cell
                          on={working[d.id].includes(r.id)}
                          changed={working[d.id].includes(r.id) !== saved[d.id].includes(r.id)}
                          custom={isCustom(d.id, r.id)}
                          locked={lockedReason(r.id, d.id)}
                          editable={canEdit}
                          label={`${d.label} — ${r.label}`}
                          onToggle={() => toggle(r.id, d.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            {!visible.length && <tr><td colSpan={ROLES.length + 1} className="px-4 py-8 text-center text-sm text-slate-500">No permissions match.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><CellMark on /> Granted</span>
          <span className="inline-flex items-center gap-1.5"><CellMark on={false} /> Not granted</span>
          {canEdit && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-amber-400" /> Unsaved</span>}
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Differs from default</span>
          <span className="inline-flex items-center gap-1.5"><Lock size={11} /> Always on</span>
          <span className="inline-flex items-center gap-1.5"><ShieldAlert size={11} className="text-rose-500" /> Sensitive</span>
        </div>
        <p className="flex max-w-xl items-start gap-1.5 text-[11px] text-slate-500">
          <Info size={12} className="mt-px shrink-0" />
          <span>Permissions say <i>what</i> a role can do; its scope says <i>where</i> — Counsellors, Location Heads and Principals see their own location, Vertical Heads their vertical.</span>
        </p>
      </div>

      <PermissionLog />

      {confirmReset && (
        <ConfirmDialog tone="warn" title="Reset to the default matrix?" confirmLabel="Reset permissions" onConfirm={reset} onClose={() => setConfirmReset(false)}>
          Every role goes back to the Phase 1 matrix (§10.2), undoing {plural(custom.length, "saved change")}{pending.length > 0 && <> and discarding {plural(pending.length, "unsaved change")}</>}. The reset is audit-logged.
        </ConfirmDialog>
      )}
    </Panel>
  );
}

function CellMark({ on }: { on: boolean }) {
  return on ? (
    <span className="grid h-5 w-5 place-items-center rounded bg-emerald-500 text-white"><Check size={13} strokeWidth={3} /></span>
  ) : (
    <span className="grid h-5 w-5 place-items-center rounded border border-slate-200 bg-white text-slate-300" />
  );
}

function Cell({
  on, changed, custom, locked, editable, label, onToggle,
}: { on: boolean; changed: boolean; custom: boolean; locked?: string; editable: boolean; label: string; onToggle: () => void }) {
  const mark = (
    <span className={clsx("relative inline-grid rounded", changed && "ring-2 ring-amber-400 ring-offset-1")}>
      <CellMark on={on} />
      {locked && <Lock size={9} className="absolute -bottom-1 -right-1 rounded-full bg-white text-slate-500" />}
      {custom && !changed && <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
    </span>
  );
  if (!editable || locked)
    return <span role="img" aria-label={`${label}: ${on ? "granted" : "not granted"}`} title={locked ?? (custom ? "Differs from the default matrix" : undefined)} className="inline-flex">{mark}</span>;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      title={changed ? "Unsaved change" : custom ? "Differs from the default matrix" : undefined}
      className="inline-flex rounded p-1 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {mark}
    </button>
  );
}

function PermissionLog() {
  const { permissions } = useApp();
  const log = permissions.log;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="border-t border-slate-200 px-4 py-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><History size={12} /> Permission change log</h3>
      {!log.length ? (
        <p className="text-sm text-slate-500">No changes yet — every role has the default matrix.</p>
      ) : (
        <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto scroll-thin">
          {log.slice(0, 20).map((e) => (
            <li key={e.id} className="py-2 text-sm">
              <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="font-medium text-slate-800">{e.summary}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{e.who} · {e.at}</span>
              </button>
              {open === e.id && (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {e.changes.map((c, i) => <li key={i} className={c.on ? "text-emerald-700" : "text-rose-700"}>{c.on ? "+" : "−"} {describe(c)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
