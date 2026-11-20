"use client";

import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Drawer } from "./drawer";
import { Dropdown } from "./dropdown";
import { EntryToast, useEntryStore } from "./entry-kit";
import { Button, fmt } from "./ui";
import { useApp } from "@/lib/context";
import { defaultTarget, locationUnits, pct, type Location } from "@/lib/data";
import { targetKey } from "@/lib/marketing";

/**
 * Side panel to enter admission targets per grade / programme for one school.
 * Saved targets replace the starting figures everywhere (Grade-wise, Seat Matrix & Targets, Dashboard).
 */
export function TargetsEditor({ locations, initialId, onClose }: { locations: Location[]; initialId?: string; onClose: () => void }) {
  const { cycle, seatVersion } = useApp();
  const entry = useEntryStore();
  const [locId, setLocId] = useState(initialId && locations.some((l) => l.id === initialId) ? initialId : locations[0]?.id);
  const loc = locations.find((l) => l.id === locId);
  const units = useMemo(() => (loc ? locationUnits(loc.id, cycle) : []), [loc, cycle, seatVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<Record<string, string>>({});
  const unitWord = loc?.vertical === "Higher Ed" ? "Programme" : "Grade";

  const valueOf = (unit: string, current: number) => draft[unit] ?? String(current);
  const changed = units.filter((u) => draft[u.unit] !== undefined && draft[u.unit] !== "" && Number(draft[u.unit]) !== u.target);
  const blank = units.filter((u) => draft[u.unit] === "");
  const total = units.reduce((s, u) => s + (draft[u.unit] ? Number(draft[u.unit]) : u.target), 0);
  const seats = units.reduce((s, u) => s + u.seats, 0);
  const overridden = loc ? units.filter((u) => entry.store.targets[targetKey(cycle, loc.id, u.unit)] !== undefined) : [];

  const switchLoc = (id: string) => {
    setLocId(id);
    setDraft({});
  };

  const save = () => {
    if (!loc || !changed.length) return;
    const detail = changed.map((u) => `${u.unit.replace(" – Y1", "")} ${u.target} → ${draft[u.unit]}`).join(", ");
    entry.commitStore("Target", "Updated", `${loc.short} · ${changed.length} ${unitWord.toLowerCase()}${changed.length === 1 ? "" : "s"}`, detail, (s) => {
      const targets = { ...s.targets };
      for (const u of changed) {
        const v = Number(draft[u.unit]);
        // Back to the starting figure: drop the override instead of storing a copy.
        if (v === defaultTarget(loc.id, u.unit, cycle)) delete targets[targetKey(cycle, loc.id, u.unit)];
        else targets[targetKey(cycle, loc.id, u.unit)] = v;
      }
      return { ...s, targets };
    });
    setDraft({});
  };

  const resetAll = () => {
    if (!loc || !overridden.length) return;
    entry.commitStore("Target", "Deleted", `${loc.short} · entered targets`, `${overridden.length} ${unitWord.toLowerCase()}${overridden.length === 1 ? "" : "s"} back to starting figures`, (s) => {
      const targets = { ...s.targets };
      for (const u of overridden) delete targets[targetKey(cycle, loc.id, u.unit)];
      return { ...s, targets };
    });
    setDraft({});
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="max-w-[620px]"
        title="Edit admission targets"
        subtitle={`Session ${cycle.replace("-", "–")} · achievement is measured on FABS-enrolled · every change is logged`}
        footer={
          <>
            {overridden.length > 0 && (
              <Button size="sm" variant="ghost" onClick={resetAll} title="Remove entered targets for this school">
                <RotateCcw size={13} /> Reset {overridden.length} to starting
              </Button>
            )}
            <span className="ml-auto" />
            <Button size="sm" variant="ghost" onClick={changed.length ? () => setDraft({}) : onClose}>{changed.length ? "Discard" : "Close"}</Button>
            <Button size="sm" variant="primary" disabled={!changed.length || blank.length > 0} onClick={save} title={blank.length ? "Fill in every target" : undefined}>
              Save {changed.length || ""} target{changed.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {locations.length > 1 && (
          <div className="mb-4">
            <span className="mb-1 block text-xs font-medium text-slate-600">School</span>
            <Dropdown ariaLabel="School" value={locId ?? ""} onChange={switchLoc} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
            {changed.length > 0 && <p className="mt-1 text-[11px] text-amber-700">Switching school discards unsaved changes.</p>}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm tabular">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{unitWord}</th>
                <th className="px-3 py-2 text-right font-medium">Seats</th>
                <th className="px-3 py-2 text-right font-medium">Enrolled</th>
                <th className="px-3 py-2 text-right font-medium">Target</th>
                <th className="px-3 py-2 text-right font-medium">Ach.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => {
                const raw = valueOf(u.unit, u.target);
                const t = raw === "" ? 0 : Number(raw);
                const dirty = draft[u.unit] !== undefined && Number(draft[u.unit]) !== u.target;
                const entered = loc && entry.store.targets[targetKey(cycle, loc.id, u.unit)] !== undefined;
                const a = pct(u.enrolled, t);
                return (
                  <tr key={u.unit}>
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-slate-800">{u.unit.replace(" – Y1", "")}</div>
                      {entered && !dirty && <div className="text-[10px] text-slate-400">Starting figure {defaultTarget(loc!.id, u.unit, cycle)}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500">{fmt(u.seats)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{fmt(u.enrolled)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        inputMode="numeric"
                        aria-label={`${u.unit} target`}
                        value={raw}
                        onChange={(e) => setDraft((d) => ({ ...d, [u.unit]: e.target.value.replace(/[^\d]/g, "") }))}
                        title={dirty ? `Was ${u.target}` : undefined}
                        className={clsx(
                          "w-20 rounded-md border px-2 py-1 text-right text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                          raw === "" ? "border-rose-300 bg-rose-50" : dirty ? "border-amber-300 bg-amber-50" : entered ? "border-brand-200 bg-brand-50/50" : "border-slate-200",
                        )}
                      />
                    </td>
                    <td className={clsx("px-3 py-1.5 text-right text-xs", t && a < 80 ? "font-semibold text-rose-600" : "text-slate-600")}>{t ? `${a.toFixed(0)}%` : "—"}</td>
                  </tr>
                );
              })}
              {!units.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No grades or programmes for this school.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{fmt(seats)}</td>
                <td className="px-3 py-2 text-right">{fmt(units.reduce((s, u) => s + u.enrolled, 0))}</td>
                <td className="px-3 py-2 text-right">{fmt(total)}</td>
                <td className="px-3 py-2 text-right text-xs">{total ? `${pct(units.reduce((s, u) => s + u.enrolled, 0), total).toFixed(0)}%` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded border border-amber-300 bg-amber-50" /> Unsaved change</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded border border-brand-200 bg-brand-50" /> Entered target</span>
          <span>Seats come from the Seat Matrix; enrolled from FABS.</span>
        </div>
      </Drawer>
      <EntryToast text={entry.toast} onClose={entry.clearToast} />
    </>
  );
}
