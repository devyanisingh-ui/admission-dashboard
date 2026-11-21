"use client";

import clsx from "clsx";
import {
  AlertTriangle, Armchair, Check, CheckCircle2, Circle, Clock, Copy, DoorOpen, Download, FilePlus2, FileSpreadsheet, GraduationCap, History, Lock,
  Percent, Plus, RotateCcw, School, Send, ShieldCheck, Target, Trash2, TrendingDown, TrendingUp, Unlock, Upload, X,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { SnapshotCard } from "@/components/dashboard-widgets";
import { LocationPicker, useCurrentLocation } from "@/components/location-picker";
import { Badge, Button, Card, EmptyState, Guard, Note, PageHeader, ProgressBar, Select, Tabs, fmt, fmtPct } from "@/components/ui";
import { useApp } from "@/lib/context";
import { downloadCsv } from "@/lib/export";
import { defaultTarget, locationUnits, pct, type Location, type SeatField, type SeatValues, type UnitStats } from "@/lib/data";
import { EntryToast, useEntryStore } from "@/components/entry-kit";
import { ConfirmDialog } from "@/components/master-kit";
import { targetKey } from "@/lib/marketing";
import {
  FIELD_LABEL, LIVE_PLAN_CYCLE, planCyclesFor, blankValues, createMatrix, deleteMatrix, diffRows, matrixOf, parseSeatCsv, templateRows, updateMatrix, withIntake,
  type ChangeRequest, type CreateMethod, type HistoryEntry, type ParsedUpload, type PlanCycle,
} from "@/lib/seat-matrix";

export default function PlanningPage() {
  return (
    <Guard perm="view.planning">
      <Planning />
    </Guard>
  );
}

type Tab = "seats" | "targets";

function Planning() {
  const loc = useCurrentLocation();
  const [tab, setTab] = useState<Tab>("seats");
  return (
    <>
      <PageHeader
        title="Seat Matrix & Targets"
        subtitle={<><b className="font-semibold text-slate-700">{loc.name}</b> · planning data held only in the dashboard · every change is audit-logged (who, when, old → new)</>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "seats", label: "Seat Matrix" }, { id: "targets", label: "Admission targets" }]} />
      {tab === "seats" ? <SeatMatrix /> : <Targets />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function Toolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Fill % with a bar; over-filled grades are flagged rather than shown as a plain number. */
function FillCell({ net, seats }: { net: number; seats: number }) {
  if (!seats) return <span className="text-slate-400">—</span>;
  const p = pct(net, seats);
  const over = net - seats;
  return (
    <div className="flex items-center gap-2" title={over > 0 ? `${over} more admitted than seats` : undefined}>
      <div className="min-w-[56px] flex-1"><ProgressBar value={Math.min(p, 100)} tone={over > 0 ? "bg-violet-500" : p >= 95 ? "bg-emerald-500" : p >= 75 ? "bg-amber-400" : "bg-rose-500"} /></div>
      <span className={clsx("w-10 shrink-0 text-right text-[13px] tabular", over > 0 ? "font-semibold text-violet-700" : "text-slate-700")}>{p.toFixed(0)}%</span>
      <span className="w-14 shrink-0 text-[11px] font-medium text-violet-700">{over > 0 ? `+${over} over` : ""}</span>
    </div>
  );
}

const thBase = "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500";
const th = `${thBase} text-right`;
const thLeft = `${thBase} text-left`;
const td = "whitespace-nowrap px-3 py-1.5 text-right tabular";
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const cycleText = (c: PlanCycle) => c.replace("-", "–");

/* ------------------------------------------------------------------ */
/* Seat Matrix                                                         */
/* ------------------------------------------------------------------ */

function NumInput({ value, original, invalid, onCommit, label }: { value: number; original: number; invalid?: boolean; onCommit: (v: number) => void; label: string }) {
  const changed = value !== original;
  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      aria-label={label}
      defaultValue={value}
      onChange={(e) => {
        // Commit as you type so the change count, totals and checks stay live.
        const raw = e.target.value;
        const v = Number(raw);
        if (raw === "") onCommit(0);
        else if (!Number.isNaN(v)) onCommit(Math.max(0, Math.round(v)));
      }}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      title={changed ? `Was ${original}` : undefined}
      className={clsx(
        "w-20 rounded-md border px-2 py-1 text-right text-sm tabular outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
        invalid ? "border-rose-300 bg-rose-50" : changed ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white",
      )}
    />
  );
}

type Flash = { tone: "info" | "warn"; text: ReactNode } | null;

function SeatMatrix() {
  const loc = useCurrentLocation();
  const { can, userName, seatStore, setSeatStore, seatVersion, allowedLocations } = useApp();
  const requests = seatStore.requests;
  // Cycles come from the Masters cycle calendar for this location's vertical.
  const [pickedCycle, setPlanCycle] = useState<PlanCycle>(LIVE_PLAN_CYCLE);
  const cycles = planCyclesFor(loc.vertical);
  const cyc = cycles.find((c) => c.value === pickedCycle) ?? cycles[0];
  const planCycle = cyc.value;
  const started = cyc.started;
  const view = matrixOf(seatStore, planCycle, loc.id);
  // Admissions so far come from FABS for the live cycle only; seat edits do not change them.
  const live = useMemo(() => locationUnits(loc.id, "2026-27"), [loc.id, seatVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const [edits, setEdits] = useState<Record<string, Partial<SeatValues>>>({});
  // Rows added to / removed from the matrix but not saved yet (setup cycles only).
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canDirectEdit = !started && can("seat.edit");
  const canRequest = started && can("seat.requestChange");
  const editable = view.exists && (canDirectEdit || canRequest);
  const canEditRows = view.exists && canDirectEdit;
  const unitLabel = loc.vertical === "Schools" ? "Grade" : "Programme";
  // Rows in the matrix (kept in Masters order), plus unsaved additions. Removed rows stay listed, struck through, until saved.
  const listed = view.exists ? loc.units.filter((u) => view.rows[u] || added.includes(u)) : loc.units;
  const units = listed.filter((u) => !removed.includes(u));
  const addable = view.exists ? loc.units.filter((u) => !view.rows[u] && !added.includes(u)) : [];

  const say = (f: Flash, ms = 4500) => {
    setFlash(f);
    if (f) setTimeout(() => setFlash((cur) => (cur === f ? null : cur)), ms);
  };
  const discard = () => { setEdits({}); setAdded([]); setRemoved([]); setResetKey((k) => k + 1); };
  const switchCycle = (c: PlanCycle) => { setPlanCycle(c); discard(); setFlash(null); };

  const orig = (u: string) => view.rows[u] ?? blankValues();
  const val = (u: string, f: SeatField) => edits[u]?.[f] ?? orig(u)[f];
  const pendingFor = (u: string) => requests.filter((r) => r.status === "pending" && r.locId === loc.id && r.cycle === planCycle && r.unit === u);

  const allRows = listed.map((u) => {
    const s = live.find((x) => x.unit === u);
    const net = started && s ? s.enrolled - s.withdrawnNew : 0;
    const continuing = val(u, "continuing"), seats = val(u, "seats"), ews = val(u, "ewsSeats");
    const gone = removed.includes(u);
    return { unit: u, net, ewsFilled: started && s ? Math.min(s.ewsFilled, ews) : 0, continuing, seats, ews, intake: continuing + seats, ewsOver: !gone && ews > seats, belowFilled: started && seats < net, gone, isNew: added.includes(u) };
  });
  const rows = allRows.filter((r) => !r.gone);
  const tot = rows.reduce(
    (a, r) => ({ intake: a.intake + r.intake, continuing: a.continuing + r.continuing, seats: a.seats + r.seats, ews: a.ews + r.ews, net: a.net + r.net, ewsFilled: a.ewsFilled + r.ewsFilled }),
    { intake: 0, continuing: 0, seats: 0, ews: 0, net: 0, ewsFilled: 0 },
  );
  const invalid = rows.filter((r) => r.ewsOver);
  const vacancies = rows.reduce((s, r) => s + Math.max(0, r.seats - r.net), 0);
  const overFilled = rows.filter((r) => r.net > r.seats);
  const empty = rows.filter((r) => !r.seats);
  const fill = pct(tot.net, tot.seats);

  const nextRows = () => Object.fromEntries([...new Set([...Object.keys(edits), ...added])].map((u) => [u, withIntake({ ...orig(u), ...edits[u] })]));
  const changes = view.exists ? diffRows(view.rows, nextRows()).filter((c) => c.field !== "intake") : [];
  // Field edits on a newly added row count as part of adding it.
  const changeCount = changes.filter((c) => !added.includes(c.unit)).length + added.length + removed.length;

  const addRow = (u: string) => {
    if (!u) return;
    setAdded((a) => (a.includes(u) ? a : [...a, u]));
  };
  const removeRow = (u: string) => {
    setEdits((e) => { const { [u]: _drop, ...rest } = e; return rest; }); // eslint-disable-line @typescript-eslint/no-unused-vars
    if (added.includes(u)) setAdded((a) => a.filter((x) => x !== u));
    else setRemoved((r) => [...r, u]);
    setResetKey((k) => k + 1);
  };
  const restoreRow = (u: string) => setRemoved((r) => r.filter((x) => x !== u));
  const removeMatrix = () => {
    setSeatStore((s) => deleteMatrix(s, planCycle, loc.id, userName));
    discard();
    say({ tone: "info", text: <>Seat Matrix for <b>{loc.short}</b> {cycleText(planCycle)} deleted — audit-logged. Create it again below whenever you are ready.</> }, 6000);
  };

  // Typing the original value back removes the change.
  const set = (unit: string, f: SeatField, v: number) =>
    setEdits((e) => {
      const row = { ...e[unit] };
      if (v === orig(unit)[f]) delete row[f];
      else row[f] = v;
      const next = { ...e, [unit]: row };
      if (!Object.keys(row).length) delete next[unit];
      return next;
    });

  const submit = () => {
    if (canRequest) {
      const newReqs: ChangeRequest[] = changes.map((c) => ({
        id: Math.random().toString(36).slice(2), locId: loc.id, location: loc.short, cycle: planCycle, unit: c.unit, field: c.field, from: c.from, to: c.to, by: userName, status: "pending",
      }));
      setSeatStore((s) => ({ ...s, requests: [...newReqs, ...s.requests] }));
      say({ tone: "info", text: `${plural(newReqs.length, "change request")} sent to the Vertical Admissions Head. Seats update once approved.` });
    } else {
      setSeatStore((s) => updateMatrix(s, planCycle, loc.id, nextRows(), userName, "updated", { added, removed }));
      say({ tone: "info", text: <>Seat Matrix saved — {plural(changeCount, "change")} audit-logged. {planCycle === LIVE_PLAN_CYCLE && "Seat fill and vacancies across the dashboard now use the new seats."}</> });
    }
    discard();
  };

  const approve = (r: ChangeRequest, ok: boolean) => {
    setSeatStore((s0) => {
      const s = { ...s0, requests: s0.requests.map((x) => (x.id === r.id ? { ...x, status: ok ? ("approved" as const) : ("rejected" as const) } : x)) };
      if (!ok) return s;
      const cur = matrixOf(s, r.cycle, r.locId).rows[r.unit] ?? blankValues();
      return updateMatrix(s, r.cycle, r.locId, { [r.unit]: withIntake({ ...cur, [r.field]: r.to }) }, `${userName} (approved request from ${r.by})`, "approved");
    });
    if (!ok) return;
    say({ tone: "info", text: `Approved — ${r.location} ${r.unit} ${FIELD_LABEL[r.field].toLowerCase()} is now ${r.to}. The dashboard uses the new figure.` });
  };

  const downloadTemplate = () =>
    downloadCsv(`seat-matrix-${loc.short.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${planCycle}`, templateRows(units, view.exists ? Object.fromEntries(units.map((u) => [u, withIntake({ continuing: val(u, "continuing"), seats: val(u, "seats"), ewsSeats: val(u, "ewsSeats") })])) : {}));

  const loadFile = async (file: File) => {
    const parsed = parseSeatCsv(await file.text(), units);
    if (parsed.errors.length || !parsed.matched) {
      say({ tone: "warn", text: <UploadReport parsed={parsed} file={file.name} /> }, 12000);
      return;
    }
    const next: Record<string, Partial<SeatValues>> = {};
    for (const [u, v] of Object.entries(parsed.rows)) {
      const o = orig(u);
      const row: Partial<SeatValues> = {};
      for (const f of ["continuing", "seats", "ewsSeats"] as const) if (v[f] !== o[f]) row[f] = v[f];
      if (Object.keys(row).length) next[u] = row;
    }
    setEdits(next);
    setResetKey((k) => k + 1);
    say({ tone: parsed.missing.length || parsed.unknown.length ? "warn" : "info", text: <UploadReport parsed={parsed} file={file.name} loaded={Object.keys(next).length} /> }, 12000);
  };

  const cell = (r: (typeof rows)[number], f: "continuing" | "seats" | "ewsSeats") => {
    const v = f === "ewsSeats" ? r.ews : r[f];
    return editable ? (
      <NumInput key={`${loc.id}-${planCycle}-${r.unit}-${f}-${resetKey}`} label={`${r.unit} ${FIELD_LABEL[f]}`} value={v} original={orig(r.unit)[f]} invalid={f === "ewsSeats" && r.ewsOver} onCommit={(x) => set(r.unit, f, x)} />
    ) : f === "ewsSeats" && !v ? (
      <span className="text-slate-300">—</span>
    ) : (
      fmt(v)
    );
  };

  // Each role only sees requests for locations it can access.
  const cycleRequests = requests.filter((r) => r.cycle === planCycle && allowedLocations.some((l) => l.id === r.locId));
  const pending = cycleRequests.filter((r) => r.status === "pending");
  const history = seatStore.history.filter((h) => h.locId === loc.id && h.cycle === planCycle);
  const lastChange = view.meta?.updatedAt ? `Updated by ${view.meta.updatedBy} · ${view.meta.updatedAt}` : view.meta ? `Created by ${view.meta.createdBy} · ${view.meta.createdAt}` : null;

  const statusText = started
    ? canRequest
      ? "Edit any figure and send it as a change request — the Vertical Admissions Head approves it before seats change."
      : can("seat.approve")
        ? "Location Heads send change requests; approve or reject them in the panel on the right."
        : "Location Heads request changes and the Vertical Admissions Head approves them. You can view and download."
    : canDirectEdit
      ? view.exists
        ? "Edit the figures and save, or download the template, fill it in and upload it back."
        : "Create the matrix for each location before entry closes."
      : "View only for your role — the Location Head or Central Admin enters these figures.";
  const groupHead = "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider";

  return (
    <>
      <Toolbar
        actions={
          view.exists && (
            <>
              <Button size="sm" onClick={downloadTemplate} title="CSV with the current figures — fill it in and upload it back"><Download size={13} /> {editable ? "Template" : "Download CSV"}</Button>
              {editable && (
                <>
                  <Button size="sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload CSV</Button>
                  <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
                  <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
                  {changeCount > 0 && <Button size="sm" variant="ghost" onClick={discard}>Discard</Button>}
                  <Button size="sm" variant="primary" disabled={!changeCount || invalid.length > 0 || !units.length} onClick={submit} title={invalid.length ? "EWS/DG reserved cannot be more than seats for new admission" : !units.length ? `Keep at least one ${unitLabel.toLowerCase()} — or delete the matrix` : !changeCount ? "Edit a figure first" : undefined}>
                    {canRequest ? <Send size={13} /> : <Check size={13} />}
                    {changeCount ? `${canRequest ? "Request" : "Save"} ${plural(changeCount, "change")}` : canRequest ? "Request changes" : "Save changes"}
                  </Button>
                  {canEditRows && (
                    <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} title={`Delete the ${cycleText(planCycle)} Seat Matrix for ${loc.short}`}>
                      <Trash2 size={13} /> Delete matrix
                    </Button>
                  )}
                </>
              )}
            </>
          )
        }
      >
        <LocationPicker />
        <Select label="Planning cycle" value={planCycle} onChange={switchCycle} options={cycles.map((c) => ({ value: c.value, label: c.label }))} />
      </Toolbar>

      {confirmDelete && (
        <ConfirmDialog title={`Delete the ${cycleText(planCycle)} Seat Matrix?`} confirmLabel="Delete matrix" onConfirm={removeMatrix} onClose={() => setConfirmDelete(false)}>
          This removes all {plural(Object.keys(view.rows).length, unitLabel.toLowerCase())} and {fmt(Object.values(view.rows).reduce((s, r) => s + r.seats, 0))} seats for <b>{loc.name}</b>
          {changeCount > 0 && <>, and discards {plural(changeCount, "unsaved change")}</>}. The change history is kept. You can create the matrix again afterwards.
        </ConfirmDialog>
      )}

      <div
        className={clsx(
          "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3",
          started ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70",
        )}
      >
        <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", started ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
          {started ? <Lock size={15} /> : <Unlock size={15} />}
        </span>
        <div className="min-w-0 flex-1 basis-64 text-sm">
          <p className={clsx("font-semibold", started ? "text-amber-900" : "text-emerald-900")}>
            {cycleText(planCycle)} · {started ? `${cyc.lock} — cycle started` : cyc.lock}
          </p>
          <p className={clsx("text-xs", started ? "text-amber-800" : "text-emerald-800")}>{statusText}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 pl-11 lg:w-auto lg:pl-0">
          {!view.exists ? (
            <Badge tone="amber">Not created yet</Badge>
          ) : editable ? (
            <Badge tone="blue">Editable</Badge>
          ) : (
            <Badge><Lock size={11} /> View only</Badge>
          )}
          {lastChange && <span className="text-[11px] text-slate-500">{lastChange}</span>}
        </div>
      </div>

      {flash && (
        <div className="mb-4">
          <Note tone={flash.tone}>{flash.text}</Note>
        </div>
      )}

      {!view.exists ? (
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="min-w-0 xl:col-span-3">
            <CreateMatrix
              key={`${loc.id}-${planCycle}`}
              loc={loc}
              cycle={planCycle}
              canCreate={can("seat.edit")}
              onCreate={(rowsIn, method) => {
                setSeatStore((s) => createMatrix(s, planCycle, loc.id, rowsIn, method, userName));
                discard();
                say({ tone: "info", text: <>Seat Matrix for <b>{loc.short}</b> {cycleText(planCycle)} created. {method === "blank" ? "Fill in each row and save." : "Review the figures and save any changes."}</> }, 6000);
              }}
            />
          </div>
          <div className="flex flex-col gap-4">
            <SetupProgress cycle={planCycle} />
            <HistoryCard className="flex-1" history={history} />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))]">
            <SnapshotCard theme="blue" icon={School} label="Total intake" value={tot.intake} change={null} sub={`${fmt(tot.continuing)} continuing + ${fmt(tot.seats)} new`} />
            <SnapshotCard theme="violet" icon={Armchair} label="Seats for new admission" value={tot.seats} change={null} sub={tot.ews ? `incl. ${fmt(tot.ews)} EWS/DG reserved` : "No EWS/DG reservation"} />
            <SnapshotCard theme="green" icon={GraduationCap} label="Filled (FABS, net)" value={started ? tot.net : "—"} change={null} sub={started ? "Enrolled − new-admission withdrawals" : "Cycle not started"} />
            <SnapshotCard theme="orange" icon={DoorOpen} label="Vacancies" value={started ? vacancies : "—"} change={null} sub={started ? (overFilled.length ? `${plural(overFilled.length, unitLabel.toLowerCase())} over-filled` : `No ${unitLabel.toLowerCase()} over-filled`) : "Cycle not started"} />
            <SnapshotCard theme={!started ? "blue" : fill >= 82 ? "green" : fill >= 72 ? "orange" : "rose"} icon={Percent} label="Seat fill" value={started ? fmtPct(fill) : "—"} change={null} sub={started ? "vs 82% trajectory" : "Cycle not started"} />
            <SnapshotCard theme="rose" icon={ShieldCheck} label="EWS/DG filled" value={tot.ews ? (started ? `${tot.ewsFilled} / ${tot.ews}` : fmt(tot.ews)) : "—"} change={null} sub={tot.ews ? (started ? `${fmtPct(pct(tot.ewsFilled, tot.ews), 0)} of reserved seats` : "Reserved seats") : "No reserved seats"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="min-w-0 space-y-3 xl:col-span-3">
              <Card
                title={`${loc.name} — Seat Matrix ${cycleText(planCycle)}`}
                subtitle={started ? "Seats for new admission drive seat fill %, vacancies and close-out alerts" : "Total intake = continuing + seats for new admission"}
                bodyClass="p-0"
                actions={changeCount > 0 ? <Badge tone="amber">{plural(changeCount, "unsaved change")}</Badge> : undefined}
              >
                <div className="overflow-x-auto scroll-thin">
                  <table className={clsx("w-full text-sm", started ? "min-w-[880px]" : "min-w-[560px]")}>
                    <colgroup>
                      <col className={started ? "w-[15%]" : "w-[28%]"} />
                      <col className={started ? "w-[11%]" : "w-[18%]"} />
                      <col className={started ? "w-[12%]" : "w-[18%]"} />
                      <col className={started ? "w-[11%]" : "w-[18%]"} />
                      <col className={started ? "w-[10%]" : "w-[18%]"} />
                      {started && (
                        <>
                          <col className="w-[9%]" />
                          <col className="w-[8%]" />
                          <col className="w-[24%]" />
                        </>
                      )}
                      {canEditRows && <col className="w-24" />}
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2} className={clsx(thLeft, "border-b border-slate-200 bg-slate-50 align-bottom")}>{unitLabel}</th>
                        <th colSpan={4} className={clsx(groupHead, "border-l border-slate-200 bg-brand-50/60 text-left text-brand-700")}>
                          Seat Matrix{editable && <span className="ml-1.5 font-medium normal-case tracking-normal text-brand-600/80">· editable</span>}
                        </th>
                        {started && <th colSpan={3} className={clsx(groupHead, "border-l border-slate-200 bg-slate-50 text-left text-slate-500")}>Admissions so far (FABS)</th>}
                        {canEditRows && <th rowSpan={2} className={clsx(thBase, "border-b border-l border-slate-200 bg-slate-50 text-center align-bottom")}><span className="sr-only">Row actions</span></th>}
                      </tr>
                      <tr className="border-b border-slate-200">
                        <th className={clsx(th, "border-l border-slate-200 bg-brand-50/30")}>Continuing</th>
                        <th className={clsx(th, "bg-brand-50/30")}>Seats for new adm.</th>
                        <th className={clsx(th, "bg-brand-50/30")}>EWS/DG reserved</th>
                        <th className={clsx(th, "bg-brand-50/30")} title="Continuing + seats for new admission">Total intake</th>
                        {started && (
                          <>
                            <th className={clsx(th, "border-l border-slate-200 bg-slate-50")}>Filled</th>
                            <th className={clsx(th, "bg-slate-50")}>Vacancy</th>
                            <th className={clsx(thLeft, "bg-slate-50")}>Seat fill</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allRows.map((r) => {
                        const pend = pendingFor(r.unit);
                        const vac = r.seats - r.net;
                        if (r.gone)
                          return (
                            <tr key={r.unit} className="bg-rose-50/50 text-slate-400">
                              <td className="whitespace-nowrap border-l-2 border-l-rose-400 px-3 py-2 font-medium">
                                <span className="line-through decoration-rose-300">{r.unit.replace(/ – Y1$/, "")}</span>
                                <span className="ml-2 text-[11px] font-normal text-rose-600">removed — not saved yet</span>
                              </td>
                              <td colSpan={4} className={clsx(td, "border-l border-slate-100 py-2 line-through decoration-slate-300")}>{fmt(r.seats)} seats</td>
                              <td className="border-l border-slate-100 px-2 py-1 text-center">
                                <Button size="sm" variant="ghost" onClick={() => restoreRow(r.unit)} title={`Keep ${r.unit}`}><RotateCcw size={12} /> Undo</Button>
                              </td>
                            </tr>
                          );
                        const edited = !!edits[r.unit] || r.isNew;
                        return (
                          <tr
                            key={r.unit}
                            className={clsx(
                              "transition-colors",
                              r.ewsOver ? "bg-rose-50/60" : edited ? "bg-amber-50/50" : !r.seats ? "bg-slate-50/60" : "hover:bg-slate-50/70",
                            )}
                          >
                            <td className={clsx("whitespace-nowrap border-l-2 px-3 font-medium text-slate-800", editable ? "py-1" : "py-2", r.ewsOver ? "border-l-rose-400" : edited ? "border-l-amber-400" : "border-l-transparent")}>
                              <span className="inline-flex items-center gap-1.5">
                                {r.unit.replace(/ – Y1$/, "")}
                                {r.isNew && <Badge tone="blue" className="!px-1.5 !py-0 text-[10px]">New</Badge>}
                                {r.ewsOver && <span className="text-rose-600" title={`EWS/DG reserved (${r.ews}) is more than seats (${r.seats})`}><AlertTriangle size={13} /></span>}
                                {pend.length > 0 && <Badge tone="amber" className="!px-1.5 !py-0 text-[10px]"><Clock size={10} /> {pend.length} pending</Badge>}
                                {!r.seats && !edited && <span className="text-[11px] font-normal text-slate-400">not filled in</span>}
                              </span>
                            </td>
                            <td className={clsx(td, "border-l border-slate-100", !editable && "py-2")}>{cell(r, "continuing")}</td>
                            <td className={clsx(td, "font-semibold text-slate-900", !editable && "py-2")}>{cell(r, "seats")}</td>
                            <td className={clsx(td, !editable && "py-2")}>{cell(r, "ewsSeats")}</td>
                            <td className={clsx(td, edited ? "font-semibold text-slate-900" : "text-slate-500", !editable && "py-2")}>{fmt(r.intake)}</td>
                            {started && (
                              <>
                                <td className={clsx(td, "border-l border-slate-100")}>{fmt(r.net)}</td>
                                <td className={clsx(td, vac <= 0 ? "text-slate-400" : "text-slate-700")}>{vac > 0 ? fmt(vac) : "0"}</td>
                                <td className="px-3 py-1.5"><FillCell net={r.net} seats={r.seats} /></td>
                              </>
                            )}
                            {canEditRows && (
                              <td className="border-l border-slate-100 px-2 py-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeRow(r.unit)}
                                  disabled={units.length <= 1}
                                  aria-label={`Remove ${r.unit}`}
                                  title={units.length <= 1 ? `Keep at least one ${unitLabel.toLowerCase()} — or delete the matrix` : `Remove ${r.unit} from this cycle's matrix`}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {canEditRows && addable.length > 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2">
                            <AddRow options={addable} unitLabel={unitLabel} onAdd={addRow} />
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                        <td className="px-3 py-2.5">Total</td>
                        <td className={clsx(td, "border-l border-slate-200 py-2.5")}>{fmt(tot.continuing)}</td>
                        <td className={clsx(td, "py-2.5")}>{fmt(tot.seats)}</td>
                        <td className={clsx(td, "py-2.5")}>{tot.ews ? fmt(tot.ews) : "—"}</td>
                        <td className={clsx(td, "py-2.5")}>{fmt(tot.intake)}</td>
                        {started && (
                          <>
                            <td className={clsx(td, "border-l border-slate-200 py-2.5")}>{fmt(tot.net)}</td>
                            <td className={clsx(td, "py-2.5")}>{fmt(vacancies)}</td>
                            <td className="px-3 py-2.5"><FillCell net={tot.net} seats={tot.seats} /></td>
                          </>
                        )}
                        {canEditRows && <td className="border-l border-slate-200" />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex flex-col gap-1.5 border-t border-slate-200 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    {invalid.length > 0 && (
                      <p className="font-medium text-rose-700"><AlertTriangle size={12} className="mr-1 inline" />EWS/DG reserved is more than seats for new admission in {invalid.map((r) => r.unit).join(", ")}. Fix before saving.</p>
                    )}
                    {editable && empty.length > 0 && (
                      <p className="text-slate-500">{plural(empty.length, unitLabel.toLowerCase())} with no seats for new admission — leave at 0 if not admitting this cycle.</p>
                    )}
                    {!invalid.length && !(editable && empty.length) && <p className="text-slate-400">{plural(rows.length, unitLabel.toLowerCase())} · figures in seats</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    {editable && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-sm bg-amber-400" /> Edited, not saved</span>}
                    {editable && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-sm bg-rose-400" /> {canEditRows ? "Removed / needs fixing" : "Needs fixing"}</span>}
                    {started && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-violet-500" /> Over-filled</span>}
                  </div>
                </div>
              </Card>
              {started && <Note tone="warn">Open item #2: if FABS already holds intake data, intake and continuing will be read from FABS instead of entered here.</Note>}
            </div>

            <div className="flex flex-col gap-4">
              {(started || cycleRequests.length > 0) && (
                <Card
                  title="Change requests"
                  subtitle={pending.length ? `${pending.length} awaiting Vertical Head approval` : "Location Head requests · Vertical Head approves"}
                  bodyClass={cycleRequests.length ? "p-0" : undefined}
                >
                  {!cycleRequests.length && <p className="text-sm text-slate-500">No change requests for this cycle.</p>}
                  <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto scroll-thin">
                    {cycleRequests.map((r) => {
                      const delta = r.to - r.from;
                      return (
                        <li key={r.id} className={clsx("px-4 py-3 text-sm", r.locId === loc.id && r.status === "pending" && "bg-amber-50/40")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{r.unit.replace(/ – Y1$/, "")} <span className="font-normal text-slate-400">· {r.location}</span></p>
                              <p className="text-xs text-slate-500">{FIELD_LABEL[r.field]}</p>
                            </div>
                            <Badge tone={r.status === "pending" ? "amber" : r.status === "approved" ? "green" : "red"} className="capitalize">{r.status}</Badge>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 text-sm tabular">
                            <span className="text-slate-400 line-through decoration-slate-300">{r.from}</span>
                            <span className="text-slate-400">→</span>
                            <b className="text-slate-900">{r.to}</b>
                            {delta !== 0 && (
                              <span className={clsx("rounded px-1.5 py-px text-[11px] font-semibold", delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                                {delta > 0 ? "+" : "−"}{Math.abs(delta)}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">by {r.by}</p>
                          {r.status === "pending" && can("seat.approve") && (
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              <Button size="sm" variant="primary" onClick={() => approve(r, true)}><Check size={12} /> Approve</Button>
                              <Button size="sm" variant="danger" onClick={() => approve(r, false)}><X size={12} /> Reject</Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
              {!started && <SetupProgress cycle={planCycle} />}
              <HistoryCard className="flex-1" history={history} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Adds a grade / programme offered at this location (from Masters) that is not in the matrix yet. */
function AddRow({ options, unitLabel, onAdd }: { options: string[]; unitLabel: string; onAdd: (u: string) => void }) {
  const [pick, setPick] = useState(options[0]);
  const value = options.includes(pick) ? pick : options[0];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="text-slate-500" htmlFor="seat-add-row">Add {unitLabel.toLowerCase()}</label>
      <select
        id="seat-add-row"
        value={value}
        onChange={(e) => setPick(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((u) => <option key={u} value={u}>{u.replace(/ – Y1$/, "")}</option>)}
      </select>
      <Button size="sm" onClick={() => onAdd(value)}><Plus size={13} /> Add row</Button>
      <span className="text-slate-400">Only {unitLabel.toLowerCase()}s set up for this location in Masters can be added.</span>
    </div>
  );
}

function UploadReport({ parsed, file, loaded }: { parsed: ParsedUpload; file: string; loaded?: number }) {
  const bad = parsed.errors.length > 0 || !parsed.matched;
  return (
    <div className="space-y-0.5">
      <p className="font-medium">
        {bad ? `Could not load ${file}.` : `Loaded ${file}: ${plural(parsed.matched, "row")} read, ${plural(loaded ?? 0, "row")} differ from the current matrix. Review the highlighted cells, then save.`}
      </p>
      {parsed.errors.slice(0, 4).map((e) => <p key={e}>• {e}</p>)}
      {parsed.errors.length > 4 && <p>• and {parsed.errors.length - 4} more</p>}
      {!parsed.errors.length && !parsed.matched && <p>• No row matched a grade / programme at this location.</p>}
      {parsed.unknown.length > 0 && <p>• Ignored rows not offered here: {parsed.unknown.slice(0, 6).join(", ")}{parsed.unknown.length > 6 ? "…" : ""}</p>}
      {!bad && parsed.missing.length > 0 && <p>• Not in the file (left unchanged): {parsed.missing.join(", ")}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

function CreateMatrix({ loc, cycle, canCreate, onCreate }: { loc: Location; cycle: PlanCycle; canCreate: boolean; onCreate: (rows: Record<string, SeatValues>, m: CreateMethod) => void }) {
  const { seatStore } = useApp();
  const [method, setMethod] = useState<Exclude<CreateMethod, "mock">>("copy");
  const [adjust, setAdjust] = useState(0);
  const [upload, setUpload] = useState<{ file: string; parsed: ParsedUpload } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const unitLabel = loc.vertical === "Schools" ? "grade" : "programme";
  const prev = matrixOf(seatStore, LIVE_PLAN_CYCLE, loc.id).rows;

  const rows: Record<string, SeatValues> | null = useMemo(() => {
    if (method === "blank") return Object.fromEntries(loc.units.map((u) => [u, blankValues()]));
    if (method === "copy")
      return Object.fromEntries(
        loc.units.map((u) => {
          const p = prev[u] ?? blankValues();
          const seats = Math.max(0, Math.round(p.seats * (1 + adjust / 100)));
          return [u, withIntake({ continuing: p.continuing, seats, ewsSeats: Math.min(seats, Math.round(p.ewsSeats * (1 + adjust / 100))) })];
        }),
      );
    if (!upload || upload.parsed.errors.length || !upload.parsed.matched) return null;
    return Object.fromEntries(loc.units.map((u) => [u, upload.parsed.rows[u] ?? blankValues()]));
  }, [method, adjust, upload, loc, prev]);

  const sum = (f: SeatField) => (rows ? Object.values(rows).reduce((s, r) => s + r[f], 0) : 0);
  const prevSeats = Object.values(prev).reduce((s, r) => s + r.seats, 0);

  if (!canCreate)
    return (
      <Card title={`${loc.name} — Seat Matrix ${cycleText(cycle)}`}>
        <EmptyState>
          <FilePlus2 className="mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-700">Not created yet</p>
          <p className="mt-1">The Location Head or Central Admin sets up the {cycleText(cycle)} Seat Matrix. It will appear here once created.</p>
        </EmptyState>
      </Card>
    );

  const options: { id: Exclude<CreateMethod, "mock">; icon: typeof Copy; title: string; text: string }[] = [
    { id: "copy", icon: Copy, title: `Copy ${cycleText(LIVE_PLAN_CYCLE)}`, text: `Start from this year's ${fmt(prevSeats)} seats, optionally scaled up or down` },
    { id: "blank", icon: FilePlus2, title: "Start blank", text: `Every ${unitLabel} at 0 — type the figures in` },
    { id: "upload", icon: FileSpreadsheet, title: "Upload a CSV", text: "Fill in the template in Excel and upload it" },
  ];

  return (
    <Card title={`Create the ${cycleText(cycle)} Seat Matrix — ${loc.short}`} subtitle={`No Seat Matrix exists for this cycle yet · ${plural(loc.units.length, unitLabel)} offered`}>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setMethod(o.id)}
            aria-pressed={method === o.id}
            className={clsx(
              "flex items-start gap-3 rounded-xl border p-3 text-left transition",
              method === o.id ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <span className={clsx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", method === o.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>
              <o.icon size={16} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">{o.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{o.text}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        {method === "copy" && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label htmlFor="adj" className="text-slate-600">Change seats for new admission by</label>
            <div className="flex items-center gap-1">
              <input
                id="adj"
                type="number"
                value={adjust}
                min={-50}
                max={100}
                onChange={(e) => setAdjust(Math.max(-50, Math.min(100, Number(e.target.value) || 0)))}
                className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right tabular outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="text-slate-500">%</span>
            </div>
            {[-10, 0, 5, 10].map((p) => (
              <button key={p} type="button" onClick={() => setAdjust(p)} className={clsx("rounded-full border px-2.5 py-0.5 text-xs", adjust === p ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                {p > 0 ? `+${p}` : p}%
              </button>
            ))}
            <span className="text-xs text-slate-500">Continuing students are copied as-is; you can edit every row after creating.</span>
          </div>
        )}
        {method === "blank" && <p className="text-sm text-slate-600">Creates the matrix with every {unitLabel} at 0. You then type continuing, seats and EWS/DG figures for each row and save.</p>}
        {method === "upload" && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => downloadCsv(`seat-matrix-template-${loc.id}-${cycle}`, templateRows(loc.units, {}))}><Download size={13} /> Download template</Button>
              <Button size="sm" variant="primary" onClick={() => fileRef.current?.click()}><Upload size={13} /> Choose file</Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.txt"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) setUpload({ file: f.name, parsed: parseSeatCsv(await f.text(), loc.units) });
                }}
              />
              {upload && <span className="text-xs text-slate-500">{upload.file}</span>}
            </div>
            <p className="text-xs text-slate-500">Columns: {unitLabel === "grade" ? "Grade" : "Programme"}, Continuing, Seats for new admission, EWS/DG reserved. Save from Excel as CSV.</p>
            {upload && (
              <Note tone={upload.parsed.errors.length || !upload.parsed.matched || upload.parsed.missing.length ? "warn" : "info"}>
                {upload.parsed.errors.length || !upload.parsed.matched ? (
                  <UploadReport parsed={upload.parsed} file={upload.file} />
                ) : (
                  <div className="space-y-0.5">
                    <p className="font-medium">{plural(upload.parsed.matched, "row")} read from {upload.file}.</p>
                    {upload.parsed.missing.length > 0 && <p>• Not in the file (will start at 0): {upload.parsed.missing.join(", ")}</p>}
                    {upload.parsed.unknown.length > 0 && <p>• Ignored rows not offered here: {upload.parsed.unknown.join(", ")}</p>}
                  </div>
                )}
              </Note>
            )}
          </div>
        )}
      </div>

      {rows && method !== "blank" && (
        <div className="mt-4 overflow-x-auto scroll-thin rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className={thLeft}>{unitLabel === "grade" ? "Grade" : "Programme"}</th>
                <th className={th}>Continuing</th>
                <th className={th}>Seats for new adm.</th>
                {method === "copy" && <th className={th}>{cycleText(LIVE_PLAN_CYCLE)} seats</th>}
                <th className={th}>EWS/DG</th>
                <th className={th}>Total intake</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loc.units.map((u) => (
                <tr key={u}>
                  <td className="px-3 py-1 font-medium">{u.replace(/ – Y1$/, "")}</td>
                  <td className={td}>{fmt(rows[u].continuing)}</td>
                  <td className={clsx(td, "font-semibold")}>{fmt(rows[u].seats)}</td>
                  {method === "copy" && <td className={clsx(td, "text-slate-400")}>{fmt(prev[u]?.seats ?? 0)}</td>}
                  <td className={td}>{rows[u].ewsSeats ? fmt(rows[u].ewsSeats) : <span className="text-slate-300">—</span>}</td>
                  <td className={td}>{fmt(rows[u].intake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          {rows ? (
            <>
              <b className="tabular text-slate-900">{fmt(sum("seats"))}</b> seats for new admission · <b className="tabular text-slate-900">{fmt(sum("intake"))}</b> total intake
              {method === "copy" && prevSeats > 0 && sum("seats") !== prevSeats && (
                <span className={clsx("ml-2 text-xs", sum("seats") > prevSeats ? "text-emerald-700" : "text-rose-600")}>
                  ({sum("seats") > prevSeats ? "+" : "−"}{fmt(Math.abs(sum("seats") - prevSeats))} vs {cycleText(LIVE_PLAN_CYCLE)})
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">Choose a filled-in CSV to continue.</span>
          )}
        </p>
        <Button variant="primary" disabled={!rows} onClick={() => rows && onCreate(rows, method)}>
          <FilePlus2 size={14} /> Create Seat Matrix
        </Button>
      </div>
    </Card>
  );
}

/** Which locations have a matrix for a setup cycle (Central Admin / Vertical Head see several). */
function SetupProgress({ cycle }: { cycle: PlanCycle }) {
  const { allowedLocations, seatStore, school, setLocationId } = useApp();
  const loc = useCurrentLocation();
  if (allowedLocations.length < 2) return null;
  const list = allowedLocations.map((l) => ({ l, done: matrixOf(seatStore, cycle, l.id).exists }));
  const done = list.filter((x) => x.done).length;
  return (
    <Card title={`${cycleText(cycle)} setup`} subtitle={`${done} of ${list.length} locations have a Seat Matrix`}>
      <ProgressBar value={done} max={list.length} tone={done === list.length ? "bg-emerald-500" : "bg-brand-500"} />
      <ul className="mt-3 space-y-0.5">
        {list.map(({ l, done: d }) => (
          <li key={l.id}>
            <button
              type="button"
              disabled={school !== "all"}
              onClick={() => setLocationId(l.id)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm enabled:hover:bg-slate-50",
                l.id === loc.id && "bg-brand-50/70 font-medium",
              )}
            >
              {d ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-slate-300" />}
              <span className="flex-1 truncate">{l.short}</span>
              <span className={clsx("text-[11px]", d ? "text-emerald-700" : "text-slate-400")}>{d ? "Created" : "Not started"}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HistoryCard({ history, className }: { history: HistoryEntry[]; className?: string }) {
  return (
    <Card className={className} title="Change history" subtitle="Who, when, old → new" actions={<History size={14} className="text-slate-400" />} bodyClass={history.length ? "p-0" : undefined}>
      {!history.length ? (
        <p className="text-sm text-slate-500">No changes saved in the dashboard yet.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto scroll-thin">
          {history.slice(0, 20).map((h) => (
            <li key={h.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{h.summary}</span>
                <Badge tone={h.action === "created" ? "blue" : h.action === "approved" ? "green" : h.action === "deleted" ? "red" : "slate"}>{h.action}</Badge>
              </div>
              {h.changes.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {h.changes.filter((c) => c.field !== "intake").slice(0, 3).map((c, i) => (
                    <li key={i}>
                      {c.unit.replace(/ – Y1$/, "")} · {FIELD_LABEL[c.field]}: <span className="tabular">{c.from} → <b>{c.to}</b></span>
                    </li>
                  ))}
                  {h.changes.filter((c) => c.field !== "intake").length > 3 && <li className="text-slate-400">+{h.changes.filter((c) => c.field !== "intake").length - 3} more</li>}
                </ul>
              )}
              <div className="mt-0.5 text-[11px] text-slate-400">{h.who} · {h.at}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

function Targets() {
  const { can, cycle, seatVersion } = useApp();
  const loc = useCurrentLocation();
  const canEdit = can("targets.edit");
  const units = useMemo(() => locationUnits(loc.id, cycle), [loc.id, cycle, seatVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const entry = useEntryStore();
  const [targets, setTargets] = useState<Record<string, number>>({});
  const unitLabel = loc.vertical === "Schools" ? "Grade" : "Programme";
  const tgt = (u: UnitStats) => targets[u.unit] ?? u.target;
  const total = units.reduce((s, u) => s + tgt(u), 0);
  const enrolled = units.reduce((s, u) => s + u.enrolled, 0);
  const seats = units.reduce((s, u) => s + u.seats, 0);
  const behind = units.filter((u) => pct(u.enrolled, tgt(u)) < 80).sort((a, b) => pct(a.enrolled, tgt(a)) - pct(b.enrolled, tgt(b)));
  const changed = units.filter((u) => targets[u.unit] !== undefined && targets[u.unit] !== u.target).length;
  const saveTargets = () => {
    const list = units.filter((u) => targets[u.unit] !== undefined && targets[u.unit] !== u.target);
    if (list.length) {
      entry.commitStore("Target", "Updated", `${loc.short} · ${list.length} target${list.length === 1 ? "" : "s"}`, list.map((u) => `${u.unit} ${u.target} → ${targets[u.unit]}`).join(", "), (s) => {
        const next = { ...s.targets };
        for (const u of list) {
          const key = targetKey(cycle, loc.id, u.unit);
          if (targets[u.unit] === defaultTarget(loc.id, u.unit, cycle)) delete next[key];
          else next[key] = targets[u.unit];
        }
        return { ...s, targets: next };
      });
    }
    setTargets({});
  };

  return (
    <>
      <Toolbar
        actions={
          canEdit && changed > 0 ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setTargets({})}>Discard</Button>
              <Button size="sm" variant="primary" onClick={saveTargets}><Check size={13} /> Save {changed} target{changed === 1 ? "" : "s"}</Button>
            </>
          ) : undefined
        }
      >
        <LocationPicker />
        <span className="text-xs text-slate-500">Cycle {cycle.replace("-", "–")} · set by the Vertical Admissions Head · achievement uses FABS-enrolled</span>
      </Toolbar>

      <div className="mb-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))]">
        <SnapshotCard theme="blue" icon={Target} label="Total target" value={total} change={null} sub={`${fmtPct(pct(total, seats), 0)} of ${fmt(seats)} seats for new admission`} />
        <SnapshotCard theme="violet" icon={GraduationCap} label="FABS enrolled" value={enrolled} change={null} sub="Fee paid, admission no. generated" />
        <SnapshotCard
          theme={enrolled >= total ? "green" : "orange"}
          icon={enrolled >= total ? TrendingUp : TrendingDown}
          label="Gap to target"
          value={enrolled - total >= 0 ? `+${fmt(enrolled - total)}` : `−${fmt(total - enrolled)}`}
          change={null}
          sub={enrolled >= total ? "Target met" : "Admissions still needed"}
        />
        <SnapshotCard theme={pct(enrolled, total) >= 95 ? "green" : pct(enrolled, total) >= 80 ? "orange" : "rose"} icon={Percent} label="Achievement" value={fmtPct(pct(enrolled, total))} change={null} sub="FABS enrolled ÷ target" />
        <SnapshotCard theme={behind.length ? "rose" : "green"} icon={AlertTriangle} label="Behind target" value={behind.length} change={null} sub={`${unitLabel.toLowerCase()}${behind.length === 1 ? "" : "s"} below 80% achievement`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card
          className="xl:col-span-3"
          title={`${loc.name} — admission targets`}
          subtitle="Target per grade/programme vs FABS-enrolled"
          bodyClass="p-0"
          actions={canEdit ? <Badge tone="blue">Editable</Badge> : <Badge><Lock size={11} /> View only</Badge>}
        >
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={thLeft}>{unitLabel}</th>
                  <th className={th}>Seats for new adm.</th>
                  <th className={th}>Target</th>
                  <th className={th}>FABS enrolled</th>
                  <th className={th}>Gap to target</th>
                  <th className={thLeft}>Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => {
                  const t = tgt(u);
                  const ach = pct(u.enrolled, t);
                  const gap = u.enrolled - t;
                  return (
                    <tr key={u.unit}>
                      <td className="px-3 py-1.5 font-medium">{u.unit}</td>
                      <td className={clsx(td, "text-slate-500")}>{u.seats}</td>
                      <td className={td}>
                        {canEdit ? (
                          <input
                            type="number"
                            value={t}
                            onChange={(e) => setTargets((x) => ({ ...x, [u.unit]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                            title={targets[u.unit] !== undefined ? `Was ${u.target}` : undefined}
                            className={clsx(
                              "w-20 rounded-md border px-2 py-1 text-right text-sm tabular outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                              targets[u.unit] !== undefined ? "border-amber-300 bg-amber-50" : "border-slate-200",
                            )}
                          />
                        ) : (
                          <span className="font-semibold">{t}</span>
                        )}
                      </td>
                      <td className={td}>{u.enrolled}</td>
                      <td className={clsx(td, gap >= 0 ? "text-emerald-700" : "text-rose-600")}>{gap >= 0 ? `+${gap}` : `−${-gap}`}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-28"><ProgressBar value={Math.min(ach, 100)} tone={ach >= 95 ? "bg-emerald-500" : ach >= 80 ? "bg-amber-400" : "bg-rose-500"} /></div>
                          <span className={clsx("w-11 text-right tabular", ach < 80 ? "font-semibold text-rose-600" : "text-slate-700")}>{ach.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className={td}>{fmt(seats)}</td>
                  <td className={td}>{fmt(total)}</td>
                  <td className={td}>{fmt(enrolled)}</td>
                  <td className={clsx(td, enrolled - total >= 0 ? "text-emerald-700" : "text-rose-600")}>{enrolled - total >= 0 ? `+${enrolled - total}` : `−${total - enrolled}`}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-28"><ProgressBar value={Math.min(pct(enrolled, total), 100)} /></div>
                      <span className="w-11 text-right tabular">{pct(enrolled, total).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex-1" title="Behind target" subtitle="Below 80% achievement">
            {behind.length ? (
              <ul className="space-y-2">
                {behind.map((u) => (
                  <li key={u.unit} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{u.unit}</span>
                    <span className="tabular text-rose-600">
                      {u.enrolled} / {tgt(u)} <span className="ml-1 text-xs">({pct(u.enrolled, tgt(u)).toFixed(0)}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Every {unitLabel.toLowerCase()} is at 80% or more of target.</p>
            )}
          </Card>

          {loc.vertical === "Higher Ed" && <Note tone="warn">Open item #4: Higher Ed target structure (per programme or per batch) to be confirmed.</Note>}
        </div>
      </div>
      <EntryToast text={entry.toast} onClose={entry.clearToast} />
    </>
  );
}
