"use client";

import clsx from "clsx";
import { kpis, locationUnits, pct, sumStats, type Cycle, type Location } from "@/lib/data";
import { fmt } from "./ui";

interface Metric {
  label: string;
  value: (k: ReturnType<typeof kpis>, enrolledNew: number) => number;
  /** For withdrawal rate a lower value is better. */
  lowerIsBetter?: boolean;
  decimals?: number;
}

const METRICS: Metric[] = [
  { label: "Seat fill", value: (k) => k.seatFill },
  { label: "Target achievement", value: (k) => k.targetAch },
  { label: "Lead → application", value: (k) => k.leadToApp },
  { label: "Application → admission", value: (k) => k.appToAdm },
  { label: "Overall conversion", value: (k) => k.overall, decimals: 1 },
  { label: "New-adm. withdrawal rate", value: (k, enrolled) => pct(k.withdrawnNew, enrolled), lowerIsBetter: true, decimals: 1 },
];

const COLORS = { a: "bg-brand-600", b: "bg-amber-500" };

/** Head-to-head comparison of two segments across the core KPIs, as a compact table. */
/** Totals for a set of locations, narrowed to one grade when the Grade filter is set. */
const totalsOf = (locs: Location[], cycle: Cycle, grade: string) =>
  sumStats(locs.flatMap((l) => locationUnits(l.id, cycle)).filter((u) => grade === "All" || u.unit === grade));

function Pair({ title, a, b, cycle, grade }: { title: string; a: { label: string; locs: Location[] }; b: { label: string; locs: Location[] }; cycle: Cycle; grade: string }) {
  const ta = totalsOf(a.locs, cycle, grade);
  const tb = totalsOf(b.locs, cycle, grade);
  const ka = kpis(ta);
  const kb = kpis(tb);
  let aWins = 0, bWins = 0;
  const rows = METRICS.map((m) => {
    const va = m.value(ka, ta.enrolled);
    const vb = m.value(kb, tb.enrolled);
    const diff = va - vb;
    const tie = Math.abs(diff) < 0.05;
    const aBetter = !tie && (m.lowerIsBetter ? diff < 0 : diff > 0);
    if (!tie) aBetter ? aWins++ : bWins++;
    return { m, va, vb, diff, tie, aBetter, max: Math.max(va, vb, 1) * 1.05 };
  });

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-900">{title}</h3>
        <span className="text-[11px] text-slate-500">
          {aWins === bWins ? (
            <>Even — each leads on <b className="text-slate-700">{aWins}</b> of {METRICS.length}</>
          ) : (
            <>
              <b className={aWins > bWins ? "text-brand-700" : "text-amber-600"}>{aWins > bWins ? a.label : b.label}</b> leads on{" "}
              <b className="text-slate-700">{Math.max(aWins, bWins)}</b> of {METRICS.length}
            </>
          )}
        </span>
      </div>
      <table className="w-full table-fixed text-xs tabular">
        <colgroup>
          <col className="w-[34%]" />
          <col />
          <col />
          <col className="w-16" />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 text-[11px] text-slate-500">
            <th className="pb-1.5 text-left font-medium">Measure</th>
            <th className="pb-1.5 pl-2 text-left font-medium"><Key color={COLORS.a} label={`${a.label} (${a.locs.length})`} /></th>
            <th className="pb-1.5 pl-2 text-left font-medium"><Key color={COLORS.b} label={`${b.label} (${b.locs.length})`} /></th>
            <th className="pb-1.5 text-right font-medium">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ m, va, vb, diff, tie, aBetter, max }) => (
            <tr key={m.label}>
              <td className="truncate py-1.5 pr-2 text-slate-600" title={m.label}>{m.label}</td>
              <td className="py-1.5 pl-2"><Cell value={va} max={max} color={COLORS.a} decimals={m.decimals ?? 0} best={aBetter} /></td>
              <td className="py-1.5 pl-2"><Cell value={vb} max={max} color={COLORS.b} decimals={m.decimals ?? 0} best={!tie && !aBetter} /></td>
              <td className={clsx("py-1.5 text-right", tie ? "text-slate-400" : "text-slate-600")}>
                {tie ? "—" : `${Math.abs(diff).toFixed(1)} pp`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-between gap-2 text-[11px] text-slate-400 tabular">
        <span>{a.label}: {fmt(ta.enrolled)} enrolled / {fmt(ta.seats)} seats</span>
        <span>{b.label}: {fmt(tb.enrolled)} / {fmt(tb.seats)}</span>
      </div>
    </div>
  );
}

function Cell({ value, max, color, decimals, best }: { value: number; max: number; color: string; decimals: number; best: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx("w-11 shrink-0 text-right", best ? "font-semibold text-slate-900" : "text-slate-500")}>{value.toFixed(decimals)}%</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full", color, !best && "opacity-60")} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={clsx("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

export function SegmentComparison({ locations, cycle, grade = "All" }: { locations: Location[]; cycle: Cycle; grade?: string }) {
  // With a Grade filter, only locations that run that grade / programme take part.
  const offering = locations.filter((l) => grade === "All" || l.units.includes(grade));
  const schools = offering.filter((l) => l.vertical === "Schools");
  const higherEd = offering.filter((l) => l.vertical === "Higher Ed");
  const cbse = schools.filter((l) => l.board === "CBSE");
  const ib = schools.filter((l) => l.board === "IB");

  const pairs = [
    schools.length && higherEd.length ? { title: "Schools vs Higher Ed", a: { label: "Schools", locs: schools }, b: { label: "Higher Ed", locs: higherEd } } : null,
    cbse.length && ib.length ? { title: "CBSE vs IB (schools)", a: { label: "CBSE", locs: cbse }, b: { label: "IB", locs: ib } } : null,
  ].filter((p): p is NonNullable<typeof p> => !!p);

  if (!pairs.length)
    return <p className="py-8 text-center text-sm text-slate-500">The current filter has only one segment, so there is nothing to compare. Set Vertical and Board to “All”.</p>;

  return (
    <div>
      <div className={clsx("grid gap-x-8 gap-y-5", pairs.length > 1 && "md:grid-cols-2")}>
        {pairs.map((p, i) => (
          <div key={p.title} className={clsx(i && "border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0")}>
            <Pair {...p} cycle={cycle} grade={grade} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Bold value = better segment on that measure · gap shown in percentage points.</p>
    </div>
  );
}
