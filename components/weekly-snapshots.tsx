"use client";

import clsx from "clsx";
import { CalendarClock, Lock, Radio } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/context";
import { DATA_TODAY, kpis, NEXT_SNAPSHOT, snapshotFactor, SNAPSHOTS, totalsFor } from "@/lib/data";
import { Panel } from "./dashboard-widgets";
import { fmt } from "./ui";

type Metric = "enrolled" | "applications" | "leads" | "seatFill";
const METRICS: { id: Metric; label: string; short: string; pct?: boolean }[] = [
  { id: "enrolled", label: "FABS enrolled", short: "Enrolled" },
  { id: "applications", label: "Applications", short: "Applications" },
  { id: "leads", label: "Leads", short: "Leads" },
  { id: "seatFill", label: "Seat fill", short: "Seat fill", pct: true },
];

const WEEKLY = SNAPSHOTS.filter((s) => s.kind === "Weekly");

interface Col {
  id: string;
  title: string;
  date: string;
  value: number;
  gain: number | null;
  live?: boolean;
  href?: string;
}

/**
 * Locked Monday-morning snapshots (oldest → newest) plus today's live position,
 * with the gain each week so the pace of admissions is easy to read.
 */
export function WeeklySnapshots() {
  const { filteredLocations, cycle, seatVersion, can } = useApp();
  const [metric, setMetric] = useState<Metric>("enrolled");
  const m = METRICS.find((x) => x.id === metric)!;
  const ids = filteredLocations.map((l) => l.id);
  const live = useMemo(() => kpis(totalsFor(ids, cycle)), [ids.join(), cycle, seatVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const canOpen = can("view.reports");

  const cols: Col[] = useMemo(() => {
    const val = (f: number) => (m.pct ? live[metric] * f : Math.round(live[metric] * f));
    const weeks = [...WEEKLY].reverse(); // oldest first
    const out: Col[] = weeks.map((s, i) => {
      const [wk, date] = s.label.split(" · ");
      const v = val(snapshotFactor(s));
      const prev = i > 0 ? val(snapshotFactor(weeks[i - 1])) : null;
      return {
        id: s.id, title: wk, date: date.replace(/ \d{4}$/, ""), value: v, gain: prev === null ? null : v - prev,
        href: canOpen ? `/reports?tab=snapshots&snap=${s.id}` : undefined,
      };
    });
    const last = out.at(-1);
    out.push({
      id: "live", title: "Live", date: `Today · ${DATA_TODAY.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`,
      value: val(1), gain: last ? val(1) - last.value : null, live: true,
    });
    return out;
  }, [live, metric, m.pct, canOpen]);

  const weekGains = cols.filter((c) => !c.live && c.gain !== null).map((c) => c.gain!);
  const avg = weekGains.length ? weekGains.reduce((a, b) => a + b, 0) / weekGains.length : 0;
  const maxGain = Math.max(1e-9, ...cols.map((c) => Math.abs(c.gain ?? 0)));
  const show = (v: number) => (m.pct ? `${v.toFixed(1)}%` : fmt(v));
  const showGain = (g: number) => `${g >= 0 ? "+" : "−"}${m.pct ? `${Math.abs(g).toFixed(1)} pp` : fmt(Math.round(Math.abs(g)))}`;
  const latest = cols.at(-2);

  return (
    <Panel
      title="Weekly snapshots"
      sub={`Locked every Monday 9:00 am · ${filteredLocations.length === 1 ? filteredLocations[0].short : `${filteredLocations.length} locations`} · cycle ${cycle.replace("-", "–")}`}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="tablist" aria-label="Measure">
            {METRICS.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={metric === x.id}
                onClick={() => setMetric(x.id)}
                className={clsx("whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition", metric === x.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {x.short}
              </button>
            ))}
          </div>
          {canOpen && (
            <Link href="/reports?tab=snapshots" className="hidden whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 sm:inline-flex">
              All snapshots →
            </Link>
          )}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>
          Average gain <b className="text-sm font-semibold text-slate-800 tabular">{showGain(avg)}</b> a week
          <span className="text-slate-400"> · last {weekGains.length} weeks</span>
        </span>
        {latest?.gain != null && (
          <span>
            {latest.title} <b className={clsx("text-sm font-semibold tabular", latest.gain >= avg ? "text-emerald-700" : "text-amber-700")}>{showGain(latest.gain)}</b>
            <span className="text-slate-400"> · {latest.gain >= avg ? "above" : "below"} average</span>
          </span>
        )}
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cols.map((c) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-1">
                <span className={clsx("text-xs font-semibold", c.live ? "text-brand-700" : "text-slate-700")}>{c.title}</span>
                {c.live ? <Radio size={12} className="text-brand-600" aria-label="Live" /> : <Lock size={11} className="text-slate-300" aria-label="Locked" />}
              </div>
              <div className="text-[11px] text-slate-400">{c.date}</div>
              <div className="mt-1.5 text-lg font-bold leading-tight tracking-tight text-slate-900 tabular">{show(c.value)}</div>
              {/* Gain vs the week before, on one shared scale */}
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" aria-hidden>
                {c.gain !== null && (
                  <div
                    className={clsx("h-full rounded-full", c.live ? "bg-brand-500" : c.gain >= 0 ? "bg-emerald-500" : "bg-rose-500")}
                    style={{ width: `${Math.max(4, (Math.abs(c.gain) / maxGain) * 100)}%` }}
                  />
                )}
              </div>
              <div className={clsx("mt-1 text-[11px] font-medium tabular", c.gain === null ? "text-slate-400" : c.gain >= 0 ? "text-emerald-700" : "text-rose-600")}>
                {c.gain === null ? "First in range" : `${showGain(c.gain)} ${c.live ? "since Mon" : "in week"}`}
              </div>
            </>
          );
          const cls = clsx("block h-full min-w-0 rounded-lg border px-3 py-2.5", c.live ? "border-brand-200 bg-brand-50/60" : "border-slate-200 bg-white");
          return (
            <li key={c.id}>
              {c.href ? (
                <Link href={c.href} className={clsx(cls, "transition hover:border-brand-300 hover:shadow-sm")} title={`Open the ${c.title} snapshot`}>{body}</Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><CalendarClock size={12} className="text-brand-600" /> Next snapshot {NEXT_SNAPSHOT}</span>
        <span className="text-slate-400">Cumulative for the cycle · Date range, Grade and Lead source filters don’t apply to snapshots</span>
        {canOpen && <span className="ml-auto">Click a week to open it</span>}
      </div>
    </Panel>
  );
}
