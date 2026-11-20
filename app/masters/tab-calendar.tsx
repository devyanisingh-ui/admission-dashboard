"use client";

import clsx from "clsx";
import { AlertTriangle, Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Drawer } from "@/components/drawer";
import { Dropdown } from "@/components/dropdown";
import { ConfirmDialog, RowActions } from "@/components/master-kit";
import { Badge, Button, Card, Note } from "@/components/ui";
import { useApp } from "@/lib/context";
import { CURRENT_CYCLE, cyclePhase, DATA_TODAY, isOpenPhase, type CyclePhase } from "@/lib/data";
import { describeChanges, type CycleRec } from "@/lib/masters";
import { EditBadge, type TabProps } from "./shared";

/* ------------------------------------------------------------------ */
/* Cycle calendar                                                      */
/* ------------------------------------------------------------------ */

type CycleRow = CycleRec;
const TODAY = DATA_TODAY;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parse = (s: string) => new Date(s);
const DAY = 86_400_000;
const STRIPES = "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,.45)_6px_12px)]";
const PHASE_TONE: Record<CyclePhase, "green" | "blue" | "amber" | "slate" | "violet"> = {
  "Open · Seat Matrix setup": "blue", Open: "green", Upcoming: "violet", Draft: "amber", Closed: "slate",
};
const BAR: Record<CyclePhase, string> = {
  "Open · Seat Matrix setup": "bg-brand-500", Open: "bg-emerald-500", Upcoming: `bg-violet-300 ${STRIPES}`, Draft: `bg-amber-300 ${STRIPES}`, Closed: "bg-slate-300",
};
const PHASE_HELP: Record<CyclePhase, string> = {
  "Open · Seat Matrix setup": "Taking admissions; the Seat Matrix can still be edited directly until the lock date",
  Open: "Taking admissions; the Seat Matrix is locked and changes need Vertical Head approval",
  Upcoming: "Published; opens for admissions on its start date",
  Draft: "Not published yet, so not shown in session pickers",
  Closed: "The admission window has ended",
};
const toIso = (s: string) => {
  const d = parse(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MON[m - 1]} ${y}`;
};
const inDays = (d: Date) => Math.round((+d - +TODAY) / DAY);
const relative = (d: Date) => {
  const n = inDays(d);
  if (n === 0) return "today";
  if (n > 0) return n < 60 ? `in ${n} days` : `in ${Math.round(n / 30)} months`;
  return -n < 60 ? `${-n} days ago` : `${Math.round(-n / 30)} months ago`;
};

export function CalendarTab({ store, commit }: TabProps) {
  const { can } = useApp();
  const canEdit = can("calendar.edit");
  const rows = store.cycles;
  const [editing, setEditing] = useState<{ row: CycleRow | null; key: string } | null>(null);
  const [deleting, setDeleting] = useState<CycleRow | null>(null);
  const label = (c: CycleRow) => `${c.vertical} ${c.cycle.replace("-", "–")}`;

  // Shared time axis, padded to whole quarters either side.
  const minD = new Date(Math.min(...rows.map((r) => +parse(r.opens))));
  const maxD = new Date(Math.max(...rows.map((r) => +parse(r.closes)), +TODAY));
  const start = new Date(minD.getFullYear(), Math.floor(minD.getMonth() / 3) * 3, 1);
  const end = new Date(maxD.getFullYear(), Math.floor(maxD.getMonth() / 3) * 3 + 3, 1);
  const x = (d: Date) => ((+d - +start) / (+end - +start)) * 100;
  const quarters: Date[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 3, 1)) quarters.push(d);

  // Next key dates across every cycle.
  const upcoming = rows
    .flatMap((r) => [
      { r, what: "opens", date: parse(r.opens) },
      { r, what: "Seat Matrix locks", date: parse(r.seatLock) },
      { r, what: "closes", date: parse(r.closes) },
    ])
    .filter((e) => +e.date >= +TODAY)
    .sort((a, b) => +a.date - +b.date)
    .slice(0, 4);

  const save = (next: CycleRow, before: CycleRow | null) => {
    const rec = { ...next, id: `${next.vertical}|${next.cycle}` };
    commit((s) => ({ ...s, cycles: before ? s.cycles.map((c) => (c.id === before.id ? rec : c)) : [...s.cycles, rec] }), {
      master: "Cycle", action: before ? "Updated" : "Created", record: label(rec),
      detail: before
        ? describeChanges(before, rec, { opens: "Opens", seatLock: "Seat Matrix lock", closes: "Closes", fabsYear: "FABS year", draft: "Draft" })
        : `${rec.opens} → ${rec.closes} · lock ${rec.seatLock}${rec.draft ? " · draft" : ""}`,
    });
    setEditing(null);
  };
  const remove = (c: CycleRow) =>
    commit((s) => ({ ...s, cycles: s.cycles.filter((x) => x.id !== c.id) }), { master: "Cycle", action: "Deleted", record: label(c), detail: "Draft cycle removed" });

  return (
    <>
      {upcoming.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {upcoming.map((e, i) => (
            <div key={i} className={clsx("rounded-xl border bg-white px-4 py-3", i === 0 ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{i === 0 ? "Next key date" : "Coming up"}</span>
                <span className={clsx("text-xs font-semibold", inDays(e.date) <= 30 ? "text-amber-700" : "text-slate-500")}>{relative(e.date)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {e.r.vertical} {e.r.cycle.replace("-", "–")} {e.what}
              </p>
              <p className="text-xs text-slate-500">{e.date.toLocaleDateString("en-GB", { weekday: "short" })}, {fromIso(toIso(e.r[e.what === "opens" ? "opens" : e.what === "closes" ? "closes" : "seatLock"]))}</p>
            </div>
          ))}
        </div>
      )}

      <Card
        title="Admission cycle calendar"
        subtitle="Cycle = academic year sought (from LeadSquared / SaaS) · FABS records use the FABS academic year · the Seat Matrix locks on the lock date"
        bodyClass="p-0"
        actions={canEdit ? <Button size="sm" variant="primary" onClick={() => setEditing({ row: null, key: "new" })}><Plus size={13} /> New cycle</Button> : <EditBadge editable={false} />}
      >
        <div className="relative overflow-x-auto scroll-thin">
          <div className="min-w-[980px]">
            {/* Axis */}
            <div className="grid grid-cols-[230px_minmax(0,1fr)_150px] border-b border-slate-200 bg-slate-50/70">
              <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Cycle</div>
              <div className="relative h-9">
                {quarters.map((q) => (
                  <div key={+q} className="absolute inset-y-0" style={{ left: `${x(q)}%` }}>
                    <div className={clsx("h-full border-l", q.getMonth() === 0 ? "border-slate-300" : "border-slate-200")} />
                    <span className={clsx("absolute left-1.5 whitespace-nowrap text-[10px]", q.getMonth() === 0 ? "top-1 font-semibold text-slate-700" : "top-1 text-slate-400")}>
                      {q.getMonth() === 0 ? q.getFullYear() : MON[q.getMonth()]}
                    </span>
                  </div>
                ))}
                <div className="absolute bottom-0 z-10 -translate-x-1/2 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-semibold text-white" style={{ left: `${x(TODAY)}%` }}>
                  Today
                </div>
              </div>
              <div />
            </div>

            {(["Schools", "Higher Ed"] as const).map((v) => {
              const list = rows.filter((r) => r.vertical === v).sort((a, b) => b.cycle.localeCompare(a.cycle));
              if (!list.length) return null;
              return (
                <div key={v}>
                  <div className="grid grid-cols-[230px_minmax(0,1fr)_150px] border-b border-slate-100 bg-white">
                    <div className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-brand-900">{v}</div>
                    <div className="relative">
                      <div className="absolute inset-y-0 w-px bg-rose-500/70" style={{ left: `${x(TODAY)}%` }} />
                    </div>
                    <div />
                  </div>
                  {list.map((c) => {
                    const o = parse(c.opens), l = parse(c.seatLock), e = parse(c.closes);
                    const phase = cyclePhase(c);
                    const live = isOpenPhase(phase);
                    const progress = live ? Math.round(((+TODAY - +o) / (+e - +o)) * 100) : null;
                    const reporting = c.cycle === CURRENT_CYCLE;
                    return (
                      <div key={c.vertical + c.cycle} className="group grid grid-cols-[230px_minmax(0,1fr)_150px] items-center border-b border-slate-100 hover:bg-slate-50/60">
                        <div className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900">{c.cycle.replace("-", "–")}</span>
                            <span title={PHASE_HELP[phase]}><Badge tone={PHASE_TONE[phase]}>{phase}</Badge></span>
                          </div>
                          {(reporting || c.backfilled) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {reporting && (
                                <span className="rounded-full border border-brand-200 bg-white px-1.5 py-px text-[10px] font-semibold text-brand-700" title="The dashboard's figures are for this session">
                                  Reporting cycle
                                </span>
                              )}
                              {c.backfilled && <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">Backfilled</span>}
                            </div>
                          )}
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {c.opens} → {c.closes}
                          </p>
                          <p className="text-[11px] text-slate-400">FABS year {c.fabsYear.replace("-", "–")}{progress !== null && <> · {progress}% elapsed</>}</p>
                        </div>
                        <div className="relative h-14">
                          {quarters.map((q) => (
                            <div key={+q} className={clsx("absolute inset-y-0 border-l", q.getMonth() === 0 ? "border-slate-200" : "border-slate-100")} style={{ left: `${x(q)}%` }} />
                          ))}
                          <div className="absolute inset-y-0 z-10 w-px bg-rose-500/70" style={{ left: `${x(TODAY)}%` }} />
                          <div
                            className={clsx("absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-md shadow-sm", BAR[phase])}
                            style={{ left: `${x(o)}%`, width: `${x(e) - x(o)}%` }}
                            title={`${c.vertical} ${c.cycle}: ${c.opens} – ${c.closes} · ${phase}`}
                          >
                            {progress !== null && <div className="h-full bg-black/10" style={{ width: `${progress}%` }} />}
                          </div>
                          {/* Seat Matrix lock */}
                          <div className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x(l)}%` }} title={`Seat Matrix locks ${c.seatLock}`}>
                            <div className="h-3 w-3 rotate-45 border-2 border-white bg-slate-800 shadow" />
                          </div>
                          <span className="absolute top-[calc(50%+12px)] z-20 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-slate-500" style={{ left: `${x(l)}%` }}>
                            Lock {c.seatLock.slice(0, 6)}
                          </span>
                        </div>
                        <div className="pr-3">
                          <RowActions
                            canEdit={canEdit} active inUse={phase !== "Draft"} label={label(c)}
                            onEdit={() => setEditing({ row: c, key: c.id })}
                            onDelete={() => setDeleting(c)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11px] text-slate-500">
          {(["Open · Seat Matrix setup", "Open", "Upcoming", "Draft", "Closed"] as const).map((ph) => (
            <span key={ph} className="flex items-center gap-1.5" title={PHASE_HELP[ph]}><span className={clsx("h-2.5 w-5 rounded", BAR[ph])} /> {ph}</span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-emerald-500"><span className="block h-full w-1/2 rounded-l bg-black/10" /></span> Elapsed so far</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-slate-800" /> Seat Matrix lock</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-rose-500" /> Today, 17 Nov 2026</span>
        </div>
      </Card>

      {editing && (
        <CycleEditor
          key={editing.key}
          row={editing.row}
          rows={rows}
          onClose={() => setEditing(null)}
          onSave={(r) => save(r, editing.row)}
        />
      )}
      {deleting && (
        <ConfirmDialog title={`Delete ${label(deleting)}?`} confirmLabel="Delete cycle" onConfirm={() => remove(deleting)} onClose={() => setDeleting(null)}>
          This draft cycle was never published, so no leads, admissions or Seat Matrix use it. Only draft cycles can be deleted.
        </ConfirmDialog>
      )}
    </>
  );
}

function CycleEditor({ row, rows, onClose, onSave }: { row: CycleRow | null; rows: CycleRow[]; onClose: () => void; onSave: (r: CycleRow) => void }) {
  // A new cycle defaults to the year after the latest Schools cycle, with the same dates moved on a year.
  const seed = useMemo<CycleRow>(() => {
    if (row) return row;
    const last = [...rows].filter((r) => r.vertical === "Schools").sort((a, b) => b.cycle.localeCompare(a.cycle))[0];
    const bump = (s: string) => { const d = parse(s); d.setFullYear(d.getFullYear() + 1); return fromIso(toIso(d.toDateString())); };
    const y = Number(last.cycle.slice(0, 4)) + 1;
    const cyc = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    return { id: "", active: true, custom: true, vertical: "Schools", cycle: cyc, fabsYear: cyc, opens: bump(last.opens), seatLock: bump(last.seatLock), closes: bump(last.closes), draft: true };
  }, [row, rows]);
  const [f, setF] = useState(seed);
  const set = <K extends keyof CycleRow>(k: K, v: CycleRow[K]) => setF((x) => ({ ...x, [k]: v }));

  const errors: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(f.cycle) || (Number(f.cycle.slice(0, 4)) + 1) % 100 !== Number(f.cycle.slice(5))) errors.push("Cycle must look like 2028-29 (consecutive years).");
  if (+parse(f.opens) >= +parse(f.seatLock)) errors.push("Seat Matrix lock must be after the cycle opens.");
  if (+parse(f.seatLock) >= +parse(f.closes)) errors.push("The cycle must close after the Seat Matrix lock.");
  const clash = rows.some((r) => r.vertical === f.vertical && r.cycle === f.cycle && r.id !== row?.id);
  if (clash) errors.push(`${f.vertical} already has a ${f.cycle} cycle.`);
  // Admission windows of one vertical must not overlap.
  const overlap = rows.find(
    (r) => r.vertical === f.vertical && !(row && r.vertical === row.vertical && r.cycle === row.cycle) && r.cycle !== f.cycle &&
      +parse(f.opens) <= +parse(r.closes) && +parse(r.opens) <= +parse(f.closes),
  );
  if (overlap) errors.push(`Dates overlap ${overlap.vertical} ${overlap.cycle.replace("-", "–")} (${overlap.opens} – ${overlap.closes}).`);
  const phase = cyclePhase(f);

  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
  const label = "mb-1 block text-xs font-medium text-slate-600";
  const days = Math.round((+parse(f.closes) - +parse(f.opens)) / DAY);

  return (
    <Drawer
      open
      onClose={onClose}
      title={row ? `Edit ${row.vertical} ${row.cycle.replace("-", "–")}` : "New admission cycle"}
      subtitle="Status follows the dates automatically · changes are audit-logged (who, when, old → new)"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={errors.length > 0} onClick={() => onSave(f)}>
            <Check size={13} /> {row ? "Save changes" : "Create cycle"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Vertical</span>
            <Dropdown<CycleRow["vertical"]> ariaLabel="Vertical" value={f.vertical} onChange={(v) => set("vertical", v)} disabled={!!row} options={[{ value: "Schools", label: "Schools" }, { value: "Higher Ed", label: "Higher Ed" }]} />
          </div>
          <div>
            <span className={label}>Publishing</span>
            <Dropdown<"draft" | "published">
              ariaLabel="Publishing"
              value={f.draft ? "draft" : "published"}
              onChange={(v) => set("draft", v === "draft")}
              options={[{ value: "draft", label: "Draft (not visible yet)" }, { value: "published", label: "Published" }]}
            />
          </div>
          <label>
            <span className={label}>Cycle (academic year sought)</span>
            <input className={field} value={f.cycle} onChange={(e) => set("cycle", e.target.value.trim())} placeholder="2028-29" disabled={!!row} />
          </label>
          <label>
            <span className={label}>FABS academic year</span>
            <input className={field} value={f.fabsYear} onChange={(e) => set("fabsYear", e.target.value.trim())} placeholder="2028-29" />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Key dates</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["opens", "Opens"], ["seatLock", "Seat Matrix lock"], ["closes", "Closes"]] as const).map(([k, l]) => (
              <label key={k}>
                <span className={label}>{l}</span>
                <input type="date" className={field} value={toIso(f[k])} onChange={(e) => e.target.value && set(k, fromIso(e.target.value))} />
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{days > 0 ? `${days} days long` : "—"} · the Seat Matrix becomes request-only after the lock date</p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="shrink-0 pt-0.5 text-slate-500">Status today:</span>
            <span><Badge tone={PHASE_TONE[phase]}>{phase}</Badge> <span className="ml-1 text-slate-500">{PHASE_HELP[phase]}</span></span>
          </div>
        </div>

        {errors.length > 0 ? (
          <div className="space-y-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errors.map((e) => <p key={e} className="flex items-start gap-1.5"><AlertTriangle size={12} className="mt-px shrink-0" /> {e}</p>)}
          </div>
        ) : (
          <Note>Publishing a cycle makes it available for Academic session and the Seat Matrix. Only draft cycles can be deleted later.</Note>
        )}
      </div>
    </Drawer>
  );
}

